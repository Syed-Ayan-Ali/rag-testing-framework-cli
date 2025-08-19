import { EmbeddingConfig, LLMConfig } from './types';

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

export class OpenAILLMProvider implements LLMProvider {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (!this.config.apiKey) {
      throw new Error('OpenAI API key is required');
    }
  }

  async generateText(prompt: string, context: string): Promise<string> {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model || 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: context }
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      const data = await response.json() as any;
      
      if (!response.ok) {
        throw new Error(`OpenAI API error: ${data.error?.message || response.statusText}`);
      }

      return data.choices[0].message.content.trim();
    } catch (error) {
      console.error('Failed to generate OpenAI text:', error);
      throw error;
    }
  }
}

export class GeminiLLMProvider implements LLMProvider {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (!this.config.apiKey) {
      throw new Error('Gemini API key is required');
    }
  }

  async generateText(prompt: string, context: string): Promise<string> {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.config.model || 'gemini-1.5-flash'}:generateContent?key=${this.config.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: `${prompt}\n\nContext: ${context}` }]
          }]
        }),
      });

      const data = await response.json() as any;
      
      if (!response.ok) {
        throw new Error(`Gemini API error: ${data.error?.message || response.statusText}`);
      }

      return data.candidates[0].content.parts[0].text.trim();
    } catch (error) {
      console.error('Failed to generate Gemini text:', error);
      throw error;
    }
  }
}

export class AnthropicLLMProvider implements LLMProvider {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (!this.config.apiKey) {
      throw new Error('Anthropic API key is required');
    }
  }

  async generateText(prompt: string, context: string): Promise<string> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': this.config.apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.config.model || 'claude-3-sonnet-20240229',
          max_tokens: 1000,
          messages: [
            { role: 'user', content: `${prompt}\n\nContext: ${context}` }
          ],
        }),
      });

      const data = await response.json() as any;
      
      if (!response.ok) {
        throw new Error(`Anthropic API error: ${data.error?.message || response.statusText}`);
      }

      return data.content[0].text.trim();
    } catch (error) {
      console.error('Failed to generate Anthropic text:', error);
      throw error;
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
    switch (config.provider) {
      case 'openai':
        return new OpenAILLMProvider(config);
      case 'gemini':
        return new GeminiLLMProvider(config);
      case 'anthropic':
        return new AnthropicLLMProvider(config);
      default:
        throw new Error(`Unsupported LLM provider: ${config.provider}`);
    }
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

    return providers;
  }
}
