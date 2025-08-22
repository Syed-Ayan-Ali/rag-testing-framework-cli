import { DatabaseConnection } from './database';
import { EmbeddingGenerator, TrainingData } from './embeddings';
import { MetricFactory, BaseMetric, BaseMetricResult } from './metrics/base-metric';
import { TestConfiguration, TestResult, ExperimentResults, ColumnCombination } from './types';

export interface EnhancedTestConfiguration extends TestConfiguration {
  batchSize: number;
  maxTrainingSamples: number;
  maxTestingSamples: number;
  enableCaching: boolean;
  crossValidationFolds?: number;
  dataSamplingStrategy: 'random' | 'stratified' | 'sequential';
}

export interface EnhancedTestResult extends TestResult {
  detailedMetrics: BaseMetricResult;
  crossValidationScores?: number[];
  confidenceInterval?: { lower: number; upper: number };
  processingStats: {
    trainingTime: number;
    testingTime: number;
    embeddingTime: number;
    memoryUsage: number;
  };
}

export class EnhancedRAGTester {
  private db: DatabaseConnection;
  private embeddings: EmbeddingGenerator;
  private metricCache = new Map<string, BaseMetric>();
  private embeddingCache = new Map<string, number[][]>();

  constructor(
    dbConnection: DatabaseConnection,
    embeddingGenerator: EmbeddingGenerator
  ) {
    this.db = dbConnection;
    this.embeddings = embeddingGenerator;
  }

  async initialize(): Promise<void> {
    await this.embeddings.initialize();
  }

  async runEnhancedExperiment(config: EnhancedTestConfiguration): Promise<ExperimentResults> {
    const startTime = Date.now();
    const memoryStart = process.memoryUsage();

    console.log(`\n🧪 Starting Enhanced RAG Experiment: ${config.testName}`);
    console.log(`📊 Table: ${config.tableName}`);
    console.log(`📋 Columns: ${config.selectedColumns.join(', ')}`);
    console.log(`🎯 Metric: ${config.metricType}`);
    console.log(`📦 Batch Size: ${config.batchSize}`);
    console.log(`📊 Max Training Samples: ${config.maxTrainingSamples}`);
    console.log(`🧪 Max Testing Samples: ${config.maxTestingSamples}`);

    // Validate configuration
    const validation = await this.validateEnhancedConfiguration(config);
    if (!validation.isValid) {
      throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
    }

    // Generate column combinations
    const combinations = this.embeddings.generateColumnCombinations(
      config.selectedColumns,
      config.maxCombinations || 20
    );
    
    console.log(`🔄 Testing ${combinations.length} column combinations...\n`);

    const allResults: EnhancedTestResult[] = [];

    for (let i = 0; i < combinations.length; i++) {
      const combination = combinations[i];
      
      console.log(`[${i + 1}/${combinations.length}] Testing: ${combination.name}`);

      try {
        const result = await this.runEnhancedSingleTest(config, combination);
        allResults.push(result);
        
        console.log(`  ✅ Score: ${result.averageScore.toFixed(3)} (${result.totalTests} tests)`);
        console.log(`  📊 Confidence: ${result.detailedMetrics.confidence.toFixed(3)}`);
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
    const summary = this.calculateEnhancedSummary(allResults);
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

  private async runEnhancedSingleTest(
    config: EnhancedTestConfiguration, 
    combination: ColumnCombination
  ): Promise<EnhancedTestResult> {
    const startTime = Date.now();
    
    // Get metric instance
    const metric = this.getMetric(config.metricType);
    
    // Fetch data in batches for large datasets
    const trainingData = await this.getTrainingData(config, combination);
    const testingData = await this.getTestingData(config, combination);

    if (trainingData.length === 0 || testingData.length === 0) {
      throw new Error('Insufficient data for training or testing');
    }

    // Generate embeddings for training data (with caching)
    const trainingStart = Date.now();
    const trainingEmbeddings = await this.generateTrainingEmbeddings(trainingData, combination, config);
    const trainingTime = Date.now() - trainingStart;

    // Process test queries in batches
    const testingStart = Date.now();
    const results = await this.processTestQueries(
      testingData, 
      trainingEmbeddings, 
      metric, 
      config
    );
    const testingTime = Date.now() - testingStart;

    if (results.length === 0) {
      throw new Error('No valid test results generated');
    }

    // Calculate enhanced metrics
    const averageScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
    const averageSimilarity = results.reduce((sum, r) => sum + r.similarity, 0) / results.length;

    // Calculate confidence interval
    const scores = results.map(r => r.score);
    const confidenceInterval = this.calculateConfidenceInterval(scores);

    const totalTime = Date.now() - startTime;

    return {
      combination,
      averageScore,
      totalTests: results.length,
      processingTime: totalTime,
      detailedMetrics: results[0].detailedMetrics, // Use first result as representative
      confidenceInterval,
      processingStats: {
        trainingTime,
        testingTime,
        embeddingTime: trainingTime,
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024
      },
      embeddingStats: {
        trainingEmbeddings: trainingEmbeddings.embeddings.length,
        testQueries: results.length,
        averageSimilarity
      }
    };
  }

  private async getTrainingData(config: EnhancedTestConfiguration, combination: ColumnCombination): Promise<any[]> {
    // Get total row count
    const tableInfo = await this.db.getTableInfo(config.tableName);
    if (!tableInfo) throw new Error(`Table ${config.tableName} not found`);

    // Calculate sample size for training
    const sampleSize = Math.min(config.maxTrainingSamples, Math.floor(tableInfo.rowCount * config.trainingRatio));
    
    // Use efficient sampling for large datasets
    if (tableInfo.rowCount > 100000) {
      return await this.db.getTableDataSample(config.tableName, sampleSize, config.trainingRatio);
    } else {
      const allData = await this.db.getTableData(config.tableName);
      return this.sampleData(allData, sampleSize, config.dataSamplingStrategy);
    }
  }

  private async getTestingData(config: EnhancedTestConfiguration, combination: ColumnCombination): Promise<any[]> {
    const tableInfo = await this.db.getTableInfo(config.tableName);
    if (!tableInfo) throw new Error(`Table ${config.tableName} not found`);

    const sampleSize = Math.min(config.maxTestingSamples, Math.floor(tableInfo.rowCount * (1 - config.trainingRatio)));
    
    if (tableInfo.rowCount > 100000) {
      return await this.db.getTableDataSample(config.tableName, sampleSize, 1 - config.trainingRatio);
    } else {
      const allData = await this.db.getTableData(config.tableName);
      return this.sampleData(allData, sampleSize, config.dataSamplingStrategy);
    }
  }

  private async generateTrainingEmbeddings(
    trainingData: any[], 
    combination: ColumnCombination, 
    config: EnhancedTestConfiguration
  ): Promise<TrainingData> {
    const cacheKey = `${combination.name}_${trainingData.length}`;
    
    if (config.enableCaching && this.embeddingCache.has(cacheKey)) {
      console.log(`  💾 Using cached embeddings for ${combination.name}`);
      const cachedEmbeddings = this.embeddingCache.get(cacheKey)!;
      return {
        embeddings: cachedEmbeddings.map((embedding, index) => ({
          id: `cached_${index}`,
          combination,
          embedding,
          context: trainingData[index] ? this.combineColumns(trainingData[index], combination.columns) : '',
          targetValue: trainingData[index]?.[config.answerColumn] || '',
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
    metric: BaseMetric,
    config: EnhancedTestConfiguration
  ): Promise<any[]> {
    const results: any[] = [];
    const batchSize = config.batchSize;

    for (let i = 0; i < testingData.length; i += batchSize) {
      const batch = testingData.slice(i, i + batchSize);
      
      for (const testRow of batch) {
        const query = testRow[config.queryColumn];
        const expectedAnswer = testRow[config.answerColumn];

        if (!query || !expectedAnswer) continue;

        try {
          // Find best match from training data
          const matches = await this.embeddings.processQuery(
            query,
            trainingEmbeddings,
            1
          );

          if (matches.length === 0) continue;

          const bestMatch = matches[0];
          const actualAnswer = bestMatch.result.targetValue;

          // Calculate metric
          const detailedMetrics = metric.calculate(expectedAnswer, actualAnswer, bestMatch.similarity);

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

  private getMetric(metricType: string): BaseMetric {
    if (!this.metricCache.has(metricType)) {
      const metric = MetricFactory.getMetric(metricType);
      this.metricCache.set(metricType, metric);
    }
    return this.metricCache.get(metricType)!;
  }

  private sampleData(data: any[], sampleSize: number, strategy: string): any[] {
    if (data.length <= sampleSize) return data;

    switch (strategy) {
      case 'random':
        return this.randomSample(data, sampleSize);
      case 'stratified':
        return this.stratifiedSample(data, sampleSize);
      case 'sequential':
        return this.sequentialSample(data, sampleSize);
      default:
        return this.randomSample(data, sampleSize);
    }
  }

  private randomSample(data: any[], sampleSize: number): any[] {
    const shuffled = [...data].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, sampleSize);
  }

  private stratifiedSample(data: any[], sampleSize: number): any[] {
    // Simple stratification - split by data length and sample proportionally
    const sorted = [...data].sort((a, b) => a.length - b.length);
    const chunkSize = Math.ceil(data.length / 10);
    const samples: any[] = [];

    for (let i = 0; i < 10 && samples.length < sampleSize; i++) {
      const chunk = sorted.slice(i * chunkSize, (i + 1) * chunkSize);
      const chunkSampleSize = Math.ceil((chunk.length / data.length) * sampleSize);
      const chunkSamples = this.randomSample(chunk, Math.min(chunkSampleSize, sampleSize - samples.length));
      samples.push(...chunkSamples);
    }

    return samples.slice(0, sampleSize);
  }

  private sequentialSample(data: any[], sampleSize: number): any[] {
    const step = Math.floor(data.length / sampleSize);
    const samples: any[] = [];
    
    for (let i = 0; i < sampleSize && i * step < data.length; i++) {
      samples.push(data[i * step]);
    }
    
    return samples;
  }

  private combineColumns(row: any, columns: string[]): string {
    return columns
      .map(col => row[col])
      .filter(val => val !== null && val !== undefined)
      .join(' [SEP] ');
  }

  private calculateConfidenceInterval(scores: number[], confidenceLevel: number = 0.95): { lower: number; upper: number } {
    if (scores.length < 2) return { lower: scores[0] || 0, upper: scores[0] || 0 };

    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / (scores.length - 1);
    const standardError = Math.sqrt(variance / scores.length);
    
    // Simple t-distribution approximation for 95% confidence
    const tValue = 1.96; // Approximate for large samples
    
    return {
      lower: Math.max(0, mean - tValue * standardError),
      upper: Math.min(1, mean + tValue * standardError)
    };
  }

  private calculateEnhancedSummary(results: EnhancedTestResult[]): any {
    const scores = results.map(r => r.averageScore);
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
      averageConfidence: results.reduce((sum, r) => sum + r.detailedMetrics.confidence, 0) / results.length
    };
  }

  async validateEnhancedConfiguration(config: EnhancedTestConfiguration): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (config.batchSize < 1) errors.push('Batch size must be at least 1');
    if (config.maxTrainingSamples < 10) errors.push('Maximum training samples must be at least 10');
    if (config.maxTestingSamples < 5) errors.push('Maximum testing samples must be at least 5');

    // Check if metric exists
    try {
      MetricFactory.getMetric(config.metricType);
    } catch (error) {
      errors.push(`Metric '${config.metricType}' not found`);
    }

    // Performance warnings for large datasets
    if (config.maxTrainingSamples > 100000) {
      warnings.push('Large training sample size may cause memory issues');
    }
    if (config.batchSize > 1000) {
      warnings.push('Large batch size may cause memory issues');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}
