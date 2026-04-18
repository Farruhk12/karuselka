/**
 * Единый список опций дизайна для админки и публичной фильтрации.
 * Шрифты / темы / размеры / обложки дублируют данные из carousel_generator (импорт оттуда невозможен без циклов — держим синхронно).
 */
import { ALL_SLIDE_LAYOUT_IDS, LAYOUTS } from "./templateCatalog";

export type VisibilityMode = "all" | "none" | "pro_only" | "free_only";

export const VISIBILITY_OPTIONS: { value: VisibilityMode; label: string; hint: string }[] = [
  { value: "all", label: "Видно всем", hint: "Обычные и Pro" },
  { value: "none", label: "Скрыть для всех", hint: "Только админы в редакторе" },
  { value: "pro_only", label: "Скрыть обычных пользователей", hint: "Видят только Pro" },
  { value: "free_only", label: "Скрыть для Pro", hint: "Видят только без Pro" },
];

export function isVisibleForUser(mode: VisibilityMode | undefined, isPro: boolean, isAdmin: boolean): boolean {
  if (isAdmin) return true;
  const m = mode ?? "all";
  if (m === "none") return false;
  if (m === "all") return true;
  if (m === "pro_only") return isPro;
  if (m === "free_only") return !isPro;
  return true;
}

/** Карта id → режим; отсутствующие id считаются "all". */
export type VisibilityMap = Record<string, VisibilityMode>;

export type ContentAccessPayload = {
  layouts: VisibilityMap;
  covers: VisibilityMap;
  fonts: VisibilityMap;
  sizes: VisibilityMap;
  themes: VisibilityMap;
};

export const COVER_ITEMS: { id: string; label: string }[] = [
  { id: "cover_doc_network", label: "Док-обложка" },
  { id: "cover_clean", label: "Чистая обложка" },
  { id: "cover_spot", label: "Акцентная обложка" },
  { id: "cover_split", label: "Обложка сплит" },
  { id: "cover_editorial", label: "Обложка редакция" },
  { id: "cover_ribbon", label: "Обложка лента" },
  { id: "cover_glow", label: "Обложка glow" },
  { id: "cover_wave", label: "Обложка wave" },
  { id: "cover_orbit", label: "Обложка orbit" },
  { id: "cover_prism", label: "Обложка prism" },
  { id: "cover_halo", label: "Обложка halo" },
  { id: "cover_streak", label: "Обложка streak" },
  { id: "cover_luxe", label: "Обложка luxe" },
  { id: "cover_magazine", label: "Обложка Vogue" },
  { id: "cover_torn", label: "Обложка рваная" },
  { id: "cover_sticker", label: "Обложка стикер" },
  { id: "cover_film", label: "Обложка плёнка" },
  { id: "cover_minimal_type", label: "Обложка типо" },
  { id: "cover_grid_lines", label: "Обложка сетка" },
];

export const FONT_ITEMS: { id: string; label: string }[] = [
  { id: "montserrat", label: "Montserrat" },
  { id: "rubik", label: "Rubik" },
  { id: "opensans", label: "Open Sans" },
  { id: "ibmplex", label: "IBM Plex Sans" },
  { id: "noto", label: "Noto Sans" },
  { id: "sourcesans", label: "Source Sans 3" },
  { id: "fira", label: "Fira Sans" },
  { id: "golos", label: "Golos Text" },
  { id: "comic_cat", label: "Comic CAT" },
];

export const SIZE_ITEMS: { id: string; label: string }[] = [
  { id: "square", label: "Квадрат 1:1" },
  { id: "portrait", label: "Портрет 4:5" },
  { id: "story", label: "Сторис 9:16" },
];

export const THEME_ITEMS: { id: string; label: string }[] = [
  { id: "white_blue", label: "Белый + Синий" },
  { id: "white_coral", label: "Белый + Коралл" },
  { id: "red_fire", label: "Красный E41100" },
  { id: "dark_red", label: "Тёмный + Красный" },
  { id: "coral_soft", label: "Коралловый" },
  { id: "dark_blue", label: "Тёмный + Голубой" },
  { id: "dark_green", label: "Тёмный + Зелёный" },
  { id: "purple", label: "Фиолетовый" },
  { id: "warm", label: "Тёплый" },
  { id: "bw", label: "Ч/Б" },
  { id: "pastel", label: "Пастель" },
  { id: "mint", label: "Мятный" },
  { id: "dark_gold", label: "Тёмный + Золото" },
  { id: "neon_night", label: "Неон ночь" },
  { id: "aurora", label: "Аврора" },
];

const ALL_KNOWN_IDS = {
  layouts: ALL_SLIDE_LAYOUT_IDS,
  covers: COVER_ITEMS.map((c) => c.id),
  fonts: FONT_ITEMS.map((f) => f.id),
  sizes: SIZE_ITEMS.map((s) => s.id),
  themes: THEME_ITEMS.map((t) => t.id),
};

export function emptyVisibilityMap(ids: string[], mode: VisibilityMode = "all"): VisibilityMap {
  const m: VisibilityMap = {};
  for (const id of ids) m[id] = mode;
  return m;
}

export function defaultContentAccess(): ContentAccessPayload {
  return {
    layouts: emptyVisibilityMap(ALL_KNOWN_IDS.layouts),
    covers: emptyVisibilityMap(ALL_KNOWN_IDS.covers),
    fonts: emptyVisibilityMap(ALL_KNOWN_IDS.fonts),
    sizes: emptyVisibilityMap(ALL_KNOWN_IDS.sizes),
    themes: emptyVisibilityMap(ALL_KNOWN_IDS.themes),
  };
}

const ALLOWED = new Set<VisibilityMode>(["all", "none", "pro_only", "free_only"]);

function sanitizeMap(input: unknown, allowedIds: string[]): VisibilityMap {
  const out: VisibilityMap = {};
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  for (const id of allowedIds) {
    const v = raw[id];
    out[id] = typeof v === "string" && ALLOWED.has(v as VisibilityMode) ? (v as VisibilityMode) : "all";
  }
  return out;
}

/** Нормализует ответ API: только известные id, остальные all. */
export function normalizeContentAccess(input: unknown): ContentAccessPayload {
  const d = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return {
    layouts: sanitizeMap(d.layouts, ALL_KNOWN_IDS.layouts),
    covers: sanitizeMap(d.covers, ALL_KNOWN_IDS.covers),
    fonts: sanitizeMap(d.fonts, ALL_KNOWN_IDS.fonts),
    sizes: sanitizeMap(d.sizes, ALL_KNOWN_IDS.sizes),
    themes: sanitizeMap(d.themes, ALL_KNOWN_IDS.themes),
  };
}

export function migrateLayoutsFromLegacyEnabledList(enabledIds: string[]): VisibilityMap {
  const set = new Set(enabledIds.filter((id) => ALL_KNOWN_IDS.layouts.includes(id)));
  const m: VisibilityMap = {};
  for (const id of ALL_KNOWN_IDS.layouts) {
    m[id] = set.has(id) ? "all" : "none";
  }
  if (Object.values(m).every((v) => v === "none")) {
    return emptyVisibilityMap(ALL_KNOWN_IDS.layouts);
  }
  return m;
}

export { LAYOUTS, ALL_SLIDE_LAYOUT_IDS };
