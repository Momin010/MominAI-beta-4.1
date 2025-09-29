import { EventEmitter } from 'events'

export interface StreamChunk {
  type: 'text' | 'reasoning' | 'usage' | 'error' | 'tool_use'
  text?: string
  data?: any
  error?: string
}

export interface StreamResponse {
  content: string
  reasoning?: string
  toolUses?: Array<{ name: string; args: any }>
  usage?: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
}

export class StreamProcessor extends EventEmitter {
  private agent: any
  private currentContent = ''
  private currentReasoning = ''
  private toolUses: Array<{ name: string; args: any }> = []
  private usage?: any
  
  constructor(agent: any) {
    super()
    this.agent = agent
  }
  
  public async processStream(stream: AsyncIterable<StreamChunk>): Promise<StreamResponse | null> {
    this.reset()
    
    try {
      for await (const chunk of stream) {
        await this.processChunk(chunk)
      }
      
      return {
        content: this.currentContent,
        reasoning: this.currentReasoning,
        toolUses: this.toolUses,
        usage: this.usage
      }
    } catch (error) {
      this.emit('error', error)
      return null
    }
  }
  
  private async processChunk(chunk: StreamChunk): Promise<void> {
    switch (chunk.type) {
      case 'text':
        if (chunk.text) {
          this.currentContent += chunk.text
          this.emit('text_chunk', chunk.text)
        }
        break
        
      case 'reasoning':
        if (chunk.text) {
          this.currentReasoning += chunk.text
          this.emit('reasoning_chunk', chunk.text)
        }
        break
        
      case 'usage':
        this.usage = chunk.data
        this.emit('usage', chunk.data)
        break
        
      case 'tool_use':
        if (chunk.data) {
          this.toolUses.push(chunk.data)
          this.emit('tool_use', chunk.data)
        }
        break
        
      case 'error':
        this.emit('error', new Error(chunk.error || 'Stream error'))
        break
    }
  }
  
  private reset(): void {
    this.currentContent = ''
    this.currentReasoning = ''
    this.toolUses = []
    this.usage = undefined
  }
  
  public getCurrentContent(): string {
    return this.currentContent
  }
  
  public getCurrentReasoning(): string {
    return this.currentReasoning
  }
  
  public getToolUses(): Array<{ name: string; args: any }> {
    return [...this.toolUses]
  }
  
  public getUsage(): any {
    return this.usage
  }
}