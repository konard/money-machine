# Context network

`ContextNetwork` stores `(Context: Type Context)`, self-targeted context
subtypes, and additional parents as pairs marked by `Extends`. Meaning
links have source `Meaning` and extend their dictionary contexts.
`isA`, `ancestorsOf`, and `lexicon.contextsOf(conceptOrId)` include inherited
types and terminate on cycles. Specificity is the shortest distance to
`Context`, so a cycle cannot inflate it.

Public fields start with the existing Wiktionary `senseDomain` labels.
`sources/context-data.mjs` searches Wikidata for an exact English field
label, preferring lowercase subject labels over identically named places.
It follows `P279` for three levels by default (maximum eight), with at most
eight parents per item and fifty items per level. The normal JSON cache,
fixture recorder, offline mode, and required translator User-Agent apply.
Wiktionary supplies definitions and labels; Wikidata supplies labels,
descriptions and subclass claims. No downloaded code executes.

`data/overrides/contexts.lino` uses the existing lexicon override loader.
For example:

```lino
context finance
  extends commerce
  alias "financial affairs"
concept a-public-sense-id
  contexts (finance)
```

Local context definitions replace public parents. Context-only concept
entries replace memberships without replacing the vocabulary. Empty
`contexts` explicitly makes a meaning neutral. Quote field names with spaces.

Use `translateDocument(text, { context: 'commerce', options: 5 })`, or:

```sh
formal-ai translate --context commerce "The free plan"
formal-ai translate --options 5 "Some text."
```

The existing `context: TranslationContext` API remains supported; use
`contextName` to configure that state's explicit field at construction.
Each option has a context label and its own translation state. Candidate
filtering enforces compatibility before sense ranking. Unknown words do
not produce coherent options; incompatible fields can yield no options.

Statistical ranking counts each content token once per context and breaks
coverage ties by specificity. A token cannot corroborate its own sense.
Positional indicators must have a common single most specific field across
all their meanings; syntactic partners precede linear distance. Explicit
context has more weight than either. Existing domain evidence is suppressed
when typed evidence supplies it. For an explicit field, otherwise unlabelled
senses can acquire membership through one level of public noun definitions,
requiring at least two distinct terms shared with the field's definitions
and Wikidata description. This expansion is bounded to 64 cue pages.

The three methods register in the shared `METHODS` object from
`context-ranking.mjs`, leaving the concurrently maintained registry file
untouched. Defaults: `statisticalContext=0.5`, `explicitContext=1`,
`positionalContext=1`; normal `--methods` and environment overrides apply.
On the 30 recorded website sentences, full statistical weight introduced a
chess reading of a software instruction. At 0.5, one legal-register reading
improved and the other 29 translations stayed unchanged.

Offline tests cover public API responses, cache replay, inheritance,
cycles, shadowing, specificity, method ablations, grammatical proximity,
capitalized dictionary ambiguity, and coherent alternatives. Dictionary
coverage and existing parser/morphology errors still limit translation:
context selection cannot supply an unattested Russian realisation.
