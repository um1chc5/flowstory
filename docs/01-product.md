# 01 · Product

## One line

**Turn a system and a proposed change into an interactive design review: what happens today, where it breaks, how each option fixes it, and what to decide.**

## Who it's for

| Person | What they want |
| --- | --- |
| **Engineer proposing a change** | Convince a lead or team quickly, without a 10-page doc nobody reads |
| **Tech lead / reviewer** | See the current system, the failure, and the fix side by side, then decide |
| **New team member** | Follow one request through the system and land on the right files |
| **On-call / incident owner** | Replay what went wrong and show what changes |
| **Non-engineers (PM, lead)** | Follow a moving packet instead of reading a sequence diagram |

## Use cases

1. **Design review / RFC.** Today → Problems → Option A → Option B → Decision.
2. **Architecture proposal to a lead.** The original use case: one page, a recommendation, and a list of things to decide.
3. **Onboarding walkthrough.** One mode, a few scenarios, deep dives into the code.
4. **Incident postmortem.** The failing scenario replayed, with the fix in a second mode.
5. **Living documentation.** The spec lives in the repo; `check` fails when the code drifts away from it.
6. **Greenfield design / brainstorm.** No code yet. Modes are candidate architectures (Option A · B · C), scenarios are the requirements that matter ("10× traffic", "provider outage"), and each verdict cites `doc`, `measurement`, or `assumption` evidence instead of code. Verdicts that rest only on assumptions are labelled so. When code exists, the same spec can switch to code evidence and become living docs (use case 5).

## What the developer gets

- **A map traced from the code.** Components grouped by layer, calls that really exist, and file paths in every deep dive.
- **A before/after diff on one layout.** Nodes keep their positions across modes, so changes stand out instead of being redrawn.
- **Scenario playback with verdicts.** Shows the *behaviour* of a specific input in each mode, not only the structure.
- **Problem and fix callouts.** Each weakness is pinned to the node where it happens, has a type, and shares an id with the proposal doc.
- **Deep-dive sheet.** The same five sections for every node: role · how it works · in the code · weak points · read more.
- **One `.html` file.** Open it by double-clicking, attach it to a PR, or send it to a reviewer. Works offline, has no build step, and needs no hosted service.

## Positioning vs. existing skills

| | archify | diagram-design | **flowstory** |
| --- | --- | --- | --- |
| Core question | "What does this system look like?" | "How do I draw this beautifully?" | **"What happens to this input, where does it break, which option fixes it?"** |
| Diagram types | ~10, interactive | ~50, editorial | **2** (flow, sequence). Deliberately few. |
| Before/after | Structural delta | Structural delta | **Behavioural**: the same scenario played through each mode |
| Verdicts | No, on purpose ("evidence, never a risk verdict") | No | **Yes**, backed by evidence |
| Proposal doc | Explainer pages | No | **Yes**, sharing ids with the diagram |

We learn from both (see [ADR 0002](adr/0002-design-review-niche.md)) but share no code and no visual identity with either.

## Principles

1. **Truth before spectacle.** Every packet travels along a declared edge. Every claim cites evidence of a stated kind (`code`, `doc`, `measurement`, `assumption`). Numbers we haven't measured are labelled *illustrative*; verdicts resting only on assumptions are labelled *assumed*.
2. **One layout, many modes.** Mode changes must read as a diff. Positions stay fixed.
3. **Opinionated but honest.** We recommend, and we show what each option doesn't fix.
4. **Calm motion.** Motion is controlled by the reader, finite, and respects `prefers-reduced-motion`. The page never loops to grab attention.
5. **Portable.** One HTML file. The runtime is fixed and reviewed; generated files contain only data.
6. **Small.** A few diagram types done well, rather than many done adequately.

## Non-goals

- A general diagram library (ERD, class, charts, mind maps…). Use archify or diagram-design.
- A WYSIWYG editor.
- Automatic risk scoring. A verdict always comes from an authored scenario plus evidence.
- Pixel-perfect brand theming (maybe later).
