/** Russian argument frames from public dictionary annotations and examples. */
import { chunks, getJson, pool } from './fetch.mjs';
import { languageSection, russianTemplates, unstress } from './wiktionary.mjs';
import { definitionBlocks, exampleInstrumental } from './verb-frames.mjs';
import { reuseMorphology } from './translation-morphology.mjs';

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
  ком: 'prep',
  чём: 'prep',
};
// English argument markers and the Russian prepositions they correspond to
// (a closed grammatical correspondence): "rely on" ~ «на что-либо»
const MARKERS = {
  on: ['на'],
  upon: ['на'],
  in: ['в'],
  into: ['в'],
  about: ['о', 'об'],
  with: ['с'],
  from: ['от', 'из'],
  for: ['за', 'для'],
  to: ['к'],
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
export async function governmentPages(titles, options = {}, english = false) {
  const out = new Map();
  await pool(
    chunks(
      [...new Set(titles)].filter((w) =>
        (english
          ? /^[a-z]+(?: [a-z]+)*$/i
          : options.russianPhrases
            ? /^[а-яё-]+(?: [а-яё-]+)*$/i
            : /^[а-яё-]+$/i
        ).test(w)
      ),
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
      /(?::([^\s:|+<>()[\]]+)\((acc|dat|gen|ins|pre|prep|loc)\)|(acc|dat|gen|ins|pre|prep|loc|accusative|dative|genitive|instrumental|prepositional))(?=<|\s|\||:|$)(?:<([^>]+)>|:([^|]+))?/g
    )) {
      const kase = CASES[a[3]] || a[2] || a[3];
      out.push({
        ...gov(/^(pre|loc)$/.test(kase) ? 'prep' : kase, a[1] || null),
        role: a[4] || a[5] || '',
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
  const result = /\{\{\+obj\|ru\|[^{}]*(?:^|[| +])inf(?:[<| }])/.test(chosen)
    ? { infinitiveComplement: true }
    : {};
  if (args.length) {
    // An infinitive controller outranks a topic or an instrument.
    const personal = args.find(
      (a) => /someone|somebody|person|whom/.test(a.role) && !a.preposition
    );
    const theme =
      args.find(
        (a) => !a.preposition && /^(?:something|what)\b/.test(a.role)
      ) ||
      (args.some((a) => !a.preposition && a.case === 'dat') &&
        /\{\{\+obj\|ru\|[^{}]*\+[^{}]*\}\}/.test(chosen) &&
        args.find((a) => !a.preposition && a.case === 'acc'));
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
    // A linked English prepositional verb names the argument marker itself:
    // [[wait for]] is a predicate, not a freely translated adjunct.
    for (const m of chosen
      .split('\n')[0]
      .matchAll(/\[\[([a-z]+) (for|with|to|on|at|from|about)(?:\||\]\])/g)) {
      if (sense.lemma === m[1] || sense.lemma === `${m[1]} ${m[2]}`) {
        result.markerGovernment ||= {};
        result.markerGovernment[m[2]] = result.government;
      }
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
function russianNotes(text, sense) {
  const section = (text || '').split(/=\s*\{\{-ru-\}\}\s*=/)[1] || '';
  const management =
    /={3,5}\s*Управление\s*={3,5}\s*\n([\s\S]*?)(?=^=|$(?![\s\S]))/m.exec(
      section
    )?.[1] || '';
  // An unqualified primary meaning cannot inherit a later meaning's case.
  // Global management sections and explicitly qualified argument sets apply.
  const primary =
    section.split(/^==\s*\{\{з\|II/m)[0].match(/^#[^#*:].*$/m)?.[0] || '';
  const qualified = /\{\{помета\|/.test(primary)
    ? section.split(/^==\s*\{\{з\|II/m)[0]
    : primary;
  const notes = [
    management,
    ...[
      ...qualified
        .split('\n')
        .filter(
          (line) =>
            !/\{\{(?:устар|редк|прост|обсц)[.|}]/.test(line) &&
            (!/инф\./u.test(line) ||
              /\{\{помета\|/.test(line) ||
              sense.frames?.includes('object-to'))
        )
        .join('\n')
        .matchAll(/\{\{помета\|([^{}]+)\}\}/g),
    ]
      .map((m) => m[1])
      .filter((s) =>
        /^(?:кого|кому|чего|чему|кем|чем|что|инф\.|с инфинитивом|на |с |к |о |за )/.test(
          s
        )
      ),
  ];
  const args = [];
  // Align a bilingual translation block to its Russian definition before
  // borrowing a destination frame from that sense's examples. With в/на,
  // a feminine -у/-ю object is accusative, never prepositional.
  if (/\b(?:become|enter)\b/.test(sense.gloss || '')) {
    const target = words(`${sense.lemma} ${sense.gloss}`);
    const translations = [
      ...section.matchAll(/\{\{перев-блок\|([^|}]+)\|([\s\S]*?)\}\}/g),
    ]
      .map((m) => ({
        gloss: plain(m[1]),
        english: /(?:^|\n)\|en=([^\n]+)/.exec(m[2])?.[1] || '',
      }))
      .map((b) => ({
        ...b,
        score: [...words(b.english)].filter((w) => target.has(w)).length,
      }))
      .sort((a, b) => b.score - a.score);
    const best = translations[0];
    if (best?.score >= 2) {
      const definition = section
        .split('\n')
        .find(
          (line) => /^#[^#*:]/.test(line) && plain(line).includes(best.gloss)
        );
      const examples = [
        ...(definition || '').matchAll(/\{\{пример\|([^|}]+)/g),
      ];
      for (const example of examples) {
        const frame = /(?:^|\s)(в|на)\s+[а-яё]+[ую](?=[\s,.!?;:]|$)/i.exec(
          plain(example[1])
        );
        if (frame) {
          args.push(gov('acc', frame[1]));
        }
      }
    }
  }
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
  if (notes.some((note) => /инф\.|инфинитив/.test(note))) {
    result.infinitiveComplement = true;
  }
  // «надеяться на что-либо» in a definition: the preposition the verb
  // governs, matched to the English marker it corresponds to
  const markerGovernment = {};
  for (const line of section.split(/^==\s*\{\{з\|II/m)[0].split('\n')) {
    if (!/^#[^#*:]/.test(line)) {
      continue;
    }
    const definition = plain(line.split('{{пример')[0]);
    for (const m of definition.matchAll(
      /(?<![а-яё])(на|за|с|к|о|об|от|в|из|для)\s+(кого|чего|кому|чему|кем|чем|ком|чём|что)-(?:либо|нибудь|то)(?![а-яё])/g
    )) {
      for (const [marker, preps] of Object.entries(MARKERS)) {
        if (preps.includes(m[1]) && !markerGovernment[marker]) {
          markerGovernment[marker] = gov(QUESTIONS[m[2]], m[1]);
        }
      }
    }
  }
  if (Object.keys(markerGovernment).length) {
    result.markerGovernment = markerGovernment;
  }
  if (args.some((a) => a.case === 'dat' && !a.preposition)) {
    result.recipient = 'dat';
  }
  return result;
}

/**
 * Pronouns immediately next to the highlighted headword identify a receiver
 * («им», «ей» are instrumental too: «владеет им» names no receiver).
 */
function exampleRecipient(text) {
  const examples = [...(text || '').matchAll(/\{\{пример\|([^\n]+)/g)];
  return examples.some((m) =>
    /(?:\{\{выдел\|[^}]+\}\}\s+(?:ему|мне|нам|вам|тебе)(?![а-яё])|(?<![а-яё])(?:ему|мне|нам|вам|тебе)\s+\{\{выдел\|)/i.test(
      plain(m[1])
    )
  );
}

/** Choose evidence for this English meaning of a Russian lemma. */
export function verbGovernment(english, russian, sense) {
  const notes = russianNotes(russian, sense);
  const frame = englishFrame(english, sense);
  const result = { ...notes, ...frame };
  if (!result.government && exampleInstrumental(russian)) {
    result.government = gov('ins');
  }
  if (notes.markerGovernment || frame.markerGovernment) {
    result.markerGovernment = {
      ...notes.markerGovernment,
      ...frame.markerGovernment,
    };
  }
  if (exampleRecipient(russian)) {
    result.recipient ||= 'dat';
    result.classGovernment ||= { person: gov('dat') };
    // English definitions ending their transfer target in "to" identify
    // the single English object as receiver, rather than transferred theme.
    if (/\bto(?:\s+in exchange\b|[;,.]|$)/i.test(sense.definition || '')) {
      result.government = gov('dat');
      // …a thing as the only object is still what is given: «платить налог»
      result.classGovernment = { ...result.classGovernment, thing: gov('acc') };
    }
  }
  return result;
}

/** The marker after the verb in an intransitive sense's own examples. */
function exampleMarker(sense) {
  if (
    !sense.frames?.includes('intransitive') ||
    sense.frames.includes('transitive')
  ) {
    return null;
  }
  const verb = new RegExp(
    `\\b${sense.lemma}(?:s|es|ed|d|ing)?\\s+(on|upon|for|with|at|from|about|of)\\b`,
    'i'
  );
  const found = (sense.examples || [])
    .map((e) => verb.exec(e)?.[1]?.toLowerCase())
    .filter(Boolean);
  return found.length && found.every((m) => m === found[0]) ? found[0] : null;
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
      (ru.aspect === 'perf' || ru.partner) &&
      sense.russian?.find(
        (c) =>
          c.aspect === (ru.aspect === 'perf' ? 'impf' : 'perf') &&
          c.word !== ru.lemma
      );
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
    // Comparing members of a group: English "by category" distributes
    // the comparison, while Russian uses по + dative for that grouping.
    if (
      sense.labels?.some((label) =>
        /\bmembers? of (?:a|the) group\b/.test(label)
      )
    ) {
      ru.markerGovernment.by = gov('dat', 'по');
    }
    // "it depends on the amount": the sense's own example shows which
    // English marker introduces the argument the Russian preposition takes.
    const marker = ru.government.preposition && exampleMarker(sense);
    if (marker && !ru.markerGovernment[marker]) {
      ru.markerGovernment[marker] = ru.government;
    }
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
      const entry = reuseMorphology(
        russian(c.word, pos, c, renderedOnly),
        lexicon
      );
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
