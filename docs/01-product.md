# 01 · Product

## One line

**A diagram tool for software systems, where every diagram can have views shown as diffs and scenarios that play through it, all built from one validated data spec that can be checked against the code.**

Ask for a diagram and you get a clean, static one. Add views, playback, callouts, or a proposal only when they help.

## Who it's for

| Person | What they want |
| --- | --- |
| **Any engineer** | A correct diagram of a flow, a sequence, a state machine, a pipeline, or a deployment, without hand-placing boxes |
| **Engineer proposing a change** | The same diagram before and after, plus a short argument, without a 10-page doc nobody reads |
| **Architect / designer (greenfield)** | Sketch candidate architectures and compare them on the same requirements |
| **Tech lead / reviewer** | See the current system, the failure, and the fix side by side, then decide |
| **New team member** | Follow one request through the system and land on the right files |
| **On-call / incident owner** | Replay what went wrong and show what changes |
| **Non-engineers (PM, lead)** | Follow a moving packet instead of reading a sequence diagram |

## Use cases

Ordered from plain diagram to full review. Each one adds layers on top of the one before.

1. **Document a system.** "Draw how checkout works", "show our deployment". One static view, deep dives into the code. *(core)*
2. **Show layers or versions.** Logical vs physical, v1 vs v2, "with cache" vs "without". Several views on one layout, shown as a diff. *(+ views)*
3. **Onboarding walkthrough.** Play a request through the system step by step. *(+ playback)*
4. **Annotate.** Pin notes, risks, or questions to nodes. *(+ callouts)*
5. **Incident postmortem.** Replay the failing scenario, with the fix in a second view. *(+ views, playback, callouts)*
6. **Design review / RFC.** Today → Problems → Option A → Option B, each scenario ending in a verdict, plus `PROPOSAL.md`. *(+ review)*
7. **Greenfield design / brainstorm.** No code yet. Views are candidate architectures, scenarios are the requirements that matter ("10× traffic", "provider outage"), and evidence is `doc`, `measurement`, or `assumption`. *(any layers; `source: design`)*
8. **Living documentation.** The spec lives in the repo; `check` fails when the code drifts away from it. *(+ sync)*

## What you get

- **A diagram computed from data.** Nodes on a grid, edges routed and labelled automatically, geometry checked by scripts. No hand-placed coordinates, no overlapping labels.
- **Diagrams traced from code, or designed from scratch.** With a repo, nodes and edges are real and cite file paths. Without one, assumptions are labelled as such.
- **Views shown as diffs.** Nodes keep their positions across views, so added, removed, and changed parts stand out.
- **Playback.** Optional scenarios move packets along edges, step by step, with captions.
- **Callouts.** Optional notes pinned to nodes: plain notes, or problems and fixes with types and ids.
- **Review.** Optional verdicts per scenario and view, a recommendation, and a `PROPOSAL.md` that shares ids with the diagram.
- **Deep-dive sheet.** The same sections for every node: role · how it works · in the code · weak points · read more.
- **One `.html` file.** Open it by double-clicking, attach it to a PR, or send it to a reviewer. Works offline, has no build step, and needs no hosted service.

## Positioning vs. existing skills

| | archify | diagram-design | **flowstory** |
| --- | --- | --- | --- |
| Focus | Interactive architecture explainers | Editorial diagrams in many styles | **Diagrams of software systems that can diff and play** |
| Diagram types | ~10 | ~50, including charts | **System types only**: flow, sequence, state machine, pipeline/DAG, deployment (v1: flow + sequence) |
| Before/after | Structural delta | Structural delta | **Views on one fixed layout**, for *every* type, plus the same scenario played through each view |
| Source of truth | Generated page + schema | Generated page | **One data spec**, validated, with a fixed reviewed runtime |
| Code sync | Evidence pinned to a commit | No | **Yes**: `check` fails on drift |
| Verdicts / proposal | No, on purpose | No | **Optional layer** |

What we compete on is not the number of types. It's that every type gets the same layers (views, playback, callouts, review, sync) from the same spec. We learn from both projects (see [ADR 0005](adr/0005-general-system-diagram-tool.md)) but share no code and no visual identity with either.

## Principles

1. **Plain by default.** A diagram request gets a diagram. Layers appear only when asked for or clearly useful.
2. **Truth before spectacle.** Every packet travels along a declared edge. Every claim cites evidence of a stated kind (`code`, `doc`, `measurement`, `assumption`). Unmeasured numbers are labelled *illustrative*; verdicts resting only on assumptions are labelled *assumed*.
3. **One layout, many views.** View changes must read as a diff. Positions stay fixed.
4. **Honest when opinionated.** When the review layer is on, we recommend, and we show what each option doesn't fix.
5. **Calm motion.** Motion is controlled by the reader, finite, and respects `prefers-reduced-motion`. The page never loops to grab attention.
6. **Portable.** One HTML file. The runtime is fixed and reviewed; generated files contain only data.
7. **Every type, every layer.** A new diagram type is only added if views and playback make sense on it.

## Non-goals

- Data and object diagrams (ERD, class), charts, mind maps, org charts, and other non-system diagrams. Use archify or diagram-design.
- A WYSIWYG editor.
- Automatic risk scoring. A verdict always comes from an authored scenario plus evidence.
- Pixel-perfect brand theming (maybe later).
