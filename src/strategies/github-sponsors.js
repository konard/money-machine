/**
 * GitHub Sponsors Strategy
 *
 * A real money-making strategy that tracks and reports GitHub Sponsors income.
 * This is the simplest strategy to implement as it:
 * 1. Uses the GITHUB_TOKEN already available in GitHub Actions
 * 2. Has clear verification via GitHub's GraphQL API
 * 3. Requires minimal external dependencies
 *
 * To make money with this strategy, the repository owner needs to:
 * 1. Enable GitHub Sponsors for their account
 * 2. Create sponsor tiers
 * 3. Attract sponsors through valuable open source work
 */

import { StrategyModule } from './base.js';

/**
 * GraphQL query to fetch sponsorship data for a user/organization
 */
const SPONSORS_QUERY = `
query($login: String!) {
  user(login: $login) {
    login
    sponsorsListing {
      fullDescription
      activeGoal {
        title
        percentComplete
        targetValue
      }
    }
    sponsors(first: 100) {
      totalCount
      nodes {
        ... on User {
          login
        }
        ... on Organization {
          login
        }
      }
    }
    sponsorshipsAsMaintainer(first: 100, includePrivate: false, activeOnly: true) {
      totalCount
      totalRecurringMonthlyPriceInCents
      totalRecurringMonthlyPriceInDollars
      nodes {
        isOneTimePayment
        privacyLevel
        tier {
          name
          monthlyPriceInCents
          monthlyPriceInDollars
          isOneTime
        }
        createdAt
      }
    }
    lifetimeReceivedSponsorshipValues(first: 1) {
      totalCount
    }
    hasSponsorsListing
    isSponsoringViewer
    monthlyEstimatedSponsorsIncomeInCents
  }
}
`;

/**
 * GraphQL query for organization sponsors data
 */
const ORG_SPONSORS_QUERY = `
query($login: String!) {
  organization(login: $login) {
    login
    sponsorsListing {
      fullDescription
      activeGoal {
        title
        percentComplete
        targetValue
      }
    }
    sponsors(first: 100) {
      totalCount
      nodes {
        ... on User {
          login
        }
        ... on Organization {
          login
        }
      }
    }
    sponsorshipsAsMaintainer(first: 100, includePrivate: false, activeOnly: true) {
      totalCount
      totalRecurringMonthlyPriceInCents
      totalRecurringMonthlyPriceInDollars
      nodes {
        isOneTimePayment
        privacyLevel
        tier {
          name
          monthlyPriceInCents
          monthlyPriceInDollars
          isOneTime
        }
        createdAt
      }
    }
    hasSponsorsListing
    monthlyEstimatedSponsorsIncomeInCents
  }
}
`;

/**
 * Safely get environment variable (Deno-compatible)
 * @param {string} name - Environment variable name
 * @returns {string|undefined} The value or undefined
 */
function safeGetEnv(name) {
  try {
    // Check if we're in Deno
    if (typeof Deno !== 'undefined' && Deno.env) {
      return Deno.env.get(name);
    }
    // Node.js / Bun
    return process.env[name];
  } catch {
    // Permission denied or not available
    return undefined;
  }
}

export class GitHubSponsorsStrategy extends StrategyModule {
  get name() {
    return 'github-sponsors';
  }

  get description() {
    return 'Track and report GitHub Sponsors income with verification';
  }

  /**
   * Full step-by-step execution guide covering the complete money cycle:
   * setup → earn → receive money in a real bank account.
   *
   * Steps are ordered, atomic, and simple enough for anyone to follow.
   * Each step is marked as 'manual' or 'automated'.
   *
   * @returns {object} Complete execution guide
   */
  static getExecutionGuide() {
    return {
      name: 'GitHub Sponsors Strategy',
      fullCycle: true,
      summary:
        'Earn money by accepting sponsorships on GitHub. ' +
        'Sponsors pay you monthly via credit card. ' +
        'GitHub transfers funds to your bank account via Stripe.',
      steps: [
        {
          id: 1,
          title: 'Create a GitHub account (if you do not have one)',
          description:
            'Go to github.com and sign up for a free account. ' +
            'You need this to enable GitHub Sponsors.',
          type: 'manual',
          url: 'https://github.com/signup',
          action: 'Click "Sign up", fill in username, email, and password',
          verification: 'You receive a confirmation email and can log in',
          automationHint: 'Requires human identity verification (CAPTCHA)',
        },
        {
          id: 2,
          title: 'Enable GitHub Sponsors for your account',
          description:
            'Apply to join GitHub Sponsors. GitHub reviews your application ' +
            'and approves it (usually within a few days).',
          type: 'manual',
          url: 'https://github.com/sponsors',
          action:
            'Click "Get sponsored", fill in your profile, ' +
            'agree to the terms, and submit the application',
          verification:
            'You see "Your application is under review" on the sponsors page',
          automationHint:
            'Requires human identity verification and agreement to terms',
        },
        {
          id: 3,
          title: 'Connect a Stripe account for payouts',
          description:
            'GitHub uses Stripe to transfer your earnings to a bank account. ' +
            'You connect Stripe during the GitHub Sponsors setup or from your ' +
            'sponsors dashboard.',
          type: 'manual',
          url: 'https://github.com/sponsors/dashboard',
          action:
            'In the Sponsors dashboard, click "Connect with Stripe", ' +
            'then follow the Stripe onboarding to enter your bank account details',
          verification:
            'Stripe dashboard shows your bank account as verified and connected',
          automationHint:
            'Requires human identity verification (Stripe KYC/AML checks)',
        },
        {
          id: 4,
          title: 'Create sponsor tiers',
          description:
            'Set up one or more monthly sponsorship tiers so sponsors know ' +
            'what they get for each amount (e.g., $5/month, $25/month).',
          type: 'manual',
          url: 'https://github.com/sponsors/dashboard',
          action:
            'Click "Tiers", then "Add tier", set a price and description, ' +
            'and click "Save tier"',
          verification: 'Your sponsor profile shows at least one active tier',
          automationHint:
            'Could be automated via GitHub GraphQL API mutations, ' +
            'but initial creation requires dashboard access for review',
        },
        {
          id: 5,
          title: 'Add the GITHUB_TOKEN secret to your repository',
          description:
            'The strategy needs a GitHub token with read:user scope to ' +
            'fetch your sponsorship data via the API.',
          type: 'manual',
          url: 'https://github.com/settings/tokens',
          action:
            'Click "Generate new token (classic)", select "read:user" scope, ' +
            'copy the token. Then go to your repository Settings → Secrets → Actions, ' +
            'click "New repository secret", name it GITHUB_TOKEN_SPONSORS, paste the token',
          verification:
            'The secret appears in your repository Actions secrets list',
          automationHint:
            'Token generation requires human authorization for security reasons',
        },
        {
          id: 6,
          title: 'Run the GitHub Sponsors strategy to check your earnings',
          description:
            'Execute the strategy to fetch your current sponsorship data ' +
            'and verify your monthly income.',
          type: 'automated',
          triggerCommand:
            'GITHUB_TOKEN=your_token GITHUB_REPOSITORY_OWNER=your_login node experiments/test-github-sponsors.js your_login',
          triggerGitHubAction:
            'Go to Actions tab → "Execute Strategy" workflow → "Run workflow" button',
          verification:
            'Output shows your monthly income, sponsor count, and sponsorship tiers',
          automationHint: 'Fully automated — runs on a schedule or on demand',
        },
        {
          id: 7,
          title: 'Receive your payout',
          description:
            'GitHub processes payouts monthly. ' +
            'Funds are transferred to the bank account you connected in Step 3.',
          type: 'manual',
          url: 'https://github.com/sponsors/dashboard',
          action:
            'No action required — payouts happen automatically each month ' +
            'once you have a positive balance above the minimum threshold ($100 USD). ' +
            'Check your Stripe dashboard to confirm the transfer.',
          verification: 'Your bank account shows a deposit from Stripe/GitHub',
          automationHint:
            'Payouts are processed automatically by GitHub and Stripe',
        },
      ],
      payoutPath: {
        platform: 'GitHub Sponsors via Stripe',
        minimumPayout: '$100 USD',
        payoutTime: 'Monthly (approximately 30 days after month end)',
        bankConnectionUrl: 'https://github.com/sponsors/dashboard',
        instructions:
          'During GitHub Sponsors setup (Step 3), click "Connect with Stripe". ' +
          'Follow Stripe onboarding to verify your identity and enter your bank account ' +
          'routing number and account number. ' +
          'Once approved, all sponsor payments flow through Stripe to your bank automatically.',
      },
      requiredSecrets: [
        {
          name: 'GITHUB_TOKEN',
          description: 'GitHub personal access token with read:user scope',
          howToObtain:
            'https://github.com/settings/tokens → Generate new token (classic) → select read:user',
          minimumPermissions: 'read:user',
        },
      ],
    };
  }

  get requiredAccounts() {
    return []; // Uses GITHUB_TOKEN from environment
  }

  get estimatedTimeToFirstDollar() {
    return 'Variable - depends on project popularity and sponsor tiers';
  }

  get automationLevel() {
    return 0.95; // Highly automated - just needs to track existing sponsors
  }

  /**
   * Initialize the strategy
   * @param {object} context - Initialization context
   */
  initialize(context) {
    this.logger = context.logger;
    this.complianceEngine = context.complianceEngine;
    this.config = {
      githubToken: context.config?.githubToken || safeGetEnv('GITHUB_TOKEN'),
      login: context.config?.login || safeGetEnv('GITHUB_REPOSITORY_OWNER'),
      isOrganization: context.config?.isOrganization || false,
      apiUrl: context.config?.apiUrl || 'https://api.github.com/graphql',
      ...context.config,
    };
    this.status = 'ready';
    this.lastFetchedData = null;

    if (this.logger) {
      this.logger.info('GitHub Sponsors strategy initialized', {
        login: this.config.login,
        hasToken: !!this.config.githubToken,
      });
    }
  }

  /**
   * Execute the strategy - fetch and report sponsorship data
   * @param {object} _context - Execution context
   * @returns {Promise<object>} Execution result
   */
  async execute(_context) {
    if (this.logger) {
      this.logger.info('Executing GitHub Sponsors strategy');
    }

    try {
      // Compliance check
      if (this.complianceEngine) {
        await this.complianceEngine.checkAction(
          {
            type: 'api-call',
            description: 'Fetch GitHub Sponsors data via GraphQL API',
          },
          { platform: 'github' }
        );
      }

      // Fetch sponsorship data
      const sponsorData = await this.fetchSponsorsData();
      this.lastFetchedData = sponsorData;

      // Calculate earnings
      const monthlyIncomeCents =
        sponsorData.monthlyEstimatedSponsorsIncomeInCents || 0;
      const monthlyIncomeDollars = monthlyIncomeCents / 100;

      // Update strategy earnings
      this.earnings = monthlyIncomeDollars;
      this.actions++;

      const result = {
        success: true,
        earnings: monthlyIncomeDollars,
        earningsCents: monthlyIncomeCents,
        currency: 'USD',
        sponsorCount: sponsorData.sponsors?.totalCount || 0,
        activeSponsorships:
          sponsorData.sponsorshipsAsMaintainer?.totalCount || 0,
        hasSponsorsListing: sponsorData.hasSponsorsListing,
        recurringMonthlyIncome:
          sponsorData.sponsorshipsAsMaintainer
            ?.totalRecurringMonthlyPriceInDollars || 0,
        goal: sponsorData.sponsorsListing?.activeGoal || null,
        timestamp: new Date().toISOString(),
        message:
          monthlyIncomeCents > 0
            ? `Monthly sponsorship income: $${monthlyIncomeDollars.toFixed(2)}`
            : 'No sponsorship income detected. Enable GitHub Sponsors to start earning.',
        verificationData: {
          login: this.config.login,
          apiResponse: sponsorData,
          fetchedAt: new Date().toISOString(),
        },
      };

      if (this.logger) {
        this.logger.info('GitHub Sponsors data fetched successfully', {
          earnings: result.earnings,
          sponsorCount: result.sponsorCount,
        });
      }

      return result;
    } catch (error) {
      const errorInfo = {
        timestamp: new Date().toISOString(),
        error: error.message,
        code: error.code || 'UNKNOWN',
      };
      this.errors.push(errorInfo);

      if (this.logger) {
        this.logger.error('GitHub Sponsors strategy execution failed', error);
      }

      return {
        success: false,
        error: error.message,
        errorCode: error.code,
        hint: this.getErrorHint(error),
      };
    }
  }

  /**
   * Fetch sponsors data from GitHub GraphQL API
   * @private
   * @returns {Promise<object>} Sponsors data
   */
  async fetchSponsorsData() {
    if (!this.config.githubToken) {
      throw new Error(
        'GITHUB_TOKEN is required. Set it via environment variable or config.'
      );
    }

    if (!this.config.login) {
      throw new Error(
        'GitHub login is required. Set GITHUB_REPOSITORY_OWNER or provide login in config.'
      );
    }

    const query = this.config.isOrganization
      ? ORG_SPONSORS_QUERY
      : SPONSORS_QUERY;

    const response = await fetch(this.config.apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.githubToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'money-machine-github-sponsors-strategy',
      },
      body: JSON.stringify({
        query,
        variables: { login: this.config.login },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(`GitHub API request failed: ${response.status}`);
      error.code = 'API_ERROR';
      error.statusCode = response.status;
      error.response = errorText;
      throw error;
    }

    const data = await response.json();

    if (data.errors && data.errors.length > 0) {
      const error = new Error(
        `GraphQL errors: ${data.errors.map((e) => e.message).join(', ')}`
      );
      error.code = 'GRAPHQL_ERROR';
      error.graphqlErrors = data.errors;
      throw error;
    }

    const entityData = this.config.isOrganization
      ? data.data?.organization
      : data.data?.user;

    if (!entityData) {
      const error = new Error(
        `No data found for ${this.config.isOrganization ? 'organization' : 'user'}: ${this.config.login}`
      );
      error.code = 'NOT_FOUND';
      throw error;
    }

    return entityData;
  }

  /**
   * Get helpful hints for common errors
   * @private
   * @param {Error} error - The error that occurred
   * @returns {string} Helpful hint for the user
   */
  getErrorHint(error) {
    if (error.message.includes('GITHUB_TOKEN')) {
      return 'Set the GITHUB_TOKEN environment variable with a token that has read:user scope.';
    }
    if (error.message.includes('login')) {
      return 'Set the GITHUB_REPOSITORY_OWNER environment variable to your GitHub username.';
    }
    if (error.code === 'API_ERROR' && error.statusCode === 401) {
      return 'Your GitHub token may be invalid or expired. Generate a new token at github.com/settings/tokens.';
    }
    if (error.code === 'API_ERROR' && error.statusCode === 403) {
      return 'Rate limited or insufficient permissions. Check your token scopes.';
    }
    if (error.code === 'NOT_FOUND') {
      return 'The user/organization was not found. Check the login name is correct.';
    }
    return 'Check the error message above for more details.';
  }

  /**
   * Validate the strategy configuration
   * @param {object} context - Validation context
   * @returns {object} Validation result
   */
  validate(context) {
    const errors = [];

    // Check for token
    const token = context?.config?.githubToken || safeGetEnv('GITHUB_TOKEN');
    if (!token) {
      errors.push(
        'GITHUB_TOKEN environment variable or config.githubToken is required'
      );
    }

    // Check for login
    const login =
      context?.config?.login || safeGetEnv('GITHUB_REPOSITORY_OWNER');
    if (!login) {
      errors.push(
        'GitHub login required via config.login or GITHUB_REPOSITORY_OWNER environment variable'
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: [],
    };
  }

  /**
   * Get current status including last fetched data
   * @returns {object} Current status
   */
  getStatus() {
    const baseStatus = super.getStatus();
    return {
      ...baseStatus,
      lastFetchedData: this.lastFetchedData,
      config: {
        login: this.config?.login,
        isOrganization: this.config?.isOrganization,
        hasToken: !!this.config?.githubToken,
      },
    };
  }

  /**
   * Shutdown the strategy
   */
  shutdown() {
    this.status = 'stopped';
    this.lastFetchedData = null;
    if (this.logger) {
      this.logger.info('GitHub Sponsors strategy shut down');
    }
  }
}
