# ADR 0005 · A general system-diagram tool with optional layers

- **Status:** accepted
- **Date:** 2026-11-23
- **Supersedes:** [ADR 0002](0002-design-review-niche.md)

## Context

ADR 0002 scoped flowstory to behavioural design review: every page was a before/after with scenarios and verdicts. Writing the docs showed that most of what we were designing doesn't depend on reviews: a data-only spec, computed layout with geometry checks, views on one fixed layout, playback, a deep-dive sheet, and code sync. Those make a plain "draw our system" diagram better too.

Keeping review as the only entry point would also make the tool awkward for the most common request, "just draw it", and for greenfield design work.

## Decision

- flowstory is a **diagram tool for software systems**. The core (nodes, edges, groups, layout, deep dives, one HTML file) is always on.
- Everything else is an **optional layer**, switched on by adding its data: **views**, **playback**, **callouts**, **review** (verdicts, problems/fixes, proposal), and **sync**. `diagram` is the default preset.
- **Scope is system diagrams only**: flow, sequence, state machine, pipeline/DAG, deployment. A type is added only if views and playback both make sense on it. v1 ships flow and sequence; the rest follow as type modules.
- Out of scope: ERD, class diagrams, charts, mind maps, org charts.
- What we compete on is not the number of types but **every type getting every layer** from one validated spec. We still take practices, but no code or visual identity, from archify and diagram-design.
- "Modes" are renamed **views**, since they are no longer only before/after states.

## Consequences

- A plain diagram request gets a plain diagram; the review features no longer get in the way.
- We now overlap more with archify and diagram-design. The pitch has to be clear: interactive system diagrams you can compare across versions and play a request through, from code or from a new design. Sync with the code is a supporting feature, not the headline.
- The runtime and layout split into per-type modules and per-layer modules, and `build` inlines only what a spec uses.
- The honesty rules still apply in full whenever the Review layer is on.
- The name "flowstory" may no longer fit (roadmap open question 7).

## Alternatives considered

- **Keep the review-only niche (ADR 0002).** Sharper positioning, but it turns away the most common request.
- **Systems plus data diagrams (ERD, class).** Views fit them, but playback rarely does; they'd break the "every type, every layer" rule.
- **Everything, including charts.** Direct competition with diagram-design on its strength.
