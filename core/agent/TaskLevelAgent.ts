import { Agent } from './Agent'

// Recreate Kilo Code's critical missing features
export class TaskLevelAgent extends Agent {
  private toolRepetitionCount = new Map<string, number>()
  private contextWindow = 128000
  private maxConsecutiveToolUse = 5
  private subtasks = new Map<string, TaskLevelAgent>()
  private messageQueue: any[] = []
  
  // 1. Tool Repetition Detection (Kilo Code's ToolRepetitionDetector)
  private detectToolRepetition(toolName: string): boolean {
    const count = this.toolRepetitionCount.get(toolName) || 0
    this.toolRepetitionCount.set(toolName, count + 1)
    
    if (count >= this.maxConsecutiveToolUse) {
      throw new Error(`Tool ${toolName} used ${count} times consecutively - possible infinite loop`)
    }
    
    return count > 2 // Warning threshold
  }
  
  // 2. Sliding Window Context Management
  private async truncateConversationIfNeeded(messages: any[]): Promise<any[]> {
    const totalTokens = this.estimateTokens(messages)
    
    if (totalTokens > this.contextWindow * 0.8) {
      // Keep last 75% of conversation
      const keepCount = Math.floor(messages.length * 0.75)
      return messages.slice(-keepCount)
    }
    
    return messages
  }
  
  private estimateTokens(messages: any[]): number {
    return messages.reduce((total, msg) => total + Math.ceil(msg.content.length / 4), 0)
  }
  
  // 3. Subtask Management (Kilo Code's startSubtask/waitForSubtask)
  public async startSubtask(message: string, mode?: string): Promise<string> {
    const subtaskId = crypto.randomUUID()
    
    const subtask = new TaskLevelAgent({
      apiConfiguration: this.apiConfiguration,
      workspacePath: this.workspacePath,
      enableCheckpoints: false // Subtasks don't need checkpoints
    })
    
    this.subtasks.set(subtaskId, subtask)
    
    // Start subtask in background
    subtask.start(message).catch(error => {
      console.error(`Subtask ${subtaskId} failed:`, error)
    })
    
    return subtaskId
  }
  
  public async waitForSubtask(subtaskId: string): Promise<any> {
    const subtask = this.subtasks.get(subtaskId)
    if (!subtask) throw new Error(`Subtask ${subtaskId} not found`)
    
    return new Promise((resolve) => {
      subtask.on('completion', resolve)
      setTimeout(() => resolve(null), 300000) // 5 minute timeout
    })
  }
  
  // 4. Message Queue Processing (Kilo Code's MessageQueueService)
  public queueMessage(message: any): void {
    this.messageQueue.push(message)
  }
  
  public processQueuedMessages(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()
      this.sendMessage(message.text, message.images).catch(console.error)
    }
  }
  
  // 5. Advanced Error Recovery
  private async handleContextWindowError(): Promise<void> {
    console.log('Context window exceeded - truncating conversation')
    const messages = await this.getMessages()
    const truncated = await this.truncateConversationIfNeeded(messages)
    // Would need to update conversation history
  }
  
  // 6. GPT-5 Continuity (Kilo Code's previous_response_id)
  private lastResponseId?: string
  
  private async makeApiRequestWithContinuity(prompt: string): Promise<any> {
    const metadata = this.lastResponseId ? {
      previousResponseId: this.lastResponseId,
      taskId: this.agentId
    } : { taskId: this.agentId }
    
    // Would integrate with API handler
    return { continuity: true }
  }
  
  // Override tool execution to add repetition detection
  public async executeTool(toolName: string, args: any): Promise<any> {
    // Check for repetition before execution
    const isRepeating = this.detectToolRepetition(toolName)
    
    if (isRepeating) {
      console.warn(`Tool ${toolName} is being used repeatedly`)
    }
    
    try {
      const result = await super.executeTool?.(toolName, args)
      
      // Reset counter on successful execution
      if (result?.success) {
        this.toolRepetitionCount.set(toolName, 0)
      }
      
      return result
    } catch (error) {
      // Don't reset counter on error - might be stuck in loop
      throw error
    }
  }
  
  // Cleanup
  public dispose(): void {
    super.dispose()
    
    // Cleanup subtasks
    for (const [id, subtask] of this.subtasks) {
      subtask.dispose()
    }
    this.subtasks.clear()
    
    this.toolRepetitionCount.clear()
    this.messageQueue = []
  }
}