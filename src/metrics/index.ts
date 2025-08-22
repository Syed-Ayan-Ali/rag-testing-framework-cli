export * from './base-metric';
export * from './brdr-metric';
export * from './sql-metric';

// Import and register all metrics
import { MetricFactory } from './base-metric';
import { BRDRMetric } from './brdr-metric';
import { SQLMetric } from './sql-metric';

// Register built-in metrics
MetricFactory.registerMetric('brdr', new BRDRMetric());
MetricFactory.registerMetric('sql', new SQLMetric());


