import { methodWeight } from '../methods.mjs';
/** Document overlap for ambiguous Wikidata names; bounded evidence complements popularity. */
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
const instances = (entity, properties = ['P31', 'P279', 'P17', 'P1001']) =>
  properties
    .flatMap((p) => entity?.claims?.[p] || [])
    .map((c) => c.mainsnak?.datavalue?.value?.id)
    .filter(Boolean);

export async function entityContext(entities, topic, options) {
  const types = {};
  const ids = [
    ...new Set(Object.values(entities).flatMap((e) => instances(e))),
  ];
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
        const start = Math.max(0, at - 200);
        const end = at + name.length + 200;
        windows.push(topic.slice(start, end));
        at = lower.indexOf(name.toLowerCase(), at + name.length);
      }
      local.set(name, words(windows.length ? windows.join(' ') : topic));
      headingsByName.set(name, words(sectionTitles.join(' ')));
    }
    return local.get(name);
  };
  const evidence = (id, name, semanticOnly = false) => {
    const e = entities[id] || {};
    const own = words(name);
    const cues = words(
      [
        ...(semanticOnly ? [] : [values(e.labels), values(e.aliases)]),
        values(e.descriptions),
        ...instances(e, semanticOnly ? ['P31', 'P279'] : undefined).map(
          (type) => values(types[type]?.labels)
        ),
      ].join(' ')
    );
    const near = nearby(name);
    if (semanticOnly) {
      return [...cues].filter((w) => !own.has(w) && near.has(w)).length;
    }
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
  const weight = methodWeight(options?.methods, 'entityContext');
  const score = (id, name) => weight * evidence(id, name);
  score.topicEvidence = (id, name) => weight * evidence(id, name, true);
  score.organization = (id) => {
    const e = entities[id];
    return /\b(company|business|enterprise|brand|organization|organisation|software|corporation)\b/i.test(
      [
        values(e?.descriptions),
        ...instances(e).map((type) => values(types[type]?.labels)),
      ].join(' ')
    );
  };
  score.commercial = (name) =>
    weight > 0 &&
    [...nearby(name)].some((w) =>
      /^(bank|payment|payout|transfer|account|busines|commercial|developer|pay|invoice|customer|revenue|fee|sale|store)$/.test(
        w
      )
    );
  return score;
}
