/**
 * Account Manager - Manages platform accounts and credentials
 *
 * Handles secure storage and management of credentials across platforms.
 * Note: In production, use proper encryption for credentials.
 */

export class AccountManager {
  constructor(config = {}, logger = null) {
    this.logger = logger;
    this.accounts = new Map();
    this.sessionCache = new Map();

    this.log('Account manager initialized');
  }

  log(message, context = {}) {
    if (this.logger) {
      this.logger.debug(`[AccountManager] ${message}`, context);
    }
  }

  /**
   * Add account for a platform
   * @param {string} platform - Platform name
   * @param {object} credentials - Account credentials (will be encrypted in production)
   * @returns {Promise<void>}
   */
  async addAccount(platform, credentials) {
    // WARNING: In production, encrypt credentials before storing
    // For MVP/demo, storing in memory only

    this.accounts.set(platform, {
      credentials: this.obfuscate(credentials),
      status: 'active',
      addedAt: new Date().toISOString(),
      lastUsed: null,
      lastHealthCheck: null,
    });

    this.log('Account added', { platform });
  }

  /**
   * Simple obfuscation (NOT encryption - use proper encryption in production)
   * @private
   */
  obfuscate(credentials) {
    // In production, use proper encryption (crypto.subtle, libsodium, etc.)
    // This is just basic obfuscation for demo purposes
    return {
      _obfuscated: true,
      data: Buffer.from(JSON.stringify(credentials)).toString('base64'),
    };
  }

  /**
   * Deobfuscate credentials
   * @private
   */
  deobfuscate(obfuscated) {
    if (!obfuscated._obfuscated) {
      return obfuscated;
    }
    return JSON.parse(Buffer.from(obfuscated.data, 'base64').toString());
  }

  /**
   * Get account for platform
   * @param {string} platform - Platform name
   * @returns {Promise<object|null>} Account credentials
   */
  async getAccount(platform) {
    const account = this.accounts.get(platform);

    if (!account) {
      this.log('Account not found', { platform });
      return null;
    }

    if (account.status !== 'active') {
      this.log('Account not active', { platform, status: account.status });
      return null;
    }

    // Update last used timestamp
    account.lastUsed = new Date().toISOString();

    this.log('Account retrieved', { platform });
    return this.deobfuscate(account.credentials);
  }

  /**
   * Update account credentials
   * @param {string} platform - Platform name
   * @param {object} newCredentials - New credentials
   */
  async rotateCredentials(platform, newCredentials) {
    const account = this.accounts.get(platform);

    if (!account) {
      throw new Error(`Account not found for platform: ${platform}`);
    }

    account.credentials = this.obfuscate(newCredentials);
    account.lastRotation = new Date().toISOString();

    this.log('Credentials rotated', { platform });
  }

  /**
   * Check account health
   * @param {string} platform - Platform name
   * @returns {Promise<object>} Health status
   */
  async checkAccountHealth(platform) {
    const account = this.accounts.get(platform);

    if (!account) {
      return {
        platform,
        healthy: false,
        reason: 'Account not found',
      };
    }

    // Basic health check - in production, would test actual platform connectivity
    const daysSinceLastUse = account.lastUsed
      ? (Date.now() - new Date(account.lastUsed).getTime()) / 86400000
      : 0;

    const healthy = account.status === 'active';

    account.lastHealthCheck = new Date().toISOString();

    this.log('Health check performed', { platform, healthy });

    return {
      platform,
      healthy,
      status: account.status,
      daysSinceLastUse,
      lastHealthCheck: account.lastHealthCheck,
    };
  }

  /**
   * List all accounts
   * @returns {Promise<Array>} Account list (without credentials)
   */
  async listAccounts() {
    const accounts = [];

    for (const [platform, account] of this.accounts.entries()) {
      accounts.push({
        platform,
        status: account.status,
        addedAt: account.addedAt,
        lastUsed: account.lastUsed,
        lastHealthCheck: account.lastHealthCheck,
      });
    }

    return accounts;
  }

  /**
   * Remove account
   * @param {string} platform - Platform name
   */
  async removeAccount(platform) {
    if (this.accounts.delete(platform)) {
      this.log('Account removed', { platform });
      return true;
    }
    return false;
  }

  /**
   * Disable account temporarily
   * @param {string} platform - Platform name
   * @param {string} reason - Reason for disabling
   */
  async disableAccount(platform, reason = '') {
    const account = this.accounts.get(platform);

    if (account) {
      account.status = 'disabled';
      account.disabledAt = new Date().toISOString();
      account.disabledReason = reason;
      this.log('Account disabled', { platform, reason });
    }
  }

  /**
   * Enable account
   * @param {string} platform - Platform name
   */
  async enableAccount(platform) {
    const account = this.accounts.get(platform);

    if (account) {
      account.status = 'active';
      account.enabledAt = new Date().toISOString();
      this.log('Account enabled', { platform });
    }
  }
}
