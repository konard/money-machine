/** Compare EN → RU → EN on Formal AI's published English benchmark corpus. */
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createContext, runInContext } from 'node:vm';
import { execFileSync } from 'node:child_process';
import { productionEnv } from '../formal-ai/scripts/record-fixtures.mjs';

const [checkout, mode] = process.argv.slice(2);
if (!checkout) {
  throw new Error('Pass the path to a Formal AI checkout at 99b00e4e.');
}
const upstream = resolve(checkout);
const revision = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: upstream,
  encoding: 'utf8',
}).trim();
if (revision !== '99b00e4e1774be9683fcc087cd4737806668dbd7') {
  throw new Error(
    `Expected pinned Formal AI revision 99b00e4e, got ${revision}.`
  );
}
const readUpstream = (path) => readFileSync(join(upstream, path), 'utf8');
const importUpstream = (path) => import(pathToFileURL(join(upstream, path)));
const vm = createContext({});
for (const filename of [
  'js/parser-cache-primordials.js',
  'js/seed_loader.js',
]) {
  runInContext(readUpstream(filename), vm, { filename });
}
const parseLino = (text) =>
  JSON.parse(JSON.stringify(vm.FormalAiSeed.parse(text)));
const { installHost } = await importUpstream('js/agentic/host.mjs');
installHost({ readText: readUpstream, parseLino });
const { roundTrip, sameStatementMeaning } = await importUpstream(
  'js/agentic/crate/round_trip_translation.mjs'
);
const {
  clauseStatement,
  contentIds,
  formalizeText,
  knownIds,
  statementTerms,
  WordKind,
} = await importUpstream('js/agentic/crate/text_formalization.mjs');
const corpus = parseLino(
  readUpstream('data/benchmarks/round-trip-translation/sentences.lino')
).children;
const value = (node, name) =>
  node.children.find((child) => child.name === name)?.value;
const texts = corpus
  .filter(
    (node) =>
      node.name === 'round-trip-sentence' && value(node, 'language') === 'en'
  )
  .map((node) => value(node, 'text'));

function score(original, russian, english) {
  // The upstream scorer reads each rendered clause with the opener flag off.
  const read = (text, language) =>
    original.length === 1
      ? [clauseStatement(text, language, null, false)]
      : formalizeText(text, language);
  const middle = read(russian, 'ru');
  const end = read(english, 'en');
  let terms = 0;
  let survives =
    original.length > 0 &&
    middle.length === original.length &&
    end.length === original.length;
  for (const [i, statement] of original.entries()) {
    const ids = knownIds(statement);
    const russianIds = new Set(middle[i] ? knownIds(middle[i]) : []);
    const englishIds = new Set(end[i] ? knownIds(end[i]) : []);
    terms += ids.filter(
      (id) => russianIds.has(id) && englishIds.has(id)
    ).length;
    survives &&=
      ids.length > 0 &&
      statementTerms(statement).every(
        (term) => term.kind !== WordKind.Unknown
      ) &&
      sameStatementMeaning(statement, middle[i]) &&
      sameStatementMeaning(statement, end[i]);
  }
  return { terms, survives };
}

const offline = mode !== '--live';
const providedCache = process.env.FORMAL_AI_CACHE;
const cache =
  providedCache ||
  mkdtempSync(join(tmpdir(), 'formal-ai-upstream-comparison-'));
Object.assign(
  process.env,
  productionEnv({
    FORMAL_AI_CACHE: cache,
    FORMAL_AI_OFFLINE: offline ? '1' : '',
    FORMAL_AI_SPARSE_FIXTURES: offline ? '1' : '',
  })
);
try {
  const { loadLexicon } = await import('../formal-ai/src/lexicon.mjs');
  const { resolveText } = await import('../formal-ai/src/resolve.mjs');
  const { translateDocument } = await import('../formal-ai/src/document.mjs');
  const { generateEnglish } =
    await import('../formal-ai/src/english/generate.mjs');
  const { analyzerIndex } =
    await import('../formal-ai/src/russian/analyze/index.mjs');
  const { viaRussian } =
    await import('../formal-ai/src/russian/analyze/english-round-trip.mjs');
  const lexicon = loadLexicon({ fresh: true });
  const vocabulary = await resolveText(texts.join('\n\n'), { lexicon });
  const index = analyzerIndex(lexicon);
  const totals = {
    revision,
    sources: offline ? 'recorded public sources' : 'live public sources',
    missingWords: vocabulary.missing.length,
    sentences: texts.length,
    terms: 0,
    upstreamSentences: 0,
    upstreamTerms: 0,
    localSentences: 0,
    localTerms: 0,
    completeLocalCycles: 0,
    completeLocalSurvivors: 0,
  };
  for (const text of texts) {
    const original = formalizeText(text, 'en');
    totals.terms += original.reduce(
      (count, s) => count + contentIds(s).length,
      0
    );
    const upstreamTrip = roundTrip(text, 'en', 'ru');
    totals.upstreamSentences += Number(upstreamTrip.survives);
    totals.upstreamTerms += upstreamTrip.survivingTerms;
    const translated = translateDocument(text, { lexicon });
    const cycles = translated.sentences.map((sentence) =>
      viaRussian(sentence, lexicon, { index })
    );
    const complete =
      cycles.length > 0 && cycles.every((cycle) => cycle.complete);
    const english = cycles
      .map(
        (cycle) =>
          cycle.english ||
          (cycle.russianMeta?.statements.length &&
            generateEnglish(cycle.russianMeta, lexicon))
      )
      .filter(Boolean)
      .join(' ');
    if (english) {
      const scored = score(original, translated.text, english);
      totals.localSentences += Number(scored.survives);
      totals.localTerms += scored.terms;
      totals.completeLocalSurvivors += Number(complete && scored.survives);
    }
    totals.completeLocalCycles += Number(complete);
  }
  process.stdout.write(`${JSON.stringify(totals, null, 2)}\n`);
} finally {
  if (!providedCache) {
    rmSync(cache, { recursive: true, force: true });
  }
}
