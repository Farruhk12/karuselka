import { redis } from "./_db";
import {
  defaultContentAccess,
  normalizeContentAccess,
  migrateLayoutsFromLegacyEnabledList,
  type ContentAccessPayload,
} from "../src/contentAccessCatalog";

export const CONTENT_ACCESS_KEY = "config:content-access-v2";
const LEGACY_LAYOUT_KEY = "config:public-slide-layout-ids";

export async function loadContentAccess(): Promise<ContentAccessPayload> {
  const raw = await redis.get<string>(CONTENT_ACCESS_KEY);
  if (raw != null && raw !== "") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return normalizeContentAccess(parsed);
    } catch {
      return defaultContentAccess();
    }
  }

  const cfg = defaultContentAccess();
  const legacy = await redis.get<string>(LEGACY_LAYOUT_KEY);
  if (legacy != null && legacy !== "") {
    try {
      const parsed = JSON.parse(legacy) as unknown;
      if (Array.isArray(parsed)) {
        const ids = (parsed as unknown[]).filter((x): x is string => typeof x === "string");
        cfg.layouts = migrateLayoutsFromLegacyEnabledList(ids);
      }
    } catch {
      /* keep defaults */
    }
  }
  return cfg;
}

export async function saveContentAccess(cfg: ContentAccessPayload): Promise<ContentAccessPayload> {
  const normalized = normalizeContentAccess(cfg);
  await redis.set(CONTENT_ACCESS_KEY, JSON.stringify(normalized));
  return normalized;
}
