/** Attested Russian names for actions; endings select candidates, never invent them. */
import { readings, tokenize } from '../english/analyze.mjs';
import { regularEntry } from '../russian-entry.mjs';
import {
  fetchPages,
  languageSection,
  russianTemplates,
  unstress,
} from './wiktionary.mjs';
import { governmentPages, verbGovernment } from './government.mjs';

const links = (text) =>
  [
    ...unstress(text).matchAll(
      /\[\[([а-яё-]+)(?:\|[^\]]+)?\]\]|\{\{[lm]\|ru\|([а-яё-]+)/gi
    ),
  ].map((m) => unstress(m[1] || m[2]));

/** Both Wiktionaries identify the source verb explicitly in a noun definition. */
export function actionNounOf(page = '', lemma) {
  const section = unstress(
    languageSection(page, 'Russian') ||
      page.split(/=\s*\{\{-ru-\}\}\s*=/)[1] ||
      ''
  );
  return section
    .split('\n')
    .some(
      (line) =>
        /^#/.test(line) &&
        /verbal noun|action noun|отглагольн|отгл[ .-]*(?:сущ|существ)|действи[ея].{0,30}(?:глагол|по значению)|\{\{действие\|/i.test(
          line
        ) &&
        (links(line).includes(lemma) ||
          line.includes(`|${lemma}|`) ||
          line.includes(`|${lemma}}}`))
    );
}

/** Only request action vocabulary when the text actually has an -ing verb. */
export async function learnActionNouns(text, lexicon, options) {
  const tokens = tokenize(text);
  const verbs = tokens
    .flatMap((t) => readings(t, lexicon))
    .filter((r) => r.pos === 'verb');
  const actions = verbs.filter((r) => r.features?.form === 'ing');
  if (!actions.length) {
    return;
  }
  const entries = [...new Set(verbs.flatMap((r) => r.concepts || []))]
    .map((id) => lexicon.get(id))
    .filter((c) => c?.ru?.pos === 'verb');
  // «выставлять счёт»: the head verb names the action, its object follows
  const heads = entries
    .map((c) => c.ru.lexicalHead)
    .filter((h) => h?.pos === 'verb' && !h.lemma.includes(' '));
  const lemmas = [
    ...entries.flatMap((c) => [c.ru.lemma, c.ru.partner]),
    ...heads.flatMap((h) => [h.lemma, h.partner]),
  ].filter((w) => w && !w.includes(' '));
  const pages = await fetchPages(lemmas, options).catch(() => new Map());
  const russian = await governmentPages(lemmas, options);
  for (const c of entries) {
    Object.assign(
      c.ru,
      verbGovernment(pages.get(c.ru.lemma), russian.get(c.ru.lemma), {
        lemma: c.en?.[0]?.lemma,
        gloss: c.gloss,
        definition: c.definition,
        frames: c.frames,
      })
    );
  }
  const acting = [...new Set(actions.flatMap((r) => r.concepts || []))]
    .map((id) => lexicon.get(id)?.ru)
    .filter((ru) => ru?.pos === 'verb' && !ru.actionNoun);
  const targets = acting.map((ru) =>
    ru.lemma.includes(' ') && ru.lexicalHead ? ru.lexicalHead : ru
  );
  const candidates = new Map(
    targets.map((ru) => {
      // the aspect partner's page lists the shared action noun too
      const own = [ru.lemma, ru.partner].filter(Boolean);
      const en = own
        .map((w) => languageSection(pages.get(w) || '', 'Russian'))
        .join('\n');
      const vn = russianTemplates(pages.get(ru.lemma) || '').find(
        (e) => e.pos === 'verb'
      )?.headword?.named?.vn;
      if (vn) {
        const word = unstress(vn).split(/[,/]/)[0].trim();
        ru.actionNoun = regularEntry('noun', { word });
        if (ru.actionNoun) {
          return [ru, []];
        }
      }
      const local = own
        .map(
          (w) => (russian.get(w) || '').split(/=\s*\{\{-ru-\}\}\s*=/)[1] || ''
        )
        .join('\n');
      // any heading ends the section, also the bare `=` of a compacted page
      const derived = [
        ...`${en}\n${local}`.matchAll(
          /^={3,5}\s*(?:Derived terms|Related terms|Производные слова|Родственные слова)\s*={3,5}\s*\n([\s\S]*?)(?=^=|$(?![\s\S]))/gm
        ),
      ]
        .map((m) => m[1])
        .join('\n');
      const templateWords = [
        ...unstress(derived).matchAll(/(?:[|=])([а-яё-]+)(?=[|}])/g),
      ].map((m) => m[1]);
      // regular guesses, kept only when a page attests them: -ать/-ять →
      // -ние, -ить → -ение (-ление after a labial: выставить → выставление)
      const regular = own.map((w) =>
        /[ая]ть$/.test(w)
          ? w.replace(/ть$/, 'ние')
          : /ить$/.test(w)
            ? w.replace(/([бпвфм])?ить$/, (_, l) => (l ? `${l}ление` : 'ение'))
            : null
      );
      return [
        ru,
        [
          ...new Set(
            [...links(derived), ...templateWords, ...regular].filter(Boolean)
          ),
        ].filter((w) => !own.includes(w)),
      ];
    })
  );
  const titles = [...new Set([...candidates.values()].flat())];
  const nounPages = await fetchPages(titles, options).catch(() => new Map());
  const localNouns = await governmentPages(titles, options);
  for (const [ru, words] of candidates) {
    // «выставление»: {{действие|выставить}} names the aspect partner
    const verbs = [ru.lemma, ru.partner].filter(Boolean);
    // a process noun in -ние («выставление») before a concrete result
    // («выставка») that also names the action
    const ordered = [
      ...words.filter((w) => /ние$/.test(w)),
      ...words.filter((w) => !/ние$/.test(w)),
    ];
    const word = ordered.find((w) =>
      verbs.some(
        (v) =>
          actionNounOf(nounPages.get(w), v) ||
          actionNounOf(localNouns.get(w), v)
      )
    );
    if (word) {
      ru.actionNoun = regularEntry('noun', { word });
    }
  }
  for (const ru of acting) {
    const noun = ru.lexicalHead?.actionNoun;
    if (ru !== ru.lexicalHead && noun && ru.definitionTail) {
      ru.actionNoun = { ...noun, tail: ru.definitionTail };
    }
  }
}
