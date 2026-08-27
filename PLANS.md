# Implementation Plan

## Milestone 1 — Issue #2: Serve handoff through the two-tool MCP

Summary: establish the smallest production-shaped TypeScript MCP service and prove
the `handoff` skill through the real loopback HTTP boundary.

```text
Official MCP client
        |
        v
127.0.0.1 HTTP transport
        |
        v
  load_skill / list_skills
        |
        v
shared contract + handoff runtime
```

1. Bootstrap lint, typecheck, test, and build commands.
2. Add one black-box test at the MCP-over-HTTP seam and observe it fail.
3. Implement the loopback service, two catalog-free tools, and the first skill bundle.
4. Run lint, typecheck, tests, and build.
5. Commit the fixed-point implementation and review it against issue #2.

Later eligible milestones are #3, #4, and #5. Issue #6 and tickets blocked by it
are explicitly excluded.

## Milestone 2 — Issue #3: Harden catalog-independent skill loading

Summary: replace the ticket #2 single-skill registry with a validated bundle catalog
whose contents never alter the stable two-tool schema.

```text
skills/*/provenance.json + runtime.md
                  |
                  v
       validated startup catalog
          /               \
         v                 v
public-only listing   exact-name loading
                           |
                           v
             shared contract + one runtime
```

1. Discover public and hidden bundles from metadata.
2. Reject malformed bundles and unresolved dependencies before listening.
3. Resolve only validated canonical identifiers, never caller-built paths.
4. Prove roughly 100 extra skills do not grow serialized tool definitions.
5. Commit, review against issue #3, fix findings, and reverify.

## Milestone 3 — Issue #4: Add remote-first repository setup

Summary: add the public setup workflow as a self-contained GitHub capability
workflow with evidence-backed domain-document decisions.

```text
connected GitHub repository
          |
          v
read/write capability evidence + domain docs
          |
          v
single context by default
    /                  \
writable             read-only
   |                     |
minimal persisted docs   explicit unpersisted proposal
```

1. Vendor the pinned upstream setup source and provenance separately.
2. Adapt setup to connected GitHub capabilities without local harness plumbing.
3. Add writable, read-only, single-context, and evidence-backed multi-context fixtures.
4. Verify public listing and exact runtime loading over MCP.
5. Commit, review against issue #4, fix findings, and reverify.
