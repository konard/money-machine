/**
 * Russian modal verbs: "can"/"may" → мочь, "must"/"should" → должен. The
 * generator writes these forms and the read-back reads them
 * (read-back.mjs), so both use this one table.
 */
import { conjugatePredicate as conjugate } from '../sources/definition-verbs.mjs';
import { BYT_PAST } from './words.mjs';

const MOCH = {
  lemma: 'мочь',
  present: ['могу', 'можешь', 'может', 'можем', 'можете', 'могут'],
  past: ['мог', 'могла'],
};

/** Each form reads as the range of English modals it renders. */
export const MODAL_FORMS = [
  [
    'могу можешь может можем можете могут мог могла могло могли',
    ['modal.can', 'modal.may'],
  ],
  ['должен должна должно должны', ['modal.must', 'modal.should']],
];

/** The modal verb of a statement, agreeing with its subject features. */
export function modalWord(s, f) {
  const tense =
    s.tense === 'past' ? 'past' : s.tense === 'future' ? 'future' : 'present';
  const gender = f.number === 'pl' ? undefined : f.gender;
  switch (s.modality) {
    case 'modal.can':
    case 'modal.may': {
      return conjugate(MOCH, {
        tense: tense === 'future' ? 'present' : tense,
        person: f.person,
        number: f.number,
        gender,
      });
    }
    case 'modal.must':
    case 'modal.should': {
      const short =
        f.number === 'pl'
          ? 'должны'
          : { m: 'должен', f: 'должна', n: 'должно' }[f.gender || 'm'];
      if (tense === 'past') {
        return `${short} ${f.number === 'pl' ? 'были' : BYT_PAST[f.gender || 'm']}`;
      }
      return short;
    }
    default:
      return '';
  }
}
