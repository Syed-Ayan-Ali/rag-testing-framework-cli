import { DatabaseConnection } from '../database';
import { EmbeddingGenerator, TrainingData, ColumnCombination } from '../embeddings';
import { TestConfiguration, TestResult, ExperimentResults } from '../types';
import { BRDRMetric, BRDRMetricResult, SQLMetric, SQLMetricResult } from '../metrics';

export interface ProductionTestConfiguration extends TestConfiguration {
  // Data splitting configuration with fixed amounts
  trainingRatio: number;
  validationRatio: number;
  testingRatio: number;

  // Fixed sample sizes for consistency (linked to seed)
  trainingSampleSize: number;  // Fixed number of training rows
  validationSampleSize: number; // Fixed number of validation rows
  testingSampleSize: number;   // Fixed number of testing rows

  // Performance settings
  batchSize: number;
  enableCaching: boolean;

  // Cross-validation settings
  crossValidationFolds: number;

  // Data quality filters
  minQueryLength: number;
  minAnswerLength: number;
  maxQueryLength: number;
  maxAnswerLength: number;

  // Sampling strategy
  samplingStrategy: 'random' | 'stratified' | 'time_based' | 'query_complexity';

  // For time-based sampling (if you have timestamp columns)
  timestampColumn?: string;
  timeWindow?: 'daily' | 'weekly' | 'monthly';

  // For query complexity sampling
  complexityMetrics?: string[];
}

export interface ProductionTestResult extends TestResult {
  // Detailed metrics (supports both BRDR and SQL)
  detailedMetrics: BRDRMetricResult | SQLMetricResult;

  // Cross-validation results
  crossValidationScores: number[];
  crossValidationMean: number;
  crossValidationStd: number;

  // Confidence intervals
  confidenceInterval: { lower: number; upper: number; confidence: number };

  // Performance metrics
  processingStats: {
    trainingTime: number;
    validationTime: number;
    testingTime: number;
    embeddingTime: number;
    memoryUsage: number;
    throughput: number; // queries per second
  };

  // Data quality metrics
  dataQuality: {
    trainingSampleSize: number;
    validationSampleSize: number;
    testingSampleSize: number;
    averageQueryLength: number;
    averageAnswerLength: number;
    queryComplexityDistribution: Record<string, number>;
  };
}

export class RAGTester {
  private db: DatabaseConnection;
  private embeddings: EmbeddingGenerator;
  private brdrMetric: BRDRMetric;
  private sqlMetric: SQLMetric;
  private embeddingCache = new Map<string, number[][]>();

  constructor(
    dbConnection: DatabaseConnection,
    embeddingGenerator: EmbeddingGenerator
  ) {
    this.db = dbConnection;
    this.embeddings = embeddingGenerator;
    this.brdrMetric = new BRDRMetric();
    this.sqlMetric = new SQLMetric();
  }

  async initialize(): Promise<void> {
    await this.embeddings.initialize();
  }

  /**
   * Creates a seeded random number generator for reproducible results
   * @param seed - The seed value for reproducibility
   * @returns A function that generates random numbers
   */
  private createSeededRandom(seed: number): () => number {
    let currentSeed = seed;
    return () => {
      // Simple linear congruential generator for reproducibility
      currentSeed = (currentSeed * 9301 + 49297) % 233280;
      return currentSeed / 233280;
    };
  }

  async runExperiment(config: ProductionTestConfiguration): Promise<ExperimentResults> {
    const startTime = Date.now();
    const memoryStart = process.memoryUsage();

    console.log(`\n🚀 Starting RAG Experiment: ${config.testName}`);
    console.log(`📊 Table: ${config.tableName}`);
    console.log(`📋 Columns: ${config.selectedColumns.join(', ')}`);
    console.log(`🎯 Metric: ${config.metricType}`);
    console.log(`🔢 Seed: ${config.seed}`);
    console.log(`📊 Fixed Sample Sizes - Training: ${config.trainingSampleSize}, Validation: ${config.validationSampleSize}, Testing: ${config.testingSampleSize}`);

    // Validate configuration
    const validation = await this.validateConfiguration(config);
    if (!validation.isValid) {
      throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
    }

    // Get table info for data quality assessment
    const tableInfo = await this.db.getTableInfo(config.tableName);
    if (!tableInfo) throw new Error(`Table ${config.tableName} not found`);

    console.log(`📊 Total rows in table: ${tableInfo.rowCount.toLocaleString()}`);

    // Generate column combinations
    const combinations = this.embeddings.generateColumnCombinations(
      config.selectedColumns
    );
    
    console.log(`🔄 Testing ${combinations.length} column combinations...\n`);

    const allResults: ProductionTestResult[] = [];

    for (let i = 0; i < combinations.length; i++) {
      const combination = combinations[i];
      
      console.log(`[${i + 1}/${combinations.length}] Testing: ${combination.name}`);

      try {
        const result = await this.runSingleTest(config, combination, tableInfo);
        allResults.push(result);
        
        console.log(`  ✅ Score: ${result.averageScore.toFixed(3)} (${result.totalTests} tests)`);
        console.log(`  📊 CV Mean: ${result.crossValidationMean.toFixed(3)} ± ${result.crossValidationStd.toFixed(3)}`);
        console.log(`  ⏱️  Total Time: ${(result.processingStats.trainingTime + result.processingStats.testingTime).toFixed(1)}ms`);
      } catch (error) {
        console.error(`  ❌ Failed: ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }
    }

    if (allResults.length === 0) {
      throw new Error('No combinations produced valid results');
    }

    // Calculate enhanced summary statistics
    const summary = this.calculateSummary(allResults);
    const processingTime = Date.now() - startTime;
    const memoryEnd = process.memoryUsage();
    const memoryUsed = memoryEnd.heapUsed - memoryStart.heapUsed;

    console.log(`\n📊 Memory Usage: ${(memoryUsed / 1024 / 1024).toFixed(2)} MB`);

    return {
      testName: config.testName,
      timestamp: new Date(),
      configuration: config,
      allResults,
      summary,
      processingTime
    };
  }

  private async runSingleTest(
    config: ProductionTestConfiguration,
    combination: ColumnCombination,
    tableInfo: any
  ): Promise<ProductionTestResult> {
    const startTime = Date.now();

    // Split data into training, validation, and testing sets with fixed sizes
    const { trainingData, validationData, testingData } = await this.splitDataWithFixedSizes(config, tableInfo);

    if (trainingData.length === 0 || testingData.length === 0) {
      throw new Error('Insufficient data for training or testing');
    }

    // Generate embeddings for training data
    const trainingStart = Date.now();
    const trainingEmbeddings = await this.generateTrainingEmbeddings(trainingData, combination, config);
    const trainingTime = Date.now() - trainingStart;

    // Run cross-validation on training data
    const cvStart = Date.now();
    const crossValidationScores = await this.runCrossValidation(
      trainingData,
      combination,
      config,
      trainingEmbeddings
    );
    const cvTime = Date.now() - cvStart;

    // Test on validation set (if available)
    const validationStart = Date.now();
    const validationResults = await this.processTestQueries(
      validationData,
      trainingEmbeddings,
      config
    );
    const validationTime = Date.now() - validationStart;

    // Test on final test set
    const testingStart = Date.now();
    const testingResults = await this.processTestQueries(
      testingData,
      trainingEmbeddings,
      config
    );
    const testingTime = Date.now() - testingStart;

    if (testingResults.length === 0) {
      throw new Error('No valid test results generated');
    }

    // Calculate metrics
    const averageScore = testingResults.reduce((sum, r) => sum + r.score, 0) / testingResults.length;
    const averageSimilarity = testingResults.reduce((sum, r) => sum + r.similarity, 0) / testingResults.length;

    // Calculate cross-validation statistics
    const cvMean = crossValidationScores.reduce((sum, score) => sum + score, 0) / crossValidationScores.length;
    const cvVariance = crossValidationScores.reduce((sum, score) => sum + Math.pow(score - cvMean, 2), 0) / crossValidationScores.length;
    const cvStd = Math.sqrt(cvVariance);

    // Calculate confidence interval
    const confidenceInterval = this.calculateConfidenceInterval(testingResults.map(r => r.score));

    const totalTime = Date.now() - startTime;

    // Calculate data quality metrics
    const dataQuality = this.calculateDataQuality(trainingData, validationData, testingData, config);

    return {
      combination,
      averageScore,
      totalTests: testingResults.length,
      processingTime: totalTime,
      detailedMetrics: testingResults[0].detailedMetrics,
      crossValidationScores,
      crossValidationMean: cvMean,
      crossValidationStd: cvStd,
      confidenceInterval,
      processingStats: {
        trainingTime,
        validationTime,
        testingTime,
        embeddingTime: trainingTime,
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
        throughput: testingResults.length / (testingTime / 1000)
      },
      dataQuality,
      embeddingStats: {
        trainingEmbeddings: trainingEmbeddings.embeddings.length,
        testQueries: testingResults.length,
        averageSimilarity
      }
    };
  }

  private async splitDataWithFixedSizes(config: ProductionTestConfiguration, tableInfo: any): Promise<{
    trainingData: any[];
    validationData: any[];
    testingData: any[];
  }> {
    const totalRows = tableInfo.rowCount;

    console.log(`  📊 Using fixed sample sizes with seed ${config.seed}:`);
    console.log(`     Training: ${config.trainingSampleSize}, Validation: ${config.validationSampleSize}, Testing: ${config.testingSampleSize}`);

    // Create seeded random generator for reproducible sampling
    const seededRandom = this.createSeededRandom(config.seed || 42);

    // Sample data using seed for reproducibility
    const allData = await this.db.getTableData(config.tableName);

    if (allData.length < config.trainingSampleSize + config.validationSampleSize + config.testingSampleSize) {
      throw new Error(`Not enough data in table. Need ${config.trainingSampleSize + config.validationSampleSize + config.testingSampleSize} rows, but only ${allData.length} available.`);
    }

    // Shuffle data using seeded random for reproducibility
    const shuffled = [...allData].sort(() => seededRandom() - 0.5);

    // Take exact sample sizes for each split
    const trainingData = shuffled.slice(0, config.trainingSampleSize);
    const validationData = shuffled.slice(config.trainingSampleSize, config.trainingSampleSize + config.validationSampleSize);
    const testingData = shuffled.slice(config.trainingSampleSize + config.validationSampleSize, config.trainingSampleSize + config.validationSampleSize + config.testingSampleSize);

    return { trainingData, validationData, testingData };
  }

  private async runCrossValidation(
    trainingData: any[],
    combination: ColumnCombination,
    config: ProductionTestConfiguration,
    trainingEmbeddings: TrainingData
  ): Promise<number[]> {
    const scores: number[] = [];
    const foldSize = Math.floor(trainingData.length / config.crossValidationFolds);

    for (let fold = 0; fold < config.crossValidationFolds; fold++) {
      const startIdx = fold * foldSize;
      const endIdx = startIdx + foldSize;

      // Create validation fold
      const validationFold = trainingData.slice(startIdx, endIdx);
      const trainingFold = [
        ...trainingData.slice(0, startIdx),
        ...trainingData.slice(endIdx)
      ];

      if (trainingFold.length === 0 || validationFold.length === 0) continue;

      // Generate embeddings for training fold
      const foldEmbeddings = await this.embeddings.processTrainingData(
        trainingFold,
        combination,
        config.answerColumn
      );

      // Test on validation fold
      const foldResults = await this.processTestQueries(
        validationFold,
        foldEmbeddings,
        config
      );

      if (foldResults.length > 0) {
        const foldScore = foldResults.reduce((sum, r) => sum + r.score, 0) / foldResults.length;
        scores.push(foldScore);
      }
    }

    return scores;
  }

  private async generateTrainingEmbeddings(
    trainingData: any[],
    combination: ColumnCombination,
    config: ProductionTestConfiguration
  ): Promise<TrainingData> {
    const cacheKey = `${combination.name}_${trainingData.length}_${config.seed}`;

    if (config.enableCaching && this.embeddingCache.has(cacheKey)) {
      console.log(`  💾 Using cached embeddings for ${combination.name}`);
      const cachedEmbeddings = this.embeddingCache.get(cacheKey)!;
      return {
        embeddings: cachedEmbeddings.map((embedding, index) => ({
          id: `cached_${index}`,
          combination,
          embedding,
          context: trainingData[index] ? this.combineColumns(trainingData[index], combination.columns) : '',
          yValue: trainingData[index]?.[config.answerColumn] || '',
          metadata: { cached: true }
        })),
        combination,
        totalRows: trainingData.length
      };
    }

    // Generate new embeddings
    const embeddings = await this.embeddings.processTrainingData(
      trainingData,
      combination,
      config.answerColumn
    );

    // Cache embeddings if enabled
    if (config.enableCaching) {
      const embeddingArrays = embeddings.embeddings.map(e => e.embedding);
      this.embeddingCache.set(cacheKey, embeddingArrays);
    }

    return embeddings;
  }

  private async processTestQueries(
    testingData: any[],
    trainingEmbeddings: TrainingData,
    config: ProductionTestConfiguration
  ): Promise<any[]> {
    const results: any[] = [];
    const batchSize = config.batchSize;

    for (let i = 0; i < testingData.length; i += batchSize) {
      const batch = testingData.slice(i, i + batchSize);

      for (const testRow of batch) {
      const query = testRow[config.queryColumn];
      const expectedAnswer = testRow[config.answerColumn];

        if (!query || !expectedAnswer) continue;

        // Apply data quality filters
        if (query.length < config.minQueryLength || query.length > config.maxQueryLength) continue;
        if (expectedAnswer.length < config.minAnswerLength || expectedAnswer.length > config.maxAnswerLength) continue;

      try {
        // Find best match from training data
        const matches = await this.embeddings.processQuery(
          query,
          trainingEmbeddings,
          1
        );

          if (matches.length === 0) continue;

        const bestMatch = matches[0];
        const actualAnswer = bestMatch.result.yValue;

          // Calculate metric based on configuration
          let detailedMetrics: BRDRMetricResult | SQLMetricResult;
          if (config.metricType === 'brdr') {
            detailedMetrics = this.brdrMetric.calculate(expectedAnswer, actualAnswer, bestMatch.similarity);
          } else if (config.metricType === 'sql') {
            detailedMetrics = this.sqlMetric.calculate(expectedAnswer, actualAnswer, bestMatch.similarity);
        } else {
            // Default to BRDR
            detailedMetrics = this.brdrMetric.calculate(expectedAnswer, actualAnswer, bestMatch.similarity);
        }

        results.push({
          query,
          expectedAnswer,
          actualAnswer,
          similarity: bestMatch.similarity,
            score: detailedMetrics.overallScore,
            detailedMetrics
        });

      } catch (error) {
        console.warn(`    Skipped test query ${i + 1}: ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }
    }

      // Progress indicator for large datasets
      if (testingData.length > 1000 && i % (batchSize * 10) === 0) {
        console.log(`    Processed ${Math.min(i + batchSize, testingData.length)}/${testingData.length} test queries`);
      }
    }

    return results;
  }

  private combineColumns(row: any, columns: string[]): string {
    return columns
      .map(col => row[col])
      .filter(val => val !== null && val !== undefined)
      .join(' [SEP] ');
  }

  private calculateConfidenceInterval(scores: number[], confidenceLevel: number = 0.95): { lower: number; upper: number; confidence: number } {
    if (scores.length < 2) return { lower: scores[0] || 0, upper: scores[0] || 0, confidence: confidenceLevel };

    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / (scores.length - 1);
    const standardError = Math.sqrt(variance / scores.length);

    // Simple t-distribution approximation for 95% confidence
    const tValue = 1.96; // Approximate for large samples

    return {
      lower: Math.max(0, mean - tValue * standardError),
      upper: Math.min(1, mean + tValue * standardError),
      confidence: confidenceLevel
    };
  }

  private calculateDataQuality(
    trainingData: any[],
    validationData: any[],
    testingData: any[],
    config: ProductionTestConfiguration
  ): any {
    const allData = [...trainingData, ...validationData, ...testingData];

    // Calculate query complexity distribution
    const complexityDistribution: Record<string, number> = {};
    allData.forEach(row => {
      const complexity = this.calculateQueryComplexity(row, config.queryColumn || 'query');
      const category = complexity < 3 ? 'low' : complexity < 6 ? 'medium' : 'high';
      complexityDistribution[category] = (complexityDistribution[category] || 0) + 1;
    });

    // Normalize distribution
    Object.keys(complexityDistribution).forEach(key => {
      complexityDistribution[key] = complexityDistribution[key] / allData.length;
    });

    return {
      trainingSampleSize: trainingData.length,
      validationSampleSize: validationData.length,
      testingSampleSize: testingData.length,
      averageQueryLength: allData.reduce((sum, row) => sum + (row[config.queryColumn || 'query'] || '').length, 0) / allData.length,
      averageAnswerLength: allData.reduce((sum, row) => sum + (row[config.answerColumn] || '').length, 0) / allData.length,
      queryComplexityDistribution: complexityDistribution
    };
  }

  private calculateQueryComplexity(row: any, queryColumn: string): number {
    const query = row[queryColumn] || '';
    let complexity = 0;

    // Simple complexity heuristics
    if (query.includes('join')) complexity += 2;
    if (query.includes('where')) complexity += 1;
    if (query.includes('group by')) complexity += 2;
    if (query.includes('having')) complexity += 2;
    if (query.includes('order by')) complexity += 1;
    if (query.includes('subquery') || query.includes('(')) complexity += 3;
    if (query.includes('union')) complexity += 2;

    // Length factor
    complexity += Math.min(query.length / 100, 2);

    return complexity;
  }

  private calculateSummary(results: ProductionTestResult[]): any {
    const scores = results.map(r => r.averageScore);
    const cvMeans = results.map(r => r.crossValidationMean);

    const bestResult = results.reduce((best, current) =>
      current.averageScore > best.averageScore ? current : best
    );
    const worstResult = results.reduce((worst, current) =>
      current.averageScore < worst.averageScore ? current : worst
    );

    // Calculate additional statistics
    const sortedScores = [...scores].sort((a, b) => a - b);
    const median = sortedScores[Math.floor(sortedScores.length / 2)];
    const q1 = sortedScores[Math.floor(sortedScores.length * 0.25)];
    const q3 = sortedScores[Math.floor(sortedScores.length * 0.75)];

    // Cross-validation statistics
    const avgCVMean = cvMeans.reduce((sum, mean) => sum + mean, 0) / cvMeans.length;
    const avgCVStd = results.reduce((sum, r) => sum + r.crossValidationStd, 0) / results.length;

    return {
      bestCombination: bestResult.combination,
      bestScore: bestResult.averageScore,
      worstCombination: worstResult.combination,
      worstScore: worstResult.averageScore,
      averageScore: scores.reduce((sum, score) => sum + score, 0) / scores.length,
      medianScore: median,
      q1Score: q1,
      q3Score: q3,
      totalCombinations: results.length,
      totalTests: results.reduce((sum, r) => sum + r.totalTests, 0),
      averageConfidence: results.reduce((sum, r) => sum + r.detailedMetrics.confidence, 0) / results.length,
      crossValidationMean: avgCVMean,
      crossValidationStd: avgCVStd,
      bestCVScore: Math.max(...cvMeans),
      worstCVScore: Math.min(...cvMeans)
    };
  }

  async validateConfiguration(config: ProductionTestConfiguration): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (config.trainingRatio + config.validationRatio + config.testingRatio !== 1) {
      errors.push('Training, validation, and testing ratios must sum to 1');
    }

    if (config.batchSize < 1) errors.push('Batch size must be at least 1');
    if (config.trainingSampleSize < 10) errors.push('Training sample size must be at least 10');
    if (config.testingSampleSize < 5) errors.push('Testing sample size must be at least 5');
    if (config.crossValidationFolds < 2) errors.push('Cross-validation folds must be at least 2');

    // Data quality validation
    if (config.minQueryLength < 1) errors.push('Minimum query length must be at least 1');
    if (config.maxQueryLength <= config.minQueryLength) errors.push('Maximum query length must be greater than minimum');
    if (config.minAnswerLength < 1) errors.push('Minimum answer length must be at least 1');
    if (config.maxAnswerLength <= config.minAnswerLength) errors.push('Maximum answer length must be greater than minimum');

    // Check if metric is supported (BRDR and SQL are supported)
    if (config.metricType !== 'brdr' && config.metricType !== 'sql') {
      errors.push(`Metric '${config.metricType}' not supported. Only 'brdr' and 'sql' are supported.`);
    }

    // Performance warnings for large datasets
    if (config.trainingSampleSize > 100000) {
      warnings.push('Large training sample size may cause memory issues');
    }
    if (config.batchSize > 1000) {
      warnings.push('Large batch size may cause memory issues');
    }
    if (config.crossValidationFolds > 10) {
      warnings.push('High number of cross-validation folds will significantly increase processing time');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}