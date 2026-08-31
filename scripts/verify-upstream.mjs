import { execFile } from "node:child_process";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { readdir, readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, posix } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { promisify } from "node:util";
import process from "node:process";

const execFileAsync = promisify(execFile);
const CANONICAL = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const COMMIT = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const MAX_GIT_METADATA_OUTPUT = 1024 * 1024;

function sha256(source) {
  return createHash("sha256").update(source).digest("hex");
}

function isSafeArtifactPath(path) {
  if (
    typeof path !== "string" ||
    path.length === 0 ||
    path.startsWith("/") ||
    path.includes("\\")
  ) {
    return false;
  }
  return path
    .split("/")
    .every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}

function checkedRepository(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Pinned upstream repository must be a valid URL.");
  }

  if (url.protocol === "file:" && process.env.NODE_ENV === "test") {
    return fileURLToPath(url);
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !url.hostname ||
    url.pathname === "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "Pinned upstream repository must be an HTTPS repository URL without credentials, query, or fragment.",
    );
  }
  return value;
}

async function git(args, options = {}) {
  return execFileAsync("git", args, {
    maxBuffer: MAX_GIT_METADATA_OUTPUT,
    ...options,
  });
}

async function readRequests(skillsRoot) {
  const groups = new Map();
  const entries = (await readdir(skillsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    const name = entry.name;
    if (!CANONICAL.test(name)) {
      throw new Error(`Invalid skill directory: ${name}.`);
    }

    const provenancePath = join(skillsRoot, name, "provenance.json");
    let provenance;
    try {
      provenance = JSON.parse(await readFile(provenancePath, "utf8"));
    } catch {
      throw new Error(`Invalid provenance for ${name}.`);
    }

    const projection = provenance?.projection;
    if (
      provenance?.name !== name ||
      !projection ||
      !isSafeArtifactPath(projection.entrypoint) ||
      !Array.isArray(projection.sources) ||
      projection.sources.length === 0
    ) {
      throw new Error(`Invalid Source Provenance metadata for ${name}.`);
    }

    if (provenance?.sourceProvenance?.type === "absent") {
      for (const source of projection.sources) {
        if (
          !isSafeArtifactPath(source?.path) ||
          Object.keys(source ?? {}).some((key) => key !== "path")
        ) {
          throw new Error(`Invalid absent-source metadata for ${name}.`);
        }
        try {
          await readFile(join(skillsRoot, name, source.path));
        } catch {
          throw new Error(`Missing projection source: ${name}/${source.path}.`);
        }
      }
      continue;
    }

    let repository;
    let commit;
    let location;
    if (provenance?.sourceProvenance?.type === "pinned-github") {
      repository = checkedRepository(provenance.sourceProvenance.repository);
      const repositoryUrl = new URL(provenance.sourceProvenance.repository);
      if (repositoryUrl.hostname !== "github.com") {
        throw new Error("Pinned GitHub source must use github.com.");
      }
      commit = provenance.sourceProvenance.commit;
      const entrypointSource = projection.sources.find(
        (source) => source?.path === projection.entrypoint,
      );
      location = entrypointSource?.upstreamPath;
    } else if (provenance?.sourceProvenance === undefined) {
      repository = checkedRepository(provenance?.upstream?.repository);
      commit = provenance?.upstream?.commit;
      location = provenance?.upstream?.location;
    } else {
      throw new Error(`Invalid Source Provenance metadata for ${name}.`);
    }

    if (!COMMIT.test(commit ?? "") || !isSafeArtifactPath(location)) {
      throw new Error(`Invalid pinned upstream metadata for ${name}.`);
    }

    const entrypoint = projection.sources.find(
      (source) => source?.path === projection.entrypoint,
    );
    if (!entrypoint || entrypoint.upstreamPath !== location) {
      throw new Error(
        `${name}: entrypoint upstreamPath must exactly equal Source Provenance location.`,
      );
    }

    let byCommit = groups.get(repository);
    if (!byCommit) {
      byCommit = new Map();
      groups.set(repository, byCommit);
    }
    const group = byCommit.get(commit) ?? {
      repository,
      commit,
      bundles: [],
      sources: [],
    };
    const bundle = {
      name,
      entrypointUpstreamPath: location,
      declaredUpstreamPaths: new Set(),
    };

    for (const source of projection.sources) {
      if (
        !isSafeArtifactPath(source?.path) ||
        !isSafeArtifactPath(source?.upstreamPath) ||
        !SHA256.test(source?.sha256 ?? "")
      ) {
        throw new Error(`Invalid pinned source metadata for ${name}.`);
      }

      let local;
      try {
        local = await readFile(join(skillsRoot, name, source.path));
      } catch {
        throw new Error(`Missing pinned source: ${name}/${source.path}.`);
      }
      if (sha256(local) !== source.sha256) {
        throw new Error(`Source integrity mismatch for ${name}/${source.path}.`);
      }

      group.sources.push({
        name,
        path: source.path,
        upstreamPath: source.upstreamPath,
        local,
      });
      bundle.declaredUpstreamPaths.add(source.upstreamPath);
    }
    group.bundles.push(bundle);
    byCommit.set(commit, group);
  }

  return [...groups.values()].flatMap((byCommit) => [...byCommit.values()]);
}

function markdownSupportingDocumentTargets(source) {
  const links = source.matchAll(
    /\]\((?!https?:\/\/|mailto:|#)([^)\s]+\.md(?:#[^)\s]*)?)\)/g,
  );
  return [...links].map((match) => match[1].split("#", 1)[0].replace(/^\.\//, ""));
}

function isWithinDirectory(path, directory) {
  return path.startsWith(directory + "/");
}

async function verifyBundleCompleteness(group, checkout, upstreamSources) {
  for (const bundle of group.bundles) {
    const bundleDirectory = posix.dirname(bundle.entrypointUpstreamPath);
    for (const upstreamPath of bundle.declaredUpstreamPaths) {
      const source = upstreamSources.get(upstreamPath);
      if (!source) continue;
      for (const target of markdownSupportingDocumentTargets(source.toString("utf8"))) {
        if (target.startsWith("/") || target.includes("\\")) continue;
        const resolved = posix.normalize(
          posix.join(posix.dirname(upstreamPath), target),
        );
        if (
          !isWithinDirectory(resolved, bundleDirectory) ||
          bundle.declaredUpstreamPaths.has(resolved)
        ) {
          continue;
        }

        try {
          await git([
            "-C",
            checkout,
            "cat-file",
            "-e",
            `FETCH_HEAD:${resolved}`,
          ]);
        } catch {
          continue;
        }
        throw new Error(
          `${bundle.name}: required Supporting Document is not declared: ${resolved}.`,
        );
      }
    }
  }
}

async function verifyGroup(group) {
  const checkout = await mkdtemp(join(tmpdir(), "pinned-upstream-"));
  try {
    await git(["init", "--quiet", checkout]);
    await git(["-C", checkout, "remote", "add", "origin", group.repository]);
    try {
      await git([
        "-C",
        checkout,
        "fetch",
        "--quiet",
        "--depth=1",
        "origin",
        group.commit,
      ]);
    } catch {
      throw new Error(
        `Cannot fetch pinned upstream ${group.repository}@${group.commit}.`,
      );
    }

    const resolved = (
      await git(["-C", checkout, "rev-parse", "FETCH_HEAD"], {
        encoding: "utf8",
      })
    ).stdout.trim();
    if (resolved !== group.commit) {
      throw new Error(
        `Fetched upstream commit ${resolved} does not equal pinned commit ${group.commit}.`,
      );
    }

    const upstreamSources = new Map();

    for (const source of group.sources) {
      let upstream;
      try {
        const result = await git(
          ["-C", checkout, "show", `FETCH_HEAD:${source.upstreamPath}`],
          {
            encoding: null,
            maxBuffer: Math.max(
              MAX_GIT_METADATA_OUTPUT,
              source.local.length + 1,
            ),
          },
        );
        upstream = result.stdout;
      } catch {
        throw new Error(
          `Missing pinned upstream source ${group.repository}@${group.commit}:${source.upstreamPath}.`,
        );
      }

      if (!Buffer.isBuffer(upstream) || !source.local.equals(upstream)) {
        throw new Error(
          `${source.name}/${source.path} does not match pinned upstream ${group.repository}@${group.commit}:${source.upstreamPath}.`,
        );
      }
      upstreamSources.set(source.upstreamPath, upstream);
      process.stdout.write(`verified ${source.name}/${source.path}\n`);
    }

    await verifyBundleCompleteness(group, checkout, upstreamSources);
  } finally {
    await rm(checkout, { recursive: true, force: true });
  }
}

export async function verifyPinnedUpstreamSources(skillsRoot) {
  const groups = await readRequests(skillsRoot);
  for (const group of groups) {
    await verifyGroup(group);
  }
}

const skillsRoot = process.argv[2] ?? "skills";
verifyPinnedUpstreamSources(skillsRoot).catch((error) => {
  const message = error instanceof Error ? error.message : "Upstream verification failed.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
