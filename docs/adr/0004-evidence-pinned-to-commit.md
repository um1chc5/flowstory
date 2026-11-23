# ADR 0004 · Evidence is pinned to a commit

- **Status:** accepted
- **Date:** 2026-11-23

## Context

A flowstory page makes claims about code: "this handler publishes after commit", "retries create a new order". Those claims are only useful if a reviewer can check them, and only stay true while the code doesn't change. Line numbers drift with every edit. A link to `main` can point at different code tomorrow than it did when the agent read it.

## Decision

- A `source: "code"` spec has `evidence.commit`: the commit the agent read when it wrote the spec. `evidence.repo` is optional and only used to build links.
- Every `code` citation has `path` and `lines`, and optionally an `anchor` (a symbol or string expected in that range). Citations are resolved **at the pinned commit**. When `evidence.repo` is set, deep-dive links are permalinks to that commit, not to a branch.
- `check.mjs` compares the pinned commit with HEAD:
  - cited file missing or range out of bounds at HEAD → error;
  - anchor not found near the range → error (or "moved" when found nearby);
  - cited file changed since the pinned commit → **drift** warning, error with `--strict`.
- The agent updates `evidence.commit` only after re-reading the affected code and fixing the spec. Bumping the commit without re-checking defeats the point; `SKILL.md` says so explicitly.
- `design` specs have no commit. Their evidence is `doc`, `measurement`, or `assumption`, and `check` skips repo checks.
- A working tree with uncommitted changes: the agent pins HEAD and notes in the spec that it read uncommitted changes (`evidence.dirty: true`). `check` warns about it.

## Consequences

- A reviewer can open any citation and see exactly what the agent saw.
- Drift becomes visible and can block CI, which is what makes "living documentation" real.
- Agents need git access (`git rev-parse HEAD`, `git diff --name-only`). Without git, a spec can only be `design`.
- Some false positives: a cited file may change in ways that don't affect the claim. Drift is a warning by default for this reason.
