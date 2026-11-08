import { Emitter } from "./emitter.ts";

export class Store<S> {
  state: S;
  changes = new Emitter<S>();

  constructor(initial: S) {
    this.state = initial;
  }

  set(next: S): void {
    this.state = next;
    this.changes.emit(next);
  }

  /** Call fn with the new state on the first change only. */
  onFirstChange(fn: (s: S) => void): void {
    this.changes.once(fn);
  }
}
