/** Cursor over a token array. */
export class Cursor {
  constructor(tokens) {
    this.tokens = tokens;
    this.i = 0;
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
