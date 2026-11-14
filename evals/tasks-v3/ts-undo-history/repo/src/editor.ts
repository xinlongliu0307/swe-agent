import { TextDocument } from "./document.ts";

export class Editor {
  private doc = new TextDocument();
  cursor = 0;

  /** Insert s at the cursor and move the cursor after it. */
  type(s: string): void {
    this.doc.insert(this.cursor, s);
    this.cursor += s.length;
  }

  /** Delete up to n characters before the cursor, like Backspace. */
  erase(n: number): void {
    const start = Math.max(0, this.cursor - n);
    this.doc.delete(start, this.cursor - start);
    this.cursor = start;
  }

  get text(): string {
    return this.doc.text;
  }
}
