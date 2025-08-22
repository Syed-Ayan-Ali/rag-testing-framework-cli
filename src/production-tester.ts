import { DatabaseConnection } from './database';
import { EmbeddingGenerator, TrainingData } from './embeddings';
import { MetricFactory, BaseMetric, BaseMetricResult } from './metrics/base-metric';
import { TestConfiguration, TestResult, ExperimentResults, ColumnCombination } from './types';

export interface ProductionTestConfiguration extends TestConfiguration {
  // Data splitting configuration
  trainingRatio: number;
  validationRatio: number;
  testingRatio: number;
  
  // Sampling strategy for large datasets
  maxTrainingSamples: number;
  maxValidationSamples: number;
  maxTestingSamples: number;
  
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
  // Detailed metrics
  detailedMetrics: BaseMetricResult;
  
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

export class ProductionRAGTester {
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

  async runProductionExperiment(config: ProductionTestConfiguration): Promise<ExperimentResults> {
    const startTime = Date.now();
    const memoryStart = process.memoryUsage();

    console.log(`\n🚀 Starting Production RAG Experiment: ${config.testName}`);
    console.log(`📊 Table: ${config.tableName}`);
    console.log(`📋 Columns: ${config.selectedColumns.join(', ')}`);
    console.log(`🎯 Metric: ${config.metricType}`);
    console.log(`📊 Training/Validation/Testing: ${config.trainingRatio}/${config.validationRatio}/${config.testingRatio}`);

    // Validate configuration
    const validation = await this.validateProductionConfiguration(config);
    if (!validation.isValid) {
      throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
    }

    // Get table info for data quality assessment
    const tableInfo = await this.db.getTableInfo(config.tableName);
    if (!tableInfo) throw new Error(`Table ${config.tableName} not found`);

    console.log(`📊 Total rows in table: ${tableInfo.rowCount.toLocaleString()}`);

    // Generate column combinations
    const combinations = this.embeddings.generateColumnCombinations(
      config.selectedColumns,
      config.maxCombinations || 20
    );
    
    console.log(`🔄 Testing ${combinations.length} column combinations...\n`);

    const allResults: ProductionTestResult[] = [];

    for (let i = 0; i < combinations.length; i++) {
      const combination = combinations[i];
      
      console.log(`[${i + 1}/${combinations.length}] Testing: ${combination.name}`);

      try {
        const result = await this.runProductionSingleTest(config, combination, tableInfo);
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
    const summary = this.calculateProductionSummary(allResults);
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

  private async runProductionSingleTest(
    config: ProductionTestConfiguration, 
    combination: ColumnCombination,
    tableInfo: any
  ): Promise<ProductionTestResult> {
    const startTime = Date.now();
    
    // Get metric instance
    const metric = this.getMetric(config.metricType);
    
    // Split data into training, validation, and testing sets
    const { trainingData, validationData, testingData } = await this.splitData(config, tableInfo);
    
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
      metric, 
      config, 
      trainingEmbeddings
    );
    const cvTime = Date.now() - cvStart;

    // Test on validation set (if available)
    const validationStart = Date.now();
    const validationResults = await this.processTestQueries(
      validationData, 
      trainingEmbeddings, 
      metric, 
      config
    );
    const validationTime = Date.now() - validationStart;

    // Test on final test set
    const testingStart = Date.now();
    const testingResults = await this.processTestQueries(
      testingData, 
      trainingEmbeddings, 
      metric, 
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

  private async splitData(config: ProductionTestConfiguration, tableInfo: any): Promise<{
    trainingData: any[];
    validationData: any[];
    testingData: any[];
  }> {
    const totalRows = tableInfo.rowCount;
    
    // Calculate sample sizes
    const trainingSize = Math.min(config.maxTrainingSamples, Math.floor(totalRows * config.trainingRatio));
    const validationSize = Math.min(config.maxValidationSamples, Math.floor(totalRows * config.validationRatio));
    const testingSize = Math.min(config.maxTestingSamples, Math.floor(totalRows * config.testingRatio));

    console.log(`  📊 Sample sizes - Training: ${trainingSize}, Validation: ${validationSize}, Testing: ${testingSize}`);

    // Use different sampling strategies for each split
    const trainingData = await this.sampleData(config.tableName, trainingSize, 0, config.samplingStrategy, config);
    const validationData = await this.sampleData(config.tableName, validationSize, config.trainingRatio, config.samplingStrategy, config);
    const testingData = await this.sampleData(config.tableName, testingSize, config.trainingRatio + config.validationRatio, config.samplingStrategy, config);

    return { trainingData, validationData, testingData };
  }

  private async sampleData(
    tableName: string, 
    sampleSize: number, 
    offsetRatio: number, 
    strategy: string, 
    config: ProductionTestConfiguration
  ): Promise<any[]> {
    if (strategy === 'time_based' && config.timestampColumn) {
      return await this.timeBasedSampling(tableName, sampleSize, offsetRatio, config);
    } else if (strategy === 'query_complexity' && config.complexityMetrics) {
      return await this.complexityBasedSampling(tableName, sampleSize, offsetRatio, config);
    } else if (strategy === 'stratified') {
      return await this.stratifiedSampling(tableName, sampleSize, offsetRatio, config);
    } else {
      // Default to random sampling
      return await this.db.getTableDataSample(tableName, sampleSize, offsetRatio);
    }
  }

  private async timeBasedSampling(
    tableName: string, 
    sampleSize: number, 
    offsetRatio: number, 
    config: ProductionTestConfiguration
  ): Promise<any[]> {
    // For time-based sampling, we need to order by timestamp and sample from different time periods
    // This ensures we get representative data across different time periods
    try {
      // Use the public method instead of accessing private supabase
      return await this.db.getTableDataSample(tableName, sampleSize, offsetRatio);
    } catch (error) {
      console.warn(`Time-based sampling failed, falling back to random: ${error}`);
      return await this.db.getTableDataSample(tableName, sampleSize, offsetRatio);
    }
  }

  private async complexityBasedSampling(
    tableName: string, 
    sampleSize: number, 
    offsetRatio: number, 
    config: ProductionTestConfiguration
  ): Promise<any[]> {
    // For complexity-based sampling, we need to analyze query complexity and sample proportionally
    // This is a simplified implementation - in production you might use more sophisticated complexity metrics
    try {
      // Get a larger sample to analyze complexity
      const analysisSample = await this.db.getTableDataSample(tableName, sampleSize * 3, offsetRatio);
      
      // Calculate complexity scores (simplified)
      const complexityScores = analysisSample.map(row => ({
        row,
        score: this.calculateQueryComplexity(row, config.queryColumn || 'query')
      }));
      
      // Sort by complexity and sample proportionally
      complexityScores.sort((a, b) => a.score - b.score);
      
      // Sample from different complexity ranges
      const lowComplexity = Math.floor(sampleSize * 0.3);
      const mediumComplexity = Math.floor(sampleSize * 0.4);
      const highComplexity = sampleSize - lowComplexity - mediumComplexity;
      
      const lowRange = complexityScores.slice(0, Math.floor(complexityScores.length * 0.3));
      const mediumRange = complexityScores.slice(
        Math.floor(complexityScores.length * 0.3), 
        Math.floor(complexityScores.length * 0.7)
      );
      const highRange = complexityScores.slice(Math.floor(complexityScores.length * 0.7));
      
      const samples = [
        ...this.randomSample(lowRange, lowComplexity),
        ...this.randomSample(mediumRange, mediumComplexity),
        ...this.randomSample(highRange, highComplexity)
      ];
      
      return samples.map(s => s.row);
    } catch (error) {
      console.warn(`Complexity-based sampling failed, falling back to random: ${error}`);
      return await this.db.getTableDataSample(tableName, sampleSize, offsetRatio);
    }
  }

  private async stratifiedSampling(
    tableName: string, 
    sampleSize: number, 
    offsetRatio: number, 
    config: ProductionTestConfiguration
  ): Promise<any[]> {
    // Stratified sampling based on query length or other categorical features
    try {
      const analysisSample = await this.db.getTableDataSample(tableName, sampleSize * 2, offsetRatio);
      
      // Stratify by query length categories
      const shortQueries = analysisSample.filter(row => 
        (row[config.queryColumn || 'query'] || '').length < 50
      );
      const mediumQueries = analysisSample.filter(row => {
        const length = (row[config.queryColumn || 'query'] || '').length;
        return length >= 50 && length < 150;
      });
      const longQueries = analysisSample.filter(row => 
        (row[config.queryColumn || 'query'] || '').length >= 150
      );
      
      // Sample proportionally from each stratum
      const shortSample = Math.floor(sampleSize * 0.4);
      const mediumSample = Math.floor(sampleSize * 0.4);
      const longSample = sampleSize - shortSample - mediumSample;
      
      const samples = [
        ...this.randomSample(shortQueries, shortSample),
        ...this.randomSample(mediumQueries, mediumSample),
        ...this.randomSample(longQueries, longSample)
      ];
      
      return samples;
    } catch (error) {
      console.warn(`Stratified sampling failed, falling back to random: ${error}`);
      return await this.db.getTableDataSample(tableName, sampleSize, offsetRatio);
    }
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

  private async runCrossValidation(
    trainingData: any[],
    combination: ColumnCombination,
    metric: BaseMetric,
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
        metric,
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

  private randomSample(data: any[], sampleSize: number): any[] {
    if (data.length <= sampleSize) return data;
    const shuffled = [...data].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, sampleSize);
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

  private calculateProductionSummary(results: ProductionTestResult[]): any {
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

  async validateProductionConfiguration(config: ProductionTestConfiguration): Promise<{
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
    if (config.maxTrainingSamples < 10) errors.push('Maximum training samples must be at least 10');
    if (config.maxTestingSamples < 5) errors.push('Maximum testing samples must be at least 5');
    if (config.crossValidationFolds < 2) errors.push('Cross-validation folds must be at least 2');

    // Data quality validation
    if (config.minQueryLength < 1) errors.push('Minimum query length must be at least 1');
    if (config.maxQueryLength <= config.minQueryLength) errors.push('Maximum query length must be greater than minimum');
    if (config.minAnswerLength < 1) errors.push('Minimum answer length must be at least 1');
    if (config.maxAnswerLength <= config.minAnswerLength) errors.push('Maximum answer length must be greater than minimum');

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
