import type { Message, Files, FileAttachment, ApiResponse } from '../types';

export interface ModelConfig {
  name: string;
  apiKey: string;
  endpoint: string;
  strengths: string[];
  maxTokens: number;
}

export interface AIRequest {
  messages: Message[];
  files?: Files;
  attachment?: FileAttachment;
  taskType: 'code_generation' | 'debugging' | 'explanation' | 'refactoring' | 'chat';
  onChunk?: (chunk: string) => void;
}

export class AIOrchestrator {
  private models: Map<string, ModelConfig> = new Map();
  
  constructor() {
    this.initializeModels();
  }

  private initializeModels() {
    // Gemini - Best for code generation and complex reasoning
    if (process.env.GEMINI_API_KEY) {
      this.models.set('gemini', {
        name: 'Gemini 2.5 Flash',
        apiKey: process.env.GEMINI_API_KEY,
        endpoint: 'gemini',
        strengths: ['code_generation', 'refactoring', 'complex_reasoning'],
        maxTokens: 32000
      });
    }

    // OpenAI - Best for chat and explanations
    if (process.env.OPENAI_API_KEY) {
      this.models.set('openai', {
        name: 'GPT-4',
        apiKey: process.env.OPENAI_API_KEY,
        endpoint: 'openai',
        strengths: ['chat', 'explanation', 'debugging'],
        maxTokens: 8000
      });
    }

    // Claude - Best for analysis and refactoring
    if (process.env.CLAUDE_API_KEY) {
      this.models.set('claude', {
        name: 'Claude 3.5 Sonnet',
        apiKey: process.env.CLAUDE_API_KEY,
        endpoint: 'claude',
        strengths: ['debugging', 'refactoring', 'analysis'],
        maxTokens: 8000
      });
    }

    // Cohere - Fallback option
    if (process.env.COHERE_API_KEY) {
      this.models.set('cohere', {
        name: 'Command R+',
        apiKey: process.env.COHERE_API_KEY,
        endpoint: 'cohere',
        strengths: ['chat', 'explanation'],
        maxTokens: 4000
      });
    }

    // Local model support
    if (process.env.LOCAL_MODEL_ENDPOINT) {
      this.models.set('local', {
        name: 'Local Model',
        apiKey: '',
        endpoint: process.env.LOCAL_MODEL_ENDPOINT,
        strengths: ['privacy', 'offline'],
        maxTokens: 4000
      });
    }
  }

  selectBestModel(taskType: string): ModelConfig | null {
    const availableModels = Array.from(this.models.values());
    
    // Priority mapping for different tasks
    const taskPriorities: Record<string, string[]> = {
      code_generation: ['gemini', 'claude', 'openai', 'local', 'cohere'],
      debugging: ['claude', 'openai', 'gemini', 'local', 'cohere'],
      explanation: ['openai', 'claude', 'gemini', 'cohere', 'local'],
      refactoring: ['claude', 'gemini', 'openai', 'local', 'cohere'],
      chat: ['openai', 'cohere', 'gemini', 'claude', 'local']
    };

    const priorities = taskPriorities[taskType] || taskPriorities.chat;
    
    for (const modelName of priorities) {
      const model = this.models.get(modelName);
      if (model) return model;
    }

    return availableModels[0] || null;
  }

  async sendRequest(request: AIRequest): Promise<ApiResponse> {
    const model = this.selectBestModel(request.taskType);
    if (!model) {
      throw new Error('No AI models available. Please configure at least one API key.');
    }

    console.log(`Using ${model.name} for ${request.taskType}`);

    switch (model.endpoint) {
      case 'gemini':
        return this.sendGeminiRequest(request, model);
      case 'openai':
        return this.sendOpenAIRequest(request, model);
      case 'claude':
        return this.sendClaudeRequest(request, model);
      case 'cohere':
        return this.sendCohereRequest(request, model);
      default:
        return this.sendLocalRequest(request, model);
    }
  }

  private async sendGeminiRequest(request: AIRequest, model: ModelConfig): Promise<ApiResponse> {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: model.apiKey });
    
    // Use existing Gemini implementation
    const { sendAiChatRequest } = await import('./geminiService');
    return sendAiChatRequest(request.messages, request.files || null, request.attachment || null);
  }

  private async sendOpenAIRequest(request: AIRequest, model: ModelConfig): Promise<ApiResponse> {
    // OpenAI implementation
    const messages = request.messages.map(msg => ({
      role: msg.role === 'model' ? 'assistant' : msg.role,
      content: msg.content
    }));

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${model.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages,
        max_tokens: model.maxTokens,
        stream: !!request.onChunk
      })
    });

    if (request.onChunk) {
      return this.handleStreamResponse(response, request.onChunk);
    }

    const data = await response.json();
    return {
      responseType: 'CHAT',
      message: data.choices[0].message.content
    };
  }

  private async sendClaudeRequest(request: AIRequest, model: ModelConfig): Promise<ApiResponse> {
    // Claude implementation
    const messages = request.messages.map(msg => ({
      role: msg.role === 'model' ? 'assistant' : msg.role,
      content: msg.content
    }));

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': model.apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        messages,
        max_tokens: model.maxTokens
      })
    });

    const data = await response.json();
    return {
      responseType: 'CHAT',
      message: data.content[0].text
    };
  }

  private async sendCohereRequest(request: AIRequest, model: ModelConfig): Promise<ApiResponse> {
    // Cohere implementation
    const response = await fetch('https://api.cohere.ai/v1/chat', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${model.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'command-r-plus',
        message: request.messages[request.messages.length - 1].content,
        max_tokens: model.maxTokens
      })
    });

    const data = await response.json();
    return {
      responseType: 'CHAT',
      message: data.text
    };
  }

  private async sendLocalRequest(request: AIRequest, model: ModelConfig): Promise<ApiResponse> {
    // Local model implementation (Ollama, etc.)
    const response = await fetch(`${model.endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'codellama',
        messages: request.messages,
        stream: false
      })
    });

    const data = await response.json();
    return {
      responseType: 'CHAT',
      message: data.message.content
    };
  }

  private async handleStreamResponse(response: Response, onChunk: (chunk: string) => void): Promise<ApiResponse> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    let fullResponse = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = new TextDecoder().decode(value);
      const lines = chunk.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || '';
            if (content) {
              fullResponse += content;
              onChunk(content);
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }

    return {
      responseType: 'CHAT',
      message: fullResponse
    };
  }

  getAvailableModels(): ModelConfig[] {
    return Array.from(this.models.values());
  }

  async checkModelHealth(modelName: string): Promise<boolean> {
    const model = this.models.get(modelName);
    if (!model) return false;
    
    try {
      // Simple health check - try a minimal request
      const testRequest: AIRequest = {
        messages: [{ role: 'user', content: 'test' }],
        taskType: 'chat'
      };
      await this.sendRequest(testRequest);
      return true;
    } catch {
      return false;
    }
  }

  async validateApiKey(provider: string, key: string): Promise<boolean> {
    // Basic validation - just check if key exists and has reasonable format
    if (!key || key.length < 10) return false;
    
    // Provider-specific validation could be added here
    return true;
  }

  updateUserKeys(userId: string, keys: Record<string, string>) {
    // Update API keys for user - could store in database
    console.log(`Updated API keys for user ${userId}`);
  }

  async getCodeSuggestions(params: any): Promise<any[]> {
    // Placeholder for code suggestions
    return [];
  }

  async analyzeCode(params: any): Promise<any> {
    // Placeholder for code analysis
    return { issues: [], suggestions: [] };
  }

  async generateCommitMessage(params: any): Promise<string> {
    // Placeholder for commit message generation
    return 'feat: update code';
  }
}

export const aiOrchestrator = new AIOrchestrator();