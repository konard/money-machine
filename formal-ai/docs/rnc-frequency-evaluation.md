# Russian corpus-frequency evaluation

Frozen comparison of the same parser, resolver, dictionary cache and sample inputs. Only corpus-rank attachment and the frequency-scoring lines differ. Commands ran from the repository root. Live concurrent grammar/name changes are excluded from these numbers.

## Implementation and scoring

The [Wiktionary RNC appendix](<https://en.wiktionary.org/wiki/Appendix:Frequency_dictionary_of_the_modern_Russian_language_(the_Russian_National_Corpus)>) contains a complete ranked main list. `/1`–`/20` repeat thousand-word ranges; `/1A` and `/1B` repeat ranks 1–250 and 251–500. The loader discovers pages with `allpages`, parses wikitext, and uses the main list first. Subpages fill missing lemmas using explicit offsets, without concatenating overlapping views. It retains POS and the first rank of duplicate lemmas. The live index has 19,817 distinct normalized lemmas. Raw responses use the existing persistent cache and generic User-Agent.

Multiword translations are skipped. Missing corpus lemmas are neutral. Known ranks 8,001–20,000 receive `-0.1 * log10(rank / 8000)` (at most approximately −0.04); the existing Wikipedia signal is retained. This modest tail penalty avoids rewarding general but contextually incorrect words such as порядок and проблема.

## Sense regression

`node /private/tmp/claude-501/-Users-konard-Code-Archive-konard-money-machine/ccee1132-7397-49bb-b482-93d10cf214c0/scratchpad/wsd.mjs`

| Scoring                                                | Correct |
| ------------------------------------------------------ | ------- |
| Existing Wikipedia hint                                | 6/12    |
| Rank-only logarithmic bonus (weight 0.5)               | 4/12    |
| Wikipedia + corpus tail penalty (weight 0.1, retained) | 7/12    |

Platform changes from помост to платформа. Both order cases retain заказы, and the deposit case retains депозиты. Newsletter issue, royalties, payout logging, sweep and application remain wrong. The regression accepts гонорар for fee, so its passing fee case does not establish the desired commission/charge sense.

## Deterministic sentence samples

`node formal-ai/scripts/sample.mjs sentence 25 SEED`, seeds 1–4. Manual counts below are conservative counts of obvious wrong lexical choices, including false dictionary-name readings. Repeated occurrences count separately. Grammar, missing content, untranslated brackets, and debatable wording are excluded. This is a human audit, not an automatic accuracy metric. The individual counted choices are listed below for review.

| Seed  | Wrong choices before | Wrong choices after | Complete sentences before/after |
| ----- | -------------------: | ------------------: | ------------------------------- |
| 1     |                   31 |                  28 | 15/25 → 15/25                   |
| 2     |                   32 |                  32 | 14/25 → 14/25                   |
| 3     |                   20 |                  20 | 10/25 → 10/25                   |
| 4     |                   29 |                  28 | 11/25 → 11/25                   |
| Total |                  112 |                 108 | 50/100 → 50/100                 |

The four corrected choices are platform in seed 1 sentences 11, 22 and 25, and seed 4 sentence 1. Seed 2 has identical output. Seed 3 sentence 16 changes scraping from царапать to скрестить; both are wrong for web scraping, so the count is unchanged. There are no other output changes in the frozen comparison. A stronger tail weight of 0.5 also scored 7/12 but introduced collateral changes (including membership→принадлежность), so the lower weight was retained.

## Counted choices in the baseline

| Seed | Sentence | Wrong lexical choices                                                             |
| ---- | -------- | --------------------------------------------------------------------------------- |
| 1    | 2        | booking→предупреждение                                                            |
| 1    | 3        | booking→предупреждение                                                            |
| 1    | 4        | Edit→Эдит                                                                         |
| 1    | 6        | coding→кодировка; specific→явные; clip→скрепка                                    |
| 1    | 7        | reader→преподаватель                                                              |
| 1    | 9        | set→развод зубьев пилы; service→сервиз; fee→гонорар; fetch→призрак                |
| 1    | 10       | submit→подчинитесь                                                                |
| 1    | 11       | platform→помост                                                                   |
| 1    | 13       | denominations→имена                                                               |
| 1    | 15       | rank→горизонталь                                                                  |
| 1    | 17       | terms→члены; sharing→раздел                                                       |
| 1    | 18       | artist→художник                                                                   |
| 1    | 19       | commission→комиссия; artist→художник                                              |
| 1    | 22       | actions→иски; laws→права; rules→правления; platform→помост                        |
| 1    | 23       | reference→справочный материал                                                     |
| 1    | 24       | IHK→иммуногистохимическое исследование; filings→опилки                            |
| 1    | 25       | platform→помост; reference→справочный материал; cover→пройдут; Asia→Эйжа          |
| 2    | 1        | referrals→направления                                                             |
| 2    | 2        | free→освободите; plays→реакции; post→постмортем; balance→равновесие; tracks→следы |
| 2    | 3        | issue→проблема                                                                    |
| 2    | 5        | acceptance→получение                                                              |
| 2    | 8        | royalties→царственности; contract→сжимайте                                        |
| 2    | 9        | sweep→трубочист; deposits→залоги                                                  |
| 2    | 11       | writing→письменность                                                              |
| 2    | 12       | keeps→содержания; rates→скорости; VA→Вирджиния; low→захохотали                    |
| 2    | 13       | logging→рубка леса                                                                |
| 2    | 16       | newcomers→пришельцы; land→в землю; application→применение                         |
| 2    | 18       | revisions→повторения; producers→производители                                     |
| 2    | 20       | concentrate→концентрат                                                            |
| 2    | 22       | reviews→обозрения; then→тогдашний; as→ас                                          |
| 2    | 23       | setup→подстава                                                                    |
| 2    | 24       | invoice→партия                                                                    |
| 2    | 25       | start→преимущество; orders→порядки; landing→приземляться                          |
| 3    | 2        | delivery→род; file→зарегистрируйте; draft→сквозняк                                |
| 3    | 8        | scripted→планомерное                                                              |
| 3    | 11       | streamers→вымпелы                                                                 |
| 3    | 12       | Readers→Дучжэ                                                                     |
| 3    | 14       | control→власть; higher-ticket→высокий билет                                       |
| 3    | 15       | pieces→монеты; acceptances→получения                                              |
| 3    | 16       | allow→учитывают; sold→убеждены; scraping→царапать                                 |
| 3    | 17       | tax→истощите                                                                      |
| 3    | 19       | market→рынок                                                                      |
| 3    | 22       | content→довольное; site→местоположение; traffic→движение                          |
| 3    | 23       | streamers→вымпелы                                                                 |
| 3    | 24       | Edit→Эдит                                                                         |
| 4    | 1        | platform→помост                                                                   |
| 4    | 3        | policy→политик                                                                    |
| 4    | 5        | milestones→мильные камни                                                          |
| 4    | 6        | confidence→афера; verified→пользователь; last→продлитесь                          |
| 4    | 7        | Vale→долина                                                                       |
| 4    | 9        | start→преимущество; orders→порядки; landing→приземляться                          |
| 4    | 10       | caps→фуражки; rules→правления                                                     |
| 4    | 13       | rank→горизонталь                                                                  |
| 4    | 14       | orders→порядки                                                                    |
| 4    | 15       | charges→цены; fee→одержимость                                                     |
| 4    | 16       | land→высаживают                                                                   |
| 4    | 17       | rates→скорости                                                                    |
| 4    | 20       | fees→гонорары; mean→собираются                                                    |
| 4    | 21       | set→группа; releases→новинки                                                      |
| 4    | 22       | reports→является; contributors→благодетели; dedicated→посвящённые                 |
| 4    | 23       | QA→добротная статья                                                               |
| 4    | 24       | confirm→укрепите                                                                  |
| 4    | 25       | chart→чарт; fees→гонорары                                                         |
