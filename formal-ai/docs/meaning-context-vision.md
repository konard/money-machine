# Vision: (word + context) ⇄ meaning, through typed links

Status: the target design for sense choice. Every method below is a
switchable, measured component: one that does not provably improve
translation is turned off, not deleted.

## 0. Precision: the meta language is exactly as vague as the text

The meta language does not know more than the sentence says, and it does
not know less. Formalizing must neither add information (commit "bank" to
the river when the text does not) nor remove it (drop the tense, the
number, the definiteness, a hedge). Naturalizing (deformalizing) obeys the
same rule in the other direction.

- A word in the meta language refers to a **range of meanings**: the type
  that is the union of the senses still compatible with the context
  (section 1). Context narrows the range; it never jumps to one sense
  without evidence. A fully decided word has a range of one.
- A Russian word also has a range: the English meanings it translates. The
  right Russian word is the one whose range matches the source range best —
  it covers what the English may mean and adds as little as possible. When
  no Russian word fits the whole range, the most likely meaning wins and
  the others are offered as alternatives (up to 5, section 3).
- Grammatical meaning is part of the range too: an English past simple is
  a range over Russian perfective and imperfective past; it is narrowed by
  evidence (completion, repetition), not by habit.

### Round trips are the guarantee

Every direction is checked, and by default every choice tries to keep them:

| trip                                      | invariant                                                                                                                                                                                                                                                                |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| English → meta → English                  | the regenerated English formalizes to the same meta links. Measured: 75/76 complete fixture sentences exact, 72/76 regenerate the same text (`scripts/english-round-trip.mjs`, `docs/english-round-trip.md`)                                                             |
| Russian → meta → Russian                  | the same, for Russian                                                                                                                                                                                                                                                    |
| English → meta → Russian → meta           | every source link stays readable from the Russian: concept, number, tense, polarity, quantity. Ranges may only narrow where Russian grammar forces a choice, and each forced choice is noted. Measured: 71/76 (`src/russian/read-back.mjs`, `docs/russian-read-back.md`) |
| English → meta → Russian → meta → English | both of the above for the same sentence. Measured: 70/76                                                                                                                                                                                                                 |

A lost or changed link is a defect, measured by the evaluation harness and
ranked down in generation. Several translations may be listed; the default
one is the one that survives the round trips best.

## 1. The core idea: a meaning is a type

The meta language names _concepts_, not words. A concept is a link that
stands for an exact range of meanings, organised like a type system. We use
the model of `TypesDecorator` in
[link-cli](https://github.com/link-foundation/link-cli) (C#/Rust, ported
from `@link-foundation/ui-links` `typeSystem`):

- the type of a link is its source: `(v: S x)` is a value of type `S`;
- a type points at itself: the root is `(Type: Type Type)`; a sub-type of
  `T` is `(S: T S)`;
- more parents (multiple inheritance) are pairs `(p: S T2)` marked by
  `(m: Extends p)`;
- `IsOf`, `IsA`, `AncestorsOf` walk any depth, cycles included.

Mapped onto translation:

| link                                                       | meaning                                            |
| ---------------------------------------------------------- | -------------------------------------------------- |
| `(Meaning: Type Meaning)`                                  | root of all meanings (concepts)                    |
| `(Context: Type Context)`                                  | root of all contexts (domains, topics, situations) |
| `(finance: Context finance)`, `(payment: finance payment)` | context hierarchy; specific contexts are sub-types |
| `(free.gratis: Meaning free.gratis)` + `Extends payment`   | a meaning, typed by the contexts it belongs to     |
| `(w: free free.gratis)`                                    | the English word _free_ can express that meaning   |
| `(r: free.gratis бесплатный)`                              | Russian realisation of the meaning                 |
| `(u: free.gratis token#17)`                                | a usage: this token _is of_ that meaning           |

The other decorators of link-cli give the rest of the architecture:

| decorator                                                                         | role in translation                                                                                                                                                                           |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NamedTypesDecorator` / `NamedLinksDecorator` (`GetName`, `SetName`, `GetByName`) | words are _names_ of links: `GetByName("free")` finds the word link, whose meanings are its typed links; a Russian lemma is a name of the same meaning in another language                    |
| `PinnedTypesDecorator`                                                            | fixed, well-known types at stable addresses: `Meaning`, `Context`, `Extends`, the grammatical categories                                                                                      |
| `UnionLinksDecorator`                                                             | several networks seen as one, the first shadows the rest: local `.lino` overrides ∪ repository fixtures ∪ cache ∪ live Wiktionary/Wikidata — a fix shadows bad public data without editing it |
| `RemapLinksDecorator` (+ external ids)                                            | Wikidata `Q…`/`L…-S…` ids and Wiktionary sense anchors bound to our own link addresses, so every source maps into one network                                                                 |
| `PermissionsDecorator`                                                            | a network _as one subject sees it_: a context is a view that hides meanings outside it — "translate as finance" is a view, not a flag in the code                                             |
| `TransactionsDecorator` / `VersionControlDecorator` (branch, checkout)            | alternative readings are branches: each of the top-5 contexts is a branch of the sentence's interpretation; the chosen one is checked out, the others stay inspectable                        |

A meaning may be defined through other meanings (Wiktionary definitions,
Wikidata `P279`/`P31`, WordNet hypernyms): the network is recursive, and the
range of a concept is everything that `IsA` it. Choosing a sense becomes a
type question: which meaning of the word is compatible with (`IsA`) the
contexts in force at this position.

## 2. Sources of meanings and contexts

Every source is public, free, queried as needed, cached, and replayed from
repository fixtures in tests. Local `.lino` overrides fix bad data. Each
source's mapping is audited before use: an audit records which link it
supplies, its coverage on the site text, and its license.

| source                                 | supplies                                                                                                                     | access                                     |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| English Wiktionary                     | senses, glosses, topic labels (`lb`: finance, computing, law), usage examples, per-sense translation tables, Thesaurus pages | MediaWiki API (in use)                     |
| Russian Wiktionary                     | Russian senses, government, derived/related words, examples                                                                  | MediaWiki API (in use)                     |
| Wikidata items                         | concept hierarchy (`P31`, `P279`), field (`P921`, `P101`), labels in both languages                                          | API / SPARQL (in use)                      |
| Wikidata lexemes                       | sense → item (`P5137`), sense ⇄ sense translation (`P5972`), field of usage (`P9488`), examples (`P5831`)                    | API / SPARQL (to audit: coverage)          |
| Wikipedia language links               | multiword terms with exact equivalents ("value added tax" → НДС)                                                             | API (to add)                               |
| Open English WordNet                   | synsets, hypernyms, topic domains (CC BY 4.0)                                                                                | download only — evaluate as a lino dataset |
| Tatoeba                                | English–Russian sentence pairs: the Russian side labels the meaning used in a real context                                   | API (to verify)                            |
| ruwiki search, Russian National Corpus | Russian co-occurrence and frequency                                                                                          | API (in use)                               |

Licenses that forbid our use (e.g. non-commercial BabelNet) are excluded.

### Sources are layers of one link network

Every source is a named, switchable layer (`src/sources/registry.mjs`:
`--sources tatoeba=off`, `FORMAL_AI_SOURCES`, `options.sources`; a
disabled source answers as if it had no data). An adapter turns each API
answer into links of the one meta-language schema, in Links Notation, with
the source as provenance:

```
concept wikt:free:adj:2
  en adj free
  ru adj бесплатный
  gloss "without charge"
  contexts (commerce)
  source en.wiktionary
```

The layers are merged on the fly as the translation needs a word, like
link-cli's `UnionLinksDecorator`: `data/overrides/*.lino` first (they
shadow), then repository fixtures, the local cache and the live APIs. An
override fills a gap or corrects a wrong link; it never needs a code
change. `formal-ai links <word>` prints the merged links of a word with the
layer each one came from.

Access checked on 2026-11-04 with the project user agent: en/ru Wiktionary,
Wikidata items, lexemes and SPARQL, en/ru Wikipedia (language links,
search), Tatoeba (`api.tatoeba.org/unstable/sentences`, needs `sort`),
kaikki.org per-word JSON, the Open English WordNet release — all answer;
the Russian National Corpus API answered 500 (its frequency lists are read
through Wiktionary appendices instead).

## 3. Context: five sources, one ranking

Each source proposes context types with a weight and a reason. They are
combined, never chained by hand-written exceptions.

1. **Statistical context.** From all content words of the message, collect
   the contexts their meanings belong to (with ancestors). Rank contexts by
   how many words they explain and by specificity (depth in the hierarchy);
   intersect the most specific ones. Output: the top 5 contexts, each with
   one _coherent_ reading in which every word has a meaning of that context
   (or a context-neutral one). This yields up to 5 translation options,
   ranked.
2. **Configurable context.** The caller sets a context exactly
   (`--context finance`, a document front-matter field, a site config).
   An explicit context wins over a statistical guess.
3. **Positional context.** For each word, the nearest words that indicate a
   context (syntactic partners first: attached adjective, verb, object;
   then linear distance). The closest indicator outweighs the global one:
   "river _bank_" overrides a finance page.
4. **Dependent (inherited) context.** A sentence whose context is certain
   passes it to the sentences that refer to it: pronouns and definite
   noun phrases that resolve to it, list items under a heading, a table
   row under its header, a paragraph under its section.
5. **Surrounding context.** The document, its section, neighbouring files
   of the same directory, the site — each a context scope with a lower
   weight the further away it is.

## 4. Meaning choice

For a token: candidates = meanings linked to the word (and its lemma).
Score each by the contexts it is of (`IsA`), weighted by source (explicit >
positional > dependent > document > statistical > corpus prior), plus
grammatical fit (frames, government). Keep the top alternatives through
generation so the whole sentence can be ranked as one coherent reading.
Every decision is explainable: `formal-ai explain` lists the contexts and
the links that decided it.

## 5. Round trip: the default criterion

A translation is right when it survives the way back: English → meta
language → Russian → meta language → English returns the same meanings
(not necessarily the same words). The meta language is the pivot, so the
check is on concepts, not strings.

- **Lexical round trip** (available now): a Russian word chosen for a
  meaning must lead back to it — its Russian Wiktionary translations or the
  English Wiktionary tables of the same sense contain the English word or a
  synonym of that sense. `free` → «бесплатный» → free (gratis) survives;
  → «свободный» → free (at liberty) is another meaning.
- **Sentence round trip** (needs a Russian analyser into the meta
  language): parse the produced Russian, compare its statements and concepts
  with the source ones; any lost or changed link is an error to rank down.
- Among candidates, the one whose round trip keeps the most links wins;
  ties go to the context score. The round-trip distance is also the
  automatic metric of the evaluation harness, with no reference needed.

## 6. Configuration and proof

- Every method is a named component with `enabled` and `weight`
  (config file + CLI flags), defaulting to the measured best.
- A reference set (site sentences with checked Russian, plus Tatoeba pairs)
  and an automatic score (chrF; plus sense-choice accuracy on a labelled
  subset) evaluate each component on/off. A component that does not
  improve the score is disabled by default, with the measurement recorded
  next to it.

## 7. Architecture audit (2026-11-04)

| vision item                                                                     | where                                                                                                                           | state                                                                                |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| meaning as a type, ranges                                                       | `formalize.mjs` keeps `ambiguous` candidates for nouns only; predicates take one concept                                        | partial: a range for every word is to do                                             |
| context network (typed links)                                                   | `context-network.mjs`, `data/overrides/contexts.lino`                                                                           | done                                                                                 |
| statistical / explicit / positional context, top-5                              | `context-ranking.mjs`, `senses.mjs`; `--context`, `--options`                                                                   | done                                                                                 |
| dependent (inherited) context                                                   | `discourse` referents in `translate.mjs`                                                                                        | partial: referents only, no context inheritance                                      |
| surrounding files                                                               | `options.topic` = whole document                                                                                                | partial: no section/directory scopes                                                 |
| method switches + measurement                                                   | `methods.mjs`, `scripts/evaluate.mjs`                                                                                           | done: 9 methods, `npm run formal-ai:evaluate --ablate`, `method-evaluation.md`       |
| lexical round trip                                                              | `round-trip.mjs` (word level, as sense evidence)                                                                                | done                                                                                 |
| English → meta → English                                                        | `english/generate/`, `english/round-trip.mjs`, `formal-ai roundtrip`                                                            | done: 92% of all fixtures exact; remaining defects listed in `english-round-trip.md` |
| Russian → meta                                                                  | `russian/read-back.mjs`: word-level read-back to ranges of meanings with their grammar                                          | partial: reads links back; a Russian parser for Russian → meta → Russian is to do    |
| source registry, switchable APIs                                                | `sources/registry.mjs`                                                                                                          | done                                                                                 |
| adapters to unified links, union with overrides                                 | `links/schema.mjs`, `links/union.mjs` (overrides first, per link, with provenance), `links/write.mjs`, `formal-ai links <word>` | done                                                                                 |
| Tatoeba, en.wikipedia language links, kaikki, lexeme senses (P5137/P5972/P9488) | `sources/link-adapters.mjs`, through `getJson` and the registry                                                                 | loaded and exposed, off by default; used as evidence once a measurement shows a gain |

### Defects the round trips found (2026-11-04)

- Negation over a coordination is not an explicit link: in "You don't
  market yourself or set prices" the English generator shares the negation
  with both verbs, while the Russian one negates only the first
  («не продаёте себе или кладёте»). The meta language must say which.
- "Neither homepage names…": the meta has `name` positive; «Также не …»
  renders a negation the meta does not hold.
- "…who pay to support you" comes back as "…that pay you to support": the
  object is attached to the wrong verb.
- "monthly": the concept's Russian lemma is «месячно» while the generator
  writes «ежемесячно»; the lexicon and the generator disagree.
- "Prices range from $5 to $50" → «бродят»: the sense choice itself is
  wrong (range = wander). Both round trips pass, because each is faithful to
  the meta; only a range comparison (the Russian word's English range vs
  the English word's) or a reference catches it.

## 8. Plan

1. Reference set + automatic score (chrF and lexical round trip) +
   per-component on/off switch; source registry.
2. Context types: load topic labels (Wiktionary `lb`, Wikidata `P921`/
   `P9488`/`P279`) into the type hierarchy; audit the sources.
3. Statistical context with top-5 coherent readings.
4. Explicit context option; positional indicators; document/section scopes.
5. Dependent context through reference resolution.
6. Tatoeba sentence pairs and Wikidata lexeme translations as evidence.
7. English generator from the meta language: the English round trip as a
   test invariant over every fixture sentence.
8. Russian → meta language analyser for the sentence round trip (reusing
   the Russian Wiktionary morphology already loaded for generation); the
   full circle in the evaluation harness.
9. Ranges of meanings for every word in the meta language; Russian word
   choice by range overlap.
10. Source adapters emitting lino links, merged as union layers with the
    overrides; `formal-ai links <word>`.
