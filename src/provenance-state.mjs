const LEGACY_V1_PROVENANCE_NAMES = new Set([
  "code-review",
  "codebase-design",
  "domain-modeling",
  "grill-with-docs",
  "grilling",
  "handoff",
  "implement",
  "improve-codebase-architecture",
  "tdd",
  "to-spec",
  "to-tickets",
]);

/** The legacy shape is grandfathered only for bundles present before issue #43. */
export function isLegacyV1ProvenanceName(name) {
  return typeof name === "string" && LEGACY_V1_PROVENANCE_NAMES.has(name);
}

/**
 * Resolve a provenance document to normalized pinned-source fields.
 * New legacy-shaped documents deliberately resolve as absent/invalid.
 *
 * @param {any} provenance
 * @returns {{
 *   attribution: string,
 *   commit: string,
 *   license: string,
 *   location: string,
 *   repository: string,
 * } | undefined}
 */
export function pinnedSourceProvenance(provenance) {
  if (provenance?.sourceProvenance?.type === "pinned-github") {
    const sourceProvenance = provenance.sourceProvenance;
    const entrypoint = provenance.projection?.sources?.find(
      (source) =>
        source?.path === provenance.projection?.entrypoint &&
        typeof source?.upstreamPath === "string",
    );
    if (
      !entrypoint ||
      typeof sourceProvenance.repository !== "string" ||
      typeof sourceProvenance.commit !== "string" ||
      typeof sourceProvenance.license !== "string" ||
      typeof sourceProvenance.attribution !== "string"
    ) {
      return undefined;
    }
    return {
      repository: sourceProvenance.repository,
      location: entrypoint.upstreamPath,
      commit: sourceProvenance.commit,
      license: sourceProvenance.license,
      attribution: sourceProvenance.attribution,
    };
  }

  if (
    provenance?.sourceProvenance === undefined &&
    provenance?.upstream &&
    isLegacyV1ProvenanceName(provenance.name) &&
    typeof provenance.upstream.repository === "string" &&
    typeof provenance.upstream.location === "string" &&
    typeof provenance.upstream.commit === "string" &&
    typeof provenance.license === "string" &&
    typeof provenance.attribution === "string"
  ) {
    return {
      repository: provenance.upstream.repository,
      location: provenance.upstream.location,
      commit: provenance.upstream.commit,
      license: provenance.license,
      attribution: provenance.attribution,
    };
  }

  return undefined;
}
