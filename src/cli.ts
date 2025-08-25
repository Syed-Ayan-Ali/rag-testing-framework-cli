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
import { RAGTester, ProductionTestConfiguration } from './tests/tester';
import { ExperimentResults } from './types';
import { multipleQueryPrompt, singleQueryPrompt } from './prompts';

const program = new Command();

// Read version from package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));

program
  .name('rag-test')
  .description('CLI tool for testing RAG systems with different embedding combinations')
  .version(packageJson.version);

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
      console.log(chalk.bold('📊 Available Evaluation Metrics:\n'));
      
      console.log(chalk.cyan('• BRDR: Banking Regulation specific evaluation metric'));
      console.log(chalk.gray('  Evaluates banking regulation compliance and accuracy'));
          console.log('');
      console.log(chalk.cyan('• SQL: Text-to-SQL evaluation metric'));
      console.log(chalk.gray('  Evaluates SQL query generation and database interaction'));
      console.log('');
      
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
  .option('-m, --metric <type>', 'Metric type (brdr|sql)', 'brdr')
  .option('-r, --ratio <number>', 'Training ratio (0-1)', '0.8')
  .option('-n, --name <name>', 'Test name')
  .option('-l, --limit <number>', 'Max combinations to test', '20')
  .option('-s, --seed <number>', 'Random seed for reproducible data splitting')
  .action(async (options) => {
    try {
      const configManager = new ConfigManager();
      const config = await configManager.loadConfig();

      // Interactive mode if no options provided
      let testConfig: ProductionTestConfiguration;

      if (!options.table) {
        testConfig = await interactiveTestSetup();
      } else {
        testConfig = {
          tableName: options.table,
          selectedColumns: options.columns?.split(',') || [],
          queryColumn: options.query || '',
          answerColumn: options.answer || '',
          embeddingConfig: config.embedding,
          metricType: options.metric || 'brdr',
          trainingRatio: 0.8, // Fixed ratio for consistency
          validationRatio: 0.1,
          testingRatio: 0.1,
          trainingSampleSize: 10000, // Fixed training sample size
          validationSampleSize: 1000, // Fixed validation sample size
          testingSampleSize: 2000, // Fixed testing sample size
          testName: options.name || `Test_${new Date().toISOString().replace(/[:.]/g, '-')}`,
          batchSize: 100,
          enableCaching: false,
          crossValidationFolds: 5,
          minQueryLength: 1,
          maxQueryLength: 10000,
          minAnswerLength: 1,
          maxAnswerLength: 50000,
          samplingStrategy: 'random',
          seed: options.seed ? parseInt(options.seed) : undefined
        };
      }

      await runExperiment(testConfig, config);

    } catch (error) {
      console.error(chalk.red(`❌ Test failed: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

async function interactiveTestSetup(): Promise<ProductionTestConfiguration> {
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
      { name: 'BRDR (banking regulation specific)', value: 'brdr' },
      { name: 'SQL (text-to-SQL)', value: 'sql' }
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

  const seedInput = await inquirer.prompt({
    type: 'input',
    name: 'seed',
    message: 'Random seed for reproducible results (optional, press Enter to skip):',
    default: '',
    validate: (input: any) => {
      if (!input.trim()) return true; // Allow empty
      const num = parseInt(input);
      return !isNaN(num) || 'Must be a valid number';
    }
  });

  const limitInput = await inquirer.prompt({
    type: 'input',
    name: 'maxCombinations',
    message: 'Max combinations to test:',
    default: '20',
    validate: (input: any) => {
      const num = parseInt(input);
      return !isNaN(num) && num > 0 || 'Must be a positive number';
    }
  });

  return {
    tableName: answers.tableName,
    selectedColumns: (columnSelection as any).selectedColumns,
    queryColumn: (querySelection as any).queryColumn,
    answerColumn: (answerSelection as any).answerColumn,
    embeddingConfig: config.embedding,
    metricType: (metricSelection as any).metricType,
    trainingRatio: 0.8, // Fixed ratio for consistency
    validationRatio: 0.1,
    testingRatio: 0.1,
    trainingSampleSize: 10000, // Fixed training sample size
    validationSampleSize: 1000, // Fixed validation sample size
    testingSampleSize: 2000, // Fixed testing sample size
    testName: (nameInput as any).testName,
    batchSize: 100,
    enableCaching: false,
    crossValidationFolds: 5,
    minQueryLength: 10,
    maxQueryLength: 500,
    minAnswerLength: 10,
    maxAnswerLength: 1000,
    samplingStrategy: 'random',
    seed: (seedInput as any).seed ? parseInt((seedInput as any).seed) : undefined
  };
}

async function runExperiment(testConfig: ProductionTestConfiguration, config: any) {
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
      const embeddingService = new EmbeddingService(database, embeddingConfig);
      
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
      console.log(`  Batch Size: ${parseInt(options.batchSize) || 50}\n`);

      console.log(`\n🔄 Starting embedding generation process...`);

      try {
        // Get data from table
        console.log(`📊 Fetching data from ${tableName}...`);
        const tableData = await database.getTableData(tableName);

        if (tableData.length === 0) {
          console.log(chalk.yellow(`⚠️  No data found in table '${tableName}'`));
          return;
        }

        console.log(`📊 Found ${tableData.length} rows to process`);

        // Initialize embedding generator
        const embeddingConfig: any = {
          model: provider === 'local' ? 'local' : 'openai',
          localModel: provider === 'local' ? 'Xenova/all-MiniLM-L6-v2' : undefined,
          openaiModel: provider !== 'local' ? 'text-embedding-3-small' : undefined
        };

        const embeddings = new EmbeddingGenerator(embeddingConfig);
        await embeddings.initialize();

        // Generate column combination for embedding
        const combination = {
          columns: columns,
          name: columns.join('_')
        };

        // Process each row individually
        let processedCount = 0;
        let successCount = 0;
        let errorCount = 0;

        console.log(`\n🔄 Processing ${tableData.length} rows individually...`);

        for (let i = 0; i < tableData.length; i++) {
          const row = tableData[i];
          try {
            console.log(`\n🔄 Processing row ${i + 1}/${tableData.length} (ID: ${row.id})`);

            const context = columns
              .map(col => row[col])
              .filter(val => val !== null && val !== undefined)
              .join(' [SEP] ');

            if (!context || context.trim() === '') {
              console.log(`  ⚠️  Skipping row ${row.id} - empty context`);
              continue;
            }

            // Generate embedding
            const embedding = await embeddings.generateEmbedding(context);

            if (embedding && embedding.length > 0) {
              // Convert embedding array to PostgreSQL vector format
              const vectorString = `[${embedding.join(',')}]`;

              // Update the embedding column in the database
              await database.updateRowColumn(tableName, row.id, embeddingColumn, vectorString);

              successCount++;
              console.log(`  ✅ Updated row ${row.id} with ${embedding.length}-dimensional embedding`);
            } else {
              console.log(`  ⚠️  Failed to generate embedding for row ${row.id}`);
            }

            processedCount++;

          } catch (rowError: any) {
            errorCount++;
            console.error(`  ❌ Failed to process row ${row.id}: ${rowError.message}`);
            continue;
          }

          // Progress update every 10 rows
          if ((i + 1) % 10 === 0) {
            console.log(`  📊 Progress: ${i + 1}/${tableData.length} rows processed (${successCount} successful, ${errorCount} errors)`);
          }
        }

        console.log(chalk.green('\n✅ Embedding generation completed successfully!'));
        console.log(`📊 Summary:`);
        console.log(`  • Total rows: ${tableData.length}`);
        console.log(`  • Processed: ${processedCount}`);
        console.log(`  • Successful: ${successCount}`);
        console.log(`  • Errors: ${errorCount}`);
        console.log(`  • Success rate: ${((successCount / processedCount) * 100).toFixed(1)}%`);
        console.log(`\n💾 Check your database table '${tableName}' column '${embeddingColumn}' for the generated embeddings.`);

      } catch (embeddingError: any) {
        console.error(chalk.red(`❌ Embedding generation failed: ${embeddingError.message}`));
      }

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
        console.log('  • Custom Qwen model is available without additional configuration');
        console.log('    (Uses built-in API key and endpoint for Qwen/Qwen3-235B-A22B)');
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
      if (!provider) {
        // Always include custom option for Qwen model
        const providerChoices = [
          ...availableProviders.llm.map(p => ({
            name: p.toUpperCase(),
            value: p
          })),
          {
            name: 'CUSTOM (Qwen/Qwen3-235B-A22B)',
            value: 'custom'
          }
        ];

        if (providerChoices.length > 1) {
          const { selectedProvider } = await inquirer.prompt([{
            type: 'list',
            name: 'selectedProvider',
            message: 'Select LLM provider:',
            choices: providerChoices
          }]);
          provider = selectedProvider;
        } else {
          provider = providerChoices[0].value;
        }
      }

      // Get prompt
      let prompt = options.customPrompt;
      const promptType = options.promptType;
      
      if (!prompt) {
        if (promptType === 'nlp_chunk_description') {
          const { customPrompt } = await inquirer.prompt([{
            type: 'input',
            name: 'customPrompt',
            message: 'Enter custom prompt for LLM:',
            default: multipleQueryPrompt,
          }]);
          prompt = customPrompt;
        } else if (promptType === 'chunk_description') {
          const { customPrompt } = await inquirer.prompt([{
            type: 'input',
            name: 'customPrompt',
            message: 'Enter custom prompt for LLM:',
            default: singleQueryPrompt,
          }]);
          prompt = customPrompt;
        } else {
          prompt = `Generate content based on the source column data.`;
        }
      }

      console.log(chalk.blue('\n🤖 Column Population Task:'));
      console.log(`  Table: ${tableName}`);
      console.log(`  Source Column: ${sourceColumn}`);
      console.log(`  Target Column: ${targetColumn}`);
      console.log(`  Provider: ${provider}`);
      console.log(`  Prompt Type: ${promptType}`);
      console.log(`  Batch Size: ${parseInt(options.batchSize) || 10}\n`);

      // Import the custom LLM service
      const { CustomLLMService } = await import('./custom-llm-service');

      // Create LLM config based on provider
      let llmConfig: any;
      if (provider === 'custom') {
        // Use the custom Qwen model with fallback text processing
        llmConfig = CustomLLMService.createQwenModelConfig();
        console.log(`  Using Custom Model: ${llmConfig.model}`);
        console.log(`  Note: Will use text processing fallback if API fails`);
      } else {
        // Use standard providers
        llmConfig = {
          provider: provider,
          apiKey: process.env[`${provider.toUpperCase()}_API_KEY`] || '',
          model: provider === 'openai' ? 'gpt-3.5-turbo' : provider === 'gemini' ? 'gemini-pro' : 'claude-3-haiku-20240307',
          endpoint: provider === 'openai' ? undefined : process.env[`${provider.toUpperCase()}_ENDPOINT`]
        };
      }

        console.log(`\n🔄 Starting column population process...`);

      try {
        // Check if target column already has data
        console.log(`🔍 Checking if target column '${targetColumn}' already has data...`);
        const totalRows = (await database.getTableData(tableName, ['id'])).length;
        const emptyCount = await database.getEmptyColumnCount(tableName, targetColumn);
        const filledCount = totalRows - emptyCount;

        if (filledCount > 0) {
          console.log(chalk.yellow(`⚠️  Target column '${targetColumn}' already has data in ${filledCount} rows.`));
          const { overwrite } = await inquirer.prompt([{
            type: 'confirm',
            name: 'overwrite',
            message: `Do you want to overwrite the existing data in column '${targetColumn}'?`,
            default: false
          }]);
          
          if (!overwrite) {
            console.log(chalk.gray('Operation cancelled by user.'));
            return;
          }
          
          console.log(chalk.yellow(`⚠️  Proceeding with overwrite of ${filledCount} rows...`));
        }

        // Import database operations for column population
        const populationTask = {
          tableName,
          sourceColumn,
          targetColumn,
          llmProvider: llmConfig,
          prompt,
          batchSize: parseInt(options.batchSize) || 10
        };

        // Get data from source column
        console.log(`📊 Fetching data from ${sourceColumn}...`);
        const sourceData = await database.getTableData(tableName);

        if (sourceData.length === 0) {
          console.log(chalk.yellow(`⚠️  No data found in table '${tableName}'`));
          return;
        }

        console.log(`📊 Found ${sourceData.length} rows to process`);

        // Process each row individually instead of in batches
        let processedCount = 0;
        let successCount = 0;
        let errorCount = 0;

        console.log(`\n🔄 Processing ${sourceData.length} rows individually...`);

        for (let i = 0; i < sourceData.length; i++) {
          const row = sourceData[i];
          try {
            const sourceContent = row[sourceColumn];
            if (!sourceContent || sourceContent.trim() === '') {
              console.log(`  ⚠️  Skipping row ${row.id} - empty source content`);
              continue;
            }

            // Generate content using LLM - pass source content as context
            const generationPrompt = `${prompt}\n\nContext:\n${sourceContent}`;
            console.log(`\n📄 Processing row ${row.id} with content:`, sourceContent.substring(0, 200) + '...');
            const llmService = new CustomLLMService(llmConfig);
            const response = await llmService.generateCompletion(generationPrompt, 500);

            if (response.content && response.content.trim() !== '') {
              // Update the target column in the database
              await database.updateRowColumn(tableName, row.id, targetColumn, response.content.trim());

              successCount++;
              console.log(`  ✅ Updated row ${row.id}`);
            } else {
              console.log(`  ⚠️  Empty response for row ${row.id}`);
            }

            processedCount++;

            // Add small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));

          } catch (rowError: any) {
            errorCount++;
            console.error(`  ❌ Failed to process row ${row.id}: ${rowError.message}`);
            continue;
          }

          // Progress update every 10 rows
          if ((i + 1) % 10 === 0) {
            console.log(`  📊 Progress: ${i + 1}/${sourceData.length} rows processed (${successCount} successful, ${errorCount} errors)`);
          }
        }

        console.log(chalk.green('\n✅ Column population completed successfully!'));
        console.log(`📊 Summary:`);
        console.log(`  • Total rows: ${sourceData.length}`);
        console.log(`  • Processed: ${processedCount}`);
        console.log(`  • Successful: ${successCount}`);
        console.log(`  • Errors: ${errorCount}`);
        console.log(`  • Success rate: ${((successCount / processedCount) * 100).toFixed(1)}%`);
        console.log(`\n💾 Check your database table '${tableName}' column '${targetColumn}' for the populated content.`);

      } catch (populationError: any) {
        console.error(chalk.red(`❌ Column population failed: ${populationError.message}`));
      }

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
