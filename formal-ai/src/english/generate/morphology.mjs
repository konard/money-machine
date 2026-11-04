/** English surface forms: dictionary data first, productive morphology second. */
export const surface = (entry) =>
  (entry?.lemma || entry?.words?.join(' ') || '').replaceAll('+', ' ');

export function inflect(entry, form) {
  const word = surface(entry);
  if (!word || form === 'base') {
    return word;
  }
  if (entry?.[form]) {
    return entry[form].replaceAll('+', ' ');
  }
  // Phrasal verbs inflect their first component; noun compounds their last.
  const parts = word.split(' ');
  const i = entry?.pos === 'verb' ? 0 : parts.length - 1;
  const stem = parts[i];
  if (form === 'plural' || form === 'third') {
    parts[i] = /[^aeiou]y$/i.test(stem)
      ? `${stem.slice(0, -1)}ies`
      : /(?:s|sh|ch|x|z|o)$/i.test(stem)
        ? `${stem}es`
        : `${stem}s`;
  } else if (form === 'past' || form === 'participle') {
    parts[i] = /e$/i.test(stem)
      ? `${stem}d`
      : /[^aeiou]y$/i.test(stem)
        ? `${stem.slice(0, -1)}ied`
        : `${double(stem)}ed`;
  } else if (form === 'ing') {
    parts[i] = /ie$/i.test(stem)
      ? `${stem.slice(0, -2)}ying`
      : /[^e]e$/i.test(stem)
        ? `${stem.slice(0, -1)}ing`
        : `${double(stem)}ing`;
  } else if (form === 'comparative' || form === 'superlative') {
    const suffix = form === 'comparative' ? 'er' : 'est';
    parts[i] = /[^aeiou]y$/i.test(stem)
      ? `${stem.slice(0, -1)}i${suffix}`
      : /e$/i.test(stem)
        ? `${stem}${suffix.slice(1)}`
        : `${double(stem)}${suffix}`;
  }
  return parts.join(' ');
}

// Monosyllabic CVC stems double the final consonant. Multisyllabic stress
// cannot be recovered from spelling alone and needs a dictionary form.
function double(word) {
  return /^[^aeiou]*[aeiou][^aeiouwxy]$/i.test(word)
    ? word + word.at(-1)
    : word;
}

export function agreement(subject) {
  return {
    person: subject?.pronoun?.person || 3,
    plural:
      subject?.number === 'plural' ||
      Boolean(subject?.coordination) ||
      subject?.pronoun?.person === 2,
  };
}

export function finiteAux(lemma, tense, subject) {
  const { person, plural } = agreement(subject);
  if (lemma === 'be') {
    if (tense === 'past') {
      return plural ? 'were' : 'was';
    }
    return plural ? 'are' : person === 1 ? 'am' : 'is';
  }
  if (lemma === 'have') {
    return tense === 'past' ? 'had' : person === 3 && !plural ? 'has' : 'have';
  }
  return tense === 'past' ? 'did' : person === 3 && !plural ? 'does' : 'do';
}
