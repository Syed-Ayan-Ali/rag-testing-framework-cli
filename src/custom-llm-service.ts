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
    try {
      // Use direct fetch call to the Qwen API with required parameters
      const endpoint = this.config.endpoint || 'https://api-inference.modelscope.cn/v1/chat/completions';
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model || 'Qwen/Qwen3-235B-A22B',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: maxTokens,
          temperature: 0.7,
          // Add Qwen-specific parameters
          enable_thinking: false, // Required for non-streaming calls
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data: any = await response.json();
      const content = data.choices[0]?.message?.content || '';

      return {
        content: content,
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0
        }
      };
    } catch (error) {
      // Throw the error instead of falling back to text processing
      throw new Error(`LLM API call failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  static createQwenModelConfig(): LLMConfig {
    return {
      provider: 'custom',
      apiKey: process.env.CUSTOM_API_KEY!,
      model: process.env.CUSTOM_MODEL || 'Qwen/Qwen3-235B-A22B',
      endpoint: process.env.CUSTOM_ENDPOINT || 'https://api-inference.modelscope.cn/v1/chat/completions',
    };
  }
}
