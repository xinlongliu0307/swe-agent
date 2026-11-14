Add undo and redo to the Editor in src/editor.ts. Put the history logic in a new module,
src/history.ts, and use it from Editor. Requirements:

- editor.undo() and editor.redo() return true if they changed something and false otherwise.
- Undo and redo restore both the text and the cursor position.
- Any new edit (type or erase) clears the redo history.
- new Editor(limit) keeps at most limit undo steps (default 100); the oldest steps are dropped.
- Edits that change nothing (typing "" or erasing at the start of the text) are not recorded.

Do not edit the tests.
