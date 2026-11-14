/** One recorded edit: text inserted and/or removed at pos, with the cursor before and after. */
export interface Edit {
  pos: number;
  inserted: string;
  removed: string;
  cursorBefore: number;
  cursorAfter: number;
}

export class History {
  private done: Edit[] = [];
  private undone: Edit[] = [];
  private limit: number;

  constructor(limit = 100) {
    this.limit = limit;
  }

  record(edit: Edit): void {
    this.done.push(edit);
    if (this.done.length > this.limit) this.done.shift();
    this.undone = [];
  }

  takeUndo(): Edit | undefined {
    const edit = this.done.pop();
    if (edit) this.undone.push(edit);
    return edit;
  }

  takeRedo(): Edit | undefined {
    const edit = this.undone.pop();
    if (edit) this.done.push(edit);
    return edit;
  }
}
