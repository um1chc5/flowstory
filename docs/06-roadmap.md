# 06 · Roadmap

## v1 scope

| Area | In v1 |
| --- | --- |
| Diagram types | flow, sequence |
| Canvas | lanes/rows grid, per-mode rules, pan/zoom, hover spotlight, legend from kinds |
| Behaviour | modes × scenarios → steps, `byMode` overrides, verdicts, callouts by id with mode roles |
| Reading | deep-dive sheet, story panel (panel / inline), URL hash deep links |
| Proposal | `proposal.json` → Proposal view + `PROPOSAL.md`, honesty rules, benchmark slots |
| Sources | `code` (traced from a repo) and `design` (greenfield) |
| Scripts | validate, layout, build, check, serve; geometry checks + adversarial tests |
| Packaging | one `.html` output; Agent Skills layout; `.claude-plugin` manifest |
| Examples | checkout-flow (code-style, full preset), auth-sequence (walkthrough preset) |

## Milestones

Each milestone ends with something that runs.

**M0 · Runtime from a hand-written spec**
Port the reference page's player, sheet, and story into the data-driven runtime. Hand-written `checkout` spec with manual coordinates. Done when the checkout example plays all four scenarios in three modes from JSON alone.

**M1 · Declarative steps + validate**
`resolveSteps` with `byMode`, `base` chains, `in`/`skipIn`; callout roles; verdicts. `validate.mjs` with stable error codes and `fix` hints. Unit tests for resolution. Done when every validation rule in [03](03-spec-format.md#validation) has a failing and a passing fixture.

**M2 · Layout**
`layout.mjs` for flow and sequence, geometry checks, adversarial fixtures. Coordinates removed from the checkout spec. Done when checkout lays out with no manual coordinates and every fixture passes or fails with the expected code.

**M3 · Build, finalize, serve**
`build.mjs` with candidate → checks → final; `serve.mjs` with last-good-build. Size budget enforced. Done when a broken spec edit during `serve` shows an error banner over the last good page.

**M4 · Proposal**
`proposal.json`, Proposal view, `PROPOSAL.md`, honesty rules, `results.json`. Done when the checkout example produces a proposal doc whose ids match the page, and removing a problem's evidence fails the build.

**M5 · Sync + skill**
`check.mjs` with drift detection; final `SKILL.md` and `references/`; the second example (auth-sequence, greenfield). Done when an agent with only the skill installed can produce the checkout page from a sample repo in one session, and `check` catches a renamed file.

**M6 · Release prep**
Final name, license, README screenshots/GIF, plugin manifests, a short demo video recorded by hand.

## Later

| Idea | Notes |
| --- | --- |
| More diagram types | state machine, pipeline/DAG, deployment zones, rollout timeline ([02](02-features.md#diagram-types)) |
| Mermaid import | flowchart/sequence → a starter spec (structure only; scenarios still authored) |
| PR companion skill | given a diff, update the spec's proposal mode and post the page link on the PR |
| Video / GIF export | headless capture of one scenario across modes |
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
| 4 | Should `design` specs allow a `today` mode at all? | Yes, as "current plan", but `role: baseline` is enough; no special case |
| 5 | How strict should drift be by default? | Warning locally, `--strict` in CI |
| 6 | Sequence diagrams: draw messages per step, or the whole scenario at once with the active step highlighted? | Whole scenario, active highlighted: easier to read |
