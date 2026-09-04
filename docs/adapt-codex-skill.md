---
name: adapt-codex-skill
description: "Analyze a complete Codex Skill Bundle and produce an issue-ready Adaptation Spec for faithful implementation in the user's ChatGPT Web environment."
disable-model-invocation: true
---

You are adapting a Codex-authored skill to the user's ChatGPT Web environment.

The repository is a **Faithful Adapter**. Preserve upstream methodology by default. For every proposed difference, ask exactly:

> **What concrete target-runtime constraint forces this change?**

If there is no concrete constraint, preserve upstream. Do not rewrite for brevity, taste, prompt optimization, consistency, easier testing, or a supposedly better workflow.

The sole successful output is the Adaptation Spec. This skill must not create a GitHub issue, must not commit repository changes, must not generate the final runtime bundle, and must not store skills in ChatGPT Library.

## Required input

Analyze a complete Upstream Skill Bundle, not only its entrypoint. The available input must include every required item referenced by the skill:

- the main `SKILL.md` or equivalent entrypoint;
- every required Supporting Document;
- every required deterministic script or executable helper;
- every required Repository Asset, including binary or non-text assets when relevant;
- every separately named Dependency Skill input needed to understand composition and invocation timing;
- meaningful Codex interface metadata such as `agents/openai.yaml` when present;
- source-origin information when known.

If any required Supporting Document, script, asset, or Dependency Skill input is unavailable for inspection, stop without emitting an Adaptation Spec. Name the missing upstream material. Do not guess, paraphrase unseen behavior, or produce a partial spec.

## Environment evidence

Before deciding adaptations, inspect the current target environment. Do not rely on memory of old repository state.

1. Inspect `komaksym/chatgpt-chat-skills-mcp` for the current Faithful Adapter architecture, domain vocabulary, Skill Adaptation Contract, Target Runtime Profile versions, Source Provenance model, catalog/dependency rules, Mechanical Projection rules, and repository conventions.
2. Use `komaksym/mcps-launcher` as the target-environment inventory. The freshly inspected `mcps-launcher` inventory is authoritative for which target bindings are current; do not let examples in this skill override it.
3. Inspect only the individual MCP repositories relevant to behaviors in the source skill, and use those repositories for exact capability and limitation semantics. Do not infer capabilities from an MCP name alone.
4. For Chrome behavior, inspect the Chrome implementation identified by the freshly inspected `mcps-launcher`. A launcher revision may identify `komaksym/chrome-browser-mcp`; if so, inspect that repository for its actual worker mechanism and operation semantics. Concrete repository and operation names in this document are non-authoritative examples, not claims about the current target binding.
5. For dedicated Playwright automation, inspect the Playwright implementation identified by the freshly inspected `mcps-launcher`. For example, a launcher revision may bind `@playwright/mcp@latest` to the upstream `microsoft/playwright-mcp`; treat those names as non-authoritative examples and verify the current binding before relying on them.
6. Inspect other MCP repositories only when the source skill actually needs them.

Treat repository documentation as evidence about stable product support, not proof that a capability is live in the current conversation.

## Target Runtime Profile versus Live Capability

Keep these concepts separate:

- **Target Runtime Profile**: stable support promised by the target environment.
- **Live Capability**: a capability actually observed and usable in the current conversation or later skill execution.

Use the current versioned Target Runtime Profile from the Skills MCP repository. Do not redefine an older profile in place.

The richer ChatGPT Web profile can model stable support for:

- ChatGPT sandbox execution and ephemeral filesystem;
- connected GitHub for repository and issue-tracker state;
- Chrome Browser MCP for the user's existing Chrome session;
- Playwright MCP for a dedicated automated browser context;
- independent ChatGPT child workers when the verified worker mechanism supplies the required isolation and ordering guarantees;
- ChatGPT Library for appropriate user-facing generated deliverables only.

It still does not imply arbitrary access to the host macOS filesystem, native applications, local daemons, unrelated host processes, or any other host capability that is not exposed through a real connected mechanism.

If a required operation has no live Equivalent Mechanism, specify truthful stopped behavior for that affected operation. Do not substitute a weaker outcome. If that unavailable operation defeats the skill's core purpose, specify that the adapted skill must stop entirely.

## Source Provenance

Represent source origin truthfully.

- Use **`pinned-github`** when a canonical GitHub source is known and can be pinned to a concrete repository and commit.
- Use **`absent`** when the canonical upstream source is intentionally unavailable or the skill is supplied directly by the user without a canonical repository.

Never invent placeholder repositories, fake commits, fake hashes, fake licenses, or ambiguous nullable provenance merely to satisfy a schema.

The Adaptation Spec should state the semantic Source Provenance requirement. A later implementation agent must inspect the then-current repository and choose its current concrete encoding.

## Semantic classification

Classify behavior by purpose, not by mechanically replacing file paths or commands.

| Upstream purpose | Target treatment |
| --- | --- |
| Ephemeral/intermediate working state | ChatGPT sandbox |
| Repository state, branches, commits, issues, labels, versioned skill state | connected GitHub |
| User-facing generated deliverable that benefits from persistence | ChatGPT Library when appropriate |
| Skill source, Supporting Documents, deterministic scripts, Repository Assets | GitHub-backed skill resources |
| Work in the user's already-open Chrome session | Chrome Browser MCP |
| Dedicated or isolated browser automation | Playwright MCP |
| Independent or parallel sub-agent work | verified independent ChatGPT child workers when live and semantically equivalent |
| Arbitrary host macOS filesystem/native-app/local-process access | unsupported unless a real connected capability proves otherwise |

Do not use ChatGPT Library as a skill-distribution mechanism. It is only for appropriate user-facing outputs produced while an adapted skill runs.

Storage and consumption are separate questions. A Repository Asset may be stored correctly in GitHub while no live tool can consume its format. When consumption is required and unavailable, specify stopped behavior for that operation.

## Allowed adaptation boundary

Preserve upstream frontmatter, wording, structure, ordering, terminology, examples, decision rules, caveats, formatting, failure modes, and composition unless a target-runtime constraint requires an allowed adaptation.

The repository's closed adaptation boundary remains authoritative. A required difference must map to an allowed runtime change such as:

1. inlining a required Supporting Document while preserving its content;
2. translating invocation syntax or tools while preserving timing, ordering, arguments, workflow meaning, and Dependency Skill boundaries;
3. replacing an unavailable operation with an Equivalent Mechanism that produces the same externally visible result;
4. selecting an upstream-supported branch that matches the Target Runtime Profile and removing only the setup or choice material for unsupported branches.

Do not invent a fifth category.

For each required adaptation, record:

- the exact upstream behavior being preserved;
- the concrete target-runtime constraint that prevents it from running unchanged;
- the allowed adaptation category;
- the concrete target mechanism, if one is supported by evidence;
- the externally visible result that must remain equivalent;
- the failure behavior when the required Live Capability is unavailable.

If you cannot answer "What concrete target-runtime constraint forces this change?", it is Unforced Drift and must be excluded.

## Deterministic scripts and helpers

Preserve deterministic executable behavior whenever the ChatGPT sandbox can faithfully execute it.

Do not replace helper logic with vague prose merely because it lived under `scripts/` in Codex. Keep the algorithm and deterministic behavior intact.

Translate only environment-dependent operations inside or around the helper, for example:

- local Git CLI work -> connected GitHub only when it preserves the same externally visible result;
- local browser automation -> the appropriate Chrome Browser MCP or Playwright MCP context;
- host filesystem/native-app access -> only a verified connected capability, otherwise stopped behavior.

If the helper itself can run unchanged in the sandbox, say so explicitly and preserve it.

## Browser contexts

Choose browser mechanisms by workflow meaning.

Use **Chrome Browser MCP** when the source behavior depends on the user's existing Chrome session, already-open tabs, or a browser state that must remain the user's real current Chrome context.

Use **Playwright MCP** when the source behavior requires a dedicated automated browser context, deterministic browser automation, or an independent browser lifecycle.

Do not treat those contexts as interchangeable merely because both can navigate web pages.

For isolated or parallel ChatGPT work, use a verified child-worker mechanism only when the freshly inspected target binding and its observed guarantees satisfy the upstream requirements. For example, an inspected Chrome Browser MCP may expose `spawn_agents` and stable worker/run identities. If independent workers, direct repository access, parallel dispatch, or required ordering cannot be verified live, do not simulate them with sequential prompts in the parent conversation.

## Dependency Skills

Separately named Dependency Skills remain separate.

For every dependency:

- preserve its canonical identity;
- preserve exactly when upstream invokes it;
- preserve immediate versus deferred composition;
- do not inline or paraphrase the dependency into the parent skill;
- add an explicit warning in the Adaptation Spec that the Dependency Skill must itself be available in the target environment and may require a separate adaptation.

Missing required dependency input during adaptation is a completeness failure: stop without emitting an Adaptation Spec.

## Codex interface metadata

Inspect `agents/openai.yaml` or equivalent Codex interface metadata when present.

Preserve meaningful author intent such as:

- explicit-only versus discoverable invocation intent;
- user-facing description or argument intent;
- workflow constraints encoded in metadata.

Do not blindly port Codex-only UI mechanics. Translate only the semantic intent that the ChatGPT target can represent, and justify every difference with a concrete runtime constraint.

## Unsupported host behavior

Do not assume access to host macOS capabilities merely because Codex could use them.

Examples requiring explicit evidence include:

- arbitrary files outside the ChatGPT sandbox or repository-backed resources;
- Finder, Terminal, Keychain, native apps, AppleScript, launch agents, or other native UI/process control;
- local daemons and unrelated host processes;
- arbitrary localhost services that are not represented by a verified connected capability.

When there is no Equivalent Mechanism, specify stopped behavior instead of textual imitation.

## Methodology-improvement rule

This is adaptation work, not upstream redesign.

Exclude unrelated methodology improvements. If you are effectively certain that you found one genuine upstream improvement unrelated to runtime compatibility, you may add at most one clearly separate underlined, single-sentence note. It is informational only and must not alter required adaptations.

## Process

1. **Inventory the complete source bundle.** Build a list of the entrypoint, Supporting Documents, scripts, assets, Dependency Skills, and interface metadata. Stop on missing required material.
2. **Establish Source Provenance.** Record whether the source is `pinned-github` or intentionally `absent`.
3. **Read the current Faithful Adapter architecture.** Use the current Skills MCP repository, not remembered schema details.
4. **Inventory the target environment.** Use `mcps-launcher`, then inspect only relevant individual MCP repositories.
5. **Extract upstream invariants.** Summarize the methodology that must survive: ordering, examples, decision rules, failure modes, dependency timing, deterministic helpers, resources, and interface intent.
6. **Classify each environment-sensitive behavior by purpose.**
7. **Evaluate every difference against the closed adaptation boundary.** Preserve unchanged behavior whenever no runtime constraint forces a difference.
8. **Define success and unavailable-capability behavior.** State observable outcomes for both.
9. **Write only the Adaptation Spec.** Do not mutate repositories or create runtime artifacts.

## Adaptation Spec output

The Adaptation Spec should be semantic and implementation-oriented. Avoid transient repository file paths, code snippets, or internal schema details that a later implementation agent should rediscover from the then-current repository.

Use this structure:

<adaptation-spec-template>

## Problem Statement

Explain why the source Codex skill cannot be used unchanged in the target ChatGPT Web environment, without treating convenience or preference as incompatibility.

## Source Skill and Provenance

Describe the complete inspected Upstream Skill Bundle, its Source Provenance state, required Supporting Documents, scripts, Repository Assets, Dependency Skills, and meaningful interface metadata.

## Preserved Upstream Behavior

List the methodology that remains authoritative: wording/structure where relevant, ordering, examples, decision rules, failure modes, caveats, deterministic helpers, dependency timing, and externally visible outcomes.

## Target Environment Evidence

Summarize the current Faithful Adapter architecture, Target Runtime Profile, `mcps-launcher` inventory, and only the relevant individual MCP capability evidence.

Distinguish stable Target Runtime Profile support from Live Capability.

## Required Adaptations

For every required difference, describe:

- **Upstream behavior**
- **Concrete target-runtime constraint**
- **Allowed runtime change**
- **Target mechanism**
- **Equivalent externally visible result**
- **Unavailable-capability behavior**
- **Preservation boundary**

There must be a concrete target-runtime constraint for every entry.

## Resource and State Mapping

Classify ephemeral working state, GitHub-backed repository state, Supporting Documents, deterministic scripts, Repository Assets, user-facing Library deliverables, browser state, and unsupported host state by purpose.

## Browser and Worker Semantics

State whether each browser-dependent behavior requires the user's existing Chrome session, a dedicated Playwright context, or verified independent ChatGPT child workers. Preserve isolation, parallelism, identity, ordering, and failure semantics when upstream requires them.

## Dependency Skills

List each separately named Dependency Skill, preserve invocation timing, and include the explicit warning that every dependency must itself be available and may require separate adaptation.

Omit this section only when there are no Dependency Skills.

## Invocation and Interface Adaptations

Describe only runtime-forced changes to invocation syntax or Codex interface metadata. Preserve semantic author intent without copying unsupported Codex-only UI mechanics.

## Acceptance Criteria

Include observable criteria that prove:

- a complete source bundle becomes an issue-ready Adaptation Spec;
- every difference has a concrete target-runtime constraint;
- upstream methodology is preserved unless an allowed runtime adaptation requires change;
- relevant concrete target mechanisms are named when environment evidence supports them;
- deterministic helpers remain executable when the sandbox can faithfully run them;
- Dependency Skill boundaries and timing remain intact;
- Source Provenance is truthful;
- missing required source material stops adaptation;
- unavailable Live Capability produces truthful stopped behavior rather than a weaker substitute;
- implementation can later be verified through the real Skills MCP boundary without requiring this adapter itself to be served by the MCP.

## Out of Scope

Explicitly exclude:

- creating the GitHub issue;
- committing repository changes;
- generating the final MCP-ready runtime bundle;
- storing skills in ChatGPT Library;
- unrelated methodology improvements;
- inventing target capabilities that were not supported by inspected evidence.

## Further Notes

Include only durable implementation guidance that does not depend on transient repository internals.

If an effectively certain unrelated upstream improvement is worth mentioning, place the single allowed underlined sentence here and nowhere else.

</adaptation-spec-template>

Return only the completed Adaptation Spec on success. Do not append implementation work, repository mutations, or a generated runtime bundle.
