export interface DatabaseConfig {
  url: string;
  anonKey: string;
}

export interface EmbeddingConfig {
  model: 'openai' | 'local' | 'gemini';
  localModel?: string;
  openaiModel?: string;
  openaiApiKey?: string;
  geminiApiKey?: string;
  geminiModel?: string;
}

export interface LLMConfig {
  provider: 'openai' | 'gemini' | 'anthropic' | 'custom';
  apiKey: string;
  model: string;
  endpoint?: string; // For custom OpenAI-compatible APIs
  customModel?: string; // For custom model like Qwen/Qwen3-235B-A22B
  customApiKey?: string; // For custom API key
  customEndpoint?: string; // For custom endpoint
}

export interface EmbeddingTask {
  tableName: string;
  columns: string[];
  customOrder?: boolean;
  embeddingColumn: string;
  batchSize: number;
}

export interface ColumnPopulationTask {
  tableName: string;
  sourceColumn: string;
  targetColumn: string;
  llmProvider: LLMConfig;
  prompt: string;
  batchSize: number;
}

export interface ColumnCombination {
  columns: string[];
  name: string;
}

export interface TestConfiguration {
  tableName: string;
  selectedColumns: string[];
  queryColumn: string;
  answerColumn: string;
  embeddingConfig: EmbeddingConfig;
  metricType: 'similarity' | 'brdr' | 'sql';
  trainingRatio: number;
  testName: string;
  seed?: number; // Optional seed for reproducible data splitting
}

export interface TestResult {
  combination: ColumnCombination;
  averageScore: number;
  totalTests: number;
  processingTime: number;
  embeddingStats: {
    trainingEmbeddings: number;
    testQueries: number;
    averageSimilarity: number;
  };
}

export interface ExperimentResults {
  testName: string;
  timestamp: Date;
  configuration: TestConfiguration;
  allResults: TestResult[];
  summary: {
    bestCombination: ColumnCombination;
    bestScore: number;
    worstCombination: ColumnCombination;
    worstScore: number;
    averageScore: number;
    totalCombinations: number;
  };
  processingTime: number;
}

export interface CLIConfig {
  database: DatabaseConfig;
  embedding: EmbeddingConfig;
  outputPath?: string;
}

export interface TableInfo {
  name: string;
  columns: Array<{
    column_name: string;
    data_type: string;
    is_nullable: boolean;
  }>;
  rowCount: number;
}
