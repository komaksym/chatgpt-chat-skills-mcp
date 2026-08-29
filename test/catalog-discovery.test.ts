import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, describe, expect, it } from "vitest";

import { startService, type RunningService } from "../src/service.js";

interface FixtureSkill {
  dependencies?: string[];
  description: string;
  directory?: string;
  name: string;
  runtime: string;
  visibility: "hidden" | "public";
}

/** Creates one valid skill bundle inside a temporary fixture store. */
async function createBundle(root: string, skill: FixtureSkill): Promise<void> {
  const bundle = join(root, skill.directory ?? skill.name);
  await mkdir(bundle, { recursive: true });
  await writeFile(join(bundle, "runtime.md"), skill.runtime, "utf8");
  await writeFile(
    join(bundle, "provenance.json"),
    JSON.stringify(
      {
        name: skill.name,
        visibility: skill.visibility,
        description: skill.description,
        dependencies: skill.dependencies ?? [],
        upstream: {
          repository: "https://github.com/example/skills",
          location: `skills/${skill.name}/SKILL.md`,
          commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
        license: "MIT",
        attribution: "Fixture author",
        projection: {
          entrypoint: "upstream.md",
          sources: [
            {
              path: "upstream.md",
              sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            },
          ],
          changeRecords: [],
        },
      },
      null,
      2,
    ),
    "utf8",
  );
}

/** Defines metadata-driven discovery behavior at the MCP boundary. */
function defineCatalogDiscoverySuite(): void {
  const roots: string[] = [];
  let service: RunningService | undefined;
  let client: Client | undefined;

  /** Releases clients, listeners, and temporary fixture stores. */
  async function cleanup(): Promise<void> {
    await client?.close();
    await service?.close();
    for (const root of roots) {
      await rm(root, { recursive: true, force: true });
    }
  }

  afterEach(cleanup);

  /** Proves metadata controls visibility while exact hidden loads remain possible. */
  async function discoversPublicAndHiddenSkills(): Promise<void> {
    const root = await mkdtemp(join(tmpdir(), "skills-mcp-"));
    roots.push(root);
    await createBundle(root, {
      name: "public-workflow",
      visibility: "public",
      description: "Run the public workflow.",
      runtime: "PUBLIC_RUNTIME_MARKER",
      dependencies: ["hidden-helper"],
    });
    await createBundle(root, {
      name: "hidden-helper",
      visibility: "hidden",
      description: "Support the public workflow.",
      runtime: "HIDDEN_RUNTIME_MARKER",
    });

    service = await startService({ port: 0, skillsRoot: root });
    client = new Client({ name: "catalog-test", version: "1.0.0" });
    await client.connect(
      new StreamableHTTPClientTransport(new URL("/mcp", service.url)),
    );

    const listing = await client.callTool({ name: "list_skills", arguments: {} });
    expect(listing.structuredContent).toEqual({
      skills: [
        {
          name: "public-workflow",
          description: "Run the public workflow.",
        },
      ],
    });

    const loaded = CallToolResultSchema.parse(
      await client.callTool({
        name: "load_skill",
        arguments: { name: "hidden-helper" },
      }),
    );
    expect(loaded.content).toEqual([
      {
        type: "text",
        text: expect.stringContaining("HIDDEN_RUNTIME_MARKER"),
      },
    ]);
    expect(JSON.stringify(loaded)).not.toContain("PUBLIC_RUNTIME_MARKER");
    expect(JSON.stringify(loaded)).not.toContain("Fixture author");
    expect(JSON.stringify(loaded)).not.toContain(
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );
    expect(JSON.stringify(listing)).not.toContain("HIDDEN_RUNTIME_MARKER");
    expect(JSON.stringify(listing)).not.toContain("Fixture author");
    expect(
      await readFile(join(root, "hidden-helper", "runtime.md"), "utf8"),
    ).toBe("HIDDEN_RUNTIME_MARKER");
  }

  /** Proves untrusted identifiers cannot address files or discovery information. */
  async function rejectsUnknownAndPathShapedNames(): Promise<void> {
    const base = await mkdtemp(join(tmpdir(), "skills-mcp-"));
    roots.push(base);
    const root = join(base, "skills");
    await mkdir(root);
    await createBundle(root, {
      name: "safe-skill",
      visibility: "public",
      description: "Safe fixture.",
      runtime: "SAFE_RUNTIME_MARKER",
    });
    await writeFile(join(base, "secret.txt"), "OUTSIDE_SECRET_MARKER", "utf8");

    service = await startService({ port: 0, skillsRoot: root });
    client = new Client({ name: "security-test", version: "1.0.0" });
    await client.connect(
      new StreamableHTTPClientTransport(new URL("/mcp", service.url)),
    );

    const names = [
      "unknown",
      "../secret.txt",
      "/etc/passwd",
      "nested/skill",
      "nested\\skill",
      "https://example.com/skill",
      "%2e%2e%2fsecret.txt",
      "bad_name",
      ".",
      "..",
    ];
    for (const name of names) {
      const result = CallToolResultSchema.parse(
        await client.callTool({ name: "load_skill", arguments: { name } }),
      );
      expect(result.isError).toBe(true);
      expect(result.content).toEqual([
        { type: "text", text: `Unknown skill: ${name}.` },
      ]);
      expect(JSON.stringify(result)).not.toContain("safe-skill");
      expect(JSON.stringify(result)).not.toContain("OUTSIDE_SECRET_MARKER");
    }
  }

  /** Proves a post-start symlink swap cannot redirect a runtime read. */
  async function rejectsRuntimeSymlinkSwaps(): Promise<void> {
    const base = await mkdtemp(join(tmpdir(), "skills-mcp-"));
    roots.push(base);
    const root = join(base, "skills");
    await mkdir(root);
    await createBundle(root, {
      name: "safe-skill",
      visibility: "public",
      description: "Safe fixture.",
      runtime: "ORIGINAL_RUNTIME_MARKER",
    });
    const secret = join(base, "secret.txt");
    await writeFile(secret, "OUTSIDE_SECRET_MARKER", "utf8");

    service = await startService({ port: 0, skillsRoot: root });
    client = new Client({ name: "symlink-test", version: "1.0.0" });
    await client.connect(
      new StreamableHTTPClientTransport(new URL("/mcp", service.url)),
    );
    const runtime = join(root, "safe-skill", "runtime.md");
    await rm(runtime);
    await symlink(secret, runtime);

    const result = CallToolResultSchema.parse(
      await client.callTool({
        name: "load_skill",
        arguments: { name: "safe-skill" },
      }),
    );
    expect(JSON.stringify(result)).toContain("ORIGINAL_RUNTIME_MARKER");
    expect(JSON.stringify(result)).not.toContain("OUTSIDE_SECRET_MARKER");
  }

  /** Proves a post-start bundle-directory swap cannot redirect a runtime read. */
  async function rejectsBundleDirectorySymlinkSwaps(): Promise<void> {
    const base = await mkdtemp(join(tmpdir(), "skills-mcp-"));
    roots.push(base);
    const root = join(base, "skills");
    const outside = join(base, "outside");
    await mkdir(root);
    await mkdir(outside);
    await createBundle(root, {
      name: "safe-skill",
      visibility: "public",
      description: "Safe fixture.",
      runtime: "ORIGINAL_RUNTIME_MARKER",
    });
    await writeFile(join(outside, "runtime.md"), "OUTSIDE_SECRET_MARKER", "utf8");

    service = await startService({ port: 0, skillsRoot: root });
    client = new Client({ name: "directory-symlink-test", version: "1.0.0" });
    await client.connect(
      new StreamableHTTPClientTransport(new URL("/mcp", service.url)),
    );
    const bundle = join(root, "safe-skill");
    await rm(bundle, { recursive: true });
    await symlink(outside, bundle, "dir");

    const result = CallToolResultSchema.parse(
      await client.callTool({
        name: "load_skill",
        arguments: { name: "safe-skill" },
      }),
    );
    expect(JSON.stringify(result)).toContain("ORIGINAL_RUNTIME_MARKER");
    expect(JSON.stringify(result)).not.toContain("OUTSIDE_SECRET_MARKER");
  }

  /** Proves catalog cardinality never changes serialized tool definitions. */
  async function keepsToolSchemasCatalogIndependent(): Promise<void> {
    const smallRoot = await mkdtemp(join(tmpdir(), "skills-mcp-small-"));
    const largeRoot = await mkdtemp(join(tmpdir(), "skills-mcp-large-"));
    roots.push(smallRoot, largeRoot);
    await createBundle(smallRoot, {
      name: "baseline",
      visibility: "public",
      description: "Baseline fixture.",
      runtime: "baseline",
    });
    await createBundle(largeRoot, {
      name: "baseline",
      visibility: "public",
      description: "Baseline fixture.",
      runtime: "baseline",
    });
    for (let index = 0; index < 100; index += 1) {
      const suffix = index.toString().padStart(3, "0");
      await createBundle(largeRoot, {
        name: `dummy-${suffix}`,
        visibility: "public",
        description: `Dummy fixture ${suffix}.`,
        runtime: `dummy runtime ${suffix}`,
      });
    }

    service = await startService({ port: 0, skillsRoot: smallRoot });
    client = new Client({ name: "small-schema-test", version: "1.0.0" });
    await client.connect(
      new StreamableHTTPClientTransport(new URL("/mcp", service.url)),
    );
    const smallTools = JSON.stringify((await client.listTools()).tools);
    await client.close();
    client = undefined;
    await service.close();
    service = undefined;

    service = await startService({ port: 0, skillsRoot: largeRoot });
    client = new Client({ name: "large-schema-test", version: "1.0.0" });
    await client.connect(
      new StreamableHTTPClientTransport(new URL("/mcp", service.url)),
    );
    const largeTools = JSON.stringify((await client.listTools()).tools);

    expect(largeTools).toBe(smallTools);
  }


  /** Proves the catalog rejects the retired free-text provenance format. */
  async function rejectsLegacyFreeTextProvenance(): Promise<void> {
    const root = await mkdtemp(join(tmpdir(), "skills-mcp-"));
    roots.push(root);
    const bundle = join(root, "legacy");
    await mkdir(bundle);
    await writeFile(join(bundle, "runtime.md"), "legacy runtime", "utf8");
    await writeFile(
      join(bundle, "provenance.json"),
      JSON.stringify(
        {
          name: "legacy",
          visibility: "public",
          description: "Legacy fixture.",
          dependencies: [],
          upstream: {
            repository: "https://github.com/example/skills",
            location: "skills/legacy/SKILL.md",
            commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          },
          license: "MIT",
          attribution: "Fixture author",
          adaptations: ["free-text adaptation"],
        },
        null,
        2,
      ),
      "utf8",
    );

    await expect(startService({ port: 0, skillsRoot: root })).rejects.toThrow(
      'Invalid skill bundle "legacy": metadata is invalid.',
    );
  }

  /** Proves malformed JSON prevents the service from listening. */
  async function rejectsMalformedMetadata(): Promise<void> {
    const root = await mkdtemp(join(tmpdir(), "skills-mcp-"));
    roots.push(root);
    const bundle = join(root, "broken");
    await mkdir(bundle);
    await writeFile(join(bundle, "provenance.json"), "{", "utf8");
    await writeFile(join(bundle, "runtime.md"), "runtime", "utf8");

    await expect(startService({ port: 0, skillsRoot: root })).rejects.toThrow(
      'Invalid skill bundle "broken": provenance.json must contain valid JSON.',
    );
  }

  /** Proves validation reports the same first invalid bundle by canonical path order. */
  async function reportsValidationFailuresDeterministically(): Promise<void> {
    const root = await mkdtemp(join(tmpdir(), "skills-mcp-"));
    roots.push(root);
    for (const directory of ["z-broken", "a-broken"]) {
      const bundle = join(root, directory);
      await mkdir(bundle);
      await writeFile(join(bundle, "provenance.json"), "{", "utf8");
      await writeFile(join(bundle, "runtime.md"), "runtime", "utf8");
    }

    await expect(startService({ port: 0, skillsRoot: root })).rejects.toThrow(
      'Invalid skill bundle "a-broken": provenance.json must contain valid JSON.',
    );
  }

  /** Proves two bundles cannot claim the same canonical identifier. */
  async function rejectsDuplicateNames(): Promise<void> {
    const root = await mkdtemp(join(tmpdir(), "skills-mcp-"));
    roots.push(root);
    await createBundle(root, {
      directory: "first",
      name: "duplicate",
      visibility: "public",
      description: "First bundle.",
      runtime: "first",
    });
    await createBundle(root, {
      directory: "second",
      name: "duplicate",
      visibility: "hidden",
      description: "Second bundle.",
      runtime: "second",
    });

    await expect(startService({ port: 0, skillsRoot: root })).rejects.toThrow(
      "Duplicate skill name: duplicate.",
    );
  }

  /** Proves a declared bundle must contain adapted runtime content. */
  async function rejectsMissingRuntime(): Promise<void> {
    const root = await mkdtemp(join(tmpdir(), "skills-mcp-"));
    roots.push(root);
    await createBundle(root, {
      name: "missing-runtime",
      visibility: "public",
      description: "Missing runtime fixture.",
      runtime: "temporary",
    });
    await rm(join(root, "missing-runtime", "runtime.md"));

    await expect(startService({ port: 0, skillsRoot: root })).rejects.toThrow(
      'Invalid skill bundle "missing-runtime": Missing runtime.md.',
    );
  }

  /** Proves every declared dependency resolves inside the discovered store. */
  async function rejectsUnresolvedDependencies(): Promise<void> {
    const root = await mkdtemp(join(tmpdir(), "skills-mcp-"));
    roots.push(root);
    await createBundle(root, {
      name: "dependent",
      visibility: "public",
      description: "Dependent fixture.",
      runtime: "runtime",
      dependencies: ["absent-helper"],
    });

    await expect(startService({ port: 0, skillsRoot: root })).rejects.toThrow(
      "Skill dependent depends on unknown skill: absent-helper.",
    );
  }

  it(
    "discovers public skills and exact-loadable hidden skills from metadata",
    discoversPublicAndHiddenSkills,
  );
  it("rejects legacy free-text provenance", rejectsLegacyFreeTextProvenance);
  it("rejects malformed metadata", rejectsMalformedMetadata);
  it(
    "reports validation failures deterministically",
    reportsValidationFailuresDeterministically,
  );
  it("rejects duplicate canonical names", rejectsDuplicateNames);
  it("rejects missing runtime content", rejectsMissingRuntime);
  it("rejects unresolved dependencies", rejectsUnresolvedDependencies);
  it("rejects unknown and path-shaped names concisely", rejectsUnknownAndPathShapedNames);
  it("rejects runtime symlink swaps", rejectsRuntimeSymlinkSwaps);
  it(
    "rejects bundle-directory symlink swaps",
    rejectsBundleDirectorySymlinkSwaps,
  );
  it("keeps tool schemas independent of catalog size", keepsToolSchemasCatalogIndependent);
}

describe("skill catalog discovery", defineCatalogDiscoverySuite);
