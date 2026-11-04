/** What a translation remembers of its document and of the field it belongs to. */

/** Words seen in earlier sentences, with decaying weights. */
export class DocumentMemory {
  constructor(decay = 0.6) {
    this.decay = decay;
    this.weights = new Map();
    this.referents = [];
  }
  /** Age the memory by one sentence and add this sentence's words. */
  remember(words) {
    for (const [w, v] of this.weights) {
      const next = v * this.decay;
      if (next < 0.05) {
        this.weights.delete(w);
      } else {
        this.weights.set(w, next);
      }
    }
    for (const w of words) {
      this.weights.set(w, Math.min(1, (this.weights.get(w) || 0) + 1));
    }
  }
  weight(word) {
    return this.weights.get(word) || 0;
  }
  /**
   * Topic of the whole document, as word co-occurrence: a sense whose gloss
   * words share sentences with the ambiguous word elsewhere in the
   * document fits its topic ("deposit" next to "bank" and "money" in a
   * text about payouts). Plain frequency would not do: a legal text says
   * "government" often, which says nothing about "capital".
   */
  setTopic(text) {
    this.topic = text
      .toLowerCase()
      .split(/[.!?;,:()\n]+/)
      .map((s) => {
        const set = new Set((s.match(/[a-z]{3,}/g) || []).map(stem));
        // an amount of currency is a mention of money, as in sentence cues
        if (
          /[$€£¥]\s?\d|\d\s?(?:usd|eur|gbp)\b|\b(?:usd|eur|gbp)\s?\d/.test(s)
        ) {
          set.add('money');
        }
        return set;
      })
      .filter((s) => s.size > 1);
    this.cooccur = new Map();
    this.own = familyCounts(text);
    if (!this.families) {
      this.setField(text);
      this.fieldOfOwn = true;
    }
  }
  /**
   * The field: a larger body of text the document belongs to (the whole
   * site), counted by word family (first five letters) per sentence.
   */
  setField(text) {
    const { families, size, sentences } = familyCounts(text);
    this.families = families;
    this.postings = new Map();
    this.lifts = new Map();
    this.fieldSize = size;
    this.fieldOfOwn = false;
    for (const [id, words] of sentences.entries()) {
      // co-occurrence needs whole stems: "author" is not "authority"
      for (const root of new Set(words.map(stem))) {
        const list = this.postings.get(root);
        if (list) {
          list.push(id);
        } else {
          this.postings.set(root, [id]);
        }
      }
    }
  }
  /**
   * How much more often a cue's family appears in the field's sentences
   * that contain the word than in the field at all (0…1). "royalties"
   * stands next to "authors" and "sales" on this site, not "royal".
   */
  fieldWeight(cue, word) {
    const root = (w) => stem(w.toLowerCase());
    const a = this.postings?.get(root(word));
    if (!a || a.length < 3 || cue.length <= 3) {
      return this.familyWeight(cue) * 0.5;
    }
    const key = `${root(cue)} ${root(word)}`;
    if (this.lifts.has(key)) {
      return this.lifts.get(key);
    }
    const b = this.postings.get(root(cue)) || [];
    let both = 0;
    for (let i = 0, j = 0; i < a.length && j < b.length;) {
      if (a[i] === b[j]) {
        both += 1;
        i += 1;
        j += 1;
      } else if (a[i] < b[j]) {
        i += 1;
      } else {
        j += 1;
      }
    }
    // a few shared sentences are chance: count one deviation less
    const lift =
      (both - Math.sqrt(both)) / a.length / (b.length / this.fieldSize);
    // the word's own family ("royal" in "royalties") says nothing
    const own =
      root(word).startsWith(root(cue)) || root(cue).startsWith(root(word));
    const weight =
      both >= 3 && !own ? Math.max(0, Math.min(1, Math.log10(lift) / 1.5)) : 0;
    this.lifts.set(key, weight);
    return weight;
  }
  /**
   * Is a word distinctive of this document within its field: used in
   * several of its sentences, and at least three times as often as across
   * the field? "people" or "fixed" on a page of a site that says them on
   * every page are no topic. Without a field of its own, every word is.
   */
  distinctive(word) {
    if (this.fieldOfOwn || !this.own || word.length <= 3) {
      return true;
    }
    const family = stem(word).slice(0, 5);
    const n = this.own.families.get(family) || 0;
    const share = (this.families.get(family) || 0) / this.fieldSize;
    return n >= 2 && n / this.own.size >= 3 * share;
  }
  /** How much the document talks about a word's family (0…1). */
  familyWeight(word) {
    const n = word.length > 3 ? this.families?.get(word.slice(0, 5)) || 0 : 0;
    // share of the field's sentences, on a log scale: 1 in 1000 → 0.25,
    // 1 in 30 → 1
    const share = n / Math.max(1, this.fieldSize);
    return n >= 2
      ? Math.max(0, Math.min(1, 1 + Math.log10(share * 30) / 1.5))
      : 0;
  }
  /** Does the document use this word (or a word of this phrase)? */
  mentions(phrase, excluding = '') {
    // a field is mentioned by any word of its family: finance ~ financial
    const roots = phrase
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((w) => w.length > 3)
      .map((w) => stem(w).slice(0, 5));
    return roots.some((root) =>
      this.topic?.some((s) =>
        [...s].some((w) => w !== stem(excluding) && w.startsWith(root))
      )
    );
  }
  topicWeight(cue, word) {
    if (!this.topic || !word) {
      return 0;
    }
    const a = stem(cue);
    const b = stem(word);
    if (a === b) {
      return 0;
    }
    const key = `${a} ${b}`;
    if (!this.cooccur.has(key)) {
      this.cooccur.set(
        key,
        this.topic.filter((s) => s.has(a) && s.has(b)).length
      );
    }
    const n = this.cooccur.get(key);
    return n ? Math.min(1, Math.log2(1 + n) / 3) : 0;
  }
  /** Note a noun phrase that a later pronoun may refer to. */
  mention(referent) {
    this.referents.unshift(referent);
    this.referents.length = Math.min(this.referents.length, 8);
  }
}

/** Sentences of a text, with how many of them use each word family. */
function familyCounts(text) {
  const families = new Map();
  const sentences = [];
  for (const sentence of text.toLowerCase().split(/[.!?;\n]+/)) {
    const words = sentence.match(/[a-z]{3,}/g) || [];
    if (words.length < 2) {
      continue;
    }
    sentences.push(words);
    for (const root of new Set(words.map((w) => stem(w).slice(0, 5)))) {
      families.set(root, (families.get(root) || 0) + 1);
    }
  }
  return { families, size: sentences.length, sentences };
}

/** Crude English stem for topic counts: payments → payment. */
export function stem(word) {
  return word
    .replace(/ies$/, 'y')
    .replace(/(?:ches|shes|sses|xes|zes)$/, (ending) => ending.slice(0, -2))
    .replace(/(?:s|ed|ing|ly)$/, (suffix, at) =>
      at >= (suffix === 's' ? 3 : 4) ? '' : suffix
    )
    .replace(/^(.{4,})al$/, '$1');
}
