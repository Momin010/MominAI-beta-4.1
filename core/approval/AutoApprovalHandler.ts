import { EventEmitter } from 'events'

export interface ApprovalSettings {
  autoApprovalEnabled: boolean
  alwaysApproveResubmit: boolean
  maxAutoApprovals: number
  autoApprovalTimeWindow: number // in milliseconds
  dangerousCommandsRequireApproval: boolean
  fileOperationsRequireApproval: boolean
}

export interface ApprovalRequest {
  id: string
  type: 'command' | 'file_operation' | 'api_request' | 'tool_use'
  description: string
  details: any
  timestamp: number
  approved?: boolean
  autoApproved?: boolean
}

export interface ApprovalResult {
  shouldProceed: boolean
  autoApproved: boolean
  reason?: string
}

export class AutoApprovalHandler extends EventEmitter {
  private approvalHistory: ApprovalRequest[] = []
  private maxHistorySize = 1000
  
  constructor() {
    super()
  }
  
  public async checkAutoApprovalLimits(
    settings: ApprovalSettings,
    context: any,
    askFunction: (type: string, data: any) => Promise<{ response: string }>
  ): Promise<ApprovalResult> {
    
    if (!settings.autoApprovalEnabled) {
      return { shouldProceed: true, autoApproved: false }
    }
    
    const now = Date.now()
    const timeWindow = settings.autoApprovalTimeWindow || 3600000 // 1 hour default
    
    // Count recent auto-approvals
    const recentAutoApprovals = this.approvalHistory.filter(req => 
      req.autoApproved && 
      (now - req.timestamp) <= timeWindow
    ).length
    
    // Check if we've exceeded the limit
    if (recentAutoApprovals >= settings.maxAutoApprovals) {
      // Ask user for permission to continue
      const result = await askFunction('auto_approval_limit_reached', {
        recentApprovals: recentAutoApprovals,
        maxApprovals: settings.maxAutoApprovals,
        timeWindow: Math.floor(timeWindow / 60000) // Convert to minutes
      })
      
      if (result.response === 'yesButtonClicked') {
        // Reset the counter by clearing recent history
        this.clearRecentApprovals(timeWindow)
        return { shouldProceed: true, autoApproved: false, reason: 'User approved continuation' }
      } else {
        return { shouldProceed: false, autoApproved: false, reason: 'User denied continuation' }
      }
    }
    
    return { shouldProceed: true, autoApproved: true }
  }
  
  public async requestApproval(
    type: ApprovalRequest['type'],
    description: string,
    details: any,
    settings: ApprovalSettings,
    askFunction: (type: string, data: any) => Promise<{ response: string }>
  ): Promise<ApprovalResult> {
    
    const request: ApprovalRequest = {
      id: crypto.randomUUID(),
      type,
      description,
      details,
      timestamp: Date.now()
    }
    
    // Check if this type of operation requires manual approval
    const requiresManualApproval = this.requiresManualApproval(type, details, settings)
    
    if (!settings.autoApprovalEnabled || requiresManualApproval) {
      // Ask for manual approval
      const result = await askFunction(this.getApprovalPromptType(type), {
        description,
        details: JSON.stringify(details, null, 2)
      })
      
      request.approved = result.response === 'yesButtonClicked'
      request.autoApproved = false
      
      this.addToHistory(request)
      
      return {
        shouldProceed: request.approved || false,
        autoApproved: false,
        reason: request.approved ? 'User approved' : 'User denied'
      }
    }
    
    // Auto-approve
    request.approved = true
    request.autoApproved = true
    
    this.addToHistory(request)
    
    return {
      shouldProceed: true,
      autoApproved: true,
      reason: 'Auto-approved'
    }
  }
  
  private requiresManualApproval(
    type: ApprovalRequest['type'],
    details: any,
    settings: ApprovalSettings
  ): boolean {
    
    switch (type) {
      case 'command':
        if (settings.dangerousCommandsRequireApproval) {
          return this.isDangerousCommand(details.command)
        }
        break
        
      case 'file_operation':
        if (settings.fileOperationsRequireApproval) {
          return this.isDangerousFileOperation(details)
        }
        break
        
      case 'tool_use':
        return this.isDangerousToolUse(details)
        
      default:
        return false
    }
    
    return false
  }
  
  private isDangerousCommand(command: string): boolean {
    const dangerousPatterns = [
      /rm\s+-rf/,
      /sudo\s+rm/,
      /del\s+\/[sq]/i,
      /format\s+[a-z]:/i,
      /shutdown/i,
      /reboot/i,
      /kill\s+-9/,
      /pkill/,
      /chmod\s+777/,
      /chown\s+root/,
      /dd\s+if=/,
      /mkfs/,
      /fdisk/,
      /crontab\s+-r/,
      />.*\/dev\/(null|zero|random)/
    ]
    
    return dangerousPatterns.some(pattern => pattern.test(command))
  }
  
  private isDangerousFileOperation(details: any): boolean {
    const { operation, path } = details
    
    // Operations that modify system files
    if (operation === 'delete' || operation === 'write') {
      const dangerousPaths = [
        /^\/etc\//,
        /^\/bin\//,
        /^\/sbin\//,
        /^\/usr\/bin\//,
        /^\/usr\/sbin\//,
        /^\/boot\//,
        /^\/sys\//,
        /^\/proc\//,
        /^C:\\Windows\\/i,
        /^C:\\Program Files\\/i,
        /^C:\\System32\\/i
      ]
      
      return dangerousPaths.some(pattern => pattern.test(path))
    }
    
    return false
  }
  
  private isDangerousToolUse(details: any): boolean {
    const { toolName, args } = details
    
    // Tools that can cause system changes
    const dangerousTools = [
      'execute_command',
      'write_file',
      'delete_file',
      'browser_action'
    ]
    
    if (dangerousTools.includes(toolName)) {
      // Additional checks based on arguments
      if (toolName === 'execute_command') {
        return this.isDangerousCommand(args.command)
      }
      
      if (toolName === 'write_file' || toolName === 'delete_file') {
        return this.isDangerousFileOperation({ operation: toolName.split('_')[0], path: args.path })
      }
    }
    
    return false
  }
  
  private getApprovalPromptType(type: ApprovalRequest['type']): string {
    switch (type) {
      case 'command':
        return 'command_approval'
      case 'file_operation':
        return 'file_operation_approval'
      case 'tool_use':
        return 'tool_use_approval'
      case 'api_request':
        return 'api_request_approval'
      default:
        return 'general_approval'
    }
  }
  
  private addToHistory(request: ApprovalRequest): void {
    this.approvalHistory.push(request)
    
    // Trim history if it gets too large
    if (this.approvalHistory.length > this.maxHistorySize) {
      this.approvalHistory = this.approvalHistory.slice(-this.maxHistorySize)
    }
    
    this.emit('approval_recorded', request)
  }
  
  private clearRecentApprovals(timeWindow: number): void {
    const now = Date.now()
    this.approvalHistory = this.approvalHistory.filter(req => 
      (now - req.timestamp) > timeWindow
    )
  }
  
  public getApprovalHistory(): ApprovalRequest[] {
    return [...this.approvalHistory]
  }
  
  public getApprovalStats(): {
    total: number
    approved: number
    autoApproved: number
    denied: number
    byType: Record<string, number>
  } {
    const stats = {
      total: this.approvalHistory.length,
      approved: 0,
      autoApproved: 0,
      denied: 0,
      byType: {} as Record<string, number>
    }
    
    this.approvalHistory.forEach(req => {
      if (req.approved) {
        stats.approved++
        if (req.autoApproved) {
          stats.autoApproved++
        }
      } else {
        stats.denied++
      }
      
      stats.byType[req.type] = (stats.byType[req.type] || 0) + 1
    })
    
    return stats
  }
  
  public clearHistory(): void {
    this.approvalHistory = []
    this.emit('history_cleared')
  }
  
  public dispose(): void {
    this.removeAllListeners()
    this.approvalHistory = []
  }
}