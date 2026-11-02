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
src/tools/          tool definitions (read, write, edit, list, search, shell, finish)
src/llm/            model providers (OpenAI-compatible, Anthropic)
src/workspace.ts    path guard, redaction, truncation
src/log.ts          JSONL session log
test/               node:test suites with a scripted fake model
```
