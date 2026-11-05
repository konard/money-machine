/** Cursor over a token array. */
export class Cursor {
  constructor(tokens) {
    this.tokens = tokens;
    this.i = 0;
  }
  /** A cursor k tokens further on, leaving this one where it is. */
  from(k) {
    const other = new Cursor(this.tokens);
    other.i = this.i + k;
    return other;
  }
  get peek() {
    return this.tokens[this.i];
  }
  at(k) {
    return this.tokens[this.i + k];
  }
  next() {
    return this.tokens[this.i++];
  }
  get done() {
    return this.i >= this.tokens.length;
  }
}
