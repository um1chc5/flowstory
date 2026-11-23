# 03 · Spec format

The agent writes one JSON file, `spec.json`. It holds data only: no code, no HTML, no coordinates unless they're overrides. A fixed, reviewed runtime renders it ([ADR 0001](adr/0001-data-only-output.md)). The full JSON Schema will live at `skills/flowstory/references/spec-schema.md` (with a machine-readable `spec.schema.json` next to the scripts). This doc explains the shape and the rules behind it.

## Top level

Only the **core** fields are required. Each optional layer ([02 · Features](02-features.md)) is switched on by adding its fields.

```jsonc
{
  // ── core (required) ───────────────────────────────
  "flowstory": 1,                    // spec format version
  "id": "checkout",                  // slug: output folder and file name
  "title": "Order checkout",
  "type": "flow",                    // v1: "flow" | "sequence"   later: "state" | "pipeline" | "deployment"
  "source": "code",                  // "code" (traced from a repo) | "design" (greenfield, no repo)
  "lanes":  [ ... ],                 // meaning depends on type (columns, participants, …)
  "nodes":  [ ... ],
  "edges":  [ ... ],

  // ── core (optional) ───────────────────────────────
  "preset": "diagram",               // diagram (default) | compare | walkthrough | review | full | embed
  "features": { "camera": "static" },// overrides on top of the preset
  "kinds":  { ... },                 // custom node kinds on top of the built-in ones
  "groups": [ ... ],                 // labelled boxes around nodes
  "deep":   { ... },                 // deep-dive entries, by id
  "story":  [ ... ],                 // chapters
  "sims":   [ ... ],                 // sim placements

  // ── layers (all optional) ─────────────────────────
  "views":     [ ... ],              // Views
  "scenarios": [ ... ],              // Playback (+ "verdict" per scenario → Review)
  "notes":     [ ... ],              // Callouts: note | risk | question
  "problems":  [ ... ],              // Callouts + Review
  "fixes":     [ ... ],              // Callouts + Review
  "evidence":  { "repo": "https://example.com/acme/shop", "commit": "4f1c2ab" } // Sync; + "dirty": true if uncommitted changes were read
}
```

### The smallest spec

This is a complete, valid spec. It renders a static checkout diagram with no views, no playback, and no callouts.

```json
{
  "flowstory": 1, "id": "checkout", "title": "Order checkout", "type": "flow", "source": "design",
  "lanes": [{ "id": "edge" }, { "id": "app" }, { "id": "async" }, { "id": "data" }],
  "nodes": [
    { "id": "client", "kind": "client",  "lane": "edge",  "row": 0, "label": "Web client" },
    { "id": "api",    "kind": "service", "lane": "app",   "row": 0, "label": "Orders API" },
    { "id": "queue",  "kind": "queue",   "lane": "async", "row": 0, "label": "order-events" },
    { "id": "worker", "kind": "worker",  "lane": "async", "row": 1, "label": "Fulfilment worker" },
    { "id": "db",     "kind": "store",   "lane": "data",  "row": 0, "label": "orders DB" }
  ],
  "edges": [
    { "id": "client>api", "from": "client", "to": "api", "label": "POST /orders" },
    { "id": "api>db", "from": "api", "to": "db", "label": "insert" },
    { "id": "api>queue", "from": "api", "to": "queue", "label": "OrderCreated" },
    { "id": "queue>worker", "from": "queue", "to": "worker" }
  ]
}
```

The rest of this doc builds the full checkout example, layer by layer.

## Evidence

Anything that makes a claim (a node, an edge, a problem, a fix, a verdict) can carry `evidence`: a list of citations. Each citation has a **kind**:

| kind | Fields | Example |
| --- | --- | --- |
| `code` | `path`, `lines` (`"40-58"`), optional `anchor` | `{ "kind": "code", "path": "api/src/orders/create.ts", "lines": "40-58", "anchor": "publishOrderCreated" }` |
| `doc` | `title`, `url` | the payment provider's documented timeout |
| `measurement` | `metric`, `value`, `unit`, `source` | `{ "kind": "measurement", "metric": "p99 charge latency", "value": 2.4, "unit": "s", "source": "results.json#charge-p99" }` |
| `assumption` | `text` | `{ "kind": "assumption", "text": "Flash sales peak at ~20× normal order rate" }` |

Rules:

- `code` citations are only allowed when `source` is `"code"`. They are resolved against `evidence.commit` ([ADR 0004](adr/0004-evidence-pinned-to-commit.md)).
- A verdict whose evidence is **only** `assumption` is rendered with an **assumed** tag.
- A number written inline (in a badge, caption, or doc) with no `measurement` behind it must be marked `~` or wrapped as `{ "value": 20000, "unit": "orders/min", "measured": false }`. The runtime renders it as *illustrative*.

## Lanes and nodes

```jsonc
"lanes": [
  { "id": "edge",     "label": "Client" },
  { "id": "app",      "label": "Our services" },
  { "id": "async",    "label": "Async" },
  { "id": "data",     "label": "Data" },
  { "id": "external", "label": "Third party" }
],
"nodes": [
  { "id": "client",   "kind": "client",   "lane": "edge",     "row": 0, "label": "Web client", "sub": "checkout page" },
  { "id": "api",      "kind": "service",  "lane": "app",      "row": 0, "label": "Orders API", "sub": "POST /orders",
    "alt": { "label": "Orders API", "sub": "checks Idempotency-Key" }, "altIn": ["proposal"],
    "deep": "api", "deepIn": { "proposal": "api-proposal" },
    "evidence": [{ "kind": "code", "path": "api/src/orders/create.ts", "lines": "12-80" }] },
  { "id": "payments", "kind": "external", "lane": "external", "row": 0, "label": "Payments provider", "sub": "charge API" },
  { "id": "idem",     "kind": "store",    "lane": "data",     "row": 0, "label": "idempotency_keys", "sub": "key → result",
    "only": ["proposal"], "newIn": ["proposal"] },
  { "id": "db",       "kind": "store",    "lane": "data",     "row": 1, "label": "orders DB", "sub": "orders · payments" },
  { "id": "outbox",   "kind": "store",    "lane": "data",     "row": 2, "label": "outbox", "sub": "same transaction",
    "only": ["proposal"], "newIn": ["proposal"] },
  { "id": "relay",    "kind": "worker",   "lane": "async",    "row": 2, "label": "Outbox relay", "sub": "polls · publishes",
    "only": ["proposal"], "newIn": ["proposal"] },
  { "id": "queue",    "kind": "queue",    "lane": "async",    "row": 1, "label": "order-events", "sub": "queue" },
  { "id": "worker",   "kind": "worker",   "lane": "async",    "row": 0, "label": "Fulfilment worker", "sub": "emails · stock" }
]
```

- `lane` + `row` place the node. Rows are integers per lane; `row: 1.5` is allowed for an in-between slot. `span: 2` widens a node across two rows.
- Built-in kinds: `client`, `service`, `external`, `queue`, `worker`, `store`, `cache`, `function`, `user`. Each has an icon and a colour token. `kinds` can add more (`{ "search": { "label": "Search index", "icon": "search", "like": "store" } }`).
- Per-view rules: `only`, `hideIn`, `newIn`, `ghostIn`, `altIn` (see [02 · Features](02-features.md#layer--views)). They only matter when `views` is set. A node may not be both `only`-excluded and `newIn` in the same view; `validate` reports that.
- Optional `x`, `y` override the computed centre. Use them sparingly.
- What `lane` and `row` mean depends on `type`: lanes are participants in a sequence diagram, and groups take over in a deployment diagram. See `references/diagram-types.md`.

## Groups

```jsonc
"groups": [
  { "id": "backend", "label": "Checkout service", "nodes": ["api", "idem", "outbox", "relay"] },
  { "id": "vendor",  "label": "Third party",      "nodes": ["payments"], "style": "external" }
]
```

A group draws a labelled box around its nodes. Groups can nest (`"groups": ["…"]` inside a group) and take the same per-view rules as nodes. Layout keeps a group's nodes together; a node belongs to at most one group at each level.

## Edges

```jsonc
"edges": [
  { "id": "client>api",   "from": "client", "to": "api",      "label": "POST /orders" },
  { "id": "api>payments", "from": "api",    "to": "payments", "label": "charge" },
  { "id": "api>db",       "from": "api",    "to": "db",       "label": "insert order" },
  { "id": "api>queue",    "from": "api",    "to": "queue",    "label": "publish OrderCreated", "hideIn": ["proposal"],
    "evidence": [{ "kind": "code", "path": "api/src/orders/create.ts", "lines": "62-70", "anchor": "publishOrderCreated" }] },
  { "id": "api>idem",     "from": "api",    "to": "idem",     "label": "lookup / store key", "only": ["proposal"], "newIn": ["proposal"] },
  { "id": "api>outbox",   "from": "api",    "to": "outbox",   "label": "insert event (same tx)", "only": ["proposal"], "newIn": ["proposal"] },
  { "id": "relay>outbox", "from": "relay",  "to": "outbox",   "label": "poll", "only": ["proposal"], "newIn": ["proposal"] },
  { "id": "relay>queue",  "from": "relay",  "to": "queue",    "label": "publish", "only": ["proposal"], "newIn": ["proposal"] },
  { "id": "queue>worker", "from": "queue",  "to": "worker",   "label": "consume" }
]
```

- `id` must be `from>to`, optionally with a suffix (`api>db#2`) for parallel edges.
- Edges take the same per-view rules as nodes. An edge is hidden automatically in any view where one of its ends is hidden.
- `pts: [[x, y], …]` and `labelAt: [x, y]` override routing for one edge.
- `evidence: "required"` on an edge (or `features.edgeEvidence: "required"`) makes `check` fail if no citation is given.

## Views *(layer)*

Leave `views` out and the diagram has one implicit view, `default`. Add it to get a view switcher and diffs.

```jsonc
"views": [
  { "id": "today",    "label": "Today",    "role": "baseline" },
  { "id": "problems", "label": "Problems", "role": "critique", "base": "today" },
  { "id": "proposal", "label": "Outbox + idempotency keys", "role": "option" }
]
```

- `role` is optional and only used by the Review layer: it decides how problem and fix callouts render (see [02 · Features](02-features.md#problem-and-fix-callouts-follow-the-views-role)). Without Review, views need only `id` and `label`.
- `base` makes one view inherit another's element rules and step overrides. `problems` is usually Today's structure plus callouts, so it sets `base: "today"` and needs no rules of its own.
- In a greenfield spec the baseline can be a naive design (`{ "id": "v0", "label": "Simplest thing", "role": "baseline" }`) or be left out entirely.

## Notes *(Callouts layer)*

```jsonc
"notes": [
  { "id": "N1", "kind": "note",     "node": "queue", "title": "At-least-once", "text": "Consumers must be idempotent." },
  { "id": "N2", "kind": "question", "node": "relay", "title": "Poll or tail?", "text": "Polling is simpler; log tailing has less lag.", "in": ["proposal"] }
]
```

- `kind`: `note` · `risk` · `question`. Ids are `N<n>`.
- `in` lists the views where the note shows statically. Without `in` it shows in every view. With playback, a step can also list it in `callouts`, and then it shows only on that step.

## Problems and fixes *(Callouts + Review layers)*

```jsonc
"problems": [
  { "id": "P1", "type": "correctness", "title": "Double charge on retry",
    "node": "api", "summary": "A retried POST creates a second order and a second charge.",
    "deep": "p1", "evidence": [{ "kind": "code", "path": "api/src/orders/create.ts", "lines": "20-34" }] },
  { "id": "P2", "type": "correctness", "title": "Lost OrderCreated event",
    "node": "queue", "summary": "DB commit and queue publish are separate; a crash between them loses the event.",
    "deep": "p2", "evidence": [{ "kind": "code", "path": "api/src/orders/create.ts", "lines": "55-70" }] },
  { "id": "P3", "type": "performance", "title": "Charge call holds the request open",
    "node": "payments", "summary": "A slow provider ties up API workers; timeouts surface as errors to the client.",
    "deep": "p3", "evidence": [{ "kind": "doc", "title": "Provider timeout docs", "url": "https://example.com/docs/timeouts" }] }
],
"fixes": [
  { "id": "F1", "solves": ["P1"], "in": ["proposal"], "node": "idem", "title": "Idempotency-Key per checkout",
    "summary": "Same key → same stored result; no second charge.", "deep": "f1" },
  { "id": "F2", "solves": ["P2"], "in": ["proposal"], "node": "outbox", "title": "Transactional outbox",
    "summary": "Event is written in the order's transaction; the relay publishes it at least once.", "deep": "f2" }
]
```

- Problem `type`: `performance` · `correctness` · `security` · `ops`.
- Ids are `P<n>` and `F<n>`. They are shared with `proposal.json` and `PROPOSAL.md` ([05 · Review and proposal](05-proposal.md)).
- `P3` has no fix in `proposal`, so wherever a step cites `P3` in that view, the page shows an **unsolved** card. That's intended.

## Scenarios and steps *(Playback layer)*

A scenario has one base list of steps. `byView` patches a step for one view. Steps that only exist in some views use `in` / `skipIn`.

```jsonc
"scenarios": [
  {
    "id": "double-submit",
    "label": "Double submit",
    "group": "correctness",
    "input": "Customer clicks Pay twice; the first response is slow.",
    "steps": [
      { "id": "s1",
        "active": ["client", "api"],
        "packets": [{ "edge": "client>api", "label": "order #42" }, { "edge": "client>api", "label": "order #42 (again)", "delay": 0.4 }],
        "caption": "The client sends the same checkout twice.",
        "deep": "api" },

      { "id": "s2",
        "active": ["api", "payments"],
        "packets": [{ "edge": "api>payments", "label": "charge $80" }, { "edge": "api>payments", "label": "charge $80", "delay": 0.4 }],
        "badges": { "payments": "2 charges" },
        "status": { "payments": "bad" },
        "callouts": ["P1"],
        "caption": "Both requests reach the provider. Nothing ties them together.",
        "byView": {
          "proposal": {
            "active": ["api", "idem", "payments"],
            "packets": [{ "edge": "api>idem", "label": "key k-42: new" }, { "edge": "api>payments", "label": "charge $80" },
                        { "edge": "api>idem", "label": "key k-42: seen", "delay": 0.4 }],
            "badges": { "payments": "1 charge", "idem": "k-42 stored" },
            "status": { "payments": "ok", "idem": "new" },
            "caption": "The first request stores key `k-42`. The second finds it and returns the stored result."
          }
        } },

      { "id": "s3", "skipIn": ["proposal"],
        "active": ["api", "db"],
        "packets": [{ "edge": "api>db", "label": "order #42" }, { "edge": "api>db", "label": "order #43" }],
        "badges": { "db": "2 orders" },
        "status": { "db": "bad" },
        "caption": "Two orders are created for one checkout." }
    ],
    "verdict": {
      "today":    { "outcome": "bad", "label": "Charged twice", "why": "No idempotency: each request is a new order and a new charge.",
                    "evidence": [{ "kind": "code", "path": "api/src/orders/create.ts", "lines": "20-34" }] },
      "proposal": { "outcome": "ok",  "label": "Charged once",  "why": "The second request returns the first result from `idempotency_keys`.",
                    "evidence": [{ "kind": "assumption", "text": "Client sends the same key on retry" }] }
    }
  }
]
```

### Step fields

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Unique within the scenario. Used by `byView`, story chapters, and the URL hash. |
| `active` | node ids | Highlighted nodes. |
| `packets` | `{ edge, label, tone?, reverse?, delay? }[]` | `edge` must be a declared edge **visible in the current view**. `reverse: true` for responses. `tone`: `ok` · `bad` · `new`. `delay` in fractions of a step. |
| `badges` | `{ node: text }` | Short. 24 characters at most (`validate` warns above that). |
| `status` | `{ node: ok \| warn \| bad \| new }` | |
| `callouts` | note or problem ids | Notes show as written; problems render according to the view's role (Review). |
| `camera` | node ids · `"all"` · `"keep"` | Defaults to `active`. |
| `caption` | inline text | See *Inline text* below. |
| `deep` | deep-dive id | |
| `in` / `skipIn` | view ids | The step exists only in / is skipped in these views. |
| `byView` | `{ viewId: partialStep }` | Patch for one view. |

### How `byView` merges

For view `m`, a step resolves in this order: the base step → the patches of `m`'s `base` chain → `byView[m]`.

- Objects (`badges`, `status`) merge key by key. A value of `null` removes the key.
- Arrays (`active`, `packets`, `callouts`, `camera`) are **replaced**, not concatenated. That keeps a patch readable on its own.
- Scalars replace.
- A key in `byView` may list several views: `"a,proposal": { … }`.

### Verdict *(Review layer)*

`verdict` is optional; adding it turns on the Review layer for the page. It maps view id → `{ outcome, label, why, evidence? }`. Once any scenario has a verdict, every view shown for every scenario needs one; `validate` reports missing ones. `outcome` is `ok` · `warn` · `bad`. The player adds the verdict as the final frame automatically; authors don't write a verdict step.

## Deep dives

```jsonc
"deep": {
  "api": {
    "title": "Orders API", "kicker": "Service",
    "role": "Accepts checkouts, charges the card, stores the order, and announces it.",
    "how": "A single request handler: validate → charge → insert → publish.",
    "code": [{ "kind": "code", "path": "api/src/orders/create.ts", "lines": "12-80", "note": "the whole handler" }],
    "weak": ["P1", "P3"],
    "read": [{ "title": "Idempotent requests (general guide)", "url": "https://example.com/idempotency" }]
  },
  "p1": {
    "problem": "P1",
    "happens": ["Client retries `POST /orders` after a slow response.", "API treats it as a new checkout.", "Provider charges again."],
    "cause": "No key ties retries together.",
    "impact": "Refunds, support tickets, chargeback risk."
  },
  "f1": {
    "fix": "F1",
    "changes": "Client sends an `Idempotency-Key`; the API stores key → result before charging.",
    "why": "A repeated key short-circuits to the stored result.",
    "cost": "One extra table and lookup per checkout; keys need a retention policy."
  }
}
```

Node entries use the five fixed sections (`role`, `how`, `code`, `weak`, `read`). Problem entries use `happens`, `cause`, `impact`; fix entries use `changes`, `why`, `cost`. Unknown section keys are a validation error. That keeps every sheet the same shape.

## Story

```jsonc
"story": [
  { "id": "c1", "title": "How checkout works", "view": "today", "scenario": "normal-order",
    "body": "One request does four things in a row: charge, insert, publish, respond." },
  { "id": "c2", "title": "Where it breaks", "view": "problems", "scenario": "double-submit", "step": "s2",
    "body": "Retries and crashes both lead to wrong money or lost events. See P1 and P2." },
  { "id": "c3", "title": "The fix", "view": "proposal", "scenario": "double-submit",
    "body": "Idempotency keys stop double charges. The outbox makes the event part of the transaction." },
  { "id": "c4", "title": "What we need to decide", "view": "proposal",
    "body": "Key retention period, and whether the relay polls or tails the log." }
]
```

## Inline text

Captions, bodies, and deep-dive text are **plain text with a small markup subset**, rendered safely by the runtime (never as raw HTML):

- `` `code` ``, `**bold**`, `*italic*`
- `[label](https://…)` links (http/https only)
- `P1`, `F2` written as `[[P1]]` become links that open that entry
- lists: a string array where a section allows it (`happens`, `weak`)

Anything else (tags, scripts, `javascript:` URLs) is shown as literal text, and `validate` warns about it.

## Validation

`node scripts/validate.mjs spec.json --json` returns:

```json
{
  "ok": false,
  "errors": [
    { "code": "packet-edge-hidden", "path": "/scenarios/0/steps/1/byView/proposal/packets/0",
      "message": "Packet uses edge 'api>queue', which is hidden in view 'proposal'.",
      "fix": "Use 'api>outbox', or add 'proposal' to the edge's visible views." }
  ],
  "warnings": [
    { "code": "badge-long", "path": "/scenarios/2/steps/0/badges/queue", "message": "Badge is 31 characters (max 24)." }
  ]
}
```

Every error has a stable `code`, a JSON Pointer `path`, and, where possible, a concrete `fix`, so the agent can repair the spec without guessing. The main rules:

| Code | Rule |
| --- | --- |
| `ref-unknown` | Every id reference (node, edge, view, problem, fix, deep, step) resolves |
| `edge-id` | Edge id matches `from>to[#n]` |
| `packet-edge-hidden` | Every packet travels on a declared edge that is visible in that view |
| `active-hidden` | Active nodes, badges, and status refer to nodes visible in that view |
| `verdict-missing` | With Review on, every (scenario, shown view) has a verdict |
| `fix-orphan` | Every fix solves at least one problem and appears in at least one view |
| `problem-unused` | With Playback on, every problem is cited by at least one step (warning) |
| `layer-missing` | Fields of a layer refer to another layer that isn't there (e.g. `byView` with no `views`, step `callouts` with no notes or problems) |
| `evidence-kind` | `code` evidence only when `source` is `"code"` |
| `rules-conflict` | No element is both excluded and `newIn` in the same view |
| `deep-section` | Deep entries only use their allowed sections |
| `markup-unsafe` | Inline text contains HTML or unsafe links (warning) |
