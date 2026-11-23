# 04 · Architecture

## Skill folder

flowstory follows the open Agent Skills layout, so `npx skills add` and plugin hosts can install it as is.

```
skills/flowstory/
  SKILL.md                    lean entry point: when to use, the workflow, hard rules
  references/
    spec-schema.md            every field, with examples (03 · Spec format, in full)
    diagram-types.md          each type: when to use it, what lanes/rows mean, layout tips
    proposal.md               proposal.json, PROPOSAL.md sections, numbering rules
    storytelling.md           choosing scenarios, writing captions and chapters
    design.md                 visual rules: kinds, colours, status, motion
  assets/
    template.html             page shell with placeholders for CSS, JS, and data
    runtime/
      core.js                 state, canvas, render of nodes/edges/groups, pan/zoom, spotlight
      layers.js               views (rules, diff overlay), callouts, review (roles, verdicts)
      player.js               playback: steps, packets, camera, scrubber, motion policy
      types/flow.js           type modules: render hints per diagram type
      types/sequence.js
      sheet.js                deep-dive sheet
      story.js                story panel and proposal panel
      md.js                   safe inline-markup renderer
      flow.css                all styles, light + dark tokens
  scripts/                    Node ≥ 18, no dependencies
    validate.mjs
    layout.mjs
    build.mjs
    check.mjs
    serve.mjs
    lib/                      shared helpers (schema, geometry, git)
    lib/types/                one layout module per diagram type (flow.mjs, sequence.mjs)
    test/                     fixtures + adversarial geometry tests
    spec.schema.json
  examples/
    checkout-diagram/         core only: the smallest spec
    checkout-flow/            every layer: spec.json, proposal.json, checkout.html, PROPOSAL.md
    auth-sequence/            sequence + playback, greenfield (source: design)
.claude-plugin/plugin.json    plugin manifest (repo root)
```

**Why Node with no dependencies.** Any machine that runs an agent host almost certainly has Node. With no `npm install` step, there's nothing to fetch, pin, or audit, and the scripts run straight from the installed skill folder.

## Output folder

One folder per request, inside the user's project:

```
flowstory/<id>/
  spec.json                   source of truth (committed)
  proposal.json               optional (committed)
  results.json                optional benchmark data (committed)
  <id>.html                   the page (committed or attached to a PR)
  PROPOSAL.md                 optional, generated from proposal.json
.flowstory/                   scratch: candidates, layout cache, serve state (git-ignored)
```

The agent asks before writing outside `flowstory/`. If `flowstory/<id>/` already exists, it updates that folder instead of creating a new one.

## Pipeline

```
spec.json ─▶ validate ─▶ layout ─▶ build (candidate) ─▶ checks ─▶ final
                ▲                                         │
                └──────────── fixable errors ◀────────────┘
```

1. **validate**: schema + reference rules ([03 · Spec format](03-spec-format.md#validation)). Returns fixable JSON errors. The agent loops here until it's clean.
2. **layout**: grid → coordinates, edge routes, label positions. Writes `.flowstory/<id>/layout.json`.
3. **build**: inlines the runtime, the spec, and the layout into `template.html`. Writes a **candidate** to `.flowstory/<id>/candidate.html`.
4. **checks**: geometry checks on the layout, plus a smoke render (see below).
5. **finalize**: only if every check passes, the candidate is copied over `flowstory/<id>/<id>.html` in one rename. A failed build never overwrites the last good page.

`build.mjs` runs steps 1 to 5 by default; each script can also run alone.

## Runtime

The runtime is a small set of plain ES2019 scripts (no framework, no bundler) inlined into the page. `build` inlines only the modules the spec needs: a core-only diagram ships without the player, layers, or story code. Generated output never contains code: only the spec, the layout, and `proposal.json` as JSON blocks ([ADR 0001](adr/0001-data-only-output.md)).

```html
<script type="application/json" id="fs-spec">{ … }</script>
<script type="application/json" id="fs-layout">{ … }</script>
<script type="application/json" id="fs-proposal">{ … }</script>
<script>/* flowstory runtime 0.1.0 — md.js, core.js, layers.js, player.js, types/*.js, sheet.js, story.js */</script>
```

`build` escapes `</` inside the JSON so data can't close the script tag. The page carries a `<meta name="generator" content="flowstory 0.1.0">` tag so `check` and future versions can tell which runtime built it.

### Modules

| Module | Responsibility |
| --- | --- |
| `md.js` | Inline markup → DOM nodes (text nodes and a few allowed elements). Never uses `innerHTML` on spec text. |
| `core.js` | State, SVG render of lanes, groups, nodes, edges, and labels from `layout.json`; pan/zoom; spotlight; legend. Works with no layers at all. |
| `layers.js` · resolve | Pure functions: `visible(view)`, `resolveSteps(scenario, view)` (base → base chain → `byView`), `calloutsFor(step, view)`. Unit-tested in Node. |
| `layers.js` · render | View classes (`is-new`, `is-ghost`, `is-alt`), diff overlay, callout cards, verdict frame. Each layer mounts only if its data exists and its flag is on. |
| `player.js` | Step timer, packet animation along edge paths, camera tween, scrubber, URL hash, keyboard. Owns the motion policy. Not loaded into the page when there are no scenarios. |
| `types/*.js` | Per-type render hints: lifelines for sequence, state shapes later. A type module never re-implements layers. |
| `sheet.js` | Side sheet with the fixed sections; focus trap; `Esc` to close; back-history between entries. |
| `story.js` | Story panel and inline chapters; proposal panel with problem/option tables; benchmark slots. |

### State

One state object: `{ view, scenario, stepIndex, playing, speed, follow, view, focusNode }`. Every change goes through `set(patch)`, which re-renders only what changed and writes `view`, `scenario`, and `step` to the URL hash. Per-viewer preferences (`follow`, `speed`, story panel open) go to `localStorage`, wrapped in try/catch so the page works when storage is blocked.

### Accessibility

- Every node is a focusable button with an accessible name (`label, sub, status`).
- The caption is an `aria-live="polite"` region, so stepping announces the caption.
- Colour is never the only signal: status also shows an icon, and new/ghost also use outline style.
- The sheet is a dialog with a focus trap and restores focus on close.
- With `controls: none`, keyboard controls still work.

## layout.mjs

Input: lanes, groups, nodes (all views combined), edges, and type. Output: node boxes, group boxes, edge polylines, label anchors, canvas size.

`layout.mjs` is a dispatcher. Each diagram type has a module in `scripts/lib/types/` that turns the spec into boxes and routes. Routing, label placement, and the geometry checks are shared. Adding a type means adding a layout module, a runtime type module, adversarial fixtures, and a section in `references/diagram-types.md`. Nothing else changes.

v1 ships flow and sequence. State machine, pipeline/DAG, and deployment follow ([06 · Roadmap](06-roadmap.md)).

**Flow layout**

1. Lanes become columns in declared order; widths come from their widest node label.
2. Rows become y positions per lane. Spacing is uniform across lanes, so row 1 lines up everywhere.
3. Edges are routed **orthogonally** on a sparse grid of channels between nodes (A* with penalties for bends, crossings, and length). Edges that share an endpoint side get spread apart along that side.
4. Lane gaps widen to fit the labels of edges between neighbouring lanes. Lane and group titles are obstacles for routing and labels.
5. Labels: candidate positions along each route (centre of the longest segment first, then others), scored for overlap with nodes, other labels, and other edges. Pick greedily, highest-degree edges first.
6. Manual `x`/`y` and `pts` are fixed obstacles that routing goes around.

**Sequence layout**

Lanes become participants spaced evenly. Edges are the messages, one row each, in declaration order (or by an explicit `order`), so a sequence diagram works with no playback. With playback, a step highlights the messages its packets travel on, and the whole sequence stays visible. Lifelines are drawn for the full height; participants hidden in a view are drawn as ghost lifelines or removed, depending on the rule.

Because layout runs over the union of all views, **nothing moves when the view changes**. That's the core promise, and it's tested.

### Geometry checks

`layout.mjs --check` (and `build`) fails on:

| Check | Rule |
| --- | --- |
| `node-overlap` | No two node boxes overlap (with a minimum gap) |
| `edge-through-node` | No edge segment crosses a node box other than its own endpoints |
| `label-overlap` | No label overlaps a node, a lane or group title, or another label visible in the same view |
| `label-detached` | Every label touches its own edge (within 6 px), unless placed by hand with `labelAt` |
| `edge-through-header` | No edge crosses a lane or group title |
| `label-off-canvas` | Every label is inside the canvas |
| `edge-detached` | Every edge starts and ends on its nodes' borders |
| `view-stable` | Each node's box is identical in every view where it's visible |

Overlap checks run **per view**, against only what that view shows. Two labels may share space if they never appear together.

### Adversarial tests

`scripts/test/` holds fixture specs that are designed to break layout: ten edges into one node, long labels, a node in every lane on one row, parallel edges, edges between neighbours with no gap, a view that adds a node in the middle of a busy row. Each fixture must either lay out cleanly or fail with a specific check code. A layout change that turns a passing fixture into a failing one fails CI.

## check.mjs

Keeps a spec in sync with the code.

```
node scripts/check.mjs flowstory/checkout/spec.json [--strict] [--json]
```

| Check | When `source: "code"` | When `source: "design"` |
| --- | --- | --- |
| Internal references (same as `validate`) | ✓ | ✓ |
| Every verdict has evidence | ✓ | ✓ |
| Cited file exists at HEAD | ✓ | — |
| Cited line range is inside the file | ✓ | — |
| `anchor` text found in the range (±10 lines tolerance, reported as moved) | ✓ | — |
| `evidence: "required"` elements have a citation | ✓ | — |
| **Drift**: cited files changed between `evidence.commit` and HEAD (`git diff --name-only`) | warning (`--strict`: error) | — |

When drift is found, the report lists each affected node, edge, and problem with the changed file, so the agent (or a person) knows which parts of the diagram to re-check. After re-verifying, the agent updates `evidence.commit` ([ADR 0004](adr/0004-evidence-pinned-to-commit.md)).

## serve.mjs

Live preview while the agent or a person edits the spec.

- Watches `spec.json`, `proposal.json`, and `results.json`; on change runs validate → layout → build.
- Serves the **last good build** at `http://localhost:<port>/`. A failing build shows an error banner over the last good page instead of a broken page.
- Reloads the browser on a successful build, keeping view, scenario, and step via the URL hash.
- Binds to `127.0.0.1` only.

## Size budget

| Part | Target |
| --- | --- |
| Runtime JS (unminified) | ≤ 60 KB |
| CSS | ≤ 20 KB |
| Typical spec (checkout example) | ≤ 40 KB |
| Whole page | ≤ 150 KB, one file, no network requests |

No web fonts, no CDN. System font stack; icons are inline SVG paths in the runtime.
