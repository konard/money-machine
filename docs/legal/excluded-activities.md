# Excluded activities

The catalog admits only ways of getting paid that are legal for residents in at least 80% of the [reference countries](./reference-countries.md) and that comply with platform Terms of Service. This page records what was evaluated and left out, and why, so the decision can be revisited when laws or platforms change.

Reference set: roughly 50 countries. The cutoff is legal in at least 40 of them.

## Excluded by rule (never admitted)

| Activity                                                            | Reason                                                                                                                                                       |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Online gambling, betting, casino affiliates, gambling streams       | Banned for residents in many reference countries (e.g. Bangladesh, Libya, Iraq, Jordan, Lebanon, Morocco, Indonesia, Cambodia, Thailand). Project rule.      |
| Prediction markets (Polymarket, Kalshi and similar)                 | Treated as gambling or unlicensed derivatives; geo-blocked or banned in France, Belgium, Poland, Singapore, Thailand, Taiwan and others.                     |
| Adult content and adult or dating CPA offers                        | Illegal or criminalised in a large share of the reference set. Project rule.                                                                                 |
| Multi-level marketing and pyramid recruiting                        | Illegal where income depends on recruiting; deceptive by design. Project rule.                                                                               |
| Unlicensed financial advice, signals groups, copy-trading           | Requires a licence almost everywhere; copy-trading is portfolio management under EU rules.                                                                   |
| Retail forex and CFD trading                                        | Banned in the US; restricted to licensed domestic brokers in India, Bangladesh, Nepal, Indonesia, Malaysia, Nigeria and others. Lottery-like odds of payout. |
| Peer-to-peer lending and crowdlending                               | Lending to individuals needs a moneylender or consumer-credit licence in the UK, Singapore, Malaysia, India, Kenya, Nigeria and more. Project rule.          |
| Crypto lending and exchange "Earn" products                         | Outright crypto bans in six reference countries plus retail restrictions in Singapore, Thailand, the US and the UK. History of platform collapses.           |
| Invoice-trading marketplaces as an investor                         | Lending; institutional or accredited-only in practice.                                                                                                       |
| Selling personal data                                               | Violates GDPR-style laws across most of the reference set.                                                                                                   |
| Spam, incentivised installs, paid-to-click, fake reviews, bot farms | Against platform Terms of Service and consumer-protection law (FTC, ASA, EU UCPD). Project rule.                                                             |
| Account selling, multi-accounting, cloning other people's voices    | Against platform Terms of Service; voice cloning may breach likeness and publicity laws.                                                                     |
| Pay-to-earn schemes that require buying in                          | Project rule. Example: Civitai's creator program requires a paid membership to cash out.                                                                     |
| Loan, credit and paid legal-referral lead generation                | Needs lending or referral licences in many jurisdictions. Pay-per-lead is kept only for B2B, solar and home services.                                        |
| Certified or sworn translation, tax, legal, medical advice          | Licensed professions. Kept out of the service strategies.                                                                                                    |

## Excluded by the 80% coverage test

| Activity                           | Estimated legal coverage | Notes                                                                                                                                                                                                                       |
| ---------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Proof-of-stake crypto staking      | ~82% (borderline)        | Bans in Bangladesh, Nepal, Morocco, Tunisia, Iraq, Libya; retail staking restricted in Singapore and Thailand; Zimbabwe uncertain. Dropped under a strict reading, also because it needs capital and carries platform risk. |
| Crypto-token-paid compute (io.net) | ~82%                     | Same crypto bans. Vast.ai pays in ordinary currency and covers the same use case.                                                                                                                                           |
| Sia storage hosting                | ~82% and buy-in          | New hosts must buy Siacoin as collateral, which is also a pay-to-earn buy-in.                                                                                                                                               |

Storj storage nodes remain in the catalog at 82% coverage with the banned countries listed under `legality.restrictedIn`. If the project adopts a stricter reading, remove `rent-storage-storj-node` from `data/strategies/licensing.json`.

## Excluded because the program is closed or does not pay

| Program                                                                   | Status found (Nov 2026)                                                                    |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Amazon Mechanical Turk                                                    | Permanently closed on 30 September 2026 per the official worker help page.                 |
| Pinterest Creator Rewards                                                 | Ended 30 November 2022; no direct creator payout program now.                              |
| LinkedIn creator program                                                  | No open revenue-share program found.                                                       |
| Songtradr open marketplace                                                | Closed 1 September 2026; licensing is invite-only.                                         |
| RunPod Community Cloud hosting                                            | Closed to new hosts per RunPod docs.                                                       |
| Replit Bounties                                                           | Believed discontinued; not confirmed.                                                      |
| Figma Community paid resources                                            | Not approving new paid sellers per Figma help center.                                      |
| Hugging Face / Replicate model hosting                                    | No revenue share for model authors. Only wrapping a model as a paid API pays.              |
| OpenAI GPT Store builder revenue                                          | US-only invite pilot; no confirmation it pays builders broadly in 2026.                    |
| ChatGPT Apps (Apps SDK)                                                   | No builder payout; checkout is a limited private beta.                                     |
| AI agent marketplaces (MindStudio, Agent.ai, Relevance AI, Lindy, Zapier) | No evidence any pays builders a revenue share.                                             |
| Patent and invention licensing marketplaces                               | Needs $5k–15k+ to file; lottery odds; history of invention-promotion scams (FTC actions).  |
| Fetch (receipts app)                                                      | Pays gift cards only, so no path to a bank account. Rakuten is the cash alternative.       |
| Epidemic Sound                                                            | Invite or deal based; no open self-serve payout path.                                      |
| AI-generated music sync licensing                                         | No sync library confirmed to accept fully AI-generated tracks; distributors blocking them. |

## Content rules that shaped the entries

Fully automated, bulk AI-generated content is not relied on anywhere, because the main platforms forbid or demonetise it: YouTube's inauthentic-content policy, Meta's unoriginal-content rules, Medium's ban on fully AI stories behind the paywall, Amazon KDP's AI disclosure rule and limit of three new titles per day, Spotify and Deezer spam filters, Shutterstock's and Pond5's bans on AI submissions, Envato's ban on AI as the main part of a submission, Upwork's 2025 rule against misrepresenting AI output and Fiverr's ban on mass-produced AI gigs. Every entry treats AI as assistance with human review, and uses AI-generated assets only where the platform explicitly allows and labels them (Adobe Stock, Freepik, Fab, Etsy with disclosure).

## Revisiting a decision

Open a pull request that cites an official source showing the law or program changed, and update the JSON in `data/strategies/`. The build script applies the 80% gate automatically, so an entry can be added with its honest coverage number and will appear once it passes.
