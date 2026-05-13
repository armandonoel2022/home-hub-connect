/**
 * Resolve Google Maps URLs (including short maps.app.goo.gl) into lat/lng.
 * - Sync regex extraction for long URLs that already contain coords.
 * - Async backend call for short URLs (browser CORS blocks redirects).
 * - localStorage cache so we don't re-resolve the same URL.
 */

const CACHE_KEY = "geo.url.cache.v1";

type CacheEntry = { lat: number; lng: number } | null; // null = resolved-but-no-coords

function loadCache(): Record<string, CacheEntry> {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); }
  catch { return {}; }
}
function saveCache(cache: Record<string, CacheEntry>) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {}
}

export function isMapsUrl(s: string): boolean {
  return /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|www\.google\.[^/]+\/maps|maps\.google\.)/i.test(s.trim());
}

export function isLatLngString(s: string): [number, number] | null {
  if (!s) return null;
  const m = s.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  return [parseFloat(m[1]), parseFloat(m[2])];
}

export function extractCoordsFromMapsUrl(url: string): [number, number] | null {
  if (!url) return null;
  let u = url;
  try { u = decodeURIComponent(u); } catch {}
  let m = u.match(/[@/](-?\d+\.\d+),(-?\d+\.\d+)/);
  if (m) return [parseFloat(m[1]), parseFloat(m[2])];
  m = u.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (m) return [parseFloat(m[1]), parseFloat(m[2])];
  m = u.match(/[?&](?:q|ll|destination|center)=(-?\d+\.\d+)[,%2C ](-?\d+\.\d+)/i);
  if (m) return [parseFloat(m[1]), parseFloat(m[2])];
  return null;
}

/**
 * Universal sync parser. Returns [lat,lng] for either "lat,lng" strings
 * or long Google Maps URLs that already embed coords.
 */
export function parseAnyCoords(s: string): [number, number] | null {
  if (!s) return null;
  const direct = isLatLngString(s);
  if (direct) return direct;
  if (isMapsUrl(s)) return extractCoordsFromMapsUrl(s);
  return null;
}

import { isApiConfigured } from "./api";

/**
 * Resolve a single URL via backend (handles short maps.app.goo.gl redirects).
 * Returns null if not resolvable.
 */
export async function resolveMapsUrl(url: string): Promise<[number, number] | null> {
  // Try sync extraction first (long URLs)
  const sync = parseAnyCoords(url);
  if (sync) return sync;

  if (!isMapsUrl(url)) return null;

  // Cache
  const cache = loadCache();
  if (url in cache) {
    const v = cache[url];
    return v ? [v.lat, v.lng] : null;
  }

  if (!isApiConfigured()) {
    // No backend reachable from this preview — can't follow redirects from browser
    return null;
  }

  try {
    const base = (import.meta.env.VITE_API_URL as string) ||
      (window.location.hostname && !/lovable/.test(window.location.hostname)
        ? `http://${window.location.hostname}:3000/api`
        : "");
    if (!base) return null;
    const res = await fetch(`${base}/geo/resolve?url=${encodeURIComponent(url)}`);
    if (!res.ok) {
      cache[url] = null; saveCache(cache);
      return null;
    }
    const data = await res.json();
    if (typeof data.lat === "number" && typeof data.lng === "number") {
      cache[url] = { lat: data.lat, lng: data.lng };
      saveCache(cache);
      return [data.lat, data.lng];
    }
    cache[url] = null; saveCache(cache);
    return null;
  } catch {
    return null;
  }
}

/**
 * Resolve many URLs sequentially with progress callback.
 * Returns a map of url -> "lat,lng" string (only for resolved entries).
 */
export async function resolveMapsUrlsBatch(
  urls: string[],
  onProgress?: (done: number, total: number) => void
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const unique = Array.from(new Set(urls.filter(Boolean)));
  for (let i = 0; i < unique.length; i++) {
    const u = unique[i];
    const c = await resolveMapsUrl(u);
    if (c) out[u] = `${c[0]},${c[1]}`;
    onProgress?.(i + 1, unique.length);
  }
  return out;
}
