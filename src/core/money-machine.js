/**
 * Money Machine - Main orchestrator
 *
 * Coordinates all components to run automated money-making strategies
 * with full legal compliance.
 */

import { Logger } from './logger.js';
import { RateLimiter } from './rate-limiter.js';
import { ComplianceEngine } from './compliance-engine.js';
import { AccountManager } from './account-manager.js';
import { StrategyManager } from './strategy-manager.js';
import { Scheduler } from './scheduler.js';

export class MoneyMachine {
  constructor(config = {}) {
    this.config = {
      logLevel: 'info',
      strictCompliance: true,
      maxConcurrentStrategies: 3,
      ...config,
    };

    this.logger = new Logger({ level: this.config.logLevel });
    this.rateLimiter = new RateLimiter({}, this.logger);
    this.complianceEngine = new ComplianceEngine(
      { strictMode: this.config.strictCompliance },
      this.logger,
      this.rateLimiter
    );
    this.accountManager = new AccountManager({}, this.logger);
    this.strategyManager = new StrategyManager(
      {},
      this.logger,
      this.complianceEngine
    );
    this.scheduler = new Scheduler({}, this.logger);

    this.initialized = false;
    this.running = false;
  }

  /**
   * Initialize the money machine
   */
  async initialize() {
    if (this.initialized) {
      this.logger.warn('Money machine already initialized');
      return;
    }

    this.logger.info('Initializing Money Machine...');

    // Load platform rate limits
    this.configurePlatformLimits();

    this.initialized = true;
    this.logger.info('Money Machine initialized successfully');

    return this;
  }

  /**
   * Configure platform-specific rate limits
   * @private
   */
  configurePlatformLimits() {
    this.rateLimiter.setPlatformLimits('github', {
      requestsPerMinute: 80,
      requestsPerHour: 5000,
      burstLimit: 20,
    });

    this.rateLimiter.setPlatformLimits('reddit', {
      requestsPerMinute: 60,
      requestsPerHour: 600,
      burstLimit: 10,
    });

    this.rateLimiter.setPlatformLimits('fiverr', {
      requestsPerMinute: 30,
      requestsPerHour: 500,
      burstLimit: 5,
    });
  }

  /**
   * Add a platform account
   * @param {string} platform - Platform name
   * @param {object} credentials - Account credentials
   */
  async addAccount(platform, credentials) {
    this.ensureInitialized();
    await this.accountManager.addAccount(platform, credentials);
    this.logger.info('Account added', { platform });
  }

  /**
   * Load and initialize a strategy
   * @param {StrategyModule} strategy - Strategy module instance
   */
  async loadStrategy(strategy) {
    this.ensureInitialized();

    // Validate required accounts
    const requiredAccounts = strategy.requiredAccounts;
    const accounts = await this.accountManager.listAccounts();
    const availablePlatforms = accounts.map((a) => a.platform);

    for (const required of requiredAccounts) {
      if (!availablePlatforms.includes(required)) {
        throw new Error(
          `Strategy ${strategy.name} requires account for ${required}`
        );
      }
    }

    // Initialize strategy
    await strategy.initialize({
      logger: this.logger,
      accountManager: this.accountManager,
      complianceEngine: this.complianceEngine,
      rateLimiter: this.rateLimiter,
    });

    await this.strategyManager.loadStrategy(strategy);
    this.logger.info('Strategy loaded', { strategy: strategy.name });

    return strategy.name;
  }

  /**
   * Start running strategies
   * @param {Array<string>} strategyIds - Optional list of strategy IDs to run
   */
  async start(strategyIds = null) {
    this.ensureInitialized();

    if (this.running) {
      this.logger.warn('Money machine already running');
      return;
    }

    this.running = true;
    this.logger.info('Money Machine started');

    const strategies = strategyIds || this.strategyManager.listStrategies();

    for (const strategyId of strategies) {
      this.scheduler.scheduleTask(
        {
          id: `strategy-${strategyId}`,
          handler: async () => {
            await this.strategyManager.executeStrategy(strategyId, {
              logger: this.logger,
              accountManager: this.accountManager,
              complianceEngine: this.complianceEngine,
            });
          },
        },
        { intervalMs: 60000 }
      );
    }
  }

  /**
   * Stop all strategies
   */
  async stop() {
    if (!this.running) {
      this.logger.warn('Money machine not running');
      return;
    }

    this.logger.info('Stopping Money Machine...');
    this.scheduler.shutdown();
    this.running = false;
    this.logger.info('Money Machine stopped');
  }

  /**
   * Get system status
   */
  async getStatus() {
    return {
      initialized: this.initialized,
      running: this.running,
      accounts: await this.accountManager.listAccounts(),
      strategies: await this.strategyManager.getPerformanceMetrics(),
      compliance: this.complianceEngine.generateComplianceReport(),
      rateLimits: this.rateLimiter.getStats(),
    };
  }

  /**
   * Get earnings report
   */
  async getEarningsReport() {
    const metrics = await this.strategyManager.getPerformanceMetrics();
    let totalEarnings = 0;

    for (const strategy of Object.values(metrics)) {
      totalEarnings += strategy.totalEarnings || 0;
    }

    return {
      totalEarnings,
      byStrategy: metrics,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Ensure machine is initialized
   * @private
   */
  ensureInitialized() {
    if (!this.initialized) {
      throw new Error(
        'Money machine not initialized. Call initialize() first.'
      );
    }
  }
}
