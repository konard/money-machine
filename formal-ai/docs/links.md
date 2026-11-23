# Unified source links

`src/links/schema.mjs` maps concepts to links addressed by the JSON tuple
`[concept id, ...property path]`. Concept ids retain source identifiers;
independent sources do not claim to describe the same sense unless their ids
have been explicitly aligned. `contexts`, ordered English readings and evidence
lists are single links; Russian properties and each `form` slot have independent
addresses. Empty lists are explicit values, so `contexts ()` clears contexts.
Missing properties do not shadow anything.

`src/links/union.mjs` reads overrides first, then sources in registry order,
independent of insertion order. This follows the address ownership rule in
[UnionLinksDecorator.cs](https://github.com/link-foundation/link-cli/blob/main/csharp/Foundation.Data.Doublets.Cli.Library/UnionLinksDecorator.cs).
Each returned link carries its layer and provenance (the override filename for
local links). The lexicon keeps its lookup indexes and accepts partial overlays:

```lino
concept wikt:book:noun:1
  contexts (publishing)
  form pl.gen книг
```

This supplements the public concept without declaring its English or Russian
lemma. The same slot replaces a public value if one exists. Public links at
other addresses remain intact. This is a syntax example, not shipped vocabulary.

`src/links/write.mjs` emits `schema links-v1` concepts that round-trip through
`parseLino` and `parseConcept`, retaining the exact JS field types. Ordinary
`en`, `ru`, `form`, `gloss`, `grounded-in`, `contexts` and `source` field names
remain visible. A `json` child supplies lossless structured values, including
frames, government, sense translations, labels, sentence pairs, frequencies,
and optional grammatical properties which the original compact syntax cannot
express. Old override files still parse without conversion. The legacy parser
was moved from `lexicon.mjs` into the schema module and remains re-exported.

## Inspecting a word

```sh
node formal-ai/bin/formal-ai.mjs links book
node formal-ai/bin/formal-ai.mjs links 'value added tax' --sources en.wikipedia=on
node formal-ai/bin/formal-ai.mjs links bank --sources wikidata-lexemes=on,kaikki=on,tatoeba=on
node formal-ai/bin/formal-ai.mjs links book --offline
```

Every property has a comment giving its path, owning layer and provenance.
The comments do not affect parsing. `--offline` skips the public pre-pass, as
for translation; to replay public cache/fixtures, use `FORMAL_AI_OFFLINE=1`
without `--offline`. Frequencies added after dictionary resolution appear in
`ru.wikipedia` and `rnc-frequency`, respectively. Other post-resolution
properties retain the contributing concept's source; the existing resolver
combines evidence from dictionaries before constructing those concepts, so this
is not yet an audit of every original HTTP statement.

## Evidence adapters

All four new adapters use `getJson`, the registry bucket and the project
User-Agent. Switches apply before reading memory, disk, fixtures or the network.
JSONL parsing happens inside `getJson`, so Kaikki uses the same raw-response
cache and fixture mechanism. P9488 survives Wikidata fixture compaction.

| Source           | Links emitted                                                                                    | Default |
| ---------------- | ------------------------------------------------------------------------------------------------ | ------- |
| en.wikipedia     | English phrase, Russian article title                                                            | off     |
| wikidata-lexemes | English sense, gloss, P5137 items, P5972 sense ids and verified Russian targets, P9488 field ids | off     |
| Tatoeba          | English query word, English/Russian sentences, sentence ids, Russian surface words, licenses     | off     |
| Kaikki           | per-sense gloss, topic contexts, usage/grammar labels                                            | off     |

These are inspectable evidence layers, outside translation candidate indexes.
Enabling one loads its evidence during resolution; it does not activate a new
scoring method. No measured translation improvement has been established, so
none is used for lexical round-trip scoring. Tatoeba pairs are sentence
co-occurrences, not claims that every Russian word translates the query word;
indirect and unapproved translations are excluded. Wikidata context Q-ids retain
their identities rather than guessing domain labels. The separate SPARQL source
still has no new adapter; the lexeme adapter uses the Wikidata entity API.
The generalization harness explicitly opts into Tatoeba to obtain its reference
sentences despite the source's default-off evidence setting.

## Coverage audit (2026-11-04)

Run `node formal-ai/scripts/audit-links.mjs bank free plan tax run`. It compares
both translation-table senses used by the resolver and all raw definition
labels extracted by our Wiktionary parser. Live public responses were fetched
with the project User-Agent into a temporary cache for this audit.

| Word | Kaikki senses | Our raw definitions | Our translation-table senses | Shared labels with raw definitions | Kaikki-only labels | Our-only labels |
| ---- | ------------: | ------------------: | ---------------------------: | ---------------------------------: | -----------------: | --------------: |
| bank |            42 |                  42 |                           15 |                                 18 |                 17 |               6 |
| free |            39 |                  42 |                           17 |                                 19 |                 30 |              20 |
| plan |             9 |                   9 |                            8 |                                  2 |                  0 |               0 |
| tax  |             8 |                   8 |                            3 |                                  2 |                  2 |               1 |
| run  |           118 |                 126 |                            0 |                                 27 |                 26 |              17 |

The counts compare raw label strings, not normalized contexts or aligned
senses. Kaikki expands topic hierarchies (`bank`: sciences, engineering,
transport); spelling differs (`figuratively` vs `figurative`, `category-theory`
vs `category theory`). Our parser also retains raw qualifiers and wiki markup
that Kaikki normalizes. `run` has definitions but its main-page translation
senses point to a separate translation page; the audit deliberately reports the
main page rather than treating zero local translation tables as zero meanings.
Kaikki is therefore broader for some fields, but neither a strict superset nor
proof of better sense selection. Live endpoints can also represent different
Wiktionary revisions.

## Validation

Offline tests cover legacy and structured write/parse equality, per-slot union
ownership, partial overrides, source switches, all adapters, JSONL cache replay,
P9488 compaction and CLI provenance. A controlled bad-public-form fixture changes
`Books.` from `Книга.` to `Книги.` after adding only `form pl.nom книги`.
The live CLI also returns `value added tax` → `Налог на добавленную стоимость`
with `en.wikipedia` ownership (evidence only).
Production replay remains identical for all 88 sentences, including the fixed
seeded 30-sentence website sample; no fixture re-recording is needed. A separate
fresh sample with seed 149 could not run offline because its batched lookups are
not present in the cache; the recorded website sample supplies the regression
comparison.

Unchanged production examples: `I read a book.` → `Я прочитал книгу.` and
`I work at the bank.` → `Я работаю в банке.` before and after. Existing sense
errors also remain: `A free plan.` still yields `Свободный план.`; these adapters
do not yet have evidence of a measured improvement that would justify enabling
them for scoring.
