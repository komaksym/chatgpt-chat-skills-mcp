# Strict code-review smoke test

This procedure checks the strongest observable prerequisites for strict two-axis
review. It is a confidence check, not a proof that ChatGPT conversations have no
hidden shared state.

## Prerequisites

- Chrome MCP exposes a child-chat capability that can create and address two distinct
  ChatGPT conversations.
- Both child chats are created outside the same ChatGPT Project.
- The user confirms reference chat history is disabled for both child chats. This is
  user-controlled state; the Skills MCP cannot inspect or verify it.
- Each child has connected GitHub access of its own.

## Two-child synthetic canary

1. Create fresh child A for Standards and fresh child B for Spec.
2. Give child A only `STANDARDS-CANARY-7A` and child B only `SPEC-CANARY-7B`.
3. Give both children only repository coordinates and a committed ref. Do not paste
   file contents, diffs, issue bodies, or findings from the parent.
4. Ask each child to independently access GitHub, resolve the repository and committed
   ref, and report one path or issue identifier it fetched through GitHub.
5. Ask each child to return its own canary exactly and to state whether it saw any
   other canary.
6. Inspect both child conversations. Confirm each shows an observed GitHub result and
   neither child reports the sibling's canary.
7. Record the outcome. A pass is **confidence evidence, not formal proof** of
   conversation isolation.

## Result recording

Record exactly one status:

- `PASS` — both distinct child chats independently accessed GitHub, each saw only its
  own canary, and no parent-pasted repository evidence was used.
- `FAIL` — any child lacked independent GitHub access, the chats were not distinct and
  outside the same Project, a sibling canary appeared, or repository evidence was
  substituted by the parent.
- `NOT EXERCISED` — the current environment does not expose the required Chrome MCP
  child-chat capability. Do not infer a result from generic browser/tab automation.

## Implementation-time result — 2026-08-27

`NOT EXERCISED`

The available Chrome MCP surface exposed generic browser/tab controls but no dedicated
child-chat operation that could establish and address two independent ChatGPT child
conversations. No pass or isolation claim was inferred.
