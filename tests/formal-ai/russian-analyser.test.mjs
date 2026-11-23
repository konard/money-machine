import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { loadLexicon, Lexicon } from '../../formal-ai/src/lexicon.mjs';
import { formalize } from '../../formal-ai/src/formalize.mjs';
import { generateEnglish } from '../../formal-ai/src/english/generate.mjs';
import { naturalizeRussian } from '../../formal-ai/src/russian/naturalize.mjs';
import {
  analyzeRussian,
  russianRoundTrip,
  analyzerIndex,
  tokenizeRussian,
} from '../../formal-ai/src/russian/analyze/index.mjs';
import { compareRussianMeta } from '../../formal-ai/src/russian/analyze/compare.mjs';
import { viaRussian } from '../../formal-ai/src/russian/analyze/english-round-trip.mjs';
import {
  translateSentence,
  TranslationContext,
} from '../../formal-ai/src/translate.mjs';

const lexicon = loadLexicon({ fresh: true });
const index = analyzerIndex(lexicon);
const parse = (text) => analyzeRussian(text, lexicon, { index });

test('English is regenerated from only the Russian analysis, with link losses reported', () => {
  const context = new TranslationContext({ lexicon });
  const translated = translateSentence('I read a book.', context);
  const trip = viaRussian(
    { ...translated, source: 'A different source.' },
    lexicon,
    { index }
  );
  assert.equal(trip.russian, 'Я прочитал книгу.');
  assert.equal(trip.english, 'I read a book.');
  assert.equal(trip.complete, true);
  assert.deepEqual(trip.differences, []);
  assert.equal(trip.exact, false);
  assert.ok(
    trip.russianComparison.ranges.some(({ kind }) => kind === 'definiteness')
  );
  const definite = viaRussian(
    translateSentence('I read the book.', new TranslationContext({ lexicon })),
    lexicon,
    { index }
  );
  assert.equal(definite.russian, trip.russian);
  assert.deepEqual(definite.russianMeta, trip.russianMeta);
  assert.equal(definite.english, trip.english);
  assert.ok(definite.differences.some(({ kind }) => kind === 'definiteness'));

  const differentRussian = viaRussian(
    { ...translated, text: 'Я прочитала письмо.' },
    lexicon,
    { index }
  );
  assert.equal(differentRussian.english, 'I read a letter.');
  assert.ok(
    differentRussian.differences.some(({ kind }) => kind === 'concept')
  );
});

test('full round-trip CLI reports exact and incomplete results and honors strict mode', () => {
  const result = spawnSync(
    process.execPath,
    [
      'formal-ai/bin/formal-ai.mjs',
      'roundtrip',
      '--via-russian',
      '--offline',
      '--strict',
      '--json',
      'Hello! I quux.',
    ],
    { encoding: 'utf8' }
  );
  assert.equal(result.status, 2, result.stderr);
  const [hello, unknown] = JSON.parse(result.stdout);
  assert.equal(hello.english, 'Hello!');
  assert.equal(hello.exact, true);
  assert.equal(unknown.complete, false);
  assert.equal(unknown.exact, false);
});

test('Russian clauses round-trip exactly with complete independent parses', () => {
  for (const text of [
    'Я читаю книгу.',
    'Я не читаю книги.',
    'Она писала письмо.',
    'Она будет писать письмо.',
    'Я прочитал книгу.',
    'Я прочитаю книгу.',
    'У меня есть ручка.',
    'У меня нет ручки.',
    'Ручка на столе.',
    'Мы читаем книги.',
    'Я читаю две книги.',
    'Ты читаешь книги?',
    'Читает ли она книги?',
    'Что она читает?',
    'Книга, которую я читал, хорошая.',
    'Книга и ручка на столе.',
    'Я читаю и пишу.',
    'Прочитайте книгу.',
    'Не читайте книгу.',
    'Я читаю эту книгу.',
    'Я читаю какую-то книгу.',
    'Я читаю одну книгу.',
    'Я читаю не новую книгу.',
    'Я прочитала книгу.',
    'Я хочу читать книги.',
    'Я могу читать книги.',
    'Я не могу читать книги.',
    'Я читаю много книг.',
    'На столе есть книга.',
    'Читаю книгу.',
    'Новая книга.',
    'Я хочу прочитать книгу.',
    'Я читаю, чтобы писать письма.',
    'Он читает, потому что книга хорошая.',
    'Я не читаю и не пишу.',
    'Книга хорошая и новая.',
    'Я читаю не книгу.',
    'Я читаю не в парке.',
    'Книга не на столе.',
  ]) {
    const result = russianRoundTrip(text, lexicon, { index });
    assert.ok(
      result.complete,
      `${text}: ${JSON.stringify([result.before.leftover, result.after.leftover])}`
    );
    assert.deepEqual(result.differences, [], `${text} → ${result.russian}`);
  }
});

test('a genitive noun phrase modifies the preceding locative noun', () => {
  const analysis = parse('Мы сидели на берегу новой реки.');
  const statement = analysis.statements[0];
  const [location] = statement.modifiers;
  assert.deepEqual(analysis.leftover, []);
  assert.equal(statement.objects, undefined);
  assert.equal(location.relation, 'rel.on');
  assert.ok(location.relationRange.includes('rel.in'));
  assert.equal(location.entity.concept, 'bank.river');
  assert.equal(location.entity.of.concept, 'river');
  assert.equal(location.entity.of.properties[0].concept, 'new');

  const ambiguous = parse('Я увидел в доме друга.').statements[0];
  assert.equal(ambiguous.modifiers[0].entity.of, undefined);
  assert.equal(ambiguous.objects[0].concept, 'friend');
});

test('unambiguous genitive chains also attach to instrumental noun phrases', () => {
  const analysis = parse('Мы сидели рядом с берегом новой реки новой страны.');
  assert.deepEqual(analysis.leftover, []);
  const bank = analysis.statements[0].modifiers[0].entity;
  assert.equal(bank.concept, 'bank.river');
  assert.equal(bank.of.concept, 'river');
  assert.equal(bank.of.of.concept, 'country');
});

test('English restores an impersonal subject and renders a reduced passive', () => {
  const adjective = parse('Свободно.');
  assert.deepEqual(adjective.leftover, []);
  assert.equal(adjective.statements[0].subject.pronoun.gender, 'neuter');
  assert.equal(generateEnglish(adjective, lexicon), 'It is free.');

  const passive = parse('Не пишется.');
  assert.deepEqual(passive.leftover, []);
  assert.equal(passive.statements[0].voice, 'passive');
  assert.equal(generateEnglish(passive, lexicon), 'Not written.');
});

test('a percentage complement can precede a conditional clause', () => {
  const analysis = parse('Цена — 30,5%, если ты платишь.');
  assert.deepEqual(analysis.leftover, []);
  const [main, condition] = analysis.statements;
  assert.equal(main.frame, 'copula');
  assert.equal(main.complement.entity.name, '30.5%');
  assert.equal(condition.link, 'conj.if');
  assert.equal(
    generateEnglish(analysis, lexicon),
    'A price is 30.5% if you pay.'
  );
});

test('standalone Russian possessives keep their owners on the return leg', () => {
  const result = parse('Книга ваша.');
  assert.deepEqual(result.leftover, []);
  assert.deepEqual(result.statements[0].complement.entity.pronoun, {
    person: 2,
    number: 'singular plural',
    independent: true,
  });
  assert.match(generateEnglish(result, lexicon), /is yours\.$/);
});

test('unambiguous genitive dependents attach to subjects and objects', () => {
  const subject = parse('Книга новой школы хорошая.');
  const object = parse('Я читаю письмо новой школы.');
  assert.deepEqual(subject.leftover, []);
  assert.deepEqual(object.leftover, []);
  assert.equal(subject.statements[0].subject.of.concept, 'school');
  assert.equal(object.statements[0].objects[0].of.concept, 'school');
});

test('Russian calendar dates preserve days, months and deadline relations', () => {
  for (const [russian, english] of [
    [
      'Я читаю книгу 5-го числа каждого месяца.',
      'I read a book on the 5th of every month.',
    ],
    ['Я читаю книгу к 15-му числу.', 'I read a book by the 15th.'],
    [
      'Я читаю книгу 5-го числа и 20-го числа.',
      'I read a book on the 5th and the 20th.',
    ],
    ['Я прочитал книгу 3 ноября 2026 г.', 'I read a book 3 November 2026.'],
  ]) {
    const analysis = parse(russian);
    assert.deepEqual(analysis.leftover, [], russian);
    assert.equal(generateEnglish(analysis, lexicon), english);
  }
});

test('Russian past forms followed by бы recover conditional modality', () => {
  const result = parse('Я прочитал бы книгу.');
  assert.deepEqual(result.leftover, []);
  assert.equal(result.statements[0].modality, 'modal.would');
  assert.equal(generateEnglish(result, lexicon), 'I would read a book.');
});

test('Russian time offsets preserve bounds, units, and the following relation', () => {
  const sentence = parse('Я читаю книгу не менее чем за 2 дня до работы.');
  assert.deepEqual(sentence.leftover, []);
  const [offset, anchor] = sentence.statements[0].modifiers;
  assert.equal(offset.relation, 'rel.before');
  assert.equal(offset.offset, true);
  assert.equal(offset.entity.quantity, 2);
  assert.equal(offset.entity.bound, 'lower');
  assert.equal(anchor.relation, 'rel.before');
  assert.match(generateEnglish(sentence, lexicon), /at least 2 days before /);
});

test('registered capitalized Russian names take precedence over matching common forms', () => {
  const vocabulary = loadLexicon({ fresh: true });
  vocabulary.setNameLabel('Tom', 'Том');
  vocabulary.setNameEntry('Tom', {
    pos: 'noun',
    lemma: 'Том',
    gender: 'm',
    animate: true,
  });
  const result = analyzeRussian('Я помогаю Тому.', vocabulary);
  assert.deepEqual(result.leftover, []);
  assert.equal(result.statements[0].objects[0].name, 'Tom');
  assert.equal(generateEnglish(result, vocabulary), 'I help Tom.');
});

test('a semicolon starts a separate Russian statement', () => {
  const result = parse('Я читаю книгу; она пишет письмо.');
  assert.deepEqual(result.leftover, []);
  assert.equal(result.statements[1].separator, ';');
  assert.equal(
    generateEnglish(result, lexicon),
    'I read a book; she writes a letter.'
  );
});

test('English generation retains an object whose Russian gender is ambiguous', () => {
  const analysis = parse('Я вижу его.');
  const [object] = analysis.statements[0].objects;
  assert.equal(object.pronoun.gender, 'masculine neuter');
  assert.equal(generateEnglish(analysis, lexicon), 'I see him.');
});

test('articles are never inferred; only explicit words fix definiteness', () => {
  assert.equal(
    parse('Я читаю книгу.').statements[0].objects[0].definiteness,
    'definite indefinite'
  );
  assert.equal(
    parse('Я читаю эту книгу.').statements[0].objects[0].definiteness,
    'definite'
  );
  assert.equal(
    parse('Я читаю какую-то книгу.').statements[0].objects[0].definiteness,
    'indefinite'
  );
  assert.equal(
    parse('Я читаю одну книгу.').statements[0].objects[0].definiteness,
    'indefinite'
  );
});

test('case, verb government and local negation recover roles', () => {
  const statement = parse('Мне нравится книга.').statements[0];
  assert.equal(statement.subject.pronoun.person, 1);
  assert.equal(statement.objects[0].concept, 'book.text');
  const negation = parse('Я читаю не новую книгу.').statements[0];
  assert.equal(negation.polarity, 'positive');
  assert.equal(negation.objects[0].properties[0].polarity, 'negative');
  assert.equal(
    parse('Ручка на столе.').statements[0].complement.relation,
    'rel.on'
  );
  assert.equal(
    parse('Я помогал Мэри.').statements[0].objects[0].concept,
    'mary'
  );
});

test('translator basic fixtures give source links back within grammatical ranges', () => {
  for (const text of [
    'I do not read books.',
    'I have a pen.',
    'I help Mary.',
    'We live in Moscow.',
    'Mary likes music.',
  ]) {
    const source = formalize(text, lexicon);
    const russian = naturalizeRussian(source, lexicon).text;
    const after = parse(russian);
    assert.deepEqual(after.leftover, []);
    assert.deepEqual(
      compareRussianMeta(source, after).problems,
      [],
      `${text} → ${russian}`
    );
  }
});

test('range compatibility never accepts a changed role, tense, quantity or polarity', () => {
  const source = parse('Я читаю две книги.');
  for (const text of [
    'Я не читаю две книги.',
    'Я читал две книги.',
    'Я читаю три книги.',
  ]) {
    assert.equal(
      compareRussianMeta(source, parse(text)).compatible,
      false,
      text
    );
  }
});

test('grammar works with new lexicon concepts instead of word-specific rules', () => {
  const custom = new Lexicon();
  custom.add({
    id: 'fixture.item',
    en: [],
    classes: [],
    ru: { pos: 'noun', lemma: 'лампа', gender: 'f' },
  });
  custom.add({
    id: 'fixture.action',
    en: [],
    classes: [],
    ru: {
      pos: 'verb',
      lemma: 'проверять',
      aspect: 'impf',
      government: { case: 'acc' },
      markerGovernment: { about: { preposition: 'о', case: 'prep' } },
    },
  });
  const parsed = analyzeRussian('Я проверяю лампу о лампе.', custom);
  assert.deepEqual(parsed.leftover, []);
  assert.equal(parsed.statements[0].predicate, 'fixture.action');
  assert.equal(parsed.statements[0].objects[0].concept, 'fixture.item');
  assert.equal(parsed.statements[0].modifiers[0].relation, 'rel.about');
  assert.ok(russianRoundTrip('Я проверяю лампу.', custom).complete);
});

test('unknown input and empty parses cannot be complete round trips', () => {
  assert.equal(russianRoundTrip('', lexicon, { index }).complete, false);
  const result = parse('Я абракадабрю книгу.');
  assert.ok(result.unknown.includes('абракадабрю'));
  assert.ok(result.leftover.includes('абракадабрю'));
});

test('reads inflected compound nouns and their fixed words as one entity', () => {
  const custom = new Lexicon();
  custom.add({
    id: 'fixture.exchange',
    en: [],
    classes: [],
    ru: {
      pos: 'noun',
      lemma: 'быстрый обмен письмами',
      gender: 'm',
      compound: { adjectives: ['быстрый'], head: 'обмен', tail: 'письмами' },
    },
  });
  const parsed = analyzeRussian('Без быстрого обмена письмами.', custom);
  assert.deepEqual(parsed.leftover, []);
  assert.equal(
    parsed.statements[0].modifiers[0].entity.concept,
    'fixture.exchange'
  );
  custom.add({
    id: 'fixture.oversight',
    en: [],
    classes: [],
    ru: {
      pos: 'noun',
      lemma: 'контроль за движением',
      gender: 'm',
      compound: { adjectives: [], head: 'контроль', tail: 'за движением' },
    },
  });
  const fragment = analyzeRussian('Контроль за движением.', custom);
  assert.deepEqual(fragment.leftover, []);
  assert.equal(fragment.statements[0].entity.concept, 'fixture.oversight');
});

test('recovers a dictionary action noun as a verbal entity', () => {
  const custom = new Lexicon();
  custom.add({
    id: 'fixture.check',
    en: [],
    classes: [],
    ru: {
      pos: 'verb',
      lemma: 'проверять',
      aspect: 'impf',
      actionNoun: { pos: 'noun', lemma: 'проверка', gender: 'f' },
    },
  });
  const parsed = analyzeRussian('Без проверки.', custom);
  assert.deepEqual(parsed.leftover, []);
  assert.equal(
    parsed.statements[0].modifiers[0].entity.action.predicate,
    'fixture.check'
  );
});

test('uses an experiencer construction when the alternate infinitive verb is absent', () => {
  const custom = new Lexicon();
  custom.add({
    id: 'fixture.like',
    en: [],
    classes: [],
    ru: { pos: 'verb', lemma: 'нравиться', aspect: 'impf', experiencer: true },
  });
  custom.add({
    id: 'fixture.read',
    en: [],
    classes: [],
    ru: { pos: 'verb', lemma: 'читать', aspect: 'impf' },
  });
  const formal = {
    punctuation: '.',
    statements: [
      {
        type: 'statement',
        frame: 'event',
        tense: 'present',
        predicate: 'fixture.like',
        subject: {
          pronoun: { person: 1, number: 'singular' },
          number: 'singular',
        },
        complementClause: { predicate: 'fixture.read' },
      },
    ],
  };
  assert.equal(naturalizeRussian(formal, custom).text, 'Мне нравится читать.');
});

test('tokenizer preserves offsets, hyphenated indefinite words and ё normalization', () => {
  const tokens = tokenizeRussian('Её что-то?');
  assert.deepEqual(
    tokens.map((t) => [t.text, t.lower, t.offset]),
    [
      ['Её', 'ее', 0],
      ['что-то', 'что-то', 3],
      ['?', '?', 9],
    ]
  );
});

test('parse-ru CLI prints meta and round-trip link differences offline', () => {
  const output = execFileSync(
    process.execPath,
    [
      'formal-ai/bin/formal-ai.mjs',
      'parse-ru',
      '--roundtrip',
      'Я читаю книгу.',
      '--offline',
    ],
    { encoding: 'utf8', env: process.env }
  );
  assert.match(output, /predicate read/);
  assert.match(output, /definiteness "definite indefinite"/);
  assert.match(output, /Exact meta links/);
});
