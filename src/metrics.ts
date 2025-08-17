// Simple similarity-based metric calculator
export interface SimilarityMetricResult {
  overallScore: number;
  similarity: number;
  exactMatch: boolean;
  normalizedSimilarity: number;
}

// BRDR-specific lightweight metric
export interface BRDRMetricResult {
  overallScore: number;
  keywordMatch: number;
  conceptMatch: number;
  contextualRelevance: number;
}

export class SimilarityMetric {
  calculate(expected: string, actual: string, similarity: number): SimilarityMetricResult {
    const exactMatch = expected.toLowerCase().trim() === actual.toLowerCase().trim();
    
    // Normalize similarity score (assuming cosine similarity range -1 to 1)
    const normalizedSimilarity = Math.max(0, (similarity + 1) / 2);
    
    // Overall score combines exact match bonus with similarity
    const overallScore = exactMatch ? 1.0 : normalizedSimilarity * 0.9;
    
    return {
      overallScore: Math.min(1.0, Math.max(0, overallScore)),
      similarity,
      exactMatch,
      normalizedSimilarity
    };
  }
}

export class BRDRMetric {
  private readonly bankingKeywords = [
    'risk', 'capital', 'compliance', 'regulation', 'supervision', 'governance',
    'asset', 'liability', 'liquidity', 'credit', 'operational', 'market',
    'basel', 'stress', 'scenario', 'framework', 'guideline', 'standard'
  ];

  private readonly conceptTerms = [
    'management', 'assessment', 'monitoring', 'reporting', 'measurement',
    'control', 'process', 'procedure', 'methodology', 'approach',
    'requirement', 'obligation', 'responsibility', 'accountability'
  ];

  calculate(expected: string, actual: string, similarity: number): BRDRMetricResult {
    const expectedLower = expected.toLowerCase();
    const actualLower = actual.toLowerCase();
    
    // Calculate keyword overlap
    const expectedKeywords = this.extractKeywords(expectedLower);
    const actualKeywords = this.extractKeywords(actualLower);
    const keywordMatch = this.calculateOverlap(expectedKeywords, actualKeywords);
    
    // Calculate concept overlap
    const expectedConcepts = this.extractConcepts(expectedLower);
    const actualConcepts = this.extractConcepts(actualLower);
    const conceptMatch = this.calculateOverlap(expectedConcepts, actualConcepts);
    
    // Use embedding similarity as contextual relevance
    const contextualRelevance = Math.max(0, (similarity + 1) / 2);
    
    // Weighted combination
    const overallScore = (
      keywordMatch * 0.3 +
      conceptMatch * 0.3 +
      contextualRelevance * 0.4
    );
    
    return {
      overallScore: Math.min(1.0, Math.max(0, overallScore)),
      keywordMatch,
      conceptMatch,
      contextualRelevance
    };
  }

  private extractKeywords(text: string): string[] {
    return this.bankingKeywords.filter(keyword => 
      text.includes(keyword)
    );
  }

  private extractConcepts(text: string): string[] {
    return this.conceptTerms.filter(concept => 
      text.includes(concept)
    );
  }

  private calculateOverlap(expected: string[], actual: string[]): number {
    if (expected.length === 0 && actual.length === 0) return 1.0;
    if (expected.length === 0 || actual.length === 0) return 0.0;
    
    const expectedSet = new Set(expected);
    const actualSet = new Set(actual);
    const intersection = new Set([...expectedSet].filter(x => actualSet.has(x)));
    const union = new Set([...expectedSet, ...actualSet]);
    
    return intersection.size / union.size;
  }
}
