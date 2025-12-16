/**
 * Base class for all strategy modules
 */

export class StrategyModule {
  constructor(config = {}) {
    this.config = config;
    this.status = 'initialized';
    this.earnings = 0;
    this.actions = 0;
    this.errors = [];
  }

  get name() {
    throw new Error('Strategy must implement name getter');
  }

  get description() {
    return 'No description provided';
  }

  get requiredAccounts() {
    return [];
  }

  get estimatedTimeToFirstDollar() {
    return 'unknown';
  }

  get automationLevel() {
    return 0.5;
  }

  initialize(_context) {
    this.status = 'ready';
  }

  async execute(_context) {
    throw new Error('Strategy must implement execute method');
  }

  validate(_context) {
    return { valid: true, errors: [] };
  }

  shutdown() {
    this.status = 'stopped';
  }

  getStatus() {
    return {
      name: this.name,
      status: this.status,
      earnings: this.earnings,
      actions: this.actions,
      errorCount: this.errors.length,
    };
  }

  getMetrics() {
    return {
      totalEarnings: this.earnings,
      totalActions: this.actions,
      successRate:
        this.actions > 0
          ? (this.actions - this.errors.length) / this.actions
          : 0,
      errors: this.errors.slice(-10),
    };
  }
}
