# Public-data sense choice evaluation

Evaluated on 2026-11-04 with the default production data directory,
`formal-ai/data/overrides`, and cached public Wiktionary/Wikidata responses.
No new overrides or English-to-Russian word lists were added.

## Changes

- `src/sources/wiktionary.mjs`: use translation targets rather than display
  transliterations; stop treating adjacent linked modifiers as synonyms;
  prefer matching definition heads over incidental mentions in short glosses;
  retain parent definition context without inheriting unrelated verb frames.
- `src/resolve.mjs` and `src/sources/sense-data.mjs`: retain capitalization and
  dictionary field labels; consider all listed Russian candidates; require
  Russian lexical attestation, including Russian Wiktionary when the English
  edition lacks a Russian entry. Exact Russian Wikidata concept labels also
  provide public attestation. Field labels remain evidence even for a word's
  most widely translated sense. Exact English name labels precede foreign
  aliases, and internal capitalization permits company-name resolution.
- `src/sources/government.mjs`: prefer the translation table's explicit aspect
  alternatives over a Russian lemma's generic partner. A rendered table no
  longer automatically outranks an earlier attested translation.
- `src/senses.mjs`: reward supported dictionary domains, apply usage/related
  sense penalties to nouns as well as verbs, preserve capitalization evidence,
  and reduce the weight of Russian verb-object frequency relative to English
  meaning. An experimental general document-word bonus was rejected after
  the control exposed semantic regressions.
- `src/sources/terms.mjs`: search exact Wikidata concept labels and aliases for
  missing input lemmas and compounds. Reject fuzzy hits, named instances,
  inflections with known bases, and compound aliases unsupported by their
  own sentence. For example, “tall men” must not become “middle fingers.”
- Offline tests cover candidate attestation, display transliterations, linked
  modifiers, definition matching, dictionary domains, aspect alternatives,
  and compound aliases. Existing regular-morphology fixtures now explicitly
  attest their Russian vocabulary through `tests/formal-ai/russian-fixture.mjs`.

## Measurements

The isolated comparison froze the parser and vocabulary before these changes.
The integrated run uses the shared tree, including concurrent parser fixes;
its gains cannot all be attributed to sense selection.

| Test                                             | Before | Isolated after | Integrated after |
| ------------------------------------------------ | -----: | -------------: | ---------------: |
| Website, seed 7, complete                        |   8/15 |           6/15 |             8/15 |
| Website, seed 11, complete                       |   8/15 |           8/15 |             8/15 |
| Website, seed 23, complete                       |   5/15 |           6/15 |             6/15 |
| Website, seed 42, complete                       |   6/15 |           6/15 |             6/15 |
| Four-seed total                                  |  27/60 |          26/60 |            28/60 |
| Independent website control, seed 20261104       |  17/30 |          18/30 |                — |
| Saved generalization sample, mean sentence chrF2 | 40.401 |         41.216 |           41.746 |
| Saved generalization sample, completion          | 69/100 |         71/100 |           71/100 |

Commands: `node formal-ai/scripts/sample.mjs sentence 15 SEED` for seeds
7, 11, 23, 42; control count 30, seed 20261104;
`node formal-ai/scripts/generalization.mjs 100 20261104 OUTPUT.json
--input=formal-ai/docs/generalization-sample.json`.

The 30-sentence control has 25 identical outputs and five changed outputs.
It recovers one previously bracketed construction and retains “name generation”
as «создание», after rejecting the experimental «поколение». Several changed
sentences remain badly translated; completion is not semantic correctness.

## Concrete examples and remaining problems

Fragments below come from the listed seed-7 sentences. The integrated output
also contains parser changes by the lead.

| English             | Before                   | Integrated after          |
| ------------------- | ------------------------ | ------------------------- |
| more often          | мооре                    | более часто               |
| you place           | вы полагаете             | вы кладёте                |
| your site           | своём местоположении     | своём местоположении      |
| creative curation   | созидательная инструкция | созидательное курирование |
| each release        | каждого освобождения     | каждого релиза            |
| pop titles          | титулы попа              | титулы поп-музыки         |
| SoundCloud needs    | SoundCloud желает        | SoundCloud нуждается      |
| Stripe payout fee   | гонорар полосы выплаты   | гонорар Stripe выплаты    |
| compliance review   | проверка согласия        | проверка согласия         |
| currency conversion | превращение валюты       | превращение валюты        |
| Upfront classes     | Честные классы           | Честные классы            |

The isolated parser leaves “more often” bracketed after the invalid noun
candidate is removed; the lead's parser changes recover it in the integrated
run. “Site” and “titles” still choose wrong senses. The adjective “creative,”
the payment sense of “fee,” “Upfront,” and the legal/financial compounds still
need better public evidence and contextual selection. Exact public lookup
found a Russian concept label for “curation” («курирование»); the exact
“currency conversion” entity had no Russian label, and “compliance review”
returned only fuzzy matches. These were not filled with invented translations.

Overrides added: **none**.

## Verification

- `npx prettier --write` completed for changed files.
- `npx eslint formal-ai tests`: passed.
- `npm run check:file-size`: passed.
- `node --test --test-timeout=60000 tests/`: **273 passed, 0 failed**.
- Existing recorder: **70 live/offline translations identical**. Refreshed the
  stale Mary gender expectation («шёл» → «шла») using the existing recorder;
  its implementation and production-test implementation were not edited.
- Behavior-preserving extractions into `english/cursor.mjs`,
  `english/token-readings.mjs`, and `english/clause-node.mjs` keep the
  concurrently expanded parser files below the required size limit.

No commits were made by this agent. The shared workspace was checkpointed
concurrently by the lead, so the current Git diff alone does not show all
sense-selection changes described above.
