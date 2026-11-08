export type Listener<T> = (payload: T) => void;

export class Emitter<T> {
  listeners: Listener<T>[] = [];

  /** Add a listener. Returns a function that removes it again. */
  on(listener: Listener<T>): () => void {
    this.listeners.push(listener);
    return () => this.off(listener);
  }

  off(listener: Listener<T>): void {
    const i = this.listeners.indexOf(listener);
    if (i >= 0) this.listeners.splice(i, 1);
  }

  once(listener: Listener<T>): () => void {
    const wrapper: Listener<T> = (payload) => {
      this.off(wrapper);
      listener(payload);
    };
    return this.on(wrapper);
  }

  emit(payload: T): void {
    for (const l of [...this.listeners]) l(payload);
  }
}
