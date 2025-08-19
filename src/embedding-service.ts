import { DatabaseConnection } from './database';
import { EmbeddingProvider, ProviderManager } from './providers';
import { EmbeddingConfig, EmbeddingTask } from './types';
import ora from 'ora';
import chalk from 'chalk';

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

      spinner.text = 'Finding rows without embeddings...';
      let totalProcessed = 0;
      let hasMoreRows = true;

      while (hasMoreRows) {
        const rows = await this.database.getRowsWithoutEmbeddings(
          task.tableName,
          task.embeddingColumn,
          task.columns,
          task.batchSize
        );

        if (rows.length === 0) {
          hasMoreRows = false;
          break;
        }

        spinner.text = `Processing batch of ${rows.length} rows...`;

        const results = await this.processBatch(rows, task);
        
        spinner.text = `Updating database with ${results.length} embeddings...`;
        
        for (const result of results) {
          await this.database.updateRowEmbedding(
            task.tableName,
            result.id,
            task.embeddingColumn,
            result.embedding
          );
        }

        totalProcessed += results.length;
        spinner.text = `Processed ${totalProcessed} rows...`;

        if (rows.length < task.batchSize) {
          hasMoreRows = false;
        }
      }

      spinner.succeed(chalk.green(`✅ Successfully generated embeddings for ${totalProcessed} rows`));

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
        const embedding = await this.embeddingProvider.generateEmbedding(text);
        
        results.push({
          id: row.id,
          embedding
        });
      } catch (error: any) {
        console.warn(`Failed to generate embedding for row ${row.id}:`, error.message);
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
