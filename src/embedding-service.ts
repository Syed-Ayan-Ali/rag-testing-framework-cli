import { DatabaseConnection } from './database';
import { EmbeddingProvider, ProviderManager } from './providers';
import { EmbeddingTask } from './types';
import { getModelById, EmbeddingModel } from './models/embedding-models';
import ora from 'ora';
import chalk from 'chalk';
import * as readline from 'readline';

export class EmbeddingService {
  private database: DatabaseConnection;
  private embeddingProvider: EmbeddingProvider;
  private selectedModel: EmbeddingModel;

  constructor(database: DatabaseConnection, modelId: string) {
    this.database = database;
    
    const model = getModelById(modelId);
    if (!model) {
      throw new Error(`Unknown embedding model: ${modelId}`);
    }
    
    this.selectedModel = model;
    
    // Create provider based on model type
    const config = {
      model: model.provider,
      localModel: model.modelPath,
      openaiApiKey: process.env.OPENAI_API_KEY,
      openaiModel: model.apiModel,
      geminiApiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY,
      geminiModel: model.apiModel
    };
    
    this.embeddingProvider = ProviderManager.createEmbeddingProvider(config);
  }

  async initialize(): Promise<void> {
    await this.embeddingProvider.initialize();
  }

  async generateEmbeddings(task: EmbeddingTask): Promise<void> {
    const spinner = ora('Initializing embedding generation...').start();

    try {
      // Validate table and columns exist
      const tableInfo = await this.database.getTableInfo(task.tableName);
      if (!tableInfo) {
        throw new Error(`Table '${task.tableName}' not found`);
      }

      // Check if all source columns exist
      const missingColumns = task.columns.filter(col => 
        !tableInfo.columns.some(dbCol => dbCol.column_name === col)
      );
      if (missingColumns.length > 0) {
        throw new Error(`Columns not found in table: ${missingColumns.join(', ')}`);
      }

      // Check if embedding column exists
      const embeddingColumnExists = await this.database.checkColumnExists(
        task.tableName, 
        task.embeddingColumn
      );
      if (!embeddingColumnExists) {
        throw new Error(`Embedding column '${task.embeddingColumn}' not found in table`);
      }

      // Get all rows from the table
      spinner.text = 'Fetching all rows from table...';
      const allRows = await this.database.getTableData(task.tableName, task.columns, 10000);
      
      if (allRows.length === 0) {
        spinner.succeed(chalk.green(`✅ No rows found in table '${task.tableName}'`));
        return;
      }

      console.log(chalk.blue(`\n📊 Found ${allRows.length} rows to process`));
      console.log(chalk.gray('─'.repeat(50)));

      let totalProcessed = 0;
      let totalSkipped = 0;

      // Process each row individually
      for (let i = 0; i < allRows.length; i++) {
        const row = allRows[i];
        
        // Check if embedding already exists
        const existingEmbedding = await this.database.getRowColumnValue(
          task.tableName, 
          row.id, 
          task.embeddingColumn
        );

        if (existingEmbedding !== null && existingEmbedding !== '') {
          console.log(chalk.gray(`⏭️  Skipping row ${row.id}: embedding already exists`));
          totalSkipped++;
          continue;
        }

        // Generate embedding for this row
        try {
          const text = this.combineColumns(row, task.columns, task.customOrder);
          
          if (!text.trim()) {
            console.log(chalk.yellow(`⚠️  Skipping row ${row.id}: no valid text to embed`));
            totalSkipped++;
            continue;
          }

          console.log(chalk.cyan(`📝 Processing row ${row.id} (${i + 1}/${allRows.length}):`));
          console.log(chalk.gray(`Combined text: ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`));
          console.log(chalk.blue(`   🔄 Generating embedding (${this.selectedModel.name})...`));

          const embedding = await this.embeddingProvider.generateEmbedding(text);
          
          // Validate embedding dimensions
          if (embedding.length !== this.selectedModel.dimensions) {
            throw new Error(`Expected ${this.selectedModel.dimensions} dimensions, got ${embedding.length}`);
          }

          console.log(chalk.green(`   ✅ Generated embedding: ${embedding.length} dimensions`));
          console.log('');

          // Save embedding to database
          await this.database.updateRowEmbedding(
            task.tableName,
            row.id,
            task.embeddingColumn,
            embedding
          );

          totalProcessed++;
          spinner.text = `Processed ${totalProcessed} rows, skipped ${totalSkipped} rows...`;

          // Small delay to respect API rate limits
          await this.delay(100);

        } catch (error: any) {
          console.error(chalk.red(`❌ Failed to process row ${row.id}: ${error.message}`));
          // Continue with next row
        }
      }

      spinner.succeed(chalk.green(`✅ Embedding generation completed!`));
      console.log(chalk.blue(`\n📊 Summary:`));
      console.log(chalk.gray(`   • Table: ${task.tableName}`));
      console.log(chalk.gray(`   • Source columns: ${task.columns.join(', ')}`));
      console.log(chalk.gray(`   • Embedding column: ${task.embeddingColumn}`));
      console.log(chalk.gray(`   • Total rows processed: ${totalProcessed}`));
      console.log(chalk.gray(`   • Total rows skipped: ${totalSkipped}`));
      console.log(chalk.gray(`   • Total rows in table: ${allRows.length}`));
      console.log(chalk.gray(`   • Embedding provider: ${this.selectedModel.provider}`));
      console.log(chalk.gray(`   • Model: ${this.selectedModel.name} (${this.selectedModel.dimensions} dimensions)`));
      console.log('');

    } catch (error: any) {
      spinner.fail(chalk.red(`❌ Embedding generation failed: ${error.message}`));
      throw error;
    }
  }

  private combineColumns(row: any, columns: string[], customOrder?: boolean): string {
    if (customOrder) {
      // Use the exact order specified by user
      return columns
        .map(col => this.formatColumnValue(row[col]))
        .filter(val => val.length > 0)
        .join(' ');
    } else {
      // Use alphabetical order or natural database order
      const sortedColumns = [...columns].sort();
      return sortedColumns
        .map(col => this.formatColumnValue(row[col]))
        .filter(val => val.length > 0)
        .join(' ');
    }
  }

  private formatColumnValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    
    return String(value).trim();
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async askUserConfirmation(prompt: string): Promise<boolean> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(prompt, (answer) => {
        rl.close();
        const lowerAnswer = answer.toLowerCase().trim();
        resolve(lowerAnswer === 'yes' || lowerAnswer === 'y');
      });
    });
  }
}
