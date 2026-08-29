import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CANONICAL_NAME,
  parseSkillProvenance,
  type SkillProvenance,
} from "./provenance.js";

const DEFAULT_REPOSITORY_ROOT = fileURLToPath(new URL("../", import.meta.url));

export interface ProjectionOptions {
  repositoryRoot?: string;
  skillsRoot?: string;
}

interface ProjectionRoots {
  repositoryRoot: string;
  skillsRoot: string;
}

/** Resolves the repository and skill-store roots for generation. */
function resolveRoots(options: ProjectionOptions): ProjectionRoots {
  const repositoryRoot = options.repositoryRoot ?? DEFAULT_REPOSITORY_ROOT;
  return {
    repositoryRoot,
    skillsRoot: options.skillsRoot ?? join(repositoryRoot, "skills"),
  };
}

/** Returns the SHA-256 digest of exact UTF-8 source bytes. */
function sha256(source: string): string {
  return createHash("sha256").update(source).digest("hex");
}

/** Reads and validates one skill's full provenance document. */
async function readProvenance(
  name: string,
  skillsRoot: string,
): Promise<SkillProvenance> {
  if (!CANONICAL_NAME.test(name)) {
    throw new Error(`Invalid skill name: ${name}.`);
  }
  const path = join(skillsRoot, name, "provenance.json");
  let source: string;
  try {
    source = await readFile(path, "utf8");
  } catch {
    throw new Error(`Missing provenance: ${name}/provenance.json.`);
  }

  const parsed = parseSkillProvenance(source);
  if (!parsed.success || parsed.data.name !== name) {
    throw new Error(`Invalid provenance for ${name}.`);
  }
  return parsed.data;
}

/** Reads an exact pinned source and rejects missing or changed bytes. */
async function readPinnedSource(
  name: string,
  bundleRoot: string,
  path: string,
  expectedDigest: string,
): Promise<string> {
  let source: string;
  try {
    source = await readFile(join(bundleRoot, path), "utf8");
  } catch {
    throw new Error(`Missing pinned source: ${name}/${path}.`);
  }
  if (sha256(source) !== expectedDigest) {
    throw new Error(`Source integrity mismatch for ${name}/${path}.`);
  }
  return source;
}

/** Reads non-empty repository evidence required by a Temporary Upstream Fix. */
async function requireEvidence(path: string, label: string): Promise<void> {
  let source: string;
  try {
    source = await readFile(path, "utf8");
  } catch {
    throw new Error(`Missing ${label}.`);
  }
  if (source.length === 0) {
    throw new Error(`Missing ${label}.`);
  }
}

/** Returns the unique exact-match offset or rejects unused/ambiguous material. */
function findExactMatch(source: string, match: string, label: string): number {
  const first = source.indexOf(match);
  if (first === -1) {
    throw new Error(`${label} does not match its affected upstream material.`);
  }
  if (source.indexOf(match, first + 1) !== -1) {
    throw new Error(`${label} matches its affected upstream material more than once.`);
  }
  return first;
}

/** Applies one deterministic exact replacement. */
function replaceExactlyOnce(
  runtime: string,
  match: string,
  replacement: string,
  label: string,
): string {
  if (match === replacement) {
    throw new Error(`${label} does not change its affected upstream material.`);
  }
  const first = findExactMatch(runtime, match, label);
  return `${runtime.slice(0, first)}${replacement}${runtime.slice(first + match.length)}`;
}

/** Generates one runtime from verified pinned sources and ordered projection records. */
export async function generateSkillRuntime(
  name: string,
  options: ProjectionOptions = {},
): Promise<string> {
  const { repositoryRoot, skillsRoot } = resolveRoots(options);
  const provenance = await readProvenance(name, skillsRoot);
  const projection = provenance.projection;

  const appendCounts = new Map<string, number>();
  for (const record of projection.changeRecords) {
    if (record.transform.type !== "append-source") continue;
    appendCounts.set(record.source, (appendCounts.get(record.source) ?? 0) + 1);
  }
  for (const source of projection.sources) {
    if (source.path === projection.entrypoint) continue;
    if ((appendCounts.get(source.path) ?? 0) !== 1) {
      throw new Error(
        `Supporting Document ${source.path} for ${name} must be inlined exactly once.`,
      );
    }
  }

  const bundleRoot = join(skillsRoot, name);
  const sources = new Map<string, string>();
  for (const source of projection.sources) {
    if (sources.has(source.path)) {
      throw new Error(`Duplicate projection source for ${name}: ${source.path}.`);
    }
    sources.set(
      source.path,
      await readPinnedSource(name, bundleRoot, source.path, source.sha256),
    );
  }

  const entrypoint = sources.get(projection.entrypoint);
  if (entrypoint === undefined) {
    throw new Error(
      `Projection entrypoint for ${name} is not listed in pinned sources: ${projection.entrypoint}.`,
    );
  }

  const projectedSources = new Map(sources);
  const claimedRanges = new Map<
    string,
    Array<{ end: number; recordIndex: number; start: number }>
  >();
  for (const [index, record] of projection.changeRecords.entries()) {
    const source = sources.get(record.source);
    if (source === undefined) {
      throw new Error(
        `Change Record ${index + 1} for ${name} references an unpinned source: ${record.source}.`,
      );
    }
    if (
      record.source !== projection.entrypoint &&
      record.transform.type !== "append-source"
    ) {
      throw new Error(
        `Supporting Document ${record.source} for ${name} must be inlined verbatim.`,
      );
    }
    if (record.transform.type === "append-source") {
      if (
        record.allowedRuntimeChange !== "inline-supporting-document" ||
        record.source === projection.entrypoint
      ) {
        throw new Error(
          `Change Record ${index + 1} for ${name} cannot append that projection source.`,
        );
      }
      continue;
    }

    const label = `Change Record ${index + 1} for ${name}`;
    const start = findExactMatch(source, record.transform.match, label);
    const end = start + record.transform.match.length;
    const sourceClaims = claimedRanges.get(record.source) ?? [];
    const overlapping = sourceClaims.find(
      (claim) => start < claim.end && end > claim.start,
    );
    if (overlapping) {
      throw new Error(
        `${label} overlaps Change Record ${overlapping.recordIndex + 1} on ${record.source}.`,
      );
    }
    sourceClaims.push({ start, end, recordIndex: index });
    claimedRanges.set(record.source, sourceClaims);

    const projectedSource = projectedSources.get(record.source);
    if (projectedSource === undefined) {
      throw new Error(
        `Change Record ${index + 1} for ${name} references an unpinned source: ${record.source}.`,
      );
    }
    projectedSources.set(
      record.source,
      replaceExactlyOnce(
        projectedSource,
        record.transform.match,
        record.transform.replacement,
        label,
      ),
    );
  }

  const fix = projection.temporaryUpstreamFix;
  if (fix) {
    if (fix.upstreamCommit !== provenance.upstream.commit) {
      throw new Error(
        `Temporary Upstream Fix for ${name} expired when the upstream pin changed.`,
      );
    }
    if (fix.source !== projection.entrypoint) {
      throw new Error(
        `Temporary Upstream Fix for ${name} cannot modify Supporting Document ${fix.source}.`,
      );
    }
    for (const dependencyPin of fix.dependencyPins ?? []) {
      if (!provenance.dependencies.includes(dependencyPin.name)) {
        throw new Error(
          `Temporary Upstream Fix for ${name} guards undeclared dependency ${dependencyPin.name}.`,
        );
      }
      let dependency: SkillProvenance;
      try {
        dependency = await readProvenance(dependencyPin.name, skillsRoot);
      } catch {
        throw new Error(
          `Temporary Upstream Fix for ${name} cannot verify dependency ${dependencyPin.name} upstream pin.`,
        );
      }
      if (dependency.upstream.commit !== dependencyPin.upstreamCommit) {
        throw new Error(
          `Temporary Upstream Fix for ${name} expired when dependency ${dependencyPin.name} upstream pin changed.`,
        );
      }
    }
    const source = sources.get(fix.source);
    if (source === undefined) {
      throw new Error(
        `Temporary Upstream Fix for ${name} references an invalid source: ${fix.source}.`,
      );
    }
    await requireEvidence(
      join(repositoryRoot, fix.adr),
      `Temporary Upstream Fix ADR: ${fix.adr}`,
    );
    await requireEvidence(
      join(repositoryRoot, fix.test),
      `Temporary Upstream Fix focused test: ${fix.test}`,
    );
    const label = `Temporary Upstream Fix for ${name}`;
    findExactMatch(source, fix.transform.match, label);
    const projectedSource = projectedSources.get(fix.source);
    if (projectedSource === undefined) {
      throw new Error(
        `Temporary Upstream Fix for ${name} references an invalid source: ${fix.source}.`,
      );
    }
    projectedSources.set(
      fix.source,
      replaceExactlyOnce(
        projectedSource,
        fix.transform.match,
        fix.transform.replacement,
        label,
      ),
    );
  }

  let runtime = projectedSources.get(projection.entrypoint);
  if (runtime === undefined) {
    throw new Error(
      `Projection entrypoint for ${name} is not listed in pinned sources: ${projection.entrypoint}.`,
    );
  }
  for (const record of projection.changeRecords) {
    if (record.transform.type !== "append-source") continue;
    const source = projectedSources.get(record.source);
    if (source === undefined) {
      throw new Error(
        `Projection source for ${name} is not pinned: ${record.source}.`,
      );
    }
    runtime = `${runtime}${record.transform.separator}${source}`;
  }

  return runtime;
}

/** Writes one deterministic Generated Runtime during development. */
export async function writeGeneratedRuntime(
  name: string,
  options: ProjectionOptions = {},
): Promise<void> {
  const { skillsRoot } = resolveRoots(options);
  const runtime = await generateSkillRuntime(name, options);
  await writeFile(join(skillsRoot, name, "runtime.md"), runtime, "utf8");
}

/** Fails when the committed Generated Runtime differs from deterministic generation. */
export async function checkGeneratedRuntime(
  name: string,
  options: ProjectionOptions = {},
): Promise<void> {
  const { skillsRoot } = resolveRoots(options);
  const generated = await generateSkillRuntime(name, options);
  let committed: string;
  try {
    committed = await readFile(join(skillsRoot, name, "runtime.md"), "utf8");
  } catch {
    throw new Error(`Missing Generated Runtime: ${name}/runtime.md.`);
  }
  if (committed !== generated) {
    throw new Error(
      `Generated Runtime for ${name} is stale; regenerate it from its pinned bundle.`,
    );
  }
}

/** Lists projection-enabled skills in deterministic canonical order. */
export async function listProjectedSkills(
  options: ProjectionOptions = {},
): Promise<string[]> {
  const { skillsRoot } = resolveRoots(options);
  const entries = await readdir(skillsRoot, { withFileTypes: true });
  const names: string[] = [];
  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    if (!entry.isDirectory()) continue;
    const provenance = await readProvenance(entry.name, skillsRoot);
    names.push(provenance.name);
  }
  return names;
}
