# Faithful ChatGPT Web release proof

Status: FAIL

This record is not a success claim. The repository-side deterministic gates can be verified in CI, but the complete release requires a real ChatGPT Web Developer Mode session connected through the machine-local Secure MCP Tunnel. Change the status to `PASS` only after every required observation below is captured; otherwise record `FAIL` or leave it `NOT EXERCISED`.

## Implementation-time observation — 2026-08-29

A browser request to `http://127.0.0.1:2092/healthz` reached a browser error page, so the machine-local Skills service was not running in this session. The tunnel-backed ChatGPT Web smoke therefore remains `NOT EXERCISED`; no remote-read/write, missing-capability, or strict child-conversation result is claimed here.

## Local deterministic observation — 2026-08-29

The local checkout tested revision `1a7a341ff83af095ec00aac7b69631f2305c902b`. `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run corpus:check` completed successfully; the test suite reported 14 files and 98 tests, and the corpus check reported 11 skills (7 public and 4 hidden). After starting that built revision directly, `GET /healthz` returned HTTP 200 with exactly `{"status":"ok"}`.

The installed launcher was also invoked with the built service, but this machine-local session could not start the managed Skills target because its default state location was not writable and no dedicated `chatgpt-chat-skills-mcp` tunnel runtime was available. Native tunnel runtime creation and Chrome selection were unavailable in the session. These are environment blockers, not live acceptance results; the tunnel/Web, GitHub fixture, missing-capability, targeted-evaluation, and strict child-conversation observations remain `NOT EXERCISED`.

The deterministic gates were rerun against the current pushed revision `95bd98f71181557f1069b31cf4020be11a661615` after the live session. Lint, typecheck, tests (14 files / 98 tests), build, and corpus check (11 skills / 7 public / 4 hidden) passed. The first test attempt was intentionally discarded because the live service occupied port 2092; after stopping the service, the clean rerun passed.

## Local live observation — 2026-08-29

The credentialed local session created the dedicated tunnel profile without recording its identifier or contents in this document. The built service was started through `mcp-skills`; `mcps status` observed the Skills target running with a managed server and tunnel process, and `/healthz` returned exactly `{"status":"ok"}`. A sanitized tunnel health check also observed local health and readiness HTTP 200 responses plus a successful control-plane poll.

The release revision under this observation is `95bd98f71181557f1069b31cf4020be11a661615`, which is pushed on `codex/issue-15-release-proof`.

## ChatGPT Web live observations — 2026-08-29

The connected ChatGPT Web Developer Mode conversation discovered exactly the two MCP tools `load_skill` and `list_skills`. `list_skills` returned exactly the seven public skills: `code-review`, `grill-with-docs`, `handoff`, `implement`, `improve-codebase-architecture`, `to-spec`, and `to-tickets`.

Exact loads of `codebase-design`, `domain-modeling`, `grilling`, and `tdd` succeeded even though those skills were absent from the public listing. A raw public load showed the `Remote execution contract` Runtime Envelope followed by only the requested Generated Runtime (`code-review`), with no separate `codebase-design` runtime. A dependency-timing run observed `grill-with-docs → grilling → domain-modeling`, matching the upstream composition point.

An intentionally unavailable GitHub-write capability caused `to-spec` to stop and report that it could not publish the specification; it explicitly used no weaker substitute.

The connected GitHub capability exercised a disposable fixture in `komaksym/chatgpt-quota-mcp`: issue `#1` was created, read, labeled with native `documentation` and `ready-for-agent` labels, closed, and read back with closed state. The durable result is [the closed fixture issue](https://github.com/komaksym/chatgpt-quota-mcp/issues/1). No repository credentials or local configuration were recorded.

At the time of these 2026-08-29 observations, the live Skills tunnel path was covered but the release proof was still incomplete because the targeted manual evaluation record and strict two-child code-review canary both remained unexercised. The strict canary was exercised later against an older head; the targeted evaluation was still pending at that date.

## Sanitized observation ledger

| Observation | Sanitized result |
| --- | --- |
| `mcps status` during acceptance | Skills target reported running with managed server and tunnel processes; Chrome and Playwright targets were not required for the Skills path. |
| Loopback health | `/healthz` returned HTTP 200 and exactly `{"status":"ok"}`. |
| Tunnel health | Local health and readiness returned HTTP 200; control-plane poll succeeded. |
| ChatGPT tool discovery | Exactly `load_skill`, `list_skills`. |
| Public catalog | Exactly seven documented public skills; four Dependency Skills absent. |
| Loader envelope | `Remote execution contract` followed by only requested `code-review` runtime; no `codebase-design` runtime. |
| Dependency timing | `grill-with-docs → grilling → domain-modeling`. |
| Required capability unavailable | `to-spec` reported unavailable GitHub write and used no substitute. |
| GitHub fixture | Disposable issue was created, read, labeled with native `documentation` and `ready-for-agent` labels, closed, and read back closed: [issue #1](https://github.com/komaksym/chatgpt-quota-mcp/issues/1). |
| Strict child isolation | Two fresh `@chrome-mcp` tabs used distinct ChatGPT conversation IDs; both children independently resolved the same pinned head through GitHub, returned only their own canary, and reported no sibling-canary exposure. |

## Strict child-conversation observation — 2026-08-30

The documented two-child synthetic canary passed against committed head
`bf5de9371e8255d7ed27c3391b9478ee0b0c3acd`. Two fresh `@chrome-mcp`
tabs produced distinct ChatGPT conversation IDs. The parent dispatched both prompts
in parallel and inspected no report until both tabs reported Ready.

The Standards child independently resolved the pinned head through connected GitHub,
fetched `README.md`, returned `STANDARDS-CANARY-7A`, and reported no other
canary token. The Spec child independently resolved the same pinned head, fetched
GitHub issue `#1`, returned `SPEC-CANARY-7B`, and likewise reported no other
canary token. No repository contents or sibling findings were pasted between
contexts. This is historical evidence only; the current strict review record
remains `NOT EXERCISED` because the canary was not rerun against the current head.

This historical observation did not complete the release proof; the targeted
manual release evaluation was still pending at that date.

## Targeted manual evaluation — 2026-08-30

The built service for release SHA
`23f44f01fa99346c8fa27b46defd857982442d8a` returned HTTP 200 with exactly
`{"status":"ok"}` on its loopback health endpoint. The configured tunnel recorded
MCP session initialization, metadata fetch, and successful startup. The connected
Skills boundary then returned exactly the seven public skills: `code-review`,
`grill-with-docs`, `handoff`, `implement`, `improve-codebase-architecture`,
`to-spec`, and `to-tickets`.

The paired `representative-to-spec` case was exercised with fresh hidden evaluator
contexts, the fixed `GPT-5.6 Sol` model, identical task/prompt/capabilities, and the
two supplied separate fixtures. The baseline created and read back native GitHub
issue [#2](https://github.com/komaksym/chatgpt-chat-skills-mcp-eval-1788113675-baseline/issues/2)
with `ready-for-agent`. The adapted variant loaded only `to-spec`, waited for and
received the exact confirmation, then created and read back native GitHub
issue [#2](https://github.com/komaksym/chatgpt-chat-skills-mcp-eval-1788113675-adapted/issues/2)
with `ready-for-agent`. Existing issue #1 in each fixture was left untouched and
excluded from run evidence.

The two focused observation cases also passed: `grill-with-docs` requested separate
`grilling` and `domain-modeling` bundles immediately at the parent composition point,
and `code-review` stopped rather than simulating isolation when independent direct-
GitHub child contexts were unavailable.

However, both supplied fixtures already contained a duplicate issue #1 before this
run. That violates the case's fresh-repository reset precondition, so the paired
case is recorded as invalid rather than as a release pass. The complete record is
[validated here](../evals/release/runs/2026-08-30-23f44f0.json) with
`pass: false` for that case. No issue #1 was modified or closed, and no weaker
substitute was used.

## Targeted manual evaluation — 2026-08-31

The fixed release suite was rerun against behavior head
`ee5bc1941387e7b48a503d9d272d83abf2fe32f6`. GitHub MCP verified that head and the
running built service returned HTTP 200 with exactly `{"status":"ok"}` from
`/healthz`; the connected Skills MCP returned exactly the seven documented public
skills. The evaluated service entry and installed Skills entry were byte-identical,
and the observed release record ties the run to this behavior head. The current
PR evidence head is the documentation-only commit that carries this record.

The paired `representative-to-spec` case used two fresh private fixtures, both
verified at `de37f7c16bb2ec229f13d3edbde8cdcb3dcfe246` with zero issues before the
first write. The baseline did not invoke Skills MCP and published native issue
[#1](https://github.com/komaksym/chatgpt-chat-skills-mcp-eval-20260831-061315-baseline-fresh/issues/1),
which was read back open with `ready-for-agent`. The adapted variant loaded only
`to-spec` once, proposed the existing built-process `/healthz` seam, stopped at
the confirmation boundary, received the exact follow-up, and published native
issue [#1](https://github.com/komaksym/chatgpt-chat-skills-mcp-eval-20260831-061315-adapted-fresh/issues/1),
which was read back open with `ready-for-agent`.

The two observation cases also passed: `grill-with-docs` dispatched separate
`grilling` and `domain-modeling` loads immediately and in parallel, while
`code-review` stopped when independent direct-GitHub child contexts were declared
unavailable. The complete three-case record is
[validated here](../evals/release/runs/2026-08-31-ee5bc-paired-and-observations.json).
Their sanitized observed traces are preserved in the linked PR evidence comment.
This is targeted-evaluation evidence only; the current-head strict child canary
remains a separate open gate.

## Preconditions

1. Build the exact release revision and start the loopback service.
2. Observe HTTP 200 plus `{"status":"ok"}` from `/healthz`.
3. Start the dedicated Secure MCP Tunnel profile and observe it healthy.
4. Open a fresh ChatGPT Web Developer Mode conversation backed by that tunnel.

Captured evidence must contain no secrets or machine-local configuration values.

## MCP discovery and catalog evidence

Record the observed tool discovery result. It must contain exactly `load_skill` and `list_skills`.

Invoke `list_skills` and verify it returns exactly seven public skills: `code-review`, `grill-with-docs`, `handoff`, `implement`, `improve-codebase-architecture`, `to-spec`, and `to-tickets`.

Verify the hidden Dependency Skills `codebase-design`, `domain-modeling`, `grilling`, and `tdd` are absent from listing but can be loaded by exact canonical name when an upstream workflow requests them.

For representative public loads, capture enough response evidence to show the loader returned one Runtime Envelope plus the requested committed Generated Runtime only. Confirm separate Dependency Skills are requested at the upstream-defined timing rather than embedded in the parent response.

## Remote GitHub outcomes

Run a representative workflow against a disposable GitHub fixture and capture real remote reads and writes. At least one required external result must be a native GitHub relationship or label outcome; Markdown text describing a relationship does not count. Record durable GitHub result identifiers rather than machine-local diagnostic material.

Then run a case where one required Live Capability is unavailable. Capture the workflow stopping the affected operation or reporting truthful partial completion. A convenient weaker substitute is a failure of this proof. The local live run above observed truthful stopping for an unavailable GitHub write.

## Strict code-review gate

Use `docs/code-review-strict-smoke.md`. Mark strict `code-review` as `PASS` only when two genuinely independent child conversations are separately addressable, each has direct GitHub access, both resolve the same committed head, neither receives parent-pasted repository evidence, and the documented isolation canary passes. Sequential reviews, two tabs showing the same conversation, or a child without direct GitHub access are not strict mode.

## Deterministic and behavioral gates

Before declaring the project complete, record successful execution of:

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run corpus:check
```

Also complete the targeted manual release evaluations exactly as documented in `evals/release/README.md`, validate the completed record with `node evals/release/validate-run.mjs`, and keep the observed Skills MCP revision tied to the release revision under test.

## Maintenance scope

Issue [#12](https://github.com/komaksym/chatgpt-chat-skills-mcp/issues/12) is post-release maintenance work. Link it from the release handoff, but do not make its upstream-update automation a blocker for this release proof.

## Evidence hygiene

Committed evidence must contain no secrets, tunnel credentials, machine-local configuration values, obsolete local-harness instructions, or unsupported tracker guidance.

## Result

- Overall status: `FAIL`
- ChatGPT Web / tunnel smoke: PARTIAL — local/tunnel readiness, live catalog, and the three fixed evaluation cases were observed at behavior head `ee5bc1941387e7b48a503d9d272d83abf2fe32f6`; the current-head strict canary remains open
- Strict code-review smoke: `NOT EXERCISED` for the current PR evidence head — the documented canary was observed only against older head `bf5de9371e8255d7ed27c3391b9478ee0b0c3acd`
- Deterministic corpus gates: PASS on the current PR evidence head; the repository CI check for this evidence commit passed
- Targeted manual release evaluations: `PASS` at behavior head `ee5bc1941387e7b48a503d9d272d83abf2fe32f6` — all three fixed cases passed and the completed record validates successfully
