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
