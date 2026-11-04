/** Document overlap for ambiguous Wikidata names; popularity breaks ties only. */
import { chunks, getJson } from './fetch.mjs';

const STOP = new Set(
  'the a an of to in on for and or by with from at as is are be that which who its it this their not other'.split(
    ' '
  )
);
const words = (text) =>
  new Set(
    (text.toLowerCase().match(/[\p{L}]+/gu) || [])
      .filter((w) => w.length > 2 && !STOP.has(w))
      .map((w) => w.replace(/ies$/, 'y').replace(/s$/, '').replace(/y$/, ''))
  );
const values = (items = {}) =>
  ['en', 'ru', 'mul']
    .flatMap((language) => items[language] || [])
    .flat()
    .map((x) => x.value || '')
    .join(' ');
const instances = (entity) =>
  ['P31', 'P279', 'P17', 'P1001']
    .flatMap((p) => entity?.claims?.[p] || [])
    .map((c) => c.mainsnak?.datavalue?.value?.id)
    .filter(Boolean);

export async function entityContext(entities, topic, options) {
  const types = {};
  const ids = [...new Set(Object.values(entities).flatMap(instances))];
  for (const batch of chunks(topic ? ids : [], 50)) {
    const body = await getJson(
      `https://www.wikidata.org/w/api.php?${new URLSearchParams({
        action: 'wbgetentities',
        format: 'json',
        ids: batch.join('|'),
        props: 'labels|descriptions',
        languages: 'en|ru|mul',
      })}`,
      options
    ).catch(() => ({}));
    Object.assign(types, body.entities || {});
  }
  const context = words(topic || '');
  const local = new Map();
  const headingsByName = new Map();
  const nearby = (name) => {
    if (!local.has(name)) {
      const lower = topic.toLowerCase();
      const windows = [];
      const sectionTitles = [];
      let at = lower.indexOf(name.toLowerCase());
      while (at >= 0) {
        const before = topic.slice(0, at);
        const headings = [...before.matchAll(/^#{1,6} .+$/gm)];
        const heading = headings.at(-1);
        if (heading) {
          sectionTitles.push(heading[0]);
        }
        const start = heading ? heading.index : Math.max(0, at - 800);
        const next = /^#{1,6} .+$/m.exec(topic.slice(at + name.length));
        const end = heading && next ? at + name.length + next.index : at + 800;
        windows.push(topic.slice(start, end));
        at = lower.indexOf(name.toLowerCase(), at + name.length);
      }
      local.set(name, words(windows.join(' ')));
      headingsByName.set(name, words(sectionTitles.join(' ')));
    }
    return local.get(name);
  };
  return (id, name) => {
    const e = entities[id] || {};
    const own = words(name);
    const cues = words(
      [
        values(e.labels),
        values(e.descriptions),
        values(e.aliases),
        ...instances(e).map((type) => values(types[type]?.labels)),
      ].join(' ')
    );
    const near = nearby(name);
    // Normalize overlap so entities with many multilingual aliases do not win
    // merely by supplying a much longer bag of words.
    // one shared word is chance ("not", "covered"); context must agree on
    // at least two words before it outranks popularity
    const shared = [...cues].filter(
      (w) => !own.has(w) && (near.has(w) || context.has(w))
    );
    if (shared.length < 2) {
      return 0;
    }
    const headingOverlap = [...cues].filter(
      (w) => !own.has(w) && headingsByName.get(name)?.has(w)
    ).length;
    return (
      2 * headingOverlap +
      [...cues]
        .filter((w) => !own.has(w))
        .reduce(
          (score, w) =>
            score + (near.has(w) ? 4 : 0) + (context.has(w) ? 0.1 : 0),
          0
        ) /
        Math.sqrt(Math.max(1, cues.size))
    );
  };
}
