# Operator guide

This guide covers the supported local runtime and the `mcps-launcher` lifecycle for the Skills MCP.

## Supported runtime

- Node.js 20 or newer.
- npm 10 or newer.
- TypeScript 5.9.x; this repository currently pins TypeScript 5.9.2 for development and build checks.
- A built checkout of this repository and, when using the launcher, the installed `mcps-launcher` plus OpenAI Secure MCP Tunnel client.

Install and verify the repository:

```sh
npm ci
npm run typecheck
npm test
npm run build
```

Start the built service directly with `npm start`. It binds only to loopback. The default MCP endpoint is `http://127.0.0.1:2092/mcp`; set `PORT` to use another loopback port.

Readiness is `GET /healthz`. Ready means an observed HTTP 200 response whose body is exactly `{"status":"ok"}`. A running process, open port, or tunnel status alone is not enough.

## Secure MCP Tunnel

The server stays on loopback; Secure MCP Tunnel owns the authenticated outbound connection. Keep tunnel identifiers, keys, profile contents, state, and logs machine-local.

With the current launcher convention, create a dedicated profile once:

```sh
tunnel-client init \
  --profile chatgpt-chat-skills-mcp \
  --tunnel-id '<tunnel-id>' \
  --mcp-server-url http://127.0.0.1:2092/mcp
```

Do not commit the real tunnel identifier or any credential value. If the installed tunnel client exposes different flags, follow that installed version's help. See `docs/SECURE_MCP_TUNNEL.md` for the direct service/tunnel smoke procedure.

## Skills launcher lifecycle

Install `mcps-launcher` from its repository with `./install.sh`; its installer is idempotent, backs up conflicting files, and does not edit shell or tunnel configuration.

`mcps-launcher` manages the loopback server and the dedicated Skills tunnel as one operator target. The Skills commands from issue #11 are:

```sh
mcp-skills
mcps skills
mcps all
mcps status
mcps stop skills
mcps stop all
mcps restart skills
mcps restart all
mcps logs skills
```

`mcps both`, `mcps stop both`, and `mcps restart both` remain backward-compatible Chrome + Playwright commands and deliberately do not add Skills.

A healthy Skills status reports both managed PIDs. If either managed process is stale or no longer matches the expected command/profile, the launcher cleans stale state and reports Skills stopped. `mcps logs skills` shows both server and tunnel logs without printing profile contents or credentials.

The launcher defaults to `$HOME/.local/share/chatgpt-chat-skills-mcp/dist/main.js`. `SKILLS_MCP_SERVER_ENTRY`, `SKILLS_MCP_NODE_BIN`, and `SKILLS_MCP_PORT` may override machine-local runtime paths or the loopback port. Keep the server port consistent with the tunnel profile.
