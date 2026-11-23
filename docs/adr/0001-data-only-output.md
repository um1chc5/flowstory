# ADR 0001 · Generated output is data only

- **Status:** accepted
- **Date:** 2026-11-23

## Context

An agent writes the content of every flowstory page. It may write that content after reading code it didn't write and can't fully trust (comments, READMEs, issue text). If the agent also writes the page's JavaScript or HTML, then:

- every page is a new, unreviewed program that people open in their browser;
- a prompt injection in the repo can become script in the page;
- pages look and behave a little differently each time, and bugs can't be fixed in one place;
- the agent spends its effort on rendering code instead of on the analysis.

The reference page this project generalizes was hand-written, with content and code mixed together (about 34 KB of per-scenario if/else). That was fine for one page. It doesn't scale to pages written by agents.

## Decision

- The agent writes **JSON only**: `spec.json`, optionally `proposal.json`, and (when it ran a measurement it was asked to run) `results.json`.
- A **fixed runtime** that ships with the skill and is reviewed like any other code renders that JSON. `build.mjs` inlines the runtime and the JSON into the template. The JSON goes into `<script type="application/json">` blocks with `</` escaped.
- Text fields support a small inline markup subset rendered by `md.js` into DOM nodes. Spec text is never passed to `innerHTML`. Links must be `http(s)`.
- Sims are runtime plugins, not generated code. A spec can place a sim by id but can't define one.

## Consequences

- One runtime to test, secure, and improve. A fix ships to every page on its next build.
- Pages are consistent: readers learn the UI once.
- Expressiveness is limited to what the schema allows. Things the schema can't express need a schema change, not a one-off hack. We accept that; it also keeps scope small.
- `validate` can check everything the page will do, because everything the page does is in the data.

## Alternatives considered

- **Agent writes the whole HTML page.** Most flexible, and the worst on every point above.
- **Agent writes JS against a runtime API.** Still generated code in the page; still injectable.
- **Mermaid or another text DSL.** Good for structure, but has no way to express views, steps, verdicts, or evidence. May come back later as an *import* format.
