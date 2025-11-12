/**
 * Metrics service for Prometheus monitoring
 * Tracks counters, gauges, and histograms
 */

class MetricsService {
  constructor() {
    this.counters = new Map();
    this.gauges = new Map();
    this.histograms = new Map();
  }

  /**
   * Increment a counter metric
   */
  increment(name, labels = {}) {
    const key = this._getKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + 1);
  }

  /**
   * Set a gauge metric
   */
  gauge(name, value, labels = {}) {
    const key = this._getKey(name, labels);
    this.gauges.set(key, value);
  }

  /**
   * Record a histogram value
   */
  histogram(name, value, labels = {}) {
    const key = this._getKey(name, labels);
    if (!this.histograms.has(key)) {
      this.histograms.set(key, []);
    }
    this.histograms.get(key).push(value);
  }

  /**
   * Generate Prometheus text format
   */
  getPrometheusMetrics() {
    let output = '';

    // Counters
    for (const [key, value] of this.counters.entries()) {
      output += `${key} ${value}\n`;
    }

    // Gauges
    for (const [key, value] of this.gauges.entries()) {
      output += `${key} ${value}\n`;
    }

    // Histograms (simplified - just output count and sum)
    for (const [key, values] of this.histograms.entries()) {
      const sum = values.reduce((a, b) => a + b, 0);
      const count = values.length;
      output += `${key}_sum ${sum}\n`;
      output += `${key}_count ${count}\n`;
    }

    return output;
  }

  /**
   * Get all metrics as JSON
   */
  getMetrics() {
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: Object.fromEntries(
        Array.from(this.histograms.entries()).map(([key, values]) => [
          key,
          {
            count: values.length,
            sum: values.reduce((a, b) => a + b, 0),
            avg: values.reduce((a, b) => a + b, 0) / values.length
          }
        ])
      )
    };
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }

  /**
   * Generate metric key with labels
   */
  _getKey(name, labels) {
    if (Object.keys(labels).length === 0) {
      return name;
    }
    const labelStr = Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return `${name}{${labelStr}}`;
  }
}

// Singleton instance
export const metrics = new MetricsService();
