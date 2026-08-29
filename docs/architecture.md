# Architecture

## Stable two-tool surface

The product exposes exactly `load_skill` and `list_skills`. These tool schemas are catalog-independent: adding another bundle changes metadata on disk, not the permanent tool surface injected into every conversation. Public discovery happens only when `list_skills` is called.

`load_skill` accepts an exact canonical name rather than a path, URL, or catalog enum. The validated startup catalog maps that identifier to an already-read bundle, which keeps arbitrary filesystem access and catalog disclosure out of the request path.

## Committed runtimes, not runtime generation

Each skill's `runtime.md` is a committed Generated Runtime built as a Mechanical Projection from pinned upstream inputs. The service validates and reads committed artifacts at startup, then serves them directly. This makes the bytes reviewed in Git the bytes returned to ChatGPT and avoids a runtime generator, upstream fetcher, or provenance service on the hot path.

There is no runtime provenance service. Source pins, Change Records, licenses, attribution, upstream inputs, and generation data stay in the repository for maintainers and are never returned as part of a skill load.

## GitHub-only remote behavior

The Target Runtime Profile supports GitHub-only repository and issue-tracker behavior through connected capabilities. Skills do not assume a local checkout, shell, filesystem, or Git CLI. Where upstream offers multiple repository/tracker branches, the adapter selects the upstream-supported GitHub branch; it does not invent a new methodology.

Live GitHub capability is still per-conversation evidence. A missing read, write, label, or native relationship operation must be reported truthfully rather than replaced by a weaker outcome.

## Loopback transport

The TypeScript service binds to loopback, normally `127.0.0.1:2092`, with MCP at `/mcp` and readiness at `/healthz`. OpenAI Secure MCP Tunnel provides the authenticated outbound path from that local process to ChatGPT Web. The repository therefore needs neither a public listener nor a second authentication protocol.
