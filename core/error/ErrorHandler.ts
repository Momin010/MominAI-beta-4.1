import { EventEmitter } from 'events'

export interface ErrorContext {
  agentId: string
  timestamp: number
  operation?: string
  metadata?: Record<string, any>
}

export interface ErrorHandlerEvents {
  'error': (error: Error, context: ErrorContext) => void
  'recovery': (error: Error, context: ErrorContext) => void
}

// Emits: 'error' (error: Error, context: ErrorContext), 'recovery' (error: Error, context: ErrorContext)
export class ErrorHandler extends EventEmitter {
  private agent: any
  private errorHistory: Array<{ error: Error; context: ErrorContext }> = []
  private maxHistorySize = 100
  
  constructor(agent: any) {
    super()
    this.agent = agent
  }
  
  public async handleError(error: Error, operation?: string, metadata?: Record<string, any>): Promise<void> {
    const context: ErrorContext = {
      agentId: this.agent.agentId,
      timestamp: Date.now(),
      operation,
      metadata
    }
    
    // Add to error history
    this.errorHistory.push({ error, context })
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift()
    }
    
    // Emit error event
    this.emit('error', error, context)
    
    // Attempt recovery based on error type
    await this.attemptRecovery(error, context)
  }
  
  private async attemptRecovery(error: Error, context: ErrorContext): Promise<void> {
    try {
      if (this.isNetworkError(error)) {
        await this.handleNetworkError(error, context)
      } else if (this.isRateLimitError(error)) {
        await this.handleRateLimitError(error, context)
      } else if (this.isAuthenticationError(error)) {
        await this.handleAuthenticationError(error, context)
      } else if (this.isFileSystemError(error)) {
        await this.handleFileSystemError(error, context)
      } else if (this.isContextWindowError(error)) {
        await this.handleContextWindowError(error, context)
      } else {
        await this.handleGenericError(error, context)
      }
      
      this.emit('recovery', error, context)
    } catch (recoveryError) {
      console.error('Error recovery failed:', recoveryError)
    }
  }
  
  private isNetworkError(error: Error): boolean {
    const networkErrorMessages = [
      'network error',
      'connection refused',
      'timeout',
      'enotfound',
      'econnreset'
    ]
    
    return networkErrorMessages.some(msg => 
      error.message.toLowerCase().includes(msg)
    )
  }
  
  private isRateLimitError(error: Error): boolean {
    return error.message.toLowerCase().includes('rate limit') ||
           error.message.includes('429') ||
           error.message.toLowerCase().includes('too many requests')
  }
  
  private isAuthenticationError(error: Error): boolean {
    return error.message.toLowerCase().includes('unauthorized') ||
           error.message.includes('401') ||
           error.message.toLowerCase().includes('invalid api key')
  }
  
  private isFileSystemError(error: Error): boolean {
    const fsErrorCodes = ['ENOENT', 'EACCES', 'EPERM', 'EISDIR', 'ENOTDIR']
    return fsErrorCodes.some(code => error.message.includes(code))
  }
  
  private isContextWindowError(error: Error): boolean {
    return error.message.toLowerCase().includes('context window') ||
           error.message.toLowerCase().includes('token limit') ||
           error.message.toLowerCase().includes('maximum context length')
  }
  
  private async handleNetworkError(error: Error, context: ErrorContext): Promise<void> {
    console.log('Handling network error, will retry with exponential backoff')
    
    // Implement exponential backoff
    const retryCount = this.getRecentErrorCount('network', 5 * 60 * 1000) // 5 minutes
    const delay = Math.min(1000 * Math.pow(2, retryCount), 30000) // Max 30 seconds
    
    await new Promise(resolve => setTimeout(resolve, delay))
  }
  
  private async handleRateLimitError(error: Error, context: ErrorContext): Promise<void> {
    console.log('Handling rate limit error, implementing backoff')
    
    // Extract retry-after header if available
    let retryAfter = 60 // Default 60 seconds
    
    const retryAfterMatch = error.message.match(/retry after (\d+)/i)
    if (retryAfterMatch) {
      retryAfter = parseInt(retryAfterMatch[1])
    }
    
    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000))
  }
  
  private async handleAuthenticationError(error: Error, context: ErrorContext): Promise<void> {
    console.error('Authentication error - API key may be invalid or expired')
    
    // This would typically require user intervention
    // For now, we'll just log and continue
  }
  
  private async handleFileSystemError(error: Error, context: ErrorContext): Promise<void> {
    console.log('Handling file system error')
    
    if (error.message.includes('ENOENT')) {
      // File not found - might need to create parent directories
      console.log('File not found, may need to create directories')
    } else if (error.message.includes('EACCES') || error.message.includes('EPERM')) {
      // Permission error
      console.error('Permission denied for file operation')
    }
  }
  
  private async handleContextWindowError(error: Error, context: ErrorContext): Promise<void> {
    console.log('Handling context window error - need to truncate conversation')
    
    // This would typically trigger conversation truncation
    // For now, we'll just log
  }
  
  private async handleGenericError(error: Error, context: ErrorContext): Promise<void> {
    console.log('Handling generic error:', error.message)
    
    // Generic error handling - might involve asking user for guidance
  }
  
  private getRecentErrorCount(errorType: string, timeWindow: number): number {
    const now = Date.now()
    const recentErrors = this.errorHistory.filter(({ error, context }) => {
      const isRecentError = (now - context.timestamp) <= timeWindow
      const isMatchingType = this.getErrorType(error) === errorType
      return isRecentError && isMatchingType
    })
    
    return recentErrors.length
  }
  
  private getErrorType(error: Error): string {
    if (this.isNetworkError(error)) return 'network'
    if (this.isRateLimitError(error)) return 'rate_limit'
    if (this.isAuthenticationError(error)) return 'authentication'
    if (this.isFileSystemError(error)) return 'filesystem'
    if (this.isContextWindowError(error)) return 'context_window'
    return 'generic'
  }
  
  public getErrorHistory(): Array<{ error: Error; context: ErrorContext }> {
    return [...this.errorHistory]
  }
  
  public getErrorStats(): Record<string, number> {
    const stats: Record<string, number> = {}
    
    this.errorHistory.forEach(({ error }) => {
      const type = this.getErrorType(error)
      stats[type] = (stats[type] || 0) + 1
    })
    
    return stats
  }
  
  public clearErrorHistory(): void {
    this.errorHistory = []
  }
  
  public dispose(): void {
    this.removeAllListeners()
    this.errorHistory = []
  }
}