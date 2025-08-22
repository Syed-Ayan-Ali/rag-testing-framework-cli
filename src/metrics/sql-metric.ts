import { BaseMetric, BaseMetricResult } from './base-metric';

export interface SQLMetricResult extends BaseMetricResult {
  sqlAccuracy: number;
  tableRelevance: number;
  semanticUnderstanding: number;
  queryCompleteness: number;
  syntaxCorrectness: number;
  // New semantic equivalence metrics
  tablePresence: number;        // All relevant tables present
  columnPresence: number;       // All relevant columns present
  joinAggregation: number;     // Proper JOINs and aggregations
  queryParsability: number;    // SQL is parseable
  queryDifference: number;     // Negative weight for differences (lower is better)
  semanticEquivalence: number; // Does it produce same logical result?
}

export class SQLMetric implements BaseMetric {
  private readonly sqlKeywords = new Set([
    // SQL commands
    'select', 'from', 'where', 'join', 'group by', 'order by', 'having',
    'insert', 'update', 'delete', 'create', 'alter', 'drop', 'index',
    'union', 'intersect', 'except', 'with', 'cte', 'case', 'when', 'then',
    
    // Aggregations
    'count', 'sum', 'avg', 'min', 'max', 'distinct', 'top', 'limit',
    
    // Joins
    'inner join', 'left join', 'right join', 'full join', 'cross join',
    'natural join', 'using', 'on',
    
    // Conditions
    'and', 'or', 'not', 'in', 'exists', 'between', 'like', 'ilike',
    'is null', 'is not null', '>', '<', '>=', '<=', '=', '!='
  ]);

  private readonly tableKeywords = new Set([
    'table', 'schema', 'database', 'view', 'temp', 'temporary',
    'partition', 'index', 'constraint', 'foreign key', 'primary key',
    'unique', 'check', 'default'
  ]);

  private readonly businessTerms = new Set([
    // Company/Performance terms
    'company', 'corporation', 'enterprise', 'business', 'firm', 'organization',
    'performance', 'revenue', 'profit', 'income', 'earnings', 'growth',
    'market', 'share', 'stock', 'equity', 'valuation', 'market cap',
    
    // Financial metrics
    'roi', 'roa', 'roe', 'ebitda', 'ebit', 'net income', 'gross profit',
    'operating income', 'cash flow', 'assets', 'liabilities', 'debt',
    
    // Market terms
    'sector', 'industry', 'market', 'exchange', 'nasdaq', 'nyse', 'ftse',
    'dow jones', 's&p', 'index', 'benchmark', 'trend', 'volatility'
  ]);

  calculate(expected: string, actual: string, similarity: number): SQLMetricResult {
    const expectedLower = expected.toLowerCase();
    const actualLower = actual.toLowerCase();
    
    // Calculate SQL accuracy (how well the generated SQL matches expected)
    const sqlAccuracy = this.calculateSQLAccuracy(expectedLower, actualLower);
    
    // Calculate table relevance (how relevant the tables are to the query)
    const tableRelevance = this.calculateTableRelevance(expectedLower, actualLower);
    
    // Calculate semantic understanding (how well the intent is captured)
    const semanticUnderstanding = this.calculateSemanticUnderstanding(expectedLower, actualLower);
    
    // Calculate query completeness (how complete the SQL query is)
    const queryCompleteness = this.calculateQueryCompleteness(actualLower);
    
    // Calculate syntax correctness (basic SQL syntax validation)
    const syntaxCorrectness = this.calculateSyntaxCorrectness(actualLower);
    
    // Use embedding similarity as a confidence factor
    const similarityFactor = Math.max(0, (similarity + 1) / 2);
    
    // Calculate new semantic equivalence metrics
    const tablePresence = this.calculateTablePresence(expectedLower, actualLower);
    const columnPresence = this.calculateColumnPresence(expectedLower, actualLower);
    const joinAggregation = this.calculateJoinAggregation(actualLower);
    const queryParsability = this.calculateQueryParsability(actualLower);
    const queryDifference = this.calculateQueryDifference(expectedLower, actualLower);
    const semanticEquivalence = this.calculateSemanticEquivalence(expectedLower, actualLower);

    // Weighted combination for overall score (updated weights)
    const overallScore = (
      sqlAccuracy * 0.20 +
      tableRelevance * 0.15 +
      semanticUnderstanding * 0.15 +
      queryCompleteness * 0.10 +
      syntaxCorrectness * 0.05 +
      tablePresence * 0.15 +
      columnPresence * 0.10 +
      joinAggregation * 0.05 +
      queryParsability * 0.03 +
      (1 - queryDifference) * 0.02 + // Invert since lower difference is better
      semanticEquivalence * 0.10
    );
    
    // Calculate confidence based on multiple factors
    const confidence = this.calculateConfidence(
      expectedLower, 
      actualLower, 
      similarityFactor,
      queryCompleteness,
      syntaxCorrectness
    );
    
    return {
      overallScore: Math.min(1.0, Math.max(0, overallScore)),
      sqlAccuracy,
      tableRelevance,
      semanticUnderstanding,
      queryCompleteness,
      syntaxCorrectness,
      tablePresence,
      columnPresence,
      joinAggregation,
      queryParsability,
      queryDifference,
      semanticEquivalence,
      confidence
    };
  }

  private calculateSQLAccuracy(expected: string, actual: string): number {
    // Extract SQL components and compare
    const expectedComponents = this.extractSQLComponents(expected);
    const actualComponents = this.extractSQLComponents(actual);
    
    if (expectedComponents.size === 0 && actualComponents.size === 0) return 1.0;
    if (expectedComponents.size === 0 || actualComponents.size === 0) return 0.0;
    
    const intersection = new Set([...expectedComponents].filter(x => actualComponents.has(x)));
    const union = new Set([...expectedComponents, ...actualComponents]);
    
    return intersection.size / union.size;
  }

  private calculateTableRelevance(expected: string, actual: string): number {
    // Check if relevant tables are mentioned
    const expectedTables = this.extractTableReferences(expected);
    const actualTables = this.extractTableReferences(actual);
    
    if (expectedTables.size === 0 && actualTables.size === 0) return 1.0;
    if (expectedTables.size === 0 || actualTables.size === 0) return 0.0;
    
    const intersection = new Set([...expectedTables].filter(x => actualTables.has(x)));
    const union = new Set([...expectedTables, ...actualTables]);
    
    return intersection.size / union.size;
  }

  private calculateSemanticUnderstanding(expected: string, actual: string): number {
    // Check if business terms and intent are captured
    const expectedTerms = this.extractBusinessTerms(expected);
    const actualTerms = this.extractBusinessTerms(actual);
    
    if (expectedTerms.size === 0 && actualTerms.size === 0) return 1.0;
    if (expectedTerms.size === 0 || actualTerms.size === 0) return 0.0;
    
    const intersection = new Set([...expectedTerms].filter(x => actualTerms.has(x)));
    const union = new Set([...expectedTerms, ...actualTerms]);
    
    return intersection.size / union.size;
  }

  private calculateQueryCompleteness(sql: string): number {
    // Check if SQL has essential components
    const components = new Set<string>();
    
    if (sql.includes('select')) components.add('select');
    if (sql.includes('from')) components.add('from');
    if (sql.includes('where') || sql.includes('join')) components.add('filtering');
    if (sql.includes('group by') || sql.includes('order by')) components.add('aggregation');
    
    // Basic completeness score
    const essentialComponents = ['select', 'from'];
    const essentialCount = essentialComponents.filter(comp => components.has(comp)).length;
    
    return essentialCount / essentialComponents.length;
  }

  private calculateSyntaxCorrectness(sql: string): number {
    // Basic SQL syntax validation
    let score = 0;
    let totalChecks = 0;
    
    // Check for balanced parentheses
    const openParens = (sql.match(/\(/g) || []).length;
    const closeParens = (sql.match(/\)/g) || []).length;
    if (openParens === closeParens) score += 1;
    totalChecks++;
    
    // Check for balanced quotes
    const singleQuotes = (sql.match(/'/g) || []).length;
    const doubleQuotes = (sql.match(/"/g) || []).length;
    if (singleQuotes % 2 === 0 && doubleQuotes % 2 === 0) score += 1;
    totalChecks++;
    
    // Check for valid SQL keywords
    const hasValidKeywords = Array.from(this.sqlKeywords).some(keyword => 
      sql.includes(keyword)
    );
    if (hasValidKeywords) score += 1;
    totalChecks++;
    
    return totalChecks > 0 ? score / totalChecks : 0;
  }

  private calculateConfidence(
    expected: string, 
    actual: string, 
    similarity: number,
    completeness: number,
    syntax: number
  ): number {
    // Higher confidence for more complete and syntactically correct queries
    const lengthFactor = Math.min(1.0, Math.min(expected.length, actual.length) / 200);
    const similarityFactor = similarity;
    const completenessFactor = completeness;
    const syntaxFactor = syntax;
    
    return (
      lengthFactor * 0.2 +
      similarityFactor * 0.3 +
      completenessFactor * 0.3 +
      syntaxFactor * 0.2
    );
  }

  private extractSQLComponents(sql: string): Set<string> {
    const components = new Set<string>();
    
    // Extract SQL keywords
    for (const keyword of this.sqlKeywords) {
      if (sql.includes(keyword)) {
        components.add(keyword);
      }
    }
    
    // Extract table names (simple heuristic)
    const tableMatches = sql.match(/\bfrom\s+(\w+)/gi);
    if (tableMatches) {
      tableMatches.forEach(match => {
        const tableName = match.replace(/\bfrom\s+/i, '').trim();
        if (tableName) components.add(`table:${tableName}`);
      });
    }
    
    return components;
  }

  private extractTableReferences(text: string): Set<string> {
    const tables = new Set<string>();
    
    // Look for table-related keywords
    for (const keyword of this.tableKeywords) {
      if (text.includes(keyword)) {
        tables.add(keyword);
      }
    }
    
    // Extract potential table names
    const tableMatches = text.match(/\b\w+_table\b|\btable_\w+\b|\b\w+_data\b|\bdata_\w+\b/gi);
    if (tableMatches) {
      tableMatches.forEach(match => tables.add(match.toLowerCase()));
    }
    
    return tables;
  }

  private extractBusinessTerms(text: string): Set<string> {
    const terms = new Set<string>();
    
    for (const term of this.businessTerms) {
      if (text.includes(term)) {
        terms.add(term);
      }
    }
    
    return terms;
  }

  private calculateTablePresence(expected: string, actual: string): number {
    // Extract table names from expected and actual SQL
    const expectedTables = this.extractTableNames(expected);
    const actualTables = this.extractTableNames(actual);
    
    if (expectedTables.size === 0 && actualTables.size === 0) return 1.0;
    if (expectedTables.size === 0 || actualTables.size === 0) return 0.0;
    
    const intersection = new Set([...expectedTables].filter(x => actualTables.has(x)));
    const union = new Set([...expectedTables, ...actualTables]);
    
    return intersection.size / union.size;
  }

  private calculateColumnPresence(expected: string, actual: string): number {
    // Extract column names from SELECT clauses
    const expectedColumns = this.extractColumnNames(expected);
    const actualColumns = this.extractColumnNames(actual);
    
    if (expectedColumns.size === 0 && actualColumns.size === 0) return 1.0;
    if (expectedColumns.size === 0 || actualColumns.size === 0) return 0.0;
    
    const intersection = new Set([...expectedColumns].filter(x => actualColumns.has(x)));
    const union = new Set([...expectedColumns, ...actualColumns]);
    
    return intersection.size / union.size;
  }

  private calculateJoinAggregation(sql: string): number {
    let score = 0;
    let totalChecks = 0;
    
    // Check for JOINs
    if (sql.includes('join')) {
      score += 1;
      // Check if JOIN is properly structured
      if (sql.includes('on') || sql.includes('using')) score += 0.5;
    }
    totalChecks++;
    
    // Check for aggregations
    if (sql.includes('group by') || sql.includes('having')) score += 1;
    if (sql.includes('count') || sql.includes('sum') || sql.includes('avg') || 
        sql.includes('min') || sql.includes('max')) score += 1;
    totalChecks++;
    
    // Check for ORDER BY (often used with aggregations)
    if (sql.includes('order by')) score += 0.5;
    totalChecks++;
    
    return totalChecks > 0 ? score / totalChecks : 0;
  }

  private calculateQueryParsability(sql: string): number {
    let score = 0;
    let totalChecks = 0;
    
    // Basic SQL structure checks
    if (sql.includes('select') && sql.includes('from')) score += 1;
    totalChecks++;
    
    // Check for balanced parentheses
    const openParens = (sql.match(/\(/g) || []).length;
    const closeParens = (sql.match(/\)/g) || []).length;
    if (openParens === closeParens) score += 1;
    totalChecks++;
    
    // Check for balanced quotes
    const singleQuotes = (sql.match(/'/g) || []).length;
    const doubleQuotes = (sql.match(/"/g) || []).length;
    if (singleQuotes % 2 === 0 && doubleQuotes % 2 === 0) score += 1;
    totalChecks++;
    
    // Check for proper SQL keyword usage
    const hasValidKeywords = Array.from(this.sqlKeywords).some(keyword => 
      sql.includes(keyword)
    );
    if (hasValidKeywords) score += 1;
    totalChecks++;
    
    return totalChecks > 0 ? score / totalChecks : 0;
  }

  private calculateQueryDifference(expected: string, actual: string): number {
    // Calculate Levenshtein distance normalized by max length
    const distance = this.levenshteinDistance(expected, actual);
    const maxLength = Math.max(expected.length, actual.length);
    
    return maxLength > 0 ? distance / maxLength : 0;
  }

  private calculateSemanticEquivalence(expected: string, actual: string): number {
    // This is a simplified semantic equivalence check
    // In a real implementation, you might use more sophisticated NLP techniques
    
    // Check if both queries have similar structure
    const expectedStructure = this.extractQueryStructure(expected);
    const actualStructure = this.extractQueryStructure(actual);
    
    if (expectedStructure === actualStructure) return 1.0;
    
    // Check if they're semantically similar (e.g., both are SELECT queries with similar patterns)
    const expectedType = this.classifyQueryType(expected);
    const actualType = this.classifyQueryType(actual);
    
    if (expectedType === actualType) return 0.8;
    
    // Check if they're in the same category
    if (this.areQueriesSimilar(expected, actual)) return 0.6;
    
    return 0.3;
  }

  private extractTableNames(sql: string): Set<string> {
    const tables = new Set<string>();
    
    // Extract table names from FROM and JOIN clauses
    const fromMatches = sql.match(/\bfrom\s+(\w+)/gi);
    if (fromMatches) {
      fromMatches.forEach(match => {
        const tableName = match.replace(/\bfrom\s+/i, '').trim();
        if (tableName) tables.add(tableName.toLowerCase());
      });
    }
    
    const joinMatches = sql.match(/\bjoin\s+(\w+)/gi);
    if (joinMatches) {
      joinMatches.forEach(match => {
        const tableName = match.replace(/\bjoin\s+/i, '').trim();
        if (tableName) tables.add(tableName.toLowerCase());
      });
    }
    
    return tables;
  }

  private extractColumnNames(sql: string): Set<string> {
    const columns = new Set<string>();
    
    // Extract column names from SELECT clause
    const selectMatch = sql.match(/select\s+(.*?)\s+from/i);
    if (selectMatch) {
      const selectClause = selectMatch[1];
      // Simple column extraction - split by comma and clean
      const columnList = selectClause.split(',').map(col => 
        col.trim().replace(/\s+as\s+\w+/i, '').replace(/^\w+\./, '')
      );
      columnList.forEach(col => {
        if (col && col !== '*' && !col.includes('(')) {
          columns.add(col.toLowerCase());
        }
      });
    }
    
    return columns;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,      // deletion
          matrix[j - 1][i] + 1,      // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private extractQueryStructure(sql: string): string {
    // Extract the basic structure of the query
    const structure = sql.toLowerCase()
      .replace(/\w+/g, 'T')  // Replace words with T (token)
      .replace(/[^T\s()]/g, '')  // Remove non-token characters
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .trim();
    
    return structure;
  }

  private classifyQueryType(sql: string): string {
    const lowerSql = sql.toLowerCase();
    
    if (lowerSql.includes('count') || lowerSql.includes('sum') || lowerSql.includes('avg')) {
      return 'aggregation';
    } else if (lowerSql.includes('join')) {
      return 'join';
    } else if (lowerSql.includes('where') && lowerSql.includes('and')) {
      return 'filtered';
    } else if (lowerSql.includes('order by')) {
      return 'ordered';
    } else {
      return 'simple';
    }
  }

  private areQueriesSimilar(expected: string, actual: string): boolean {
    // Check if queries are in similar categories
    const expectedType = this.classifyQueryType(expected);
    const actualType = this.classifyQueryType(actual);
    
    if (expectedType === actualType) return true;
    
    // Check if they're semantically related
    const expectedTables = this.extractTableNames(expected);
    const actualTables = this.extractTableNames(actual);
    
    if (expectedTables.size > 0 && actualTables.size > 0) {
      const intersection = new Set([...expectedTables].filter(x => actualTables.has(x)));
      return intersection.size > 0;
    }
    
    return false;
  }

  getName(): string {
    return 'SQL';
  }

  getDescription(): string {
    return 'Text-to-SQL evaluation metric that measures SQL accuracy, table relevance, semantic understanding, and query completeness for database query generation';
  }
}
