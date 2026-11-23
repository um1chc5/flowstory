# ADR 0002 · Focus on behavioural design review, not diagram breadth

- **Status:** superseded by [ADR 0005](0005-general-system-diagram-tool.md)
- **Date:** 2026-11-23

## Context

Two strong, popular diagram skills already exist:

- **archify** (~99k ★, Apache-2.0): interactive architecture diagrams, story playback, structural deltas, PR walkthroughs, video export. It deliberately avoids verdicts ("evidence, never a risk verdict").
- **diagram-design** (~70k ★, MIT): about 50 editorial diagram types with a strong visual system.

Competing on number of types or polish would mean rebuilding what they already do well. What neither does is show how one input *behaves* in the current system and in each proposed change, and then say which option is better and why.

## Decision

flowstory's niche is the **behavioural before/after**: the same scenario played through Today / Problems / Option A / Option B on one fixed layout, ending in a verdict, with problems, fixes, and a recommendation backed by evidence.

- v1 ships two diagram types (flow, sequence). New types are added only if scenarios and verdicts make sense on them.
- We take practices from both projects (listed in the handoff and in [04 · Architecture](../04-architecture.md)): data-only output, schema validation with fixable errors, atomic finalize, evidence pinned to a commit, geometry tests, lean SKILL.md with `references/`. We take **no code and no visual identity** from either.
- The same niche covers greenfield design. Comparing candidate architectures against the same scenarios is still a behavioural review; only the evidence kinds change.

## Consequences

- Clear answer to "why not archify?": use archify to see what a system looks like; use flowstory to decide what to change.
- We say no to ERDs, class diagrams, charts, and mind maps, even when asked.
- Verdicts are a responsibility. The honesty rules ([05 · Review and proposal](../05-proposal.md#honesty-rules)) exist because of this decision.

## Alternatives considered

- **A general diagram skill with a "proposal" add-on.** Splits effort, and loses to both incumbents on breadth.
- **A plugin for archify.** Ties us to another project's schema and roadmap, and archify's no-verdict stance conflicts with ours.
