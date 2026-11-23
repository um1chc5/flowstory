# flowstory

> **Status: design phase.** Only docs exist so far. Nothing is published. `flowstory` is a working name.

**An agent skill that turns a system and a proposed change into an interactive design review.**

You ask your agent:

> *"Show how checkout works in this repo, where it breaks under load, and how an outbox + idempotency keys would fix it."*

The agent reads the code, writes a small JSON spec, validates it, and builds **one self-contained `.html` file**:

- **Today**: the real architecture, traced from the code, with a request moving through it.
- **Problems**: the same layout. Weak spots turn red and get a callout (performance, correctness, security, ops).
- **Proposal** (or Options A / B): the same layout again. New parts are green, removed parts fade, and fixes are pinned where the problems were.
- **Scenarios**: pick an input ("payment timeout", "double submit", "flash-sale spike") and press play. You watch what happens to it in each mode and get a verdict at the end.
- **Deep dive**: click any node to see what it does, how it works, where it lives in the code, its weak points, and links for further reading.
- **Proposal doc**: an optional `PROPOSAL.md` built from the same data, with matching problem ids (P1, P2…) in the doc and on the diagram.

## Why another diagram skill?

Tools like *archify* and *diagram-design* already draw excellent diagrams, and *archify* even plays them back as stories. flowstory doesn't compete on diagram types. It answers a different question:

> **"What happens to *this input* today, where does it break, and which option fixes it?"**

It is opinionated: it reports problems, verdicts, and a recommendation, each backed by evidence. See [docs/01-product.md](docs/01-product.md).

## Existing code or a blank page

With a repo, the agent traces the flow from the code and cites files pinned to a commit. Without one, flowstory is a design and brainstorming tool: modes are candidate architectures, scenarios are the requirements that matter, and evidence comes from docs, measurements, or stated assumptions. Verdicts that rest only on assumptions are labelled *assumed*.

## Read the docs

| Doc | What's inside |
| --- | --- |
| [01 · Product](docs/01-product.md) | Who it's for, use cases, positioning, non-goals |
| [02 · Features](docs/02-features.md) | The three jobs (diagram · proposal · sync), diagram types, presets and feature flags |
| [03 · Spec format](docs/03-spec-format.md) | The JSON the agent writes, with a full example |
| [04 · Architecture](docs/04-architecture.md) | Skill folder layout, runtime, build pipeline, checks |
| [05 · Proposal mode](docs/05-proposal.md) | How the proposal doc and the diagram stay in sync |
| [06 · Roadmap](docs/06-roadmap.md) | v1 scope, later versions, open questions |
| [ADRs](docs/adr/) | Decisions and why we made them |
| [Draft SKILL.md](skills/flowstory/SKILL.md) | What the agent will actually read |

## Origin

flowstory generalizes a hand-built research page: an animated system diagram with modes, scenarios, callouts, a deep-dive sheet, and a story panel. The page worked well for presenting an architecture proposal to a tech lead. The goal is to let any agent produce that kind of page for any codebase.
