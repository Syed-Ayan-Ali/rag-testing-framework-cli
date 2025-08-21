import { EmbeddingGenerator, PipelineProvider } from '../../src/embeddings';
import { EmbeddingConfig, ColumnCombination } from '../../src/types';

describe('EmbeddingGenerator', () => {
  let embeddingGenerator: EmbeddingGenerator;
  let mockPipeline: jest.Mock;
  let mockPipelineProvider: jest.Mocked<PipelineProvider>;
  
  const testConfig: EmbeddingConfig = {
    model: 'local',
    localModel: 'Xenova/all-MiniLM-L6-v2-small'
  };

  beforeEach(() => {
    mockPipeline = jest.fn();
    mockPipelineProvider = {
      createPipeline: jest.fn().mockResolvedValue(mockPipeline)
    };
    
    embeddingGenerator = new EmbeddingGenerator(testConfig, mockPipelineProvider);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize the embedding pipeline successfully', async () => {
      await embeddingGenerator.initialize();
      
      expect(mockPipelineProvider.createPipeline).toHaveBeenCalledWith('feature-extraction', 'Xenova/all-MiniLM-L6-v2-small');
    });

    it('should throw error if initialization fails', async () => {
      mockPipelineProvider.createPipeline.mockRejectedValueOnce(new Error('Model loading failed'));

      await expect(embeddingGenerator.initialize()).rejects.toThrow('Model loading failed');
    });

    it('should use default model if none specified', async () => {
      const configWithoutModel: EmbeddingConfig = { model: 'local' };
      const generator = new EmbeddingGenerator(configWithoutModel, mockPipelineProvider);
      
      await generator.initialize();
      
      expect(mockPipelineProvider.createPipeline).toHaveBeenCalledWith('feature-extraction', 'Xenova/all-MiniLM-L6-v2-small');
    });
  });

  describe('generateColumnCombinations', () => {
    it('should generate single column combinations', () => {
      const columns = ['title', 'content'];
      const combinations = embeddingGenerator.generateColumnCombinations(columns, 10);
      
      expect(combinations).toContainEqual({
        columns: ['title'],
        name: 'title'
      });
      expect(combinations).toContainEqual({
        columns: ['content'],
        name: 'content'
      });
    });

    it('should generate multi-column combinations', () => {
      const columns = ['title', 'content', 'category'];
      const combinations = embeddingGenerator.generateColumnCombinations(columns, 10);
      
      expect(combinations).toContainEqual({
        columns: ['title', 'content'],
        name: 'title + content'
      });
      expect(combinations).toContainEqual({
        columns: ['title', 'category'],
        name: 'title + category'
      });
    });

    it('should respect maxCombinations limit', () => {
      const columns = ['a', 'b', 'c', 'd', 'e'];
      const combinations = embeddingGenerator.generateColumnCombinations(columns, 5);
      
      expect(combinations.length).toBeLessThanOrEqual(5);
    });

    it('should limit to maximum 5 columns', () => {
      const columns = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
      const combinations = embeddingGenerator.generateColumnCombinations(columns, 100);
      
      // Should not include combinations with more than 5 columns
      const maxColumnCount = Math.max(...combinations.map(c => c.columns.length));
      expect(maxColumnCount).toBeLessThanOrEqual(5);
    });

    it('should handle empty column array', () => {
      const combinations = embeddingGenerator.generateColumnCombinations([], 10);
      expect(combinations).toHaveLength(0);
    });
  });

  describe('createContext', () => {
    it('should create context from row data and combination', () => {
      const row = {
        title: 'Test Title',
        content: 'Test Content',
        category: 'test'
      };
      const combination: ColumnCombination = {
        columns: ['title', 'content'],
        name: 'title + content'
      };

      const context = embeddingGenerator.createContext(row, combination);
      expect(context).toBe('title: Test Title | content: Test Content');
    });

    it('should handle null and undefined values', () => {
      const row = {
        title: 'Test Title',
        content: null,
        category: undefined,
        tags: 'test-tags'
      };
      const combination: ColumnCombination = {
        columns: ['title', 'content', 'category', 'tags'],
        name: 'all'
      };

      const context = embeddingGenerator.createContext(row, combination);
      expect(context).toBe('title: Test Title | tags: test-tags');
    });

    it('should handle object values by stringifying them', () => {
      const row = {
        title: 'Test',
        metadata: { type: 'document', version: 1 }
      };
      const combination: ColumnCombination = {
        columns: ['title', 'metadata'],
        name: 'title + metadata'
      };

      const context = embeddingGenerator.createContext(row, combination);
      expect(context).toBe('title: Test | metadata: {"type":"document","version":1}');
    });
  });

  describe('generateEmbedding', () => {
    beforeEach(async () => {
      mockPipeline.mockResolvedValue({ data: [0.1, 0.2, 0.3, 0.4, 0.5] });
      await embeddingGenerator.initialize();
    });

    it('should generate embedding for text', async () => {
      const text = 'Test text for embedding';
      const embedding = await embeddingGenerator.generateEmbedding(text);
      
      expect(mockPipeline).toHaveBeenCalledWith(text);
      expect(embedding).toEqual([0.1, 0.2, 0.3, 0.4, 0.5]);
    });

    it('should handle non-array embedding results', async () => {
      const mockResult = {
        data: new Float32Array([0.1, 0.2, 0.3])
      };
      mockPipeline.mockResolvedValue(mockResult);
      
      const embedding = await embeddingGenerator.generateEmbedding('test');
      // Check that it's converted to array and has expected length
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding).toHaveLength(3);
      expect(embedding[0]).toBeCloseTo(0.1, 1);
      expect(embedding[1]).toBeCloseTo(0.2, 1);
      expect(embedding[2]).toBeCloseTo(0.3, 1);
    });

    it('should throw error if pipeline not initialized', async () => {
      const uninitializedGenerator = new EmbeddingGenerator(testConfig, mockPipelineProvider);
      
      await expect(uninitializedGenerator.generateEmbedding('test'))
        .rejects.toThrow('Embedding pipeline not initialized');
    });

    it('should handle pipeline errors', async () => {
      mockPipeline.mockRejectedValue(new Error('Pipeline error'));
      
      await expect(embeddingGenerator.generateEmbedding('test'))
        .rejects.toThrow('Pipeline error');
    });
  });

  describe('calculateCosineSimilarity', () => {
    it('should calculate cosine similarity correctly', () => {
      const vectorA = [1, 0, 0];
      const vectorB = [0, 1, 0];
      const similarity = embeddingGenerator.calculateCosineSimilarity(vectorA, vectorB);
      expect(similarity).toBe(0);
    });

    it('should return 1 for identical vectors', () => {
      const vector = [1, 2, 3];
      const similarity = embeddingGenerator.calculateCosineSimilarity(vector, vector);
      expect(similarity).toBe(1);
    });

    it('should handle zero vectors', () => {
      const vectorA = [0, 0, 0];
      const vectorB = [1, 2, 3];
      const similarity = embeddingGenerator.calculateCosineSimilarity(vectorA, vectorB);
      expect(similarity).toBe(0);
    });

    it('should throw error for different length vectors', () => {
      const vectorA = [1, 2, 3];
      const vectorB = [1, 2];
      
      expect(() => embeddingGenerator.calculateCosineSimilarity(vectorA, vectorB))
        .toThrow('Vectors must have the same length');
    });

    it('should calculate similarity for real embedding vectors', () => {
      const vectorA = [0.5, 0.3, 0.8, 0.1];
      const vectorB = [0.4, 0.6, 0.7, 0.2];
      const similarity = embeddingGenerator.calculateCosineSimilarity(vectorA, vectorB);
      
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });
  });

  describe('processTrainingData', () => {
    const mockData = [
      { id: 1, title: 'Doc 1', content: 'Content 1', answer: 'Answer 1' },
      { id: 2, title: 'Doc 2', content: 'Content 2', answer: 'Answer 2' },
      { id: 3, title: 'Doc 3', content: 'Content 3', answer: 'Answer 3' }
    ];

    const combination: ColumnCombination = {
      columns: ['title', 'content'],
      name: 'title + content'
    };

    beforeEach(async () => {
      mockPipeline.mockResolvedValue({ data: [0.1, 0.2, 0.3, 0.4, 0.5] });
      await embeddingGenerator.initialize();
    });

    it('should process training data successfully', async () => {
      const trainingData = await embeddingGenerator.processTrainingData(
        mockData, 
        combination, 
        'answer'
      );

      expect(trainingData.embeddings).toHaveLength(3);
      expect(trainingData.combination).toEqual(combination);
      expect(trainingData.totalRows).toBe(3);
      
      expect(trainingData.embeddings[0]).toMatchObject({
        id: 'row_0',
        combination,
        embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
        context: 'title: Doc 1 | content: Content 1',
        targetValue: 'Answer 1'
      });
    });

    it('should use custom ID column when provided', async () => {
      const trainingData = await embeddingGenerator.processTrainingData(
        mockData, 
        combination, 
        'answer',
        'id'
      );

      expect(trainingData.embeddings[0].id).toBe(1);
      expect(trainingData.embeddings[1].id).toBe(2);
    });

    it('should skip rows with empty context', async () => {
      const dataWithEmptyRows = [
        { id: 1, title: 'Doc 1', content: 'Content 1', answer: 'Answer 1' },
        { id: 2, title: null, content: null, answer: 'Answer 2' },
        { id: 3, title: 'Doc 3', content: 'Content 3', answer: 'Answer 3' }
      ];

      const trainingData = await embeddingGenerator.processTrainingData(
        dataWithEmptyRows, 
        combination, 
        'answer'
      );

      expect(trainingData.embeddings).toHaveLength(2);
      expect(trainingData.totalRows).toBe(3);
    });

    it('should handle embedding generation errors gracefully', async () => {
      mockPipeline
        .mockResolvedValueOnce({ data: [0.1, 0.2, 0.3] })
        .mockRejectedValueOnce(new Error('Embedding failed'))
        .mockResolvedValueOnce({ data: [0.4, 0.5, 0.6] });

      const trainingData = await embeddingGenerator.processTrainingData(
        mockData, 
        combination, 
        'answer'
      );

      // Should continue processing despite one failure
      expect(trainingData.embeddings).toHaveLength(2);
    });
  });

  describe('processQuery', () => {
    const mockTrainingData = {
      embeddings: [
        {
          id: '1',
          combination: { columns: ['title'], name: 'title' },
          embedding: [0.8, 0.1, 0.1],
          context: 'title: Banking Regulation',
          targetValue: 'Regulation Answer',
          metadata: {}
        },
        {
          id: '2',
          combination: { columns: ['title'], name: 'title' },
          embedding: [0.1, 0.8, 0.1],
          context: 'title: Risk Management',
          targetValue: 'Risk Answer',
          metadata: {}
        }
      ],
      combination: { columns: ['title'], name: 'title' },
      totalRows: 2
    };

    beforeEach(async () => {
      mockPipeline.mockResolvedValue({ data: [0.9, 0.05, 0.05] });
      await embeddingGenerator.initialize();
    });

    it('should find best matching result for query', async () => {
      const results = await embeddingGenerator.processQuery(
        'What about banking regulations?',
        mockTrainingData,
        1
      );

      expect(results).toHaveLength(1);
      expect(results[0].result.targetValue).toBe('Regulation Answer');
      expect(results[0].similarity).toBeGreaterThan(0.9); // High similarity expected
      expect(results[0].similarity).toBeLessThanOrEqual(1);
    });

    it('should return multiple results when requested', async () => {
      const results = await embeddingGenerator.processQuery(
        'What about banking regulations?',
        mockTrainingData,
        2
      );

      expect(results).toHaveLength(2);
      expect(results[0].similarity).toBeGreaterThan(results[1].similarity);
    });

    it('should handle empty training data', async () => {
      const emptyTrainingData = {
        embeddings: [],
        combination: { columns: ['title'], name: 'title' },
        totalRows: 0
      };

      const results = await embeddingGenerator.processQuery(
        'test query',
        emptyTrainingData,
        1
      );

      expect(results).toHaveLength(0);
    });
  });
});
