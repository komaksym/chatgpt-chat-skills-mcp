---
name: adapt-codex-skill
description: "Use when adapting a complete Codex Skill Bundle into an issue-ready ChatGPT Web implementation spec."
disable-model-invocation: true
---

# Adapt Codex Skill

Produce only an issue-ready **Adaptation Spec**. This is a **Faithful Adapter**: preserve upstream unless a concrete target-runtime constraint forces an **Allowed Runtime Change**. Ask for every difference: **What concrete target-runtime constraint forces this change?** Otherwise exclude it as **Unforced Drift**.

Use the current Skills MCP repository as authority for vocabulary, Target Runtime Profile, the closed Allowed Runtime Change set, Source Provenance encoding, and conventions. Look them up; do not cache them here.

## Inspect

**Source:** inspect the complete **Upstream Skill Bundle**: entrypoint, required Supporting Documents, scripts/helpers, Repository Assets, Dependency Skills needed for composition/timing, meaningful `agents/openai.yaml`, and source origin. Missing required material => **stop without emitting an Adaptation Spec** and name it.

Provenance is `pinned-github` only for a canonical GitHub repo+commit; use `absent` when no canonical source exists/is available. Never invent it.

**Target:**
1. Inspect current `komaksym/chatgpt-chat-skills-mcp`.
2. Inspect current `komaksym/mcps-launcher`; its bindings are the target inventory.
3. Inspect only relevant MCP repositories for exact capability/limitation semantics.
4. Separate **Target Runtime Profile** (stable support) from **Live Capability** (verified usable now). Docs do not prove live access.

## Adapt

Use only the repository's closed Allowed Runtime Change set. Each difference states: upstream behavior, forcing constraint, allowed change, evidenced target mechanism, equivalent visible result, unavailable-capability behavior, preservation boundary.

Preserve deterministic helpers when the ChatGPT sandbox can run them faithfully; translate only environment-dependent I/O. Keep Dependency Skills separate with identity and invocation timing intact; warn each may need its own adaptation. Preserve semantic Codex metadata intent, not unsupported UI mechanics.

| Purpose | Treatment |
| --- | --- |
| Ephemeral work | ChatGPT sandbox |
| Repository/versioned state | connected GitHub |
| Skill docs/scripts/assets | GitHub-backed skill resources |
| Persistent user deliverable | ChatGPT Library when appropriate |
| Existing Chrome session/tabs | launcher-identified Chrome Browser MCP |
| Dedicated browser automation | launcher-identified Playwright MCP |
| Independent/parallel agents | verified live child workers preserving required isolation/order/parallelism |
| Host macOS/files/native apps/daemons | unsupported without a real connected capability |

Storage is not consumption. No live **Equivalent Mechanism** => stopped behavior; if that defeats the core purpose, specify a full stop, not a weaker substitute.

Exclude unrelated redesign. If effectively certain, allow at most one separately underlined single-sentence note in Further Notes.

## Output

Keep the spec semantic; omit transient paths, schema encodings, code snippets, and implementation names that should be rediscovered later.

<adaptation-spec-template>

## Problem Statement

## Source Bundle and Provenance

## Preserved Upstream Behavior

## Target Environment Evidence
Target Runtime Profile vs Live Capability.

## Required Adaptations
One entry per forced difference using the fields above.

## Resource and State Mapping
Include browser/worker semantics when relevant.

## Dependency and Interface Adaptations
Omit when irrelevant.

## Acceptance Criteria
Observable proof of preservation, justified differences, truthful capabilities, helpers, dependency boundaries, and provenance.

## Out of Scope
Creating the issue; committing implementation changes; generating the final runtime bundle; storing skills in ChatGPT Library; unrelated redesign; invented capabilities.

## Further Notes

</adaptation-spec-template>

Return only the completed Adaptation Spec on success.
