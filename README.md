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
```

Start the built service on `127.0.0.1:2092`:

```sh
npm start
```

Set `PORT` to use another loopback port. The MCP endpoint is `/mcp`.

## Current public skills

- `code-review` — Review a committed GitHub diff on separate Standards and Spec axes
  with strict child-chat isolation.
- `grill-with-docs` — Stress-test a plan through evidence-led decisions and
  durable domain language.
- `handoff` — Create a compact continuation brief for another conversation.
- `implement` — Implement one settled GitHub ticket through TDD, observed
  verification, committed review, and a pull request.
- `setup-matt-pocock-skills` — Establish minimal GitHub-first domain
  documentation from repository evidence.
- `to-spec` — Synthesize settled work into a GitHub specification without restarting discovery.
- `to-tickets` — Turn settled work into approved GitHub tracer-bullet tickets with explicit relationships.

`grilling` and `domain-modeling` are hidden dependencies. They can be loaded by
exact canonical name when `grill-with-docs` reaches their declared phase, but they
never appear in `list_skills` and are never concatenated into the parent runtime.

The MCP surface contains exactly `load_skill` and `list_skills`. Call
`load_skill` with an exact canonical skill name; its input is deliberately a plain
string so the installed catalog does not occupy every conversation's tool schema.

## Strict code review

Strict `code-review` requires two separate ChatGPT child conversations outside the
same Project, user confirmation that reference chat history is disabled, and
independent direct GitHub access from both children. The MCP cannot inspect the
reference-chat-history setting. If either child lacks GitHub access, strict review
stops rather than substituting repository evidence from the parent. A non-isolated
fallback requires explicit user permission and is labeled accordingly.

See `docs/code-review-strict-smoke.md` for the two-child synthetic-canary procedure
and the required `PASS` / `FAIL` / `NOT EXERCISED` result semantics.

## Skill bundles

Each direct child of `skills/` is discovered from its `provenance.json` and
`runtime.md`. Metadata owns the canonical name, visibility, description,
dependencies, and upstream provenance; server source contains no second skill
registry. Public bundles appear in `list_skills`. Public and hidden bundles can be
loaded only by an exact canonical name. `implement` lazily loads hidden `tdd` when
testing begins and the public `code-review` dependency only after the implementation
commit exists.

The catalog is validated before the HTTP listener starts. Invalid metadata,
duplicate names, missing runtimes, and unresolved dependencies stop startup. Tool
calls resolve names through the validated in-memory catalog rather than converting
caller input into filesystem paths. Runtime content is pinned in that catalog at
startup, so later file or directory swaps cannot redirect a load outside the
validated bundle. Loading returns the shared contract and exactly one adapted
runtime; provenance, upstream source, and unloaded dependencies remain out of the
response.
