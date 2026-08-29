# ChatGPT Chat Skills MCP

A local TypeScript MCP service that exposes explicitly selected engineering
skills to ChatGPT without embedding the skill catalog in tool schemas.

## Requirements

- Node.js 20 or newer
- npm 10 or newer

## Development

```sh
npm install
npm run lint
npm run typecheck
npm test
npm run build
npm run generate:check
```

Projection-enabled skills are generated during development, never at MCP startup
or request time. Regenerate one skill with `npm run generate -- handoff`, or run
`npm run generate` without a name to regenerate every projection-enabled bundle.
The committed `runtime.md` is the artifact served in production.

Start the built service on `127.0.0.1:2092`:

```sh
npm start
```

Set `PORT` to use another loopback port. The MCP endpoint is `/mcp`.

## Current public skills

- `code-review` — Review a committed GitHub diff on separate Standards and Spec axes
  using strict independent child contexts when that capability is live.
- `grill-with-docs` — Stress-test a plan through evidence-led decisions and
  durable domain language.
- `handoff` — Create a compact continuation brief for another conversation.
- `improve-codebase-architecture` — Find deepening opportunities in a remote
  repository and present candidate architecture improvements.
- `setup-matt-pocock-skills` — Establish minimal GitHub-first domain
  documentation from repository evidence.

`grilling` and `domain-modeling` are hidden dependencies. Loading
`grill-with-docs` instructs ChatGPT to load both immediately in the same
conversation. They never appear in `list_skills`, remain separately loadable by
exact canonical name, and are never concatenated into the parent runtime.

`codebase-design` is a hidden Dependency Skill of `improve-codebase-architecture`.
The architecture workflow loads it before analysis, keeps it separate from the
parent runtime, and requests `grilling` and `domain-modeling` only after the user
selects a candidate.

The MCP surface contains exactly `load_skill` and `list_skills`. Call
`load_skill` with the exact canonical name `handoff`; its input is deliberately a
plain string so the installed catalog does not occupy every conversation's tool
schema.

## Strict code review

`code-review` is a Mechanical Projection of the pinned upstream two-axis workflow.
Strict mode uses `@chrome-mcp` to create independent child conversations, requires
each child to access GitHub directly, and dispatches both running axes in parallel
before aggregation. If `@chrome-mcp` cannot create/address the required children or
parallel dispatch is unavailable, the strict workflow stops before either review
starts; it does not substitute sequential passes or invent a weaker fallback branch.

See `docs/code-review-strict-smoke.md` for the synthetic-canary capability smoke
procedure. The implementation-time result is `NOT EXERCISED`.

## Skill bundles

Each direct child of `skills/` is discovered from its `provenance.json` and
`runtime.md`. Metadata owns the canonical name, visibility, description,
dependencies, and upstream provenance; server source contains no second skill
registry. Public bundles appear in `list_skills`. Public and hidden bundles can be
loaded only by an exact canonical name.

Projection-enabled provenance also records pinned source digests, ordered Change
Records, and any Temporary Upstream Fix. Those fields are development-time build
inputs only; the MCP still serves the committed runtime and never returns
provenance.

The catalog is validated before the HTTP listener starts. Invalid metadata,
duplicate names, missing runtimes, and unresolved dependencies stop startup. Tool
calls resolve names through the validated in-memory catalog rather than converting
caller input into filesystem paths. Runtime content is pinned in that catalog at
startup, so later file or directory swaps cannot redirect a load outside the
validated bundle. Loading returns the shared contract and exactly one adapted
runtime; provenance, upstream source, and unloaded dependencies remain out of the
response.
