/**
 * Strategy Manager - Coordinates multiple money-making strategies
 */

export class StrategyManager {
  constructor(config = {}, logger = null, complianceEngine = null) {
    this.logger = logger;
    this.complianceEngine = complianceEngine;
    this.strategies = new Map();
    this.activeStrategies = new Set();
  }

  async loadStrategy(strategyModule) {
    const strategy = strategyModule;
    this.strategies.set(strategy.name, strategy);

    if (this.logger) {
      this.logger.info('Strategy loaded', { strategy: strategy.name });
    }

    return strategy.name;
  }

  async executeStrategy(strategyId, context = {}) {
    const strategy = this.strategies.get(strategyId);

    if (!strategy) {
      throw new Error(`Strategy not found: ${strategyId}`);
    }

    const validation = await strategy.validate(context);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    try {
      this.activeStrategies.add(strategyId);
      const result = await strategy.execute(context);
      return result;
    } catch (error) {
      if (this.logger) {
        this.logger.error('Strategy execution failed', error, { strategyId });
      }
      return { success: false, error: error.message };
    } finally {
      this.activeStrategies.delete(strategyId);
    }
  }

  async pauseStrategy(strategyId, reason = '') {
    const strategy = this.strategies.get(strategyId);
    if (strategy) {
      strategy.status = 'paused';
      if (this.logger) {
        this.logger.info('Strategy paused', { strategyId, reason });
      }
    }
  }

  async getStrategyStatus(strategyId) {
    const strategy = this.strategies.get(strategyId);
    return strategy ? await strategy.getStatus() : null;
  }

  async getPerformanceMetrics() {
    const metrics = {};
    for (const [id, strategy] of this.strategies.entries()) {
      metrics[id] = await strategy.getMetrics();
    }
    return metrics;
  }

  listStrategies() {
    return Array.from(this.strategies.keys());
  }
}
