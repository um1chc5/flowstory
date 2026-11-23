# 02 · Features

flowstory does three jobs. They share one spec, so the diagram, the proposal doc, and the drift check never disagree.

| Job | Input | Output | Script |
| --- | --- | --- | --- |
| **1 · Diagram** | `spec.json` | `<id>.html` | `validate` → `layout` → `build` |
| **2 · Proposal** | `spec.json` + `proposal.json` (+ `results.json`) | `<id>.html` with a proposal view, and `PROPOSAL.md` | same, plus the proposal pass |
| **3 · Sync** | `spec.json` + the repo | pass / fail report | `check` |

The running example in every doc is **order checkout**:

- Nodes: `client` → `api` → `payments` (external provider) → `queue` → `worker` → `db`
- Scenarios: *normal order* · *payment timeout* · *double submit* · *flash-sale spike*
- Modes: *Today* · *Problems* · *Proposal* (transactional outbox + idempotency keys)

---

### Existing code or a blank page

flowstory works on both. With a repo (`"source": "code"`), the agent traces nodes and edges from the code and cites files. With no repo (`"source": "design"`) it's a design and brainstorming tool: modes are candidate architectures, the first mode can be a naive v0 instead of "Today", and evidence is `doc`, `measurement`, or `assumption`. The page marks any verdict that rests only on assumptions as **assumed**, so a whiteboard idea never looks like a measured result.

---

## Job 1 · Diagram

### The canvas

- **Fixed layout across modes.** Layout runs once over the union of every element in every mode. A mode switch never moves a node; it only changes how elements look. Each node and edge can carry per-mode rules:

  | Rule | Meaning | Checkout example |
  | --- | --- | --- |
  | `only: [modes]` | Exists only in these modes | `outbox` table only in `proposal` |
  | `hideIn: [modes]` | Hidden in these modes | the direct `api>queue` publish is hidden in `proposal` |
  | `newIn: [modes]` | Drawn as *new* (green outline) | `outbox`, `relay`, `idem-store` in `proposal` |
  | `ghostIn: [modes]` | Drawn faded and dashed: "this goes away" | `api>queue` in `proposal`, if you'd rather show it removed than hide it |
  | `altIn: [modes]` | Uses the `alt` label in these modes | `api` reads "API · checks idempotency key" in `proposal` |

  So Today → Proposal reads as a diff: green is added, faded is removed, everything else stays where it was.

- **Lanes and rows.** Nodes are placed on a grid (`lane`, `row`) rather than by coordinates. `layout.mjs` turns the grid into positions, routes edges orthogonally, and places labels. Hand-written `pts` on an edge is still allowed as an escape hatch.
- **Kinds.** Each node has a `kind` (client, service, external, queue, worker, store, …) which sets its icon and colour token and builds the legend automatically.
- **Pan and zoom** like a design canvas: drag, wheel or pinch zoom, fit-to-screen, keyboard (`+` `-` `0` and arrows).
- **Hover spotlight.** Hovering a node dims everything that isn't connected to it in the current mode. Clicking pins the spotlight.

### Modes × scenarios → steps

A **mode** is a version of the system (Today, Problems, Option A, Proposal…). A **scenario** is an input (a normal order, a payment timeout…). Every (mode, scenario) pair resolves to a list of **steps**.

The steps are declarative: one base list per scenario, plus `byMode` overrides. The author writes "in the proposal, step 3 sends to `outbox` instead of `queue`", not a separate script per mode. See [03 · Spec format](03-spec-format.md).

A step can set:

| Field | What the reader sees |
| --- | --- |
| `active` | Nodes highlighted for this step |
| `packets` | Labelled dots that travel along edges (`order #42`, `charge`, `retry`) |
| `badges` | Small tags on nodes (`2 charges!`, `queue depth 40k`) |
| `status` | Node colour: `ok`, `warn`, `bad`, `new` |
| `callouts` | Problem or fix cards pinned to a node, by id (`P2`) |
| `camera` | Which nodes to frame. Defaults to the active nodes. |
| `caption` | One or two sentences under the canvas |
| `deep` | Which deep dive "Learn more" opens |

The last step of a scenario is the **verdict**: a per-mode outcome (`ok` / `warn` / `bad`), a short label, and a one-line reason. *Double submit*: Today → **bad**, "customer charged twice". Proposal → **ok**, "second request returns the first result".

### Callouts are shared ids, not inline text

Problems (`P1`, `P2`…) and fixes (`F1`, `F2`…) are declared once. A step lists the problem ids it touches. What shows depends on the mode's **role**:

| Mode role | Callout shown for `P2` |
| --- | --- |
| `baseline` (Today) | nothing, or a subtle marker if `features.callouts` is `always` |
| `critique` (Problems) | the problem card for `P2` |
| `option` (A, B, Proposal) | the fix card for whichever fix in this mode `solves: [P2]`, or an **"unsolved"** card if none does |

The "unsolved" card is the honesty rule from [01 · Product](01-product.md): an option must show what it *doesn't* fix.

Problem types are fixed and colour-coded: **performance**, **correctness**, **security**, **ops**.

### Player

- Play / pause, step back / forward, a scrubber with one tick per step, and speed (0.5× / 1× / 2×).
- The camera follows the active step (`camera: follow`), or stays put (`static`). The reader can turn follow off, and that choice is remembered for this viewer.
- **Motion policy** ([ADR 0003](adr/0003-motion-policy.md)): autoplay at most once per page load, never loop, and pause when the tab is hidden. With `prefers-reduced-motion`, steps change instantly and packets appear at the middle of their edge instead of travelling.
- Keyboard: `Space` play/pause, `←` `→` step, `M` next mode, `S` next scenario, `Esc` closes the sheet.
- The URL hash holds `mode`, `scenario`, and `step`, so a link opens the exact frame (`#mode=proposal&scenario=double-submit&step=3`).

### Deep-dive sheet

Clicking a node, a callout, or "Learn more" opens a side sheet. Every node uses the same five sections, so readers know where to look:

1. **Role**: what it does, in one paragraph
2. **How it works**: the mechanism
3. **In the code**: file paths with line ranges, pinned to the evidence commit ([ADR 0004](adr/0004-evidence-pinned-to-commit.md))
4. **Weak points**: linked to problem ids
5. **Read more**: external links

Problem and fix entries use their own fixed set: *what happens*, *why (in the code)*, *impact* for problems; *what changes*, *why it works*, *cost / trade-off* for fixes. A node can show a different entry per mode (`deepIn: { proposal: "api-v2" }`).

### Story panel

An optional floating panel of **chapters**. Each chapter has a title, a short body, and sets the mode (and optionally a scenario and step). Back / Next walks the reader through the argument: *How checkout works → What breaks → The fix → What we need to decide*. On narrow screens it becomes a bottom drawer. `story: inline` renders the chapters as a column beside the canvas instead.

### Optional sims

Some ideas are easier to show with a small interactive toy than with packets: a retry/backoff timeline, a queue-depth slider. A sim is a plugin with one function, `mount(host, options)`, registered by id and placed in a chapter or deep dive with `{ "sim": "retry-backoff" }`. Sims are part of the reviewed runtime, not generated code ([ADR 0001](adr/0001-data-only-output.md)). v1 ships the interface and one example sim; it ships no sim library.

---

## Job 2 · Proposal

`proposal.json` adds the argument around the diagram: context, problems with evidence, options, trade-offs, recommendation, rollout, risks, open questions, and the decision asked for. The build renders it twice:

- as a **Proposal view** inside the same HTML page, and
- as **`PROPOSAL.md`**, for people who want to read it in a PR or wiki.

Problem ids are the same everywhere: `P2` in the doc, on the callout, and in the deep dive. Numbers that haven't been measured are rendered as *illustrative*. A benchmark slot shows **"waiting for data"** until `results.json` exists. Details in [05 · Proposal mode](05-proposal.md).

---

## Job 3 · Sync

`check.mjs` keeps the spec honest after the code moves on. It fails when:

- a cited file no longer exists, or a cited line range is past the end of the file;
- a cited `anchor` (a symbol or string expected in that range) can't be found;
- a node or edge marked `evidence: required` has no citation;
- files cited by the spec changed since the evidence commit (reported as **drift**, a warning by default, or an error with `--strict`).

For a greenfield spec (`"source": "design"`, no repo), `check` runs only the internal checks (ids, references, every verdict has evidence) and skips the repo checks. Switching `source` to `"code"` turns them on.

It prints a human report or `--json`, and exits non-zero on failure, so it can run in CI next to the tests. Details in [04 · Architecture](04-architecture.md#checkmjs).

---

## Diagram types

| Type | v1 | Notes |
| --- | --- | --- |
| **flow** | ✅ | Lanes × rows grid; packets on edges. The default. |
| **sequence** | ✅ | Lanes become participants with lifelines. Each step's packets become messages, drawn top to bottom in order. Modes still apply (a participant can be `newIn: [proposal]`). |
| state machine | later | States as nodes, transitions as edges; scenarios walk the states |
| pipeline / DAG | later | Stages left to right; packets are batches |
| deployment | later | Nodes nested in zones (region, VPC, cluster) |
| rollout timeline | later | Phases of a migration; modes are dates |

Out of scope for good: ERD, class diagrams, charts, mind maps. Use archify or diagram-design for those.

---

## Feature flags

The spec's `features` block switches parts of the page on and off. Every flag has a default from the chosen preset.

| Flag | Values | What it controls |
| --- | --- | --- |
| `playback` | `auto` · `manual` · `off` | `auto` plays once on load (motion policy permitting). `off` shows only the final frame of each scenario: a static diagram. |
| `modes` | list of mode ids | Which modes appear in the switcher, in order |
| `scenarios` | `true` · `false` · list of ids | Show the scenario picker, or limit it |
| `callouts` | `true` · `false` · `always` | `always` also marks problems in baseline modes |
| `deepDive` | `true` · `false` | Clickable nodes and the sheet |
| `story` | `panel` · `inline` · `off` | Story chapters |
| `camera` | `follow` · `static` | Auto-framing of active nodes |
| `controls` | `full` · `minimal` · `none` | `minimal` = play/pause + scrubber; `none` = keyboard and story only |
| `theme` | `auto` · `light` · `dark` | `auto` follows the OS |
| `sims` | `true` · `false` | Mount sims, or show their static fallback |
| `chrome` | `app` · `embed` | `app` is a full-page canvas with a toolbar; `embed` is a fixed-height block with no page header, for iframes and docs |

## Presets

The agent picks a preset from what the user asked for, then overrides single flags if needed.

| Preset | Typical request | playback | modes | scenarios | callouts | deepDive | story | controls | chrome |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `minimal` | "draw how checkout works" | off | 1 | false | false | true | off | none | app |
| `walkthrough` | "explain / onboard me on checkout" | auto | 1 | true | false | true | panel | full | app |
| `review` | "what's wrong with checkout?" | manual | today, problems | true | true | true | panel | full | app |
| `full` | "propose a fix for double charges" | manual | all | true | true | true | panel | full | app |
| `embed` | "put it in our docs page" | manual | as spec | true | true | false | off | minimal | embed |

`full` also turns on the proposal view when `proposal.json` exists.
