import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { createServer, type Server } from "node:net";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

const MAIN_PATH = fileURLToPath(new URL("../dist/main.js", import.meta.url));
const running = new Set<ChildProcess>();

interface LoopbackListener {
  port: number;
  server: Server;
}

/** Starts an ephemeral TCP listener on loopback. */
async function listenOnLoopback(): Promise<LoopbackListener> {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (address === null || typeof address === "string") {
    server.close();
    throw new Error("Expected a TCP listener");
  }
  return { port: address.port, server };
}

/** Returns an unused loopback port selected by the operating system. */
async function findFreePort(): Promise<number> {
  const { port, server } = await listenOnLoopback();
  server.close();
  await once(server, "close");
  return port;
}

/** Starts the built production entrypoint with an optional port override. */
function startProcess(port?: number): ChildProcess {
  const env = { ...process.env };
  if (port === undefined) delete env.PORT;
  else env.PORT = String(port);
  const child = spawn(process.execPath, [MAIN_PATH], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  running.add(child);

  /** Removes the completed child from cleanup tracking. */
  function forgetProcess(): void {
    running.delete(child);
  }

  child.once("exit", forgetProcess);
  return child;
}

/** Collects all text emitted by a process stream. */
async function readAll(stream: NodeJS.ReadableStream): Promise<string> {
  let output = "";
  for await (const chunk of stream) output += String(chunk);
  return output;
}

/** Resolves when a stream contains the expected text or the process exits. */
async function waitForText(
  child: ChildProcess,
  stream: NodeJS.ReadableStream,
  expected: string,
): Promise<string> {
  let output = "";
  for await (const chunk of stream) {
    output += String(chunk);
    if (output.includes(expected)) return output;
  }
  throw new Error(`Process exited before emitting ${expected}: ${output}`);
}

/** Stops any child left behind by a failed lifecycle assertion. */
async function cleanupProcesses(): Promise<void> {
  /** Force-stops one child left behind by a failed assertion. */
  async function stopProcess(child: ChildProcess): Promise<void> {
    child.kill("SIGKILL");
    await once(child, "exit");
  }

  await Promise.all([...running].map(stopProcess));
}

afterEach(cleanupProcesses);

/** Terminates a service process and asserts a clean exit. */
async function stopProcessCleanly(child: ChildProcess): Promise<void> {
  child.kill("SIGTERM");
  await expect(once(child, "exit")).resolves.toEqual([0, null]);
}

/** Defines black-box checks against the built production process. */
function defineLifecycleSuite(): void {
  /** Proves the documented default production port. */
  async function usesDefaultPort(): Promise<void> {
    const child = startProcess();
    const origin = "http://127.0.0.1:2092";

    await waitForText(child, child.stdout!, `${origin}/mcp`);
    const response = await fetch(`${origin}/healthz`);
    expect(response.status).toBe(200);

    await stopProcessCleanly(child);
  }

  /** Proves override, health, loopback, and clean-shutdown behavior. */
  async function followsConfiguredLifecycle(): Promise<void> {
    const port = await findFreePort();
    const child = startProcess(port);
    const origin = `http://127.0.0.1:${port}`;

    await waitForText(child, child.stdout!, `${origin}/mcp`);
    const response = await fetch(`${origin}/healthz`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });

    await stopProcessCleanly(child);
  }

  /** Proves startup fails safely when another process owns the port. */
  async function refusesOccupiedPort(): Promise<void> {
    const { port, server: blocker } = await listenOnLoopback();
    const child = startProcess(port);
    const stderr = readAll(child.stderr!);
    const [code] = await once(child, "exit");
    expect(code).not.toBe(0);
    expect(await stderr).toContain("EADDRINUSE");

    blocker.close();
    await once(blocker, "close");
  }

  it("uses port 2092 when no port override is configured", usesDefaultPort);
  it(
    "starts on the configured loopback port, reports health, and shuts down cleanly",
    followsConfiguredLifecycle,
  );
  it(
    "fails instead of replacing a process on an occupied configured port",
    refusesOccupiedPort,
  );
}

describe("production service lifecycle", defineLifecycleSuite);
