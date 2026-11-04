/** Enrich the generator's form index with structured closed-class readings. */
import { russianFormIndex } from '../read-back.mjs';
import { CASES, declineAdjective } from '../morphology.mjs';
import {
  DEMONSTRATIVE,
  POSSESSIVE,
  POSSESSIVE_3,
  PRONOUN_WORDS,
  QUESTION_ADVERBS,
  QUANTIFIERS,
  QUANTIFIER_CASES,
  cardinal,
} from '../words.mjs';
import { lower } from './tokenizer.mjs';
import { periodicAdverb } from '../periodic-adverb.mjs';

export const numberName = (n) => ({ sg: 'singular', pl: 'plural' })[n];
export const genderName = (g) =>
  ({ m: 'masculine', f: 'feminine', n: 'neuter' })[g];
export function analyzerIndex(lexicon) {
  const index = russianFormIndex(lexicon);
  const add = (form, reading) => {
    if (!form) {
      return;
    }
    const key = lower(form);
    index.set(key, [...(index.get(key) || []), reading]);
  };
  const paradigm = (forms, features) => {
    for (const [gender, cells] of Object.entries(forms)) {
      cells.forEach((form, i) =>
        add(form, {
          ...features,
          case: CASES[i],
          number: gender === 'pl' ? 'pl' : 'sg',
          gender: gender === 'pl' ? undefined : gender,
        })
      );
    }
  };
  for (const [id, concept] of lexicon.concepts) {
    if (concept.ru?.when) {
      add(concept.ru.when, { temporal: true, concept: id });
    }
    if (concept.ru?.pos === 'adv') {
      add(periodicAdverb(concept, lexicon)?.lemma, { pos: 'adv', concept: id });
    }
  }
  for (const [id, forms] of Object.entries(DEMONSTRATIVE)) {
    paradigm(forms, {
      determiner: id,
      definiteness: id === 'one' ? 'indefinite' : 'definite',
    });
  }
  for (const [person, numbers] of Object.entries(POSSESSIVE)) {
    if (person === 'refl') {
      paradigm(numbers, { owner: { reflexive: true } });
    } else {
      for (const [number, forms] of Object.entries(numbers)) {
        paradigm(forms, {
          owner: { person: Number(person), number: numberName(number) },
        });
      }
    }
  }
  for (const [gender, form] of Object.entries(POSSESSIVE_3)) {
    add(form, {
      owner: {
        person: 3,
        number: gender === 'pl' ? 'plural' : 'singular',
        ...(genderName(gender) ? { gender: genderName(gender) } : {}),
      },
    });
  }
  for (const [id, forms] of Object.entries(PRONOUN_WORDS)) {
    forms.forEach((form, i) => add(form, { pro: id, case: CASES[i] }));
  }
  for (const [id, forms] of Object.entries(QUESTION_ADVERBS)) {
    Object.values(forms).forEach((form) => add(form, { question: id }));
  }
  for (const [id, forms] of Object.entries(QUANTIFIERS)) {
    for (const [number, form] of Object.entries(forms)) {
      add(form, { determiner: id, number, case: 'nom' });
      add(form, { determiner: id, number, case: 'acc' });
    }
  }
  for (const [id, forms] of Object.entries(QUANTIFIER_CASES)) {
    if (Array.isArray(forms)) {
      forms.forEach((form, i) =>
        add(form, { determiner: id, case: CASES[i], number: 'pl' })
      );
    }
  }
  const adjectives = {
    'det.every': 'каждый',
    'det.other': 'другой',
    'det.no': 'никакой',
    'q.which': 'какой',
    'det.indefinite': 'какой-то',
  };
  for (const [id, lemma] of Object.entries(adjectives)) {
    for (const kase of CASES) {
      for (const gender of ['m', 'f', 'n', 'pl']) {
        const form = lemma.endsWith('-то')
          ? `${declineAdjective(lemma.slice(0, -3), { gender, number: gender === 'pl' ? 'pl' : 'sg', case: kase })}-то`
          : declineAdjective(lemma, {
              gender,
              number: gender === 'pl' ? 'pl' : 'sg',
              case: kase,
            });
        add(form, {
          determiner: id,
          case: kase,
          number: gender === 'pl' ? 'pl' : 'sg',
          ...(id === 'det.indefinite' ? { definiteness: 'indefinite' } : {}),
        });
      }
    }
  }
  // cardinal() falls back to digits outside its own finite grammar table.
  for (let n = 1; n <= 100; n += 1) {
    for (const kase of CASES) {
      for (const gender of ['m', 'f', 'n']) {
        add(cardinal(n, kase, gender), { quantity: n, case: kase });
      }
    }
  }
  return index;
}

export function readings(tokens, index) {
  return tokens.map((token) => ({
    ...token,
    readings: index.get(token.lower) || [],
  }));
}
