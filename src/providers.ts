import { EmbeddingConfig, LLMConfig } from './types';
import chalk from 'chalk';

export interface EmbeddingProvider {
  generateEmbedding(text: string): Promise<number[]>;
  initialize(): Promise<void>;
}

export interface LLMProvider {
  generateText(prompt: string, context: string): Promise<string>;
  initialize(): Promise<void>;
}

export class LocalEmbeddingProvider implements EmbeddingProvider {
  private pipeline: any = null;
  private config: EmbeddingConfig;

  constructor(config: EmbeddingConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    try {
      const transformers = await eval('import("@xenova/transformers")');
      this.pipeline = await transformers.pipeline(
        'feature-extraction',
        this.config.localModel || 'Xenova/all-MiniLM-L6-v2'
      );
    } catch (error) {
      console.error('Failed to initialize local embedding model:', error);
      throw error;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.pipeline) {
      throw new Error('Pipeline not initialized');
    }

    const result = await this.pipeline(text);
    return Array.isArray(result.data) ? result.data : Array.from(result.data);
  }
}

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private config: EmbeddingConfig;

  constructor(config: EmbeddingConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (!this.config.openaiApiKey) {
      throw new Error('OpenAI API key is required');
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.openaiModel || 'text-embedding-3-small',
          input: text,
        }),
      });

      const data = await response.json() as any;
      
      if (!response.ok) {
        throw new Error(`OpenAI API error: ${data.error?.message || response.statusText}`);
      }

      return data.data[0].embedding;
    } catch (error) {
      console.error('Failed to generate OpenAI embedding:', error);
      throw error;
    }
  }
}

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  private config: EmbeddingConfig;

  constructor(config: EmbeddingConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (!this.config.geminiApiKey) {
      throw new Error('Gemini API key is required');
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.config.geminiModel || 'embedding-001'}:embedContent?key=${this.config.geminiApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: {
            parts: [{ text }]
          }
        }),
      });

      const data = await response.json() as any;
      
      if (!response.ok) {
        throw new Error(`Gemini API error: ${data.error?.message || response.statusText}`);
      }

      return data.embedding.values;
    } catch (error) {
      console.error('Failed to generate Gemini embedding:', error);
      throw error;
    }
  }
}

export class OpenAICompatibleLLMProvider implements LLMProvider {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (!this.config.apiKey) {
      throw new Error('API key is required');
    }
  }

  async generateText(prompt: string, context: string): Promise<string> {
    try {
      // Determine the API endpoint and format based on provider
      const { endpoint, headers, body, responseExtractor } = this.getProviderConfig(prompt, context);
      
      console.log(chalk.gray(`   🔗 API Endpoint: ${endpoint}`));
      console.log(chalk.gray(`   📤 Request Body: ${JSON.stringify(body, null, 2)}`));
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      // Check if response is HTML (error page) instead of JSON
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        const htmlResponse = await response.text();
        console.error(chalk.red(`❌ API returned HTML instead of JSON:`));
        console.error(chalk.red(`   Status: ${response.status} ${response.statusText}`));
        console.error(chalk.red(`   Endpoint: ${endpoint}`));
        console.error(chalk.red(`   Response preview: ${htmlResponse.substring(0, 200)}...`));
        throw new Error(`API endpoint returned HTML instead of JSON. Check your endpoint URL: ${endpoint}`);
      }

      const data = await response.json() as any;
      
      if (!response.ok) {
        throw new Error(`${this.config.provider} API error: ${data.error?.message || response.statusText}`);
      }

      return responseExtractor(data);
    } catch (error) {
      console.error(`Failed to generate ${this.config.provider} text:`, error);
      throw error;
    }
  }

  private getProviderConfig(prompt: string, context: string) {
    const basePrompt = `${prompt}\n\nContext: ${context}`;
    
    switch (this.config.provider) {
      case 'openai':
        return {
          endpoint: 'https://api.openai.com/v1/chat/completions',
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          } as Record<string, string>,
          body: {
            model: this.config.model || 'gpt-4o',
            messages: [
              { role: 'system', content: prompt },
              { role: 'user', content: context }
            ],
            temperature: 0.7,
            max_tokens: 1000,
          },
          responseExtractor: (data: any) => data.choices[0].message.content.trim()
        };

      case 'gemini':
        return {
          endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model || 'gemini-1.5-flash'}:generateContent?key=${this.config.apiKey}`,
          headers: {
            'Content-Type': 'application/json',
          } as Record<string, string>,
          body: {
            contents: [{
              parts: [{ text: basePrompt }]
            }]
          },
          responseExtractor: (data: any) => data.candidates[0].content.parts[0].text.trim()
        };

      case 'anthropic':
        return {
          endpoint: 'https://api.anthropic.com/v1/messages',
          headers: {
            'x-api-key': this.config.apiKey,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
          } as Record<string, string>,
          body: {
            model: this.config.model || 'claude-3-sonnet-20240229',
            max_tokens: 1000,
            messages: [
              { role: 'user', content: basePrompt }
            ],
          },
          responseExtractor: (data: any) => data.content[0].text.trim()
        };

      case 'custom':
        // For any OpenAI-compatible API
        let customEndpoint = this.config.endpoint || 'https://api.openai.com/v1/chat/completions';
        
        // Ensure the endpoint has the correct path for chat completions
        if (!customEndpoint.endsWith('/chat/completions')) {
          if (customEndpoint.endsWith('/')) {
            customEndpoint = customEndpoint + 'chat/completions';
          } else if (customEndpoint.endsWith('/v1')) {
            customEndpoint = customEndpoint + '/chat/completions';
          } else if (customEndpoint.endsWith('/v1/')) {
            customEndpoint = customEndpoint + 'chat/completions';
          } else {
            customEndpoint = customEndpoint + '/chat/completions';
          }
        }
        
        return {
          endpoint: customEndpoint,
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          } as Record<string, string>,
          body: {
            model: this.config.model || 'gpt-4o',
            messages: [
              { role: 'system', content: prompt },
              { role: 'user', content: context }
            ],
            temperature: 0.7,
            max_tokens: 1000,
          },
          responseExtractor: (data: any) => data.choices[0].message.content.trim()
        };

      default:
        throw new Error(`Unsupported provider: ${this.config.provider}`);
    }
  }
}

export class ProviderManager {
  static createEmbeddingProvider(config: EmbeddingConfig): EmbeddingProvider {
    switch (config.model) {
      case 'openai':
        return new OpenAIEmbeddingProvider(config);
      case 'gemini':
        return new GeminiEmbeddingProvider(config);
      case 'local':
      default:
        return new LocalEmbeddingProvider(config);
    }
  }

  static createLLMProvider(config: LLMConfig): LLMProvider {
    return new OpenAICompatibleLLMProvider(config);
  }

  static detectAvailableProviders(): {
    embedding: string[];
    llm: string[];
  } {
    const providers = {
      embedding: ['local'] as string[],
      llm: [] as string[]
    };

    // Check for API keys in environment
    if (process.env.OPENAI_API_KEY) {
      providers.embedding.push('openai');
      providers.llm.push('openai');
    }

    if (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY) {
      providers.embedding.push('gemini');
      providers.llm.push('gemini');
    }

    if (process.env.ANTHROPIC_API_KEY) {
      providers.llm.push('anthropic');
    }

    // Check for custom OpenAI-compatible API
    if (process.env.CUSTOM_API_KEY) {
      providers.llm.push('custom');
    }

    return providers;
  }
}
