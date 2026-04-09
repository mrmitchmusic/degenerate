const rawApiBase = (process.env.NEXT_PUBLIC_API_URL ?? "").trim();

export const API_BASE = rawApiBase.replace(/\/+$/, "");

export function getApiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (!API_BASE) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured");
  }
  return `${API_BASE}${normalizedPath}`;
}
