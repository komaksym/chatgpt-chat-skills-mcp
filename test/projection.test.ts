import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { generateSkillRuntime } from "../src/projection.js";

const HANDOFF_ROOT = new URL("../skills/handoff/", import.meta.url);
const GRILLING_BUNDLE_NAMES = [
  "grill-with-docs",
  "grilling",
  "domain-modeling",
] as const;
const PIN_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const PIN_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

interface FixtureOptions {
  actualSource?: string;
  expectedSource?: string;
  supportingSources?: Array<{
    content: string;
    path: string;
  }>;
  changeRecords?: Array<Record<string, unknown>>;
  fix?: {
    adr: string;
    match?: string;
    replacement?: string;
    source?: string;
    test: string;
    upstreamCommit: string;
  };
  writeAdr?: boolean;
  writeFocusedTest?: boolean;
}

/** Returns a SHA-256 digest for exact pinned UTF-8 source bytes. */
function sha256(source: string): string {
  return createHash("sha256").update(source).digest("hex");
}

/** Creates one projection-enabled skill fixture under a temporary repository root. */
async function createProjectionFixture(
  repositoryRoot: string,
  options: FixtureOptions = {},
): Promise<{ skillsRoot: string }> {
  const skillsRoot = join(repositoryRoot, "skills");
  const bundleRoot = join(skillsRoot, "fixture-skill");
  const expectedSource = options.expectedSource ?? "PINNED_SOURCE\n";
  const actualSource = options.actualSource ?? expectedSource;
  await mkdir(bundleRoot, { recursive: true });
  await writeFile(join(bundleRoot, "upstream.md"), actualSource, "utf8");

  const supportingSources = options.supportingSources ?? [];
  for (const supportingSource of supportingSources) {
    const path = join(bundleRoot, supportingSource.path);
    await mkdir(join(path, ".."), { recursive: true });
    await writeFile(path, supportingSource.content, "utf8");
  }

  const projection: Record<string, unknown> = {
    entrypoint: "upstream.md",
    sources: [
      {
        path: "upstream.md",
        upstreamPath: "skills/fixture/SKILL.md",
        sha256: sha256(expectedSource),
      },
      ...supportingSources.map((supportingSource) => ({
        path: supportingSource.path,
        upstreamPath: `skills/fixture/${supportingSource.path}`,
        sha256: sha256(supportingSource.content),
      })),
    ],
    changeRecords: options.changeRecords ?? [],
  };
  if (options.fix) {
    projection.temporaryUpstreamFix = {
      upstreamCommit: options.fix.upstreamCommit,
      source: options.fix.source ?? "upstream.md",
      adr: options.fix.adr,
      test: options.fix.test,
      transform: {
        type: "replace-exact",
        match: options.fix.match ?? "PINNED_SOURCE",
        replacement: options.fix.replacement ?? "FIXED_SOURCE",
      },
    };
  }

  await writeFile(
    join(bundleRoot, "provenance.json"),
    JSON.stringify(
      {
        name: "fixture-skill",
        visibility: "public",
        description: "Projection fixture.",
        dependencies: [],
        upstream: {
          repository: "https://github.com/example/skills",
          location: "skills/fixture/SKILL.md",
          commit: PIN_B,
        },
        license: "MIT",
        attribution: "Fixture author",
        projection,
      },
      null,
      2,
    ),
    "utf8",
  );

  if (options.writeAdr && options.fix) {
    const path = join(repositoryRoot, options.fix.adr);
    await mkdir(join(path, ".."), { recursive: true });
    await writeFile(path, "# Temporary fix ADR\n", "utf8");
  }
  if (options.writeFocusedTest && options.fix) {
    const path = join(repositoryRoot, options.fix.test);
    await mkdir(join(path, ".."), { recursive: true });
    await writeFile(path, "// focused regression test\n", "utf8");
  }

  return { skillsRoot };
}

/** Defines the deterministic Mechanical Projection seam. */
function defineProjectionSuite(): void {
  const roots: string[] = [];

  /** Removes temporary repositories created by fixture tests. */
  async function cleanup(): Promise<void> {
    for (const root of roots) {
      await rm(root, { recursive: true, force: true });
    }
  }

  afterEach(cleanup);

  /** Proves handoff is the exact pinned upstream skill plus two recorded Change Records. */
  async function generatesHandoffDeterministically(): Promise<void> {
    const upstream = await readFile(new URL("upstream.md", HANDOFF_ROOT), "utf8");
    const committed = await readFile(new URL("runtime.md", HANDOFF_ROOT), "utf8");
    const expected = upstream
      .replace(
        "Save to the temporary directory of the user's OS - not the current workspace.",
        "Return the handoff directly in chat as a single fenced Markdown block so the user can copy it in one click and paste it into the next conversation. Do not create a separate document, artifact, or file.",
      )
      .replace("call the Skill tool for", "load with `load_skill`");

    const first = await generateSkillRuntime("handoff");
    const second = await generateSkillRuntime("handoff");

    expect(first).toBe(expected);
    expect(second).toBe(first);
    expect(committed).toBe(first);
  }

  /** Proves every grilling bundle is an exact committed Mechanical Projection. */
  async function generatesGrillingBundleDeterministically(): Promise<void> {
    for (const name of GRILLING_BUNDLE_NAMES) {
      const first = await generateSkillRuntime(name);
      const second = await generateSkillRuntime(name);
      const committed = await readFile(
        new URL(`../skills/${name}/runtime.md`, import.meta.url),
        "utf8",
      );

      expect(first).toBe(committed);
      expect(second).toBe(first);
      expect(first).toContain(`name: ${name}`);
    }
  }

  /** Proves a changed pinned source blocks generation before any projection is emitted. */
  async function rejectsAlteredPinnedSource(): Promise<void> {
    const repositoryRoot = await mkdtemp(join(tmpdir(), "projection-repo-"));
    roots.push(repositoryRoot);
    const { skillsRoot } = await createProjectionFixture(repositoryRoot, {
      actualSource: "ALTERED_SOURCE\n",
    });

    await expect(
      generateSkillRuntime("fixture-skill", { repositoryRoot, skillsRoot }),
    ).rejects.toThrow("Source integrity mismatch for fixture-skill/upstream.md.");
  }

  /** Proves a missing pinned source blocks generation rather than degrading. */
  async function rejectsMissingPinnedSource(): Promise<void> {
    const repositoryRoot = await mkdtemp(join(tmpdir(), "projection-repo-"));
    roots.push(repositoryRoot);
    const { skillsRoot } = await createProjectionFixture(repositoryRoot);
    await rm(join(skillsRoot, "fixture-skill", "upstream.md"));

    await expect(
      generateSkillRuntime("fixture-skill", { repositoryRoot, skillsRoot }),
    ).rejects.toThrow("Missing pinned source: fixture-skill/upstream.md.");
  }

  /** Proves overlapping exact matches are rejected as ambiguous. */
  async function rejectsOverlappingChangeRecordMatch(): Promise<void> {
    const repositoryRoot = await mkdtemp(join(tmpdir(), "projection-repo-"));
    roots.push(repositoryRoot);
    const { skillsRoot } = await createProjectionFixture(repositoryRoot, {
      expectedSource: "aaa",
      changeRecords: [
        {
          allowedRuntimeChange: "equivalent-mechanism",
          source: "upstream.md",
          evidence: {
            targetRuntimeProfile: "chatgpt-web-mcp-v1",
            constraints: ["chatgpt-web-through-mcp"],
            incompatibility: "Fixture replacement.",
          },
          transform: {
            type: "replace-exact",
            match: "aa",
            replacement: "b",
          },
        },
      ],
    });

    await expect(
      generateSkillRuntime("fixture-skill", { repositoryRoot, skillsRoot }),
    ).rejects.toThrow(
      "Change Record 1 for fixture-skill matches its affected upstream material more than once.",
    );
  }

  /** Proves every replacement names material present in the original pinned source. */
  async function rejectsChangeRecordMatchIntroducedByEarlierRecord(): Promise<void> {
    const repositoryRoot = await mkdtemp(join(tmpdir(), "projection-repo-"));
    roots.push(repositoryRoot);
    const { skillsRoot } = await createProjectionFixture(repositoryRoot, {
      expectedSource: "A\n",
      changeRecords: [
        {
          allowedRuntimeChange: "equivalent-mechanism",
          source: "upstream.md",
          evidence: {
            targetRuntimeProfile: "chatgpt-web-mcp-v1",
            constraints: ["chatgpt-web-through-mcp"],
            incompatibility: "First fixture replacement.",
          },
          transform: {
            type: "replace-exact",
            match: "A",
            replacement: "B",
          },
        },
        {
          allowedRuntimeChange: "equivalent-mechanism",
          source: "upstream.md",
          evidence: {
            targetRuntimeProfile: "chatgpt-web-mcp-v1",
            constraints: ["chatgpt-web-through-mcp"],
            incompatibility: "Second fixture replacement.",
          },
          transform: {
            type: "replace-exact",
            match: "B",
            replacement: "C",
          },
        },
      ],
    });

    await expect(
      generateSkillRuntime("fixture-skill", { repositoryRoot, skillsRoot }),
    ).rejects.toThrow(
      "Change Record 2 for fixture-skill does not match its affected upstream material.",
    );
  }

  /** Proves separate Change Records cannot claim overlapping original source bytes. */
  async function rejectsOverlappingChangeRecords(): Promise<void> {
    const repositoryRoot = await mkdtemp(join(tmpdir(), "projection-repo-"));
    roots.push(repositoryRoot);
    const { skillsRoot } = await createProjectionFixture(repositoryRoot, {
      expectedSource: "abc\n",
      changeRecords: [
        {
          allowedRuntimeChange: "equivalent-mechanism",
          source: "upstream.md",
          evidence: {
            targetRuntimeProfile: "chatgpt-web-mcp-v1",
            constraints: ["chatgpt-web-through-mcp"],
            incompatibility: "First fixture replacement.",
          },
          transform: {
            type: "replace-exact",
            match: "abc",
            replacement: "xbc",
          },
        },
        {
          allowedRuntimeChange: "equivalent-mechanism",
          source: "upstream.md",
          evidence: {
            targetRuntimeProfile: "chatgpt-web-mcp-v1",
            constraints: ["chatgpt-web-through-mcp"],
            incompatibility: "Second fixture replacement.",
          },
          transform: {
            type: "replace-exact",
            match: "bc",
            replacement: "yz",
          },
        },
      ],
    });

    await expect(
      generateSkillRuntime("fixture-skill", { repositoryRoot, skillsRoot }),
    ).rejects.toThrow(
      "Change Record 2 for fixture-skill overlaps Change Record 1 on upstream.md.",
    );
  }

  /** Proves ordinary Change Records cannot mutate pinned Supporting Documents. */
  async function rejectsTransformedSupportingSource(): Promise<void> {
    const repositoryRoot = await mkdtemp(join(tmpdir(), "projection-repo-"));
    roots.push(repositoryRoot);
    const { skillsRoot } = await createProjectionFixture(repositoryRoot, {
      expectedSource: "ENTRYPOINT\n",
      supportingSources: [
        {
          path: "supporting.md",
          content: "SUPPORT OLD\n",
        },
      ],
      changeRecords: [
        {
          allowedRuntimeChange: "translate-invocation-or-tool",
          source: "supporting.md",
          evidence: {
            targetRuntimeProfile: "chatgpt-web-mcp-v1",
            constraints: ["chatgpt-web-through-mcp"],
            incompatibility: "Fixture supporting-document translation.",
          },
          transform: {
            type: "replace-exact",
            match: "OLD",
            replacement: "NEW",
          },
        },
        {
          allowedRuntimeChange: "inline-supporting-document",
          source: "supporting.md",
          evidence: {
            targetRuntimeProfile: "chatgpt-web-mcp-v1",
            constraints: ["chatgpt-web-through-mcp"],
            incompatibility: "The runtime must be self-contained.",
          },
          transform: {
            type: "append-source",
            separator: "\n---\n\n",
          },
        },
      ],
    });

    await expect(
      generateSkillRuntime("fixture-skill", { repositoryRoot, skillsRoot }),
    ).rejects.toThrow(
      "Supporting Document supporting.md for fixture-skill must be inlined verbatim.",
    );
  }

  /** Proves supporting documents enter the runtime from their exact pinned bytes. */
  async function inlinesPinnedSupportingSource(): Promise<void> {
    const repositoryRoot = await mkdtemp(join(tmpdir(), "projection-repo-"));
    roots.push(repositoryRoot);
    const { skillsRoot } = await createProjectionFixture(repositoryRoot, {
      expectedSource: "ENTRYPOINT\n",
      supportingSources: [
        {
          path: "supporting.md",
          content: "PINNED SUPPORTING DOCUMENT\n",
        },
      ],
      changeRecords: [
        {
          allowedRuntimeChange: "inline-supporting-document",
          source: "supporting.md",
          evidence: {
            targetRuntimeProfile: "chatgpt-web-mcp-v1",
            constraints: ["chatgpt-web-through-mcp"],
            incompatibility: "The runtime must be self-contained.",
          },
          transform: {
            type: "append-source",
            separator: "\n---\n\n",
          },
        },
      ],
    });

    await expect(
      generateSkillRuntime("fixture-skill", { repositoryRoot, skillsRoot }),
    ).resolves.toBe("ENTRYPOINT\n\n---\n\nPINNED SUPPORTING DOCUMENT\n");
  }

  /** Proves Supporting Documents remain verbatim even when a Temporary Upstream Fix is declared. */
  async function rejectsTemporaryFixToSupportingSource(): Promise<void> {
    const repositoryRoot = await mkdtemp(join(tmpdir(), "projection-repo-"));
    roots.push(repositoryRoot);
    const { skillsRoot } = await createProjectionFixture(repositoryRoot, {
      expectedSource: "ENTRYPOINT\n",
      supportingSources: [
        {
          path: "supporting.md",
          content: "SUPPORT BUG\n",
        },
      ],
      changeRecords: [
        {
          allowedRuntimeChange: "inline-supporting-document",
          source: "supporting.md",
          evidence: {
            targetRuntimeProfile: "chatgpt-web-mcp-v1",
            constraints: ["chatgpt-web-through-mcp"],
            incompatibility: "The runtime must be self-contained.",
          },
          transform: {
            type: "append-source",
            separator: "\n---\n\n",
          },
        },
      ],
      fix: {
        upstreamCommit: PIN_B,
        source: "supporting.md",
        match: "BUG",
        replacement: "FIXED",
        adr: "docs/adr/fixture-fix.md",
        test: "test/fixture-fix.test.ts",
      },
      writeAdr: true,
      writeFocusedTest: true,
    });

    await expect(
      generateSkillRuntime("fixture-skill", { repositoryRoot, skillsRoot }),
    ).rejects.toThrow(
      "Temporary Upstream Fix for fixture-skill cannot modify Supporting Document supporting.md.",
    );
  }

  /** Proves a Temporary Upstream Fix expires as soon as the pinned commit changes. */
  async function rejectsExpiredTemporaryFix(): Promise<void> {
    const repositoryRoot = await mkdtemp(join(tmpdir(), "projection-repo-"));
    roots.push(repositoryRoot);
    const { skillsRoot } = await createProjectionFixture(repositoryRoot, {
      fix: {
        upstreamCommit: PIN_A,
        adr: "docs/adr/fixture-fix.md",
        test: "test/fixture-fix.test.ts",
      },
      writeAdr: true,
      writeFocusedTest: true,
    });

    await expect(
      generateSkillRuntime("fixture-skill", { repositoryRoot, skillsRoot }),
    ).rejects.toThrow(
      "Temporary Upstream Fix for fixture-skill expired when the upstream pin changed.",
    );
  }

  /** Proves a Temporary Upstream Fix cannot use an arbitrary file as its ADR. */
  async function rejectsTemporaryFixNonAdrPath(): Promise<void> {
    const repositoryRoot = await mkdtemp(join(tmpdir(), "projection-repo-"));
    roots.push(repositoryRoot);
    const { skillsRoot } = await createProjectionFixture(repositoryRoot, {
      fix: {
        upstreamCommit: PIN_B,
        adr: "README.md",
        test: "test/fixture-fix.test.ts",
      },
      writeAdr: true,
      writeFocusedTest: true,
    });

    await expect(
      generateSkillRuntime("fixture-skill", { repositoryRoot, skillsRoot }),
    ).rejects.toThrow("Invalid provenance for fixture-skill.");
  }

  /** Proves an active Temporary Upstream Fix must point at a real ADR. */
  async function requiresTemporaryFixAdr(): Promise<void> {
    const repositoryRoot = await mkdtemp(join(tmpdir(), "projection-repo-"));
    roots.push(repositoryRoot);
    const { skillsRoot } = await createProjectionFixture(repositoryRoot, {
      fix: {
        upstreamCommit: PIN_B,
        adr: "docs/adr/fixture-fix.md",
        test: "test/fixture-fix.test.ts",
      },
      writeFocusedTest: true,
    });

    await expect(
      generateSkillRuntime("fixture-skill", { repositoryRoot, skillsRoot }),
    ).rejects.toThrow("Missing Temporary Upstream Fix ADR: docs/adr/fixture-fix.md.");
  }

  /** Proves a Temporary Upstream Fix cannot use an arbitrary file as its focused test. */
  async function rejectsTemporaryFixNonTestPath(): Promise<void> {
    const repositoryRoot = await mkdtemp(join(tmpdir(), "projection-repo-"));
    roots.push(repositoryRoot);
    const { skillsRoot } = await createProjectionFixture(repositoryRoot, {
      fix: {
        upstreamCommit: PIN_B,
        adr: "docs/adr/fixture-fix.md",
        test: "package.json",
      },
      writeAdr: true,
      writeFocusedTest: true,
    });

    await expect(
      generateSkillRuntime("fixture-skill", { repositoryRoot, skillsRoot }),
    ).rejects.toThrow("Invalid provenance for fixture-skill.");
  }

  /** Proves an active Temporary Upstream Fix must point at its focused regression test. */
  async function requiresTemporaryFixFocusedTest(): Promise<void> {
    const repositoryRoot = await mkdtemp(join(tmpdir(), "projection-repo-"));
    roots.push(repositoryRoot);
    const { skillsRoot } = await createProjectionFixture(repositoryRoot, {
      fix: {
        upstreamCommit: PIN_B,
        adr: "docs/adr/fixture-fix.md",
        test: "test/fixture-fix.test.ts",
      },
      writeAdr: true,
    });

    await expect(
      generateSkillRuntime("fixture-skill", { repositoryRoot, skillsRoot }),
    ).rejects.toThrow(
      "Missing Temporary Upstream Fix focused test: test/fixture-fix.test.ts.",
    );
  }


  /** Proves Target Runtime evidence names a machine-checkable profile constraint. */
  async function rejectsUnverifiableTargetRuntimeEvidence(): Promise<void> {
    const repositoryRoot = await mkdtemp(join(tmpdir(), "projection-repo-"));
    roots.push(repositoryRoot);
    const { skillsRoot } = await createProjectionFixture(repositoryRoot, {
      expectedSource: "A\\n",
      changeRecords: [
        {
          allowedRuntimeChange: "equivalent-mechanism",
          source: "upstream.md",
          evidence: { targetRuntimeProfile: "Fixture prose is not machine-checkable." },
          transform: {
            type: "replace-exact",
            match: "A",
            replacement: "B",
          },
        },
      ],
    });

    await expect(
      generateSkillRuntime("fixture-skill", { repositoryRoot, skillsRoot }),
    ).rejects.toThrow("Invalid provenance for fixture-skill.");
  }

  /** Proves Target Runtime evidence is structured rather than free text. */
  async function rejectsFreeTextChangeRecordEvidence(): Promise<void> {
    const repositoryRoot = await mkdtemp(join(tmpdir(), "projection-repo-"));
    roots.push(repositoryRoot);
    const { skillsRoot } = await createProjectionFixture(repositoryRoot, {
      expectedSource: "A\n",
      changeRecords: [
        {
          allowedRuntimeChange: "equivalent-mechanism",
          source: "upstream.md",
          evidence: "x",
          transform: {
            type: "replace-exact",
            match: "A",
            replacement: "B",
          },
        },
      ],
    });

    await expect(
      generateSkillRuntime("fixture-skill", { repositoryRoot, skillsRoot }),
    ).rejects.toThrow("Invalid provenance for fixture-skill.");
  }

  /** Proves a Change Record must produce an observable runtime difference. */
  async function rejectsNoOpChangeRecord(): Promise<void> {
    const repositoryRoot = await mkdtemp(join(tmpdir(), "projection-repo-"));
    roots.push(repositoryRoot);
    const { skillsRoot } = await createProjectionFixture(repositoryRoot, {
      expectedSource: "UNCHANGED\n",
      changeRecords: [
        {
          allowedRuntimeChange: "equivalent-mechanism",
          source: "upstream.md",
          evidence: {
            targetRuntimeProfile: "chatgpt-web-mcp-v1",
            constraints: ["chatgpt-web-through-mcp"],
            incompatibility: "Fixture no-op must not count as a runtime change.",
          },
          transform: {
            type: "replace-exact",
            match: "UNCHANGED",
            replacement: "UNCHANGED",
          },
        },
      ],
    });

    await expect(
      generateSkillRuntime("fixture-skill", { repositoryRoot, skillsRoot }),
    ).rejects.toThrow(
      "Change Record 1 for fixture-skill does not change its affected upstream material.",
    );
  }

  /** Proves every pinned Supporting Document must enter the generated runtime exactly once. */
  async function rejectsUnconsumedSupportingSource(): Promise<void> {
    const repositoryRoot = await mkdtemp(join(tmpdir(), "projection-repo-"));
    roots.push(repositoryRoot);
    const { skillsRoot } = await createProjectionFixture(repositoryRoot, {
      expectedSource: "ENTRYPOINT\n",
      supportingSources: [
        {
          path: "supporting.md",
          content: "PINNED SUPPORTING DOCUMENT\n",
        },
      ],
    });

    await expect(
      generateSkillRuntime("fixture-skill", { repositoryRoot, skillsRoot }),
    ).rejects.toThrow(
      "Supporting Document supporting.md for fixture-skill must be inlined exactly once.",
    );
  }

  it(
    "generates handoff deterministically from its pinned bundle",
    generatesHandoffDeterministically,
  );
  it(
    "generates every grilling bundle deterministically from its pinned bundle",
    generatesGrillingBundleDeterministically,
  );
  it("rejects altered pinned source", rejectsAlteredPinnedSource);
  it(
    "rejects Target Runtime evidence without machine-checkable constraints",
    rejectsUnverifiableTargetRuntimeEvidence,
  );
  it("rejects free-text Change Record evidence", rejectsFreeTextChangeRecordEvidence);
  it("rejects no-op Change Records", rejectsNoOpChangeRecord);
  it("rejects unconsumed Supporting Documents", rejectsUnconsumedSupportingSource);
  it("rejects missing pinned source", rejectsMissingPinnedSource);
  it("rejects overlapping Change Record matches", rejectsOverlappingChangeRecordMatch);
  it(
    "rejects Change Record matches introduced by earlier records",
    rejectsChangeRecordMatchIntroducedByEarlierRecord,
  );
  it("rejects overlapping Change Records", rejectsOverlappingChangeRecords);
  it("rejects transformed Supporting Documents", rejectsTransformedSupportingSource);
  it("inlines pinned supporting source bytes", inlinesPinnedSupportingSource);
  it(
    "rejects a Temporary Upstream Fix to a pinned Supporting Document",
    rejectsTemporaryFixToSupportingSource,
  );
  it("expires a Temporary Upstream Fix on pin change", rejectsExpiredTemporaryFix);
  it("rejects a non-ADR Temporary Upstream Fix path", rejectsTemporaryFixNonAdrPath);
  it("requires a Temporary Upstream Fix ADR", requiresTemporaryFixAdr);
  it(
    "rejects a non-test Temporary Upstream Fix path",
    rejectsTemporaryFixNonTestPath,
  );
  it(
    "requires a Temporary Upstream Fix focused test",
    requiresTemporaryFixFocusedTest,
  );
}

describe("Mechanical Projection generator", defineProjectionSuite);
