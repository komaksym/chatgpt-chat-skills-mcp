# Strict code-review smoke test

This procedure checks the strongest observable prerequisites for translating the
upstream parallel-sub-agent review into independent ChatGPT child conversations.
It is a capability smoke test, not a proof about hidden platform state.

In this ChatGPT environment, `@chrome-mcp` is the supported child-review
mechanism. It implements isolation by creating and separately addressing distinct
ChatGPT conversations in separate browser tabs. A browser tab is not sufficient by
itself: each child tab must point at a different ChatGPT conversation URL/ID and
remain independently addressable for the whole review.

## Prerequisites

- `@chrome-mcp` can create or navigate to two separate browser tabs containing two
  distinct ChatGPT conversations and can address each tab independently.
- Each child conversation can use connected GitHub directly.
- The parent can keep each child's findings out of the sibling conversation until both
  reviews complete.
- When both axes run, the parent can dispatch the two child prompts without serially
  feeding one child's result into the other.

## Two-child synthetic canary

1. Create a fresh ChatGPT conversation in one browser tab for child A (Standards) and
   a different fresh ChatGPT conversation in another browser tab for child B (Spec).
   Confirm the tabs have distinct ChatGPT conversation URLs/IDs.
2. Give child A only `STANDARDS-CANARY-7A` and child B only `SPEC-CANARY-7B`. Never
   include the sibling canary literal in the other child's prompt, even in a sentence
   saying that the child should not see it.
3. Give both children only repository coordinates, the same committed base/head refs,
   and their own axis methodology. Do not paste repository files, diffs, issue bodies,
   or findings from the parent.
4. Require each child to independently use connected GitHub, resolve the repository
   and exact head SHA, and report one repository path or issue identifier it fetched.
5. Require each child to return its own canary exactly and state only whether it saw
   any canary token other than its own. Do not name or quote the sibling canary in that
   child's prompt.
6. Inspect both reports only after both finish. Confirm that each independently
   observed GitHub and neither reports the sibling canary.

## Result recording

Record exactly one status:

- `PASS` — two separately addressable `@chrome-mcp` tabs contained distinct
  ChatGPT conversations, both independently accessed GitHub and resolved the same
  pinned head, and neither showed the sibling canary.
- `FAIL` — the tabs pointed at the same ChatGPT conversation, the contexts were not
  independently addressable, a child lacked direct GitHub access, parent-pasted
  repository evidence was required, or a sibling canary leaked.
- `NOT EXERCISED` — the current environment cannot create/address two distinct
  ChatGPT conversations through `@chrome-mcp`, or the synthetic canary has not
  been run.

Separate `@chrome-mcp` tabs are therefore a valid child-review mechanism only when
they contain distinct ChatGPT conversations and satisfy the canary. Arbitrary browser
tabs, two tabs showing the same conversation, or two sequential prompts in one
conversation are not equivalent.

## Implementation-time result — 2026-08-29

`NOT EXERCISED`

The synthetic canary was not run during implementation. This status does not reject
the separate-tab mechanism: in this environment, distinct ChatGPT conversations in
separately addressable `@chrome-mcp` tabs are the intended sub-agent implementation
and can be recorded as `PASS` once the canary above succeeds.

## Live result — 2026-08-30

`PASS`

The synthetic canary ran against committed head
`bf5de9371e8255d7ed27c3391b9478ee0b0c3acd`. The parent created two fresh
`@chrome-mcp` tabs with distinct ChatGPT conversation IDs, dispatched the two
prompts in parallel, and inspected no report until both tabs reported Ready.

The Standards child returned `STANDARDS-CANARY-7A`, independently resolved the
pinned head, fetched `README.md`, and reported that it saw no other canary token.
The Spec child returned `SPEC-CANARY-7B`, independently resolved the same pinned
head, fetched GitHub issue `#1`, and likewise reported that it saw no other canary
token. Neither child received parent-pasted repository contents or the sibling
canary literal.
