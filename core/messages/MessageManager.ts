import { EventEmitter } from 'events'
import crypto from 'crypto'

export interface Message {
  id: string
  type: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  timestamp: number
  images?: string[]
  metadata?: Record<string, any>
}

export interface MessageManagerEvents {
  'message': (message: Message) => void
  'message_updated': (message: Message) => void
  'messages_cleared': () => void
}

export class MessageManager extends EventEmitter {
  private messages: Message[] = []
  private agentId: string
  
  constructor(agentId: string) {
    super()
    this.agentId = agentId
  }
  
  public async addMessage(messageData: Partial<Message>): Promise<Message> {
    const message: Message = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      ...messageData
    } as Message
    
    this.messages.push(message)
  this.emit('message', message)
    
    return message
  }
  
  public async updateMessage(messageId: string, updates: Partial<Message>): Promise<Message | null> {
    const messageIndex = this.messages.findIndex(m => m.id === messageId)
    
    if (messageIndex === -1) {
      return null
    }
    
    const updatedMessage = {
      ...this.messages[messageIndex],
      ...updates,
      id: this.messages[messageIndex].id, // Preserve original ID
      timestamp: this.messages[messageIndex].timestamp // Preserve original timestamp
    }
    
    this.messages[messageIndex] = updatedMessage
  this.emit('message_updated', updatedMessage)
    
    return updatedMessage
  }
  
  public getMessages(): Message[] {
    return [...this.messages]
  }
  
  public getMessageById(messageId: string): Message | null {
    return this.messages.find(m => m.id === messageId) || null
  }
  
  public getMessagesByType(type: Message['type']): Message[] {
    return this.messages.filter(m => m.type === type)
  }
  
  public getLastMessage(): Message | null {
    return this.messages.length > 0 ? this.messages[this.messages.length - 1] : null
  }
  
  public getLastMessageByType(type: Message['type']): Message | null {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].type === type) {
        return this.messages[i]
      }
    }
    return null
  }
  
  public clearMessages(): void {
    this.messages = []
  this.emit('messages_cleared')
  }
  
  public removeMessage(messageId: string): boolean {
    const messageIndex = this.messages.findIndex(m => m.id === messageId)
    
    if (messageIndex === -1) {
      return false
    }
    
    this.messages.splice(messageIndex, 1)
    return true
  }
  
  public getConversationHistory(): Array<{ role: string; content: string }> {
    return this.messages
      .filter(m => m.type === 'user' || m.type === 'assistant')
      .map(m => ({
        role: m.type === 'user' ? 'user' : 'assistant',
        content: m.content
      }))
  }
  
  public getTokenCount(): number {
    // Simple token estimation - can be enhanced with actual tokenizers
    const totalText = this.messages.map(m => m.content).join(' ')
    return Math.ceil(totalText.length / 4)
  }
  
  public exportMessages(): string {
    return JSON.stringify(this.messages, null, 2)
  }
  
  public importMessages(messagesJson: string): void {
    try {
      const importedMessages = JSON.parse(messagesJson)
      
      if (Array.isArray(importedMessages)) {
        this.messages = importedMessages.map(m => ({
          id: m.id || crypto.randomUUID(),
          timestamp: m.timestamp || Date.now(),
          ...m
        }))
        
  this.emit('messages_cleared')
  this.messages.forEach(m => this.emit('message', m))
      }
    } catch (error) {
      throw new Error(`Failed to import messages: ${error.message}`)
    }
  }
  
  public getMessageStats(): {
    total: number
    byType: Record<string, number>
    totalTokens: number
    timespan: number
  } {
    const byType: Record<string, number> = {}
    
    this.messages.forEach(m => {
      byType[m.type] = (byType[m.type] || 0) + 1
    })
    
    const timestamps = this.messages.map(m => m.timestamp)
    const timespan = timestamps.length > 0 ? Math.max(...timestamps) - Math.min(...timestamps) : 0
    
    return {
      total: this.messages.length,
      byType,
      totalTokens: this.getTokenCount(),
      timespan
    }
  }
  
  public dispose(): void {
    this.removeAllListeners()
    this.messages = []
  }
}