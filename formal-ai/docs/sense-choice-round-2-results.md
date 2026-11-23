# Sense choice, round 2 — verification

2026-11-04. Production uses public responses plus the existing overrides. No overrides were added. No parser, Russian phrase renderer, or site-builder changes were made by this task. The workspace also contains concurrent work; measurements describe the tested workspace.

## Changes

- `src/senses.mjs`, `src/sense-context.mjs`: clause-local cues with weak cross-clause evidence, guarded topic stems, nonduplicated field evidence, noun countability and reverse attestation, explicit argument frames, and conservative corpus priors.
- `src/resolve.mjs`, `src/sources/*`: definition/label inheritance, section-fragment normalization, sense-qualified synonym references, short nominal definitions for empty domain tables, exact concept compounds, and attested inflected Russian compound heads. Reverse cues come only from the matching Russian definition; ordinary reverse-attested noun defaults remain stable.
- `src/sources/compact.mjs`: preserve Russian definition lines supplying argument markers so recorded and live responses behave identically.
- `tests/formal-ai/domain-senses.test.mjs`: offline dictionary, grammar, corpus, topic, and recording regressions.

## Requested sentences

| English                                                 | Before                                                              | After                                                                             |
| ------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| One qualified lead per month covers fixed cost.         | Один приготовленный свинец в месяц закрывает установленные расходы. | Один квалифицированный потенциальный клиент в месяц покрывает постоянные затраты. |
| In addition to ads, the site earns from affiliates.     | Кроме реклам сайт зарабатывает [from affiliates].                   | Кроме реклам сайт зарабатывает [from affiliates].                                 |
| Take studies as they appear.                            | Берите учения, как они появляются.                                  | Берите исследования, как они появляются.                                          |
| Long development times mean many writers see no income. | Времена Long развития значат много писателей [see no income].       | Времена Long развития значат много писателей [see no income].                     |
| I agree with Tom.                                       | Я соответствую Тому.                                                | Я соглашаюсь с Томом.                                                             |
| Payouts vary by country.                                | Выплаты изменяются страной.                                         | Выплаты отличаются по стране.                                                     |
| The payment itself is reliable.                         | Сама плата надёжна.                                                 | Сам платёж надёжен.                                                               |

## Document and sample checks

- CLI translation of `docs/business-plans/academic-research-studies.md` selects «Берите исследования, как они появляются». Whole-document topic checks also select the financial lead/cost senses.
- The full sales sentence ending in “most networks also require minimum volume to stay approved” selects «потенциальный клиент» and «покрывает постоянные затраты»; its final “approved” fragment remains incomplete.

| Sentence sample seed | Before | After |
| -------------------- | -----: | ----: |
| 7                    |   8/15 |  8/15 |
| 11                   |   8/15 |  9/15 |
| 23                   |   7/15 |  6/15 |
| Total                |  23/45 | 23/45 |

All 45 outputs were manually compared. Improvements include sales lead/costs, qualified/paid adjectives, research studies, and several financial compounds. Remaining errors include ads/affiliates, article/fragment parsing, and idiomatic verb selection. Aggregate completion is unchanged; this is not a claim that every sampled sentence improved.

## Validation

- Generalization: fixed public sample, N=100, seed 20261104, chrF **43.546 → 44.800**, completion **75% → 79%**. References are used only by the evaluator.
- Full suite: **326 passed**, `node --test --test-timeout=60000 tests/`.
- Production snapshot: **70 live/offline translations identical**, regenerated fixtures and reviewed `public-expected.json` changes.
- Changed-source ESLint and Prettier checks, file-size checks, and `git diff --check` passed. Full-tree `npx eslint formal-ai tests` still reports one Prettier error at `src/english/analyze.mjs:97`, a concurrently edited file reserved for the parser lead. That file was not edited by this task.

## Remaining problems

- Ads/affiliates still produce «Кроме реклам сайт зарабатывает [from affiliates]». The requested marketing noun and its earning/source construction remain unresolved; no word-specific override was introduced.
- The long development/income sentence still has the name/duration/complement problems shown above.
- Some sampled outputs remain incorrect even when marked complete. The seed-23 variable-fee fragment lost completion in the concurrent workspace. The original sense-code control with the current parser also produces `Upwork: переменная, 2025 сдач [0-15% freelancer fee].`; this regression is outside the sense changes, and is reported rather than counted as an improvement.
