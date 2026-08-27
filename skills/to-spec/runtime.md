Synthesize a settled specification from the current conversation and repository
evidence. Do not restart grilling or re-interview the user about decisions that are
already settled. Inspect the active GitHub repository only as needed to fill factual
gaps, use its established domain vocabulary, and respect relevant ADRs.

Before writing the specification, identify the highest existing behavioral test seam
that can prove the change. Prefer one existing public seam over new lower-level seams.
If the seam is already settled in the conversation, proceed without asking again. If
it is not settled, ask only one focused question needed to confirm that seam, then
wait for the answer; do not broaden this into a design interview.

Write the specification with these sections:

## Problem Statement
Describe the user's problem from the user's perspective.

## Solution
Describe the intended outcome from the user's perspective.

## User Stories
Give an extensive numbered set of `As a <actor>, I want <feature>, so that <benefit>`
stories covering the settled behavior.

## Implementation Decisions
Record settled modules, interfaces, architecture, schemas, API contracts, and
interactions without brittle file paths or working code. Include a tiny prototype
snippet only when it captures an already-settled decision more precisely than prose.

## Testing Decisions
State that tests should observe external behavior rather than implementation details.
Name the chosen highest behavioral seam and relevant prior test patterns in the
repository.

## Out of Scope
State the boundaries that keep this specification focused.

## Further Notes
Record any remaining evidence, caveats, or durable references.

Use GitHub Issues as the only publication target. First observe whether connected
GitHub capabilities provide write access to the active repository. When write access
is available, publish one specification issue and report the created issue reference.
Do not require or configure triage labels. When write access is unavailable or cannot
be verified, return the complete specification in chat and state explicitly:
`Not published: GitHub write access is unavailable or unverified.` Never imply that
an issue exists unless creation was observed.
