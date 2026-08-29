import { createHash } from "node:crypto";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  checkUpstreamUpdates,
  type UpstreamClient,
} from "../src/upstream-maintenance.js";

const OLD = "1111111111111111111111111111111111111111";
const NEXT = "2222222222222222222222222222222222222222";
const ENTRY = "# Example\n\nSee [guide](GUIDE.md).\n";
const CHANGED_ENTRY = "# Example\n\nSee [guide](GUIDE.md).\n\nNEW RULE\n";
const GUIDE = "GUIDE OLD\n";
const NEW_GUIDE = "GUIDE NEW\n";

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function evidence(incompatibility: string) {
  return {
    targetRuntimeProfile: "chatgpt-web-mcp-v1",
    constraints: ["only-load-skill-and-list-skills"],
    incompatibility,
  };
}

interface FixtureOptions {
  regenerationFailure?: boolean;
  temporaryFix?: boolean;
}

async function fixture(
  root: string,
  options: FixtureOptions = {},
): Promise<string> {
  const skillsRoot = join(root, "skills");
  const bundleRoot = join(skillsRoot, "example");
  await mkdir(bundleRoot, { recursive: true });
  await writeFile(join(bundleRoot, "upstream.md"), ENTRY, "utf8");
  await writeFile(join(bundleRoot, "upstream-guide.md"), GUIDE, "utf8");

  const changeRecords: unknown[] = [
    {
      allowedRuntimeChange: "inline-supporting-document",
      source: "upstream-guide.md",
      evidence: evidence("The fixture runtime inlines its Supporting Document."),
      transform: { type: "append-source", separator: "\n---\n\n" },
    },
  ];
  let runtime = ENTRY + "\n---\n\n" + GUIDE;

  if (options.regenerationFailure) {
    const original = ENTRY + "\nOLD RULE\n";
    await writeFile(join(bundleRoot, "upstream.md"), original, "utf8");
    changeRecords.unshift({
      allowedRuntimeChange: "equivalent-mechanism",
      source: "upstream.md",
      evidence: evidence("The fixture adapts one exact upstream rule."),
      transform: {
        type: "replace-exact",
        match: "OLD RULE",
        replacement: "ADAPTED RULE",
      },
    });
    runtime = ENTRY + "\nADAPTED RULE\n\n---\n\n" + GUIDE;
  }

  const entry = await readFile(join(bundleRoot, "upstream.md"), "utf8");
  const projection: Record<string, unknown> = {
    entrypoint: "upstream.md",
    sources: [
      {
        path: "upstream.md",
        upstreamPath: "skills/example/SKILL.md",
        sha256: digest(entry),
      },
      {
        path: "upstream-guide.md",
        upstreamPath: "skills/example/GUIDE.md",
        sha256: digest(GUIDE),
      },
    ],
    changeRecords,
  };

  if (options.temporaryFix) {
    projection.temporaryUpstreamFix = {
      upstreamCommit: OLD,
      source: "upstream.md",
      adr: "docs/adr/example-fix.md",
      test: "test/example-fix.test.ts",
      transform: {
        type: "replace-exact",
        match: "# Example",
        replacement: "# Fixed Example",
      },
    };
    await mkdir(join(root, "docs", "adr"), { recursive: true });
    await mkdir(join(root, "test"), { recursive: true });
    await writeFile(join(root, "docs", "adr", "example-fix.md"), "# fix\n", "utf8");
    await writeFile(join(root, "test", "example-fix.test.ts"), "// fix\n", "utf8");
    runtime = runtime.replace("# Example", "# Fixed Example");
  }

  await writeFile(join(bundleRoot, "runtime.md"), runtime, "utf8");
  await writeFile(
    join(bundleRoot, "provenance.json"),
    JSON.stringify(
      {
        name: "example",
        visibility: "public",
        description: "Fixture skill.",
        dependencies: [],
        upstream: {
          repository: "https://github.com/example/skills",
          location: "skills/example/SKILL.md",
          commit: OLD,
        },
        license: "MIT",
        attribution: "Fixture",
        projection,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
  return skillsRoot;
}

interface UpstreamOptions {
  changed?: boolean;
  entryChanged?: boolean;
  extraSupportingDocument?: boolean;
  oldRule?: boolean;
}

function upstream(options: UpstreamOptions = {}): UpstreamClient {
  const changed = options.changed ?? false;
  return {
    async getFile(_repository, path, commit) {
      if (path === "skills/example/SKILL.md") {
        if (commit === OLD && options.oldRule) {
          return ENTRY + "\nOLD RULE\n";
        }
        if (changed && options.entryChanged && commit === NEXT) {
          return options.extraSupportingDocument
            ? CHANGED_ENTRY + "\nSee [extra](EXTRA.md).\n"
            : CHANGED_ENTRY;
        }
        return ENTRY;
      }
      if (path === "skills/example/GUIDE.md") {
        return changed && commit === NEXT ? NEW_GUIDE : GUIDE;
      }
      if (
        path === "skills/example/EXTRA.md" &&
        changed &&
        options.extraSupportingDocument &&
        commit === NEXT
      ) {
        return "EXTRA\n";
      }
      throw new Error(`unexpected upstream path: ${path}@${commit}`);
    },
    async getLatestCommit(_repository, path) {
      if (!changed) return OLD;
      if (path === "skills/example/GUIDE.md") return NEXT;
      return options.entryChanged ? NEXT : OLD;
    },
  };
}

describe("reviewable upstream Mechanical Projection updates", () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(
      roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
    );
  });

  async function setup(options?: FixtureOptions) {
    const root = await mkdtemp(join(tmpdir(), "projection-update-"));
    roots.push(root);
    return { root, skillsRoot: await fixture(root, options) };
  }

  it("does nothing when every pinned upstream source is unchanged", async () => {
    const { root, skillsRoot } = await setup();
    const result = await checkUpstreamUpdates({
      repositoryRoot: root,
      skillsRoot,
      upstream: upstream(),
    });

    expect(result.changed).toBe(false);
    expect(result.blocked).toBe(false);
    expect(result.updates).toEqual([]);
  });

  it("vendors changed sources and regenerates through the production generator", async () => {
    const { root, skillsRoot } = await setup();
    const result = await checkUpstreamUpdates({
      repositoryRoot: root,
      skillsRoot,
      upstream: upstream({ changed: true }),
    });

    expect(result.changed).toBe(true);
    expect(result.blocked).toBe(false);
    expect(result.report).toContain(`Old pin: ${OLD}`);
    expect(result.report).toContain(`New pin: ${NEXT}`);
    expect(result.report).toContain("-GUIDE OLD");
    expect(result.report).toContain("+GUIDE NEW");
    expect(result.report).toContain("### Upstream source changes");
    expect(result.report).toContain("### Generated Runtime changes");
    expect(result.report).toContain("### Provenance changes");
    expect(result.report).toContain("### License / attribution changes");
    expect(result.report).toContain("### Workflow changes");
    expect(result.report).toContain("bytes");

    expect(
      await readFile(join(skillsRoot, "example", "upstream-guide.md"), "utf8"),
    ).toBe(NEW_GUIDE);
    expect(
      await readFile(join(skillsRoot, "example", "runtime.md"), "utf8"),
    ).toBe(ENTRY + "\n---\n\n" + NEW_GUIDE);

    const provenance = JSON.parse(
      await readFile(
        join(skillsRoot, "example", "provenance.json"),
        "utf8",
      ),
    ) as { upstream: { commit: string } };
    expect(provenance.upstream.commit).toBe(NEXT);
  });

  it("rejects a locally altered pinned source before mutation", async () => {
    const { root, skillsRoot } = await setup();
    await writeFile(
      join(skillsRoot, "example", "upstream-guide.md"),
      "tampered\n",
      "utf8",
    );

    await expect(
      checkUpstreamUpdates({
        repositoryRoot: root,
        skillsRoot,
        upstream: upstream(),
      }),
    ).rejects.toThrow("Source integrity mismatch");
  });

  it("blocks when an existing Change Record no longer applies", async () => {
    const { root, skillsRoot } = await setup({ regenerationFailure: true });
    const runtimePath = join(skillsRoot, "example", "runtime.md");
    const before = await readFile(runtimePath, "utf8");

    const result = await checkUpstreamUpdates({
      repositoryRoot: root,
      skillsRoot,
      upstream: upstream({ changed: true, entryChanged: true, oldRule: true }),
    });

    expect(result.changed).toBe(true);
    expect(result.blocked).toBe(true);
    expect(result.report).toContain(
      "does not match its affected upstream material",
    );
    expect(await readFile(runtimePath, "utf8")).toBe(before);
  });

  it("blocks newly required but unrecorded Supporting Documents", async () => {
    const { root, skillsRoot } = await setup();
    const result = await checkUpstreamUpdates({
      repositoryRoot: root,
      skillsRoot,
      upstream: upstream({
        changed: true,
        entryChanged: true,
        extraSupportingDocument: true,
      }),
    });

    expect(result.changed).toBe(true);
    expect(result.blocked).toBe(true);
    expect(result.report).toContain(
      "required Supporting Document is not declared: skills/example/EXTRA.md",
    );
  });

  it("expires Temporary Upstream Fixes on any affected pin change", async () => {
    const { root, skillsRoot } = await setup({ temporaryFix: true });
    const runtimePath = join(skillsRoot, "example", "runtime.md");
    const before = await readFile(runtimePath, "utf8");

    const result = await checkUpstreamUpdates({
      repositoryRoot: root,
      skillsRoot,
      upstream: upstream({ changed: true }),
    });

    expect(result.changed).toBe(true);
    expect(result.blocked).toBe(true);
    expect(result.report).toContain("### Expired Temporary Upstream Fixes");
    expect(result.report).toContain(
      "Temporary Upstream Fix for example expired when the upstream pin changed.",
    );
    expect(await readFile(runtimePath, "utf8")).toBe(before);
  });

  it("keeps maintenance weekly and human-reviewed without auto-merge", async () => {
    const workflow = await readFile(
      new URL("../.github/workflows/upstream-maintenance.yml", import.meta.url),
      "utf8",
    );

    expect(workflow).toContain('cron: "17 6 * * 1"');
    expect(workflow).toContain("contents: write");
    expect(workflow).toContain("pull-requests: write");
    expect(workflow).toContain("gh pr create");
    expect(workflow).not.toContain("auto-merge");
    expect(workflow).not.toContain("enable_auto_merge");
  });
});
