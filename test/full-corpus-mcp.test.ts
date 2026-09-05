import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, describe, expect, it } from "vitest";

import { REMOTE_EXECUTION_CONTRACT } from "../src/contract.js";
import {
  getPinnedSourceProvenance,
  parseSkillProvenance,
} from "../src/provenance.js";
import { startService, type RunningService } from "../src/service.js";

const SKILLS_ROOT = new URL("../skills/", import.meta.url);

interface Metadata {
  name: string;
  description: string;
  visibility: "public" | "hidden";
  dependencies: string[];
}

interface InstalledBundle {
  metadata: Metadata;
  runtime: string;
  provenance: string;
  license?: string;
}

async function installed(): Promise<InstalledBundle[]> {
  const entries = (await readdir(SKILLS_ROOT, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name));

  return Promise.all(
    entries.map(async (entry) => {
      const root = new URL(entry.name + "/", SKILLS_ROOT);
      const provenance = await readFile(new URL("provenance.json", root), "utf8");
      const parsed = parseSkillProvenance(provenance);
      if (!parsed.success) {
        throw new Error("Invalid provenance for " + entry.name + ".");
      }
      return {
        metadata: parsed.data,
        runtime: await readFile(new URL("runtime.md", root), "utf8"),
        provenance,
        license: getPinnedSourceProvenance(parsed.data)
          ? await readFile(new URL("LICENSE", root), "utf8")
          : undefined,
      };
    }),
  );
}

async function load(client: Client, name: string): Promise<string> {
  const result = CallToolResultSchema.parse(
    await client.callTool({ name: "load_skill", arguments: { name } }),
  );
  const block = result.content[0];
  if (!block || block.type !== "text") {
    throw new Error("Expected text for " + name);
  }
  return block.text;
}

describe("complete corpus through the production MCP boundary", () => {
  let service: RunningService | undefined;
  let client: Client | undefined;
  const roots: string[] = [];

  afterEach(async () => {
    await client?.close();
    await service?.close();
    client = undefined;
    service = undefined;
    await Promise.all(
      roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
    );
  });

  async function connect(skillsRoot?: string): Promise<Client> {
    service = await startService({ port: 0, skillsRoot });
    client = new Client({ name: "corpus-contract", version: "1.0.0" });
    await client.connect(
      new StreamableHTTPClientTransport(new URL("/mcp", service.url)),
    );
    return client;
  }

  it("exposes exactly two catalog-independent tools and lists only public skills", async () => {
    const connected = await connect();
    const tools = (await connected.listTools()).tools;

    expect(tools.map((tool) => tool.name)).toEqual(["load_skill", "list_skills"]);
    expect(JSON.stringify(tools)).not.toContain('"enum"');

    const bundles = await installed();
    const expected = bundles
      .filter((bundle) => bundle.metadata.visibility === "public")
      .map((bundle) => ({
        name: bundle.metadata.name,
        description: bundle.metadata.description,
      }))
      .sort((left, right) => left.name.localeCompare(right.name));

    const listing = await connected.callTool({
      name: "list_skills",
      arguments: {},
    });
    expect(listing.structuredContent).toEqual({ skills: expected });

    for (const bundle of bundles.filter(
      (item) => item.metadata.visibility === "hidden",
    )) {
      expect(JSON.stringify(listing)).not.toContain(
        '"name":"' + bundle.metadata.name + '"',
      );
    }
  });

  it("loads exactly one Runtime Envelope and only the requested Generated Runtime", async () => {
    const connected = await connect();

    for (const bundle of await installed()) {
      const loaded = await load(connected, bundle.metadata.name);
      expect(loaded).toBe(
        REMOTE_EXECUTION_CONTRACT +
          "\n\n# " +
          bundle.metadata.name +
          "\n\n" +
          bundle.runtime.trim() +
          "\n",
      );
      expect(loaded.split(REMOTE_EXECUTION_CONTRACT)).toHaveLength(2);
      expect(loaded).not.toContain(bundle.provenance.trim());
      if (bundle.license) {
        expect(loaded).not.toContain(bundle.license.trim());
      }
    }
  });

  it("keeps separately named Dependency Skills out of parent payloads", async () => {
    const connected = await connect();
    const bundles = await installed();
    const byName = new Map<string, InstalledBundle>(
      bundles.map((bundle) => [bundle.metadata.name, bundle] as const),
    );

    for (const bundle of bundles) {
      const loaded = await load(connected, bundle.metadata.name);
      for (const dependency of bundle.metadata.dependencies) {
        const child = byName.get(dependency);
        expect(child).toBeDefined();
        expect(loaded).not.toContain(child!.runtime.trim());
      }
    }
  });

  it("loads hidden skills exactly and rejects unknown or traversal names concisely", async () => {
    const connected = await connect();
    const bundles = await installed();

    for (const bundle of bundles.filter(
      (item) => item.metadata.visibility === "hidden",
    )) {
      expect(await load(connected, bundle.metadata.name)).toContain(
        "# " + bundle.metadata.name,
      );
    }

    for (const name of [
      "unknown",
      "../handoff",
      "/etc/passwd",
      "nested/skill",
      "nested\\skill",
    ]) {
      const result = CallToolResultSchema.parse(
        await connected.callTool({
          name: "load_skill",
          arguments: { name },
        }),
      );
      expect(result.isError).toBe(true);
      expect(result.content).toEqual([
        { type: "text", text: "Unknown skill: " + name + "." },
      ]);
    }
  });

  it("keeps serialized tool definitions constant for a large dummy catalog", async () => {
    const real = await connect();
    const baseline = JSON.stringify((await real.listTools()).tools);
    await client?.close();
    await service?.close();
    client = undefined;
    service = undefined;

    const root = await mkdtemp(join(tmpdir(), "large-catalog-"));
    roots.push(root);

    for (let index = 0; index < 100; index += 1) {
      const name = "dummy-" + String(index).padStart(3, "0");
      const bundle = join(root, name);
      await mkdir(bundle, { recursive: true });
      await writeFile(
        join(bundle, "runtime.md"),
        "Runtime " + name + ".\n",
        "utf8",
      );
      await writeFile(
        join(bundle, "provenance.json"),
        JSON.stringify(
          {
            name,
            visibility: "public",
            description: "Dummy skill " + index + ".",
            dependencies: [],
            sourceProvenance: {
              type: "pinned-github",
              repository: "https://github.com/example/skills",
              commit: "a".repeat(40),
              license: "MIT",
              attribution: "Example",
            },
            projection: {
              entrypoint: "upstream.md",
              sources: [
                {
                  path: "upstream.md",
                  upstreamPath: "skills/" + name + "/SKILL.md",
                  sha256: "b".repeat(64),
                },
              ],
              changeRecords: [],
            },
          },
          null,
          2,
        ) + "\n",
        "utf8",
      );
    }

    const large = await connect(root);
    expect(JSON.stringify((await large.listTools()).tools)).toBe(baseline);
  });
});
