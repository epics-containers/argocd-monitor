export interface ClientIp {
  ip: string;
  forwardedFor: string;
}

/** Normalize IPv4-mapped IPv6 forms so dev (`::1`) and dual-stack (`::ffff:1.2.3.4`)
 *  display as IPv4. */
function toIpv4(addr: string): string {
  if (addr === "::1") return "127.0.0.1";
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(addr);
  return mapped ? mapped[1] : addr;
}

/** Pick the original client IP: first entry of X-Forwarded-For if present, else remote_addr. */
export function resolveClientIp(data: ClientIp): string {
  const first = data.forwardedFor.split(",")[0]?.trim();
  return toIpv4(first || data.ip);
}

export async function getClientIp(): Promise<string> {
  const res = await fetch("/api/client-ip");
  if (!res.ok) throw new Error(`/api/client-ip returned ${String(res.status)}`);
  const data = (await res.json()) as ClientIp;
  return resolveClientIp(data);
}
