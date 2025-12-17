/**
 * Money-Machine: A legal, automated system for generating income with zero capital
 *
 * This system coordinates multiple money-making strategies while ensuring
 * full compliance with laws and platform rules.
 */

export { MoneyMachine } from './core/money-machine.js';
export { ComplianceEngine } from './core/compliance-engine.js';
export { AccountManager } from './core/account-manager.js';
export { StrategyManager } from './core/strategy-manager.js';
export { RateLimiter } from './core/rate-limiter.js';
export { Logger } from './core/logger.js';
export { Scheduler } from './core/scheduler.js';

// Re-export strategy base class
export { StrategyModule } from './strategies/base.js';

/**
 * Quick start helper
 * @param {object} config - Configuration object
 * @returns {Promise<MoneyMachine>} Initialized money machine instance
 */
export async function createMoneyMachine(config = {}) {
  const { MoneyMachine } = await import('./core/money-machine.js');
  const machine = new MoneyMachine(config);
  await machine.initialize();
  return machine;
}
