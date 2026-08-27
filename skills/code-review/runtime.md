Review one committed GitHub change along two deliberately separate axes. Do not
blend, average, rerank, or let one axis mask the other.

First pin the review to an immutable or committed GitHub state: a pull request head
commit, commit SHA, or committed feature-branch head plus its base. Use connected
GitHub capabilities to confirm both refs resolve, inspect the commit list, and obtain
the committed diff. Stop if the comparison cannot be established or has no committed
changes. Never substitute uncommitted parent-chat text for the committed diff.

Identify the sources for each axis before strict review starts.

## Standards

The Standards child independently reads the committed diff and relevant repository
material from GitHub. It evaluates three evidence classes and labels every finding
with exactly one class:

1. **Documented repository rules** — explicit requirements in repository instructions,
   contribution guides, coding standards, ADRs, or other authoritative documents.
   These can support a hard violation when the changed code contradicts the cited
   rule.
2. **Established repository conventions** — repeated local patterns visible in nearby
   production code and tests but not stated as a rule. Report these as convention
   mismatches with the concrete comparison evidence; do not upgrade them to policy.
3. **Heuristic smells** — the Fowler baseline below. These are always a judgement call,
   never a hard violation. A documented repository rule overrides the heuristic.

Skip findings already enforced mechanically by observed lint, formatting, typecheck,
or equivalent tooling results.

Use this heuristic baseline: Mysterious Name, Duplicated Code, Feature Envy, Data
Clumps, Primitive Obsession, Repeated Switches, Shotgun Surgery, Divergent Change,
Speculative Generality, Message Chains, Middle Man, and Refused Bequest. For every
smell, name the smell, identify the changed file/hunk, explain the concrete design
pressure, and keep it labelled as a heuristic judgement call.

## Spec

The Spec child independently reads the committed diff from GitHub and checks it
against all applicable scope sources: the originating GitHub issue, any committed
specification, settled user requirements supplied for this review, and the
pull-request scope. It reports missing or partial requirements, incorrect behavior,
and scope creep. Cite the relevant requirement source for every finding. If one source
does not exist, say so; do not pretend it was checked.

## Strict isolation

Strict mode is valid only when Standards and Spec run in **two separate ChatGPT
conversations** outside the same ChatGPT Project. The conversations must not share
findings with each other.

Reference chat history is a user-controlled ChatGPT prerequisite. This MCP cannot
inspect or prove whether it is disabled. Before strict mode, require the user to
confirm that reference chat history is disabled for both child conversations and that
both conversations will be outside the same Project. Record the confirmation as a
prerequisite, not as programmatic verification.

Use a connected Chrome MCP child-chat capability only when it can create and address
two distinct ChatGPT conversations. Give each child the repository coordinates,
base/head refs, its own axis brief, and the methodology it needs. The Spec child may
also receive settled user requirements that are not stored in GitHub. Do not paste
repository file contents, diffs, issue bodies, or the other child's findings into
either child as a substitute for direct access.

Each child must independently use its own connected GitHub access and observe a
successful GitHub result before reviewing. Require each report to identify the
repository and reviewed head commit it independently resolved. If either child cannot
directly access GitHub, do not continue strict review and do not replace the missing
access with parent-pasted repository evidence. Use this exact message:

`Strict review stopped: each child must independently access GitHub; parent-pasted repository evidence is not an acceptable substitute.`

After that stop, you may offer a degraded review only by asking for **explicit user
permission**. If the user agrees, label the result `NON-ISOLATED REVIEW` and state
that it does not satisfy strict child-chat isolation. Never describe two sequential
Standards and Spec passes in this conversation as isolated.

Run both strict children without sharing interim reports. Aggregate only after both
children have completed. Present their results under separate headings:

## Standards

Keep the Standards report's evidence-class labels intact.

## Spec

Keep the Spec report's requirement-source labels intact.

End with counts and the worst finding within each axis, if any. Do not choose a single
winner across axes.

For confidence in the isolation prerequisite, follow the documented two-child
synthetic-canary smoke procedure. A passing canary is confidence evidence, not formal
proof of conversation isolation. When a real Chrome MCP child-chat smoke cannot be
run in the current environment, record it as `NOT EXERCISED`; never infer a pass from
the presence of generic browser controls.
