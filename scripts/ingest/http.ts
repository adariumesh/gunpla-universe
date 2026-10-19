import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/*
 * Polite, cached fetch for open data APIs. Every response is snapshotted to
 * data/sources/cache so re-runs are offline and reproducible; pass
 * refresh=true to re-fetch. Identifies itself honestly and spaces requests.
 */

export const USER_AGENT = "GunplaUniverseIngest/0.1 (open-data research prototype; contact via repo owner)";
const CACHE_ROOT = join(process.cwd(), "data", "sources", "cache");
const MIN_INTERVAL_MS = 1100;

let last = 0;

export type Snapshot<T> = { url: string; fetchedAt: string; body: T };

export async function fetchText(source: string, url: string, refresh = false): Promise<Snapshot<string>> {
  return fetchCached(source, url, refresh, async (res) => res.text(), "*/*");
}

export async function fetchJson<T>(source: string, url: string, refresh = false): Promise<Snapshot<T>> {
  return fetchCached(source, url, refresh, async (res) => (await res.json()) as T, "application/json");
}

async function fetchCached<T>(source: string, url: string, refresh: boolean, read: (r: Response) => Promise<T>, accept: string): Promise<Snapshot<T>> {
  const dir = join(CACHE_ROOT, source);
  const file = join(dir, `${createHash("sha1").update(url).digest("hex").slice(0, 16)}.json`);
  if (!refresh && existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));

  const wait = last + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();

  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: accept } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  const body = await read(res);
  const snap: Snapshot<T> = { url, fetchedAt: new Date().toISOString(), body };
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, JSON.stringify(snap));
  return snap;
}
