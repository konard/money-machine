/** Empty corpus response for vocabulary/grammar tests that do not test ranks. */
export function rncFixture(params) {
  if (params.get('page')?.startsWith('Appendix:Frequency dictionary')) {
    return {
      ok: true,
      json: () => Promise.resolve({ parse: { wikitext: { '*': '' } } }),
    };
  }
  if (params.get('list') !== 'allpages') {
    return null;
  }
  return { ok: true, json: () => Promise.resolve({ query: { allpages: [] } }) };
}
