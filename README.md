# swe-agent

A minimal software engineering agent in TypeScript. Zero runtime dependencies; runs on Node 24 directly from source.

## Quick start

```bash
npm ci
cp .env.example .env      # choose provider, model, endpoint
npm run check             # type check + tests
npm run swe -- -w path/to/repo "Add a unit test for parse_date and make it pass"
```

`-y` skips confirmation for shell commands. Session logs are written to `runs/` as JSONL.

## Layout

```
src/cli.ts          command-line entry point
src/agent.ts        the agent loop
src/tools/          tool definitions (read, write, edit, edit_lines, list, search, shell, run_check, finish)
src/llm/            model providers (OpenAI-compatible, Anthropic)
src/workspace.ts    path guard, redaction, truncation
src/log.ts          JSONL session log
test/               node:test suites with a scripted fake model
```

## Evaluating changes

```bash
npm run eval                                        # all tasks once
npm run eval -- --tasks fix-mean,feature-median --repeat 3
npm run eval -- --suite v2 --repeat 3               # multi-file Python and TypeScript tasks
npm run trace -- runs/eval-<stamp>/<task>-<repeat>  # step-by-step view of one run
```

Suites: `v1` (default, `evals/tasks/`) holds ten small single-file Python tasks; `v2` (`evals/tasks-v2/`) holds five multi-file Python and five multi-file TypeScript tasks (bug fixes, a cross-file rename, features). TypeScript tasks run on Node's built-in type stripping and `node --test`, so no packages are installed. Python task code only needs Python 3.6 or newer. Each v2 task also has a `solution/` folder that the test suite uses to prove the task is solvable; the agent never sees it.

Each task in `evals/tasks/<name>/` has a small `repo/`, an instruction in `task.md`, and a `check.sh` that exits 0 only when the task is truly solved. Fix tasks also fail if the agent edits the tests. The harness runs every task in a throwaway copy with shell commands auto-approved, judges it only by `check.sh` (never by the model's summary), and writes a JSON report to `runs/`. Keep a change only if the pass rate rises, or stays level with fewer steps and errors.
