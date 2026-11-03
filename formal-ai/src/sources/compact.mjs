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

const KEEP_SECTIONS = ['English', 'Russian'];

/** The English and Russian sections of an en.wiktionary page, compacted. */
export function compactWikitext(text) {
  if (typeof text !== 'string' || !/^==[^=]/m.test(text)) {
    return text;
  }
  const sections = text.split(/^(?===[^=].*==\s*$)/m);
  const kept = sections.filter((s) =>
    KEEP_SECTIONS.some((l) => s.startsWith(`==${l}==`))
  );
  if (!kept.length) {
    return text;
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
    // quotations ("#* 1847, …") are never read
    if (/^#+\*/.test(line)) {
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

const valuesOnly = (items) =>
  items &&
  Object.fromEntries(
    Object.entries(items).map(([language, x]) => [
      language,
      Array.isArray(x)
        ? x.map((a) => ({ value: a.value }))
        : { value: x.value },
    ])
  );

function compactClaims(claims) {
  return (
    claims &&
    Object.fromEntries(
      Object.entries(claims).map(([p, list]) => [
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
  if (value.entities) {
    return {
      ...value,
      entities: Object.fromEntries(
        Object.entries(value.entities).map(([id, e]) => [id, compactEntity(e)])
      ),
    };
  }
  if (bucket === 'wiktionary' && value.query?.pages) {
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
                  { slots: { main: { content: compactWikitext(content) } } },
                ],
              };
        }),
      },
    };
  }
  return value;
}
