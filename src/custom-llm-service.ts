import { LLMConfig } from './types';

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class CustomLLMService {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  async generateCompletion(prompt: string, maxTokens: number = 1000): Promise<LLMResponse> {
    if (this.config.provider === 'custom') {
      return this.callCustomModel(prompt, maxTokens);
    } else {
      throw new Error(`Provider ${this.config.provider} not supported by CustomLLMService`);
    }
  }

  private async callCustomModel(prompt: string, maxTokens: number): Promise<LLMResponse> {
    const endpoint = this.config.customEndpoint || this.config.endpoint;
    const apiKey = this.config.customApiKey || this.config.apiKey;
    const model = this.config.customModel || this.config.model;

    if (!endpoint) {
      throw new Error('Custom endpoint is required for custom model');
    }

    if (!apiKey) {
      throw new Error('Custom API key is required for custom model');
    }

    if (!model) {
      throw new Error('Custom model is required for custom model');
    }

    const requestBody = {
      model: model,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: maxTokens,
      temperature: 0.1,
      stream: false
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Custom model API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Handle different response formats
    let content: string;
    let usage: any;

    const responseData = data as any; // Type assertion for API response

    if (responseData.choices && responseData.choices[0]) {
      // OpenAI-compatible format
      content = responseData.choices[0].message?.content || responseData.choices[0].text || '';
      usage = responseData.usage;
    } else if (responseData.content) {
      // Direct content format
      content = responseData.content;
      usage = responseData.usage;
    } else {
      throw new Error('Unexpected response format from custom model');
    }

    return {
      content: content.trim(),
      usage: usage ? {
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0
      } : undefined
    };
  }

  static createQwenModelConfig(): LLMConfig {
    return {
      provider: 'custom',
      apiKey: 'ms-12345678-abcdefghijklmnop-1234',
      model: 'Qwen/Qwen3-235B-A22B',
      endpoint: 'https://api-inference.modelscope.cn/v1/chat/completions',
      customModel: 'Qwen/Qwen3-235B-A22B',
      customApiKey: 'ms-12345678-abcdefghijklmnop-1234',
      customEndpoint: 'https://api-inference.modelscope.cn/v1/chat/completions'
    };
  }
}
