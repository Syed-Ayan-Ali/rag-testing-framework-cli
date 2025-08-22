import { DatabaseConnection } from './database';
import { EmbeddingProvider, ProviderManager } from './providers';
import { EmbeddingConfig, EmbeddingTask } from './types';
import ora from 'ora';
import chalk from 'chalk';
import * as readline from 'readline';

export class EmbeddingService {
  private database: DatabaseConnection;
  private embeddingProvider: EmbeddingProvider;
  private config: EmbeddingConfig;

  constructor(database: DatabaseConnection, config: EmbeddingConfig) {
    this.database = database;
    this.config = config;
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

      // Check if embedding column already has data and warn user
      spinner.text = 'Checking for existing embeddings...';
      const existingEmbeddingCount = await this.database.getColumnDataCount(task.tableName, task.embeddingColumn);
      console.log(chalk.gray(`   Found ${existingEmbeddingCount} rows with existing embeddings`));
      
      if (existingEmbeddingCount > 0) {
        spinner.stop();
        console.log(chalk.yellow(`⚠️  Warning: Column '${task.embeddingColumn}' already contains embeddings in ${existingEmbeddingCount} rows!`));
        console.log(chalk.yellow(`   This operation will overwrite existing embeddings.`));
        
        const confirm = await this.askUserConfirmation(
          `Are you sure you want to continue and potentially overwrite existing embeddings in '${task.embeddingColumn}'? (yes/no): `
        );
        
        if (!confirm) {
          console.log(chalk.blue('Operation cancelled by user.'));
          return;
        }
        
        spinner.start('Continuing with embedding generation...');
      }

      // Get total count of rows that need processing
      spinner.text = 'Counting rows that need processing...';
      const totalRowsToProcess = await this.database.getEmptyColumnCount(
        task.tableName,
        task.embeddingColumn
      );
      console.log(chalk.gray(`   Found ${totalRowsToProcess} rows that need embeddings`));

      if (totalRowsToProcess === 0) {
        spinner.succeed(chalk.green(`✅ Column '${task.embeddingColumn}' already has all embeddings generated!`));
        return;
      }

      spinner.text = `Found ${totalRowsToProcess} rows to process...`;
      console.log(chalk.blue(`\n📊 Total rows to process: ${totalRowsToProcess}`));
      console.log(chalk.gray('─'.repeat(50)));

      let totalProcessed = 0;
      let processedRowIds = new Set(); // Track processed rows to avoid duplicates

      // Process rows in batches but track each row individually
      while (totalProcessed < totalRowsToProcess) {
        const remainingRows = totalRowsToProcess - totalProcessed;
        const currentBatchSize = Math.min(task.batchSize, remainingRows);
        
        // Get next batch of unprocessed rows
        const rows = await this.database.getRowsWithoutEmbeddings(
          task.tableName,
          task.embeddingColumn,
          task.columns,
          currentBatchSize
        );

        if (rows.length === 0) {
          break; // No more rows to process
        }

        // Filter out rows that have already been processed
        const unprocessedRows = rows.filter(row => !processedRowIds.has(row.id));
        
        if (unprocessedRows.length === 0) {
          break; // All rows in this batch were already processed
        }

        spinner.text = `Processing batch ${Math.floor(totalProcessed / task.batchSize) + 1} (${unprocessedRows.length} rows)...`;
        console.log(chalk.blue(`\n🔄 Processing batch ${Math.floor(totalProcessed / task.batchSize) + 1} (${unprocessedRows.length} rows)`));
        console.log(chalk.gray('─'.repeat(50)));

        const results = await this.processBatch(unprocessedRows, task);
        
        spinner.text = `Updating database with ${results.length} embeddings...`;
        console.log(chalk.green(`✅ Generated embeddings for ${results.length} rows`));
        
        // Update database and track processed rows
        for (const result of results) {
          await this.database.updateRowEmbedding(
            task.tableName,
            result.id,
            task.embeddingColumn,
            result.embedding
          );
          processedRowIds.add(result.id);
        }

        totalProcessed += results.length;
        const progressPercentage = Math.round((totalProcessed / totalRowsToProcess) * 100);
        spinner.text = `Processed ${totalProcessed}/${totalRowsToProcess} rows (${progressPercentage}%)...`;
        console.log(chalk.gray('─'.repeat(50)));
        console.log('');

        // Add delay between batches to respect API rate limits
        if (totalProcessed < totalRowsToProcess) {
          await this.delay(500);
        }
      }

      spinner.succeed(chalk.green(`✅ Successfully generated embeddings for ${totalProcessed} rows`));
      console.log(chalk.blue(`\n📊 Summary:`));
      console.log(chalk.gray(`   • Table: ${task.tableName}`));
      console.log(chalk.gray(`   • Source columns: ${task.columns.join(', ')}`));
      console.log(chalk.gray(`   • Embedding column: ${task.embeddingColumn}`));
      console.log(chalk.gray(`   • Total rows processed: ${totalProcessed}`));
      console.log(chalk.gray(`   • Total rows in table: ${totalRowsToProcess + (await this.database.getColumnDataCount(task.tableName, task.embeddingColumn))}`));
      console.log(chalk.gray(`   • Embedding provider: ${this.config.model}`));
      console.log(chalk.gray(`   • Batch size used: ${task.batchSize}`));
      console.log('');

    } catch (error: any) {
      spinner.fail(chalk.red(`❌ Embedding generation failed: ${error.message}`));
      throw error;
    }
  }

  private async processBatch(
    rows: any[], 
    task: EmbeddingTask
  ): Promise<Array<{ id: any; embedding: number[] }>> {
    const results = [];

    for (const row of rows) {
      try {
        const text = this.combineColumns(row, task.columns, task.customOrder);
        
        if (!text.trim()) {
          console.warn(`Skipping row ${row.id}: no valid text generated from columns`);
          continue;
        }

        // Print the source text for each row being processed
        console.log(chalk.cyan(`📝 Processing row ${row.id}:`));
        console.log(chalk.gray(`Combined text: ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`));
        console.log(chalk.blue(`   🔄 Generating embedding (${this.config.model})...`));

        const embedding = await this.embeddingProvider.generateEmbedding(text);
        
        // Warn if embedding is too large for Supabase
        // if (embedding.length > 16000) {
        //   console.log(chalk.red(`❌ ERROR: Embedding has ${embedding.length} dimensions, which exceeds Supabase's 16000 limit!`));
        //   console.log(chalk.yellow(`   Consider using a smaller model like 'Xenova/all-MiniLM-L6-v2-small' or 'Xenova/all-MiniLM-L6-v2'`));
        //   throw new Error(`Embedding dimension ${embedding.length} exceeds Supabase limit of 16000`);
        // }
        
        console.log(chalk.green(`   ✅ Generated embedding: ${embedding.length} dimensions`));
        console.log('');
        
        results.push({
          id: row.id,
          embedding
        });

        // Add small delay to respect API rate limits
        await this.delay(100);
      } catch (error: any) {
        console.warn(chalk.red(`Failed to generate embedding for row ${row.id}: ${error.message}`));
        // Continue with other rows
      }
    }

    return results;
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

  async getEmbeddingProgress(tableName: string, embeddingColumn: string): Promise<{
    total: number;
    completed: number;
    remaining: number;
    percentage: number;
  }> {
    try {
      const tableInfo = await this.database.getTableInfo(tableName);
      const total = tableInfo?.rowCount || 0;

      const remainingRows = await this.database.getRowsWithoutEmbeddings(
        tableName,
        embeddingColumn,
        ['id'],
        10000 // Large limit to get accurate count
      );
      
      const remaining = remainingRows.length;
      const completed = total - remaining;
      const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

      return { total, completed, remaining, percentage };
    } catch (error) {
      console.error('Failed to get embedding progress:', error);
      return { total: 0, completed: 0, remaining: 0, percentage: 0 };
    }
  }
}
