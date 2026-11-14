export class TextDocument {
  text = "";

  insert(pos: number, s: string): void {
    this.text = this.text.slice(0, pos) + s + this.text.slice(pos);
  }

  /** Remove len characters at pos and return them. */
  delete(pos: number, len: number): string {
    const removed = this.text.slice(pos, pos + len);
    this.text = this.text.slice(0, pos) + this.text.slice(pos + len);
    return removed;
  }
}
