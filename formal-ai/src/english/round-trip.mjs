/** English → meta → English → meta, compared without source/sense diagnostics. */
import { formalize } from '../formalize.mjs';
import { loadLexicon } from '../lexicon.mjs';
import { DocumentMemory } from '../senses.mjs';
import { generate } from './generate.mjs';

/** Every defined leaf is a link. Array indices retain roles and modifier order. */
export function metaLinks(formal) {
  const links = new Map();
  function visit(value, path) {
    if (value === undefined) {
      return;
    }
    if (value !== null && typeof value === 'object') {
      const entries = Object.entries(value).filter(([, v]) => v !== undefined);
      if (!entries.length) {
        links.set(path, Array.isArray(value) ? '[]' : '{}');
      }
      for (const [key, child] of entries) {
        visit(child, `${path}.${key}`);
      }
    } else {
      links.set(path, value);
    }
  }
  visit(formal.statements, 'statements');
  return links;
}

export function compareMeta(before, after) {
  const a = metaLinks(before);
  const b = metaLinks(after);
  return [...new Set([...a.keys(), ...b.keys()])].sort().flatMap((path) => {
    if (a.has(path) && b.has(path) && a.get(path) === b.get(path)) {
      return [];
    }
    return [
      {
        path,
        kind: path
          .split('.')
          .filter((p) => !/^\d+$/.test(p))
          .at(-1),
        change: !a.has(path) ? 'added' : !b.has(path) ? 'lost' : 'changed',
        ...(a.has(path) ? { before: a.get(path) } : {}),
        ...(b.has(path) ? { after: b.get(path) } : {}),
      },
    ];
  });
}

export function englishRoundTrip(
  sentence,
  lexicon = loadLexicon(),
  options = {}
) {
  // Independent, identically initialized memories: the second parse must not
  // inherit sense evidence introduced by the first parse.
  const memory = () =>
    Object.assign(new DocumentMemory(), options.memory || {});
  const before = formalize(sentence, lexicon, memory(), options);
  const english = generate(before, lexicon);
  const after = formalize(english, lexicon, memory(), options);
  const differences = compareMeta(before, after);
  return {
    english,
    exact: differences.length === 0,
    differences,
    before,
    after,
    complete:
      before.statements.length > 0 &&
      !before.unknown.length &&
      !before.leftover.length &&
      !after.unknown.length &&
      !after.leftover.length,
  };
}
