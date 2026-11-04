/** Public corpus evidence for a verb and its grammatical object. */
import { attachmentFrequencies } from './attachment-frequency.mjs';
import { parseSentence } from '../english/clause.mjs';
import { getJson, pool } from './fetch.mjs';
import { translationHead } from './translation-morphology.mjs';

export async function contextFrequencies(text, lexicon, options = {}) {
  await attachmentFrequencies(text, lexicon, options);
  const pairs = new Map();
  function visit(clause) {
    const verb = clause?.verb;
    const object = clause?.passive ? clause.subject : clause?.objects?.[0];
    if (verb?.candidates?.length > 1 && object?.head && !object.name) {
      const nouns = object.head.candidates
        .map((id) => lexicon.get(id))
        .filter(
          (c) =>
            c?.ru?.pos === 'noun' && /^[а-яё-]+$/i.test(translationHead(c.ru))
        );
      for (const id of verb.candidates) {
        const c = lexicon.get(id);
        if (!c?.ru || !/^[а-яё-]+$/i.test(c.ru.lemma)) {
          continue;
        }
        for (const noun of nouns.slice(0, 6)) {
          const head = translationHead(noun.ru);
          const query = `"${c.ru.lemma}" "${head}"`;
          const targets = pairs.get(query) || [];
          targets.push({ c, noun: head });
          pairs.set(query, targets);
        }
      }
    }
    if (
      clause?.frame === 'copula' &&
      clause.subject?.head?.candidates?.length > 1 &&
      clause.complement?.type === 'adj'
    ) {
      const adjectives = (clause.complement.candidates || [])
        .map((id) => lexicon.get(id)?.ru?.lemma)
        .filter(Boolean);
      for (const id of clause.subject.head.candidates) {
        const c = lexicon.get(id);
        const head = translationHead(c?.ru);
        if (!head || !/^[а-яё-]+$/i.test(head)) {
          continue;
        }
        for (const adjective of adjectives) {
          if (!/^[а-яё-]+$/i.test(adjective)) {
            continue;
          }
          const query = `"${head}" "${adjective}"`;
          const targets = pairs.get(query) || [];
          targets.push({ c, noun: adjective, property: true });
          pairs.set(query, targets);
        }
      }
    }
    if (
      clause?.frame === 'copula' &&
      clause.subject?.head?.candidates?.length > 1 &&
      clause.complement?.type === 'adj'
    ) {
      const adjectives = (clause.complement.candidates || [])
        .map((id) => lexicon.get(id)?.ru?.lemma)
        .filter(Boolean);
      for (const id of clause.subject.head.candidates) {
        const c = lexicon.get(id);
        const head = translationHead(c?.ru);
        if (!head || !/^[а-яё-]+$/i.test(head)) {
          continue;
        }
        for (const adjective of adjectives) {
          if (!/^[а-яё-]+$/i.test(adjective)) {
            continue;
          }
          const query = `"${head}" "${adjective}"`;
          const targets = pairs.get(query) || [];
          targets.push({ c, noun: adjective, property: true });
          pairs.set(query, targets);
        }
      }
    }
    if (clause?.xcomp) {
      visit(clause.xcomp);
    }
  }
  for (const sentence of text.split(/[;\n]+|(?<=[.!?])\s+/)) {
    const parsed = parseSentence(sentence, lexicon);
    if (!parsed.leftover.length && !parsed.unknown.length) {
      parsed.clauses.forEach(visit);
    }
  }
  await pool([...pairs], 3, async ([query, targets]) => {
    const body = await getJson(
      `https://ru.wikipedia.org/w/api.php?${new URLSearchParams({
        action: 'query',
        list: 'search',
        format: 'json',
        srlimit: '1',
        srinfo: 'totalhits',
        srprop: '',
        srsearch: query,
      })}`,
      { ...options, bucket: 'ruwiki-context' }
    ).catch(() => null);
    const count = body?.query?.searchinfo?.totalhits;
    if (!Number.isFinite(count)) {
      return;
    }
    for (const { c, noun, property } of targets) {
      const key = property ? 'propertyFrequency' : 'objectFrequency';
      c[key] ||= {};
      c[key][noun] = count;
    }
  });
}
