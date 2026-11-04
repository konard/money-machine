#!/usr/bin/env node
/** Record production public responses, then verify replay in an empty cache. */
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const EXPECTED = join(
  ROOT,
  'tests/formal-ai/fixtures/public-expected.json'
);
export const FIXTURES = join(ROOT, 'tests/formal-ai/fixtures/public');
const SCRIPT = fileURLToPath(import.meta.url);

export const BASIC = [
  'We met in January.',
  'Tom works on Monday.',
  'We met in the morning.',
  'Mary works in the evening.',
  'Hello!',
  'Good morning!',
  'Good evening!',
  'Good night!',
  'Thank you!',
  'Goodbye!',
  'How are you?',
  'I run every day.',
  'Run the program.',
  'Run the company.',
  'I have a pen.',
  'The pen is on the table.',
  'The animals are in the pen.',
  'I use a phone.',
  'The phone is on the table.',
  'Phone me.',
  'I work at the bank.',
  'The bank lends money.',
  'We sat on the river bank.',
  'I help Mary.',
  'Mary helps Tom.',
  'I wait for Mary.',
  'We wait for the bus.',
  'I ask Mary.',
  'Tom asks a question.',
  'Mary answers the question.',
  'I answer Tom.',
  'I like the book.',
  'Mary likes music.',
  'We live in Moscow.',
  'Mary went to Moscow.',
  'Tom works for Google.',
  'Mary uses Google.',
  'I read a book.',
  'We write a letter.',
  'The children play in the park.',
  'They trademarked the name.',
  'Use trademarked images.',
  'Use copyrighted images.',
  'Use trademarked/copyrighted images.',
  'Billed monthly.',
  'You are billed per seat.',
  'A free plan.',
  'It is free.',
  'Free tier available.',
  'A free trial.',
  'A free subscription.',
  'Prices range from $5 to $50.',
  'edited files',
  'says only',
];

/** Fixed seeded website sample; see fixture-sentences.json for source paths. */
export function sentenceSet() {
  const website = JSON.parse(
    readFileSync(new URL('./fixture-sentences.json', import.meta.url), 'utf8')
  );
  return [...BASIC, ...website.map((s) => s.text)];
}

export function productionEnv(extra = {}) {
  return {
    ...process.env,
    FORMAL_AI_DATA: join(ROOT, 'formal-ai/data/overrides'),
    FORMAL_AI_FIXTURES: FIXTURES,
    FORMAL_AI_OFFLINE: '',
    FORMAL_AI_RECORD: '',
    ...extra,
  };
}

/** Replay is a separate process: DATA_DIR and all source caches start fresh. */
export function replay() {
  const cache = mkdtempSync(join(tmpdir(), 'formal-ai-replay-'));
  try {
    return JSON.parse(
      execFileSync(process.execPath, [SCRIPT, '--replay'], {
        cwd: ROOT,
        env: productionEnv({ FORMAL_AI_OFFLINE: '1', FORMAL_AI_CACHE: cache }),
        encoding: 'utf8',
        timeout: 55000,
        maxBuffer: 16 * 1024 * 1024,
      })
    );
  } finally {
    rmSync(cache, { recursive: true, force: true });
  }
}

export function differences(expected, actual) {
  return expected
    .flatMap((pair, i) =>
      pair.english === actual[i]?.english && pair.russian === actual[i]?.russian
        ? []
        : [{ expected: pair, actual: actual[i] }]
    )
    .concat(actual.slice(expected.length).map((pair) => ({ actual: pair })));
}

async function translations() {
  const { resolveText } = await import('../src/resolve.mjs');
  const { translateDocument } = await import('../src/document.mjs');
  const sentences = sentenceSet();
  // One public pre-pass, as in sample.mjs, followed by deterministic translation.
  await resolveText(sentences.join('\n\n'), {
    log: process.argv.includes('--replay') ? () => {} : console.error,
  });
  return sentences.map((english) => {
    try {
      return { english, russian: translateDocument(english).text };
    } catch (error) {
      return { english, error: error.message };
    }
  });
}

function bytes(dir) {
  return readdirSync(dir).reduce((sum, name) => {
    const path = join(dir, name);
    return (
      sum + (statSync(path).isDirectory() ? bytes(path) : statSync(path).size)
    );
  }, 0);
}

if (process.argv[1] === SCRIPT) {
  const offline = process.argv.includes('--replay');
  Object.assign(
    process.env,
    productionEnv(
      offline ? { FORMAL_AI_OFFLINE: '1' } : { FORMAL_AI_RECORD: '1' }
    )
  );
  const result = await translations();
  if (offline) {
    console.log(JSON.stringify(result));
  } else {
    const errors = result.filter((pair) => pair.error);
    if (errors.length) {
      throw new Error(
        `Translation errors:\n${JSON.stringify(errors, null, 2)}`
      );
    }
    const diffs = differences(result, replay());
    if (diffs.length) {
      throw new Error(
        `Live/offline differences:\n${JSON.stringify(diffs, null, 2)}`
      );
    }
    writeFileSync(EXPECTED, JSON.stringify(result));
    console.log(
      `${result.length} live/offline translations identical; fixtures ${(bytes(FIXTURES) / 1024 / 1024).toFixed(2)} MiB`
    );
  }
}
