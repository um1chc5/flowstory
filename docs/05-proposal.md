# 05 · Review and proposal

This is the **Review layer** ([02 · Features](02-features.md#layer--review)), the most opinionated part of flowstory and fully optional. Problems, fixes, and verdicts live in `spec.json`. The proposal adds the argument around the diagram: the agent writes `proposal.json` next to `spec.json`. The build turns it into:

- a **Proposal panel** in the page (a tab next to the canvas, and the last story chapter links to it), and
- **`PROPOSAL.md`**, a plain Markdown document for a PR, wiki, or RFC repo.

Both come from the same data, and both use the ids from `spec.json`. Neither is edited by hand: to change the doc, change the JSON and rebuild.

## Sections

`PROPOSAL.md` always has these sections in this order. Empty sections are left out, except **Decision asked**, which is required.

| # | Section | Comes from |
| --- | --- | --- |
| 1 | **Context** | `proposal.context`: why this is being looked at now |
| 2 | **Today** | `spec.views[role=baseline]` + a short summary; link to the page |
| 3 | **Problems** | `spec.problems`, each with type, summary, and evidence |
| 4 | **Options** | `spec.views[role=option]` + `proposal.options` |
| 5 | **Trade-offs** | A generated table: problems × options (fixed / unsolved / partly), plus `proposal.options[].cost` |
| 6 | **Recommendation** | `proposal.recommendation` |
| 7 | **Rollout** | `proposal.rollout`: ordered phases |
| 8 | **Risks** | `proposal.risks` |
| 9 | **Assumptions** | every `assumption` evidence in the spec and proposal, collected automatically |
| 10 | **Open questions** | `proposal.questions` |
| 11 | **Decision asked** | `proposal.decision`: what exactly the reader is asked to approve, and by when |
| — | **Benchmarks** | `proposal.benchmarks` + `results.json`, placed after Trade-offs |

For a greenfield spec, **Today** is replaced by the baseline design if there is one, and dropped if not.

## proposal.json

```jsonc
{
  "flowstory-proposal": 1,
  "spec": "spec.json",
  "author": "",                                  // optional; left blank by default
  "status": "draft",                             // draft | in-review | accepted | rejected
  "context": "Support sees double charges every flash sale, and fulfilment sometimes never hears about paid orders.",

  "options": [
    { "view": "proposal", "id": "O1", "title": "Outbox + idempotency keys",
      "summary": "Make checkout safe to retry and make the event part of the transaction.",
      "cost": [{ "text": "2 new tables, 1 new worker" }, { "text": "~3 engineer-weeks", "measured": false }] },
    { "view": null, "id": "O0", "title": "Do nothing",
      "summary": "Keep refunding manually.", "cost": [{ "text": "Support load during sales" }] }
  ],

  "recommendation": {
    "option": "O1",
    "why": "It fixes [[P1]] and [[P2]] without changing the provider. [[P3]] stays open and is out of scope.",
    "notFixed": ["P3"]
  },

  "rollout": [
    { "id": "R-1", "title": "Idempotency keys behind a flag", "detail": "Client sends keys; API stores and checks them." },
    { "id": "R-2", "title": "Outbox write in shadow view", "detail": "Write events to both outbox and queue; compare." },
    { "id": "R-3", "title": "Switch publishing to the relay" }
  ],

  "risks": [
    { "id": "K1", "text": "Relay lag delays emails during spikes", "mitigation": "Alert on outbox age > 30 s" }
  ],

  "questions": [
    { "id": "Q1", "text": "How long do we keep idempotency keys?" },
    { "id": "Q2", "text": "Poll the outbox, or tail the DB log?" }
  ],

  "benchmarks": [
    { "id": "B1", "question": "Does the outbox write slow down checkout?",
      "metric": "p99 POST /orders latency", "unit": "ms",
      "compare": ["today", "proposal"], "result": "results.json#B1" }
  ],

  "decision": {
    "ask": "Approve O1 for the next sprint, with Q1 answered before R-1 ships.",
    "by": "2026-12-05",
    "owners": []
  }
}
```

## Ids

| Prefix | Meaning | Declared in |
| --- | --- | --- |
| `P` | Problem | `spec.json` |
| `F` | Fix | `spec.json` |
| `O` | Option (maps to a view; `O0` = do nothing) | `proposal.json` |
| `R-` | Rollout phase | `proposal.json` |
| `K` | Risk | `proposal.json` |
| `Q` | Open question | `proposal.json` |
| `B` | Benchmark | `proposal.json` |

`[[P1]]` in any text becomes a link: in the page it opens the sheet, in `PROPOSAL.md` it links to the problem's heading. On the canvas, callout cards show the same id in their corner, so when a reviewer says "P2", everyone looks at the same thing in the doc and on the diagram.

## Honesty rules

These are checked by the build, not left to the author.

1. **Every problem has evidence.** A problem with no evidence is a build error.
2. **Every problem is placed.** Each problem is either fixed by the recommended option or listed in `recommendation.notFixed`. Nothing silently disappears. The build fails otherwise.
3. **Unmeasured numbers are marked.** Any number in a cost, caption, or badge that isn't backed by a `measurement` renders as *~value (illustrative)*. In `PROPOSAL.md` it gets the same marker.
4. **Assumptions are collected.** Every `assumption` citation lands in the Assumptions section, with links back to where it's used.
5. **Assumed verdicts are tagged.** A verdict backed only by assumptions shows **assumed** on the canvas and in the trade-offs table.
6. **Benchmarks wait for data.** A benchmark slot without a matching entry in `results.json` renders as **waiting for data**, with the question and metric but no chart and no number. The build never invents a result.

## results.json

Written by whoever runs the benchmark (a person, a CI job, or the agent running a script it was asked to run):

```json
{
  "B1": {
    "measuredAt": "2026-11-30",
    "commit": "9d0e1f3",
    "method": "k6, 200 rps for 5 min, staging",
    "values": { "today": 412, "proposal": 431 }
  }
}
```

When `results.json` appears, the slot renders as a simple bar comparison with the method and commit underneath, and the numbers count as `measurement` evidence (`results.json#B1`) everywhere they're cited.

## Proposal panel in the page

The page's Proposal panel is a scrollable column with the same sections. A few things are interactive:

- Problem rows open the problem sheet, and a **Show me** button jumps the canvas to the first step that cites that problem in the critique view.
- Columns of the trade-offs table switch the canvas to that option's view.
- Benchmark slots show the bar comparison or "waiting for data".
- A status pill in the header shows `draft` / `in-review` / `accepted` / `rejected`.
