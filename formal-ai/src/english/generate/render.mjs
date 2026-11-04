/** Recursive realization of entities, properties, roles and clauses. */
import {
  PRONOUNS,
  POSSESSIVES,
  DETERMINERS,
  INDEFINITES,
  PREPOSITIONS,
  SUBORDINATORS,
  COORDINATORS,
  WH_WORDS,
  MODALS,
  NUMBERS,
} from '../function-words.mjs';
import { surface, inflect, agreement, finiteAux } from './morphology.mjs';

const join = (...parts) => parts.flat().filter(Boolean).join(' ');
const find = (table, match) =>
  Object.entries(table).find(([, value]) => match(value))?.[0];
const number = (n) =>
  ({ sg: 'singular', pl: 'plural', 'sg|pl': 'singular plural' })[n];
const gender = (g) => ({ m: 'masculine', f: 'feminine', n: 'neuter' })[g];

export class EnglishRenderer {
  constructor(lexicon) {
    this.lexicon = lexicon;
    this.forms = new Map();
    // Public form-of pages are indexed separately from concept.en. Reverse
    // that dictionary index too; never invent an irregular content-word list.
    for (const [word, readings] of lexicon.byForm || []) {
      for (const r of readings) {
        const key = `${r.pos}:${r.lemma}`;
        const forms = this.forms.get(key) || {};
        forms[r.feature] ||= word;
        this.forms.set(key, forms);
      }
    }
  }

  entry(id, pos) {
    const entries = this.lexicon.get(id)?.en || [];
    const entry = entries.find((x) => x.pos === pos) || entries[0];
    if (entry) {
      return {
        ...this.forms.get(`${entry.pos}:${surface(entry).toLowerCase()}`),
        ...entry,
      };
    }
    // These predicates are grammatical primitives, with closed-class forms.
    return {
      be: {
        pos: 'verb',
        lemma: 'be',
        past: 'was',
        participle: 'been',
        ing: 'being',
      },
      have: {
        pos: 'verb',
        lemma: 'have',
        past: 'had',
        participle: 'had',
        third: 'has',
      },
      do: {
        pos: 'verb',
        lemma: 'do',
        past: 'did',
        participle: 'done',
        third: 'does',
      },
    }[id];
  }

  word(id, pos, form = 'base') {
    const entry = this.entry(id, pos);
    if (entry) {
      const word = inflect(entry, form);
      return this.lexicon
        .get(id)
        ?.classes?.some((c) => c === 'month' || c === 'weekday')
        ? word.charAt(0).toUpperCase() + word.slice(1)
        : word;
    }
    return (
      find(INDEFINITES, (v) => v === id)?.replaceAll('+', ' ') ||
      find(WH_WORDS, (v) => v.concept === id) ||
      ''
    );
  }

  relation(id) {
    return find(PREPOSITIONS, (v) => v === id)?.replaceAll('_', ' ') || '';
  }
  conjunction(id) {
    return find({ ...COORDINATORS, ...SUBORDINATORS }, (v) => v === id) || '';
  }

  pronoun(p, role) {
    const table = role === 'possessive' ? POSSESSIVES : PRONOUNS;
    const text = find(
      table,
      (v) =>
        v.person === p.person &&
        number(v.number) === p.number &&
        gender(v.gender) === p.gender &&
        (role === 'possessive' ||
          (p.reflexive
            ? v.case === 'refl'
            : v.case === 'any' ||
              v.case === (role === 'subject' ? 'nom' : 'obj')))
    );
    return text === 'i' ? 'I' : text || '';
  }

  property(p) {
    let word = this.word(
      p.concept,
      'adj',
      p.participle
        ? /present|active/.test(p.participle)
          ? 'ing'
          : 'participle'
        : 'base'
    );
    const entry = this.entry(p.concept, 'adj');
    if (p.comparative || p.superlative) {
      const form = p.superlative ? 'superlative' : 'comparative';
      word =
        entry?.[form] ||
        (/^[^aeiou]*[aeiou][^aeiou]*$|y$/i.test(word)
          ? inflect(entry, form)
          : join(p.superlative ? 'most' : 'more', word));
    } else if (p.comparison) {
      word = join(
        { greater: 'more', lesser: 'less', greatest: 'most', least: 'least' }[
          p.comparison
        ],
        word
      );
    }
    word = join(p.degree && this.word(p.degree, 'adv'), word);
    if (p.alternative) {
      word += `/${this.property(p.alternative)}`;
    }
    if (p.also) {
      word = join(
        word,
        p.also.map((x) =>
          join(this.conjunction(x.link) || 'and', this.property(x))
        )
      );
    }
    return word;
  }

  entity(e, role = 'object') {
    if (!e) {
      return '';
    }
    if (e.relativePronoun) {
      return role === 'subject' ? 'that' : '';
    }
    if (e.coordination) {
      return join(
        e.correlative
          ? e.coordination === 'conj.nor'
            ? 'neither'
            : 'either'
          : '',
        ...e.items.map((x, i) =>
          join(
            i ? this.conjunction(e.coordination) || e.coordination : '',
            this.entity(x, role)
          )
        )
      );
    }
    if (e.pronoun) {
      return this.pronoun(e.pronoun, role);
    }
    if (e.demonstrative) {
      return e.number === 'plural'
        ? e.demonstrative === 'this'
          ? 'these'
          : 'those'
        : e.demonstrative;
    }
    if (e.action) {
      return this.nonfinite(e.action, 'ing');
    }
    let head =
      e.name ||
      e.untranslated ||
      this.word(e.concept, 'noun', e.number === 'plural' ? 'plural' : 'base');
    if (e.alternative) {
      head += `/${e.alternative.name || this.word(e.alternative.concept)}`;
    }
    if (e.question && !head) {
      return this.word(e.question);
    }
    const mods = (e.modifiers || []).map((m) => {
      let word =
        m.name ||
        this.word(m.concept, 'noun', m.number === 'plural' ? 'plural' : 'base');
      if (m.alternative) {
        word += `/${m.alternative.name || this.word(m.alternative.concept)}`;
      }
      return word;
    });
    const props = (e.properties || []).map((p, i) =>
      join(
        i && p.join ? this.conjunction(p.join) || p.join : '',
        this.property(p)
      )
    );
    let det =
      e.determiner &&
      (find(
        DETERMINERS,
        (v) =>
          v.det === e.determiner && (!v.number || number(v.number) === e.number)
      ) ||
        find(DETERMINERS, (v) => v.det === e.determiner));
    if (e.possessor) {
      det = e.possessor.pronoun
        ? this.pronoun(e.possessor.pronoun, 'possessive')
        : `${this.entity(e.possessor)}'s`;
    }
    if (!det && e.definiteness === 'definite') {
      det = 'the';
    }
    if (!det && e.definiteness === 'indefinite' && e.quantity === undefined) {
      det =
        e.number === 'plural'
          ? 'some'
          : /^[aeiou]/i.test(join(props, mods, head))
            ? 'an'
            : 'a';
    }
    const count =
      e.quantityText ||
      (e.quantity !== undefined
        ? e.digits
          ? String(e.quantity)
          : find(NUMBERS, (v) => v === e.quantity) || String(e.quantity)
        : '');
    const bound = {
      above: 'more than',
      below: 'less than',
      lower: 'at least',
      upper: 'up to',
      approximate: 'about',
      almost: 'almost',
      maximum: 'max',
      minimum: 'min',
      range: `between ${e.rangeFrom} and`,
    }[e.bound];
    // "a 60-day hold": a measure goes before the noun, hyphenated
    const measures = (e.relations || [])
      .filter((m) => m.measure)
      .map(
        (m) => `${m.entity.quantity}-${this.word(m.entity.concept, 'noun')}`
      );
    let text = join(
      e.question && this.word(e.question),
      bound,
      e.quantifier &&
        { greater: 'more', lesser: 'less', least: 'least' }[e.quantifier],
      det,
      count,
      measures,
      props,
      mods,
      head,
      e.amount
    );
    if (e.of) {
      text = join(text, 'of', this.entity(e.of));
    }
    if (e.relations) {
      text = join(
        text,
        e.relations.filter((m) => !m.measure).map((m) => this.modifier(m))
      );
    }
    if (e.participles) {
      text = join(
        text,
        e.participles.map((p) => this.nonfinite(p, 'participle'))
      );
    }
    if (e.purpose) {
      text = join(text, 'to', this.nonfinite(e.purpose));
    }
    if (e.relative) {
      const relative = this.clause(e.relative, true);
      text = join(
        text,
        e.relative.subject?.relativePronoun ? '' : 'that',
        relative
      );
    }
    if (e.label) {
      text = join(text, e.label);
    }
    if (e.calendar) {
      text = join(e.calendar.day, text, e.calendar.year);
    }
    if (e.parenthetical) {
      text = join(text, `(${this.statements(e.parenthetical)})`);
    }
    return text;
  }

  modifier(m) {
    if (m.kind === 'adverb') {
      return this.word(m.concept, 'adv');
    }
    if (m.kind === 'conj') {
      return m.conj;
    }
    if (m.kind === 'time') {
      return this.entity(m.entity);
    }
    if (m.kind === 'role') {
      return join('as', this.entity(m.entity));
    }
    if (m.kind === 'quantity' || m.kind === 'comparison') {
      return join(
        m.equal
          ? 'as'
          : {
              greater: 'more',
              lesser: 'less',
              greatest: 'most',
              least: 'least',
            }[m.comparison],
        m.entity && join(m.equal ? 'as' : 'than', this.entity(m.entity))
      );
    }
    return join(
      this.relation(m.relation),
      this.entity(m.entity),
      m.adverb && this.word(m.adverb, 'adv')
    );
  }

  nonfinite(s, form = 'base') {
    const passive = s.voice === 'passive' && form !== 'participle';
    const before = (s.modifiers || [])
      .filter((m) => m.position)
      .map((m) => this.modifier(m));
    return join(
      before,
      passive && (form === 'ing' ? 'being' : 'be'),
      this.word(s.predicate, 'verb', passive ? 'participle' : form),
      this.tail(s)
    );
  }

  tail(s) {
    const objects = (s.objects || [])
      .filter((e) => !e.relativePronoun && !e.question)
      .map((e) => join(this.relation(e.marker), this.entity(e)));
    const comp = s.complement;
    const complement = comp
      ? comp.kind === 'property'
        ? this.property(comp)
        : comp.kind === 'entity'
          ? comp.entity?.question
            ? ''
            : this.entity(comp.entity)
          : this.modifier(comp)
      : '';
    const mods = (s.modifiers || [])
      .filter((m) => !m.position && m.concept !== 'never')
      .map((m) => this.modifier(m));
    const xcomp = s.complementClause;
    return join(
      objects,
      complement,
      mods,
      xcomp && join(this.entity(xcomp.subject), 'to', this.nonfinite(xcomp))
    );
  }

  clause(s, relative = false, sharedSubject = false) {
    if (s.type === 'phrase') {
      return this.word(s.concept, 'phrase');
    }
    if (s.type === 'fragment') {
      return join(
        this.entity(s.entity),
        s.property && this.property(s.property),
        s.factValue && join(s.valueSeparator || ':', this.entity(s.factValue)),
        s.factProperty &&
          join(s.valueSeparator || ':', this.property(s.factProperty)),
        (s.modifiers || []).map((m) => this.modifier(m))
      );
    }
    const subject =
      s.generic &&
      s.polarity === 'negative' &&
      s.subject?.definiteness === 'indefinite'
        ? { ...s.subject, determiner: 'det.no' }
        : s.subject;
    const imperative = s.mood === 'imperative';
    const invert =
      s.mood === 'question' && s.question?.slot !== 'subject' && !relative;
    // a shared negation is said once, by the first predicate ("don't X or Y")
    const negative =
      !s.sharedPolarity &&
      s.polarity === 'negative' &&
      !(s.modifiers || []).some((m) => m.concept === 'never') &&
      !['det.no', 'det.neither'].includes(subject?.determiner) &&
      // "neither A nor B came", "I like neither tea nor coffee"
      ![subject, ...(s.objects || [])].some(
        (e) => e?.coordination === 'conj.nor'
      ) &&
      !(s.objects || []).some((e) => e.determiner === 'det.no');
    const entry = this.entry(s.predicate, 'verb');
    const lemma =
      surface(entry) ||
      (s.frame === 'copula' || s.frame === 'existence'
        ? 'be'
        : s.frame === 'possession'
          ? 'have'
          : '');
    let chain = [lemma];
    let aux = false;
    if (s.voice === 'passive') {
      chain = ['be', this.word(s.predicate, 'verb', 'participle')];
      aux = true;
    }
    if (s.aspect?.includes('progressive')) {
      chain[0] = chain[0] === 'be' ? 'being' : inflect(entry, 'ing');
      chain.unshift('be');
      aux = true;
    }
    if (s.aspect?.includes('perfect')) {
      chain[0] =
        chain[0] === 'be'
          ? 'been'
          : this.word(s.predicate, 'verb', 'participle');
      chain.unshift('have');
      aux = true;
    }
    const modal =
      s.modality &&
      !s.sharedModality &&
      find(MODALS, (v) => v.modal === s.modality && v.tense === s.tense);
    if (modal || (s.tense === 'future' && !s.sharedModality)) {
      chain.unshift(modal || 'will');
      aux = true;
    } else if (!imperative && !s.sharedModality && !s.sharedPolarity) {
      if (
        ['be', 'have', 'do'].includes(chain[0]) &&
        (aux || chain[0] === 'be')
      ) {
        chain[0] = finiteAux(chain[0], s.tense, subject);
        aux = true;
      } else if (negative || invert) {
        chain.unshift(finiteAux('do', s.tense, subject));
        aux = true;
      } else if (s.tense === 'past') {
        chain[0] = inflect(entry, 'past');
      } else if (
        s.tense === 'present' &&
        agreement(subject).person === 3 &&
        !agreement(subject).plural
      ) {
        chain[0] = lemma === 'have' ? 'has' : inflect(entry, 'third');
      }
    }
    if (imperative && negative) {
      chain.unshift('do');
      aux = true;
    }
    const front = (s.modifiers || [])
      .filter((m) => m.position === 'front')
      .map((m) => this.modifier(m));
    const preverbal = (s.modifiers || [])
      .filter(
        (m) =>
          m.position === 'preverbal' || (m.concept === 'never' && !m.position)
      )
      .map((m) => this.modifier(m));
    let subj =
      imperative || subject?.implicit || sharedSubject
        ? ''
        : this.entity(subject, 'subject');
    if (s.frame === 'existence') {
      subj = 'there';
    }
    const tail = join(
      s.frame === 'existence' && this.entity(subject),
      this.tail(s),
      s.question?.relation && this.relation(s.question.relation),
      relative &&
        (s.objects || []).find((e) => e.relativePronoun)?.marker &&
        this.relation(s.objects.find((e) => e.relativePronoun).marker)
    );
    const wh =
      s.question && s.question.slot !== 'subject'
        ? this.entity(
            (s.objects || []).find((e) => e.question) ||
              s.complement?.entity || { question: s.question.concept }
          )
        : '';
    // Note-style passives omit both subject and finite copula ("Billed
    // monthly"). Adding "is" would turn that note into an inverted clause.
    const reduced =
      subject?.implicit &&
      !s.link &&
      !imperative &&
      s.voice === 'passive' &&
      s.aspect === 'simple' &&
      s.tense === 'present' &&
      !s.modality;
    let first = chain.shift();
    if (reduced) {
      first = '';
    }
    const body = invert
      ? join(wh, first, subj, negative && 'not', preverbal, chain, tail)
      : join(
          wh,
          subj,
          subject?.floatingQuantifier,
          preverbal,
          first,
          aux && negative && 'not',
          chain,
          tail
        );
    return join(front, s.politeness && 'please', s.inclusive && 'let us', body);
  }

  statements(statements) {
    return statements
      .map((s, i) =>
        join(
          i && (s.separator || (s.link ? '' : ',')),
          this.conjunction(s.link),
          // Noun subjects lose their surface ellipsis flag in formalize's
          // entity conversion. Equivalent shared subjects can still be
          // realized once. Pronouns retain that flag and must follow it.
          this.clause(
            s,
            false,
            Boolean(
              i &&
              !s.subject?.pronoun &&
              ['conj.and', 'conj.or', 'conj.but'].includes(s.link) &&
              JSON.stringify(s.subject) ===
                JSON.stringify(statements[i - 1].subject)
            )
          )
        )
      )
      .join(' ')
      .replace(/\s+([,:;])/g, '$1');
  }
}
