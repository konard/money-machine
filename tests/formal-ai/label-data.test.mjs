import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadTopicalLabels,
  parseLabelModule,
} from '../../formal-ai/src/sources/label-data.mjs';
import { senseDomain } from '../../formal-ai/src/sources/sense-data.mjs';
import { compactResponse } from '../../formal-ai/src/sources/compact.mjs';

const MODULE = `local labels = {}

labels["computing"] = {
\taliases = {"computer", "computers"},
\tWiktionary = "computing#Noun",
\ttopical_categories = true,
}

labels["electronics"] = {
\tWiktionary = true,
\tWikidata = "Q11650",
\ttopical_categories = true,
}

return labels`;

test('topical labels come from Wiktionary label data, aliases included', () => {
  const labels = parseLabelModule(MODULE);
  assert.equal(labels.get('computers').name, 'computing');
  assert.equal(labels.get('electronics').wikidata, 'Q11650');
  assert.equal(labels.has('stative'), false);
  const page = {
    query: {
      pages: [
        {
          title: 'Module:labels/data/topical',
          revisions: [{ slots: { main: { content: MODULE } } }],
        },
      ],
    },
  };
  const compact = compactResponse('wiktionary', page).query.pages[0]
    .revisions[0].slots.main.content;
  assert.deepEqual(parseLabelModule(compact), labels);
  assert.ok(!compact.includes('topical_categories'));
});

test('only a topical label is a sense field once the list is loaded', async () => {
  // before loading, the offline pattern decides
  assert.equal(senseDomain({ labels: ['stative'] }), 'stative');
  await loadTopicalLabels({
    cache: false,
    fetchImpl: () =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            query: {
              pages: [
                { revisions: [{ slots: { main: { content: MODULE } } }] },
              ],
            },
          }),
      }),
  });
  assert.equal(senseDomain({ labels: ['stative'] }), null);
  assert.equal(
    senseDomain({ labels: ['transitive', 'electronics'] }),
    'electronics'
  );
  assert.equal(senseDomain({ gloss: 'computing: a store' }), 'computing');
  assert.equal(senseDomain({ gloss: 'regional: a store' }), null);
});
