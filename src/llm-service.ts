import { DatabaseConnection } from './database';
import { LLMProvider, ProviderManager } from './providers';
import { LLMConfig, ColumnPopulationTask } from './types';
import ora from 'ora';
import chalk from 'chalk';

export class LLMService {
  private database: DatabaseConnection;
  private llmProvider: LLMProvider;
  private config: LLMConfig;

  constructor(database: DatabaseConnection, config: LLMConfig) {
    this.database = database;
    this.config = config;
    this.llmProvider = ProviderManager.createLLMProvider(config);
  }

  async initialize(): Promise<void> {
    await this.llmProvider.initialize();
  }

  async populateColumn(task: ColumnPopulationTask): Promise<void> {
    const spinner = ora('Initializing column population...').start();

    try {
      // Validate table and columns exist
      const tableInfo = await this.database.getTableInfo(task.tableName);
      if (!tableInfo) {
        throw new Error(`Table '${task.tableName}' not found`);
      }

      // Check if source column exists
      const sourceColumnExists = tableInfo.columns.some(col => col.column_name === task.sourceColumn);
      if (!sourceColumnExists) {
        throw new Error(`Source column '${task.sourceColumn}' not found in table`);
      }

      // Check if target column exists
      const targetColumnExists = tableInfo.columns.some(col => col.column_name === task.targetColumn);
      if (!targetColumnExists) {
        throw new Error(`Target column '${task.targetColumn}' not found in table`);
      }

      // Get target column data type for proper formatting
      const targetColumnInfo = tableInfo.columns.find(col => col.column_name === task.targetColumn);
      const targetDataType = targetColumnInfo?.data_type;

      spinner.text = 'Finding rows with empty target columns...';
      let totalProcessed = 0;
      let hasMoreRows = true;

      while (hasMoreRows) {
        const rows = await this.database.getRowsWithEmptyColumn(
          task.tableName,
          task.targetColumn,
          [task.sourceColumn],
          task.batchSize
        );

        if (rows.length === 0) {
          hasMoreRows = false;
          break;
        }

        spinner.text = `Processing batch of ${rows.length} rows...`;
        console.log(chalk.blue(`\n🔄 Processing batch ${Math.floor(totalProcessed / task.batchSize) + 1} (${rows.length} rows)`));
        console.log(chalk.gray('─'.repeat(50)));

        const results = await this.processBatch(rows, task, targetDataType);
        
        spinner.text = `Updating database with ${results.length} generated values...`;
        console.log(chalk.green(`✅ Generated content for ${results.length} rows`));
        
        for (const result of results) {
          await this.database.updateRowColumn(
            task.tableName,
            result.id,
            task.targetColumn,
            result.value
          );
        }

        totalProcessed += results.length;
        spinner.text = `Processed ${totalProcessed} rows...`;
        console.log(chalk.gray('─'.repeat(50)));
        console.log('');

        if (rows.length < task.batchSize) {
          hasMoreRows = false;
        }
      }

      spinner.succeed(chalk.green(`✅ Successfully populated ${totalProcessed} rows in column '${task.targetColumn}'`));
      console.log(chalk.blue(`\n📊 Summary:`));
      console.log(chalk.gray(`   • Table: ${task.tableName}`));
      console.log(chalk.gray(`   • Source column: ${task.sourceColumn}`));
      console.log(chalk.gray(`   • Target column: ${task.targetColumn}`));
      console.log(chalk.gray(`   • Total rows processed: ${totalProcessed}`));
      console.log(chalk.gray(`   • LLM provider: ${this.config.provider}`));
      console.log(chalk.gray(`   • Model: ${this.config.model}`));
      console.log('');

    } catch (error: any) {
      spinner.fail(chalk.red(`❌ Column population failed: ${error.message}`));
      throw error;
    }
  }

  private async processBatch(
    rows: any[], 
    task: ColumnPopulationTask,
    targetDataType?: string
  ): Promise<Array<{ id: any; value: any }>> {
    const results = [];

    for (const row of rows) {
      console.log(chalk.red(`\n🔄 ${row}:`));
      try {
        const sourceValue = this.formatSourceValue(row[task.sourceColumn]);
        if (!sourceValue) {
          console.warn(`Skipping row ${row.id}: empty source column value`);
          continue;
        }

        // Print the source column text for each row being processed
        console.log(chalk.cyan(`📝 Processing row ${row.id}:`));
        console.log(chalk.gray(`Source (${task.sourceColumn}): ${sourceValue.substring(0, 200)}${sourceValue.length > 200 ? '...' : ''}`));
        console.log(chalk.blue(`   🔄 Calling LLM (${this.config.provider}/${this.config.model})...`));
        console.log('');

        const generatedText = await this.llmProvider.generateText(task.prompt, sourceValue);
        const formattedValue = this.formatValueForDatabase(generatedText, targetDataType);
        
        // Show the generated content
        console.log(chalk.yellow(`🤖 Generated content:`));
        console.log(chalk.gray(`   ${generatedText.substring(0, 150)}${generatedText.length > 150 ? '...' : ''}`));
        console.log(chalk.green(`   ✅ Formatted for ${targetDataType || 'text'} column`));
        console.log('');
        
        results.push({
          id: row.id,
          value: formattedValue
        });

        // Add small delay to respect API rate limits
        await this.delay(100);
      } catch (error: any) {
        console.warn(`Failed to generate content for row ${row.id}:`, error.message);
        // Continue with other rows
      }
    }

    return results;
  }

  private formatSourceValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    
    return String(value).trim();
  }

  private formatValueForDatabase(value: string, dataType?: string): any {
    if (!dataType) {
      return value;
    }

    const normalizedType = dataType.toLowerCase();

    // Handle array types (like text[], jsonb, etc.)
    if (normalizedType.includes('[]') || normalizedType === 'jsonb' || normalizedType === 'json') {
      try {
        // Try to parse as JSON first
        return JSON.parse(value);
      } catch {
        // If parsing fails, try to convert to array format
        if (value.includes(',') || value.includes('\n')) {
          const items = value.split(/[,\n]/)
            .map(item => item.trim())
            .filter(item => item.length > 0);
          return items;
        }
        // Single value as array
        return [value];
      }
    }

    // Handle boolean types
    if (normalizedType === 'boolean') {
      const lowerValue = value.toLowerCase();
      return lowerValue === 'true' || lowerValue === 'yes' || lowerValue === '1';
    }

    // Handle numeric types
    if (normalizedType.includes('int') || normalizedType.includes('numeric') || normalizedType.includes('decimal')) {
      const num = parseFloat(value);
      return isNaN(num) ? 0 : num;
    }

    // Default to text
    return value;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getPopulationProgress(tableName: string, targetColumn: string): Promise<{
    total: number;
    completed: number;
    remaining: number;
    percentage: number;
  }> {
    try {
      const tableInfo = await this.database.getTableInfo(tableName);
      const total = tableInfo?.rowCount || 0;

      const remainingRows = await this.database.getRowsWithEmptyColumn(
        tableName,
        targetColumn,
        ['id'],
        10000 // Large limit to get accurate count
      );
      
      const remaining = remainingRows.length;
      const completed = total - remaining;
      const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

      return { total, completed, remaining, percentage };
    } catch (error) {
      console.error('Failed to get population progress:', error);
      return { total: 0, completed: 0, remaining: 0, percentage: 0 };
    }
  }

  // Utility method to create common prompts
  static createPrompt(type: 'tags' | 'description' | 'summary' | 'keywords' | 'custom', customPrompt?: string): string {
    switch (type) {
      case 'tags':
        return `Generate 3-5 relevant tags for the following content. Return the tags as a JSON array of strings. Focus on the main topics, concepts, and categories. Tags should be concise (1-3 words each).`;
      
      case 'description':
        return `Generate 2-3 natural language questions that a user might ask to retrieve this content in a RAG system. The questions should be specific enough to match this content but general enough that a user might actually ask them. Return as a JSON array of strings.`;
      
      case 'summary':
        return `Create a concise 1-2 sentence summary of the following content that captures the main idea and key points. Focus on what someone would need to know to understand if this content is relevant to their query.`;
      
      case 'keywords':
        return `Extract 5-10 important keywords and phrases from the following content. Focus on domain-specific terms, proper nouns, and concepts that would be useful for search and retrieval. Return as a JSON array of strings.`;
      
      case 'custom':
        return customPrompt || 'Process the following content:';
      
      default:
        return 'Process the following content:';
    }
  }
}
