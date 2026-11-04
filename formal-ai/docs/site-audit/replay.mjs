/** Audit-only offline transport. Import with NODE_OPTIONS=--import=... .
 * FORMAL_AI_AUDIT_PAGES selects the frozen title index produced by build-index.
 * Set FORMAL_AI_CACHE to the same isolated directory before and after a change.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(
  new URL('../../../tests/formal-ai/fixtures/public', import.meta.url)
);
const english = new Map();
const russian = new Map();
function walk(directory) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      walk(path);
      continue;
    }
    const body = JSON.parse(readFileSync(path, 'utf8'));
    for (const page of body.query?.pages || []) {
      if (page.revisions) {
        (path.includes('/wiktionary-ru/') ? russian : english).set(
          page.title,
          page
        );
      }
    }
  }
}
walk(root);
const snapshot =
  process.env.FORMAL_AI_AUDIT_PAGES || '/tmp/site-audit/pages.json';
for (const [title, page] of Object.entries(
  JSON.parse(readFileSync(snapshot, 'utf8'))
)) {
  english.set(title, page);
}

globalThis.fetch = (url, options = {}) => {
  const target = new URL(url);
  const params = options.body
    ? new URLSearchParams(options.body)
    : target.searchParams;
  let body;
  if (params.has('titles')) {
    const pages = target.host === 'ru.wiktionary.org' ? russian : english;
    body = {
      query: {
        pages: params
          .get('titles')
          .split('|')
          .map((title) => pages.get(title) || { title, missing: true }),
      },
    };
  } else if (params.get('action') === 'wbsearchentities') {
    body = { search: [] };
  } else if (params.get('action') === 'wbgetentities') {
    body = { entities: {} };
  } else if (params.get('action') === 'parse') {
    body = { parse: { text: '' } };
  } else {
    body = { query: { search: [], searchinfo: { totalhits: 0 } } };
  }
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
};
// Skip the production network throttle only inside this zero-network replay.
const timer = globalThis.setTimeout;
globalThis.setTimeout = (fn, ms, ...args) =>
  timer(fn, ms === 250 ? 0 : ms, ...args);
