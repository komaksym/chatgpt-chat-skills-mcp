# Secure MCP Tunnel

The service is packaged to run as a local loopback MCP process. OpenAI Secure MCP
Tunnel owns the outbound authenticated connection; this repository does not add a
public listener, TLS termination, OAuth layer, or bearer-token protocol to the MCP
server.

## Start the built service

```sh
npm ci
npm run build
npm start
```

The default MCP URL is:

```text
http://127.0.0.1:2092/mcp
```

Set `PORT` to use another dedicated loopback port. Check local readiness at
`/healthz`; only an observed HTTP 200 response with `{"status":"ok"}` proves
the local process is ready.

The service exits on `SIGINT` or `SIGTERM` and fails instead of replacing a
process that already owns the configured port.

## Configure the machine-local tunnel runtime

Use the installed OpenAI `tunnel-client` runtime and keep credentials outside
the repository. Credential arguments should refer to machine-local environment or
file-backed secrets rather than literal keys committed to Git.

A representative runtime flow is:

```sh
tunnel-client runtimes create \
  --alias chatgpt-chat-skills \
  --admin-key env:OPENAI_ADMIN_KEY \
  --organization-id <organization-id>

tunnel-client runtimes connect \
  --alias chatgpt-chat-skills \
  --admin-key env:OPENAI_ADMIN_KEY \
  --organization-id <organization-id> \
  --runtime-api-key env:CONTROL_PLANE_API_KEY \
  --mcp-server-url http://127.0.0.1:2092/mcp

tunnel-client runtimes status chatgpt-chat-skills --json
```

If the installed client exposes different command help, follow that installed
version rather than copying stale flags blindly. Do not claim the tunnel is ready
unless its observed status reports the runtime process, local health, and remote
readiness as healthy.

Tunnel profiles, state, logs, and credential references belong in machine-local
config/state locations. This repository ignores `.env`, `.env.*`,
`.tunnel-client/`, and `.tunnel-client-bin` as defense in depth.

## Real ChatGPT smoke procedure

A healthy local process is necessary but does not prove that ChatGPT reached it.
When Developer Mode and Secure MCP Tunnel are available:

1. Start the built service and observe `/healthz` succeeding.
2. Create/connect the machine-local tunnel to the same loopback `/mcp` URL.
3. Observe the tunnel runtime as healthy and ready.
4. In ChatGPT Developer Mode, create or select the app backed by that tunnel.
5. Ask ChatGPT to discover the MCP tools and confirm the observed tool names are
   exactly `load_skill` and `list_skills`.
6. Invoke `list_skills` and record the returned public catalog.
7. Invoke `load_skill` for one returned canonical name and record that a real
   MCP response was observed through ChatGPT.
8. Re-check tunnel status after the request.

Record the actual returned status/tool results when this procedure is executed.
Do not turn this checklist into a success claim when the tunnel or ChatGPT
Developer Mode capability was unavailable.

## Troubleshooting

Stop the managed runtime without deleting its remote configuration:

```sh
tunnel-client runtimes stop chatgpt-chat-skills
```

Inspect runtime state with the installed client's status/diagnostic commands. If
the service reports `EADDRINUSE`, stop the process using the configured port or
choose a different loopback port consistently for both the service and tunnel.
