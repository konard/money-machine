/**
 * Tests for Money Machine
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createMoneyMachine } from '../src/index.js';
import { DemoResearchStrategy } from '../src/strategies/demo-research.js';
import { Logger } from '../src/core/logger.js';
import { RateLimiter } from '../src/core/rate-limiter.js';
import { ComplianceEngine } from '../src/core/compliance-engine.js';
import { AccountManager } from '../src/core/account-manager.js';

describe('Money Machine', () => {
  describe('Logger', () => {
    it('should create logger and log messages', () => {
      const logger = new Logger({ level: 'info' });
      logger.info('Test message', { test: true });

      const logs = logger.getLogs();
      assert.strictEqual(logs.length, 1);
      assert.strictEqual(logs[0].message, 'Test message');
    });

    it('should respect log levels', () => {
      const logger = new Logger({ level: 'warn' });
      logger.debug('Should not appear');
      logger.info('Should not appear');
      logger.warn('Should appear');

      const logs = logger.getLogs();
      assert.strictEqual(logs.length, 1);
      assert.strictEqual(logs[0].level, 'warn');
    });

    it('should track metrics', () => {
      const logger = new Logger({ enableMetrics: true });
      logger.metric('test-metric', 100);
      logger.metric('test-metric', 200);

      const metrics = logger.getMetrics('test-metric');
      assert.strictEqual(metrics.length, 2);
      assert.strictEqual(metrics[0].value, 100);
      assert.strictEqual(metrics[1].value, 200);
    });
  });

  describe('Rate Limiter', () => {
    it('should acquire and track tokens', async () => {
      const rateLimiter = new RateLimiter();
      const acquired = await rateLimiter.acquireToken('test-platform');

      assert.strictEqual(acquired, true);

      const remaining = rateLimiter.getRemainingQuota('test-platform');
      assert.strictEqual(typeof remaining.minute, 'number');
      assert.ok(remaining.minute < 60);
    });

    it('should respect rate limits', async () => {
      const rateLimiter = new RateLimiter();
      rateLimiter.setPlatformLimits('limited-platform', {
        requestsPerMinute: 2,
        requestsPerHour: 2,
        burstLimit: 2,
      });

      assert.strictEqual(
        await rateLimiter.acquireToken('limited-platform'),
        true
      );
      assert.strictEqual(
        await rateLimiter.acquireToken('limited-platform'),
        true
      );
      assert.strictEqual(
        await rateLimiter.acquireToken('limited-platform'),
        false
      );
    });
  });

  describe('Compliance Engine', () => {
    it('should check legal compliance', async () => {
      const logger = new Logger({ level: 'error' });
      const compliance = new ComplianceEngine({}, logger);

      const result = await compliance.checkAction({
        type: 'legitimate-action',
      });

      assert.strictEqual(result.passed, true);
    });

    it('should detect illegal actions', async () => {
      const logger = new Logger({ level: 'error' });
      const compliance = new ComplianceEngine({ strictMode: false }, logger);

      const result = await compliance.checkAction({
        type: 'unauthorized-access',
      });

      assert.strictEqual(result.passed, false);
      assert.ok(result.checks.some((check) => !check.passed));
    });

    it('should integrate with rate limiter', async () => {
      const logger = new Logger({ level: 'error' });
      const rateLimiter = new RateLimiter();
      rateLimiter.setPlatformLimits('test', {
        requestsPerMinute: 1,
        requestsPerHour: 1,
        burstLimit: 1,
      });

      const compliance = new ComplianceEngine(
        { strictMode: false },
        logger,
        rateLimiter
      );

      const result1 = await compliance.checkAction(
        { type: 'api-call' },
        { platform: 'test' }
      );
      assert.strictEqual(result1.passed, true);

      const result2 = await compliance.checkAction(
        { type: 'api-call' },
        { platform: 'test' }
      );
      assert.strictEqual(result2.passed, false);
    });
  });

  describe('Account Manager', () => {
    it('should add and retrieve accounts', async () => {
      const accountManager = new AccountManager();

      await accountManager.addAccount('test-platform', {
        username: 'test',
        password: 'secret',
      });

      const account = await accountManager.getAccount('test-platform');
      assert.ok(account);
      assert.strictEqual(account.username, 'test');
    });

    it('should check account health', async () => {
      const accountManager = new AccountManager();

      await accountManager.addAccount('test-platform', { username: 'test' });

      const health = await accountManager.checkAccountHealth('test-platform');
      assert.strictEqual(health.healthy, true);
      assert.strictEqual(health.platform, 'test-platform');
    });

    it('should list all accounts', async () => {
      const accountManager = new AccountManager();

      await accountManager.addAccount('platform1', { key: 'value1' });
      await accountManager.addAccount('platform2', { key: 'value2' });

      const accounts = await accountManager.listAccounts();
      assert.strictEqual(accounts.length, 2);
    });
  });

  describe('Money Machine Integration', () => {
    it('should create and initialize money machine', async () => {
      const machine = await createMoneyMachine({ logLevel: 'error' });

      assert.ok(machine);
      const status = await machine.getStatus();
      assert.strictEqual(status.initialized, true);
      assert.strictEqual(status.running, false);
    });

    it('should load and execute strategy', async () => {
      const machine = await createMoneyMachine({ logLevel: 'error' });
      const strategy = new DemoResearchStrategy();

      const strategyId = await machine.loadStrategy(strategy);
      assert.strictEqual(strategyId, 'demo-research');

      const status = await machine.getStatus();
      assert.ok(status.strategies['demo-research']);
    });

    it('should generate earnings report', async () => {
      const machine = await createMoneyMachine({ logLevel: 'error' });
      const strategy = new DemoResearchStrategy();

      await machine.loadStrategy(strategy);

      const report = await machine.getEarningsReport();
      assert.strictEqual(typeof report.totalEarnings, 'number');
      assert.ok(report.byStrategy);
    });
  });
});
