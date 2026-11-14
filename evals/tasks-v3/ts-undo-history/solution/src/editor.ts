import { TextDocument } from "./document.ts";
import { History } from "./history.ts";

export class Editor {
  private doc = new TextDocument();
  private history: History;
  cursor = 0;

  constructor(limit = 100) {
    this.history = new History(limit);
  }

  /** Insert s at the cursor and move the cursor after it. */
  type(s: string): void {
    if (!s) return;
    const pos = this.cursor;
    this.doc.insert(pos, s);
    this.cursor += s.length;
    this.history.record({ pos, inserted: s, removed: "", cursorBefore: pos, cursorAfter: this.cursor });
  }

  /** Delete up to n characters before the cursor, like Backspace. */
  erase(n: number): void {
    const start = Math.max(0, this.cursor - n);
    if (start === this.cursor) return;
    const before = this.cursor;
    const removed = this.doc.delete(start, before - start);
    this.cursor = start;
    this.history.record({ pos: start, inserted: "", removed, cursorBefore: before, cursorAfter: start });
  }

  undo(): boolean {
    const e = this.history.takeUndo();
    if (!e) return false;
    if (e.inserted) this.doc.delete(e.pos, e.inserted.length);
    if (e.removed) this.doc.insert(e.pos, e.removed);
    this.cursor = e.cursorBefore;
    return true;
  }

  redo(): boolean {
    const e = this.history.takeRedo();
    if (!e) return false;
    if (e.removed) this.doc.delete(e.pos, e.removed.length);
    if (e.inserted) this.doc.insert(e.pos, e.inserted);
    this.cursor = e.cursorAfter;
    return true;
  }

  get text(): string {
    return this.doc.text;
  }
}
