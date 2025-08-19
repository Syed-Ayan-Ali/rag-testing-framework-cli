import { EmbeddingConfig, ColumnCombination } from './types';


export interface EmbeddingResult {
  id: string;
  combination: ColumnCombination;
  embedding: number[];
  context: string;
  targetValue: any;
  metadata: Record<string, any>;
}

export interface TrainingData {
  embeddings: EmbeddingResult[];
  combination: ColumnCombination;
  totalRows: number;
}

export class EmbeddingGenerator {
  private config: EmbeddingConfig;
  private embeddingPipeline: any = null;

  constructor(config: EmbeddingConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    try {
      const { pipeline } = await import('@xenova/transformers');
      this.embeddingPipeline = await pipeline(
        'feature-extraction',
        this.config.localModel || 'Xenova/all-MiniLM-L6-v2'
      );
    } catch (error) {
      console.error('Failed to initialize embedding model:', error);
      throw error;
    }
  }

  generateColumnCombinations(columns: string[], maxCombinations: number = 20): ColumnCombination[] {
    const combinations: ColumnCombination[] = [];
    const n = Math.min(columns.length, 5); // Limit to 5 columns max

    // Generate all possible combinations from 1 to n columns
    for (let i = 1; i <= n; i++) {
      const combos = this.getCombinations(columns.slice(0, n), i);
      combos.forEach(combo => {
        if (combinations.length < maxCombinations) {
          combinations.push({
            columns: combo,
            name: combo.join(' + ')
          });
        }
      });
      
      if (combinations.length >= maxCombinations) break;
    }

    return combinations;
  }

  private getCombinations(arr: string[], k: number): string[][] {
    if (k === 1) return arr.map(item => [item]);
    if (k === arr.length) return [arr];

    const combinations: string[][] = [];
    
    for (let i = 0; i <= arr.length - k; i++) {
      const head = arr[i];
      const tailCombos = this.getCombinations(arr.slice(i + 1), k - 1);
      tailCombos.forEach(combo => {
        combinations.push([head, ...combo]);
      });
    }

    return combinations;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      if (!this.embeddingPipeline) {
        throw new Error('Embedding pipeline not initialized');
      }
      
      const result = await this.embeddingPipeline(text);
      // Convert to flat array if needed
      return Array.isArray(result.data) ? result.data : Array.from(result.data);
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      throw error;
    }
  }

  createContext(row: Record<string, any>, combination: ColumnCombination): string {
    const contextParts = combination.columns
      .filter(col => row[col] !== null && row[col] !== undefined)
      .map(col => {
        const value = row[col];
        return `${col}: ${typeof value === 'object' ? JSON.stringify(value) : value}`;
      });

    return contextParts.join(' | ');
  }

  async processTrainingData(
    data: Record<string, any>[],
    combination: ColumnCombination,
    targetColumn: string,
    idColumn?: string
  ): Promise<TrainingData> {
    const embeddings: EmbeddingResult[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const context = this.createContext(row, combination);
      
      if (!context.trim()) {
        console.warn(`Skipping row ${i} - no valid context generated`);
        continue;
      }

      try {
        const embedding = await this.generateEmbedding(context);
        
        embeddings.push({
          id: idColumn ? row[idColumn] : `row_${i}`,
          combination,
          embedding,
          context,
          targetValue: row[targetColumn],
          metadata: {
            originalRow: row,
            rowIndex: i
          }
        });

        // Progress logging every 50 rows to reduce noise
        if ((i + 1) % 50 === 0) {
          console.log(`  Processed ${i + 1}/${data.length} rows`);
        }
      } catch (error) {
        console.error(`Failed to process row ${i}:`, error);
        continue;
      }
    }

    return {
      embeddings,
      combination,
      totalRows: data.length
    };
  }

  calculateCosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  async findBestMatch(
    queryEmbedding: number[],
    trainingData: TrainingData,
    topK: number = 1
  ): Promise<{ result: EmbeddingResult; similarity: number }[]> {
    const similarities = trainingData.embeddings.map(item => ({
      result: item,
      similarity: this.calculateCosineSimilarity(queryEmbedding, item.embedding)
    }));

    // Sort by similarity (highest first)
    similarities.sort((a, b) => b.similarity - a.similarity);

    return similarities.slice(0, topK);
  }

  async processQuery(
    query: string,
    trainingData: TrainingData,
    topK: number = 1
  ): Promise<{ result: EmbeddingResult; similarity: number }[]> {
    const queryEmbedding = await this.generateEmbedding(query);
    return this.findBestMatch(queryEmbedding, trainingData, topK);
  }
}
