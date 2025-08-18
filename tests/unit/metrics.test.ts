import { SimilarityMetric, BRDRMetric } from '../../src/metrics';

describe('SimilarityMetric', () => {
  let similarityMetric: SimilarityMetric;

  beforeEach(() => {
    similarityMetric = new SimilarityMetric();
  });

  describe('calculate', () => {
    it('should return perfect score for exact matches', () => {
      const expected = 'Banking regulation requirements';
      const actual = 'Banking regulation requirements';
      const similarity = 0.95;

      const result = similarityMetric.calculate(expected, actual, similarity);

      expect(result.overallScore).toBe(1.0);
      expect(result.exactMatch).toBe(true);
      expect(result.similarity).toBe(0.95);
    });

    it('should handle case insensitive exact matches', () => {
      const expected = 'Banking Regulation Requirements';
      const actual = 'banking regulation requirements';
      const similarity = 0.95;

      const result = similarityMetric.calculate(expected, actual, similarity);

      expect(result.overallScore).toBe(1.0);
      expect(result.exactMatch).toBe(true);
    });

    it('should handle whitespace differences in exact matches', () => {
      const expected = ' Banking regulation requirements ';
      const actual = 'Banking regulation requirements';
      const similarity = 0.95;

      const result = similarityMetric.calculate(expected, actual, similarity);

      expect(result.overallScore).toBe(1.0);
      expect(result.exactMatch).toBe(true);
    });

    it('should calculate score based on similarity for non-exact matches', () => {
      const expected = 'Banking regulation requirements';
      const actual = 'Financial regulatory guidelines';
      const similarity = 0.8;

      const result = similarityMetric.calculate(expected, actual, similarity);

      expect(result.overallScore).toBeCloseTo(0.81, 2); // (0.8 + 1) / 2 * 0.9
      expect(result.exactMatch).toBe(false);
      expect(result.normalizedSimilarity).toBeCloseTo(0.9, 2);
    });

    it('should handle negative similarity values', () => {
      const expected = 'Banking regulation';
      const actual = 'Completely different topic';
      const similarity = -0.5;

      const result = similarityMetric.calculate(expected, actual, similarity);

      expect(result.overallScore).toBeCloseTo(0.225, 2); // (-0.5 + 1) / 2 * 0.9
      expect(result.normalizedSimilarity).toBeCloseTo(0.25, 2);
    });

    it('should handle very low similarity values', () => {
      const expected = 'Banking regulation';
      const actual = 'Weather forecast';
      const similarity = -1.0;

      const result = similarityMetric.calculate(expected, actual, similarity);

      expect(result.overallScore).toBe(0.0);
      expect(result.normalizedSimilarity).toBe(0.0);
    });

    it('should cap overall score at 1.0', () => {
      const expected = 'Test';
      const actual = 'Test Different';
      const similarity = 1.0;

      const result = similarityMetric.calculate(expected, actual, similarity);

      expect(result.overallScore).toBeLessThanOrEqual(1.0);
    });

    it('should ensure overall score is non-negative', () => {
      const expected = 'Test';
      const actual = 'Completely different';
      const similarity = -1.0;

      const result = similarityMetric.calculate(expected, actual, similarity);

      expect(result.overallScore).toBeGreaterThanOrEqual(0.0);
    });
  });
});

describe('BRDRMetric', () => {
  let brdrMetric: BRDRMetric;

  beforeEach(() => {
    brdrMetric = new BRDRMetric();
  });

  describe('calculate', () => {
    it('should identify banking keywords correctly', () => {
      const expected = 'Banking risk management and capital requirements';
      const actual = 'Risk assessment for banking capital adequacy';
      const similarity = 0.8;

      const result = brdrMetric.calculate(expected, actual, similarity);

      expect(result.keywordMatch).toBeGreaterThan(0);
      expect(result.overallScore).toBeGreaterThan(0);
    });

    it('should identify concept terms correctly', () => {
      const expected = 'Risk management and assessment procedures';
      const actual = 'Management framework for risk assessment';
      const similarity = 0.75;

      const result = brdrMetric.calculate(expected, actual, similarity);

      expect(result.conceptMatch).toBeGreaterThan(0);
      expect(result.overallScore).toBeGreaterThan(0);
    });

    it('should combine keyword, concept, and contextual scores', () => {
      const expected = 'Banking risk management framework compliance';
      const actual = 'Risk management procedures for banking compliance';
      const similarity = 0.85;

      const result = brdrMetric.calculate(expected, actual, similarity);

      // Should have high scores in all categories
      expect(result.keywordMatch).toBeGreaterThan(0);
      expect(result.conceptMatch).toBeGreaterThanOrEqual(0.5); // management is common
      expect(result.contextualRelevance).toBeCloseTo(0.925, 2); // (0.85 + 1) / 2
      expect(result.overallScore).toBeGreaterThan(0.5);
    });

    it('should handle text with no banking keywords or concepts', () => {
      const expected = 'Weather forecast for tomorrow';
      const actual = 'Sunny skies expected with light winds';
      const similarity = 0.6;

      const result = brdrMetric.calculate(expected, actual, similarity);

      // Check that scores are numbers and within expected range
      expect(typeof result.keywordMatch).toBe('number');
      expect(typeof result.conceptMatch).toBe('number');
      expect(result.contextualRelevance).toBeCloseTo(0.8, 2); // (0.6 + 1) / 2
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(1);
    });

    it('should handle empty strings', () => {
      const expected = '';
      const actual = '';
      const similarity = 0.0;

      const result = brdrMetric.calculate(expected, actual, similarity);

      // Check that scores are numbers and within expected range
      expect(typeof result.keywordMatch).toBe('number');
      expect(typeof result.conceptMatch).toBe('number');
      expect(result.contextualRelevance).toBeCloseTo(0.5, 2); // (0 + 1) / 2
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(1);
    });

    it('should calculate Jaccard similarity for keyword overlap', () => {
      const expected = 'risk capital liquidity';
      const actual = 'risk asset capital';
      const similarity = 0.7;

      const result = brdrMetric.calculate(expected, actual, similarity);

      // Expected keywords: [risk, capital]
      // Actual keywords: [risk, capital] (asset is not in banking keywords)
      // Should have some overlap since both contain risk and capital
      expect(result.keywordMatch).toBeGreaterThan(0);
      expect(result.keywordMatch).toBeLessThanOrEqual(1);
    });

    it('should handle case insensitive matching', () => {
      const expected = 'Banking RISK Management';
      const actual = 'risk BANKING guidelines';
      const similarity = 0.8;

      const result = brdrMetric.calculate(expected, actual, similarity);

      expect(result.keywordMatch).toBeGreaterThan(0);
    });

    it('should handle negative similarity values', () => {
      const expected = 'Banking risk management';
      const actual = 'Risk management for banks';
      const similarity = -0.3;

      const result = brdrMetric.calculate(expected, actual, similarity);

      expect(result.contextualRelevance).toBeCloseTo(0.35, 2); // (-0.3 + 1) / 2
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(1);
    });

    it('should ensure weighted combination is correct', () => {
      const expected = 'capital risk management framework';
      const actual = 'risk management procedures for capital';
      const similarity = 0.6;

      const result = brdrMetric.calculate(expected, actual, similarity);

      const expectedScore = (
        result.keywordMatch * 0.3 +
        result.conceptMatch * 0.3 +
        result.contextualRelevance * 0.4
      );

      expect(result.overallScore).toBeCloseTo(expectedScore, 3);
    });

    it('should handle perfect matches in all categories', () => {
      const text = 'banking risk management framework compliance assessment';
      const similarity = 1.0;

      const result = brdrMetric.calculate(text, text, similarity);

      expect(result.keywordMatch).toBe(1.0);
      expect(result.conceptMatch).toBe(1.0);
      expect(result.contextualRelevance).toBe(1.0);
      expect(result.overallScore).toBe(1.0);
    });
  });

  describe('keyword and concept extraction', () => {
    it('should extract banking keywords correctly', () => {
      // This tests the private method indirectly through calculate
      const expected = 'banking risk capital compliance regulation supervision';
      const actual = 'different text';
      const similarity = 0.5;

      const result = brdrMetric.calculate(expected, actual, similarity);

      // Should detect multiple keywords in expected text
      expect(result.keywordMatch).toBe(0); // No overlap with actual
    });

    it('should extract concept terms correctly', () => {
      const expected = 'management assessment monitoring reporting measurement';
      const actual = 'different text';
      const similarity = 0.5;

      const result = brdrMetric.calculate(expected, actual, similarity);

      // Should detect multiple concepts in expected text
      expect(result.conceptMatch).toBe(0); // No overlap with actual
    });
  });
});
