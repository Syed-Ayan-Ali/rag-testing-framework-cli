import * as fs from 'fs';
import * as path from 'path';
import { config as dotenvConfig } from 'dotenv';
import { CLIConfig, DatabaseConfig, EmbeddingConfig } from './types';

export class ConfigManager {
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(process.cwd(), '.rag-config.json');
  }

  async loadConfig(): Promise<CLIConfig> {
    // Load from .env file in current working directory (where user runs the command)
    const userEnvPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(userEnvPath)) {
      dotenvConfig({ path: userEnvPath });
    } else {
      // Fallback to default .env loading
      dotenvConfig();
    }

    // Try to load from config file
    let fileConfig: Partial<CLIConfig> = {};
    if (fs.existsSync(this.configPath)) {
      try {
        const configContent = fs.readFileSync(this.configPath, 'utf-8');
        fileConfig = JSON.parse(configContent);
      } catch (error) {
        console.warn(`Warning: Could not parse config file ${this.configPath}`);
      }
    }

    // Use Next.js/Supabase standard environment variable names
    const config: CLIConfig = {
      database: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || fileConfig.database?.url || '',
        anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || fileConfig.database?.anonKey || ''
      },
      embedding: {
        model: 'local',
        localModel: process.env.EMBEDDING_MODEL || fileConfig.embedding?.localModel || 'Xenova/all-MiniLM-L6-v2'
      },
      outputPath: process.env.OUTPUT_PATH || fileConfig.outputPath || './rag-test-results'
    };

    return config;
  }

  async saveConfig(config: CLIConfig): Promise<void> {
    try {
      const configJson = JSON.stringify(config, null, 2);
      fs.writeFileSync(this.configPath, configJson);
      console.log(`✅ Configuration saved to ${this.configPath}`);
    } catch (error) {
      throw new Error(`Failed to save config: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  validateConfig(config: CLIConfig): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.database.url) {
      errors.push('Database URL is required. Set NEXT_PUBLIC_SUPABASE_URL in your .env file or run "rag-test configure"');
    }

    if (!config.database.anonKey) {
      errors.push('Database anonymous key is required. Set NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env file or run "rag-test configure"');
    }

    if (!config.embedding.localModel) {
      errors.push('Embedding model name is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async initializeConfig(): Promise<CLIConfig> {
    const inquirer = await import('inquirer');
    
    console.log('🔧 Setting up RAG CLI Tester configuration...\n');

    const answers = await inquirer.default.prompt([
      {
        type: 'input',
        name: 'databaseUrl',
        message: 'Enter your Supabase URL:',
        validate: (input: string) => input.length > 0 || 'URL is required'
      },
      {
        type: 'input',
        name: 'databaseKey',
        message: 'Enter your Supabase anonymous key:',
        validate: (input: string) => input.length > 0 || 'Anonymous key is required'
      },
      {
        type: 'list',
        name: 'embeddingModel',
        message: 'Choose embedding model:',
        choices: [
          { name: 'all-MiniLM-L6-v2 (Default, lightweight)', value: 'Xenova/all-MiniLM-L6-v2' },
          { name: 'all-mpnet-base-v2 (Better quality, larger)', value: 'Xenova/all-mpnet-base-v2' },
          { name: 'multi-qa-MiniLM-L6-cos-v1 (Q&A optimized)', value: 'Xenova/multi-qa-MiniLM-L6-cos-v1' }
        ],
        default: 'Xenova/all-MiniLM-L6-v2'
      },
      {
        type: 'input',
        name: 'outputPath',
        message: 'Output directory for test results:',
        default: './rag-test-results'
      }
    ]);

    const config: CLIConfig = {
      database: {
        url: answers.databaseUrl,
        anonKey: answers.databaseKey
      },
      embedding: {
        model: 'local',
        localModel: answers.embeddingModel
      },
      outputPath: answers.outputPath
    };

    await this.saveConfig(config);
    return config;
  }

  getConfigPath(): string {
    return this.configPath;
  }
}
