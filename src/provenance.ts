import * as z from "zod/v4";

import {
  isLegacyV1ProvenanceName,
  pinnedSourceProvenance as resolvePinnedSourceProvenance,
} from "./provenance-state.mjs";

export const CANONICAL_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const COMMIT_SHA = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;

/** Accepts repository-relative artifact paths without traversal or platform escapes. */
function isSafeArtifactPath(path: string): boolean {
  if (path.startsWith("/") || path.includes("\\")) return false;
  const segments = path.split("/");
  return segments.every(
    (segment) => segment.length > 0 && segment !== "." && segment !== "..",
  );
}

/** Accepts canonical public GitHub repository URLs without credentials or suffix data. */
function isGitHubRepository(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== "github.com" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    return false;
  }
  const [owner, repository, ...rest] = url.pathname.split("/").filter(Boolean);
  return Boolean(owner && repository && rest.length === 0);
}

const artifactPathSchema = z.string().min(1).refine(isSafeArtifactPath);
const adrArtifactPathSchema = artifactPathSchema.refine(
  (path) => path.startsWith("docs/adr/") && path.endsWith(".md"),
);
const focusedTestArtifactPathSchema = artifactPathSchema.refine((path) =>
  /^(?:test|tests)\/.+\.(?:test|spec)\.(?:[cm]?[jt]sx?)$/.test(path),
);

const replaceExactSchema = z.strictObject({
  type: z.literal("replace-exact"),
  match: z.string().min(1),
  replacement: z.string(),
});

const appendSourceSchema = z.strictObject({
  type: z.literal("append-source"),
  separator: z.string(),
});

export const TARGET_RUNTIME_PROFILE_V1_ID = "chatgpt-web-mcp-v1" as const;
export const TARGET_RUNTIME_PROFILE_V2_ID = "chatgpt-web-mcp-v2" as const;
/** Backward-compatible name for callers that historically referenced the only profile. */
export const TARGET_RUNTIME_PROFILE_ID = TARGET_RUNTIME_PROFILE_V1_ID;

const targetRuntimeV1ConstraintSchema = z.enum([
  "chatgpt-web-through-mcp",
  "only-load-skill-and-list-skills",
  "github-repository-and-issue-tracker",
  "no-local-checkout",
  "no-shell",
  "no-filesystem",
  "no-git-cli",
  "no-background-process",
  "no-connected-tool-assumption",
  "no-write-access-assumption",
]);

const targetRuntimeV2ConstraintSchema = z.enum([
  "chatgpt-web-through-mcp",
  "only-load-skill-and-list-skills",
  "chatgpt-sandbox",
  "connected-github",
  "chrome-browser-mcp",
  "playwright-mcp",
  "chatgpt-child-workers",
  "chatgpt-library-user-deliverables",
  "no-arbitrary-host-filesystem",
  "no-native-application-control",
  "no-host-daemons",
  "no-unrelated-host-processes",
]);

const targetRuntimeV1EvidenceSchema = z.strictObject({
  targetRuntimeProfile: z.literal(TARGET_RUNTIME_PROFILE_V1_ID),
  constraints: z.array(targetRuntimeV1ConstraintSchema).min(1),
  incompatibility: z.string().min(1),
});

const targetRuntimeV2EvidenceSchema = z.strictObject({
  targetRuntimeProfile: z.literal(TARGET_RUNTIME_PROFILE_V2_ID),
  constraints: z.array(targetRuntimeV2ConstraintSchema).min(1),
  incompatibility: z.string().min(1),
});

const targetRuntimeEvidenceSchema = z.discriminatedUnion("targetRuntimeProfile", [
  targetRuntimeV1EvidenceSchema,
  targetRuntimeV2EvidenceSchema,
]);

const changeRecordFields = {
  allowedRuntimeChange: z.enum([
    "inline-supporting-document",
    "translate-invocation-or-tool",
    "equivalent-mechanism",
    "select-upstream-supported-branch",
  ]),
  source: artifactPathSchema,
  transform: z.discriminatedUnion("type", [replaceExactSchema, appendSourceSchema]),
} as const;

const legacyV1ChangeRecordSchema = z.strictObject({
  ...changeRecordFields,
  evidence: targetRuntimeV1EvidenceSchema,
});

const changeRecordSchema = z.strictObject({
  ...changeRecordFields,
  evidence: targetRuntimeEvidenceSchema,
});

const pinnedSourceArtifactSchema = z.strictObject({
  path: artifactPathSchema,
  upstreamPath: artifactPathSchema,
  sha256: z.string().regex(SHA256),
});

const absentSourceArtifactSchema = z.strictObject({
  path: artifactPathSchema,
});

const dependencyPinSchema = z.strictObject({
  name: z.string().regex(CANONICAL_NAME),
  upstreamCommit: z.string().regex(COMMIT_SHA),
});

const temporaryUpstreamFixSchema = z.strictObject({
  upstreamCommit: z.string().regex(COMMIT_SHA),
  dependencyPins: z.array(dependencyPinSchema).optional(),
  source: artifactPathSchema,
  adr: adrArtifactPathSchema,
  test: focusedTestArtifactPathSchema,
  transform: replaceExactSchema,
});

const pinnedProjectionFields = {
  entrypoint: artifactPathSchema,
  sources: z.array(pinnedSourceArtifactSchema).min(1),
  temporaryUpstreamFix: temporaryUpstreamFixSchema.optional(),
} as const;

const legacyV1PinnedProjectionSchema = z.strictObject({
  ...pinnedProjectionFields,
  changeRecords: z.array(legacyV1ChangeRecordSchema),
});

const pinnedProjectionSchema = z.strictObject({
  ...pinnedProjectionFields,
  changeRecords: z.array(changeRecordSchema),
});

const absentProjectionSchema = z.strictObject({
  entrypoint: artifactPathSchema,
  sources: z.array(absentSourceArtifactSchema).min(1),
  changeRecords: z.array(changeRecordSchema),
  temporaryUpstreamFix: z.never().optional(),
});

/**
 * Compatibility export for callers that only need the projection shape.
 * It accepts either fully pinned sources or intentionally unpinned local sources,
 * but never a mixture inside one bundle.
 */
export const projectionSchema = z.union([
  pinnedProjectionSchema,
  absentProjectionSchema,
]);

const commonProvenanceFields = {
  name: z.string().regex(CANONICAL_NAME),
  visibility: z.enum(["public", "hidden"]),
  description: z.string().min(1),
  dependencies: z.array(z.string().regex(CANONICAL_NAME)),
} as const;

const legacyV1ProvenanceSchema = z.strictObject({
  ...commonProvenanceFields,
  name: commonProvenanceFields.name.refine(isLegacyV1ProvenanceName),
  upstream: z.strictObject({
    repository: z.url(),
    location: z.string().min(1),
    commit: z.string().regex(COMMIT_SHA),
  }),
  license: z.string().min(1),
  attribution: z.string().min(1),
  projection: legacyV1PinnedProjectionSchema,
});

const pinnedGitHubProvenanceSchema = z.strictObject({
  ...commonProvenanceFields,
  sourceProvenance: z.strictObject({
    type: z.literal("pinned-github"),
    repository: z.string().url().refine(isGitHubRepository),
    commit: z.string().regex(COMMIT_SHA),
    license: z.string().min(1),
    attribution: z.string().min(1),
  }),
  projection: pinnedProjectionSchema,
});

const absentProvenanceSchema = z.strictObject({
  ...commonProvenanceFields,
  sourceProvenance: z.strictObject({
    type: z.literal("absent"),
  }),
  projection: absentProjectionSchema,
});

/**
 * Existing v1 documents intentionally remain one accepted branch of the union.
 * New documents must use explicit Source Provenance rather than nullable legacy fields.
 */
export const provenanceSchema = z.union([
  legacyV1ProvenanceSchema,
  pinnedGitHubProvenanceSchema,
  absentProvenanceSchema,
]);

export type SkillProvenance = z.infer<typeof provenanceSchema>;
export type ProjectionSource = SkillProvenance["projection"]["sources"][number];

export interface PinnedSourceProvenance {
  attribution: string;
  commit: string;
  license: string;
  location: string;
  repository: string;
}

/** Returns a normalized pinned-source view, or undefined for intentional absence. */
export function getPinnedSourceProvenance(
  provenance: SkillProvenance,
): PinnedSourceProvenance | undefined {
  return resolvePinnedSourceProvenance(provenance);
}

/** Narrows one projection source to exact pinned GitHub/source-integrity metadata. */
export function isPinnedProjectionSource(
  source: ProjectionSource,
): source is Extract<ProjectionSource, { sha256: string }> {
  return "sha256" in source && "upstreamPath" in source;
}

export type ProvenanceParseResult =
  | { data: SkillProvenance; success: true }
  | { reason: "invalid-json" | "invalid-metadata"; success: false };

/** Parses and validates one provenance document without imposing caller policy. */
export function parseSkillProvenance(source: string): ProvenanceParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(source);
  } catch {
    return { reason: "invalid-json", success: false };
  }

  const parsed = provenanceSchema.safeParse(raw);
  if (!parsed.success) {
    return { reason: "invalid-metadata", success: false };
  }
  return { data: parsed.data, success: true };
}
