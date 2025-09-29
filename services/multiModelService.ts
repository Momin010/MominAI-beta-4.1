import { GoogleGenAI } from '@google/genai';
import type { Message, Files, FileAttachment, ApiResponse } from '../types';
import { sendAiChatRequest as sendGeminiRequest } from './geminiService';

interface ModelConfig {
  provider: 'gemini' | 'openai' | 'anthropic';
  apiKey?: string;
  modelId: string;
}

class MultiModelService {
  private configs = new Map<string, ModelConfig>();
  private defaultApiKey = process.env.API_KEY || '';

  setModelConfig(modelId: string, config: ModelConfig) {
    this.configs.set(modelId, config);
  }

  async sendRequest(
    modelId: string,
    messages: Message[],
    files: Files | null,
    attachment?: FileAttachment
  ): Promise<ApiResponse> {
    const config = this.configs.get(modelId);
    
    if (!config) {
      // Default to Gemini with built-in API key
      return sendGeminiRequest(messages, files, attachment);
    }

    switch (config.provider) {
      case 'gemini':
        return this.sendGeminiRequest(config, messages, files, attachment);
      
      case 'openai':
        return this.sendOpenAIRequest(config, messages, files, attachment);
      
      case 'anthropic':
        return this.sendAnthropicRequest(config, messages, files, attachment);
      
      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }
  }

  private async sendGeminiRequest(
    config: ModelConfig,
    messages: Message[],
    files: Files | null,
    attachment?: FileAttachment
  ): Promise<ApiResponse> {
    // Use existing Gemini service
    return sendGeminiRequest(messages, files, attachment);
  }

  private async sendOpenAIRequest(
    config: ModelConfig,
    messages: Message[],
    files: Files | null,
    attachment?: FileAttachment
  ): Promise<ApiResponse> {
    if (!config.apiKey) {
      throw new Error('OpenAI API key required');
    }

    // Simplified OpenAI integration
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.modelId,
        messages: messages.map(m => ({
          role: m.role === 'model' ? 'assistant' : m.role,
          content: m.content
        })),
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    return JSON.parse(content);
  }

  private async sendAnthropicRequest(
    config: ModelConfig,
    messages: Message[],
    files: Files | null,
    attachment?: FileAttachment
  ): Promise<ApiResponse> {
    if (!config.apiKey) {
      throw new Error('Anthropic API key required');
    }

    // Simplified Anthropic integration
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': config.apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: config.modelId,
        max_tokens: 4096,
        messages: messages.filter(m => m.role !== 'system').map(m => ({
          role: m.role === 'model' ? 'assistant' : m.role,
          content: m.content
        }))
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.content[0]?.text;
    
    if (!content) {
      throw new Error('No response from Anthropic');
    }

    return JSON.parse(content);
  }
}

export const multiModelService = new MultiModelService();