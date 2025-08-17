import { DatabaseConnection } from './database';
import { EmbeddingGenerator, TrainingData } from './embeddings';
import { SimilarityMetric, BRDRMetric } from './metrics';
import { TestConfiguration, TestResult, ExperimentResults, ColumnCombination } from './types';

export class RAGTester {
  private db: DatabaseConnection;
  private embeddings: EmbeddingGenerator;
  private similarityMetric: SimilarityMetric;
  private brdrMetric: BRDRMetric;

  constructor(
    dbConnection: DatabaseConnection,
    embeddingGenerator: EmbeddingGenerator
  ) {
    this.db = dbConnection;
    this.embeddings = embeddingGenerator;
    this.similarityMetric = new SimilarityMetric();
    this.brdrMetric = new BRDRMetric();
  }

  async initialize(): Promise<void> {
    await this.embeddings.initialize();
  }

  async runExperiment(config: TestConfiguration): Promise<ExperimentResults> {
    const startTime = Date.now();

    console.log(`\n🧪 Starting experiment: ${config.testName}`);
    console.log(`📊 Table: ${config.tableName}`);
    console.log(`📋 Columns: ${config.selectedColumns.join(', ')}`);
    console.log(`🎯 Metric: ${config.metricType}`);

    // Generate column combinations
    const combinations = this.embeddings.generateColumnCombinations(
      config.selectedColumns,
      config.maxCombinations || 20
    );
    
    console.log(`🔄 Testing ${combinations.length} column combinations...\n`);

    const allResults: TestResult[] = [];

    for (let i = 0; i < combinations.length; i++) {
      const combination = combinations[i];
      
      console.log(`[${i + 1}/${combinations.length}] Testing: ${combination.name}`);

      try {
        const result = await this.runSingleTest(config, combination);
        allResults.push(result);
        
        console.log(`  ✅ Score: ${result.averageScore.toFixed(3)} (${result.totalTests} tests)`);
      } catch (error) {
        console.error(`  ❌ Failed: ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }
    }

    if (allResults.length === 0) {
      throw new Error('No combinations produced valid results');
    }

    // Calculate summary statistics
    const scores = allResults.map(r => r.averageScore);
    const bestResult = allResults.reduce((best, current) => 
      current.averageScore > best.averageScore ? current : best
    );
    const worstResult = allResults.reduce((worst, current) => 
      current.averageScore < worst.averageScore ? current : worst
    );

    const summary = {
      bestCombination: bestResult.combination,
      bestScore: bestResult.averageScore,
      worstCombination: worstResult.combination,
      worstScore: worstResult.averageScore,
      averageScore: scores.reduce((sum, score) => sum + score, 0) / scores.length,
      totalCombinations: allResults.length
    };

    const processingTime = Date.now() - startTime;

    return {
      testName: config.testName,
      timestamp: new Date(),
      configuration: config,
      allResults,
      summary,
      processingTime
    };
  }

  async runSingleTest(config: TestConfiguration, combination: ColumnCombination): Promise<TestResult> {
    const startTime = Date.now();

    // Fetch data from the table
    const data = await this.db.getTableData(config.tableName);
    
    if (data.length === 0) {
      throw new Error(`No data found in table ${config.tableName}`);
    }

    // Filter out rows with missing query or answer data
    const validData = data.filter(row => 
      row[config.queryColumn] && 
      row[config.answerColumn] &&
      combination.columns.some(col => row[col])
    );

    if (validData.length < 5) {
      throw new Error('Not enough valid data rows for testing');
    }

    // Split data into training and testing
    const shuffled = [...validData].sort(() => Math.random() - 0.5);
    const splitIndex = Math.floor(shuffled.length * config.trainingRatio);
    const trainingData = shuffled.slice(0, splitIndex);
    const testingData = shuffled.slice(splitIndex);

    if (testingData.length === 0) {
      throw new Error('No testing data available after split');
    }

    // Generate embeddings for training data
    const trainingEmbeddings = await this.embeddings.processTrainingData(
      trainingData,
      combination,
      config.answerColumn
    );

    // Process test queries
    const results: any[] = [];
    let totalSimilarity = 0;

    for (let i = 0; i < testingData.length; i++) {
      const testRow = testingData[i];
      const query = testRow[config.queryColumn];
      const expectedAnswer = testRow[config.answerColumn];

      try {
        // Find best match from training data
        const matches = await this.embeddings.processQuery(
          query,
          trainingEmbeddings,
          1
        );

        if (matches.length === 0) {
          continue;
        }

        const bestMatch = matches[0];
        const actualAnswer = bestMatch.result.targetValue;
        totalSimilarity += bestMatch.similarity;

        // Calculate metric based on type
        let score: number;
        if (config.metricType === 'similarity') {
          const result = this.similarityMetric.calculate(expectedAnswer, actualAnswer, bestMatch.similarity);
          score = result.overallScore;
        } else {
          const result = this.brdrMetric.calculate(expectedAnswer, actualAnswer, bestMatch.similarity);
          score = result.overallScore;
        }

        results.push({
          query,
          expectedAnswer,
          actualAnswer,
          similarity: bestMatch.similarity,
          score
        });

      } catch (error) {
        console.warn(`    Skipped test query ${i + 1}: ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }
    }

    if (results.length === 0) {
      throw new Error('No valid test results generated');
    }

    // Calculate averages
    const averageScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
    const averageSimilarity = totalSimilarity / results.length;

    const processingTime = Date.now() - startTime;

    return {
      combination,
      averageScore,
      totalTests: results.length,
      processingTime,
      embeddingStats: {
        trainingEmbeddings: trainingEmbeddings.embeddings.length,
        testQueries: results.length,
        averageSimilarity
      }
    };
  }

  async validateConfiguration(config: TestConfiguration): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if table exists and get info
    const tableInfo = await this.db.getTableInfo(config.tableName);
    if (!tableInfo) {
      errors.push(`Table "${config.tableName}" not found`);
      return { isValid: false, errors, warnings };
    }

    const columnNames = tableInfo.columns.map(col => col.column_name);

    // Check if columns exist
    for (const column of config.selectedColumns) {
      if (!columnNames.includes(column)) {
        errors.push(`Column "${column}" not found in table "${config.tableName}"`);
      }
    }

    if (!columnNames.includes(config.queryColumn)) {
      errors.push(`Query column "${config.queryColumn}" not found`);
    }

    if (!columnNames.includes(config.answerColumn)) {
      errors.push(`Answer column "${config.answerColumn}" not found`);
    }

    // Validation checks
    if (config.selectedColumns.length === 0) {
      errors.push('At least one column must be selected for embeddings');
    }

    if (config.selectedColumns.length > 5) {
      warnings.push('More than 5 columns may result in many combinations and slow processing');
    }

    if (config.trainingRatio <= 0 || config.trainingRatio >= 1) {
      errors.push('Training ratio must be between 0 and 1');
    }

    if (tableInfo.rowCount < 10) {
      warnings.push('Table has very few rows - results may not be reliable');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  async getTableInfo(tableName: string) {
    return this.db.getTableInfo(tableName);
  }

  async getTables() {
    return this.db.getTables();
  }

  async getSampleData(tableName: string, limit: number = 3) {
    return this.db.getTableData(tableName, ['*'], limit);
  }
}
