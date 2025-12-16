/**
 * Logger - Comprehensive logging system for money-machine
 *
 * Provides structured logging with multiple levels, audit trails,
 * and performance metrics tracking.
 */

export class Logger {
  constructor(config = {}) {
    this.level = config.level || 'info';
    this.enableAudit = config.enableAudit !== false;
    this.enableMetrics = config.enableMetrics !== false;
    this.logs = [];
    this.auditLog = [];
    this.metrics = new Map();

    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };
  }

  /**
   * Check if a log level should be logged
   * @private
   */
  shouldLog(level) {
    return this.levels[level] >= this.levels[this.level];
  }

  /**
   * Format log entry
   * @private
   */
  formatEntry(level, message, context = {}) {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
    };
  }

  /**
   * Write log entry
   * @private
   */
  write(level, message, context) {
    if (!this.shouldLog(level)) return;

    const entry = this.formatEntry(level, message, context);
    this.logs.push(entry);

    // Console output with colors in development
    const colors = {
      debug: '\x1b[36m',
      info: '\x1b[32m',
      warn: '\x1b[33m',
      error: '\x1b[31m',
    };
    const reset = '\x1b[0m';
    const prefix = `${colors[level]}[${level.toUpperCase()}]${reset}`;

    console.log(
      `${prefix} ${entry.timestamp} ${message}`,
      Object.keys(context).length > 0 ? context : ''
    );
  }

  /**
   * Log debug message
   * @param {string} message - Log message
   * @param {object} context - Additional context
   */
  debug(message, context = {}) {
    this.write('debug', message, context);
  }

  /**
   * Log info message
   * @param {string} message - Log message
   * @param {object} context - Additional context
   */
  info(message, context = {}) {
    this.write('info', message, context);
  }

  /**
   * Log warning
   * @param {string} message - Log message
   * @param {object} context - Additional context
   */
  warn(message, context = {}) {
    this.write('warn', message, context);
  }

  /**
   * Log error
   * @param {string} message - Error message
   * @param {Error} error - Error object
   * @param {object} context - Additional context
   */
  error(message, error = null, context = {}) {
    const errorContext = {
      ...context,
      error: error
        ? {
            message: error.message,
            stack: error.stack,
            name: error.name,
          }
        : null,
    };
    this.write('error', message, errorContext);
  }

  /**
   * Log audit trail entry
   * @param {string} action - Action performed
   * @param {object} result - Action result
   * @param {object} context - Additional context
   */
  audit(action, result, context = {}) {
    if (!this.enableAudit) return;

    const entry = {
      timestamp: new Date().toISOString(),
      action,
      result,
      context,
    };

    this.auditLog.push(entry);
    this.debug(`Audit: ${action}`, { result, ...context });
  }

  /**
   * Record metric
   * @param {string} metricName - Name of the metric
   * @param {number} value - Metric value
   * @param {object} tags - Optional tags
   */
  metric(metricName, value, tags = {}) {
    if (!this.enableMetrics) return;

    if (!this.metrics.has(metricName)) {
      this.metrics.set(metricName, []);
    }

    this.metrics.get(metricName).push({
      timestamp: new Date().toISOString(),
      value,
      tags,
    });
  }

  /**
   * Get all logs
   * @param {string} level - Optional level filter
   * @returns {Array} Log entries
   */
  getLogs(level = null) {
    if (level) {
      return this.logs.filter((log) => log.level === level);
    }
    return [...this.logs];
  }

  /**
   * Get audit log
   * @returns {Array} Audit entries
   */
  getAuditLog() {
    return [...this.auditLog];
  }

  /**
   * Get metrics
   * @param {string} metricName - Optional metric name filter
   * @returns {Map|Array} Metrics
   */
  getMetrics(metricName = null) {
    if (metricName) {
      return this.metrics.get(metricName) || [];
    }
    return new Map(this.metrics);
  }

  /**
   * Clear logs
   * @param {string} type - 'all', 'logs', 'audit', or 'metrics'
   */
  clear(type = 'all') {
    if (type === 'all' || type === 'logs') {
      this.logs = [];
    }
    if (type === 'all' || type === 'audit') {
      this.auditLog = [];
    }
    if (type === 'all' || type === 'metrics') {
      this.metrics.clear();
    }
  }

  /**
   * Generate summary statistics
   * @returns {object} Log statistics
   */
  getStats() {
    const stats = {
      total: this.logs.length,
      byLevel: {},
      auditEntries: this.auditLog.length,
      metricCount: this.metrics.size,
    };

    for (const log of this.logs) {
      stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
    }

    return stats;
  }
}
