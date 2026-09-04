## Problem Statement

Adapt the complete representative Codex bundle for ChatGPT Web without changing methodology that the target runtime does not force.

## Source Bundle and Provenance

The inspected bundle contains `source.md`, required Supporting Document `helper.md`, Repository Asset `assets/report.key`, and Dependency Skill `fixture-dependency`. Source Provenance is intentionally absent: no canonical upstream repository or commit is available, so no GitHub origin data is fabricated.

## Preserved Upstream Behavior

Preserve the dependency invocation immediately before scoring, the deterministic label-normalization algorithm, the upstream fallback behavior for unavailable export/notification capabilities, and the sentence "Prefer the first acceptable label even when a later label would read better." The last sentence is intentionally not improved because no target-runtime constraint forces a methodology change.

## Target Environment Evidence

The v2 Target Runtime Profile supports ChatGPT sandbox work, connected GitHub repository state, Chrome Browser MCP for the user's existing browser session, and genuinely independent ChatGPT child workers when their Live Capability is verified. It does not assume native macOS application control. Live Capability remains an execution-time check and is not inferred from stable support.

## Required Adaptations

- Ephemeral scratch state: replace the Codex local temporary path with ChatGPT sandbox state. The visible computation stays the same; the deterministic helper itself is unchanged.
- Repository mutation: translate the local Git commit to connected GitHub and require the same committed repository changes plus an observed commit result.
- Existing-browser work: translate local Chrome automation to Chrome Browser MCP against the user's existing Chrome session.
- Parallel isolation: use genuinely independent ChatGPT child workers only when Live Capability verifies both isolation and parallelism; otherwise stop that operation rather than simulate it sequentially.
- Repository Asset storage: keep `assets/report.key` versioned beside the skill in connected GitHub. GitHub storage does not prove live consumption of the Repository Asset. When no Live Capability can consume it, stop only the export operation, preserving the upstream-supported fallback.
- Native notification: because the target has no native macOS application control and no Equivalent Mechanism for `osascript`, select the upstream-supported fallback and stop only the notification operation.
- Required Supporting Document: inline `helper.md` verbatim into the Generated Runtime so its deterministic algorithm remains executable and self-contained.

## Resource and State Mapping

Scratch state is ephemeral in the ChatGPT sandbox. Repository/versioned state and the Repository Asset live in connected GitHub. The existing browser session uses Chrome Browser MCP. Worker use is conditional on verified Live Capability. Storage of an asset is not evidence that a current tool can consume its format.

## Dependency and Interface Adaptations

Dependency Skill `fixture-dependency` remains separate and is invoked immediately before scoring. It must be available at execution time and may require its own adaptation; do not inline or silently rewrite its methodology.

## Acceptance Criteria

The deterministic helper produces the same result before and after projection; the Git mutation yields the same committed state through connected GitHub; existing-session work names Chrome Browser MCP; child-worker execution stops when required guarantees are unavailable; absent Source Provenance contains no fabricated origin; the Repository Asset can be stored without claiming consumption; unsupported native notification stops only that operation; the untouched methodology sentence remains byte-for-byte present; and the resulting Generated Runtime loads through `load_skill` without exposing provenance or Dependency Skill runtime text.

## Out of Scope

Creating a tracker issue, changing unrelated methodology, inventing host capabilities, flattening Dependency Skills, or treating Repository Asset storage as proof of consumption.

## Further Notes

None.
