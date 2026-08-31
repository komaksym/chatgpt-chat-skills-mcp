import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterEach, describe, expect, it } from "vitest";

import { generateSkillRuntime } from "../src/projection.js";
import { parseSkillProvenance } from "../src/provenance.js";
import { startService, type RunningService } from "../src/service.js";

const COMMIT = "a".repeat(40);

function sha256(source: string): string {
  return createHash("sha256").update(source).digest("hex");
}

function legacyV1Provenance() {
  return {
    name: "legacy-v1",
    visibility: "public",
    description: "Legacy v1 fixture.",
    dependencies: [],
    upstream: {
      repository: "https://github.com/example/skills",
      location: "skills/legacy-v1/SKILL.md",
      commit: COMMIT,
    },
    license: "MIT",
    attribution: "Fixture author",
    projection: {
      entrypoint: "upstream.md",
      sources: [
        {
          path: "upstream.md",
          upstreamPath: "skills/legacy-v1/SKILL.md",
          sha256: "b".repeat(64),
        },
      ],
      changeRecords: [
        {
          allowedRuntimeChange: "equivalent-mechanism",
          source: "upstream.md",
          evidence: {
            targetRuntimeProfile: "chatgpt-web-mcp-v1",
            constraints: ["no-filesystem"],
            incompatibility: "Legacy v1 runtime evidence.",
          },
          transform: {
            type: "replace-exact",
            match: "OLD",
            replacement: "NEW",
          },
        },
      ],
    },
  };
}

describe("v2 runtime profiles and explicit Source Provenance", () => {
  const roots: string[] = [];
  let client: Client | undefined;
  let service: RunningService | undefined;

  afterEach(async () => {
    await client?.close();
    await service?.close();
    client = undefined;
    service = undefined;
    await Promise.all(
      roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
    );
  });

  it("keeps legacy v1 metadata valid without widening v1 constraints", () => {
    const legacy = legacyV1Provenance();
    expect(parseSkillProvenance(JSON.stringify(legacy)).success).toBe(true);

    const invalid = structuredClone(legacy);
    invalid.projection.changeRecords[0]!.evidence.constraints = [
      "chatgpt-sandbox",
    ];
    expect(parseSkillProvenance(JSON.stringify(invalid))).toEqual({
      success: false,
      reason: "invalid-metadata",
    });
  });

  it("accepts explicit pinned GitHub provenance and preserves local source integrity", async () => {
    const repositoryRoot = await mkdtemp(join(tmpdir(), "v2-pinned-"));
    roots.push(repositoryRoot);
    const skillsRoot = join(repositoryRoot, "skills");
    const bundleRoot = join(skillsRoot, "pinned-v2");
    await mkdir(bundleRoot, { recursive: true });

    const source = "PINNED SOURCE\n";
    await writeFile(join(bundleRoot, "source.md"), source, "utf8");
    await writeFile(
      join(bundleRoot, "provenance.json"),
      JSON.stringify(
        {
          name: "pinned-v2",
          visibility: "public",
          description: "Pinned v2 fixture.",
          dependencies: [],
          sourceProvenance: {
            type: "pinned-github",
            repository: "https://github.com/example/skills",
            commit: COMMIT,
            license: "MIT",
            attribution: "Fixture author",
          },
          projection: {
            entrypoint: "source.md",
            sources: [
              {
                path: "source.md",
                upstreamPath: "skills/pinned-v2/SKILL.md",
                sha256: sha256(source),
              },
            ],
            changeRecords: [
              {
                allowedRuntimeChange: "equivalent-mechanism",
                source: "source.md",
                evidence: {
                  targetRuntimeProfile: "chatgpt-web-mcp-v2",
                  constraints: ["connected-github"],
                  incompatibility: "The target uses connected GitHub.",
                },
                transform: {
                  type: "replace-exact",
                  match: "PINNED",
                  replacement: "VERIFIED",
                },
              },
            ],
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    await expect(
      generateSkillRuntime("pinned-v2", { repositoryRoot, skillsRoot }),
    ).resolves.toBe("VERIFIED SOURCE\n");

    await writeFile(join(bundleRoot, "source.md"), "TAMPERED SOURCE\n", "utf8");
    await expect(
      generateSkillRuntime("pinned-v2", { repositoryRoot, skillsRoot }),
    ).rejects.toThrow("Source integrity mismatch for pinned-v2/source.md.");
  });

  it("projects intentionally absent provenance deterministically through the unchanged MCP surface", async () => {
    const repositoryRoot = await mkdtemp(join(tmpdir(), "v2-absent-"));
    roots.push(repositoryRoot);
    const skillsRoot = join(repositoryRoot, "skills");
    const bundleRoot = join(skillsRoot, "absent-v2");
    await mkdir(bundleRoot, { recursive: true });

    await writeFile(join(bundleRoot, "source.md"), "Use local temp files.\n", "utf8");
    const provenance = {
      name: "absent-v2",
      visibility: "public",
      description: "Absent-source v2 fixture.",
      dependencies: [],
      sourceProvenance: {
        type: "absent",
      },
      projection: {
        entrypoint: "source.md",
        sources: [{ path: "source.md" }],
        changeRecords: [
          {
            allowedRuntimeChange: "equivalent-mechanism",
            source: "source.md",
            evidence: {
              targetRuntimeProfile: "chatgpt-web-mcp-v2",
              constraints: ["chatgpt-sandbox"],
              incompatibility: "Ephemeral work belongs in the ChatGPT sandbox.",
            },
            transform: {
              type: "replace-exact",
              match: "local temp files",
              replacement: "ChatGPT sandbox files",
            },
          },
        ],
      },
    };
    await writeFile(
      join(bundleRoot, "provenance.json"),
      JSON.stringify(provenance, null, 2),
      "utf8",
    );

    const first = await generateSkillRuntime("absent-v2", {
      repositoryRoot,
      skillsRoot,
    });
    const second = await generateSkillRuntime("absent-v2", {
      repositoryRoot,
      skillsRoot,
    });
    expect(first).toBe("Use ChatGPT sandbox files.\n");
    expect(second).toBe(first);
    await writeFile(join(bundleRoot, "runtime.md"), first, "utf8");

    service = await startService({ port: 0, skillsRoot });
    client = new Client({ name: "v2-source-provenance", version: "1.0.0" });
    await client.connect(
      new StreamableHTTPClientTransport(new URL("/mcp", service.url)),
    );

    expect((await client.listTools()).tools.map((tool) => tool.name)).toEqual([
      "load_skill",
      "list_skills",
    ]);

    const listing = await client.callTool({ name: "list_skills", arguments: {} });
    expect(listing.structuredContent).toEqual({
      skills: [
        {
          name: "absent-v2",
          description: "Absent-source v2 fixture.",
        },
      ],
    });

    const loaded = await client.callTool({
      name: "load_skill",
      arguments: { name: "absent-v2" },
    });
    expect(JSON.stringify(loaded)).toContain("Use ChatGPT sandbox files.");
    expect(JSON.stringify(loaded)).not.toContain("sourceProvenance");
    expect(JSON.stringify(loaded)).not.toContain('"type":"absent"');
  });

  it("rejects fabricated pinned fields for intentionally absent provenance", () => {
    const absent = {
      name: "absent-v2",
      visibility: "public",
      description: "Absent-source fixture.",
      dependencies: [],
      sourceProvenance: { type: "absent" },
      license: "UNKNOWN",
      projection: {
        entrypoint: "source.md",
        sources: [
          {
            path: "source.md",
            sha256: "b".repeat(64),
          },
        ],
        changeRecords: [],
      },
    };

    expect(parseSkillProvenance(JSON.stringify(absent))).toEqual({
      success: false,
      reason: "invalid-metadata",
    });
  });
});
