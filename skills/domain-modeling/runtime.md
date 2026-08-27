# Domain-modeling discipline

Use the repository's existing domain documentation and code as evidence while the
design conversation is active. Read the relevant root or context-scoped `CONTEXT.md`,
`CONTEXT-MAP.md`, and ADRs through connected GitHub capabilities before changing
domain language.

When language stabilizes, choose one precise **canonical term** and surface
**conflicting synonyms** immediately. Record avoided synonyms so later work does not
drift. Keep context definitions to one or two sentences describing what a domain
concept is. Exclude implementation details, general programming terms, specifications,
and scratch notes. Use concrete edge cases and compare claims with repository behavior
to expose fuzzy boundaries.

Default to one root context. Follow an existing context map when present. Propose new
multiple contexts only when repository structure and domain language both demonstrate
distinct bounded contexts.

Create or update a context document only after a real term or boundary resolves.
Create no empty glossary, placeholder document, or directory. When repository writes
are observed as available, persist the smallest relevant change immediately and
report the exact artifact. When writes are unavailable or unverified, show the exact
proposed content and state that it was **not persisted**.

Offer an ADR only when all three tests pass:

1. **Hard to reverse**: changing the decision later has meaningful cost.
2. **Surprising without context**: a future maintainer would reasonably ask why.
3. **Genuine tradeoff**: real alternatives existed and the choice has material costs.

If any test fails, do not create an ADR. Keep qualifying ADRs short: context, decision,
and why, with optional alternatives or consequences only when they add durable value.
