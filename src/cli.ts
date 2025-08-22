#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import Table from 'cli-table3';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigManager } from './config';
import { DatabaseConnection } from './database';
import { EmbeddingGenerator } from './embeddings';
import { RAGTester } from './tester';
import { TestConfiguration, ExperimentResults, EnhancedTestConfiguration } from './types';
import { EnhancedRAGTester } from './enhanced-tester';
import { ProductionRAGTester, ProductionTestConfiguration } from './production-tester';

const program = new Command();

// Read version from package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));

program
  .name('rag-test')
  .description('CLI tool for testing RAG systems with different embedding combinations')
  .version(packageJson.version);

// Production Test command (ML best practices)
program
  .command('test-production')
  .description('Run production RAG testing experiment following ML best practices with proper train/validation/test splits')
  .option('-t, --table <tableName>', 'Table name to test')
  .option('-c, --columns <columns>', 'Comma-separated list of columns for embeddings')
  .option('-q, --query <column>', 'Column containing queries')
  .option('-a, --answer <column>', 'Column containing expected answers')
  .option('-m, --metric <type>', 'Metric type (brdr|sql|similarity)', 'sql')
  .option('--train-ratio <number>', 'Training ratio (0-1)', '0.7')
  .option('--val-ratio <number>', 'Validation ratio (0-1)', '0.15')
  .option('--test-ratio <number>', 'Testing ratio (0-1)', '0.15')
  .option('-n, --name <name>', 'Test name')
  .option('-l, --limit <number>', 'Max combinations to test', '20')
  .option('-b, --batch-size <number>', 'Batch size for processing', '100')
  .option('--max-train <number>', 'Maximum training samples', '50000')
  .option('--max-val <number>', 'Maximum validation samples', '10000')
  .option('--max-test <number>', 'Maximum testing samples', '10000')
  .option('--enable-caching', 'Enable embedding caching', false)
  .option('--sampling <strategy>', 'Data sampling strategy (random|stratified|time_based|query_complexity)', 'random')
  .option('--cv-folds <number>', 'Cross-validation folds', '5')
  .option('--min-query-len <number>', 'Minimum query length', '10')
  .option('--max-query-len <number>', 'Maximum query length', '500')
  .option('--min-answer-len <number>', 'Minimum answer length', '10')
  .option('--max-answer-len <number>', 'Maximum answer length', '1000')
  .option('--timestamp-col <column>', 'Timestamp column for time-based sampling')
  .option('--time-window <window>', 'Time window for sampling (daily|weekly|monthly)', 'weekly')
  .action(async (options) => {
    try {
      const configManager = new ConfigManager();
      const config = await configManager.loadConfig();

      // Interactive mode if no options provided
      let testConfig: ProductionTestConfiguration;
      
      if (!options.table) {
        testConfig = await interactiveProductionTestSetup();
      } else {
        testConfig = {
          tableName: options.table,
          selectedColumns: options.columns?.split(',') || [],
          queryColumn: options.query || '',
          answerColumn: options.answer || '',
          embeddingConfig: config.embedding,
          metricType: options.metric || 'sql',
          trainingRatio: parseFloat(options.trainRatio || '0.7'),
          validationRatio: parseFloat(options.valRatio || '0.15'),
          testingRatio: parseFloat(options.testRatio || '0.15'),
          testName: options.name || `ProductionTest_${new Date().toISOString().replace(/[:.]/g, '-')}`,
          maxCombinations: parseInt(options.limit || '20'),
          maxTrainingSamples: parseInt(options.maxTrain || '50000'),
          maxValidationSamples: parseInt(options.maxVal || '10000'),
          maxTestingSamples: parseInt(options.maxTest || '10000'),
          batchSize: parseInt(options.batchSize || '100'),
          enableCaching: options.enableCaching || false,
          crossValidationFolds: parseInt(options.cvFolds || '5'),
          minQueryLength: parseInt(options.minQueryLen || '10'),
          maxQueryLength: parseInt(options.maxQueryLen || '500'),
          minAnswerLength: parseInt(options.minAnswerLen || '10'),
          maxAnswerLength: parseInt(options.maxAnswerLen || '1000'),
          samplingStrategy: (options.sampling as 'random' | 'stratified' | 'time_based' | 'query_complexity') || 'random',
          timestampColumn: options.timestampCol,
          timeWindow: (options.timeWindow as 'daily' | 'weekly' | 'monthly') || 'weekly'
        };
      }

      await runProductionExperiment(testConfig, config);

    } catch (error) {
      console.error(chalk.red(`❌ Production test failed: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });



// Enhanced Test command for large datasets
program
  .command('test-enhanced')
  .description('Run enhanced RAG testing experiment optimized for large datasets (1M+ rows)')
  .option('-t, --table <tableName>', 'Table name to test')
  .option('-c, --columns <columns>', 'Comma-separated list of columns for embeddings')
  .option('-q, --query <column>', 'Column containing queries')
  .option('-a, --answer <column>', 'Column containing expected answers')
  .option('-m, --metric <type>', 'Metric type (brdr|sql|similarity)', 'brdr')
  .option('-r, --ratio <number>', 'Training ratio (0-1)', '0.8')
  .option('-n, --name <name>', 'Test name')
  .option('-l, --limit <number>', 'Max combinations to test', '20')
  .option('-b, --batch-size <number>', 'Batch size for processing', '100')
  .option('--max-training <number>', 'Maximum training samples', '10000')
  .option('--max-testing <number>', 'Maximum testing samples', '2000')
  .option('--enable-caching', 'Enable embedding caching', false)
  .option('--sampling <strategy>', 'Data sampling strategy (random|stratified|sequential)', 'random')
  .action(async (options) => {
    try {
      const configManager = new ConfigManager();
      const config = await configManager.loadConfig();

      // Interactive mode if no options provided
      let testConfig: EnhancedTestConfiguration;
      
      if (!options.table) {
        testConfig = await interactiveEnhancedTestSetup();
      } else {
        testConfig = {
          tableName: options.table,
          selectedColumns: options.columns?.split(',') || [],
          queryColumn: options.query || '',
          answerColumn: options.answer || '',
          embeddingConfig: config.embedding,
          metricType: options.metric || 'brdr',
          trainingRatio: parseFloat(options.ratio || '0.8'),
          testName: options.name || `EnhancedTest_${new Date().toISOString().replace(/[:.]/g, '-')}`,
          maxCombinations: parseInt(options.limit || '20'),
          batchSize: parseInt(options.batchSize || '100'),
          maxTrainingSamples: parseInt(options.maxTraining || '10000'),
          maxTestingSamples: parseInt(options.maxTesting || '2000'),
          enableCaching: options.enableCaching || false,
          dataSamplingStrategy: (options.sampling as 'random' | 'stratified' | 'sequential') || 'random'
        };
      }

      await runEnhancedExperiment(testConfig, config);

    } catch (error) {
      console.error(chalk.red(`❌ Enhanced test failed: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

// Configure command
program
  .command('configure')
  .description('Set up configuration for database and embedding model')
  .action(async () => {
    try {
      const configManager = new ConfigManager();
      
      // Check if .env file already has the required variables
      const config = await configManager.loadConfig();
      if (config.database.url && config.database.anonKey) {
        console.log(chalk.yellow('⚠️  Configuration already found in .env file:'));
        console.log(chalk.gray(`  NEXT_PUBLIC_SUPABASE_URL: ${config.database.url.substring(0, 30)}...`));
        console.log(chalk.gray(`  NEXT_PUBLIC_SUPABASE_ANON_KEY: ${config.database.anonKey.substring(0, 20)}...`));
        
        const inquirer = await import('inquirer');
        const { proceed } = await inquirer.default.prompt({
          type: 'confirm',
          name: 'proceed',
          message: 'Do you want to override the existing configuration?',
          default: false
        });
        
        if (!proceed) {
          console.log(chalk.green('✅ Using existing configuration from .env file'));
          return;
        }
      }
      
      await configManager.initializeConfig();
      console.log(chalk.green('\n✅ Configuration completed successfully!'));
    } catch (error) {
      console.error(chalk.red(`❌ Configuration failed: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

// List available metrics
program
  .command('metrics')
  .description('List available evaluation metrics')
  .action(async () => {
    try {
      // Import metrics using require to ensure registration happens
      require('./metrics/index'); // This registers the metrics
      const { MetricFactory } = require('./metrics/base-metric');
      const availableMetrics = MetricFactory.getAvailableMetrics();
      
      console.log(chalk.bold('📊 Available Evaluation Metrics:\n'));
      
      availableMetrics.forEach((metricName: string) => {
        try {
          const metricInfo = MetricFactory.getMetricInfo(metricName);
          console.log(chalk.cyan(`• ${metricInfo.name}`));
          console.log(chalk.gray(`  ${metricInfo.description}`));
          console.log('');
        } catch (metricError) {
          console.error(chalk.red(`Error getting info for ${metricName}: ${metricError}`));
        }
      });
      
      console.log(chalk.yellow('💡 Use --metric option with test commands to specify which metric to use'));
      
    } catch (error) {
      console.error(chalk.red(`❌ Failed to load metrics: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

// List tables command
program
  .command('tables')
  .description('List available tables in the database')
  .action(async () => {
    const spinner = ora('Connecting to database...').start();
    
    try {
      const configManager = new ConfigManager();
      const config = await configManager.loadConfig();
      
      const validation = configManager.validateConfig(config);
      if (!validation.isValid) {
        spinner.fail('Invalid configuration');
        console.error(chalk.red('Configuration errors:'));
        validation.errors.forEach(error => console.error(chalk.red(`  • ${error}`)));
        console.log(chalk.yellow('\nRun "rag-test configure" to set up configuration.'));
        process.exit(1);
      }

      const db = new DatabaseConnection(config.database);
      const isConnected = await db.testConnection();
      
      if (!isConnected) {
        spinner.fail('Failed to connect to database');
        console.error('database config is: ', config.database);
        console.error(chalk.red('Please check your database configuration.'));
        process.exit(1);
      }

      spinner.text = 'Fetching tables...';
      const tables = await db.getTables();
      spinner.succeed('Tables retrieved');

      if (tables.length === 0) {
        console.log(chalk.yellow('No tables found in the database.'));
        return;
      }

      console.log(chalk.bold('\n📊 Available Tables:'));
      const table = new Table({
        head: [chalk.cyan('Table Name')],
        style: { head: [], border: [] }
      });

      tables.forEach(tableName => {
        table.push([tableName]);
      });

      console.log(table.toString());
    } catch (error) {
      spinner.fail('Operation failed');
      console.error(chalk.red(`❌ Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

// Inspect table command
program
  .command('inspect <tableName>')
  .description('Inspect a table structure and sample data')
  .action(async (tableName: string) => {
    const spinner = ora('Loading table information...').start();
    
    try {
      const configManager = new ConfigManager();
      const config = await configManager.loadConfig();
      
      const db = new DatabaseConnection(config.database);
      await db.testConnection();

      const tableInfo = await db.getTableInfo(tableName);
      if (!tableInfo) {
        spinner.fail(`Table "${tableName}" not found`);
        process.exit(1);
      }

      spinner.text = 'Fetching sample data...';
      const sampleData = await db.getTableData(tableName, ['*'], 3);
      spinner.succeed('Table inspection complete');

      console.log(chalk.bold(`\n📋 Table: ${tableName}`));
      console.log(chalk.gray(`Rows: ${tableInfo.rowCount}`));

      // Show columns
      console.log(chalk.bold('\n🏛️  Columns:'));
      const columnsTable = new Table({
        head: [chalk.cyan('Column'), chalk.cyan('Type'), chalk.cyan('Nullable')],
        style: { head: [], border: [] }
      });

      tableInfo.columns.forEach(col => {
        columnsTable.push([
          col.column_name,
          col.data_type,
          col.is_nullable ? 'Yes' : 'No'
        ]);
      });

      console.log(columnsTable.toString());

      // Show sample data
      if (sampleData.length > 0) {
        console.log(chalk.bold('\n🔍 Sample Data:'));
        console.log(JSON.stringify(sampleData, null, 2));
      }

    } catch (error) {
      spinner.fail('Operation failed');
      console.error(chalk.red(`❌ Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

// Test command
program
  .command('test')
  .description('Run RAG testing experiment')
  .option('-t, --table <tableName>', 'Table name to test')
  .option('-c, --columns <columns>', 'Comma-separated list of columns for embeddings')
  .option('-q, --query <column>', 'Column containing queries')
  .option('-a, --answer <column>', 'Column containing expected answers')
  .option('-m, --metric <type>', 'Metric type (brdr|sql|similarity)', 'brdr')
  .option('-r, --ratio <number>', 'Training ratio (0-1)', '0.8')
  .option('-n, --name <name>', 'Test name')
  .option('-l, --limit <number>', 'Max combinations to test', '20')
  .action(async (options) => {
    try {
      const configManager = new ConfigManager();
      const config = await configManager.loadConfig();

      // Interactive mode if no options provided
      let testConfig: TestConfiguration;
      
      if (!options.table) {
        testConfig = await interactiveTestSetup();
      } else {
        testConfig = {
          tableName: options.table,
          selectedColumns: options.columns?.split(',') || [],
          queryColumn: options.query || '',
          answerColumn: options.answer || '',
          embeddingConfig: config.embedding,
          metricType: options.metric as 'similarity' | 'brdr',
          trainingRatio: parseFloat(options.ratio),
          testName: options.name || `Test_${new Date().toISOString().replace(/[:.]/g, '-')}`,
          maxCombinations: parseInt(options.limit)
        };
      }

      await runExperiment(testConfig, config);

    } catch (error) {
      console.error(chalk.red(`❌ Test failed: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

async function interactiveTestSetup(): Promise<TestConfiguration> {
  console.log(chalk.bold('🧪 Interactive RAG Test Setup\n'));

  const configManager = new ConfigManager();
  const config = await configManager.loadConfig();
  const db = new DatabaseConnection(config.database);
  
  await db.testConnection();
  const tables = await db.getTables();

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'tableName',
      message: 'Select table to test:',
      choices: tables
    }
  ]);

  // Get table info for column selection
  const tableInfo = await db.getTableInfo(answers.tableName);
  if (!tableInfo) {
    throw new Error(`Table ${answers.tableName} not found`);
  }

  const columnChoices = tableInfo.columns.map(col => ({
    name: `${col.column_name} (${col.data_type})`,
    value: col.column_name
  }));

  const columnSelection = await inquirer.prompt({
    type: 'checkbox',
    name: 'selectedColumns',
    message: 'Select columns for embeddings (max 5):',
    choices: columnChoices,
    validate: (input: any) => {
      if (input.length === 0) return 'At least one column must be selected';
      if (input.length > 5) return 'Maximum 5 columns allowed';
      return true;
    }
  });

  const querySelection = await inquirer.prompt({
    type: 'list',
    name: 'queryColumn',
    message: 'Select query column:',
    choices: columnChoices
  });

  const answerSelection = await inquirer.prompt({
    type: 'list',
    name: 'answerColumn',
    message: 'Select answer column:',
    choices: columnChoices
  });

  const metricSelection = await inquirer.prompt({
    type: 'list',
    name: 'metricType',
    message: 'Select evaluation metric:',
    choices: [
      { name: 'Similarity (general purpose)', value: 'similarity' },
      { name: 'BRDR (banking regulation specific)', value: 'brdr' }
    ]
  });

  const ratioInput = await inquirer.prompt({
    type: 'input',
    name: 'trainingRatio',
    message: 'Training ratio (0-1):',
    default: '0.8',
    validate: (input: any) => {
      const num = parseFloat(input);
      return (num > 0 && num < 1) || 'Must be between 0 and 1';
    }
  });

  const nameInput = await inquirer.prompt({
    type: 'input',
    name: 'testName',
    message: 'Test name:',
    default: `Test_${new Date().toISOString().replace(/[:.]/g, '-')}`
  });

  const limitInput = await inquirer.prompt({
    type: 'input',
    name: 'maxCombinations',
    message: 'Maximum combinations to test:',
    default: '20',
    validate: (input: any) => {
      const num = parseInt(input);
      return (num > 0 && num <= 100) || 'Must be between 1 and 100';
    }
  });

  const moreAnswers = {
    ...columnSelection,
    ...querySelection,
    ...answerSelection,
    ...metricSelection,
    ...ratioInput,
    ...nameInput,
    ...limitInput
  };

  return {
    tableName: answers.tableName,
    selectedColumns: (columnSelection as any).selectedColumns,
    queryColumn: (querySelection as any).queryColumn,
    answerColumn: (answerSelection as any).answerColumn,
    embeddingConfig: config.embedding,
    metricType: (metricSelection as any).metricType,
    trainingRatio: parseFloat((ratioInput as any).trainingRatio),
    testName: (nameInput as any).testName,
    maxCombinations: parseInt((limitInput as any).maxCombinations)
  };
}

async function interactiveEnhancedTestSetup(): Promise<EnhancedTestConfiguration> {
  console.log(chalk.bold('🚀 Interactive Enhanced RAG Test Setup (Large Datasets)\n'));

  const configManager = new ConfigManager();
  const config = await configManager.loadConfig();
  const db = new DatabaseConnection(config.database);
  
  await db.testConnection();
  const tables = await db.getTables();

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'tableName',
      message: 'Select table to test:',
      choices: tables
    }
  ]);

  // Get table info for column selection
  const tableInfo = await db.getTableInfo(answers.tableName);
  if (!tableInfo) {
    throw new Error(`Table ${answers.tableName} not found`);
  }

  const columnChoices = tableInfo.columns.map(col => ({
    name: `${col.column_name} (${col.data_type})`,
    value: col.column_name
  }));

  const columnSelection = await inquirer.prompt({
    type: 'checkbox',
    name: 'selectedColumns',
    message: 'Select columns for embeddings (max 5):',
    choices: columnChoices,
    validate: (input: any) => {
      if (input.length === 0) return 'At least one column must be selected';
      if (input.length > 5) return 'Maximum 5 columns allowed';
      return true;
    }
  });

  const querySelection = await inquirer.prompt({
    type: 'list',
    name: 'queryColumn',
    message: 'Select query column:',
    choices: columnChoices
  });

  const answerSelection = await inquirer.prompt({
    type: 'list',
    name: 'answerColumn',
    message: 'Select answer column:',
    choices: columnChoices
  });

  const metricSelection = await inquirer.prompt({
    type: 'list',
    name: 'metricType',
    message: 'Select evaluation metric:',
    choices: [
      { name: 'BRDR (Banking Regulation)', value: 'brdr' },
      { name: 'SQL (Text-to-SQL)', value: 'sql' },
      { name: 'Similarity (General Purpose)', value: 'similarity' }
    ]
  });

  const ratioInput = await inquirer.prompt({
    type: 'input',
    name: 'trainingRatio',
    message: 'Training ratio (0-1):',
    default: '0.8',
    validate: (input: any) => {
      const num = parseFloat(input);
      return (num > 0 && num < 1) || 'Must be between 0 and 1';
    }
  });

  const nameInput = await inquirer.prompt({
    type: 'input',
    name: 'testName',
    message: 'Test name:',
    default: `EnhancedTest_${new Date().toISOString().replace(/[:.]/g, '-')}`
  });

  const limitInput = await inquirer.prompt({
    type: 'input',
    name: 'maxCombinations',
    message: 'Maximum combinations to test:',
    default: '20',
    validate: (input: any) => {
      const num = parseInt(input);
      return (num > 0 && num <= 100) || 'Must be between 1 and 100';
    }
  });

  const batchSizeInput = await inquirer.prompt({
    type: 'input',
    name: 'batchSize',
    message: 'Batch size for processing:',
    default: '100',
    validate: (input: any) => {
      const num = parseInt(input);
      return (num > 0 && num <= 1000) || 'Must be between 1 and 1000';
    }
  });

  const maxTrainingInput = await inquirer.prompt({
    type: 'input',
    name: 'maxTrainingSamples',
    message: 'Maximum training samples:',
    default: '10000',
    validate: (input: any) => {
      const num = parseInt(input);
      return (num >= 100 && num <= 100000) || 'Must be between 100 and 100000';
    }
  });

  const maxTestingInput = await inquirer.prompt({
    type: 'input',
    name: 'maxTestingSamples',
    message: 'Maximum testing samples:',
    default: '2000',
    validate: (input: any) => {
      const num = parseInt(input);
      return (num >= 50 && num <= 20000) || 'Must be between 50 and 20000';
    }
  });

  const cachingInput = await inquirer.prompt({
    type: 'confirm',
    name: 'enableCaching',
    message: 'Enable embedding caching?',
    default: true
  });

  const samplingInput = await inquirer.prompt({
    type: 'list',
    name: 'dataSamplingStrategy',
    message: 'Data sampling strategy:',
    choices: [
      { name: 'Random (recommended)', value: 'random' },
      { name: 'Stratified (maintains distribution)', value: 'stratified' },
      { name: 'Sequential (first N rows)', value: 'sequential' }
    ]
  });

  const moreAnswers = {
    ...columnSelection,
    ...querySelection,
    ...answerSelection,
    ...metricSelection,
    ...ratioInput,
    ...nameInput,
    ...limitInput,
    ...batchSizeInput,
    ...maxTrainingInput,
    ...maxTestingInput,
    ...cachingInput,
    ...samplingInput
  };

  return {
    tableName: answers.tableName,
    selectedColumns: (columnSelection as any).selectedColumns,
    queryColumn: (querySelection as any).queryColumn,
    answerColumn: (answerSelection as any).answerColumn,
    embeddingConfig: config.embedding,
    metricType: (metricSelection as any).metricType,
    trainingRatio: parseFloat((ratioInput as any).trainingRatio),
    testName: (nameInput as any).testName,
    maxCombinations: parseInt((limitInput as any).maxCombinations),
    batchSize: parseInt((batchSizeInput as any).batchSize),
    maxTrainingSamples: parseInt((maxTrainingInput as any).maxTrainingSamples),
    maxTestingSamples: parseInt((maxTestingInput as any).maxTestingSamples),
    enableCaching: (cachingInput as any).enableCaching,
    dataSamplingStrategy: (samplingInput as any).dataSamplingStrategy
  };
}

async function interactiveProductionTestSetup(): Promise<ProductionTestConfiguration> {
  console.log(chalk.bold('🚀 Interactive Production RAG Test Setup (ML Best Practices)\n'));

  const configManager = new ConfigManager();
  const config = await configManager.loadConfig();
  const db = new DatabaseConnection(config.database);
  
  await db.testConnection();
  const tables = await db.getTables();

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'tableName',
      message: 'Select table to test:',
      choices: tables
    }
  ]);

  // Get table info for column selection
  const tableInfo = await db.getTableInfo(answers.tableName);
  if (!tableInfo) {
    throw new Error(`Table ${answers.tableName} not found`);
  }

  const columnChoices = tableInfo.columns.map(col => ({
    name: `${col.column_name} (${col.data_type})`,
    value: col.column_name
  }));

  const columnSelection = await inquirer.prompt({
    type: 'checkbox',
    name: 'selectedColumns',
    message: 'Select columns for embeddings (max 5):',
    choices: columnChoices,
    validate: (input: any) => {
      if (input.length === 0) return 'At least one column must be selected';
      if (input.length > 5) return 'Maximum 5 columns allowed';
      return true;
    }
  });

  const querySelection = await inquirer.prompt({
    type: 'list',
    name: 'queryColumn',
    message: 'Select query column:',
    choices: columnChoices
  });

  const answerSelection = await inquirer.prompt({
    type: 'list',
    name: 'answerColumn',
    message: 'Select answer column:',
    choices: columnChoices
  });

  const metricSelection = await inquirer.prompt({
    type: 'list',
    name: 'metricType',
    message: 'Select evaluation metric:',
    choices: [
      { name: 'SQL (Text-to-SQL)', value: 'sql' },
      { name: 'BRDR (Banking Regulation)', value: 'brdr' },
      { name: 'Similarity (General Purpose)', value: 'similarity' }
    ]
  });

  const trainRatioInput = await inquirer.prompt({
    type: 'input',
    name: 'trainingRatio',
    message: 'Training ratio (0-1):',
    default: '0.7',
    validate: (input: any) => {
      const num = parseFloat(input);
      return (num > 0 && num < 1) || 'Must be between 0 and 1';
    }
  });

  const valRatioInput = await inquirer.prompt({
    type: 'input',
    name: 'validationRatio',
    message: 'Validation ratio (0-1):',
    default: '0.15',
    validate: (input: any) => {
      const num = parseFloat(input);
      return (num > 0 && num < 1) || 'Must be between 0 and 1';
    }
  });

  const testRatioInput = await inquirer.prompt({
    type: 'input',
    name: 'testingRatio',
    message: 'Testing ratio (0-1):',
    default: '0.15',
    validate: (input: any) => {
      const num = parseFloat(input.trainRatio || '0.7') + parseFloat(input.valRatio || '0.15') + parseFloat(input.testRatio || '0.15');
      return Math.abs(num - 1) < 0.01 || 'Ratios must sum to 1';
    }
  });

  const nameInput = await inquirer.prompt({
    type: 'input',
    name: 'testName',
    message: 'Test name:',
    default: `ProductionTest_${new Date().toISOString().replace(/[:.]/g, '-')}`
  });

  const limitInput = await inquirer.prompt({
    type: 'input',
    name: 'maxCombinations',
    message: 'Maximum combinations to test:',
    default: '20',
    validate: (input: any) => {
      const num = parseInt(input);
      return (num > 0 && num <= 100) || 'Must be between 1 and 100';
    }
  });

  const batchSizeInput = await inquirer.prompt({
    type: 'input',
    name: 'batchSize',
    message: 'Batch size for processing:',
    default: '100',
    validate: (input: any) => {
      const num = parseInt(input);
      return (num > 0 && num <= 1000) || 'Must be between 1 and 1000';
    }
  });

  const maxTrainInput = await inquirer.prompt({
    type: 'input',
    name: 'maxTrainingSamples',
    message: 'Maximum training samples:',
    default: '50000',
    validate: (input: any) => {
      const num = parseInt(input);
      return (num >= 100 && num <= 200000) || 'Must be between 100 and 200000';
    }
  });

  const maxValInput = await inquirer.prompt({
    type: 'input',
    name: 'maxValidationSamples',
    message: 'Maximum validation samples:',
    default: '10000',
    validate: (input: any) => {
      const num = parseInt(input);
      return (num >= 50 && num <= 50000) || 'Must be between 50 and 50000';
    }
  });

  const maxTestInput = await inquirer.prompt({
    type: 'input',
    name: 'maxTestingSamples',
    message: 'Maximum testing samples:',
    default: '10000',
    validate: (input: any) => {
      const num = parseInt(input);
      return (num >= 50 && num <= 50000) || 'Must be between 50 and 50000';
    }
  });

  const cachingInput = await inquirer.prompt({
    type: 'confirm',
    name: 'enableCaching',
    message: 'Enable embedding caching?',
    default: true
  });

  const cvFoldsInput = await inquirer.prompt({
    type: 'input',
    name: 'crossValidationFolds',
    message: 'Cross-validation folds:',
    default: '5',
    validate: (input: any) => {
      const num = parseInt(input);
      return (num >= 2 && num <= 10) || 'Must be between 2 and 10';
    }
  });

  const minQueryLenInput = await inquirer.prompt({
    type: 'input',
    name: 'minQueryLength',
    message: 'Minimum query length:',
    default: '10',
    validate: (input: any) => {
      const num = parseInt(input);
      return (num >= 1 && num <= 100) || 'Must be between 1 and 100';
    }
  });

  const maxQueryLenInput = await inquirer.prompt({
    type: 'input',
    name: 'maxQueryLength',
    message: 'Maximum query length:',
    default: '500',
    validate: (input: any) => {
      const num = parseInt(input);
      return (num >= 50 && num <= 2000) || 'Must be between 50 and 2000';
    }
  });

  const minAnswerLenInput = await inquirer.prompt({
    type: 'input',
    name: 'minAnswerLength',
    message: 'Minimum answer length:',
    default: '10',
    validate: (input: any) => {
      const num = parseInt(input);
      return (num >= 1 && num <= 100) || 'Must be between 1 and 100';
    }
  });

  const maxAnswerLenInput = await inquirer.prompt({
    type: 'input',
    name: 'maxAnswerLength',
    message: 'Maximum answer length:',
    default: '1000',
    validate: (input: any) => {
      const num = parseInt(input);
      return (num >= 50 && num <= 5000) || 'Must be between 50 and 5000';
    }
  });

  const samplingInput = await inquirer.prompt({
    type: 'list',
    name: 'samplingStrategy',
    message: 'Data sampling strategy:',
    choices: [
      { name: 'Random (recommended)', value: 'random' },
      { name: 'Stratified (maintains distribution)', value: 'stratified' },
      { name: 'Time-based (if you have timestamps)', value: 'time_based' },
      { name: 'Query complexity-based', value: 'query_complexity' }
    ]
  });

  let timestampColumn: string | undefined;
  let timeWindow: 'daily' | 'weekly' | 'monthly' | undefined;

  if (samplingInput.samplingStrategy === 'time_based') {
    const timestampInput = await inquirer.prompt({
      type: 'list',
      name: 'timestampColumn',
      message: 'Select timestamp column:',
      choices: columnChoices.filter(col => {
        const colName = col.value;
        const colInfo = tableInfo.columns.find(c => c.column_name === colName);
        return colInfo?.data_type?.includes('timestamp') || colInfo?.data_type?.includes('date');
      })
    });
    timestampColumn = timestampInput.timestampColumn;

    const timeWindowInput = await inquirer.prompt({
      type: 'list',
      name: 'timeWindow',
      message: 'Select time window:',
      choices: [
        { name: 'Daily', value: 'daily' },
        { name: 'Weekly', value: 'weekly' },
        { name: 'Monthly', value: 'monthly' }
      ]
    });
    timeWindow = timeWindowInput.timeWindow;
  }

  return {
    tableName: answers.tableName,
    selectedColumns: (columnSelection as any).selectedColumns,
    queryColumn: (querySelection as any).queryColumn,
    answerColumn: (answerSelection as any).answerColumn,
    embeddingConfig: config.embedding,
    metricType: (metricSelection as any).metricType,
    trainingRatio: parseFloat((trainRatioInput as any).trainingRatio),
    validationRatio: parseFloat((valRatioInput as any).validationRatio),
    testingRatio: parseFloat((testRatioInput as any).testingRatio),
    testName: (nameInput as any).testName,
    maxCombinations: parseInt((limitInput as any).maxCombinations),
    maxTrainingSamples: parseInt((maxTrainInput as any).maxTrainingSamples),
    maxValidationSamples: parseInt((maxValInput as any).maxValidationSamples),
    maxTestingSamples: parseInt((maxTestInput as any).maxTestingSamples),
    batchSize: parseInt((batchSizeInput as any).batchSize),
    enableCaching: (cachingInput as any).enableCaching,
    crossValidationFolds: parseInt((cvFoldsInput as any).crossValidationFolds),
    minQueryLength: parseInt((minQueryLenInput as any).minQueryLength),
    maxQueryLength: parseInt((maxQueryLenInput as any).maxQueryLength),
    minAnswerLength: parseInt((minAnswerLenInput as any).minAnswerLength),
    maxAnswerLength: parseInt((maxAnswerLenInput as any).maxAnswerLength),
    samplingStrategy: (samplingInput as any).samplingStrategy,
    timestampColumn,
    timeWindow
  };
}





async function runProductionExperiment(testConfig: ProductionTestConfiguration, config: any) {
  const spinner = ora('Initializing Production RAG Tester...').start();

  try {
    const db = new DatabaseConnection(config.database);
    const embeddings = new EmbeddingGenerator(config.embedding);
    const tester = new ProductionRAGTester(db, embeddings);

    // Validate configuration
    spinner.text = 'Validating production configuration...';
    const validation = await tester.validateProductionConfiguration(testConfig);
    
    if (!validation.isValid) {
      spinner.fail('Production configuration validation failed');
      console.error(chalk.red('\nErrors:'));
      validation.errors.forEach(error => console.error(chalk.red(`  • ${error}`)));
      if (validation.warnings.length > 0) {
        console.warn(chalk.yellow('\nWarnings:'));
        validation.warnings.forEach(warning => console.warn(chalk.yellow(`  • ${warning}`)));
      }
      process.exit(1);
    }

    if (validation.warnings.length > 0) {
      spinner.warn('Production configuration has warnings');
      console.warn(chalk.yellow('Warnings:'));
      validation.warnings.forEach(warning => console.warn(chalk.yellow(`  • ${warning}`)));
      
      const { proceed } = await inquirer.prompt([{
        type: 'confirm',
        name: 'proceed',
        message: 'Continue anyway?',
        default: true
      }]);
      
      if (!proceed) {
        console.log(chalk.gray('Production test cancelled.'));
        process.exit(0);
      }
    }

    // Initialize embeddings
    spinner.text = 'Initializing embedding model...';
    await tester.initialize();
    spinner.succeed('Production RAG Tester initialized');

    // Run production experiment
    console.log(chalk.bold('\n🚀 Starting production experiment...\n'));
    const results = await tester.runProductionExperiment(testConfig);

    // Display production results
    displayProductionResults(results);

    // Save results
    const outputDir = config.outputPath || './rag-test-results';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filename = `${testConfig.testName.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
    const filepath = path.join(outputDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(results, null, 2));
    console.log(chalk.green(`\n💾 Production results saved to: ${filepath}`));

  } catch (error) {
    spinner.fail('Production experiment failed');
    throw error;
  }
}

async function runEnhancedExperiment(testConfig: EnhancedTestConfiguration, config: any) {
  const spinner = ora('Initializing Enhanced RAG Tester...').start();

  try {
    const db = new DatabaseConnection(config.database);
    const embeddings = new EmbeddingGenerator(config.embedding);
    const tester = new EnhancedRAGTester(db, embeddings);

    // Validate configuration
    spinner.text = 'Validating enhanced configuration...';
    const validation = await tester.validateEnhancedConfiguration(testConfig);
    
    if (!validation.isValid) {
      spinner.fail('Enhanced configuration validation failed');
      console.error(chalk.red('\nErrors:'));
      validation.errors.forEach(error => console.error(chalk.red(`  • ${error}`)));
      if (validation.warnings.length > 0) {
        console.warn(chalk.yellow('\nWarnings:'));
        validation.warnings.forEach(warning => console.warn(chalk.yellow(`  • ${warning}`)));
      }
      process.exit(1);
    }

    if (validation.warnings.length > 0) {
      spinner.warn('Enhanced configuration has warnings');
      console.warn(chalk.yellow('Warnings:'));
      validation.warnings.forEach(warning => console.warn(chalk.yellow(`  • ${warning}`)));
      
      const { proceed } = await inquirer.prompt([{
        type: 'confirm',
        name: 'proceed',
        message: 'Continue anyway?',
        default: true
      }]);
      
      if (!proceed) {
        console.log(chalk.gray('Enhanced test cancelled.'));
        process.exit(0);
      }
    }

    // Initialize embeddings
    spinner.text = 'Initializing embedding model...';
    await tester.initialize();
    spinner.succeed('Enhanced RAG Tester initialized');

    // Run enhanced experiment
    console.log(chalk.bold('\n🚀 Starting enhanced experiment...\n'));
    const results = await tester.runEnhancedExperiment(testConfig);

    // Display enhanced results
    displayEnhancedResults(results);

    // Save results
    const outputDir = config.outputPath || './rag-test-results';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filename = `${testConfig.testName.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
    const filepath = path.join(outputDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(results, null, 2));
    console.log(chalk.green(`\n💾 Enhanced results saved to: ${filepath}`));

  } catch (error) {
    spinner.fail('Enhanced experiment failed');
    throw error;
  }
}

async function runExperiment(testConfig: TestConfiguration, config: any) {
  const spinner = ora('Initializing RAG Tester...').start();

  try {
    const db = new DatabaseConnection(config.database);
    const embeddings = new EmbeddingGenerator(config.embedding);
    const tester = new RAGTester(db, embeddings);

    // Validate configuration
    spinner.text = 'Validating configuration...';
    const validation = await tester.validateConfiguration(testConfig);
    
    if (!validation.isValid) {
      spinner.fail('Configuration validation failed');
      console.error(chalk.red('\nErrors:'));
      validation.errors.forEach(error => console.error(chalk.red(`  • ${error}`)));
      if (validation.warnings.length > 0) {
        console.warn(chalk.yellow('\nWarnings:'));
        validation.warnings.forEach(warning => console.warn(chalk.yellow(`  • ${warning}`)));
      }
      process.exit(1);
    }

    if (validation.warnings.length > 0) {
      spinner.warn('Configuration has warnings');
      console.warn(chalk.yellow('Warnings:'));
      validation.warnings.forEach(warning => console.warn(chalk.yellow(`  • ${warning}`)));
      
      const { proceed } = await inquirer.prompt([{
        type: 'confirm',
        name: 'proceed',
        message: 'Continue anyway?',
        default: true
      }]);
      
      if (!proceed) {
        console.log(chalk.gray('Test cancelled.'));
        process.exit(0);
      }
    }

    // Initialize embeddings
    spinner.text = 'Initializing embedding model...';
    await tester.initialize();
    spinner.succeed('RAG Tester initialized');

    // Run experiment
    console.log(chalk.bold('\n🚀 Starting experiment...\n'));
    const results = await tester.runExperiment(testConfig);

    // Display results
    displayResults(results);

    // Save results
    const outputDir = config.outputPath || './rag-test-results';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filename = `${testConfig.testName.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
    const filepath = path.join(outputDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(results, null, 2));
    console.log(chalk.green(`\n💾 Results saved to: ${filepath}`));

  } catch (error) {
    spinner.fail('Experiment failed');
    throw error;
  }
}

function displayResults(results: ExperimentResults) {
  console.log(chalk.bold('\n🎉 Experiment Complete!\n'));

  // Summary table
  const summaryTable = new Table({
    head: [chalk.cyan('Metric'), chalk.cyan('Value')],
    style: { head: [], border: [] }
  });

  summaryTable.push(
    ['Test Name', results.testName],
    ['Total Combinations', results.summary.totalCombinations.toString()],
    ['Best Score', results.summary.bestScore.toFixed(4)],
    ['Worst Score', results.summary.worstScore.toFixed(4)],
    ['Average Score', results.summary.averageScore.toFixed(4)],
    ['Processing Time', `${(results.processingTime / 1000).toFixed(1)}s`]
  );

  console.log(summaryTable.toString());

  // Best combination
  console.log(chalk.bold('\n🏆 Best Combination:'));
  console.log(chalk.green(`  ${results.summary.bestCombination.name}`));
  console.log(chalk.green(`  Score: ${results.summary.bestScore.toFixed(4)}`));

  // Top 5 results
  console.log(chalk.bold('\n📊 Top 5 Results:'));
  const topResults = results.allResults
    .sort((a, b) => b.averageScore - a.averageScore)
    .slice(0, 5);

  const resultsTable = new Table({
    head: [chalk.cyan('Rank'), chalk.cyan('Combination'), chalk.cyan('Score'), chalk.cyan('Tests')],
    style: { head: [], border: [] }
  });

  topResults.forEach((result, index) => {
    resultsTable.push([
      (index + 1).toString(),
      result.combination.name,
      result.averageScore.toFixed(4),
      result.totalTests.toString()
    ]);
  });

  console.log(resultsTable.toString());
}

function displayEnhancedResults(results: ExperimentResults) {
  console.log(chalk.bold('\n🚀 Enhanced Experiment Complete!\n'));

  // Enhanced summary table
  const summaryTable = new Table({
    head: [chalk.cyan('Metric'), chalk.cyan('Value')],
    style: { head: [], border: [] }
  });

  summaryTable.push(
    ['Test Name', results.testName],
    ['Total Combinations', results.summary.totalCombinations.toString()],
    ['Best Score', results.summary.bestScore.toFixed(4)],
    ['Worst Score', results.summary.worstScore.toFixed(4)],
    ['Average Score', results.summary.averageScore.toFixed(4)],
    ['Processing Time', `${(results.processingTime / 1000).toFixed(1)}s`]
  );

  // Add enhanced metrics if available
  if ('medianScore' in results.summary) {
    summaryTable.push(
      ['Median Score', (results.summary as any).medianScore.toFixed(4)],
      ['Q1 Score', (results.summary as any).q1Score.toFixed(4)],
      ['Q3 Score', (results.summary as any).q3Score.toFixed(4)],
      ['Total Tests', (results.summary as any).totalTests.toString()],
      ['Average Confidence', (results.summary as any).averageConfidence.toFixed(4)]
    );
  }

  console.log(summaryTable.toString());

  // Best combination
  console.log(chalk.bold('\n🏆 Best Combination:'));
  console.log(chalk.green(`  ${results.summary.bestCombination.name}`));
  console.log(chalk.green(`  Score: ${results.summary.bestScore.toFixed(4)}`));

  // Top 5 results with enhanced details
  console.log(chalk.bold('\n📊 Top 5 Results:'));
  const topResults = results.allResults
    .sort((a, b) => b.averageScore - a.averageScore)
    .slice(0, 5);

  const resultsTable = new Table({
    head: [chalk.cyan('Rank'), chalk.cyan('Combination'), chalk.cyan('Score'), chalk.cyan('Tests'), chalk.cyan('Confidence')],
    style: { head: [], border: [] }
  });

  topResults.forEach((result, index) => {
    const confidence = 'detailedMetrics' in result && 'confidence' in (result as any).detailedMetrics 
      ? (result as any).detailedMetrics.confidence.toFixed(3)
      : 'N/A';
    
    resultsTable.push([
      (index + 1).toString(),
      result.combination.name,
      result.averageScore.toFixed(4),
      result.totalTests.toString(),
      confidence
    ]);
  });

  console.log(resultsTable.toString());

  // Performance metrics
  if ('processingStats' in results.allResults[0]) {
    console.log(chalk.bold('\n⚡ Performance Metrics:'));
    const perfTable = new Table({
      head: [chalk.cyan('Combination'), chalk.cyan('Training Time'), chalk.cyan('Testing Time'), chalk.cyan('Memory (MB)')],
      style: { head: [], border: [] }
    });

    topResults.forEach((result) => {
      if ('processingStats' in result) {
        const stats = (result as any).processingStats;
        perfTable.push([
          result.combination.name,
          `${(stats.trainingTime / 1000).toFixed(1)}s`,
          `${(stats.testingTime / 1000).toFixed(1)}s`,
          stats.memoryUsage.toFixed(2)
        ]);
      }
    });

    console.log(perfTable.toString());
  }
}

function displayProductionResults(results: ExperimentResults) {
  console.log(chalk.bold('\n🚀 Production Experiment Complete!\n'));

  // Production summary table
  const summaryTable = new Table({
    head: [chalk.cyan('Metric'), chalk.cyan('Value')],
    style: { head: [], border: [] }
  });

  summaryTable.push(
    ['Test Name', results.testName],
    ['Total Combinations', results.summary.totalCombinations.toString()],
    ['Best Score', results.summary.bestScore.toFixed(4)],
    ['Worst Score', results.summary.worstScore.toFixed(4)],
    ['Average Score', results.summary.averageScore.toFixed(4)],
    ['Processing Time', `${(results.processingTime / 1000).toFixed(1)}s`]
  );

  // Add production-specific metrics if available
  if ('crossValidationMean' in results.summary) {
    summaryTable.push(
      ['Cross-Validation Mean', (results.summary as any).crossValidationMean.toFixed(4)],
      ['Cross-Validation Std', (results.summary as any).crossValidationStd.toFixed(4)],
      ['Best CV Score', (results.summary as any).bestCVScore.toFixed(4)],
      ['Worst CV Score', (results.summary as any).worstCVScore.toFixed(4)]
    );
  }

  console.log(summaryTable.toString());

  // Best combination
  console.log(chalk.bold('\n🏆 Best Combination:'));
  console.log(chalk.green(`  ${results.summary.bestCombination.name}`));
  console.log(chalk.green(`  Score: ${results.summary.bestScore.toFixed(4)}`));

  // Top 5 results with production details
  console.log(chalk.bold('\n📊 Top 5 Results:'));
  const topResults = results.allResults
    .sort((a, b) => b.averageScore - a.averageScore)
    .slice(0, 5);

  const resultsTable = new Table({
    head: [chalk.cyan('Rank'), chalk.cyan('Combination'), chalk.cyan('Score'), chalk.cyan('CV Mean'), chalk.cyan('CV Std'), chalk.cyan('Tests')],
    style: { head: [], border: [] }
  });

  topResults.forEach((result, index) => {
    const cvMean = 'crossValidationMean' in result ? (result as any).crossValidationMean.toFixed(3) : 'N/A';
    const cvStd = 'crossValidationStd' in result ? (result as any).crossValidationStd.toFixed(3) : 'N/A';
    
    resultsTable.push([
      (index + 1).toString(),
      result.combination.name,
      result.averageScore.toFixed(4),
      cvMean,
      cvStd,
      result.totalTests.toString()
    ]);
  });

  console.log(resultsTable.toString());

  // Cross-validation results
  if ('crossValidationScores' in results.allResults[0]) {
    console.log(chalk.bold('\n🔄 Cross-Validation Results:'));
    const cvTable = new Table({
      head: [chalk.cyan('Combination'), chalk.cyan('CV Scores'), chalk.cyan('CV Mean'), chalk.cyan('CV Std')],
      style: { head: [], border: [] }
    });

    topResults.forEach((result) => {
      if ('crossValidationScores' in result) {
        const cvScores = (result as any).crossValidationScores;
        const cvMean = (result as any).crossValidationMean;
        const cvStd = (result as any).crossValidationStd;
        
        cvTable.push([
          result.combination.name,
          cvScores.map((s: number) => s.toFixed(3)).join(', '),
          cvMean.toFixed(4),
          cvStd.toFixed(4)
        ]);
      }
    });

    console.log(cvTable.toString());
  }

  // Data quality metrics
  if ('dataQuality' in results.allResults[0]) {
    console.log(chalk.bold('\n📈 Data Quality Metrics:'));
    const qualityTable = new Table({
      head: [chalk.cyan('Combination'), chalk.cyan('Train Size'), chalk.cyan('Val Size'), chalk.cyan('Test Size'), chalk.cyan('Avg Query Len')],
      style: { head: [], border: [] }
    });

    topResults.forEach((result) => {
      if ('dataQuality' in result) {
        const quality = (result as any).dataQuality;
        qualityTable.push([
          result.combination.name,
          quality.trainingSampleSize.toString(),
          quality.validationSampleSize.toString(),
          quality.testingSampleSize.toString(),
          quality.averageQueryLength.toFixed(1)
        ]);
      }
    });

    console.log(qualityTable.toString());
  }

  // Performance metrics
  if ('processingStats' in results.allResults[0]) {
    console.log(chalk.bold('\n⚡ Performance Metrics:'));
    const perfTable = new Table({
      head: [chalk.cyan('Combination'), chalk.cyan('Train Time'), chalk.cyan('Val Time'), chalk.cyan('Test Time'), chalk.cyan('Throughput'), chalk.cyan('Memory (MB)')],
      style: { head: [], border: [] }
    });

    topResults.forEach((result) => {
      if ('processingStats' in result) {
        const stats = (result as any).processingStats;
        perfTable.push([
          result.combination.name,
          `${(stats.trainingTime / 1000).toFixed(1)}s`,
          `${(stats.validationTime / 1000).toFixed(1)}s`,
          `${(stats.testingTime / 1000).toFixed(1)}s`,
          `${stats.throughput.toFixed(1)} q/s`,
          stats.memoryUsage.toFixed(2)
        ]);
      }
    });

    console.log(perfTable.toString());
  }

  // Confidence intervals
  if ('confidenceInterval' in results.allResults[0]) {
    console.log(chalk.bold('\n📊 Confidence Intervals (95%):'));
    const ciTable = new Table({
      head: [chalk.cyan('Combination'), chalk.cyan('Lower Bound'), chalk.cyan('Upper Bound'), chalk.cyan('Confidence')],
      style: { head: [], border: [] }
    });

    topResults.forEach((result) => {
      if ('confidenceInterval' in result) {
        const ci = (result as any).confidenceInterval;
        ciTable.push([
          result.combination.name,
          ci.lower.toFixed(4),
          ci.upper.toFixed(4),
          `${(ci.confidence * 100).toFixed(1)}%`
        ]);
      }
    });

    console.log(ciTable.toString());
  }
}

function displayConsistentResults(results: any) {
  console.log(chalk.bold('\n🔬 Consistent Experiment Complete!\n'));

  // Summary table
  const summaryTable = new Table({
    head: [chalk.cyan('Metric'), chalk.cyan('Value')],
    style: { head: [], border: [] }
  });

  summaryTable.push(
    ['Test Name', results.testName],
    ['Total Combinations', results.analysis.totalCombinations.toString()],
    ['Best Score', results.analysis.bestScore.toFixed(4)],
    ['Worst Score', results.analysis.worstScore.toFixed(4)],
    ['Average Score', results.analysis.averageScore.toFixed(4)],
    ['Processing Time', `${(results.processingTime / 1000).toFixed(1)}s`]
  );

  console.log(summaryTable.toString());

  // Top 3 combinations
  console.log(chalk.bold('\n🏆 Top 3 Combinations:'));
  results.topCombinations.forEach((top: any) => {
    console.log(chalk.green(`  ${top.rank}. ${top.combination.columns.join(' + ')}`));
    console.log(chalk.green(`     Score: ${top.score.toFixed(4)} | Tests: ${top.totalTests} | Similarity: ${top.averageSimilarity.toFixed(3)}`));
  });

  // Detailed results for each combination
  console.log(chalk.bold('\n📊 Detailed Results:'));
  const resultsTable = new Table({
    head: [chalk.cyan('Rank'), chalk.cyan('Combination'), chalk.cyan('Score'), chalk.cyan('Tests'), chalk.cyan('Similarity')],
    style: { head: [], border: [] }
  });

  results.allResults
    .sort((a: any, b: any) => b.overallScore - a.overallScore)
    .forEach((result: any, index: number) => {
      resultsTable.push([
        (index + 1).toString(),
        result.combination.columns.join(' + '),
        result.overallScore.toFixed(4),
        result.totalTests.toString(),
        result.averageSimilarity.toFixed(3)
      ]);
    });

  console.log(resultsTable.toString());

  // Performance metrics
  if (results.allResults.length > 0 && 'processingStats' in results.allResults[0]) {
    console.log(chalk.bold('\n⚡ Performance Metrics:'));
    const perfTable = new Table({
      head: [chalk.cyan('Combination'), chalk.cyan('Training Time'), chalk.cyan('Testing Time'), chalk.cyan('Memory (MB)')],
      style: { head: [], border: [] }
    });

    results.allResults.slice(0, 10).forEach((result: any) => {
      if ('processingStats' in result) {
        const stats = result.processingStats;
        perfTable.push([
          result.combination.description,
          `${(stats.trainingTime / 1000).toFixed(1)}s`,
          `${(stats.testingTime / 1000).toFixed(1)}s`,
          stats.memoryUsage.toFixed(2)
        ]);
      }
    });

    console.log(perfTable.toString());
  }
}

async function generateConsistentCSV(results: any, filepath: string): Promise<void> {
  try {
    let csvContent = 'Combination,Score,TotalTests,AverageSimilarity,TrainingTime,TestingTime,MemoryUsage\n';
    
    // Add summary rows
    results.allResults.forEach((result: any) => {
      const stats = result.processingStats;
      csvContent += `"${result.combination.columns.join(' + ')}",${result.overallScore.toFixed(4)},${result.totalTests},${result.averageSimilarity.toFixed(4)},${(stats.trainingTime / 1000).toFixed(2)},${(stats.testingTime / 1000).toFixed(2)},${stats.memoryUsage.toFixed(2)}\n`;
    });

    // Add detailed row results
    csvContent += '\nDetailed Results\n';
    csvContent += 'Combination,Question,ExpectedAnswer,RetrievedContent,Similarity,Score\n';
    
    results.allResults.forEach((result: any) => {
      result.rowResults.forEach((rowResult: any) => {
        csvContent += `"${result.combination.columns.join(' + ')}","${rowResult.question.replace(/"/g, '""')}","${rowResult.expectedAnswer.replace(/"/g, '""')}","${rowResult.retrievedContent.replace(/"/g, '""')}",${rowResult.similarity.toFixed(4)},${rowResult.score.toFixed(4)}\n`;
      });
    });

    fs.writeFileSync(filepath, csvContent);
    console.log(chalk.green(`\n📊 CSV export saved to: ${filepath}`));
  } catch (error) {
    console.warn(chalk.yellow(`\n⚠️  Failed to generate CSV: ${error}`));
  }
}

// Generate embeddings command
program
  .command('generate-embeddings')
  .description('Generate embeddings for table rows')
  .option('-t, --table <table>', 'Table name')
  .option('-c, --columns <columns>', 'Comma-separated list of columns to combine')
  .option('--custom-order', 'Use exact column order (default: alphabetical)')
  .option('-e, --embedding-column <column>', 'Column to store embeddings')
  .option('-b, --batch-size <size>', 'Batch size for processing', '50')
  .option('-p, --provider <provider>', 'Embedding provider (local, openai, gemini)')
  .action(async (options) => {
    const spinner = ora('Loading configuration...').start();
    
    try {
      const configManager = new ConfigManager();
      const config = await configManager.loadConfig();
      
      const { isValid, errors } = configManager.validateConfig(config);
      if (!isValid) {
        spinner.fail('❌ Configuration invalid:');
        errors.forEach(error => console.log(chalk.red(`  • ${error}`)));
        return;
      }

      const database = new DatabaseConnection(config.database);
      spinner.text = 'Testing database connection...';
      
      if (!(await database.testConnection())) {
        spinner.fail(chalk.red('❌ Database connection failed'));
        return;
      }

      spinner.stop();

      // Interactive prompts for missing options
      const availableProviders = configManager.getAvailableProviders();
      
      // Get table name
      let tableName = options.table;
      if (!tableName) {
        const tables = await database.getTables();
        if (tables.length === 0) {
          console.log(chalk.red('❌ No tables found in database'));
          return;
        }

        const { selectedTable } = await inquirer.prompt([{
          type: 'list',
          name: 'selectedTable',
          message: 'Select a table:',
          choices: tables
        }]);
        tableName = selectedTable;
      }

      // Get table info
      const tableInfo = await database.getTableInfo(tableName);
      if (!tableInfo) {
        console.log(chalk.red(`❌ Table '${tableName}' not found`));
        return;
      }

      // Get columns
      let columns: string[] = [];
      if (options.columns) {
        columns = options.columns.split(',').map((c: string) => c.trim());
      } else {
        const { selectedColumns } = await inquirer.prompt([{
          type: 'checkbox',
          name: 'selectedColumns',
          message: 'Select columns to combine for embeddings:',
          choices: tableInfo.columns
            .filter(col => !col.column_name.includes('embedding') && col.column_name !== 'id')
            .map(col => ({
              name: `${col.column_name} (${col.data_type})`,
              value: col.column_name
            })),
          validate: (answer: string[]) => answer.length > 0 || 'Please select at least one column'
        }]);
        columns = selectedColumns;
      }

      // Get embedding column
      let embeddingColumn = options.embeddingColumn;
      if (!embeddingColumn) {
        const embeddingColumns = tableInfo.columns
          .filter(col => col.data_type.includes('vector') || col.column_name.includes('embedding'))
          .map(col => col.column_name);

        if (embeddingColumns.length === 0) {
          console.log(chalk.red('❌ No embedding columns found in table'));
          return;
        }

        const { selectedEmbeddingColumn } = await inquirer.prompt([{
          type: 'list',
          name: 'selectedEmbeddingColumn',
          message: 'Select embedding column:',
          choices: embeddingColumns
        }]);
        embeddingColumn = selectedEmbeddingColumn;
      }

      // Get embedding provider
      let provider = options.provider;
      if (!provider && availableProviders.embedding.length > 1) {
        const { selectedProvider } = await inquirer.prompt([{
          type: 'list',
          name: 'selectedProvider',
          message: 'Select embedding provider:',
          choices: availableProviders.embedding.map(p => ({
            name: p === 'local' ? 'Local (Xenova/transformers)' : p.toUpperCase(),
            value: p
          }))
        }]);
        provider = selectedProvider;
      } else {
        provider = provider || availableProviders.embedding[0];
      }

      // Create embedding service
      const embeddingConfig = configManager.createEmbeddingConfig(provider);
      const { EmbeddingService } = await import('./embedding-service');
      const { AVAILABLE_EMBEDDING_MODELS } = await import('./models/embedding-models');
      
      // Let user choose embedding model
      const modelChoices = AVAILABLE_EMBEDDING_MODELS.map(model => ({
        name: `${model.name} (${model.dimensions} dimensions) - ${model.description}`,
        value: model.id
      }));
      
      const { selectedModelId } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedModelId',
          message: 'Select embedding model:',
          choices: modelChoices
        }
      ]);
      
      const embeddingService = new EmbeddingService(database, selectedModelId);
      
      await embeddingService.initialize();

      const task = {
        tableName,
        columns,
        customOrder: options.customOrder || false,
        embeddingColumn,
        batchSize: parseInt(options.batchSize) || 50
      };

      console.log(chalk.blue('\n📊 Embedding Generation Task:'));
      console.log(`  Table: ${tableName}`);
      console.log(`  Columns: ${columns.join(', ')}`);
      console.log(`  Embedding Column: ${embeddingColumn}`);
      console.log(`  Provider: ${provider}`);
      console.log(`  Batch Size: ${task.batchSize}\n`);

      await embeddingService.generateEmbeddings(task);

    } catch (error: any) {
      spinner.fail(chalk.red(`❌ Failed: ${error.message}`));
    }
  });

// Populate column command
program
  .command('populate-column')
  .description('Use LLM to populate empty columns based on other columns')
  .option('-t, --table <table>', 'Table name')
  .option('-s, --source-column <column>', 'Source column to base content on')
  .option('-c, --target-column <column>', 'Target column to populate')
  .option('-p, --provider <provider>', 'LLM provider (openai, gemini, anthropic, custom)')
  .option('--prompt-type <type>', 'Predefined prompt type (tags, description, summary, keywords)', 'custom')
  .option('--custom-prompt <prompt>', 'Custom prompt for LLM')
  .option('-b, --batch-size <size>', 'Batch size for processing', '10')
  .action(async (options) => {
    const spinner = ora('Loading configuration...').start();
    
    try {
      const configManager = new ConfigManager();
      const config = await configManager.loadConfig();
      
      const { isValid, errors } = configManager.validateConfig(config);
      if (!isValid) {
        spinner.fail('❌ Configuration invalid:');
        errors.forEach(error => console.log(chalk.red(`  • ${error}`)));
        return;
      }

      const database = new DatabaseConnection(config.database);
      spinner.text = 'Testing database connection...';
      
      if (!(await database.testConnection())) {
        spinner.fail(chalk.red('❌ Database connection failed'));
        return;
      }

      spinner.stop();

      // Interactive prompts for missing options
      const availableProviders = configManager.getAvailableProviders();
      
      if (availableProviders.llm.length === 0) {
        console.log(chalk.red('❌ No LLM providers found. Please set API keys in your .env file:'));
        console.log('  • OPENAI_API_KEY for OpenAI');
        console.log('  • GEMINI_API_KEY or GOOGLE_AI_API_KEY for Gemini');
        console.log('  • ANTHROPIC_API_KEY for Anthropic');
        console.log('  • CUSTOM_API_KEY for OpenAI-compatible APIs (like Qwen, Llama, etc.)');
        console.log('    Note: CUSTOM_ENDPOINT should end with /chat/completions');
        return;
      }

      // Get table name
      let tableName = options.table;
      if (!tableName) {
        const tables = await database.getTables();
        if (tables.length === 0) {
          console.log(chalk.red('❌ No tables found in database'));
          return;
        }

        const { selectedTable } = await inquirer.prompt([{
          type: 'list',
          name: 'selectedTable',
          message: 'Select a table:',
          choices: tables
        }]);
        tableName = selectedTable;
      }

      // Get table info
      const tableInfo = await database.getTableInfo(tableName);
      if (!tableInfo) {
        console.log(chalk.red(`❌ Table '${tableName}' not found`));
        return;
      }

      // Get source column
      let sourceColumn = options.sourceColumn;
      if (!sourceColumn) {
        const { selectedSourceColumn } = await inquirer.prompt([{
          type: 'list',
          name: 'selectedSourceColumn',
          message: 'Select source column (content to base generation on):',
          choices: tableInfo.columns
            .filter(col => col.column_name !== 'id')
            .map(col => ({
              name: `${col.column_name} (${col.data_type})`,
              value: col.column_name
            }))
        }]);
        sourceColumn = selectedSourceColumn;
      }

      // Get target column
      let targetColumn = options.targetColumn;
      if (!targetColumn) {
        const { selectedTargetColumn } = await inquirer.prompt([{
          type: 'list',
          name: 'selectedTargetColumn',
          message: 'Select target column (to populate):',
          choices: tableInfo.columns
            .filter(col => col.column_name !== 'id' && col.column_name !== sourceColumn)
            .map(col => ({
              name: `${col.column_name} (${col.data_type})`,
              value: col.column_name
            }))
        }]);
        targetColumn = selectedTargetColumn;
      }

      // Get LLM provider
      let provider = options.provider;
      if (!provider && availableProviders.llm.length > 1) {
        const { selectedProvider } = await inquirer.prompt([{
          type: 'list',
          name: 'selectedProvider',
          message: 'Select LLM provider:',
          choices: availableProviders.llm.map(p => ({
            name: p.toUpperCase(),
            value: p
          }))
        }]);
        provider = selectedProvider;
      } else {
        provider = provider || availableProviders.llm[0];
      }

      // Get prompt
      let prompt = options.customPrompt;
      const promptType = options.promptType;
      
      if (!prompt) {
        if (promptType === 'custom') {
          const { customPrompt } = await inquirer.prompt([{
            type: 'input',
            name: 'customPrompt',
            message: 'Enter custom prompt for LLM:',
            default: 'generate a list of 5 queries in json format, in the format: {[q1: "", q2:"", ...]}, using the given content. The queries will be used to fill a column in a database table called "nlp_chunk_description." This column will contain a list of queries that the user may ask for which the content is the answer. Since the content is a chunk, it may be that queries can only be answered by combining different chunks together so even though the query cannot be answered ocompletely by the content, the query should be added to the list. An example fo this would be "What are the basel iii requirements for tier 1 banks in hong kong?". This query cannot be answered using one chunk. It needs to be answered by combining different chunks together. The query should be added to the list of every chunk that is relevantto basel, hong kong, and tier 1 banks and other relevant keywords.'
          }]);
          prompt = customPrompt;
        } else {
          const { LLMService } = await import('./llm-service');
          prompt = LLMService.createPrompt(promptType as any);
        }
      }

      // Create LLM service
      const llmConfig = configManager.createLLMConfig(provider);
      const { LLMService } = await import('./llm-service');
      const llmService = new LLMService(database, llmConfig);
      
      await llmService.initialize();

      const task = {
        tableName,
        sourceColumn,
        targetColumn,
        llmProvider: llmConfig,
        prompt,
        batchSize: parseInt(options.batchSize) || 10
      };

      console.log(chalk.blue('\n🤖 Column Population Task:'));
      console.log(`  Table: ${tableName}`);
      console.log(`  Source Column: ${sourceColumn}`);
      console.log(`  Target Column: ${targetColumn}`);
      console.log(`  Provider: ${provider}`);
      console.log(`  Prompt Type: ${promptType}`);
      console.log(`  Batch Size: ${task.batchSize}\n`);

      await llmService.populateColumn(task);

    } catch (error: any) {
      spinner.fail(chalk.red(`❌ Failed: ${error.message}`));
    }
  });

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error(chalk.red(`\n💥 Uncaught Exception: ${error.message}`));
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(chalk.red(`\n💥 Unhandled Rejection: ${reason}`));
  process.exit(1);
});

program.parse();
