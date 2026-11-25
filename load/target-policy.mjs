export function assertLoadTarget(
  origin,
  { local = false, distributed = false, runId } = {},
) {
  if (!/^https?:\/\/[a-zA-Z0-9.:-]+$/.test(origin))
    throw new Error(
      "An explicit origin without credentials, query or path is required.",
    );
  if (/^https?:\/\/(?:www\.)?competence\.ci(?::\d+)?$/i.test(origin))
    throw new Error("Production load is unconditionally forbidden.");
  const loopback = /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin);
  if (local && !loopback) throw new Error("Local QA must target loopback.");
  if (!local && loopback)
    throw new Error("Use bounded local mode on this computer.");
  if (!local && !distributed)
    throw new Error("Distributed execution requires an explicit launch.");
  if (!runId) throw new Error("An isolation run ID is required.");
}

export function assertLoadProof(identity, runId) {
  if (
    !identity ||
    identity.runId !== runId ||
    identity.dataset !== "synthetic" ||
    identity.productionDataPresent !== false ||
    identity.writesBlocked !== true || identity.databaseReadOnly !== true
  )
    throw new Error("Test target does not prove its isolation.");
}
