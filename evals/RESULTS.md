| date | model | runs | solved | false claims | mean steps | tool errors |
|---|---|---|---|---|---|---|
| 2026-11-02 | qwen2.5-coder:32b | 30 | 25 (83%) | 5 | 8.1 | 52 |
| 2026-11-07 | qwen2.5-coder:32b, seeded t=0.3 (0013 safer editing) | 50 | 46 (92%) | 4 | 6.6 | 52 |
| 2026-11-07 | Mac, local Ollama, seeded t=0.3 (0014 agent runs tests) | 50 | 50 (100%) | 0 | 6.1 | 46 |
| 2026-11-07 | Mac, local Ollama, seeded t=0.3 (v0.2.0 control) | 50 | NN | - | - | - |
| 2026-11-08 | qwen2.5-coder:32b, seeded t=0.3, SUITE v2 baseline (0016) | 30 | 9 (30%) | 15 | 11.9 | 130 |
| 2026-11-08 | SUITE v2 with 0017 (review on, max-steps 20) | 30 | 8 (27%) | 5 | 17.2 | 177 |
| 2026-11-09 | SUITE v2 with 0018+0019 (review on, max-steps 20) | 30 | 4 (13%) | 7 | 17.6 | 116 |
| 2026-11-13 | SUITE v2 Python tasks only (0020) | 15 | 6 (40%) | 2 | 18.1 | 57 |
| 2026-11-13 | SUITE v2 Python tasks, max-steps 30 (0020) | 15 | 3 (20%) | 3 | 25.5 | 165 |
| 2026-11-14 | qwen3.6:27b (Ollama 0.40.16), SUITE v2 Python tasks (0020) | 15 | 13 (87%) | 2 | 12.6 | 1 |
| 2026-11-14 | qwen3.6:27b, SUITE v2 all tasks (0020) | 30 | 29 (97%) | 1 | 13.9 | 13 |
| 2026-11-14 | qwen3.6:27b, SUITE v1 (0020) | 50 | 50 (100%) | 0 | 8.4 | 7 |
| 2026-11-14 | qwen3.6:27b, SUITE v3 (0021, max-steps 30; 1 model error; hidden check visible to agent) | 24 | 22 (92%) | 2 | 14.9 | 7 |
| 2026-11-14 | qwen3.6:27b, SUITE v3 (0022, max-steps 30) | 24 | 24 (100%) | 0 | 16.1 | 10 |
