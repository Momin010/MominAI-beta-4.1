import { EventEmitter } from 'events'
import crypto from 'crypto'

export interface AgentOptions {
  apiConfiguration: any
  workspacePath: string
  enableDiff?: boolean
  enableCheckpoints?: boolean
  fuzzyMatchThreshold?: number
  consecutiveMistakeLimit?: number
  experiments?: Record<string, boolean>
}

export interface AgentMessage {
  id: string
  type: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  timestamp: number
  images?: string[]
  metadata?: Record<string, any>
}

export interface AgentEvents {
  'message': (message: AgentMessage) => void
  'error': (error: Error) => void
  'status': (status: string) => void
  'tool_use': (toolName: string, args: any) => void
  'completion': (result: any) => void
}

export class Agent extends EventEmitter {
  /**
   * Stub for createCheckpoint. Returns a random checkpoint ID string.
   */
  public async createCheckpoint(): Promise<string> {
    // In a real implementation, this would save agent state and return a checkpoint ID
    return Promise.resolve('checkpoint-' + Math.random().toString(36).substring(2, 10));
  }
  public readonly agentId: string
  public readonly workspacePath: string
  protected apiConfiguration: any
  private isRunning = false
  private isAborted = false
  private consecutiveMistakeCount = 0
  private readonly consecutiveMistakeLimit: number
  private messages: AgentMessage[] = []
  
  constructor(options: AgentOptions) {
    super()
    
    this.agentId = crypto.randomUUID()
    this.workspacePath = options.workspacePath
  this.apiConfiguration = options.apiConfiguration
  this.consecutiveMistakeLimit = options.consecutiveMistakeLimit || 3
  }
  
  public async start(initialMessage: string, images?: string[]): Promise<void> {
    if (this.isRunning) {
      throw new Error('Agent is already running')
    }
    
    this.isRunning = true
    this.isAborted = false
  this.emit('status', 'starting')
    
    try {
      await this.addMessage({
        type: 'user',
        content: initialMessage,
        images
      })
      
      await this.processLoop()
      
    } catch (error) {
  this.emit('error', error as Error)
    } finally {
      this.isRunning = false
  this.emit('status', 'stopped')
    }
  }
  
  // Stub for subclasses to override
  public async executeTool(toolName: string, args: any): Promise<any> {
    throw new Error('executeTool not implemented')
  }
  
  private async processLoop(): Promise<void> {
    while (this.isRunning && !this.isAborted) {
      try {
        if (this.consecutiveMistakeCount >= this.consecutiveMistakeLimit) {
          await this.handleConsecutiveMistakes()
          this.consecutiveMistakeCount = 0
        }
        
        const response = await this.makeApiRequest()
        
        if (!response) break
        
        await this.addMessage({
          type: 'assistant',
          content: response
        })
        
        if (this.isTaskComplete(response)) {
          this.emit('completion', response)
          break
        }
        
        await new Promise(resolve => setTimeout(resolve, 100))
        
      } catch (error) {
  this.emit('error', error as Error)
        this.consecutiveMistakeCount++
      }
    }
  }
  
  private async makeApiRequest(): Promise<string> {
    // Simplified API request - will be enhanced with full Kilo Code integration
    return "I'm processing your request..."
  }
  
  private async handleConsecutiveMistakes(): Promise<void> {
    const message = `I've made ${this.consecutiveMistakeCount} consecutive mistakes. Let me reassess the situation.`
    
    await this.addMessage({
      type: 'assistant',
      content: message
    })
    
  this.emit('status', 'awaiting_guidance')
  }
  
  private isTaskComplete(content: string): boolean {
    return content.includes('<attempt_completion>') || 
           content.includes('task completed')
  }
  
  private async addMessage(message: Partial<AgentMessage>): Promise<void> {
    const fullMessage: AgentMessage = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type: message.type!,
      content: message.content!,
      images: message.images,
      metadata: message.metadata,
    }
    
    this.messages.push(fullMessage)
  this.emit('message', fullMessage)
  }
  
  public async sendMessage(message: string, images?: string[]): Promise<void> {
    if (!this.isRunning) {
      throw new Error('Agent is not running')
    }
    
    await this.addMessage({
      type: 'user',
      content: message,
      images
    })
  }
  
  public async abort(): Promise<void> {
    this.isAborted = true
    this.isRunning = false
  this.emit('status', 'aborted')
  }
  
  public getMessages(): AgentMessage[] {
    return [...this.messages]
  }
  
  public getStatus(): string {
    if (this.isAborted) return 'aborted'
    if (this.isRunning) return 'running'
    return 'idle'
  }
  
  public dispose(): void {
    this.isAborted = true
    this.isRunning = false
    this.removeAllListeners()
    this.messages = []
  }
}