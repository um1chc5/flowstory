# 02 · Features

flowstory is a diagram tool for software systems. Every diagram has the same **core**. On top of it are optional **layers**, each switched on by adding its data to the spec (and switched off with a feature flag). One spec feeds the page, the proposal doc, and the drift check, so they never disagree.

```
┌───────────────────────────────────────────────────────────┐
│ Sync      code evidence pinned to a commit · check drift  │  optional
│ Review    verdicts · problems/fixes · PROPOSAL.md         │  optional
│ Callouts  notes, risks, questions pinned to nodes         │  optional
│ Playback  scenarios → steps → packets on edges            │  optional
│ Views     one layout, several versions shown as a diff    │  optional
├───────────────────────────────────────────────────────────┤
│ Core      nodes · edges · layout · deep dives · one HTML  │  always
└───────────────────────────────────────────────────────────┘
```

| Layer | Turned on by | Needs |
| --- | --- | --- |
| **Core** | always | — |
| **Views** | more than one entry in `views` | core |
| **Playback** | `scenarios` | core |
| **Callouts** | `notes`, or `problems` / `fixes` | core |
| **Review** | `verdict` on scenarios, `problems` + `fixes`, or `proposal.json` | views + playback (+ callouts) |
| **Sync** | `"source": "code"` + `evidence.commit` | core |

The running example in every doc is **order checkout**:

- Nodes: `client` → `api` → `payments` (external provider) → `queue` → `worker` → `db`
- Scenarios: *normal order* · *payment timeout* · *double submit* · *flash-sale spike*
- Views: *Today* · *Problems* · *Proposal* (transactional outbox + idempotency keys)

The smallest useful checkout spec is just the core: six nodes, their edges, and nothing else. Every section below adds to that.

### Existing code or a blank page

flowstory works on both. With a repo (`"source": "code"`), the agent traces nodes and edges from the code and cites files. With no repo (`"source": "design"`) it's a design and brainstorming tool: views are candidate architectures, the first view can be a simple first version instead of "Today", and evidence is `doc`, `measurement`, or `assumption`. Anything that rests only on assumptions is marked, so a whiteboard idea never looks like a measured result.

---

## Core

### Canvas

- **Lanes and rows.** Nodes are placed on a grid (`lane`, `row`) rather than by coordinates. `layout.mjs` turns the grid into positions, routes edges orthogonally, and places labels. Hand-written `pts` on an edge is an escape hatch. Each diagram type defines what lanes and rows mean (see [Diagram types](#diagram-types)).
- **Kinds.** Each node has a `kind` (client, service, external, queue, worker, store, …) which sets its icon and colour token and builds the legend automatically.
- **Groups.** Nodes can sit inside a labelled group box (a bounded context, a VPC, a team). Used heavily by the deployment type.
- **Pan and zoom** like a design canvas: drag, wheel or pinch zoom, fit-to-screen, keyboard (`+` `-` `0` and arrows).
- **Hover spotlight.** Hovering a node dims everything not connected to it. Clicking pins the spotlight.

### Deep-dive sheet

Clicking a node (or a callout, or "Learn more") opens a side sheet. Every node uses the same five sections, so readers know where to look:

1. **Role**: what it does, in one paragraph
2. **How it works**: the mechanism
3. **In the code**: file paths with line ranges, pinned to the evidence commit when Sync is on ([ADR 0004](adr/0004-evidence-pinned-to-commit.md))
4. **Weak points**: free text, or links to problem ids when Review is on
5. **Read more**: external links

All sections are optional; empty ones are hidden. With `deepDive: false`, nodes aren't clickable.

### Story panel

An optional floating panel of **chapters**. Each chapter has a title and a short body, and can set the view, scenario, and step. Back / Next walks the reader through the diagram: *The big picture → The API → The async part*. On narrow screens it becomes a bottom drawer. `story: inline` renders the chapters as a column beside the canvas instead. Story works with just the core (chapters can focus the camera on nodes); it gets more useful with views and playback.

### Output

One `.html` file: no network, no build step, opens by double-click. `chrome: embed` gives a fixed-height block for iframes and docs.

---

## Layer · Views

A **view** is a version of the same diagram: Today vs Proposal, v1 vs v2, logical vs physical, "with cache" vs "without", Option A vs B.

- **Fixed layout across views.** Layout runs once over the union of every element in every view. Switching views never moves a node; it only changes how elements look. Each node, edge, and group can carry per-view rules:

  | Rule | Meaning | Checkout example |
  | --- | --- | --- |
  | `only: [views]` | Exists only in these views | `outbox` table only in `proposal` |
  | `hideIn: [views]` | Hidden in these views | the direct `api>queue` publish is hidden in `proposal` |
  | `newIn: [views]` | Drawn as *new* (green outline) | `outbox`, `relay`, `idem` in `proposal` |
  | `ghostIn: [views]` | Drawn faded and dashed: "this goes away" | `api>queue` in `proposal`, if you'd rather show it removed than hide it |
  | `altIn: [views]` | Uses the `alt` label in these views | `api` reads "Orders API · checks Idempotency-Key" in `proposal` |

  So Today → Proposal reads as a diff: green is added, faded is removed, everything else stays where it was.

- A view switcher appears in the toolbar. `D` toggles a **diff overlay** that marks every change from the previous view.
- Views have a `role` (`baseline`, `critique`, `option`). Roles only matter to the Review layer; without it, every view is just a view.

## Layer · Playback

A **scenario** is an input that moves through the diagram: a normal order, a payment timeout, a login. A scenario is a list of **steps**. With views on, every (view, scenario) pair resolves to its own step list.

The steps are declarative: one base list per scenario, plus `byView` patches. The author writes "in the proposal, step 3 sends to `outbox` instead of `queue`", not a separate script per view. See [03 · Spec format](03-spec-format.md#scenarios-and-steps-playback-layer).

A step can set:

| Field | What the reader sees |
| --- | --- |
| `active` | Nodes highlighted for this step |
| `packets` | Labelled dots that travel along edges (`order #42`, `charge`, `retry`) |
| `badges` | Small tags on nodes (`2 charges`, `queue depth ~40k`) |
| `status` | Node colour: `ok`, `warn`, `bad`, `new` |
| `callouts` | Callout ids to show on this step (needs the Callouts layer) |
| `camera` | Which nodes to frame. Defaults to the active nodes. |
| `caption` | One or two sentences under the canvas |
| `deep` | Which deep dive "Learn more" opens |

### Player

- Play / pause, step back / forward, a scrubber with one tick per step, and speed (0.5× / 1× / 2×).
- The camera follows the active step (`camera: follow`), or stays put (`static`). The reader can turn follow off, and that choice is remembered for this viewer.
- **Motion policy** ([ADR 0003](adr/0003-motion-policy.md)): autoplay at most once per page load, never loop, and pause when the tab is hidden. With `prefers-reduced-motion`, steps change instantly and packets appear at the middle of their edge instead of travelling.
- Keyboard: `Space` play/pause, `←` `→` step, `V` next view, `S` next scenario, `Esc` closes the sheet.
- The URL hash holds `view`, `scenario`, and `step`, so a link opens the exact frame (`#view=proposal&scenario=double-submit&step=3`).

## Layer · Callouts

Cards pinned to a node: a note, a risk, a question. Declared once with an id, shown in chosen views or on chosen steps.

| Kind | Id | Use |
| --- | --- | --- |
| `note` | `N1` | Explanation, context, "this is where retries happen" |
| `risk` | `N2` | Something worth worrying about, without the full Review layer |
| `question` | `N3` | Open question for reviewers |
| `problem` | `P1` | Review layer: a weakness with a type and evidence |
| `fix` | `F1` | Review layer: what solves a problem in an option view |

Without playback, callouts show statically in the views listed in their `in`. With playback, a step lists the ids it touches. Problem types are fixed and colour-coded: **performance**, **correctness**, **security**, **ops**.

## Layer · Review

The opinionated layer: problems, fixes, verdicts, a recommendation, and a proposal doc. It's what turns a diagram into a design review. Details in [05 · Review and proposal](05-proposal.md).

### Problem and fix callouts follow the view's role

A step lists the problem ids it touches. What shows depends on the view's **role**:

| View role | Callout shown for `P2` |
| --- | --- |
| `baseline` (Today) | nothing, or a subtle marker if `features.callouts` is `always` |
| `critique` (Problems) | the problem card for `P2` |
| `option` (A, B, Proposal) | the fix card for whichever fix in this view `solves: [P2]`, or an **"unsolved"** card if none does |

The "unsolved" card is an honesty rule: an option must show what it *doesn't* fix.

### Verdicts

The last frame of a scenario is a **verdict**: a per-view outcome (`ok` / `warn` / `bad`), a short label, and a one-line reason with evidence. *Double submit*: Today → **bad**, "customer charged twice". Proposal → **ok**, "second request returns the first result". A verdict backed only by assumptions is tagged **assumed**.

### Proposal

`proposal.json` adds the argument around the diagram: context, options, trade-offs, recommendation, rollout, risks, open questions, and the decision asked for. The build renders it as a **Proposal panel** in the page and as **`PROPOSAL.md`**. Ids (`P2`, `F1`) are the same in the doc, on the canvas, and in the deep dive. Unmeasured numbers are rendered as *illustrative*; benchmark slots show **"waiting for data"** until `results.json` exists.

## Layer · Sync

`check.mjs` keeps a code-traced spec honest after the code moves on. It fails when:

- a cited file no longer exists, or a cited line range is past the end of the file;
- a cited `anchor` (a symbol or string expected in that range) can't be found;
- a node or edge marked `evidence: required` has no citation;
- files cited by the spec changed since the evidence commit (reported as **drift**, a warning by default, or an error with `--strict`).

For a `"source": "design"` spec, `check` runs only the internal checks (ids, references, every verdict has evidence) and skips the repo checks. Switching `source` to `"code"` turns them on. It prints a human report or `--json` and exits non-zero on failure, so it can run in CI. Details in [04 · Architecture](04-architecture.md#checkmjs).

---

## Diagram types

flowstory covers **diagrams of software systems**: things that have parts, connections, and something that moves through them. A type is only added if views and playback both make sense on it.

| Type | v1 | Lanes / rows mean | What playback moves | Views typically show |
| --- | --- | --- | --- | --- |
| **flow** | ✅ | layers or tiers / position in the flow | requests and events along edges | before/after, options |
| **sequence** | ✅ | participants / time (edges are messages, in order) | highlights the messages of each step | new or removed participants and messages |
| **state machine** | later | — (auto layout of states) | the current state, along transitions | added states, changed transitions |
| **pipeline / DAG** | later | stages left to right / parallel branches | batches or jobs | added stages, re-wired branches |
| **deployment** | later | groups (region, VPC, cluster) nest nodes | a request crossing zones | target vs current topology |

Each type is a module in the runtime with its own layout rules and render hints. Everything else (views, playback, callouts, review, sync, sheet, story) is shared, so a new type gets every layer for free.

Out of scope: ERD, class diagrams, charts, mind maps, org charts, and other non-system diagrams. Use archify or diagram-design for those.

---

## Feature flags

The spec's `features` block switches parts of the page on and off. Every flag has a default from the chosen preset. A layer with no data stays off whatever the flag says.

| Flag | Values | What it controls |
| --- | --- | --- |
| `views` | list of view ids | Which views appear in the switcher, in order |
| `playback` | `auto` · `manual` · `off` | `auto` plays once on load (motion policy permitting). `off` hides scenarios and shows the plain diagram. |
| `scenarios` | `true` · `false` · list of ids | Show the scenario picker, or limit it |
| `callouts` | `true` · `false` · `always` | `always` also marks problems in baseline views |
| `review` | `true` · `false` | Verdicts, problem/fix roles, proposal panel |
| `deepDive` | `true` · `false` | Clickable nodes and the sheet |
| `story` | `panel` · `inline` · `off` | Story chapters |
| `camera` | `follow` · `static` | Auto-framing of active nodes |
| `controls` | `full` · `minimal` · `none` | `minimal` = play/pause + scrubber; `none` = keyboard and story only |
| `theme` | `auto` · `light` · `dark` | `auto` follows the OS |
| `sims` | `true` · `false` | Mount sims, or show their static fallback |
| `chrome` | `app` · `embed` | `app` is a full-page canvas with a toolbar; `embed` is a fixed-height block with no page header |

## Presets

The agent picks a preset from what the user asked for, then overrides single flags if needed. **`diagram` is the default.**

| Preset | Typical request | Layers | playback | story | controls | chrome |
| --- | --- | --- | --- | --- | --- | --- |
| `diagram` | "draw how checkout works", "diagram our deployment" | core (+ callouts as notes) | off | off | none | app |
| `compare` | "show v1 vs v2", "with and without the cache" | core + views (+ callouts) | off | off | minimal | app |
| `walkthrough` | "explain / onboard me on checkout" | core + playback (+ callouts) | auto | panel | full | app |
| `review` | "what's wrong with checkout?" | views + playback + callouts + review (no proposal) | manual | panel | full | app |
| `full` | "propose a fix for double charges", "compare these architectures and recommend one" | all | manual | panel | full | app |
| `embed` | "put it in our docs page" | as spec | manual | off | minimal | embed |

## Optional sims

Some ideas are easier to show with a small interactive toy than with packets: a retry/backoff timeline, a queue-depth slider. A sim is a plugin with one function, `mount(host, options)`, registered by id and placed in a chapter or deep dive with `{ "sim": "retry-backoff" }`. Sims are part of the reviewed runtime, not generated code ([ADR 0001](adr/0001-data-only-output.md)). v1 ships the interface and one example sim; it ships no sim library.
