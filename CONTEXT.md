# Domain Context

This repository is a **Faithful Adapter** for Matt Pocock's pinned engineering skills.
GitHub issue #1 is the canonical adaptation contract. This file defines the domain
vocabulary used by that contract; it does not restate policy or introduce a second
source of requirements.

## Canonical terms

- **Faithful Adapter** — a repository that preserves upstream methodology by default
  and changes it only when the Target Runtime Profile forces an allowed adaptation.
- **Upstream Skill Bundle** — the exact pinned `SKILL.md` plus every required
  Supporting Document for one skill.
- **Supporting Document** — a same-bundle document required by the upstream skill to
  execute its methodology. It is inlined verbatim into the generated runtime when
  the target runtime cannot resolve it separately.
- **Dependency Skill** — a separately named skill composed by another skill. It
  remains a separate bundle and is loaded at the timing specified upstream.
- **Target Runtime Profile** — the stable product constraints for ChatGPT Web through
  this MCP: exactly `load_skill` and `list_skills`, GitHub as repository and issue
  tracker, and no assumed local checkout, shell, filesystem, Git CLI, background
  process, connected tool, or write access.
- **Live Capability** — a capability actually observed in the current conversation.
  Product support alone is not evidence that a read, write, relationship, browser,
  child-conversation, or execution operation is available.
- **Generated Runtime** — the committed `runtime.md` served for one skill.
- **Mechanical Projection** — the deterministic development-time transformation from
  a verified Upstream Skill Bundle, ordered Change Records, and any active Temporary
  Upstream Fix into the Generated Runtime.
- **Self-Contained Runtime** — a Generated Runtime containing every required
  Supporting Document while keeping Dependency Skills separate.
- **Allowed Runtime Change** — one of the four adaptation categories authorized by
  GitHub issue #1. The list is closed; this glossary does not redefine those rules.
- **Equivalent Mechanism** — an alternate available mechanism that produces the same
  externally visible result as the unavailable upstream operation.
- **Unforced Drift** — a difference from pinned upstream that is not required by the
  Target Runtime Profile or an active Temporary Upstream Fix.
- **Change Record** — compact machine-checkable provenance for one intentional
  runtime difference, including its allowed category, affected upstream material,
  concrete Target Runtime Profile evidence, and deterministic transformation.
- **Runtime Envelope** — centralized cross-skill remote-execution guidance prepended
  by the loader and kept outside each Generated Runtime.
- **Temporary Upstream Fix** — a minimal, exceptional, pin-guarded correction for a
  reproduced upstream contradiction that no Allowed Runtime Change can resolve.

## Repository boundaries

GitHub issue #1 owns repository-wide adaptation requirements. ADRs under `docs/adr/`
record durable tradeoffs. Skill-specific requirements belong in their issue history
and projection provenance. Runtime and provenance mechanics are documented in
`docs/maintainer.md` and `docs/architecture.md`.
