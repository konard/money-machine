/** Russian argument frames from public dictionary annotations and examples. */
import { chunks, getJson, pool } from './fetch.mjs';
import { languageSection, russianTemplates, unstress } from './wiktionary.mjs';
import { definitionBlocks } from './verb-frames.mjs';

const CASES = {
  accusative: 'acc',
  dative: 'dat',
  genitive: 'gen',
  instrumental: 'ins',
  prepositional: 'prep',
  вин: 'acc',
  дат: 'dat',
  род: 'gen',
  твор: 'ins',
  тв: 'ins',
  предл: 'prep',
};
const QUESTIONS = {
  кого: 'acc',
  что: 'acc',
  кому: 'dat',
  чему: 'dat',
  чего: 'gen',
  кем: 'ins',
  чем: 'ins',
};
const plain = (s) =>
  unstress(s)
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1')
    .replace(/'''?/g, '');
const FUNCTION_WORDS = new Set(
  'the that this with from into for and something someone somebody whom which where when their them its have'.split(
    ' '
  )
);
const words = (s) =>
  new Set(
    (
      plain(s)
        .toLowerCase()
        .match(/[a-z]{3,}/g) || []
    ).filter((w) => !FUNCTION_WORDS.has(w))
  );
const gov = (kase, preposition = null) => ({ preposition, case: kase });

/** Raw responses use the shared cache and generic User-Agent. */
export async function governmentPages(titles, options = {}) {
  const out = new Map();
  await pool(
    chunks(
      [...new Set(titles)].filter((w) => /^[а-яё-]+$/i.test(w)),
      50
    ),
    2,
    async (batch) => {
      const body = await getJson(
        `https://ru.wiktionary.org/w/api.php?${new URLSearchParams({
          action: 'query',
          format: 'json',
          formatversion: '2',
          prop: 'revisions',
          rvprop: 'content',
          rvslots: 'main',
          redirects: '1',
          titles: batch.join('|'),
        })}`,
        { ...options, bucket: 'wiktionary-ru' }
      ).catch(() => ({}));
      const aliases = [
        ...(body.query?.normalized || []),
        ...(body.query?.redirects || []),
      ];
      for (const page of body.query?.pages || []) {
        const text = page.revisions?.[0]?.slots?.main?.content;
        if (text) {
          out.set(page.title, text);
          for (const a of aliases) {
            if (a.to === page.title) {
              out.set(a.from, text);
            }
          }
        }
      }
    }
  );
  return out;
}

/** Parse +obj atoms, including bare alternatives and prepositional objects. */
function atoms(text) {
  const out = [];
  for (const m of text.matchAll(/\{\{\+obj\|ru\|([^{}]+)\}\}/g)) {
    for (const a of m[1].matchAll(
      /(?::([^\s:|+<>()[\]]+)\((acc|dat|gen|ins|pre|prep|loc)\)|(acc|dat|gen|ins|pre|prep|loc))(?=<|\s|\||$)(?:<([^>]+)>)?/g
    )) {
      out.push({
        ...gov(
          /^(pre|loc)$/.test(a[2] || a[3]) ? 'prep' : a[2] || a[3],
          a[1] || null
        ),
        role: a[4] || '',
      });
    }
  }
  if (!out.length) {
    // Restrict prose parsing to explicit qualifiers: definitions contain many
    // ordinary mentions of cases which do not describe the verb's arguments.
    for (const m of text.matchAll(
      /\{\{(?:lb|label|lbl|q|qualifier)\|([^{}]+)\}\}/g
    )) {
      const note = plain(m[1]);
      const a =
        /(?:with|takes|\+)\s*(?:the\s+)?(accusative|dative|genitive|instrumental|prepositional)\b/i.exec(
          note
        );
      if (a) {
        out.push(gov(CASES[a[1].toLowerCase()]));
      }
    }
  }
  return out;
}

function englishFrame(text, sense) {
  const section = languageSection(text || '', 'Russian');
  const blocks = [
    ...section.matchAll(
      /^={3,5}Verb={3,5}\s*\n([\s\S]*?)(?=^={2,3}[^=]|$(?![\s\S]))/gm
    ),
  ].flatMap((m) => definitionBlocks(m[1]));
  const target = words(
    `${sense.lemma} ${sense.gloss} ${sense.definition || ''}`
  );
  const score = (b) => {
    const first = b.split('\n')[0];
    const w = words(first);
    return (
      [...target].filter((x) => w.has(x)).length +
      (new RegExp(`\\[\\[${sense.lemma}(?: [a-z]+)*(?:\\]|\\|)`, 'i').test(
        first
      )
        ? 10
        : 0)
    );
  };
  const best = blocks.sort((a, b) => score(b) - score(a))[0];
  const chosen = best && (blocks.length === 1 || score(best) > 0) ? best : '';
  const args = atoms(chosen);
  const result = {};
  if (args.length) {
    // An infinitive controller outranks a topic or an instrument.
    const personal = args.find(
      (a) => /someone|somebody|person|whom/.test(a.role) && !a.preposition
    );
    const theme = args.find(
      (a) => !a.preposition && /^(?:something|what)\b/.test(a.role)
    );
    const main = /inf</.test(chosen) && personal ? personal : theme || args[0];
    result.government = gov(main.case, main.preposition);
    const recipient = args.find((a) => a.case === 'dat' && !a.preposition);
    if (recipient) {
      result.recipient = 'dat';
    } else if (theme && personal) {
      result.recipient = personal.case;
    }
    if (args.some((a) => a.case === 'acc') && personal?.case === 'dat') {
      result.classGovernment = { person: gov('dat') };
    }
    const markerGovernment = {};
    for (const a of args) {
      const marker = /^(?:with|for|to|on|at|from|about)\b/.exec(a.role)?.[0];
      if (marker) {
        markerGovernment[marker] = gov(a.case, a.preposition);
      }
    }
    if (Object.keys(markerGovernment).length) {
      result.markerGovernment = markerGovernment;
    }
  }
  // A dative object alone does not imply inversion (help/please). Require
  // the dictionary's explicit cross-language subject mapping and its label.
  if (/dative object as (?:the )?subject/.test(chosen)) {
    const note = chosen.split(/idiomatically translated/)[1] || '';
    const translations = [
      ...note.matchAll(/\{\{(?:m\+?|l)\|en\|([^|}]+)/g),
    ].map((m) => m[1]);
    if (translations.includes(sense.lemma)) {
      result.experiencer = true;
    }
  }
  return result;
}

/** Explicit Russian case questions; never harvest them from free definitions. */
function russianNotes(text) {
  const section = (text || '').split(/=\s*\{\{-ru-\}\}\s*=/)[1] || '';
  const management =
    /={3,5}\s*Управление\s*={3,5}\s*\n([\s\S]*?)(?=^=|$(?![\s\S]))/m.exec(
      section
    )?.[1] || '';
  const notes = [
    management,
    ...[
      ...section
        .split(/^==\s*\{\{з\|II/m)[0]
        .matchAll(/\{\{помета\|([^{}]+)\}\}/g),
    ]
      .map((m) => m[1])
      .filter((s) =>
        /^(?:кого|кому|чего|чему|кем|чем|что|на |с |к |о |за )/.test(s)
      ),
  ];
  const args = [];
  for (const note of notes) {
    const clean = plain(note)
      .replace(/кого-чего/g, 'чего')
      .replace(
        /(на|за|с|к|о|об|от|для|в|из)\s+(кого|кому|кем)-(что|чего|чему|чем)/g,
        '$1 $2, $1 $3'
      );
    for (const m of clean.matchAll(
      /(?:(?:^|[\s|,;(])((?:на|за|с|к|о|об|от|для|в|из))\s+)?(?<![а-яё])(кого|кому|чего|чему|кем|чем|что)(?![а-яё])/g
    )) {
      args.push(gov(QUESTIONS[m[2]], m[1] || null));
    }
    for (const m of clean.matchAll(
      /(?:^|[\s|,;])(?:(на|за|с|к|о|об|от|для|в|из)\s*\+?\s*)?(вин|дат|род|твор|тв|предл)\.\s*п\./g
    )) {
      args.push(gov(CASES[m[2]], m[1] || null));
    }
  }
  const theme = args.find((a) => a.case === 'acc' && !a.preposition);
  const result = args.length ? { government: theme || args[0] } : {};
  if (args.some((a) => a.case === 'dat' && !a.preposition)) {
    result.recipient = 'dat';
  }
  return result;
}

/** Pronouns immediately next to the highlighted headword identify a receiver. */
function exampleRecipient(text) {
  const examples = [...(text || '').matchAll(/\{\{пример\|([^\n]+)/g)];
  return examples.some((m) =>
    /(?:\{\{выдел\|[^}]+\}\}\s+(?:ему|ей|им|мне|нам|вам|тебе)(?![а-яё])|(?<![а-яё])(?:ему|ей|им|мне|нам|вам|тебе)\s+\{\{выдел\|)/i.test(
      plain(m[1])
    )
  );
}

/** Choose evidence for this English meaning of a Russian lemma. */
export function verbGovernment(english, russian, sense) {
  const result = { ...russianNotes(russian), ...englishFrame(english, sense) };
  if (exampleRecipient(russian)) {
    result.recipient ||= 'dat';
    result.classGovernment ||= { person: gov('dat') };
    // English definitions ending their transfer target in "to" identify
    // the single English object as receiver, rather than transferred theme.
    if (/\bto(?:\s+in exchange\b|[;,.]|$)/i.test(sense.definition || '')) {
      result.government = gov('dat');
    }
  }
  return result;
}

/** Prefer attested frames when the English sense actually has an object. */
export function governmentFit(entry, sense) {
  if (!entry) {
    return -Infinity;
  }
  const informative =
    sense.frames?.some((f) => ['transitive', 'object-to'].includes(f)) ||
    /\b(?:someone|somebody|something|to|with)\b/.test(sense.definition || '');
  if (!informative) {
    return 0;
  }
  if (entry.experiencer) {
    return 3;
  }
  // An attested ordinary accusative adds no information over the fallback;
  // it should not displace an otherwise preferred translation synonym.
  if (
    entry.government?.preposition ||
    (entry.government && entry.government.case !== 'acc')
  ) {
    return 2;
  }
  return entry.recipient ? 1 : 0;
}

/** Apply meaning-specific evidence while completing aspect partners. */
export function governmentResolver({ russian, ruPages, government, lexicon }) {
  // Aspect partners share the selected meaning's argument frame.
  const finish = (ru, sense) => {
    // Explicit aspect alternatives in this translation table belong to this
    // meaning; a lemma's generic partner can belong to another sense.
    const explicit =
      ru.aspect === 'perf'
        ? sense.russian?.find((c) => c.aspect === 'impf' && c.word !== ru.lemma)
        : null;
    const partner = explicit
      ? russian(explicit.word, 'verb')
      : ru.partner
        ? russian(ru.partner, 'verb')
        : null;
    const frame = {
      ...(partner
        ? verbGovernment(
            ruPages.get(partner.lemma),
            government.get(partner.lemma),
            sense
          )
        : {}),
      ...verbGovernment(ruPages.get(ru.lemma), government.get(ru.lemma), sense),
    };
    if (ru.aspect === 'perf' && partner) {
      Object.assign(ru, {
        ...partner,
        perfective: { ...ru, perfective: undefined },
      });
    } else if (partner) {
      ru.perfective = { ...partner, aspect: 'perf' };
    }
    Object.assign(ru, frame);
    ru.government ||= { preposition: null, case: 'acc' };
    ru.markerGovernment ||= {};
    ru.classGovernment ||= {};
    ru.recipient ||= 'dat';
    if (ru.perfective) {
      Object.assign(ru.perfective, frame);
    }

    // Supplement a known reading's accusative fallback when its very same
    // Russian lexeme has an attested argument frame for this English sense.
    const evidence = verbGovernment(
      ruPages.get(ru.lemma),
      government.get(ru.lemma),
      sense
    );
    for (const knownId of lexicon.lookup('verb', sense.lemma)) {
      const known = lexicon.get(knownId)?.ru;
      if (
        known?.lemma === ru.lemma &&
        evidence.government &&
        known.government?.case === 'acc' &&
        !known.government.preposition
      ) {
        known.government = evidence.government;
      }
    }
    return ru;
  };

  const choose = (candidates, pos, sense) => {
    const candidate = (c, renderedOnly) => {
      const entry = russian(c.word, pos, c, renderedOnly);
      if (!entry) {
        return null;
      }
      if (entry.pos === 'verb') {
        Object.assign(
          entry,
          verbGovernment(ruPages.get(c.word), government.get(c.word), sense)
        );
      }
      const mismatch =
        entry.pos === 'verb' &&
        ['pf', 'perf'].includes(c.aspect) &&
        entry.aspect !== 'perf' &&
        !entry.partner &&
        !russianTemplates(ruPages.get(c.word) || '').some(
          (e) => e.headword?.positional?.[1] === 'both'
        );
      return {
        entry,
        score: governmentFit(entry, sense) - (mismatch ? 0.5 : 0),
      };
    };
    const best = (renderedOnly) =>
      candidates
        .map((c) => candidate(c, renderedOnly))
        .filter(Boolean)
        .sort((a, b) => b.score - a.score)[0]?.entry;
    // Every surviving candidate is attested. A missing rendered table is
    // not evidence that a later synonym translates this sense better.
    return best(false);
  };
  return { choose, finish };
}
