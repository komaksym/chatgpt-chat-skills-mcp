import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const ROOT = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const VERIFY = join(ROOT, "scripts", "verify-upstream.mjs");

function sha256(source: string): string {
  return createHash("sha256").update(source).digest("hex");
}

async function git(cwd: string, ...args: string[]): Promise<string> {
  const result = await execFileAsync("git", args, { cwd });
  return result.stdout.trim();
}

async function run(skillsRoot: string) {
  try {
    const result = await execFileAsync(process.execPath, [VERIFY, skillsRoot], {
      cwd: ROOT,
    });
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const failed = error as { code?: number; stdout?: string; stderr?: string };
    return {
      code: failed.code ?? 1,
      stdout: failed.stdout ?? "",
      stderr: failed.stderr ?? "",
    };
  }
}

async function fixture(roots: string[]): Promise<{
  bundleRoot: string;
  provenancePath: string;
  skillsRoot: string;
  sourcePath: string;
}> {
  const upstreamRoot = await mkdtemp(join(tmpdir(), "upstream-source-"));
  const skillsRoot = await mkdtemp(join(tmpdir(), "upstream-skills-"));
  roots.push(upstreamRoot, skillsRoot);

  await git(upstreamRoot, "init");
  await git(upstreamRoot, "config", "user.email", "fixture@example.com");
  await git(upstreamRoot, "config", "user.name", "Fixture");
  const upstreamPath = join(upstreamRoot, "skills", "example", "SKILL.md");
  await mkdir(dirname(upstreamPath), { recursive: true });
  await writeFile(upstreamPath, "PINNED UPSTREAM\n", "utf8");
  await git(upstreamRoot, "add", ".");
  await git(upstreamRoot, "commit", "-m", "pin fixture");
  const commit = await git(upstreamRoot, "rev-parse", "HEAD");

  const bundleRoot = join(skillsRoot, "alpha");
  const sourcePath = join(bundleRoot, "upstream.md");
  const provenancePath = join(bundleRoot, "provenance.json");
  await mkdir(bundleRoot, { recursive: true });
  await writeFile(sourcePath, "PINNED UPSTREAM\n", "utf8");
  await writeFile(
    provenancePath,
    JSON.stringify(
      {
        name: "alpha",
        visibility: "public",
        description: "Fixture.",
        dependencies: [],
        upstream: {
          repository: pathToFileURL(upstreamRoot).href,
          location: "skills/example/SKILL.md",
          commit,
        },
        license: "MIT",
        attribution: "Fixture",
        projection: {
          entrypoint: "upstream.md",
          sources: [
            {
              path: "upstream.md",
              upstreamPath: "skills/example/SKILL.md",
              sha256: sha256("PINNED UPSTREAM\n"),
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

  return { bundleRoot, provenancePath, skillsRoot, sourcePath };
}

describe("pinned upstream source verification", () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(
      roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
    );
  });

  it("accepts a committed snapshot that exactly matches the pinned upstream commit", async () => {
    const { skillsRoot } = await fixture(roots);

    const result = await run(skillsRoot);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("verified alpha/upstream.md");
  });

  it("rejects tampered source even when its local digest is updated to match", async () => {
    const { provenancePath, skillsRoot, sourcePath } = await fixture(roots);
    const tampered = "TAMPERED BUT LOCALLY REHASHED\n";
    await writeFile(sourcePath, tampered, "utf8");

    const provenance = JSON.parse(
      await (await import("node:fs/promises")).readFile(provenancePath, "utf8"),
    ) as {
      projection: { sources: Array<{ sha256: string }> };
    };
    provenance.projection.sources[0]!.sha256 = sha256(tampered);
    await writeFile(
      provenancePath,
      JSON.stringify(provenance, null, 2) + "\n",
      "utf8",
    );

    const result = await run(skillsRoot);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain(
      "alpha/upstream.md does not match pinned upstream",
    );
  });
});
