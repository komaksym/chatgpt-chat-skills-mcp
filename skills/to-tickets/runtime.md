Break an approved plan, specification, or settled conversation into GitHub Issues
that are tracer-bullet vertical slices. If the user supplied a GitHub issue or other
repository reference, read its full relevant content before drafting. Inspect the
active repository as needed so titles and descriptions use established domain
vocabulary and respect relevant ADRs.

Draft each normal ticket as a narrow but complete path through every layer it needs.
A ticket must be independently demoable or verifiable and small enough for one fresh
context window. Prefer vertical behavior slices over layer-by-layer work. Add a
prefactoring ticket only when it genuinely makes later behavior changes safer or
simpler, and explain why that prefactor is necessary.

Treat genuinely wide mechanical refactors as the exception. Use expand-contract:
first add the new form beside the old, then migrate callers in independently sized
batches, then remove the old form after every migration blocker is complete. If a
migration batch cannot stay green independently, keep the sequence explicit and use
a final integrate-and-verify ticket rather than pretending it is a vertical slice.

For every proposed ticket show:

1. **Title** — a short behavior-focused name.
2. **Blocked by** — only tickets that genuinely gate starting this one, or `None`.
3. **What it delivers** — the end-to-end behavior made verifiable by this ticket.
4. **Why this shape** — only when prefactoring or expand-contract needs justification.

Present the complete numbered breakdown in chat and wait for explicit user approval.
Do not create, edit, or relate any GitHub issue before that approval. Iterate on
splits, merges, granularity, and blockers until the user approves the breakdown.

After approval, publish issues in dependency order so blocker references can use real
issue identifiers. If the source is an existing parent issue, preserve parent/sub-
issue membership separately from execution blockers: parent membership means scope;
`Blocked by` means start-order dependency. Never substitute one relationship for the
other.

For each parent or blocking relationship, use the strongest capability actually
available, in this order:

1. Use a native connected GitHub sub-issue or blocking relationship capability.
2. Otherwise use an authenticated GitHub REST capability that can create that exact
   relationship.
3. Otherwise preserve the relationship explicitly in the issue body with `## Parent`
   and/or `## Blocked by` references.

If a stronger relationship mechanism fails, continue to the next available fallback
and say which representation was used. Never invent credentials and never silently
drop a relationship. GitHub Issues are the only tracker target, and no configured
triage labels are required.
