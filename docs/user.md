# User guide

The Skills MCP is intentionally explicit: no skill is loaded until you ask for it.

## Discover and load

The MCP exposes exactly two tools: `load_skill` and `list_skills`.

Use `list_skills` only when you want public discovery. It returns the public canonical names and descriptions; hidden Dependency Skills do not appear there. Use `load_skill` with an exact canonical name. A successful load returns the shared Runtime Envelope plus exactly that skill's committed Generated Runtime, not the catalog, provenance, or unloaded dependencies.

The current public catalog has seven skills: `code-review`, `grill-with-docs`, `handoff`, `implement`, `improve-codebase-architecture`, `to-spec`, and `to-tickets`.

## Hidden Dependency Skills

Four Dependency Skills are hidden from public listing but remain exactly loadable: `codebase-design`, `domain-modeling`, `grilling`, and `tdd`.

Dependencies stay separate and are requested at their upstream-defined timing:

- `grill-with-docs` loads `grilling` and `domain-modeling` immediately in the same conversation.
- `implement` requests `tdd` at the upstream testing point, then requests the separate public `code-review` workflow after a committed implementation head exists. `tdd` requests hidden `codebase-design` only when interface shape itself needs design work.
- `improve-codebase-architecture` loads `codebase-design` before analysis, then requests `grilling` and `domain-modeling` only after you select a candidate.

A parent skill never embeds the child runtime merely to avoid a second load.

## Missing Live Capability

The Target Runtime Profile describes what the product supports; Live Capability is what this conversation has actually demonstrated. GitHub read/write access, native relationship support, browser access, independent child conversations, or any other operation must be observed before a skill claims it worked.

When a required Live Capability is missing and no equivalent mechanism can produce the same externally visible result, the skill stops the affected operation and says what is unavailable. It may report safe partial completion already achieved, but it must not replace a required native GitHub relationship with Markdown, pretend a write succeeded, or silently weaken a workflow.
