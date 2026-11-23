# Wikidata Lexemes evaluation

Evaluated 2026-11-04 (Asia/Ho_Chi_Minh; API run 2026-11-03 17:05 UTC).

**Recommendation: not worth adopting as an English→Russian translation fallback
via direct P5972 links today.** It recovered no missing translations in this
sample, so no fallback resolver or integration hook was added.

## Method

The script gathers strategy prose and `docs/**/*.md` paragraphs using
`scripts/sample.mjs`. It removes code and link destinations, counts lowercase
words (excluding capitalized product names and numeric ordinal suffixes), then
selects 150 frequent content words from the top 600 surface candidates.
Wiktionary identifies noun/verb/adjective/adverb entries and normalizes inflections
without translated own senses; translation subpages and related translation
pages are followed for up to three rounds. This selects dictionary content words,
not a random corpus sample, and uses Wiktionary to identify them.

Lexeme search checks the first 50 relevance hits, then verifies exact English
lemma, language and lexical category on the actual entities. Only outgoing,
non-deprecated P5972 links to existing Russian senses with matching POS count as
translations. P5137 item labels are not treated as translations. Both sources
count translated English senses, not individual Russian candidates. “Top” means
first API/table candidate in the script's POS order, not a quality ranking.

Requests use the shared cache, unchanged generic User-Agent, pool of two, and
existing per-host spacing. Transient Wikidata API overload errors are retried
before caching; failures abort the evaluation rather than count as missing data.

## Results

| Measure                                   |      Wiktionary |    Lexemes |
| ----------------------------------------- | --------------: | ---------: |
| Words with Russian translations           | 149/150 (99.3%) | 0/150 (0%) |
| English senses with Russian translations  |             922 |          0 |
| First Russian candidate with tagged forms | 132/150 (88.0%) |      0/150 |

Lexemes found English entries for **149/150** words, containing **633 senses**;
**281 senses** had P5137 items. Thus the main bottleneck was Russian translation
links, not finding English lexemes. Incremental coverage was **0 words**. Top
translation agreement is **N/A (0 comparable pairs)**. Neither source supplied
a translation for `taxable`.

| Example | Wiktionary translated senses | Lexeme translated senses | Wiktionary first Russian candidate |
| ------- | ---------------------------: | -----------------------: | ---------------------------------- |
| payout  |                            2 |                        0 | выплата                            |
| bank    |                            7 |                        0 | банк                               |
| month   |                            1 |                        0 | месяц                              |
| income  |                            1 |                        0 | доход                              |
| work    |                           21 |                        0 | работа                             |

There were no in-sample translation wins for Lexemes. Its useful structural
advantage is explicit grounding: `bank`'s financial-institution sense
[L3354-S1](https://www.wikidata.org/wiki/Lexeme:L3354#S1) carries Q22687, but its
outgoing translation links yielded no Russian target. Outside the final sample,
`human` [L3080-S1](https://www.wikidata.org/wiki/Lexeme:L3080#S1) did link to
`человек` L2120-S1: it agreed with Wiktionary and supplied 12 tagged form cells
versus Wiktionary's 13. Separate morphology checks returned 12 cells for `вода`
and 13 for `сделать`. These confirm that forms can work when a link exists;
they did not demonstrate additional translation coverage.

This evaluates direct links, not reverse P5972 discovery, shared-P5137 joins,
exhaustive search, full paradigm completeness, or translation quality. Those
would require a separate experiment. The model and Russian feature conventions
are documented by [Wikidata](https://www.wikidata.org/wiki/Wikidata:Lexicographical_data/Documentation)
and its [Russian modeling guide](https://www.wikidata.org/wiki/Wikidata:Lexicographical_data/Documentation/Languages/ru/modeling).

## Reproduce

```sh
FORMAL_AI_CACHE=/private/tmp/formal-ai-lexemes-cache \
  node formal-ai/scripts/compare-lexemes.mjs 150 /private/tmp/lexemes-results.json \
  > /private/tmp/lexemes-comparison.txt
```

The text output contains all 150 per-word rows and aggregates; JSON retains the
counts, translations and sense IDs. Five temporary offline stub checks passed
(matching, sense validation, noun forms, verb/participle forms, fatal API errors).
Prettier and ESLint pass on the new JavaScript modules. No existing source files
were edited, no runtime dependencies were added, and nothing was committed.
