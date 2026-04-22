# CLAUDE.md — n8n Project

## Before Any Work

- **Read `@AGENTS.md`** for session protocol (Beads task tracking, Landing the Plane, session completion rules)
- **Read `AGENTS.md`** for the n8nac workflow protocol (GitOps sync, research, validation, testing, error classification)
  - If `AGENTS.md` says "run n8nac init", do that first — it auto-generates the full protocol

## n8n Connection (WSL)

n8n runs on Windows, accessed from WSL via the vEthernet bridge — **not localhost**.

```bash
# Step 1: Init n8nac
npx --yes n8nac init
# Instance URL: http://172.31.224.1:5678
# API key: grab from n8n UI → Settings → API → API Keys

# Step 2: Verify
npx --yes n8nac list
```

- n8n host from WSL: `172.31.224.1:5678` (vEthernet bridge)
- API key stored in: `~/.config/n8nac-nodejs/Config/credentials.json` after init
- `n8nac-config.json` is gitignored (instance-specific)

## Tech Stack

- **n8n** — workflow automation (connect via `npx --yes n8nac init`)
- **n8nac** — code-first workflow development (`.workflow.ts` format)
- **Beads** (`bd`) — AI-native issue tracker and agent memory

## Beads Conventions

- Beads is the task authority for this repo.
- Start with `bd dolt pull || true` and `bd ready --json`.
- Create self-contained beads at creation time with `bd create --description "what and why" --context "files, commands, current state" --notes "SOURCES: <url or internal source>. kn entry: <filename or none>"`.
- For investigations or regressions, make beads evidence-first: repro, observed evidence, likely fix surface when justified, and acceptance that can falsify the current theory.
- Decompose obvious epics into child beads immediately and wire order with `bd dep`.
- Close beads with explicit reasons such as `completed`, `superseded`, `already implemented`, or `invalidated by better evidence`.
- End sessions with `bd dolt push`, not the older `bd sync` flow.

## Key Commands

```bash
# Workflow operations
npx --yes n8nac list                    # List all workflows
npx --yes n8nac push <file>.workflow.ts # Push to n8n
npx --yes n8nac verify <id>            # Validate live workflow
npx --yes n8nac test <id> --prod       # Test webhook workflows

# Scaffold
npm run new-workflow -- <category>/<slug> "Display Name"

# Beads
bd dolt pull || true  # Refresh shared Beads state
bd ready --json       # Start session — find available work
bd dolt push          # End session — persist state for next agent
```

## Workflows

| Workflow | n8n ID | File |
|---|---|---|
| Meeting Intelligence Pipeline | `k2VzgzfxKOtosxzn` | `meeting-intelligence.workflow.ts` |
| Setup Meeting Sheet | `Cctig8XetXsoKeou` | `setup-meeting-sheet.workflow.ts` |

## Critical Rules

- Read `AGENTS.md` after this file for the repo workflow contract.
- **Push with full path**: `npx --yes n8nac push "workflows/172_31_224_1:5678_marius _j/personal/meeting-intelligence.workflow.ts"`
- **Init required**: Must run `npx --yes n8nac init` before pull/push
- **Activate after push**: `npx --yes n8nac workflow activate <id>` — push deactivates
- **Model ID**: Use `anthropic/claude-sonnet-4` on OpenRouter (no date suffix)
- **Session end**: Always run `bd dolt push` then `git push` — Landing the Plane protocol
- **Never leave unpushed work** — work isn't done until `git push` succeeds
