import { createHash } from "node:crypto";
import {
  cp,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, posix } from "node:path";

import { generateSkillRuntime } from "./projection.js";
import {
  CANONICAL_NAME,
  parseSkillProvenance,
  type SkillProvenance,
} from "./provenance.js";

type ProjectionSource = SkillProvenance["projection"]["sources"][number];

export interface UpstreamClient {
  getFile(
    repository: string,
    location: string,
    commit: string,
  ): Promise<string>;
  getLatestCommit(repository: string, location: string): Promise<string>;
}

interface SourceSnapshot {
  metadata: ProjectionSource;
  before: string;
}

interface BundleSnapshot {
  directory: string;
  provenance: SkillProvenance;
  sources: SourceSnapshot[];
}

interface PlannedSource {
  localPath: string;
  upstreamPath: string;
  before: string;
  after: string;
  oldDigest: string;
  newDigest: string;
  diff: string;
}

interface UpdatePlan {
  bundle: BundleSnapshot;
  newPin: string;
  sources: PlannedSource[];
  undeclaredSupportingDocuments: string[];
}

export interface RuntimeDelta {
  name: string;
  before: number;
  after: number;
}

export interface UpstreamUpdate {
  name: string;
  oldSha: string;
  newSha: string;
  sources: PlannedSource[];
}

export interface UpstreamUpdateResult {
  changed: boolean;
  blocked: boolean;
  report: string;
  runtimeDeltas: RuntimeDelta[];
  updates: UpstreamUpdate[];
}

class UpstreamFileNotFoundError extends Error {}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function repositoryParts(repository: string): { owner: string; repo: string } {
  const url = new URL(repository);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "github.com" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(`Unsupported upstream repository: ${repository}`);
  }

  const [owner, rawRepo, ...rest] = url.pathname.split("/").filter(Boolean);
  if (!owner || !rawRepo || rest.length > 0) {
    throw new Error(`Unsupported upstream repository: ${repository}`);
  }

  const repo = rawRepo.endsWith(".git") ? rawRepo.slice(0, -4) : rawRepo;
  if (!repo) {
    throw new Error(`Unsupported upstream repository: ${repository}`);
  }
  return { owner, repo };
}

async function checkedResponse(
  response: Response,
  label: string,
): Promise<Response> {
  if (!response.ok) {
    throw new Error(`${label} failed with HTTP ${response.status}.`);
  }
  return response;
}

export class GitHubApiUpstreamClient implements UpstreamClient {
  constructor(
    private readonly token: string,
    private readonly request: typeof fetch = fetch,
  ) {}

  private headers(accept: string): HeadersInit {
    return {
      Accept: accept,
      Authorization: `Bearer ${this.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  async getFile(
    repository: string,
    location: string,
    commit: string,
  ): Promise<string> {
    const { owner, repo } = repositoryParts(repository);
    const path = location.split("/").map(encodeURIComponent).join("/");
    const url = new URL(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    );
    url.searchParams.set("ref", commit);

    const response = await this.request(url, {
      headers: this.headers("application/vnd.github.raw+json"),
    });
    if (response.status === 404) {
      throw new UpstreamFileNotFoundError(
        `Missing upstream source ${repository}@${commit}:${location}.`,
      );
    }
    return (await checkedResponse(response, "Upstream file lookup")).text();
  }

  async getLatestCommit(
    repository: string,
    location: string,
  ): Promise<string> {
    const { owner, repo } = repositoryParts(repository);
    const url = new URL(
      `https://api.github.com/repos/${owner}/${repo}/commits`,
    );
    url.searchParams.set("path", location);
    url.searchParams.set("per_page", "1");

    const response = await checkedResponse(
      await this.request(url, {
        headers: this.headers("application/vnd.github+json"),
      }),
      "Latest commit lookup",
    );
    const payload = (await response.json()) as Array<{ sha?: unknown }>;
    const sha = payload[0]?.sha;
    if (typeof sha !== "string" || !/^[a-f0-9]{40}$/.test(sha)) {
      throw new Error(`No upstream commit found for ${location}.`);
    }
    return sha;
  }
}

async function readProvenance(
  skillsRoot: string,
  directory: string,
): Promise<SkillProvenance> {
  if (!CANONICAL_NAME.test(directory)) {
    throw new Error(`Invalid skill directory: ${directory}.`);
  }

  let source: string;
  try {
    source = await readFile(
      join(skillsRoot, directory, "provenance.json"),
      "utf8",
    );
  } catch {
    throw new Error(`Missing provenance: ${directory}/provenance.json.`);
  }

  const parsed = parseSkillProvenance(source);
  if (!parsed.success || parsed.data.name !== directory) {
    throw new Error(`Invalid provenance for ${directory}.`);
  }
  return parsed.data;
}

function markdownSupportingDocumentTargets(source: string): string[] {
  return [
    ...source.matchAll(
      /\]\((?!https?:\/\/|mailto:|#)([^)\s]+\.md(?:#[^)\s]*)?)\)/g,
    ),
  ].map((match) => match[1]!.split("#", 1)[0]!.replace(/^\.\//, ""));
}

function isWithinDirectory(path: string, directory: string): boolean {
  const relative = posix.relative(directory, path);
  return (
    relative.length > 0 &&
    relative !== ".." &&
    !relative.startsWith("../") &&
    !posix.isAbsolute(relative)
  );
}

async function findUndeclaredSupportingDocuments(
  provenance: SkillProvenance,
  sources: Array<{ upstreamPath: string; content: string }>,
  commit: string,
  upstream: UpstreamClient,
): Promise<string[]> {
  const declared = new Set(
    provenance.projection.sources.map((source) => source.upstreamPath),
  );
  const bundleDirectory = posix.dirname(provenance.upstream.location);
  const missing = new Set<string>();

  for (const source of sources) {
    for (const target of markdownSupportingDocumentTargets(source.content)) {
      const resolved = posix.normalize(
        posix.join(posix.dirname(source.upstreamPath), target),
      );
      if (
        !isWithinDirectory(resolved, bundleDirectory) ||
        declared.has(resolved) ||
        missing.has(resolved)
      ) {
        continue;
      }

      try {
        await upstream.getFile(
          provenance.upstream.repository,
          resolved,
          commit,
        );
        missing.add(resolved);
      } catch (error) {
        if (error instanceof UpstreamFileNotFoundError) continue;
        throw error;
      }
    }
  }

  return [...missing].sort();
}

async function readCurrentBundle(
  skillsRoot: string,
  directory: string,
  upstream: UpstreamClient,
): Promise<BundleSnapshot> {
  const provenance = await readProvenance(skillsRoot, directory);
  const entrypoint = provenance.projection.sources.find(
    (source) => source.path === provenance.projection.entrypoint,
  );
  if (!entrypoint || entrypoint.upstreamPath !== provenance.upstream.location) {
    throw new Error(
      `${directory}: entrypoint upstreamPath must exactly equal upstream.location.`,
    );
  }

  const sources: SourceSnapshot[] = [];
  for (const metadata of provenance.projection.sources) {
    let before: string;
    try {
      before = await readFile(
        join(skillsRoot, directory, metadata.path),
        "utf8",
      );
    } catch {
      throw new Error(
        `Missing pinned source: ${directory}/${metadata.path}.`,
      );
    }

    if (digest(before) !== metadata.sha256) {
      throw new Error(
        `Source integrity mismatch for ${directory}/${metadata.path}.`,
      );
    }

    const pinned = await upstream.getFile(
      provenance.upstream.repository,
      metadata.upstreamPath,
      provenance.upstream.commit,
    );
    if (pinned !== before) {
      throw new Error(
        `${directory}/${metadata.path} does not match pinned upstream ` +
          `${provenance.upstream.repository}@${provenance.upstream.commit}:` +
          `${metadata.upstreamPath}.`,
      );
    }
    sources.push({ metadata, before });
  }

  const undeclared = await findUndeclaredSupportingDocuments(
    provenance,
    sources.map((source) => ({
      upstreamPath: source.metadata.upstreamPath,
      content: source.before,
    })),
    provenance.upstream.commit,
    upstream,
  );
  if (undeclared.length > 0) {
    throw new Error(
      `${directory}: required Supporting Document is not declared: ${undeclared[0]}.`,
    );
  }

  return { directory, provenance, sources };
}

async function latestCompleteBundle(
  bundle: BundleSnapshot,
  upstream: UpstreamClient,
): Promise<{ commit: string; contents: Map<string, string> }> {
  const latest = new Map<string, { commit: string; content: string }>();

  for (const source of bundle.sources) {
    const upstreamPath = source.metadata.upstreamPath;
    const commit = await upstream.getLatestCommit(
      bundle.provenance.upstream.repository,
      upstreamPath,
    );
    latest.set(upstreamPath, {
      commit,
      content: await upstream.getFile(
        bundle.provenance.upstream.repository,
        upstreamPath,
        commit,
      ),
    });
  }

  const candidates = [
    ...new Set([...latest.values()].map((item) => item.commit)),
  ];
  for (const commit of candidates) {
    const contents = new Map<string, string>();
    let complete = true;

    for (const source of bundle.sources) {
      const upstreamPath = source.metadata.upstreamPath;
      const content = await upstream.getFile(
        bundle.provenance.upstream.repository,
        upstreamPath,
        commit,
      );
      contents.set(upstreamPath, content);
      if (content !== latest.get(upstreamPath)!.content) {
        complete = false;
      }
    }

    if (complete) {
      return { commit, contents };
    }
  }

  throw new Error(
    `No single upstream commit contains the latest complete bundle for ${bundle.directory}.`,
  );
}

function textDiff(before: string, after: string): string {
  if (before === after) return "";

  const oldLines = before.replace(/\n$/, "").split("\n");
  const newLines = after.replace(/\n$/, "").split("\n");
  let prefix = 0;
  while (
    prefix < oldLines.length &&
    prefix < newLines.length &&
    oldLines[prefix] === newLines[prefix]
  ) {
    prefix += 1;
  }

  let oldEnd = oldLines.length;
  let newEnd = newLines.length;
  while (
    oldEnd > prefix &&
    newEnd > prefix &&
    oldLines[oldEnd - 1] === newLines[newEnd - 1]
  ) {
    oldEnd -= 1;
    newEnd -= 1;
  }

  return [
    ...oldLines
      .slice(Math.max(0, prefix - 2), prefix)
      .map((line) => ` ${line}`),
    ...oldLines.slice(prefix, oldEnd).map((line) => `-${line}`),
    ...newLines.slice(prefix, newEnd).map((line) => `+${line}`),
    ...oldLines
      .slice(oldEnd, Math.min(oldLines.length, oldEnd + 2))
      .map((line) => ` ${line}`),
  ].join("\n");
}

async function planUpdate(
  bundle: BundleSnapshot,
  upstream: UpstreamClient,
): Promise<UpdatePlan | undefined> {
  const latest = await latestCompleteBundle(bundle, upstream);
  const allUnchanged = bundle.sources.every(
    (source) =>
      latest.contents.get(source.metadata.upstreamPath) === source.before,
  );
  if (allUnchanged) return undefined;

  const latestSources = bundle.sources.map((source) => ({
    upstreamPath: source.metadata.upstreamPath,
    content: latest.contents.get(source.metadata.upstreamPath)!,
  }));
  const undeclaredSupportingDocuments =
    await findUndeclaredSupportingDocuments(
      bundle.provenance,
      latestSources,
      latest.commit,
      upstream,
    );

  const sources = bundle.sources.map((source) => {
    const after = latest.contents.get(source.metadata.upstreamPath)!;
    return {
      localPath: source.metadata.path,
      upstreamPath: source.metadata.upstreamPath,
      before: source.before,
      after,
      oldDigest: source.metadata.sha256,
      newDigest: digest(after),
      diff: textDiff(source.before, after),
    };
  });

  return {
    bundle,
    newPin: latest.commit,
    sources,
    undeclaredSupportingDocuments,
  };
}

function nextPins(
  bundles: BundleSnapshot[],
  plans: UpdatePlan[],
): Map<string, string> {
  const pins = new Map(
    bundles.map((bundle) => [
      bundle.provenance.name,
      bundle.provenance.upstream.commit,
    ]),
  );
  for (const plan of plans) {
    pins.set(plan.bundle.provenance.name, plan.newPin);
  }
  return pins;
}

function expiredFixes(
  bundles: BundleSnapshot[],
  pins: Map<string, string>,
): Array<{ skill: string; message: string }> {
  const expired: Array<{ skill: string; message: string }> = [];

  for (const bundle of bundles) {
    const fix = bundle.provenance.projection.temporaryUpstreamFix;
    if (!fix) continue;

    if (pins.get(bundle.provenance.name) !== fix.upstreamCommit) {
      expired.push({
        skill: bundle.provenance.name,
        message:
          `Temporary Upstream Fix for ${bundle.provenance.name} expired when the upstream pin changed. ` +
          "Remove it or explicitly re-authorize it with updated evidence, ADR, provenance, and tests.",
      });
    }

    for (const dependencyPin of fix.dependencyPins ?? []) {
      if (pins.get(dependencyPin.name) !== dependencyPin.upstreamCommit) {
        expired.push({
          skill: bundle.provenance.name,
          message:
            `Temporary Upstream Fix for ${bundle.provenance.name} expired when dependency ` +
            `${dependencyPin.name} upstream pin changed. Remove it or explicitly re-authorize it ` +
            "with updated evidence, ADR, provenance, and tests.",
        });
      }
    }
  }

  return expired;
}

function formatDelta(delta: number): string {
  return delta >= 0 ? `+${delta}` : String(delta);
}

function renderReport(
  updates: UpstreamUpdate[],
  runtimeDeltas: RuntimeDelta[],
  expired: Array<{ skill: string; message: string }>,
  blockers: Array<{ skill: string; message: string }>,
): string {
  const pins = updates
    .map(
      (update) =>
        `- **${update.name}** — Old pin: ${update.oldSha}; New pin: ${update.newSha}`,
    )
    .join("\n");

  const sourceChanges = updates
    .flatMap((update) =>
      update.sources
        .filter((source) => source.diff.length > 0)
        .map(
          (source) =>
            `#### ${update.name}: ${source.upstreamPath}\n\n` +
            `~~~diff\n${source.diff}\n~~~`,
        ),
    )
    .join("\n\n");

  const runtimeChanges =
    runtimeDeltas.length > 0
      ? runtimeDeltas
          .map(
            (delta) =>
              `- \`skills/${delta.name}/runtime.md\`: ${delta.before} -> ${delta.after} bytes ` +
              `(${formatDelta(delta.after - delta.before)})`,
          )
          .join("\n")
      : "- none";

  const provenanceChanges = updates
    .map((update) => {
      const digests = update.sources
        .filter((source) => source.oldDigest !== source.newDigest)
        .map(
          (source) =>
            `  - \`${source.localPath}\`: ${source.oldDigest} -> ${source.newDigest}`,
        );
      return [
        `- **${update.name}** pin: ${update.oldSha} -> ${update.newSha}`,
        ...(digests.length > 0 ? digests : ["  - source digests unchanged"]),
      ].join("\n");
    })
    .join("\n");

  const expiredSection =
    expired.length > 0
      ? expired
          .map((item) => `- **${item.skill}** — ${item.message}`)
          .join("\n")
      : "- none";
  const blockerSection =
    blockers.length > 0
      ? blockers
          .map((item) => `- **${item.skill}** — ${item.message}`)
          .join("\n")
      : "- none";

  return (
    "# Upstream Mechanical Projection update\n\n" +
    "Human review is required. Auto-merge is never enabled by this workflow.\n\n" +
    "## Pin changes\n\n" +
    pins +
    "\n\n### Upstream source changes\n\n" +
    (sourceChanges || "No textual source delta.") +
    "\n\n### Generated Runtime changes\n\n" +
    runtimeChanges +
    "\n\n### Provenance changes\n\n" +
    provenanceChanges +
    "\n\n### Expired Temporary Upstream Fixes\n\n" +
    expiredSection +
    "\n\n### Regeneration blockers\n\n" +
    blockerSection +
    "\n\n### License / attribution changes\n\n" +
    "- none; maintenance does not rewrite license or attribution metadata\n" +
    "\n### Workflow changes\n\n" +
    "- none; update runs modify only vendored skill bundles\n"
  );
}

function addUnique(
  items: Array<{ skill: string; message: string }>,
  item: { skill: string; message: string },
): void {
  if (
    !items.some(
      (candidate) =>
        candidate.skill === item.skill && candidate.message === item.message,
    )
  ) {
    items.push(item);
  }
}

export async function checkUpstreamUpdates(options: {
  skillsRoot: string;
  upstream: UpstreamClient;
  repositoryRoot?: string;
}): Promise<UpstreamUpdateResult> {
  const repositoryRoot = options.repositoryRoot ?? dirname(options.skillsRoot);
  const directories = (await readdir(options.skillsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const bundles: BundleSnapshot[] = [];
  for (const directory of directories) {
    bundles.push(
      await readCurrentBundle(options.skillsRoot, directory, options.upstream),
    );
  }

  const plans: UpdatePlan[] = [];
  for (const bundle of bundles) {
    const plan = await planUpdate(bundle, options.upstream);
    if (plan) plans.push(plan);
  }

  if (plans.length === 0) {
    return {
      changed: false,
      blocked: false,
      runtimeDeltas: [],
      updates: [],
      report:
        "# Upstream Mechanical Projection update\n\nNo upstream changes detected.\n",
    };
  }

  const tempRoot = await mkdtemp(join(tmpdir(), "projection-update-"));
  const tempSkills = join(tempRoot, "skills");
  await cp(options.skillsRoot, tempSkills, { recursive: true });

  try {
    const updates: UpstreamUpdate[] = [];
    for (const plan of plans) {
      const next = structuredClone(plan.bundle.provenance);
      next.upstream.commit = plan.newPin;

      for (const source of plan.sources) {
        await writeFile(
          join(tempSkills, plan.bundle.directory, source.localPath),
          source.after,
          "utf8",
        );
        const metadata = next.projection.sources.find(
          (candidate) => candidate.path === source.localPath,
        );
        if (!metadata) {
          throw new Error(
            `Projection source disappeared while updating ${plan.bundle.directory}/${source.localPath}.`,
          );
        }
        metadata.sha256 = source.newDigest;
      }

      await writeFile(
        join(tempSkills, plan.bundle.directory, "provenance.json"),
        JSON.stringify(next, null, 2) + "\n",
        "utf8",
      );

      updates.push({
        name: plan.bundle.provenance.name,
        oldSha: plan.bundle.provenance.upstream.commit,
        newSha: plan.newPin,
        sources: plan.sources,
      });
    }

    const blockers: Array<{ skill: string; message: string }> = [];
    for (const plan of plans) {
      for (const upstreamPath of plan.undeclaredSupportingDocuments) {
        addUnique(blockers, {
          skill: plan.bundle.provenance.name,
          message:
            `required Supporting Document is not declared: ${upstreamPath}. ` +
            "Record it explicitly before regeneration.",
        });
      }
    }

    const expired = expiredFixes(bundles, nextPins(bundles, plans));
    for (const item of expired) addUnique(blockers, item);

    const blockedSkills = new Set(blockers.map((item) => item.skill));
    const runtimeDeltas: RuntimeDelta[] = [];

    for (const plan of plans) {
      const bundle = plan.bundle;
      if (blockedSkills.has(bundle.provenance.name)) continue;

      const runtimePath = join(
        tempSkills,
        bundle.provenance.name,
        "runtime.md",
      );
      const before = await readFile(runtimePath, "utf8");

      try {
        const after = await generateSkillRuntime(bundle.provenance.name, {
          repositoryRoot,
          skillsRoot: tempSkills,
        });
        if (after === before) continue;

        await writeFile(runtimePath, after, "utf8");
        runtimeDeltas.push({
          name: bundle.provenance.name,
          before: Buffer.byteLength(before),
          after: Buffer.byteLength(after),
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown regeneration failure.";
        addUnique(blockers, {
          skill: bundle.provenance.name,
          message,
        });
        if (message.includes("Temporary Upstream Fix")) {
          addUnique(expired, {
            skill: bundle.provenance.name,
            message,
          });
        }
      }
    }

    for (const plan of plans) {
      for (const source of plan.sources) {
        await writeFile(
          join(options.skillsRoot, plan.bundle.directory, source.localPath),
          source.after,
          "utf8",
        );
      }
      await writeFile(
        join(options.skillsRoot, plan.bundle.directory, "provenance.json"),
        await readFile(
          join(tempSkills, plan.bundle.directory, "provenance.json"),
          "utf8",
        ),
        "utf8",
      );
    }

    for (const delta of runtimeDeltas) {
      await writeFile(
        join(options.skillsRoot, delta.name, "runtime.md"),
        await readFile(join(tempSkills, delta.name, "runtime.md"), "utf8"),
        "utf8",
      );
    }

    return {
      changed: true,
      blocked: blockers.length > 0,
      runtimeDeltas,
      updates,
      report: renderReport(updates, runtimeDeltas, expired, blockers),
    };
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}
