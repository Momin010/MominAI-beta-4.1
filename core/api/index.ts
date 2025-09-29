export interface ModelInfo {
  id: string
  name: string
  contextWindow: number
  maxTokens: number
  supportsImages?: boolean
  supportsTools?: boolean
  inputPrice?: number
  outputPrice?: number
}

export interface ProviderSettings {
  apiProvider: string
  apiKey?: string
  apiModelId?: string
  baseUrl?: string
  [key: string]: any
}

export interface ApiHandlerCreateMessageMetadata {
  mode?: string
  taskId: string
  previousResponseId?: string
  suppressPreviousResponseId?: boolean
  store?: boolean
}

export interface ApiMessage {
  role: 'user' | 'assistant' | 'system'
  content: string | Array<any>
  timestamp?: number
}

export interface ApiStream extends AsyncIterable<any> {
  [Symbol.asyncIterator](): AsyncIterator<any>
}

export interface ApiHandler {
  createMessage(
    systemPrompt: string,
    messages: ApiMessage[],
    metadata?: ApiHandlerCreateMessageMetadata
  ): ApiStream
  
  getModel(): { id: string; info: ModelInfo }
  countTokens(content: Array<any>): Promise<number>
}

export class BaseApiHandler implements ApiHandler {
  protected model: { id: string; info: ModelInfo }
  protected settings: ProviderSettings
  
  constructor(settings: ProviderSettings) {
    this.settings = settings
    this.model = {
      id: settings.apiModelId || 'default',
      info: {
        id: settings.apiModelId || 'default',
        name: 'Default Model',
        contextWindow: 128000,
        maxTokens: 4096,
        supportsImages: false,
        supportsTools: true
      }
    }
  }
  
  async *createMessage(
    systemPrompt: string,
    messages: ApiMessage[],
    metadata?: ApiHandlerCreateMessageMetadata
  ): ApiStream {
    // Base implementation - to be overridden by specific providers
    yield { type: 'text', text: 'Processing...' }
    yield { type: 'text', text: ' your request.' }
  }
  
  getModel(): { id: string; info: ModelInfo } {
    return this.model
  }
  
  async countTokens(content: Array<any>): Promise<number> {
    // Simple token estimation - can be enhanced with actual tokenizers
    const text = JSON.stringify(content)
    return Math.ceil(text.length / 4)
  }
}

export function buildApiHandler(configuration: ProviderSettings): ApiHandler {
  const { apiProvider } = configuration
  
  switch (apiProvider) {
    case 'gemini':
      return new GeminiHandler(configuration)
    case 'openai':
      return new OpenAIHandler(configuration)
    case 'anthropic':
      return new AnthropicHandler(configuration)
    default:
      return new BaseApiHandler(configuration)
  }
}

class GeminiHandler extends BaseApiHandler {
  async *createMessage(
    systemPrompt: string,
    messages: ApiMessage[],
    metadata?: ApiHandlerCreateMessageMetadata
  ): ApiStream {
    // Integrate with existing Gemini service
  // @ts-ignore
  const { streamResponse } = await import('../../services/geminiService')
    const prompt = `${systemPrompt}\n\n${messages.map(m => `${m.role}: ${m.content}`).join('\n')}`
    try {
      const stream = await streamResponse(prompt)
      for await (const chunk of stream) {
        yield { type: 'text', text: chunk }
      }
    } catch (error) {
      yield { type: 'error', error: error.message }
    }
  }
}

class OpenAIHandler extends BaseApiHandler {
  constructor(settings: ProviderSettings) {
    super(settings)
    this.model.info.supportsImages = true
    this.model.info.supportsTools = true
  }
  
  async *createMessage(
    systemPrompt: string,
    messages: ApiMessage[],
    metadata?: ApiHandlerCreateMessageMetadata
  ): ApiStream {
    // OpenAI implementation would go here
    yield { type: 'text', text: 'OpenAI response simulation' }
  }
}

class AnthropicHandler extends BaseApiHandler {
  constructor(settings: ProviderSettings) {
    super(settings)
    this.model.info.supportsImages = true
    this.model.info.supportsTools = true
    this.model.info.contextWindow = 200000
  }
  
  async *createMessage(
    systemPrompt: string,
    messages: ApiMessage[],
    metadata?: ApiHandlerCreateMessageMetadata
  ): ApiStream {
    // Anthropic implementation would go here
    yield { type: 'text', text: 'Anthropic response simulation' }
  }
}