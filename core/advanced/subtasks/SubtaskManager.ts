// Subtask management from Kilo Code
import { Agent } from '../../agent/Agent'
import { EventEmitter } from 'events'

export interface SubtaskOptions {
  message: string
  mode?: string
  initialTodos?: any[]
  parentTaskId: string
}

export class SubtaskManager extends EventEmitter {
  private subtasks = new Map<string, Agent>()
  private parentAgent: Agent
  
  constructor(parentAgent: Agent) {
    super()
    this.parentAgent = parentAgent
  }
  
  async startSubtask(options: SubtaskOptions): Promise<string> {
    const subtaskId = crypto.randomUUID()
    
    // Create child agent with same configuration
    const subtask = new Agent({
      apiConfiguration: this.parentAgent['apiConfiguration'],
      workspacePath: this.parentAgent.workspacePath,
      enableCheckpoints: false, // Subtasks don't need checkpoints
      consecutiveMistakeLimit: 3
    })
    
    // Set up event forwarding
    subtask.on('completion', (result) => {
      this.emit('subtask_completed', subtaskId, result)
    })
    
    subtask.on('error', (error) => {
      this.emit('subtask_error', subtaskId, error)
    })
    
    // Store subtask
    this.subtasks.set(subtaskId, subtask)
    
    // Start subtask
    try {
      await subtask.start(options.message)
      this.emit('subtask_started', subtaskId)
    } catch (error) {
      this.subtasks.delete(subtaskId)
      throw error
    }
    
    return subtaskId
  }
  
  async waitForSubtask(subtaskId: string, timeoutMs: number = 300000): Promise<any> {
    const subtask = this.subtasks.get(subtaskId)
    if (!subtask) {
      throw new Error(`Subtask ${subtaskId} not found`)
    }
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Subtask ${subtaskId} timed out after ${timeoutMs}ms`))
      }, timeoutMs)
      
      const onCompletion = (completedSubtaskId: string, result: any) => {
        if (completedSubtaskId === subtaskId) {
          clearTimeout(timeout)
          this.off('subtask_completed', onCompletion)
          this.off('subtask_error', onError)
          resolve(result)
        }
      }
      
      const onError = (errorSubtaskId: string, error: Error) => {
        if (errorSubtaskId === subtaskId) {
          clearTimeout(timeout)
          this.off('subtask_completed', onCompletion)
          this.off('subtask_error', onError)
          reject(error)
        }
      }
      
      this.on('subtask_completed', onCompletion)
      this.on('subtask_error', onError)
    })
  }
  
  async completeSubtask(subtaskId: string, result: string): Promise<void> {
    const subtask = this.subtasks.get(subtaskId)
    if (!subtask) {
      throw new Error(`Subtask ${subtaskId} not found`)
    }
    
    // Clean up subtask
    subtask.dispose()
    this.subtasks.delete(subtaskId)
    
    // Notify parent agent
    this.emit('subtask_result', subtaskId, result)
  }
  
  async abortSubtask(subtaskId: string): Promise<void> {
    const subtask = this.subtasks.get(subtaskId)
    if (subtask) {
      await subtask.abort()
      this.subtasks.delete(subtaskId)
    }
  }
  
  getActiveSubtasks(): string[] {
    return Array.from(this.subtasks.keys())
  }
  
  dispose(): void {
    // Clean up all subtasks
    for (const [id, subtask] of this.subtasks) {
      subtask.dispose()
    }
    this.subtasks.clear()
    this.removeAllListeners()
  }
}