# Premium AI Discord bot via Discord App Subscriptions

**Rank #131 · Tier B · Priority score 50/100 · Category: AI-native income**

Build a useful AI-powered Discord bot (moderation, summaries, game master, translation) and sell premium tiers natively in Discord.

## Scores

| Metric | Value |
| --- | --- |
| Payment probability (6 months) | 3/10 |
| Automation after setup | 8/10 |
| Setup effort (1 = trivial) | 5/10 |
| Ongoing effort (1 = none) | 3/10 |
| Income potential | 6/10 |
| AI leverage | 9/10 |
| Legal in reference countries | 100% |
| Platform pays out in reference countries | 14% |
| Capital required | $20 |
| Time to first dollar | 30–180 d |
| Typical monthly income (low / median / high) | $0 / $30 / $3,000 |

## Realistic expectations

Most people who try this earn around **$0–$30 per month** in the first year; the high figure of $3,000 is a ceiling for a focused solo operator, not a typical outcome. The chance of receiving at least one real payout within six months is rated **3/10**. Expect the first payment after 30–180 d.

## How it works

Discord lets verified apps sell subscriptions and one-time SKUs inside Discord. An AI bot that summarizes channels, translates, moderates or runs games can charge per server or per user. Coding agents can build and maintain the bot; usage costs (LLM API) must be below the subscription price. Discord pays out via Stripe after a monetization eligibility review.

**Platforms:** Discord App Subscriptions / Premium Apps, Top.gg (discovery)

## Resources & business plan

### What you need to start

| Resource | Amount |
| --- | --- |
| Time to launch | 60 hours |
| One-time cash | $20 |
| Recurring fixed cost | $15 / month |
| Tools | Discord Developer Portal (free); bot hosting (~$5/mo); LLM API floor (~$10/mo); Top.gg listing (free) |
| Skills | bot development (discord.js/discord.py; AI covers most); LLM cost control and rate limiting; community support |
| Equipment | laptop or desktop; stable internet |
| Accounts | Discord developer team (US/UK/EU-based for native Premium Apps); Stripe account via Discord monetization onboarding |

### How the money is made (unit economics)

| Metric | Value |
| --- | --- |
| Unit | per subscriber-month |
| Typical price per unit (low / median / high) | $2 / $5 / $15 |
| Direct cost per unit | $2 |
| Platform fee | 15% |
| Gross margin (median case) | 45% |
| Human hours per unit after automation | 0.05 |

Premium bot subscriptions typically cost $3-$10/month per server or user; Discord's 15% share (30% above $1M cumulative sales) is per its Premium Apps Payout article, as in payout notes; cost = LLM usage plus processing (estimate).

### Break-even

| Metric | Value |
| --- | --- |
| Monthly fixed cost | $15 |
| Units per month to break even | 7 |
| Typical months to break even | 7 |
| Months to recover startup cash | 2 |

Fixed cost = recurringMonthlyUsd only (startup cash not amortised). About 7 median subscribers cover hosting and API floor; first payout additionally needs $100 earned and a manual review.

### Market conditions (Nov 2026)

| Factor | Assessment |
| --- | --- |
| Demand trend | stable |
| Competition | high |
| Effect of AI | neutral |
| Price pressure | stable |
| **Chance of real net profit within 12 months** (≥ $100/month where the plan can pay that much) | **5%** |
| Typical net profit at month 12 (low / median / high) | $-15 / $15 / $2,000 |

Bots with a strong community niche (game servers, translation, moderation) convert; generic AI chat bots compete with free bots and Discord's own features. Native monetization is only for US/UK/EU teams, limiting eligibility to ~14% of reference countries. Failure mode: LLM costs outpace subscriptions, or installs never convert.

### Pricing strategy

Free tier with daily limits, $3-$5 server subscription for higher limits; add higher tiers for large servers once usage data shows heavy users.

### Path to profit

1. Month 0: build bot, apply for monetization (cost $20)
2. Month 1-2: list on Top.gg; $0-$10
3. Month 3-6: 10-30 subscribers; $20-$100/month
4. Month 6-12: tune costs, upsell big servers; $15 median net

_Business-plan sources:_

- <https://support-dev.discord.com/hc/en-us/articles/17299902720919-Premium-Apps-Payout>
- <https://docs.discord.com/developers/monetization/enabling-monetization>

## Payout path

- **Methods:** Stripe -> bank
- **Minimum payout:** $100 earned for first payout (after a manual eligibility review); $25 thereafter
- **Frequency:** monthly, within 45 days after month end
- **Typical delay:** 45 days
- **Notes:** Developers keep 85% (15% platform fee) on the first $1M cumulative gross sales, then 70%, less processing fees. Payouts are not automatic: Developer Support runs a payout eligibility review first. Native Premium Apps only for teams based in the US, UK or EU; others need external billing where Discord policy allows.

## Full cycle (setup → earn → bank account)

1. Register app
2. Build bot
3. Add premium SKU
4. Grow installs
5. Users subscribe
6. Payout via Stripe

## What can be automated

- Coding agent builds and deploys bot
- Auto-scaling hosting and cost monitoring
- Agent writes listing copy for Top.gg
- Automated support FAQ

## Unavoidable manual steps

- Discord developer team verification
- Monetization eligibility review
- Stripe KYC

## Legality & compliance

Legal; must follow Discord Developer Policy (no data selling, privacy policy required, no message logging beyond need).

- **Compliance requirements:** report income for tax; Discord team verification; Stripe KYC; privacy policy and ToS
- **Platform availability:** Native Premium Apps limited to US/UK/EU-based developers: of the reference countries only US, UK, Germany, France, Italy, Estonia and Hungary = 14%.

## Risks

- LLM costs vs subscription price
- Discord policy changes
- Bot discovery is hard

## Evidence that people get paid

Discord's official 'Premium Apps Payout' article documents Stripe payouts, the $100/$25 thresholds, 45-day timing and the 85/15 split.

## Sources

- <https://support-dev.discord.com/hc/en-us/articles/17299902720919-Premium-Apps-Payout>
- <https://docs.discord.com/developers/monetization/enabling-monetization>
- <https://discord.com/blog/premium-app-subscriptions-for-discord-developers>

_Tags: developer, bot, recurring, subscriptions_

---

_Generated from `data/strategies/ai-native.json` by `npm run build:catalog`. Edit the JSON, not this file._
