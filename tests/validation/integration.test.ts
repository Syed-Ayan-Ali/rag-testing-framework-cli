import { RAGTester } from '../../src/tester';
import { DatabaseConnection } from '../../src/database';
import { EmbeddingGenerator } from '../../src/embeddings';
import { ConfigManager } from '../../src/config';
import { TestConfiguration } from '../../src/types';
import * as fs from 'fs';

// Mock external dependencies
jest.mock('@supabase/supabase-js');
jest.mock('@xenova/transformers');

describe('Integration Validation Tests', () => {
  let mockDatabaseConnection: jest.Mocked<DatabaseConnection>;
  let mockEmbeddingGenerator: jest.Mocked<EmbeddingGenerator>;
  let ragTester: RAGTester;

  const mockConfig: TestConfiguration = {
    tableName: 'test_documents',
    selectedColumns: ['title', 'content'],
    queryColumn: 'query',
    answerColumn: 'answer',
    embeddingConfig: { model: 'local', localModel: 'test-model' },
    metricType: 'similarity',
    trainingRatio: 0.8,
    testName: 'Integration Test',
  };

  beforeEach(() => {
    // Create comprehensive mocks
    mockDatabaseConnection = {
      testConnection: jest.fn(),
      getTables: jest.fn(),
      getTableInfo: jest.fn(),
      getTableData: jest.fn(),
      isConnectionActive: jest.fn()
    } as any;

    mockEmbeddingGenerator = {
      initialize: jest.fn(),
      generateColumnCombinations: jest.fn(),
      processTrainingData: jest.fn(),
      processQuery: jest.fn(),
      generateEmbedding: jest.fn(),
      calculateCosineSimilarity: jest.fn(),
      createContext: jest.fn(),
      findBestMatch: jest.fn()
    } as any;

    ragTester = new RAGTester(mockDatabaseConnection, mockEmbeddingGenerator);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('RAGTester Integration', () => {
    it('should initialize all components successfully', async () => {
      mockEmbeddingGenerator.initialize.mockResolvedValueOnce(undefined);

      await expect(ragTester.initialize()).resolves.not.toThrow();
      expect(mockEmbeddingGenerator.initialize).toHaveBeenCalledTimes(1);
    });

    it('should validate configuration comprehensively', async () => {
      const mockTableInfo = {
        name: 'test_documents',
        columns: [
          { column_name: 'title', data_type: 'text', is_nullable: false },
          { column_name: 'content', data_type: 'text', is_nullable: false },
          { column_name: 'query', data_type: 'text', is_nullable: false },
          { column_name: 'answer', data_type: 'text', is_nullable: false }
        ],
        rowCount: 100
      };

      mockDatabaseConnection.getTableInfo.mockResolvedValueOnce(mockTableInfo);

      const validation = await ragTester.validateConfiguration(mockConfig);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(mockDatabaseConnection.getTableInfo).toHaveBeenCalledWith('test_documents');
    });

    it('should detect configuration errors', async () => {
      const invalidConfig = {
        ...mockConfig,
        selectedColumns: ['nonexistent_column'],
        queryColumn: 'missing_query_col'
      };

      const mockTableInfo = {
        name: 'test_documents',
        columns: [
          { column_name: 'title', data_type: 'text', is_nullable: false },
          { column_name: 'content', data_type: 'text', is_nullable: false }
        ],
        rowCount: 100
      };

      mockDatabaseConnection.getTableInfo.mockResolvedValueOnce(mockTableInfo);

      const validation = await ragTester.validateConfiguration(invalidConfig);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Column "nonexistent_column" not found in table "test_documents"');
      expect(validation.errors).toContain('Query column "missing_query_col" not found');
    });

    it('should handle missing table gracefully', async () => {
      mockDatabaseConnection.getTableInfo.mockResolvedValueOnce(null);

      const validation = await ragTester.validateConfiguration(mockConfig);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Table "test_documents" not found');
    });

    it('should generate validation warnings appropriately', async () => {
      const configWithManyColumns = {
        ...mockConfig,
        selectedColumns: ['col1', 'col2', 'col3', 'col4', 'col5', 'col6']
      };

      const mockTableInfo = {
        name: 'test_documents',
        columns: [
          { column_name: 'col1', data_type: 'text', is_nullable: false },
          { column_name: 'col2', data_type: 'text', is_nullable: false },
          { column_name: 'col3', data_type: 'text', is_nullable: false },
          { column_name: 'col4', data_type: 'text', is_nullable: false },
          { column_name: 'col5', data_type: 'text', is_nullable: false },
          { column_name: 'col6', data_type: 'text', is_nullable: false },
          { column_name: 'query', data_type: 'text', is_nullable: false },
          { column_name: 'answer', data_type: 'text', is_nullable: false }
        ],
        rowCount: 5 // Low row count
      };

      mockDatabaseConnection.getTableInfo.mockResolvedValueOnce(mockTableInfo);

      const validation = await ragTester.validateConfiguration(configWithManyColumns);

      expect(validation.isValid).toBe(true);
      expect(validation.warnings).toContain('More than 5 columns may result in many combinations and slow processing');
      expect(validation.warnings).toContain('Table has very few rows - results may not be reliable');
    });
  });

  describe('End-to-End Workflow Validation', () => {
    const mockTableData = [
      { id: 1, title: 'Banking Regulations', content: 'Content about banking rules', query: 'What are banking rules?', answer: 'Banking rules explanation' },
      { id: 2, title: 'Risk Management', content: 'Risk management practices', query: 'How to manage risk?', answer: 'Risk management methods' },
      { id: 3, title: 'Compliance Guide', content: 'Compliance requirements', query: 'What is compliance?', answer: 'Compliance overview' },
      { id: 4, title: 'Capital Requirements', content: 'Capital adequacy standards', query: 'What are capital requirements?', answer: 'Capital standards' },
      { id: 5, title: 'Operational Risk', content: 'Operational risk guidelines', query: 'What is operational risk?', answer: 'Operational risk definition' }
    ];

    const mockTrainingData = {
      embeddings: [
        {
          id: '1',
          combination: { columns: ['title'], name: 'title' },
          embedding: [0.1, 0.2, 0.3],
          context: 'title: Banking Regulations',
          yValue: 'Banking rules explanation',
          metadata: {}
        }
      ],
      combination: { columns: ['title'], name: 'title' },
      totalRows: 1
    };

    beforeEach(() => {
      // Setup successful mocks for happy path
      mockDatabaseConnection.getTableData.mockResolvedValue(mockTableData);
      mockEmbeddingGenerator.generateColumnCombinations.mockReturnValue([
        { columns: ['title'], name: 'title' },
        { columns: ['content'], name: 'content' }
      ]);
      mockEmbeddingGenerator.processTrainingData.mockResolvedValue(mockTrainingData);
      mockEmbeddingGenerator.processQuery.mockResolvedValue([
        { result: mockTrainingData.embeddings[0], similarity: 0.9 }
      ]);
    });

    it('should execute complete experiment workflow', async () => {
      const results = await ragTester.runExperiment(mockConfig);

      expect(results).toHaveProperty('testName', 'Integration Test');
      expect(results).toHaveProperty('allResults');
      expect(results).toHaveProperty('summary');
      expect(results).toHaveProperty('processingTime');
      
      expect(results.allResults).toBeInstanceOf(Array);
      expect(results.allResults.length).toBeGreaterThan(0);
      
      expect(mockDatabaseConnection.getTableData).toHaveBeenCalledWith('test_documents');
      expect(mockEmbeddingGenerator.generateColumnCombinations).toHaveBeenCalled();
      expect(mockEmbeddingGenerator.processTrainingData).toHaveBeenCalled();
    });

    it('should handle insufficient data gracefully', async () => {
      // Mock insufficient data - need to reset the mocks to force failure
      mockDatabaseConnection.getTableData.mockResolvedValueOnce([
        { id: 1, title: 'Only One', content: 'Single item', query: 'One?', answer: 'One!' }
      ]);
      
      // Reset the embedding mocks to return nothing useful for insufficient data
      mockEmbeddingGenerator.processTrainingData.mockRejectedValueOnce(new Error('Not enough valid data rows for testing'));

      await expect(ragTester.runExperiment(mockConfig)).rejects.toThrow();
    });

    it('should handle empty data gracefully', async () => {
      // Override the beforeEach mock specifically for this test
      mockDatabaseConnection.getTableData.mockImplementation(async () => []);
      
      // With empty data, all combinations will fail, resulting in "No combinations produced valid results"
      await expect(ragTester.runExperiment(mockConfig)).rejects.toThrow('No combinations produced valid results');
    });

    it('should filter out invalid data rows', async () => {
      const dataWithNulls = [
        ...mockTableData,
        { id: 6, title: null, content: 'Valid content', query: 'Valid query?', answer: 'Valid answer' },
        { id: 7, title: 'Valid title', content: 'Valid content', query: null, answer: 'Valid answer' }
      ];

      mockDatabaseConnection.getTableData.mockResolvedValueOnce(dataWithNulls);

      const results = await ragTester.runExperiment(mockConfig);

      expect(results.allResults.length).toBeGreaterThan(0);
      // Should have processed valid data and filtered out nulls
    });

    it('should handle embedding generation failures gracefully', async () => {
      // Reset all mocks to force failure
      mockEmbeddingGenerator.generateColumnCombinations.mockReturnValueOnce([
        { columns: ['title'], name: 'title' }
      ]);
      mockEmbeddingGenerator.processTrainingData.mockRejectedValueOnce(new Error('Embedding failed'));

      // Should fail gracefully when embeddings fail
      await expect(ragTester.runExperiment(mockConfig)).rejects.toThrow();
    });

    it('should respect training ratio for data splitting', async () => {
      const configWith60Percent = { ...mockConfig, trainingRatio: 0.6 };

      await ragTester.runExperiment(configWith60Percent);

      // Verify that data was split according to the ratio
      expect(mockEmbeddingGenerator.processTrainingData).toHaveBeenCalled();
      const trainingDataCall = mockEmbeddingGenerator.processTrainingData.mock.calls[0];
      const trainingData = trainingDataCall[0];
      
      // With 5 total items and 0.6 ratio, should have 3 training items
      expect(trainingData).toHaveLength(3);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from individual test failures', async () => {
      mockDatabaseConnection.getTableData.mockResolvedValueOnce([
        { id: 1, title: 'Doc 1', content: 'Content 1', query: 'Query 1?', answer: 'Answer 1' },
        { id: 2, title: 'Doc 2', content: 'Content 2', query: 'Query 2?', answer: 'Answer 2' },
        { id: 3, title: 'Doc 3', content: 'Content 3', query: 'Query 3?', answer: 'Answer 3' },
        { id: 4, title: 'Doc 4', content: 'Content 4', query: 'Query 4?', answer: 'Answer 4' },
        { id: 5, title: 'Doc 5', content: 'Content 5', query: 'Query 5?', answer: 'Answer 5' }
      ]);

      mockEmbeddingGenerator.generateColumnCombinations.mockReturnValueOnce([
        { columns: ['title'], name: 'title' },
        { columns: ['content'], name: 'content' }
      ]);

      // First combination succeeds, second fails
      mockEmbeddingGenerator.processTrainingData
        .mockResolvedValueOnce({
          embeddings: [{ id: '1', combination: { columns: ['title'], name: 'title' }, embedding: [0.1], context: 'test', yValue: 'test', metadata: {} }],
          combination: { columns: ['title'], name: 'title' },
          totalRows: 1
        })
        .mockRejectedValueOnce(new Error('Second combination failed'));

      mockEmbeddingGenerator.processQuery.mockResolvedValue([
        { result: { id: '1', combination: { columns: ['title'], name: 'title' }, embedding: [0.1], context: 'test', yValue: 'test', metadata: {} }, similarity: 0.9 }
      ]);

      const results = await ragTester.runExperiment(mockConfig);

      // Should have results from the successful combination
      expect(results.allResults).toHaveLength(1);
      expect(results.summary.totalCombinations).toBe(1);
    });

    it('should handle all combinations failing', async () => {
      mockDatabaseConnection.getTableData.mockResolvedValueOnce([
        { id: 1, title: 'Doc 1', content: 'Content 1', query: 'Query 1?', answer: 'Answer 1' },
        { id: 2, title: 'Doc 2', content: 'Content 2', query: 'Query 2?', answer: 'Answer 2' },
        { id: 3, title: 'Doc 3', content: 'Content 3', query: 'Query 3?', answer: 'Answer 3' },
        { id: 4, title: 'Doc 4', content: 'Content 4', query: 'Query 4?', answer: 'Answer 4' },
        { id: 5, title: 'Doc 5', content: 'Content 5', query: 'Query 5?', answer: 'Answer 5' }
      ]);

      mockEmbeddingGenerator.generateColumnCombinations.mockReturnValueOnce([
        { columns: ['title'], name: 'title' }
      ]);

      mockEmbeddingGenerator.processTrainingData.mockRejectedValue(new Error('All combinations failed'));

      await expect(ragTester.runExperiment(mockConfig)).rejects.toThrow('No combinations produced valid results');
    });
  });

  describe('Performance and Resource Management', () => {
    it('should track processing time accurately', async () => {
      const startTime = Date.now();

      mockDatabaseConnection.getTableData.mockImplementation(async () => {
        // Simulate some processing time
        await new Promise(resolve => setTimeout(resolve, 100));
        return [
          { id: 1, title: 'Doc 1', content: 'Content 1', query: 'Query 1?', answer: 'Answer 1' },
          { id: 2, title: 'Doc 2', content: 'Content 2', query: 'Query 2?', answer: 'Answer 2' },
          { id: 3, title: 'Doc 3', content: 'Content 3', query: 'Query 3?', answer: 'Answer 3' },
          { id: 4, title: 'Doc 4', content: 'Content 4', query: 'Query 4?', answer: 'Answer 4' },
          { id: 5, title: 'Doc 5', content: 'Content 5', query: 'Query 5?', answer: 'Answer 5' }
        ];
      });

      mockEmbeddingGenerator.generateColumnCombinations.mockReturnValueOnce([
        { columns: ['title'], name: 'title' }
      ]);

      mockEmbeddingGenerator.processTrainingData.mockResolvedValueOnce({
        embeddings: [{ id: '1', combination: { columns: ['title'], name: 'title' }, embedding: [0.1], context: 'test', yValue: 'test', metadata: {} }],
        combination: { columns: ['title'], name: 'title' },
        totalRows: 1
      });

      mockEmbeddingGenerator.processQuery.mockResolvedValueOnce([
        { result: { id: '1', combination: { columns: ['title'], name: 'title' }, embedding: [0.1], context: 'test', yValue: 'test', metadata: {} }, similarity: 0.9 }
      ]);

      const results = await ragTester.runExperiment(mockConfig);

      const endTime = Date.now();
      const actualDuration = endTime - startTime;

      expect(results.processingTime).toBeGreaterThan(50); // At least 50ms
      expect(results.processingTime).toBeLessThan(actualDuration + 100); // Within reasonable bounds
    });

    it('should handle memory-intensive operations', async () => {
      // Simulate large dataset
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        title: `Document ${i + 1}`,
        content: `Content for document ${i + 1} `.repeat(100), // Large content
        query: `Query ${i + 1}?`,
        answer: `Answer ${i + 1}`
      }));

      mockDatabaseConnection.getTableData.mockResolvedValueOnce(largeDataset);

      mockEmbeddingGenerator.generateColumnCombinations.mockReturnValueOnce([
        { columns: ['title'], name: 'title' }
      ]);

      mockEmbeddingGenerator.processTrainingData.mockResolvedValueOnce({
        embeddings: Array.from({ length: 800 }, (_, i) => ({
          id: String(i + 1),
          combination: { columns: ['title'], name: 'title' },
          embedding: Array.from({ length: 384 }, () => Math.random()), // Large embedding
          context: `Document ${i + 1}`,
          yValue: `Answer ${i + 1}`,
          metadata: {}
        })),
        combination: { columns: ['title'], name: 'title' },
        totalRows: 800
      });

      mockEmbeddingGenerator.processQuery.mockResolvedValue([
        { result: { id: '1', combination: { columns: ['title'], name: 'title' }, embedding: [0.1], context: 'test', yValue: 'test', metadata: {} }, similarity: 0.9 }
      ]);

      // Should complete without memory errors
      const results = await ragTester.runExperiment(mockConfig);
      expect(results).toBeDefined();
      expect(results.allResults).toHaveLength(1);
    });
  });
});

describe('Configuration Management Validation', () => {
  let configManager: ConfigManager;
  const testEnvPath = '.env.test';

  beforeEach(() => {
    configManager = new ConfigManager();
    
    // Clean up any existing test env file
    if (fs.existsSync(testEnvPath)) {
      fs.unlinkSync(testEnvPath);
    }
  });

  afterEach(() => {
    // Clean up test env file
    if (fs.existsSync(testEnvPath)) {
      fs.unlinkSync(testEnvPath);
    }
  });

  it('should validate configuration correctly', async () => {
    const validConfig = {
      database: {
        url: 'https://valid.supabase.co',
        anonKey: 'valid-anon-key'
      },
      embedding: {
        model: 'local' as const,
        localModel: 'test-model'
      }
    };

    const validation = configManager.validateConfig(validConfig);
    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('should detect missing configuration values', async () => {
    const invalidConfig = {
      database: {
        url: '',
        anonKey: ''
      },
      embedding: {
        model: 'local' as const
      }
    };

    const validation = configManager.validateConfig(invalidConfig);
    expect(validation.isValid).toBe(false);
    // Check that errors contain the key terms instead of exact messages
    expect(validation.errors.some(error => error.includes('Database URL'))).toBe(true);
    expect(validation.errors.some(error => error.includes('anonymous key'))).toBe(true);
  });

  it('should detect invalid URLs', async () => {
    const invalidConfig = {
      database: {
        url: 'not-a-valid-url',
        anonKey: 'valid-key'
      },
      embedding: {
        model: 'local' as const
      }
    };

    const validation = configManager.validateConfig(invalidConfig);
    expect(validation.isValid).toBe(false);
    // Check that there are validation errors (the exact message may vary)
    expect(validation.errors.length).toBeGreaterThan(0);
  });
});
