# 06 · Roadmap

## v1 scope

| Area | In v1 |
| --- | --- |
| Diagram types | flow, sequence; layout and runtime split into per-type modules so more types plug in |
| Core | lanes/rows grid, groups, kinds + legend, pan/zoom, spotlight, deep-dive sheet, story panel, URL hash deep links |
| Views | per-view rules, diff overlay, fixed layout across views |
| Playback | scenarios → steps, `byView` overrides, player, motion policy |
| Callouts | notes, risks, questions; problems and fixes |
| Review | view roles, verdicts, `proposal.json` → Proposal panel + `PROPOSAL.md`, honesty rules, benchmark slots |
| Sync | `code` evidence pinned to a commit, `check` with drift; `design` specs supported |
| Scripts | validate, layout, build, check, serve; geometry checks + adversarial tests |
| Packaging | one `.html` output, only the runtime modules a spec needs; Agent Skills layout; `.claude-plugin` manifest |
| Examples | checkout-diagram (core only), checkout-flow (every layer), auth-sequence (sequence, greenfield) |

## Milestones

Each milestone ends with something that runs. Core comes first, then layers one at a time, so a plain diagram works before anything else.

**M0 · Core diagram**
`layout.mjs` (flow), geometry checks, adversarial fixtures, `core.js`, sheet, and a minimal `build.mjs`. Done when the smallest checkout spec ([03](03-spec-format.md#the-smallest-spec)) builds into a clean static page with no manual coordinates.

**M1 · validate + sequence**
`validate.mjs` with stable error codes and `fix` hints; the sequence type module. Done when every core validation rule has a failing and a passing fixture, and an auth sequence lays out cleanly.

**M2 · Views + playback**
Per-view rules, diff overlay, `resolveSteps` with `byView`, `base` chains, `in`/`skipIn`; player and motion policy, using the reference page's player as a UX guide. Done when the checkout example plays all four scenarios in three views from JSON alone, and no node moves between views.

**M3 · Callouts + review**
Notes; problems and fixes with view roles; verdicts; `proposal.json`, Proposal panel, `PROPOSAL.md`, honesty rules, `results.json`. Done when the checkout proposal doc's ids match the page, and removing a problem's evidence fails the build.

**M4 · Build, finalize, serve, sync**
Candidate → checks → final; `serve.mjs` with last-good-build; per-spec module inlining; size budget; `check.mjs` with drift. Done when a broken spec edit during `serve` shows an error banner over the last good page, and `check` catches a renamed file.

**M5 · Skill**
Final `SKILL.md` and `references/`, the three examples. Done when an agent with only the skill installed picks the right preset for "draw", "compare", "explain", and "propose", and builds the checkout pages from a sample repo in one session.

**M6 · Release prep**
Final name, license, README screenshots/GIF, plugin manifests, a short demo video recorded by hand.

**v1.1 → v1.3 · More types**
State machine, then pipeline/DAG, then deployment. Each one is a layout module, a runtime type module, fixtures, and a reference section.

## Later

| Idea | Notes |
| --- | --- |
| More diagram types | state machine (v1.1), pipeline/DAG (v1.2), deployment with nested zones (v1.3) ([02](02-features.md#diagram-types)) |
| Mermaid import | flowchart/sequence → a starter spec (structure only; scenarios still authored) |
| PR companion skill | given a diff, update the spec's proposal view and post the page link on the PR |
| Video / GIF export | headless capture of one scenario across views |
| Brand theming | token overrides for colours and fonts |
| Sim library | a few reviewed sims (retry/backoff, queue depth, cache hit rate) |
| Comments | reviewers comment on steps and callouts; needs a host, so it's optional |
| Other host manifests | `.codex-plugin` and others, once the core is stable |

## Open questions

| # | Question | Leaning |
| --- | --- | --- |
| 1 | Final name. `flowstory` may collide with existing projects. | Search npm, GitHub, and skill registries before M6 |
| 2 | License | MIT, unless a dependency-free runtime makes Apache-2.0's patent grant worth it |
| 3 | Other host manifests in v1? | No. Ship the Agent Skills layout + `.claude-plugin`; add others after feedback |
| 4 | Should `design` specs allow a `today` view at all? | Yes, as "current plan", but `role: baseline` is enough; no special case |
| 5 | How strict should drift be by default? | Warning locally, `--strict` in CI |
| 6 | Sequence diagrams: draw messages per step, or the whole scenario at once with the active step highlighted? | Whole sequence, active highlighted: easier to read, and works with no playback |
| 7 | Does the name still fit? "flowstory" stresses playback, which is now one layer of a general system-diagram tool | Revisit with question 1 |
