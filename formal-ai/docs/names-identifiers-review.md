Names, codes and identifiers now use token shape, document/site capitalization, public entity types and dictionary grammar. No English-to-Russian word override table was added. HTTP requests retain the existing generic User-Agent.

Changed files:

- `src/english/identifiers.mjs`, `analyze.mjs`, `multiword.mjs`: opaque identifiers, dictionary-attested foreign name spans, and protection of document names during sentence-opening reanalysis.
- `src/document.mjs`: whole-token lowercase evidence, capitalization counts, exclusion of URLs, and document names supplemented by site-wide names. The existing site worker already shares the complete document/JSON topic, so no site-script changes were needed.
- `src/resolve.mjs`, `name-resolution.mjs`, `sources/entity-context.mjs`: extracted name resolution to keep files below 1,000 lines; reject single-word aliases expanding to full-name humans; retain acronyms instead of subtype labels; use instance labels without their generic descriptions. This prevents India being selected as a plant genus.
- `src/english/infinitive.mjs`, `parser.mjs`, `verb-group.mjs`, `formalize.mjs`, `russian/nonfinite.mjs`, `naturalize.mjs`, `phrase.mjs`: passive object complements, floating quantifiers, contrast between named present-simple subjects, and generic participant plurals for collective activities.
- `src/sense-context.mjs`, `senses.mjs`, `sources/government.mjs`: membership selection from dictionary/entity evidence and Russian government from a bilingual sense aligned with its public usage example.
- `tests/formal-ai/names-identifiers.test.mjs`: ten offline tests using stub public APIs, including unseen identifier/foreign-name variants and negative controls.

Concrete comparisons:

| English                                                              | Before                                                                                           | After                                                                     |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| W-8BEN/tax interview                                                 | Ватт, EN, интервью налога                                                                        | Интервью W-8BEN/налога                                                    |
| AI-content disclosure on Fab                                         | Раскрытие AI-content на Фабрис Морван                                                            | Раскрытие AI-content на Fab                                               |
| Join Atlassian Marketplace or Figma seller program                   | Соедините Atlassian Marketplace или программу продавца Figma                                     | Вступите в Atlassian Marketplace или программу продавцов Figma            |
| SRL semplificata (SRLS) / SRL                                        | SRL, SRLS, SRL [semplificata]                                                                    | SRL semplificata (SRLS) / SRL                                             |
| Discord pays out via Stripe after a monetization eligibility review. | Already preserved in the initial measured seed-777 run; the reported failure was «Разногласие…». | Discord выплачивает через Stripe после обозрения пригодности монетизации. |

The payout sentence in the site sample changes from:

> PayPal требует India, пока Payoneer, Wise и Skydo, над которым все работают [balances to be withdrawn automatically to a bank].

To:

> PayPal требует, чтобы балансы Индии были сняты автоматически в банк, тогда как Payoneer, Wise и Skydo все работают.

Validation:

- Ten new offline tests pass. The three existing context/compound tests also pass.
- The initial live seed-777 sample was 21/30 complete. Concurrent edits also affected its rerun, so a second comparison used frozen source copies with this task's rules disabled/enabled: 23/30 → 24/30, with no completeness regressions. All six changed outputs were reviewed. The full before/after sample is in [names-identifiers-sample.json](names-identifiers-sample.json).
- All touched source/test files were formatted with Prettier. `npm run check:file-size` passes. ESLint passed earlier with two warnings; its latest shared-workspace run reports 14 formatting errors and two warnings in concurrently edited files (`coordination-context.mjs`, `shared-head.mjs`, `wiktionary.mjs`, and `recurring-choices.test.mjs`). Those unrelated files were left untouched.
- The full suite was run with `node --test --test-timeout=60000 tests/` outside the filesystem sandbox so localhost tests could bind. Its latest completed run was 425/426: only production replay fails, because it lacks recorded responses for concurrent resolver lookups. The concurrently added headline test now passes. The full suite is not green until the public fixtures are refreshed.

Remaining problems: «интервью … налога» is still less natural than «налоговое интервью»; other incomplete clauses in the sampled legal paragraph remain; grouped standalone resolution can still choose the surname «Уайз» for Wise, although the website sample preserves Wise. A broader context-ranking change was removed after it regressed another product name. No commit was made by this task.
