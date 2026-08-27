# ChatGPT Chat Skills MCP

A local TypeScript MCP service that exposes explicitly selected engineering
skills to ChatGPT without embedding the skill catalog in tool schemas.

## Requirements

- Node.js 20 or newer
- npm 10 or newer

## Development

```sh
npm install
npm run lint
npm run typecheck
npm test
npm run build
```

Start the built service on `127.0.0.1:2092`:

```sh
npm start
```

Set `PORT` to use another loopback port. The MCP endpoint is `/mcp`.

## Current public skill

- `handoff` — Create a compact continuation brief for another conversation.

The MCP surface contains exactly `load_skill` and `list_skills`. Call
`load_skill` with the exact canonical name `handoff`; its input is deliberately a
plain string so the installed catalog does not occupy every conversation's tool
schema.
