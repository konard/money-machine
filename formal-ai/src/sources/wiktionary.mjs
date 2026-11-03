/**
 * English Wiktionary as a public source of meanings and Russian forms.
 *
 * - English entries: parts of speech, "form of" links (paid → pay),
 *   translation tables with one gloss per sense and Russian candidates
 *   marked for gender and aspect.
 * - Russian entries: the headword (gender, animacy, aspect partner) and the
 *   inflection table, rendered by Wiktionary's own modules through the
 *   public `action=parse` API, so every form comes tagged
 *   (`gen|p`, `1|s|pres|ind`) rather than guessed.
 */

import { chunks, getJson, pool } from './fetch.mjs';
import {
  definitionBlocks,
  senseFrames,
  russianGovernment,
} from './verb-frames.mjs';

const API = 'https://en.wiktionary.org/w/api.php';

/** Remove stress marks (кни́га → книга); ё is kept. */
export const unstress = (text) =>
  String(text || '')
    .normalize('NFD')
    .replace(/[̀́]/g, '')
    .normalize('NFC');

/**
 * Wikitext of pages, following redirects.
 * @param {string[]} titles
 * @returns {Promise<Map<string, string>>} requested title → wikitext
 */
export async function fetchPages(titles, options = {}) {
  const out = new Map();
  await pool(chunks([...new Set(titles)], 50), 2, async (batch) => {
    const body = await getJson(
      `${API}?${new URLSearchParams({
        action: 'query',
        format: 'json',
        formatversion: '2',
        prop: 'revisions',
        rvprop: 'content',
        rvslots: 'main',
        redirects: '1',
        titles: batch.join('|'),
      })}`,
      { ...options, bucket: 'wiktionary' }
    );
    const alias = new Map();
    for (const step of [
      ...(body.query?.normalized || []),
      ...(body.query?.redirects || []),
    ]) {
      alias.set(step.to, [...(alias.get(step.from) || [step.from]), step.from]);
    }
    for (const page of body.query?.pages || []) {
      const text = page.revisions?.[0]?.slots?.main?.content;
      if (!text) {
        continue;
      }
      const names = new Set([page.title, ...(alias.get(page.title) || [])]);
      // a redirect target may itself be the alias of another alias
      for (const [to, froms] of alias) {
        if (names.has(to)) {
          froms.forEach((f) => names.add(f));
        }
      }
      for (const name of names) {
        out.set(name, text);
      }
    }
  });
  return out;
}

/** The `==Language==` section of a page. */
export function languageSection(wikitext, language) {
  const parts = wikitext.split(new RegExp(`^==${language}==\\s*$`, 'm'));
  return parts.length > 1 ? parts[1].split(/^==[^=]/m)[0] : '';
}

const POS = {
  Noun: 'noun',
  Verb: 'verb',
  Adjective: 'adj',
  Adverb: 'adv',
  'Proper noun': 'propn',
  Preposition: 'prep',
  Pronoun: 'pron',
  Numeral: 'num',
  Interjection: 'intj',
  Phrase: 'phrase',
};

/** Split a language section into `{pos, text}` chunks by POS headings. */
function posChunks(section) {
  const re = /^={3,5}\s*([A-Za-z ]+?)\s*={3,5}\s*$/gm;
  const heads = [...section.matchAll(re)];
  const out = [];
  heads.forEach((m, i) => {
    const pos = POS[m[1]];
    if (!pos) {
      return;
    }
    // the chunk runs to the next POS heading (translations are nested deeper)
    const next = heads.slice(i + 1).find((h) => POS[h[1]]);
    out.push({
      pos,
      text: section.slice(
        m.index + m[0].length,
        next ? next.index : section.length
      ),
    });
  });
  return out;
}

/** Positional and named parameters of a template body (`t+|ru|слово|m`). */
export function templateArgs(body) {
  const positional = [];
  const named = {};
  let depth = 0;
  let current = '';
  const parts = [];
  for (const ch of body) {
    if (ch === '{' || ch === '[') {
      depth += 1;
    } else if (ch === '}' || ch === ']') {
      depth -= 1;
    }
    if (ch === '|' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq > 0 && /^[\w-]+$/.test(part.slice(0, eq).trim())) {
      named[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
    } else {
      positional.push(part.trim());
    }
  }
  return { positional, named };
}

/** Templates `{{name|…}}` (non-nested) in text. */
function templates(text, names) {
  const re = new RegExp(
    `\\{\\{(${names})\\|((?:[^{}]|\\{\\{[^{}]*\\}\\})*)\\}\\}`,
    'g'
  );
  return [...text.matchAll(re)].map((m) => ({
    name: m[1],
    ...templateArgs(m[2]),
  }));
}

/** Plain text of wikitext: links, templates and markup removed. */
export function plain(text) {
  return String(text || '')
    .replace(
      /\{\{(?:l|m|link|mention)\|[a-z-]+\|([^|{}]+)(?:\|[^{}]*)?\}\}/g,
      '$1'
    )
    .replace(/\{\{(?:q|qualifier|i|gloss|lb|lbl|label|sense)\|[^{}]*\}\}/g, '')
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/'''?|<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const FORM_OF =
  /\{\{(?:en-)?((?:[a-z]+[ -])*?(?:plural|past|participle|form|spelling|singular|tense|comparative|superlative|inflection|misspelling)) of\|(?:en\|)?([^|}]+)/;

// spelling variants and short forms share the senses of their target
const VARIANTS =
  'stand sp|standard spelling of|alt sp|alt form|alt sp of|alternative spelling of|alternative form of|alt form of|syn of|synonym of|short for|abbreviation of|clipping of|initialism of|acronym of|ellipsis of|US spelling of|British spelling of|en-US spelling of';

/** `ed-form`, `spast`, `past|part`, `s-verb-form`, `ing-form`, `p` → a kind. */
function inflectionKind(tags) {
  if (/part/.test(tags) && /past|ed/.test(tags)) {
    return 'past participle';
  }
  if (/ed-form|past/.test(tags)) {
    return 'past';
  }
  if (/ing/.test(tags)) {
    return 'present participle';
  }
  if (/s-verb|3\|s/.test(tags)) {
    return 'third-person singular';
  }
  if (/(^|\|)p($|\|)|plural/.test(tags)) {
    return 'plural';
  }
  return tags || 'form';
}

/** Russian candidates of a translation line. */
function russianCandidates(line) {
  return templates(line, 'tt?\\+?')
    .filter((t) => t.positional[0] === 'ru' && t.positional[1])
    .map((t) => {
      const word = unstress(plain(t.named.alt || t.positional[1]));
      const marks = t.positional.slice(2);
      return {
        word,
        // marks combine gender, animacy and number: "f", "m-an", "f-p", "p"
        gender: marks.find((g) => /^[mfn](?:-an|-in)?(?:-p)?$/.test(g))?.[0],
        plural: marks.some((g) => /(?:^|-)p$/.test(g)),
        aspect: marks.includes('pf')
          ? 'perf'
          : marks.includes('impf')
            ? 'impf'
            : undefined,
        animate: marks.some((g) => /-an$/.test(g)) || undefined,
      };
    })
    .filter((c) => c.word && /^[а-яё -]+$/i.test(c.word));
}

/**
 * English entries of a page.
 * @returns {{pos: string, definitions: string[], formOf: {lemma: string, kind: string}[],
 *   senses: {gloss: string, russian: object[]}[], see: string[], subpage: boolean}[]}
 */
const RARE =
  /^(obsolete|archaic|rare|dated|dialectal|dialect|historical|nonstandard|obsolete outside dialects)$/;

export function englishEntries(wikitext) {
  const section = languageSection(wikitext, 'English');
  return posChunks(section).map(({ pos, text }) => {
    const blocks = definitionBlocks(text);
    const definitions = blocks.map((block) => block.split('\n')[0]);
    const formOf = definitions.flatMap((d) => {
      // a dialectal or obsolete inflection ("book", Northern English past
      // of "bake") is no reading of the standard language
      const label = templates(d, 'lb|lbl|label')[0];
      if (
        label &&
        /^(?:dialectal|obsolete|archaic|nonstandard|rare|dated|eye dialect|nonce|humorous)$/.test(
          label.positional
            .slice(1)
            .find((x) =>
              /dialectal|obsolete|archaic|nonstandard|rare|dated|eye dialect|nonce|humorous/.test(
                x
              )
            ) || ''
        )
      ) {
        return [];
      }
      const infl = templates(d, 'infl of|inflection of')[0];
      if (infl && infl.positional[0] === 'en') {
        return [
          {
            kind: inflectionKind(infl.positional.slice(3).join('|')),
            lemma: plain(infl.positional[1]),
          },
        ];
      }
      const variant = templates(d, VARIANTS)[0];
      if (variant && variant.positional[0] === 'en' && variant.positional[1]) {
        return [
          { kind: 'alternative form', lemma: plain(variant.positional[1]) },
        ];
      }
      const m = FORM_OF.exec(d);
      return m ? [{ kind: m[1], lemma: plain(m[2]) }] : [];
    });
    const senses = [];
    const see = [];
    for (const m of text.matchAll(
      /\{\{trans-top(-also|-see)?\|([^\n]*?)\}\}(?:\{\{multitrans\|data=)?\s*\n([\s\S]*?)\{\{trans-bottom\}\}/g
    )) {
      const { positional } = templateArgs(m[2]);
      if (m[1] === '-see' && !/^[*]\s*Russian:/m.test(m[3])) {
        for (const page of positional.slice(1)) {
          see.push({ gloss: plain(positional[0]), page: plain(page) });
        }
      }
      if (m[1]) {
        // trans-top-see|gloss|page…: own translations plus related pages
        positional.splice(1);
      }
      const line = m[3].split('\n').find((l) => /^\*\s*Russian:/.test(l)) || '';
      const gloss = plain(positional.join(' '));
      senses.push({
        gloss,
        russian: russianCandidates(line),
        // how many languages translate the sense: a common sense ("pen"
        // the writing tool, 129) is translated far more than a rare one
        languages: m[3].split('\n').filter((l) => /^\*[^:*]/.test(l)).length,
        ...matchingDefinition(gloss, blocks),
      });
    }
    for (const t of templates(text, 'trans-see')) {
      const pages =
        t.positional.length > 1 ? t.positional.slice(1) : t.positional;
      see.push(
        ...pages.map((page) => ({
          gloss: plain(t.positional[0]),
          page: plain(page),
        }))
      );
    }
    // an entry whose every sense is obsolete or rare ("earn" the eagle)
    // must not compete with the living word
    const rare =
      definitions.length > 0 &&
      definitions.every((d) =>
        templates(d, 'lb|label|lbl').some((t) =>
          t.positional.slice(1).some((x) => RARE.test(x))
        )
      );
    // no translations of its own: a definition that is just another word
    // ("A [[document]], especially…") makes this a synonym of that word
    // (translations kept on a subpage, as for "dog", are translations too)
    const subpage = /\{\{see translation subpage/.test(text);
    if (!senses.length && !formOf.length && !subpage) {
      for (const d of definitions) {
        const m =
          /^(?:\{\{(?:senseid|lb|label|lbl)\|[^}]*\}\}\s*)*(?:(?:A|An|The)\s+)?\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\](?=[\s,;.]|$)/.exec(
            d
          );
        if (m && /^[a-z][a-z -]*$/.test(m[1])) {
          formOf.push({ kind: 'alternative form', lemma: m[1] });
        }
      }
    }
    return {
      pos,
      rare,
      definitions: definitions.map(plain).filter(Boolean),
      rawDefinitions: blocks,
      formOf,
      senses,
      see,
      subpage,
    };
  });
}

const SMALL = new Set(
  'the a an of to in on for and or by with from at as is be that which who something someone one any some other its it this'.split(
    ' '
  )
);
const contentWords = (text) =>
  new Set(
    text
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((w) => w.length > 2 && !SMALL.has(w))
      .map((w) => w.replace(/(?:es|s)$/, ''))
  );

/**
 * The definition a translation table belongs to: the one sharing most
 * words with the table's short gloss. It brings fuller context words and
 * the usage labels ("obsolete", "finance") the gloss leaves out.
 */
export function matchingDefinition(gloss, definitions) {
  const want = contentWords(gloss);
  let best = null;
  let bestScore = 0;
  for (const raw of definitions) {
    const text = plain(raw.split('\n')[0]);
    const have = contentWords(text);
    const shared = [...want].filter((w) => have.has(w)).length;
    const score = shared / Math.max(1, want.size);
    if (
      shared > 0 &&
      (score > bestScore ||
        (score === bestScore &&
          best &&
          (have.size < contentWords(best.text).size ||
            (have.size === contentWords(best.text).size &&
              /\n#+\s/.test(best.raw) &&
              !/\n#+\s/.test(raw)))))
    ) {
      best = { raw, text };
      bestScore = score;
    }
  }
  if (!best || bestScore < 0.5) {
    return {};
  }
  // a loose match ("period between sunrise and sunset" ~ "a 24-hour
  // period beginning at sunrise", labelled meteorology) is no ground for
  // carrying the definition's field or usage labels over to the sense
  const labels =
    bestScore < 0.75
      ? []
      : templates(best.raw.split('\n')[0], 'lb|label|lbl').flatMap((t) =>
          t.positional.slice(1).filter((x) => !/^[_&]$|^(?:and|or)$/.test(x))
        );
  const frames = senseFrames(best.raw.split(/\n#+\s/)[0]);
  return {
    definition: best.text,
    ...(frames.length ? { frames } : {}),
    labels,
    rare: labels.some((x) => RARE.test(x)),
  };
}

/** Headword and inflection templates of a Russian entry, by part of speech. */
export function russianTemplates(wikitext) {
  const section = languageSection(wikitext, 'Russian');
  return posChunks(section).map(({ pos, text }) => ({
    pos,
    ...(pos === 'verb' && russianGovernment(text)
      ? { government: russianGovernment(text) }
      : {}),
    headword:
      templates(text, 'ru-(?:noun\\+?|proper noun\\+?|verb|adj|adv)')[0] ||
      null,
    table:
      (text.match(
        /\{\{ru-(?:noun-table|decl-noun[^|]*|decl-adj|conj)\b(?:[^{}]|\{\{[^{}]*\}\})*\}\}/
      ) || [])[0] || null,
    source:
      text.match(
        /\{\{ru-(?:noun\+?|proper noun\+?|verb|adj|adv)\b[^{}]*\}\}/
      )?.[0] || '',
    // "самостоятельно" as an adjective is a short form of самостоятельный
    lemma:
      unstress(
        plain(
          templates(text, 'infl of|inflection of|[a-z ]+ of')
            .filter((t) => t.positional[0] === 'ru')
            .map((t) => t.positional[1])[0] || ''
        )
      ) || null,
  }));
}

/**
 * Render the Russian headword + table of a word and read tagged forms.
 * @returns {Promise<{forms: Map<string, string>, gender?: string, animate?: boolean}>}
 */
export async function renderRussian(title, entry, options = {}) {
  const text = [entry.source, entry.table].filter(Boolean).join('\n\n');
  const head = entry.headword;
  // The modern ru-noun+ uses '$' for an indeclinable declension;
  // the older ru-noun uses '-' in the genitive slot.
  const indeclinable =
    /несклоняем|\bindecl(?:inable)?\b/i.test(text) ||
    (head?.positional || []).some((p) => p === '$' || p.endsWith('$')) ||
    (/^ru-(?:noun|proper noun)$/.test(head?.name || '') &&
      head.positional[2] === '-');
  if (!text) {
    return { forms: new Map() };
  }
  const body = await getJson(API, {
    ...options,
    bucket: 'wiktionary-render',
    form: {
      action: 'parse',
      format: 'json',
      formatversion: '2',
      prop: 'text',
      title,
      text,
      disablelimitreport: '1',
    },
  });
  const html = body.parse?.text || '';
  const forms = new Map();
  for (const m of html.matchAll(
    /class="Cyrl form-of lang-ru ([^"]*?)-form-of[^"]*"[^>]*>(?:<a[^>]*>)?([^<]+)/g
  )) {
    const tags = m[1].replace(/&#124;/g, '|');
    if (!forms.has(tags)) {
      forms.set(tags, unstress(m[2]));
    }
  }
  const titles = [...html.matchAll(/<abbr[^>]*title="([^"]+)"/g)].map(
    (m) => m[1]
  );
  return {
    forms,
    indeclinable:
      indeclinable || /indeclinable|несклоняем/i.test(html) || undefined,
    gender: titles.includes('masculine gender')
      ? 'm'
      : titles.includes('feminine gender')
        ? 'f'
        : titles.includes('neuter gender')
          ? 'n'
          : undefined,
    animate: titles.includes('animate')
      ? true
      : titles.includes('inanimate')
        ? false
        : undefined,
    pluralOnly:
      titles.includes('plural number') &&
      !titles.includes('masculine gender') &&
      !titles.includes('feminine gender') &&
      !titles.includes('neuter gender'),
  };
}
