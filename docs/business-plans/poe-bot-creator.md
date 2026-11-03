# Build monetized bots on Poe (per-message pricing)

**Rank #104 · Tier B · Priority score 53/100 · Category: AI-native income**

Publish AI bots on Quora's Poe, set a per-message price, and get paid by Poe for every message your bot answers.

## Scores

| Metric | Value |
| --- | --- |
| Payment probability (6 months) | 3/10 |
| Automation after setup | 8/10 |
| Setup effort (1 = trivial) | 3/10 |
| Ongoing effort (1 = none) | 3/10 |
| Income potential | 5/10 |
| AI leverage | 9/10 |
| Legal in reference countries | 100% |
| Platform pays out in reference countries | 24% |
| Capital required | $0 |
| Time to first dollar | 14–180 d |
| Typical monthly income (low / median / high) | $0 / $10 / $2,000 |

## Realistic expectations

Most people who try this earn around **$0–$10 per month** in the first year; the high figure of $2,000 is a ceiling for a focused solo operator, not a typical outcome. The chance of receiving at least one real payout within six months is rated **3/10**. Expect the first payment after 14–180 d.

## How it works

Poe hosts thousands of bots built on frontier models. Creators build prompt bots or server bots (your own code via the Poe API) that solve a specific job: e.g. a specialized converter, tutor or image workflow. You join creator monetization at poe.com/creators and set a price per message (up to $10,000 per 1,000 messages); Poe pays you that price for each message your bot responds to. An agent can build, test and iterate server bots, write descriptions, and track usage. Earnings depend on discovery inside Poe.

**Platforms:** Poe (Quora)

## Resources & business plan

### What you need to start

| Resource | Amount |
| --- | --- |
| Time to launch | 20 hours |
| One-time cash | $0 |
| Recurring fixed cost | $5 / month |
| Tools | Poe creator account (free); server bot hosting (~$5/mo, e.g. Modal/Fly free-to-low tiers); LLM API credits for server bots |
| Skills | prompt engineering; Python for server bots (AI coding agent covers most); describing a bot's niche clearly |
| Equipment | laptop or desktop; stable internet |
| Accounts | Poe account + creator monetization (eligible region); Stripe account + tax info within 90 days |

### How the money is made (unit economics)

| Metric | Value |
| --- | --- |
| Unit | per 1,000 paid messages |
| Typical price per unit (low / median / high) | $2 / $10 / $100 |
| Direct cost per unit | $2 |
| Platform fee | 0% |
| Gross margin (median case) | 80% |
| Human hours per unit after automation | 0 |

Creators set the per-message price; a few dollars to tens of dollars per 1,000 messages is common for useful bots (estimate). Cost = model/API usage for server bots; prompt bots cost $0. Poe's earnings terms confirm creators set a per-message price but publish no rate or fee.

### Break-even

| Metric | Value |
| --- | --- |
| Monthly fixed cost | $5 |
| Units per month to break even | 1 |
| Typical months to break even | 6 |
| Months to recover startup cash | 0 |

Fixed cost = recurringMonthlyUsd only (startup cash not amortised). Fixed cost is server hosting only; one median block of 1,000 messages covers it.

### Market conditions (Nov 2026)

| Factor | Assessment |
| --- | --- |
| Demand trend | declining |
| Competition | saturated |
| Effect of AI | headwind |
| Price pressure | falling |
| **Chance of real net profit within 12 months** (≥ $100/month where the plan can pay that much) | **3%** |
| Typical net profit at month 12 (low / median / high) | $-5 / $5 / $800 |

A handful of specialised bots with retained users earn; most get no discovery. Poe has changed creator terms several times (the current FAQ lists only per-message earnings), and frontier chat apps now offer agents and apps that overlap with bots. Failure mode: no traffic, or API costs above earnings for server bots.

### Pricing strategy

Start below competing bots' per-message price to attract usage, then raise for power users once the bot shows retention; never price below your model cost per message.

### Path to profit

1. Month 0: build 2-3 bots including one server bot (cost $0-$5/mo)
2. Month 1-2: iterate; $0-$10
3. Month 3-6: improve the bot with retention; $5-$50/month
4. Month 6-12: port the winner to other channels; $5-$300/month

_Business-plan sources:_

- <https://help.poe.com/hc/en-us/articles/21921312368020-Poe-Creator-Monetization-FAQs>
- <https://creator.poe.com/docs/creator-monetization>
- <https://poe.com/pages/earnings-tos>

## Payout path

- **Methods:** Stripe -> bank
- **Minimum payout:** $10
- **Frequency:** monthly, 30-45 days after month end
- **Typical delay:** 45 days
- **Notes:** Taxpayer info must be submitted within 90 days of joining. Eligible regions (official FAQ): Argentina, Australia, Belgium, Canada, Colombia, Denmark, Finland, Germany, Hong Kong, India, Ireland, Italy, Japan, Mexico, Netherlands, Norway, Portugal, Singapore, Spain, Sweden, Switzerland, UK, US. The current FAQ describes only per-message earnings (no subscription-referral share).

## Full cycle (setup → earn → bank account)

1. Sign up on Poe
2. Build bot
3. Set per-message price
4. Publish and promote
5. Users pay points per message
6. Monthly Stripe payout

## What can be automated

- Agent builds server bots via Poe API and fastapi-poe
- Auto-generate descriptions/sample prompts
- Monitor usage and adjust per-message price
- A/B test bot variants

## Unavoidable manual steps

- Create Poe creator account
- Stripe KYC and bank
- Decide pricing

## Legality & compliance

Legal; bots must follow Poe and underlying-model usage policies.

- **Compliance requirements:** report income for tax; Stripe KYC; Poe usage guidelines
- **Platform availability:** Only 23 eligible regions; of the reference countries just 12 qualify (US, Canada, UK, Germany, Italy, Japan, Australia, Argentina, Colombia, Mexico, India, Singapore) = ~24%.

## Risks

- Discovery is winner-take-most
- Terms changed several times since 2023
- Underlying model costs can eat margin for server bots

## Evidence that people get paid

Poe's official Creator Monetization FAQ documents per-message pricing, Stripe payouts, the $10 threshold and the 23-region eligibility list; Quora raised $75M from a16z largely to fund creator payouts.

## Sources

- <https://help.poe.com/hc/en-us/articles/21921312368020-Poe-Creator-Monetization-FAQs>
- <https://creator.poe.com/docs/creator-monetization>
- <https://techcrunch.com/2023/10/31/quoras-poe-introduces-an-ai-chatbot-creator-economy/amp>

_Tags: chatbot, marketplace, recurring_

---

_Generated from `data/strategies/ai-native.json` by `npm run build:catalog`. Edit the JSON, not this file._
