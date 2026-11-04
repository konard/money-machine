/** Uppercase technical identifiers are opaque, including digit-leading codes. */
export const IDENTIFIER =
  '(?:[A-Z]{2,} +\\d+|(?=[A-Z0-9/-]*[A-Z])(?=[A-Z0-9/-]*\\d)[A-Z0-9]+(?:[-/][A-Z0-9]+)*|[A-Z]{2,}(?:-[A-Z]{2,})+)(?![\\p{L}\\d])';
export const isIdentifier = (text) =>
  new RegExp(`^${IDENTIFIER}$`, 'u').test(text);
