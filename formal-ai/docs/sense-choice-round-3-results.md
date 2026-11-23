# Sense choice and verb government, round 3

2026-11-04. Production public responses plus the existing overrides; no new overrides or word-to-word translation rules. Parser, formalizer, Russian phrase renderer, and website files were left to their concurrent owners. No commit was made.

## Retained changes

- `src/senses.mjs`: exclude the ambiguous headword itself from domain-prefix evidence; prefer an ordinary core sense over a secondary clipping in the same field; reject exclusively intransitive frames with direct objects; accept explicit object cues despite incomplete class inventories.
- `src/sources/government.mjs`, `verb-frames.mjs`: distinguish a ditransitive theme from its recipient and alternative cases from simultaneous arguments; stop colloquial/infinitive and later-meaning qualifiers leaking into ordinary objects. An unqualified primary meaning does not inherit a later sense’s case; explicit Russian management sections remain authoritative evidence. Explicit dictionary aspect alternatives supersede unrelated generic partners, while unpaired verbs keep their behavior.
- `src/sources/definition-synonyms.mjs`, `definition-translations.mjs`: fill missing coordinated verb-synonym definitions from public dictionaries only when the core meaning lacks translations. Narrower definitions with additional complements are excluded.
- `src/sources/translation-senses.mjs`, `sense-data.mjs`: retain a reverse-attested synonym matching the noun type of a functional relative-infinitive gloss as a distributive alternative. The scorer activates it after grammatical `per`; ordinary noun defaults remain stable.
- `tests/formal-ai/sense-frames-round3.test.mjs`: seven offline regressions, including stubbed public API responses and User-Agent assertions. Production fixtures and expected translations were regenerated.

## Requested examples

Before/after below use the same current parser with original versus changed sense/source modules. Concurrent parser work explains why some originally reported errors already differ in this baseline. Isolated words can be parsed differently from their use in a sentence.

| English                                                | Before                                               | After                                                |
| ------------------------------------------------------ | ---------------------------------------------------- | ---------------------------------------------------- |
| I use a phone.                                         | Я использую фон.                                     | Я использую телефон.                                 |
| Run the program.                                       | Побегите программу.                                  | Запустите программу.                                 |
| Run the company.                                       | Побегите компанию.                                   | Руководите компанией.                                |
| Fiscal host handles some compliance.                   | Финансовый хозяин сносит немного согласия.           | Финансовый хозяин управляет некоторым согласием.     |
| Buyers are Notion users seeking ready-made systems.    | Покупатели — имена пользователя Notion.              | Покупатели — пользователи Notion.                    |
| Payoneer and Wise withdrawals to local nostro accounts | Payoneer и снятия Wise к туземцу [nostro accounts]   | Payoneer и снятия Wise к туземцу [nostro accounts]   |
| hosts                                                  | Остаётся                                             | Остаётся                                             |
| trip                                                   | Поездка                                              | Поездка                                              |
| Withdrawal                                             | Снятие                                               | Снятие                                               |
| on location                                            | Лично                                                | Лично                                                |
| See the program.                                       | Завидьте программу.                                  | Увидьте программу.                                   |
| try                                                    | Попытка                                              | Попытка                                              |
| per seat                                               | За сиденье                                           | За место                                             |
| small businesses                                       | Малые бизнесы                                        | Малые бизнесы                                        |
| keep the meter running                                 | Храните метр подряд                                  | Храните метр подряд                                  |
| Book a table.                                          | Закажите столу.                                      | Закажите стол.                                       |
| First payout waits for 30-90 day merchant confirmation | Первая выплата ждёт 30–90 подтверждений дня торговца | Первая выплата ждёт 30–90 подтверждений дня торговца |
| costs $4                                               | Стоит $4                                             | Стоит $4                                             |
| It costs 4 dollars.                                    | Оно стоит 4 долларов.                                | Оно стоит 4 доллара.                                 |

The additional counted-price check used the supplied `try.mjs` harness. “See” no longer uses «завидеть», but «Увидьте программу» remains awkward. “Users” is corrected, while the following participial phrase is still omitted. Fiscal-host wording and compliance remain incorrect despite the better management verb.

## Validation and sampling

- `node formal-ai/scripts/generalization.mjs`, N=100, seed 20261104: current-parser control **45.212 → 45.273 chrF**, completion **80% → 80%**. The initial workspace baseline was 44.979; the current-parser control isolates this task from concurrent parser changes.
- `node --test --test-timeout=60000 tests/`: **359 passed, 0 failed**.
- `npx eslint formal-ai tests`, changed-file Prettier, `npm run check:file-size`, and `git diff --check`: passed.
- `rm -rf tests/formal-ai/fixtures/public && npm run formal-ai:record`: **76 live/offline translations identical**, 26.42 MiB of compact public responses. Reviewed expected-translation changes include phone, both transitive run readings, per-seat wording, and the fiscal-host verb. Long-development, requires-sharing, and “Never pay…” changes were reproduced with the original sense code and the current parser.

| Website sentence seed | Control | After |
| --------------------- | ------: | ----: |
| 7                     |    9/15 |  9/15 |
| 11                    |    9/15 |  9/15 |
| 23                    |    8/15 |  8/15 |
| 4411                  |   11/15 | 11/15 |
| Total                 |   37/60 | 37/60 |

All 60 outputs were compared. The two remaining changes in the same-parser sample are aspect choices («делила» → «разделила» and «могут брать» → «могут взять»); no sampled completion or sense regression was found. Broader noun/default and synonym changes were narrowed after they worsened generalization or changed subscription users incorrectly.

Additional sampled sense errors still visible include royalty → «царственность», a financial pool → «лужа», Jan → «джинн», watch hours → «часы вахты», free route → «свободный маршрут», and fixed end date → «неподвижный срок ключа». These remain open; completion is not a correctness score.

## Remaining problems

- Fiscal host still means «финансовый хозяин»; compliance still means «согласие». The full sentence is not fixed.
- Local is still parsed as a noun before the unresolved nostro/accounts span. Isolated hosts still receives a verb reading. These need the parser owner’s work; no parser files were edited here.
- On location, small businesses, and the meter/running construction remain wrong.
- The 30–90-day phrase still attaches the number to confirmations rather than forming a duration modifier. Counted-price government is fixed separately.
- Standalone trip, Withdrawal, and try now produce «Поездка», «Снятие», and «Попытка» in the shared workspace; the original herd/coitus/trial outputs were not reproduced in the current-parser control. Contextual uses may still choose wrong senses.
