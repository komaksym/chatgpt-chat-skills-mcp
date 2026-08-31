# Maintainer guide

The canonical adaptation contract is GitHub issue #1. This guide explains the repository mechanics needed to maintain that contract; it does not restate or fork the policy.

## Bundle inputs and generated output

Each `skills/<name>/` directory contains the committed Upstream Skill Bundle inputs and artifacts for one skill projection. New `provenance.json` documents model Source Provenance explicitly as either `pinned-github` or `absent`; the legacy v1 shape remains valid for existing bundles.

A pinned GitHub source records the repository, exact commit, license, attribution, upstream paths, and SHA-256 digests. An absent source records only the intentional absence plus local projection-source paths. Do not add placeholder repositories, commits, hashes, licenses, or attribution merely to satisfy metadata validation.

`runtime.md` is the committed Generated Runtime served in production. It is produced during development as a Mechanical Projection; startup and requests never regenerate it.

Pinned Supporting Documents are source-verified and made self-contained according to issue #1. Absent-origin Supporting Documents remain explicit committed projection inputs but have no fabricated remote-integrity claim. Separately named Dependency Skills are not Supporting Documents and must remain separate bundles.

## Structured Change Records

Intentional differences from source material are represented as structured Change Records in `provenance.json`. A record identifies the affected source, concrete versioned Target Runtime Profile evidence, the authorized transformation category from issue #1, and a deterministic transform. `chatgpt-web-mcp-v1` keeps its historical constraint vocabulary; new adaptations can cite `chatgpt-web-mcp-v2` without changing v1. Free-text adaptation metadata is rejected.

Do not add a local methodology because it reads better. If a runtime difference cannot be justified by the canonical contract, it is drift and the generated runtime should stay upstream-faithful.

## Runtime Envelope

The Runtime Envelope is shared cross-skill guidance added by the loader. It carries generic remote-execution safeguards once: use connected capabilities, do not assume local facilities or write access, and claim only observed results. It is not copied into each `runtime.md` and is not a place to redefine skill methodology.

## Temporary Upstream Fix

A Temporary Upstream Fix is an exceptional, pin-guarded correction for a demonstrated upstream contradiction. It is available only when Source Provenance is pinned, and requires matching provenance, a dedicated ADR, focused tests, and the exact upstream pin. A pin change expires the fix; generation must fail until the fix is removed or explicitly re-authorized against the new upstream state. The current implementation review-order fix is documented in `docs/adr/implement-review-order.md`.

## Exact corpus checks

Run focused checks while changing projection behavior, then the complete deterministic gate before review:

```sh
npm run typecheck
npx vitest run test/projection.test.ts
npx vitest run test/full-corpus-mcp.test.ts
npm test
npm run build
npm run corpus:check
```

`npm run corpus:check` verifies exact remote bytes for pinned GitHub provenance, validates committed local inputs for absent provenance, regenerates every runtime byte-for-byte, audits structural corpus invariants, and reports runtime sizes. CI also compares size deltas against the base revision. A hand-edited runtime, undeclared source difference, expired fix, embedded Dependency Skill, duplicated Runtime Envelope, or leaked provenance/catalog data must fail rather than become the new baseline.

The behavioral release evaluations in `evals/release/` are separate manual/release evidence. They complement deterministic corpus gates; they do not replace them.
