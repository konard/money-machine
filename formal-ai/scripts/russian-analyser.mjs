#!/usr/bin/env node
/** Independent Russian clause analysis of every complete fixture translation. */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { productionEnv, sentenceSet, BASIC } from './record-fixtures.mjs';
const cache = mkdtempSync(join(tmpdir(), 'formal-ai-analyser-'));
Object.assign(
  process.env,
  productionEnv({ FORMAL_AI_OFFLINE: '1', FORMAL_AI_CACHE: cache })
);
try {
  const { loadLexicon } = await import('../src/lexicon.mjs');
  const { resolveText } = await import('../src/resolve.mjs');
  const { translateDocument } = await import('../src/document.mjs');
  const { analyzeRussian, analyzerIndex, russianRoundTrip } =
    await import('../src/russian/analyze/index.mjs');
  const { compareRussianMeta } =
    await import('../src/russian/analyze/compare.mjs');
  const { naturalizeRussian } = await import('../src/russian/naturalize.mjs');
  const baselinePath = process.argv[process.argv.indexOf('--baseline') + 1];
  const baseline = process.argv.includes('--baseline')
    ? await import(
        pathToFileURL(
          join(baselinePath, 'formal-ai/src/russian/naturalize.mjs')
        ).href
      )
    : null;
  const { pages } = await import('./sample.mjs');
  const { fixtureFetch } = await import('./evaluate.mjs');
  const sources = JSON.parse(
    readFileSync(new URL('./fixture-sentences.json', import.meta.url), 'utf8')
  );
  const topics = new Map(pages().map((p) => [p.source, p.text]));
  const sentences = sentenceSet();
  const lexicon = loadLexicon({ fresh: true });
  await resolveText(sentences.join('\n\n'), {
    lexicon,
    fetchImpl: fixtureFetch(),
  });
  const index = analyzerIndex(lexicon);
  const counts = {};
  const rangeCounts = {};
  const failures = [];
  const rows = [];
  let exact = 0;
  let compatible = 0;
  let complete = 0;
  let ruExact = 0;
  let ruComplete = 0;
  const regression = { inputs: 0, sentences: 0, changed: [] };
  sentences.forEach((source, i) => {
    const translated = translateDocument(source, {
      lexicon,
      topic: topics.get(sources[i - BASIC.length]?.source),
    });
    if (baseline && i >= BASIC.length) {
      regression.inputs += 1;
      for (const s of translated.sentences.filter((s) => s.formal)) {
        const before = baseline.naturalizeRussian(s.formal, lexicon).text;
        const after = naturalizeRussian(s.formal, lexicon).text;
        regression.sentences += 1;
        if (before !== after) {
          regression.changed.push({ source: s.source, before, after });
        }
      }
    }
    for (const s of translated.sentences) {
      if (!s.formal || !s.complete) {
        continue;
      }
      const parsed = analyzeRussian(s.text, lexicon, { index });
      const comparison = compareRussianMeta(s.formal, parsed);
      const full = !parsed.unknown.length && !parsed.leftover.length;
      const trip = russianRoundTrip(s.text, lexicon, { index });
      exact += Number(comparison.exact && full);
      compatible += Number(comparison.compatible && full);
      complete += Number(full);
      ruExact += Number(trip.exact && trip.complete);
      ruComplete += Number(trip.complete);
      rows.push({
        english: s.source,
        russian: s.text,
        full,
        comparison,
        trip: { exact: trip.exact, complete: trip.complete },
        leftover: parsed.leftover,
      });
      comparison.problems.forEach((d) => {
        counts[d.kind] = (counts[d.kind] || 0) + 1;
      });
      comparison.ranges.forEach((d) => {
        rangeCounts[d.kind] = (rangeCounts[d.kind] || 0) + 1;
      });
      if (!comparison.compatible || !full) {
        failures.push(
          `- ${s.source}\n  - ${s.text}\n  - ${comparison.problems.map((d) => `${d.path}: ${JSON.stringify(d.before)} → ${JSON.stringify(d.after)}`).join('; ') || 'No link differences'}${parsed.leftover.length ? `; unparsed: ${parsed.leftover.join(' ')}` : ''}`
        );
      }
    }
  });
  const total = rows.length;
  const share = (n) =>
    `${n}/${total} (${((100 * n) / Math.max(1, total)).toFixed(1)}%)`;
  const table = (values) =>
    Object.entries(values)
      .sort((a, b) => b[1] - a[1])
      .map(([kind, n]) => `| ${kind} | ${n} |`)
      .join('\n');
  const report = [
    '# Russian analyser',
    '',
    'Generated offline by `node formal-ai/scripts/russian-analyser.mjs --write`. The analyser receives only Russian text and the replay lexicon: it never receives the English sentence or source meta. All fixture sentences are replayed with the production settings and original page topics; incomplete English translations are excluded from the denominator.',
    '',
    `- Complete fixture translations evaluated: ${total} (of ${sentences.length} inputs).`,
    `- EN → meta → RU → meta, exact links: ${share(exact)}.`,
    `- Source links compatible with grammatical ranges, with a complete Russian parse: ${share(compatible)}.`,
    `- Complete Russian parses: ${share(complete)}.`,
    `- RU → meta → RU → meta, exact links and complete parses: ${share(ruExact)}; both parses complete: ${share(ruComplete)}.`,
    ...(baseline
      ? [
          `- Generator regression check against the supplied baseline, on identical source meta: ${regression.inputs} seeded website inputs, ${regression.sentences} parsed sentences; ${regression.changed.length} changed Russian outputs. This also checks incomplete translations; no new vocabulary lookups are made for the sample.`,
        ]
      : []),
    '',
    '## Precision and comparison',
    '',
    'Exact equality uses `compareMeta` without deleting links. Compatibility additionally accepts an observed grammatical or lexical range containing every source alternative, an added unspecified definiteness range, and a relation/modality representative whose explicit range contains the source value. Russian aspect evidence (`russianAspect`) and relation/modality ranges are additional evidence, not English claims. All other changes, missing links, lexical ambiguity annotations, and unparsed tokens remain failures. Counts below are differing leaves, not sentence counts. These measurements are stricter than the older word-presence read-back.',
    '',
    'Bare Russian nouns have `definiteness: "definite indefinite"`; demonstratives and explicit indefinite words narrow it. Imperfective and perfective preserve their observed Russian aspect and leave English simple/progressive or simple/perfect interpretations open. Lexical readings remain in `candidates`, using the same range field as English formalization; shared prepositions retain alternatives in `relationRange`. The first reading provides a renderable representative; the range must be consulted when interpreting it. Polite вы and plural imperatives retain the singular/plural addressee range; past agreement preserves speaker gender.',
    '',
    '## Coverage and limits',
    '',
    'The parser uses the shared form index, case/finite agreement, verb government and marker government, zero/explicit copulas, possession/existence, local negation, perfective future, auxiliary future, imperatives, questions, relative clauses, coordination, calendar/time classes, modals and infinitive complements. Closed-class paradigms and modal forms are inverted from the generator tables/functions. It does not yet invert every generator paraphrase: nested nominal attachments, participial paraphrases, ellipsis, idiomatic subject rearrangements, and some nonfinite constructions remain incomplete. Russian lexical ranges often differ from the English ranges introduced by the concurrent meaning-range work; these are reported as losses/widenings rather than reconstructed from the source. This is a measured analyser implementation, not a claim of complete reversibility.',
    '',
    '## Concrete round trips',
    '',
    '| Input Russian | Regenerated Russian | Preserved evidence |',
    '| --- | --- | --- |',
    '| Я читаю книгу. | Я читаю книгу. | Subject, object, present, definiteness range |',
    '| Я прочитала книгу. | Я прочитала книгу. | Perfective, past, feminine speaker |',
    '| У меня нет ручки. | У меня нет ручки. | Possession, negative, genitive theme |',
    '| Книга, которую я читал, хорошая. | Книга, которую я читал, хорошая. | Relative object and its antecedent |',
    '',
    '## Differing links by kind',
    '',
    '| Kind | Count |',
    '| --- | ---: |',
    table(counts),
    '',
    '## Grammatical ranges compatible with source links',
    '',
    '| Kind | Count |',
    '| --- | ---: |',
    table(rangeCounts),
    '',
    '## Remaining differences',
    '',
    ...(baseline && regression.changed.length
      ? [
          'Generator differences against the supplied baseline:',
          '',
          ...regression.changed.map(
            (r) =>
              `- ${r.source}\n  - Before: ${r.before}\n  - After: ${r.after}`
          ),
          '',
        ]
      : []),
    ...failures,
    '',
  ].join('\n');
  if (process.argv.includes('--write')) {
    writeFileSync(
      new URL('../docs/russian-analyser.md', import.meta.url),
      report
    );
  }
  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
  } else {
    process.stdout.write(report);
  }
} finally {
  rmSync(cache, { recursive: true, force: true });
}
