/**
 * Compact public responses before they are recorded as test fixtures:
 * only what the translator reads is kept, so replaying a fixture gives
 * the same translation as the live response while the repository stays
 * small. Wiktionary pages keep their English and Russian sections, and a
 * translation table keeps the Russian line and one bare line per other
 * language (their number measures how widely a sense is translated);
 * Wikidata entities keep labels, aliases, English/Russian descriptions,
 * claim values and the number of sitelinks.
 */

import { russianGovernment, senseFrames } from './verb-frames.mjs';

const KEEP_SECTIONS = ['English', 'Russian'];
// Item context/types, grammatical gender, sense grounding/translation and
// lexeme characteristics: all properties read by the public-source callers.
const CLAIMS = new Set([
  'P31',
  'P279',
  'P17',
  'P1001',
  'P5185',
  'P5137',
  'P5972',
  'P1552',
]);

/** Only government.mjs consumes the wiktionary-ru bucket. Keep its case notes,
 * homonym boundaries and highlighted recipient examples in original order. */
function compactGovernment(text) {
  return [
    ...text.matchAll(
      /^={3,5}\s*Управление\s*={3,5}\s*\n[\s\S]*?(?=^=|$(?![\s\S]))|^=+[^\n]*|\{\{помета\|[^{}]+\}\}|\{\{пример\|[^\n]*/gm
    ),
  ]
    .map((m) => m[0])
    .filter((part) => {
      if (!part.startsWith('{{пример|') || part.includes('{{помета|')) {
        return true;
      }
      // Only highlighted-headword examples with a dative pronoun can affect
      // exampleRecipient. Keep a superset so citation markup stays harmless.
      const plain = part.normalize('NFD').replace(/[̀́]/g, '').normalize('NFC');
      return (
        /\{\{выдел\|/i.test(part) && /ему|ей|им|мне|нам|вам|тебе/i.test(plain)
      );
    })
    .map((part) => {
      if (
        /^=/.test(part) &&
        !/Управление|\{\{-ru-\}\}|^==\s*\{\{з\|II/.test(part)
      ) {
        return '=';
      }
      if (!part.startsWith('{{пример|') || part.includes('{{помета|')) {
        return part;
      }
      const plain = part
        .normalize('NFD')
        .replace(/[̀́]/g, '')
        .normalize('NFC')
        .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1')
        .replace(/'''?/g, '');
      const recipient = plain.match(
        /(?:\{\{выдел\|[^}]+\}\}\s+(?:ему|ей|им|мне|нам|вам|тебе)(?![а-яё])|(?<![а-яё])(?:ему|ей|им|мне|нам|вам|тебе)\s+\{\{выдел\|)/i
      );
      return recipient ? `{{пример|${recipient[0]}` : '';
    })
    .join('\n');
}

/** The English and Russian sections of an en.wiktionary page, compacted. */
export function compactWikitext(text) {
  if (typeof text !== 'string' || !/^==[^=]/m.test(text)) {
    // Translation subpages can have no language heading at all.
    return typeof text === 'string' ? compactSection(text) : text;
  }
  const sections = text.split(/^(?===[^=].*==\s*$)/m);
  const kept = sections.filter((s) =>
    KEEP_SECTIONS.some((l) => s.startsWith(`==${l}==`))
  );
  if (!kept.length) {
    // Russian Wiktionary uses ={{-ru-}}= rather than ==Russian==.
    // A nonempty page with no usable language must still exist in fetchPages:
    // its presence fixes insertion order before a later spelling supplies data.
    return /=\s*\{\{-ru-\}\}\s*=/.test(text) ? text : '\n';
  }
  return kept.map(compactSection).join('');
}

function compactSection(section) {
  const out = [];
  let inTable = false;
  for (const line of section.split('\n')) {
    if (/\{\{trans-top/.test(line)) {
      inTable = true;
    } else if (/\{\{trans-bottom\}\}/.test(line)) {
      inTable = false;
    }
    if (inTable && /^\*/.test(line) && !/^\*\s*Russian:/.test(line)) {
      // other languages: their count only ("* French:")
      if (/^\*[^:*]/.test(line)) {
        out.push(`${line.split(':')[0]}:`);
      }
      continue;
    }
    // Quotations can carry frames. Only omit citations with no grammatical
    // evidence and no templates beyond the citation wrapper itself.
    if (
      /^#+\*/.test(line) &&
      !/\{\{/.test(line.replace(/\{\{quote-[^{}]*\}\}/g, '')) &&
      !senseFrames(line).length &&
      !russianGovernment(line)
    ) {
      continue;
    }
    out.push(line);
  }
  return out.join('\n');
}

const pick = (object, keys) =>
  Object.fromEntries(
    keys.filter((k) => object?.[k]).map((k) => [k, object[k]])
  );

function valuesOnly(items) {
  if (!items) {
    return items;
  }
  // Context reads en/ru/mul. Other languages serve only exact-name membership,
  // so duplicate values across those languages carry no additional evidence.
  const contextual = new Set(['en', 'ru', 'mul']);
  const seen = new Set(
    [...contextual].flatMap((l) => [items[l] || []].flat()).map((x) => x.value)
  );
  return Object.fromEntries(
    Object.entries(items).flatMap(([language, x]) => {
      const list = [x]
        .flat()
        .filter((entry) => {
          if (contextual.has(language)) {
            return true;
          }
          if (seen.has(entry.value)) {
            return false;
          }
          seen.add(entry.value);
          return true;
        })
        .map((entry) => ({ value: entry.value }));
      return list.length ? [[language, Array.isArray(x) ? list : list[0]]] : [];
    })
  );
}

function compactClaims(claims) {
  return (
    claims &&
    Object.fromEntries(
      Object.entries(claims)
        .filter(([p]) => CLAIMS.has(p))
        .map(([p, list]) => [
          p,
          list.map((c) => ({
            rank: c.rank,
            mainsnak: {
              snaktype: c.mainsnak?.snaktype,
              datavalue: c.mainsnak?.datavalue,
            },
          })),
        ])
    )
  );
}

function compactEntity(e) {
  if (!e || typeof e !== 'object') {
    return e;
  }
  const out = { ...e };
  delete out.qualifiers;
  for (const key of ['labels', 'aliases']) {
    if (e[key]) {
      out[key] = valuesOnly(e[key]);
    }
  }
  if (e.descriptions) {
    out.descriptions = valuesOnly(pick(e.descriptions, ['en', 'ru', 'mul']));
  }
  if (e.claims) {
    out.claims = compactClaims(e.claims);
  }
  if (e.sitelinks) {
    // only their number is read; the Russian and English titles are kept
    out.sitelinks = Object.fromEntries(
      Object.entries(e.sitelinks).map(([site, link]) => [
        site,
        /^(?:en|ru)wiki$/.test(site) ? { title: link.title } : {},
      ])
    );
  }
  for (const key of ['senses', 'forms']) {
    if (Array.isArray(e[key])) {
      out[key] = e[key].map((x) => ({
        ...x,
        ...(x.claims ? { claims: compactClaims(x.claims) } : {}),
      }));
    }
  }
  delete out.lastrevid;
  delete out.modified;
  delete out.pageid;
  delete out.ns;
  return out;
}

/** A compacted copy of a response for the given cache bucket. */
export function compactResponse(bucket, value) {
  if (!value || typeof value !== 'object') {
    return value;
  }
  if (/^wikidata(?:-lexemes)?$/.test(bucket) && Array.isArray(value.search)) {
    return {
      search: value.search.map((hit) => ({
        id: hit.id,
        label: hit.label,
        ...(hit.match ? { match: { text: hit.match.text } } : {}),
      })),
    };
  }
  if (bucket === 'wiktionary-render' && typeof value.parse?.text === 'string') {
    const html = value.parse.text;
    // Exactly the form spans, gender/animacy abbreviations and indeclinability
    // marker read by renderRussian; layout, CSS and module reports are unused.
    const forms = [
      ...html.matchAll(
        /class="Cyrl form-of lang-ru ([^"]*?)-form-of[^"]*"[^>]*>(?:<a[^>]*>)?([^<]+)/g
      ),
    ];
    // The reader keeps the first form for each tag set; discard repetitions.
    const first = new Map();
    for (const m of forms) {
      if (!first.has(m[1])) {
        first.set(
          m[1],
          `<i class="Cyrl form-of lang-ru ${m[1]}-form-of">${m[2]}</i>`
        );
      }
    }
    const titles = [...html.matchAll(/<abbr[^>]*title="([^"]+)"/g)].map(
      (m) => `<abbr title="${m[1]}">`
    );
    const marker = html.match(/indeclinable|несклоняем/i)?.[0] || '';
    // the table caption names the animacy: "(anim masc-form …)"
    const caption = /title="Appendix:Russian nouns">([^<]+)</.exec(html);
    return {
      parse: {
        text: [
          ...first.values(),
          ...new Set(titles),
          ...(caption
            ? [`<a title="Appendix:Russian nouns">${caption[1]}</a>`]
            : []),
          marker,
        ].join('\n'),
      },
    };
  }
  if (
    /^ruwiki-(?:frequency|context)$/.test(bucket) &&
    value.query?.searchinfo
  ) {
    return { query: { searchinfo: value.query.searchinfo } };
  }
  if (bucket === 'rnc-frequency' && value.parse?.wikitext) {
    const text = value.parse.wikitext['*'] ?? value.parse.wikitext;
    if (typeof text === 'string') {
      return {
        parse: {
          wikitext: text
            .split('\n')
            .filter((line) => /^#\s+/.test(line))
            .join('\n'),
        },
      };
    }
  }
  if (value.entities) {
    return {
      ...value,
      entities: Object.fromEntries(
        Object.entries(value.entities).map(([id, e]) => [id, compactEntity(e)])
      ),
    };
  }
  if (['wiktionary', 'wiktionary-ru'].includes(bucket) && value.query?.pages) {
    return {
      ...value,
      query: {
        ...value.query,
        pages: value.query.pages.map((page) => {
          const content = page.revisions?.[0]?.slots?.main?.content;
          return content === undefined
            ? page
            : {
                ...page,
                revisions: [
                  {
                    slots: {
                      main: {
                        content:
                          bucket === 'wiktionary-ru'
                            ? compactGovernment(content)
                            : compactWikitext(content),
                      },
                    },
                  },
                ],
              };
        }),
      },
    };
  }
  return value;
}
