/** Offline invariants: English generation reads meanings, never source text. */
import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLexicon } from '../../formal-ai/src/lexicon.mjs';
import { formalize } from '../../formal-ai/src/formalize.mjs';
import { generate } from '../../formal-ai/src/english/generate.mjs';
import {
  englishRoundTrip,
  compareMeta,
} from '../../formal-ai/src/english/round-trip.mjs';
import { inflect } from '../../formal-ai/src/english/generate/morphology.mjs';
import { resolveText } from '../../formal-ai/src/resolve.mjs';
import { USER_AGENT } from '../../formal-ai/src/sources/fetch.mjs';

const exact = [
  'I read a book.',
  'Mary likes music.',
  'I had a pen.',
  'Do you like the book?',
  'What do you read?',
  'Which book do you read?',
  'Who reads the book?',
  'Where do you work?',
  'I do not like the book.',
  'She does not have a book.',
  'She never works.',
  'Do not read the book.',
  'No children play.',
  'The book was written by Mary.',
  'The book is being written by Mary.',
  'She can read the book.',
  'She could read the book.',
  'She can read and write.',
  'She has written a letter.',
  'She has been working.',
  'They are working.',
  'She will write a letter.',
  'She will have written a letter.',
  'The man who reads the book works.',
  'The book that Mary reads is good.',
  'Mary and John work.',
  'I work and she reads.',
  'We live in Moscow and work in London.',
  'The children play in the park.',
  'The big dog sees the small cat.',
  'There is a book on the table.',
  'Is there a book?',
  'I want to read a book.',
  'I want the book to be read.',
  'I ask Mary to read a book.',
  'I like reading books.',
];

for (const sentence of exact) {
  test(`English round trip: ${sentence}`, (t) => {
    t.mock.method(globalThis, 'fetch', () => {
      throw new Error('Network forbidden');
    });
    const result = englishRoundTrip(sentence);
    assert.deepEqual(result.differences, [], result.english);
    assert.equal(result.exact, true);
    assert.equal(result.complete, true, JSON.stringify(result.before));
  });
}

test('generation is independent of source spelling and token diagnostics', () => {
  const lexicon = loadLexicon();
  const formal = formalize('The children play in the park.', lexicon);
  assert.equal(
    generate({ statements: formal.statements, punctuation: '.' }, lexicon),
    'The children play in the park.'
  );
  formal.sentence = 'This source field must never be echoed.';
  assert.equal(generate(formal, lexicon), 'The children play in the park.');
});

test('comparison reports each semantic field, including changes inside roles', () => {
  const before = {
    statements: [
      {
        predicate: 'p',
        tense: 'past',
        aspect: 'simple',
        mood: 'declarative',
        polarity: 'positive',
        subject: { concept: 'n', number: 'plural', definiteness: 'definite' },
        modifiers: [{ concept: 'a' }],
      },
    ],
  };
  const after = globalThis.structuredClone(before);
  after.statements[0].tense = 'present';
  after.statements[0].subject.number = 'singular';
  delete after.statements[0].subject.definiteness;
  after.statements[0].objects = [after.statements[0].subject];
  delete after.statements[0].subject;
  after.statements[0].modifiers[0].concept = 'b';
  const differences = compareMeta(before, after);
  assert.ok(
    differences.some((d) => d.kind === 'tense' && d.change === 'changed')
  );
  assert.ok(
    differences.some(
      (d) =>
        d.path === 'statements.0.subject.definiteness' && d.change === 'lost'
    )
  );
  assert.ok(
    differences.some(
      (d) => d.path === 'statements.0.objects.0.concept' && d.change === 'added'
    )
  );
  assert.ok(
    differences.some(
      (d) =>
        d.path === 'statements.0.modifiers.0.concept' && d.change === 'changed'
    )
  );
});

test('productive morphology and dictionary forms', () => {
  for (const [lemma, form, expected] of [
    ['study', 'past', 'studied'],
    ['stop', 'past', 'stopped'],
    ['write', 'ing', 'writing'],
    ['run', 'ing', 'running'],
    ['box', 'plural', 'boxes'],
    ['city', 'plural', 'cities'],
    ['work', 'third', 'works'],
    ['watch', 'third', 'watches'],
  ]) {
    assert.equal(inflect({ lemma }, form), expected);
  }
  assert.equal(
    inflect({ lemma: 'write', participle: 'written' }, 'participle'),
    'written'
  );
});

test('public form-of pages supply irregular generation without per-word rules', async () => {
  const lexicon = loadLexicon({ fresh: true });
  // Remove this test lexicon's inflection to exercise the public source path.
  for (const id of lexicon.lookup('verb', 'go')) {
    for (const entry of lexicon.get(id).en) {
      delete entry.past;
    }
  }
  lexicon.byForm.delete('went');
  let requests = 0;
  await resolveText('', {
    words: ['went'],
    lexicon,
    cache: false,
    fetchImpl: (url, options) => {
      requests += 1;
      assert.equal(options.headers['user-agent'], USER_AGENT);
      const p =
        options.method === 'POST'
          ? new URLSearchParams(options.body)
          : new URL(url).searchParams;
      const pages = (p.get('titles') || '').split('|').map((title) =>
        title === 'went'
          ? {
              title,
              revisions: [
                {
                  slots: {
                    main: {
                      content:
                        '==English==\n===Verb===\n# {{simple past of|en|go}}',
                    },
                  },
                },
              ],
            }
          : { title, missing: true }
      );
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ query: { pages }, search: [], entities: {} }),
      });
    },
  });
  assert.ok(requests > 0);
  const result = englishRoundTrip('Mary went to Moscow.', lexicon);
  assert.equal(result.english, 'Mary went to Moscow.');
  assert.equal(result.exact, true);
});

test('known loss: an unknown verb is dropped from the meta', () => {
  // "lends" is absent from the offline unit vocabulary; "bank" stays банк
  // on both passes, since the international word needs no financial context.
  const result = englishRoundTrip('The bank lends money.');
  assert.equal(result.english, 'The bank.');
  assert.equal(result.exact, true);
  assert.equal(result.complete, false);
});
