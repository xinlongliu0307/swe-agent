export type Listener<T> = (payload: T) => void;

export class Emitter<T> {
  listeners: Listener<T>[] = [];

  /** Add a listener. Returns a function that removes it again. */
  on(listener: Listener<T>): () => void {
    this.listeners.push(listener);
    return () => {};
  }

  emit(payload: T): void {
    for (const l of this.listeners) l(payload);
  }
}
