export interface BaseMetricResult {
  overallScore: number;
  confidence: number;
  [key: string]: number; // Allow additional metric-specific fields
}

export interface BaseMetric {
  calculate(expected: string, actual: string, similarity: number): BaseMetricResult;
  getName(): string;
  getDescription(): string;
}

export class MetricFactory {
  private static metrics = new Map<string, BaseMetric>();

  static registerMetric(name: string, metric: BaseMetric): void {
    this.metrics.set(name.toLowerCase(), metric);
  }

  static getMetric(name: string): BaseMetric {
    const metric = this.metrics.get(name.toLowerCase());
    if (!metric) {
      throw new Error(`Metric '${name}' not found. Available metrics: ${Array.from(this.metrics.keys()).join(', ')}`);
    }
    return metric;
  }

  static getAvailableMetrics(): string[] {
    return Array.from(this.metrics.keys());
  }

  static getMetricInfo(name: string): { name: string; description: string } {
    const metric = this.getMetric(name);
    return {
      name: metric.getName(),
      description: metric.getDescription()
    };
  }
}
