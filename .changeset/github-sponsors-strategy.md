---
'my-package': minor
---

Add GitHub Sponsors Strategy - first real money-making strategy

NEW FEATURES:

- GitHubSponsorsStrategy: Monitor and track GitHub Sponsors income
- Uses GitHub's GraphQL API to fetch sponsorship data
- Works in GitHub Actions with just GITHUB_TOKEN
- Provides earnings verification with detailed reporting
- Tracks sponsor count, active sponsorships, and monthly income
- Includes helpful error messages and hints for setup

This is the first "test-first" strategy that enables:

1. Verifying actual money is being made via the API
2. Confirming earnings reach bank accounts through Stripe/GitHub payout tracking
3. Running in GitHub Actions with minimal secrets (just GITHUB_TOKEN)

DOCUMENTATION:

- Added experiments/test-github-sponsors.js for live testing
- Updated TypeScript definitions with GitHubSponsorsStrategy types
- Added 7 new tests for the GitHub Sponsors strategy

To use this strategy:

1. Enable GitHub Sponsors at https://github.com/sponsors
2. Set up Stripe Connect for payouts
3. Run the strategy with a valid GITHUB_TOKEN
4. Monitor earnings via the API response
