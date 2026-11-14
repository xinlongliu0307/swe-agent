type Listener<T> = (value: T) => void;

export class Emitter<T> {
  private listeners: Listener<T>[] = [];

  on(fn: Listener<T>): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  emit(value: T): void {
    for (const l of [...this.listeners]) l(value);
  }
}
