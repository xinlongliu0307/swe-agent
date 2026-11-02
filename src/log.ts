import fs from "node:fs";
import path from "node:path";
import { redact } from "./workspace.ts";

/** Append-only JSONL session log with machine paths redacted. */
export class SessionLog {
  file: string;
  workspace: string;

  constructor(dir: string, workspace: string) {
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    this.file = path.join(dir, `${stamp}.jsonl`);
    this.workspace = workspace;
  }

  write(event: string, data: unknown): void {
    const line = JSON.stringify({ t: new Date().toISOString(), event, data });
    fs.appendFileSync(this.file, redact(line, this.workspace) + "\n");
  }
}
