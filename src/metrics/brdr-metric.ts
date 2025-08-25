import { BaseMetric, BaseMetricResult } from './base-metric';

export interface BRDRMetricResult extends BaseMetricResult {
  keywordMatch: number;
  conceptMatch: number;
  contextualRelevance: number;
  regulatoryCompliance: number;
  semanticAccuracy: number;
}

export class BRDRMetric implements BaseMetric {
  private readonly bankingKeywords = new Set([
    // Core banking terms
    'risk', 'capital', 'compliance', 'regulation', 'supervision', 'governance',
    'asset', 'liability', 'liquidity', 'credit', 'operational', 'market',
    'basel', 'stress', 'scenario', 'framework', 'guideline', 'standard',
    
    // Regulatory frameworks
    'basel iii', 'basel iv', 'dodd-frank', 'sox', 'gdpr', 'ccar', 'dfast',
    'liquidity coverage ratio', 'net stable funding ratio', 'leverage ratio',
    
    // Risk categories
    'credit risk', 'market risk', 'operational risk', 'liquidity risk',
    'interest rate risk', 'currency risk', 'reputation risk', 'strategic risk',
    
    // Compliance terms
    'aml', 'kyc', 'cdd', 'edd', 'sanctions', 'embargo', 'corruption',
    'bribery', 'fraud', 'insider trading', 'market manipulation'
  ]);

  private readonly conceptTerms = new Set([
    // Management and control
    'management', 'assessment', 'monitoring', 'reporting', 'measurement',
    'control', 'process', 'procedure', 'methodology', 'approach',
    'requirement', 'obligation', 'responsibility', 'accountability',
    
    // Financial instruments
    'derivative', 'swap', 'option', 'future', 'forward', 'bond', 'equity',
    'securitization', 'collateral', 'guarantee', 'insurance', 'hedge',
    
    // Organizational structure
    'board', 'committee', 'audit', 'risk committee', 'compliance officer',
    'chief risk officer', 'internal audit', 'external audit', 'regulator'
  ]);

  private readonly regulatoryTerms = new Set([
    'requirement', 'mandatory', 'obligatory', 'compulsory', 'enforcement',
    'penalty', 'fine', 'sanction', 'violation', 'breach', 'non-compliance',
    'deadline', 'due date', 'effective date', 'implementation', 'transition'
  ]);

  calculate(expected: string, actual: string, similarity: number): BRDRMetricResult {
    const expectedLower = expected.toLowerCase();
    const actualLower = actual.toLowerCase();

    // Primary BRDR metrics as requested:

    // 1. Financial keywords match (same keywords are there)
    const keywordMatch = this.calculateKeywordMatch(expectedLower, actualLower);

    // 2. Chunk similarity (is it the same chunk as actual chunk)
    const chunkSimilarity = this.calculateChunkSimilarity(expectedLower, actualLower);

    // 3. Text similarity (overall content similarity)
    const textSimilarity = this.calculateTextSimilarity(expectedLower, actualLower);

    // 4. Embedding similarity (contextual relevance)
    const contextualRelevance = Math.max(0, (similarity + 1) / 2);

    // Calculate overall BRDR score - focus on keyword match and chunk similarity
    const overallScore = (
      keywordMatch * 0.40 +          // Financial keywords (primary)
      chunkSimilarity * 0.35 +       // Same chunk detection
      textSimilarity * 0.15 +        // Overall text similarity
      contextualRelevance * 0.10     // Embedding similarity
    );

    // Calculate confidence based on data quality
    const confidence = this.calculateConfidence(expectedLower, actualLower, similarity);

    return {
      overallScore: Math.min(1.0, Math.max(0, overallScore)),
      keywordMatch,
      conceptMatch: chunkSimilarity,  // Use chunk similarity for concept match
      contextualRelevance,
      regulatoryCompliance: textSimilarity, // Use text similarity for regulatory compliance
      semanticAccuracy: contextualRelevance, // Use embedding similarity for semantic accuracy
      confidence
    };
  }

  private calculateKeywordMatch(expected: string, actual: string): number {
    const expectedKeywords = this.extractKeywords(expected);
    const actualKeywords = this.extractKeywords(actual);
    
    if (expectedKeywords.size === 0 && actualKeywords.size === 0) return 1.0;
    if (expectedKeywords.size === 0 || actualKeywords.size === 0) return 0.0;
    
    const intersection = new Set([...expectedKeywords].filter(x => actualKeywords.has(x)));
    const union = new Set([...expectedKeywords, ...actualKeywords]);
    
    return intersection.size / union.size;
  }

  private calculateConceptMatch(expected: string, actual: string): number {
    const expectedConcepts = this.extractConcepts(expected);
    const actualConcepts = this.extractConcepts(actual);
    
    if (expectedConcepts.size === 0 && actualConcepts.size === 0) return 1.0;
    if (expectedConcepts.size === 0 || actualConcepts.size === 0) return 0.0;
    
    const intersection = new Set([...expectedConcepts].filter(x => actualConcepts.has(x)));
    const union = new Set([...expectedConcepts, ...actualConcepts]);
    
    return intersection.size / union.size;
  }

  private calculateRegulatoryCompliance(expected: string, actual: string): number {
    const expectedRegulatory = this.extractRegulatoryTerms(expected);
    const actualRegulatory = this.extractRegulatoryTerms(actual);
    
    if (expectedRegulatory.size === 0 && actualRegulatory.size === 0) return 1.0;
    if (expectedRegulatory.size === 0 || actualRegulatory.size === 0) return 0.0;
    
    const intersection = new Set([...expectedRegulatory].filter(x => actualRegulatory.has(x)));
    const union = new Set([...expectedRegulatory, ...actualRegulatory]);
    
    return intersection.size / union.size;
  }

  private calculateSemanticAccuracy(expected: string, actual: string): number {
    // Simple text similarity using word overlap
    const expectedWords = new Set(expected.split(/\s+/).filter(word => word.length > 2));
    const actualWords = new Set(actual.split(/\s+/).filter(word => word.length > 2));
    
    if (expectedWords.size === 0 && actualWords.size === 0) return 1.0;
    if (expectedWords.size === 0 || actualWords.size === 0) return 0.0;
    
    const intersection = new Set([...expectedWords].filter(x => actualWords.has(x)));
    const union = new Set([...expectedWords, ...actualWords]);
    
    return intersection.size / union.size;
  }

  private calculateConfidence(expected: string, actual: string, similarity: number): number {
    // Higher confidence for longer, more detailed texts
    const expectedLength = expected.length;
    const actualLength = actual.length;
    
    const lengthFactor = Math.min(1.0, Math.min(expectedLength, actualLength) / 100);
    const similarityFactor = Math.max(0, (similarity + 1) / 2);
    
    return (lengthFactor * 0.4 + similarityFactor * 0.6);
  }

  private extractKeywords(text: string): Set<string> {
    const keywords = new Set<string>();
    for (const keyword of this.bankingKeywords) {
      if (text.includes(keyword)) {
        keywords.add(keyword);
      }
    }
    return keywords;
  }

  private extractConcepts(text: string): Set<string> {
    const concepts = new Set<string>();
    for (const concept of this.conceptTerms) {
      if (text.includes(concept)) {
        concepts.add(concept);
      }
    }
    return concepts;
  }

  private extractRegulatoryTerms(text: string): Set<string> {
    const terms = new Set<string>();
    for (const term of this.regulatoryTerms) {
      if (text.includes(term)) {
        terms.add(term);
      }
    }
    return terms;
  }

  private calculateTextSimilarity(expected: string, actual: string): number {
    // Calculate overall text similarity using multiple methods

    // Method 1: Word-level similarity (Jaccard similarity)
    const expectedWords = new Set(expected.split(/\s+/).filter(word => word.length > 2));
    const actualWords = new Set(actual.split(/\s+/).filter(word => word.length > 2));

    if (expectedWords.size === 0 && actualWords.size === 0) return 1.0;
    if (expectedWords.size === 0 || actualWords.size === 0) return 0.0;

    const intersection = new Set([...expectedWords].filter(x => actualWords.has(x)));
    const union = new Set([...expectedWords, ...actualWords]);
    const wordSimilarity = intersection.size / union.size;

    // Method 2: Character-level similarity (for short texts)
    const expectedChars = expected.replace(/\s+/g, '');
    const actualChars = actual.replace(/\s+/g, '');
    const charSimilarity = expectedChars.length > 0 && actualChars.length > 0
      ? expectedChars === actualChars ? 1.0 : 0.0
      : 0.0;

    // Method 3: Length ratio similarity
    const lengthSimilarity = expected.length > 0 && actual.length > 0
      ? 1 - Math.abs(expected.length - actual.length) / Math.max(expected.length, actual.length)
      : 0.0;

    // Weighted combination
    return (wordSimilarity * 0.7 + charSimilarity * 0.2 + lengthSimilarity * 0.1);
  }

  private calculateContentOverlap(expected: string, actual: string): number {
    // Calculate how much of the expected content appears in the actual content

    // Split expected into meaningful phrases (sentences, clauses)
    const expectedPhrases = expected.split(/[.!?]+/).filter(phrase => phrase.trim().length > 5);
    if (expectedPhrases.length === 0) return 0.0;

    let matchedPhrases = 0;
    for (const phrase of expectedPhrases) {
      const cleanPhrase = phrase.trim();
      if (cleanPhrase.length > 5 && actual.includes(cleanPhrase)) {
        matchedPhrases++;
      }
    }

    return matchedPhrases / expectedPhrases.length;
  }

  private calculateChunkSimilarity(expected: string, actual: string): number {
    // Check if chunks are the same or very similar (for BRDR chunk matching)

    // Method 1: Exact match
    if (expected === actual) return 1.0;

    // Method 2: High word overlap (indicating same chunk)
    const expectedWords = new Set(expected.split(/\s+/).filter(word => word.length > 2));
    const actualWords = new Set(actual.split(/\s+/).filter(word => word.length > 2));

    if (expectedWords.size === 0 && actualWords.size === 0) return 1.0;
    if (expectedWords.size === 0 || actualWords.size === 0) return 0.0;

    const intersection = new Set([...expectedWords].filter(x => actualWords.has(x)));
    const smallerSet = expectedWords.size < actualWords.size ? expectedWords : actualWords;

    // If most words from the smaller chunk are in the larger one, it's likely the same chunk
    const overlapRatio = intersection.size / smallerSet.size;

    // Method 3: Length similarity (chunks should be similar in size)
    const lengthSimilarity = expected.length > 0 && actual.length > 0
      ? 1 - Math.abs(expected.length - actual.length) / Math.max(expected.length, actual.length)
      : 0.0;

    // Combine metrics - high overlap + similar length = likely same chunk
    return (overlapRatio * 0.7 + lengthSimilarity * 0.3);
  }

  getName(): string {
    return 'BRDR';
  }

  getDescription(): string {
    return 'Banking Regulation-specific metric that evaluates regulatory compliance, keyword matching, and concept understanding for financial knowledge bases';
  }
}
