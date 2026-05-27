export interface BeamlineResponse {
  namespace: string;
}

/** Resolve the beamline namespace for the requesting client IP. The server returns
 *  an empty string when the namespace map is disabled or no CIDR range matches; we
 *  surface that as `""` so callers can treat empty as "no auto-filter". */
export async function getBeamlineNamespace(): Promise<string> {
  const res = await fetch("/api/beamline");
  if (!res.ok) throw new Error(`/api/beamline returned ${String(res.status)}`);
  const data = (await res.json()) as BeamlineResponse;
  return data.namespace ?? "";
}
