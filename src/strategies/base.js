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

  async initialize(context) {
    this.status = 'ready';
  }

  async execute(context) {
    throw new Error('Strategy must implement execute method');
  }

  async validate(context) {
    return { valid: true, errors: [] };
  }

  async shutdown() {
    this.status = 'stopped';
  }

  async getStatus() {
    return {
      name: this.name,
      status: this.status,
      earnings: this.earnings,
      actions: this.actions,
      errorCount: this.errors.length,
    };
  }

  async getMetrics() {
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
