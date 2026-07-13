import { supabase } from "@/integrations/supabase/client";

export const GEO_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;

export const GEO_FIELD_NAMES = [
  "estado_nacimiento",
  "municipio_nacimiento",
  "ciudad_nacimiento",
  "parroquia_nacimiento",
  "estado",
  "municipio",
  "ciudad",
  "parroquia",
  "lugar_nacimiento",
  "state_id",
  "municipality_id",
  "city_id",
  "parish_id",
] as const;

const IN_CHUNK_SIZE = 100;

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export function resolveGeoName(
  value: string | undefined | null,
  geoCache: Record<string, string>,
  fallback = "",
): string {
  if (value == null || value === "") return fallback;
  const v = String(value).trim();
  if (!v) return fallback;
  if (GEO_UUID_PATTERN.test(v)) return geoCache[v] || fallback || v;
  return v;
}

export function resolveGeoDisplayValue(
  value: unknown,
  geoCache: Record<string, string>,
): string {
  if (value == null || value === "") return "—";
  const resolved = resolveGeoName(String(value), geoCache, "");
  return resolved || "—";
}

function collectUuidsFromFormData(
  formDataList: Record<string, unknown>[],
  uuids: Set<string>,
): void {
  for (const fd of formDataList) {
    for (const key of GEO_FIELD_NAMES) {
      const val = fd[key];
      if (typeof val === "string" && GEO_UUID_PATTERN.test(val)) uuids.add(val);
    }
    for (const val of Object.values(fd)) {
      if (typeof val === "string" && GEO_UUID_PATTERN.test(val)) uuids.add(val);
    }
  }
}

async function fetchGeoRowsByIds(
  table: "states" | "municipalities" | "cities" | "parishes",
  ids: string[],
): Promise<{ id: string; name: string }[]> {
  const chunks = chunkArray(ids, IN_CHUNK_SIZE);
  const rows: { id: string; name: string }[] = [];
  for (const chunk of chunks) {
    const { data } = await supabase.from(table).select("id, name").in("id", chunk);
    if (data) rows.push(...data);
  }
  return rows;
}

async function fetchStateAcronymsByIds(
  ids: string[],
): Promise<Record<string, string>> {
  const chunks = chunkArray(ids, IN_CHUNK_SIZE);
  const cache: Record<string, string> = {};
  for (const chunk of chunks) {
    const { data } = await supabase
      .from("states")
      .select("id, acronym")
      .in("id", chunk);
    if (data) {
      for (const row of data) {
        if (row.acronym?.trim()) cache[row.id] = row.acronym.trim();
      }
    }
  }
  return cache;
}

export async function buildStateAcronymCacheFromFormData(
  formDataList: Record<string, unknown>[],
): Promise<Record<string, string>> {
  const stateIds = new Set<string>();
  for (const fd of formDataList) {
    const val = fd.estado_nacimiento;
    if (typeof val === "string" && GEO_UUID_PATTERN.test(val)) {
      stateIds.add(val);
    }
  }
  if (stateIds.size === 0) return {};
  return fetchStateAcronymsByIds(Array.from(stateIds));
}

export async function buildGeoCacheFromFormData(
  formDataList: Record<string, unknown>[],
): Promise<Record<string, string>> {
  const uuids = new Set<string>();
  collectUuidsFromFormData(formDataList, uuids);
  if (uuids.size === 0) return {};

  const ids = Array.from(uuids);
  const [statesR, munisR, citiesR, parishesR] = await Promise.all([
    fetchGeoRowsByIds("states", ids),
    fetchGeoRowsByIds("municipalities", ids),
    fetchGeoRowsByIds("cities", ids),
    fetchGeoRowsByIds("parishes", ids),
  ]);

  const cache: Record<string, string> = {};
  for (const row of statesR) cache[row.id] = row.name;
  for (const row of munisR) cache[row.id] = row.name;
  for (const row of citiesR) cache[row.id] = row.name;
  for (const row of parishesR) cache[row.id] = row.name;
  return cache;
}
