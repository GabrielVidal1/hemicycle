/**
 * Runtime data loaders. The EP dataset is large, so we fetch it as static JSON
 * assets (copied into public/data by scripts/copy-data.sh) rather than importing
 * the package's JS-bundled chunks — which would make the bundler OOM. We still
 * use the package's types + pure helpers.
 */
import type {
  DetailYear,
  Group,
  VoteDetail,
  VoteIndexEntry,
} from "@hemicycle/european-parliament-votes";

const BASE = `${import.meta.env.BASE_URL}data/`;

async function json<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

export const loadVotesIndex = () => json<VoteIndexEntry[]>("votes-index.json");
export const loadGroups = () =>
  json<Record<string, Group>>("reference/groups.json");
export const loadYearDetail = (year: DetailYear | number) =>
  json<VoteDetail[]>(`votes-detail/${year}.json`);
