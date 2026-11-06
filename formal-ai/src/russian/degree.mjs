/** Degree operators are grammar; irregular comparatives come from Wiktionary. */
import { declineAdjective } from './morphology.mjs';

export const quantityWord = (degree) =>
  ({
    greater: 'больше',
    lesser: 'меньше',
    greatest: 'больше всего',
    least: 'меньше всего',
  })[degree] || '';

export function degreeForm(entry, degree, agree) {
  const lemma = entry.lemma;
  const adjective = entry.pos === 'adj';
  if (degree === 'greater' && entry.comparative && !agree.attributive) {
    return entry.comparative;
  }
  const prefix = {
    greater: 'более',
    lesser: 'менее',
    greatest: adjective ? declineAdjective('самый', agree) : 'наиболее',
    least: 'наименее',
    // "as tall as" → «такой же высокий», "as fast as" → «так же быстро»
    equal: adjective ? `${declineAdjective('такой', agree)} же` : 'так же',
  }[degree];
  const base = adjective ? declineAdjective(lemma, agree) : lemma;
  return [prefix, base].filter(Boolean).join(' ');
}
