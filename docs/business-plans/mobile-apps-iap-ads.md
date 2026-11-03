# Mobile apps on App Store/Google Play (IAP + AdMob)

**Rank #171 · Tier C · Priority score 46/100 · Category: Software & developer monetization**

Publish utility or casual apps and earn via in-app purchases/subscriptions (15% store fee under $1M) and AdMob ads.

## Scores

| Metric | Value |
| --- | --- |
| Payment probability (6 months) | 4/10 |
| Automation after setup | 6/10 |
| Setup effort (1 = trivial) | 6/10 |
| Ongoing effort (1 = none) | 4/10 |
| Income potential | 7/10 |
| AI leverage | 8/10 |
| Legal in reference countries | 100% |
| Platform pays out in reference countries | 90% |
| Capital required | $125 (−8 points) |
| Time to first dollar | 30–240 d |
| Typical monthly income (low / median / high) | $0 / $50 / $5,000 |

## Realistic expectations

Most people who try this earn around **$0–$50 per month** in the first year; the high figure of $5,000 is a ceiling for a focused solo operator, not a typical outcome. The chance of receiving at least one real payout within six months is rated **4/10**. Expect the first payment after 30–240 d.

## How it works

Build focused apps (utilities, trackers, niche tools, simple games) with cross-platform frameworks. Users pay via IAP/subscriptions; Apple and Google take 15% under small-business tiers. Free users generate ad revenue via AdMob. Ongoing work is ASO, updates for OS changes, and policy compliance. Google Play requires 12 testers for 14 days for new personal accounts.

**Platforms:** Apple App Store, Google Play, Google AdMob

## Resources & business plan

### What you need to start

| Resource | Amount |
| --- | --- |
| Time to launch | 120 hours |
| One-time cash | $125 |
| Recurring fixed cost | $10 / month |
| Tools | Apple Developer Program ($99/yr); Google Play developer ($25 one-time); Flutter/React Native (free); AdMob (free); RevenueCat (free tier) |
| Skills | mobile development (AI-assisted); App Store Optimization; handling review guidelines and privacy forms |
| Equipment | laptop (a Mac is needed for iOS builds); test smartphone |
| Accounts | Apple Developer account + tax/banking; Google Play Console + identity verification; AdMob account |

### How the money is made (unit economics)

| Metric | Value |
| --- | --- |
| Unit | per paying user-month |
| Typical price per unit (low / median / high) | $1 / $5 / $15 |
| Direct cost per unit | $0 |
| Platform fee | 15% |
| Gross margin (median case) | 85% |
| Human hours per unit after automation | 0.02 |

Utility app subscriptions typically run $2-$10/month; Apple/Google take 15% under small-business tiers; backend cost per user is a few cents (rounded to $0). Google Play subscriptions in the US/EEA/UK/JP/AU are 10% + 5% billing fee (still 15%).

### Break-even

| Metric | Value |
| --- | --- |
| Monthly fixed cost | $10 |
| Units per month to break even | 3 |
| Typical months to break even | 6 |
| Months to recover startup cash | 7 |

Fixed cost = recurringMonthlyUsd only (startup cash not amortised). Recurring cost is mainly the Apple fee amortised (~$8/mo) plus a small backend; ad revenue is excluded from break-even.

### Market conditions (Nov 2026)

| Factor | Assessment |
| --- | --- |
| Demand trend | stable |
| Competition | saturated |
| Effect of AI | neutral |
| Price pressure | stable |
| **Chance of real net profit within 12 months** (≥ $100/month where the plan can pay that much) | **8%** |
| Typical net profit at month 12 (low / median / high) | $-10 / $30 / $3,000 |

Winners combine ASO with paid acquisition or an existing audience; AI-assisted building in 2025-2026 drove a surge in new submissions, raising discovery difficulty. The 2025 US court ruling allowing external payment links in US App Store apps cuts fees for those who can steer users to web checkout. Failure mode: new Google personal accounts need 12 testers for 14 days, and most apps get under 100 downloads.

### Pricing strategy

Use a free tier with a paywall on one compelling feature and weekly/annual subscription options; test price increases with RevenueCat experiments after 1,000 installs.

### Path to profit

1. Month 0: build MVP, enroll in both stores (cost $125)
2. Month 1-2: closed testing, launch; $0-$20
3. Month 3-6: ASO iterations and paywall tests; $10-$100/month
4. Month 6-12: localise listings and add features; $30-$1,000/month for top quartile

_Business-plan sources:_

- <https://developer.apple.com/app-store/small-business-program/>
- <https://support.google.com/googleplay/android-developer/answer/112622>
- <https://support.google.com/admob/answer/2772208>

## Payout path

- **Methods:** Bank transfer (Apple, Google), AdMob: EFT, wire, Western Union Quick Cash, check where EFT unavailable, PayPal Hyperwallet (US only)
- **Minimum payout:** Apple: $40 default (as low as $0.02 for US/EU banks); Google Play: not re-confirmed; AdMob: $100 / EUR70 / GBP60
- **Frequency:** monthly
- **Typical delay:** 45 days
- **Notes:** Apple pays within 45 days of fiscal month end; AdMob pays on or around the 21st of the following month once the threshold is met. Google Play: 15% on first $1M/yr, 15% on subscriptions (10% + 5% billing fee in AU/EEA/JP/UK/US).

## Full cycle (setup → earn → bank account)

1. Pay developer fees
2. Build app
3. Integrate IAP/AdMob
4. Publish
5. Users download/pay
6. Monthly bank payout

## What can be automated

- AI agent builds Flutter/React Native apps
- Fastlane CI for builds and store uploads
- Automated ASO experiments and screenshot generation
- Mediation and ad config automation

## Unavoidable manual steps

- Developer account verification
- App review responses
- Tester recruitment for Google Play

## Legality & compliance

Legal; apps must meet local content rules and privacy laws.

- **Compliance requirements:** Apple $99/yr and Google $25 one-time developer fees; privacy policy/consent (GDPR/UMP); tax forms; D-U-N-S for org accounts
- **Platform availability:** Google Play merchant registration supported in ~200 locations; AdMob payments broadly available.

## Risks

- App review rejections
- Low ad eCPM in many regions
- Discoverability
- Account bans for policy violations

## Evidence that people get paid

Apple Small Business Program (15%), Apple's minimum payment threshold table, Google Play's 15% tier, and AdMob's payment threshold ($100/EUR70/GBP60) and ~21st payment date are all documented on official help pages.

## Sources

- <https://developer.apple.com/app-store/small-business-program/>
- <https://support.google.com/googleplay/android-developer/answer/112622>
- <https://support.google.com/admob/answer/2772140>
- <https://support.google.com/admob/answer/2772208>
- <https://developer.apple.com/help/app-store-connect/reference/reporting/minimum-payment-threshold>

_Tags: mobile, ads, iap, ai-assisted_

---

_Generated from `data/strategies/software.json` by `npm run build:catalog`. Edit the JSON, not this file._
