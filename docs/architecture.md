# Architecture

## Stable two-tool surface

The product exposes exactly `load_skill` and `list_skills`. These tool schemas are catalog-independent: adding another bundle changes metadata on disk, not the permanent tool surface injected into every conversation. Public discovery happens only when `list_skills` is called.

`load_skill` accepts an exact canonical name rather than a path, URL, or catalog enum. The validated startup catalog maps that identifier to an already-read bundle, which keeps arbitrary filesystem access and catalog disclosure out of the request path.

## Committed runtimes, not runtime generation

Each skill's `runtime.md` is a committed Generated Runtime built as a Mechanical Projection from committed source inputs. Pinned GitHub provenance verifies those inputs against an exact repository commit and SHA-256 digest; intentionally absent provenance uses the committed local source bytes without inventing an upstream origin. The service validates and reads committed artifacts at startup, then serves them directly. This makes the bytes reviewed in Git the bytes returned to ChatGPT and avoids a runtime generator, upstream fetcher, or provenance service on the hot path.

There is no runtime provenance service. Source pins, Change Records, licenses, attribution, upstream inputs, and generation data stay in the repository for maintainers and are never returned as part of a skill load.

## Versioned Target Runtime Profiles

`chatgpt-web-mcp-v1` is frozen with its historical GitHub-centric semantics: it does not assume a local checkout, shell, filesystem, Git CLI, background process, connected tool, or write access. Existing Change Records keep that meaning permanently.

`chatgpt-web-mcp-v2` models the richer ChatGPT Web environment without redefining v1. It can cite stable support for the ChatGPT sandbox, connected GitHub, Chrome Browser MCP, Playwright MCP, independent ChatGPT child workers, and ChatGPT Library for appropriate user-facing deliverables. It still denies arbitrary host filesystem access, native-application control, local daemons, and unrelated host processes.

A Target Runtime Profile describes stable product support, not what is live in one conversation. Required connected capabilities must still be observed at execution time; an unavailable capability must produce truthful stopped behavior rather than a weaker substitute.

## Loopback transport

The TypeScript service binds to loopback, normally `127.0.0.1:2092`, with MCP at `/mcp` and readiness at `/healthz`. OpenAI Secure MCP Tunnel provides the authenticated outbound path from that local process to ChatGPT Web. The repository therefore needs neither a public listener nor a second authentication protocol.
