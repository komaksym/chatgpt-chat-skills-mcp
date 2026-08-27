import { startService } from "./service.js";

/** Parses and validates the configured service port. */
function readPort(value: string | undefined): number {
  if (value === undefined) return 2092;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }
  return port;
}

const service = await startService({ port: readPort(process.env.PORT) });
process.stdout.write(`Skills MCP listening at ${service.url}mcp\n`);

/** Stops the service cleanly for process termination signals. */
async function shutdown(): Promise<void> {
  await service.close();
  process.exitCode = 0;
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
