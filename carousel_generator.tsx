import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "./src/AuthContext";
import { LAYOUTS } from "./src/templateCatalog";
import {
  COVER_ITEMS as COVER_LAYOUTS,
  isVisibleForUser,
  type ContentAccessPayload,
} from "./src/contentAccessCatalog";
import JSZip from "jszip";

const isClientDev =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
const API_PUBLIC_BASE = isClientDev ? "https://karuselka.vercel.app" : "";

function getSpeechRecognitionCtor(): { new (): SpeechRecognition } | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: { new (): SpeechRecognition }; webkitSpeechRecognition?: { new (): SpeechRecognition } };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function appendVoiceChunk(prev: string, chunk: string): string {
  const t = chunk.trim();
  if (!t) return prev;
  if (!prev) return t;
  return prev.endsWith(" ") || prev.endsWith("\n") ? prev + t : `${prev} ${t}`;
}

/** Показать базу + «живой» фрагмент распознавания в поле ввода */
function appendVoiceLive(base: string, live: string): string {
  if (!live.trim()) return base;
  return appendVoiceChunk(base, live);
}

const REQUEST_HISTORY_KEY = "karuselka_request_history_v1";
const REQUEST_HISTORY_MAX = 50;

export type RequestHistoryItem = {
  id: string;
  at: string;
  /** Короткое название в списке: заголовок 1-го слайда (ИИ) или первая строка темы */
  titleLabel: string;
  topic: string;
  notes: string;
  slideCount: number;
  username: string;
  composeMode: "ai" | "manual";
};

/** Убрать *акценты*, сжать пробелы; если пусто — первая строка темы */
function formatHistorySlideTitle(raw: string, fallbackTopic: string): string {
  let s = (raw || "")
    .replace(/\*+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) {
    const fb = (fallbackTopic || "").split("\n")[0].trim().replace(/\s+/g, " ");
    s = fb;
  }
  if (s.length > 72) s = `${s.slice(0, 70)}…`;
  return s || "— без названия —";
}

function readRequestHistoryFromStorage(): RequestHistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(REQUEST_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x): x is RequestHistoryItem =>
          x != null &&
          typeof x === "object" &&
          typeof (x as RequestHistoryItem).id === "string" &&
          typeof (x as RequestHistoryItem).at === "string" &&
          typeof (x as RequestHistoryItem).topic === "string"
      )
      .map((x) => ({
        ...x,
        titleLabel:
          typeof x.titleLabel === "string" && x.titleLabel.length > 0
            ? x.titleLabel
            : formatHistorySlideTitle("", x.topic || ""),
      }));
  } catch {
    return [];
  }
}

const FONTS = [
  { id:"montserrat", label:"Montserrat", css:"'Montserrat', sans-serif", url:"https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap&subset=cyrillic,cyrillic-ext" },
  { id:"rubik",      label:"Rubik",      css:"'Rubik', sans-serif",      url:"https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700;800&display=swap&subset=cyrillic,cyrillic-ext" },
  { id:"opensans",   label:"Open Sans",  css:"'Open Sans', sans-serif",  url:"https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700;800&display=swap&subset=cyrillic,cyrillic-ext" },
  { id:"ibmplex",    label:"IBM Plex Sans", css:"'IBM Plex Sans', sans-serif", url:"https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap&subset=cyrillic,cyrillic-ext" },
  { id:"noto",       label:"Noto Sans",  css:"'Noto Sans', sans-serif",  url:"https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700;800&display=swap&subset=cyrillic,cyrillic-ext" },
  { id:"sourcesans", label:"Source Sans 3", css:"'Source Sans 3', sans-serif", url:"https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;500;600;700;800&display=swap&subset=cyrillic,cyrillic-ext" },
  { id:"fira",       label:"Fira Sans",  css:"'Fira Sans', sans-serif",  url:"https://fonts.googleapis.com/css2?family=Fira+Sans:wght@400;500;600;700;800&display=swap&subset=cyrillic,cyrillic-ext" },
  { id:"golos",      label:"Golos Text", css:"'Golos Text', sans-serif", url:"https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;700;800&display=swap&subset=cyrillic,cyrillic-ext" },
  { id:"comic_cat",  label:"Comic CAT",  css:"'Comic CAT', cursive",     url:"/fonts/comic-cat.css" },
];

const THEMES = [
  { id:"white_blue",  label:"Белый + Синий",    bg:"#ffffff", text:"#1a1a1a", accent:"#1B9AF5", sub:"#666", hl:"#1B9AF5", hlt:"#fff", border:"#e0e0e0" },
  { id:"white_coral", label:"Белый + Коралл",   bg:"#ffffff", text:"#1a1a1a", accent:"#D85A30", sub:"#666", hl:"#D85A30", hlt:"#fff", border:"#e0e0e0" },
  { id:"red_fire",    label:"Красный E41100",   bg:"#ffffff", text:"#0d0d0d", accent:"#E41100", sub:"#555", hl:"#E41100", hlt:"#fff", border:"#ffd0cc" },
  { id:"dark_red",    label:"Тёмный + Красный", bg:"#120000", text:"#ffffff", accent:"#E41100", sub:"rgba(255,255,255,.65)", hl:"#E41100", hlt:"#fff", border:"#3d0000" },
  { id:"coral_soft",  label:"Коралловый",       bg:"#fff4f2", text:"#1a0805", accent:"#FF5C3A", sub:"#8B3020", hl:"#FF5C3A", hlt:"#fff", border:"#FFCCC4" },
  { id:"dark_blue",   label:"Тёмный + Голубой", bg:"#0e1a2b", text:"#ffffff", accent:"#4FC3F7", sub:"#90CAF9", hl:"#4FC3F7", hlt:"#0e1a2b", border:"#1e3a5f" },
  { id:"dark_green",  label:"Тёмный + Зелёный", bg:"#0a1f0a", text:"#ffffff", accent:"#66BB6A", sub:"#A5D6A7", hl:"#66BB6A", hlt:"#0a1f0a", border:"#1b5e20" },
  { id:"purple",      label:"Фиолетовый",        bg:"#1e1030", text:"#ffffff", accent:"#CE93D8", sub:"#BA68C8", hl:"#CE93D8", hlt:"#1e1030", border:"#4a148c" },
  { id:"warm",        label:"Тёплый",            bg:"#FFF8F0", text:"#2D1B00", accent:"#E65100", sub:"#8D3E00", hl:"#E65100", hlt:"#fff", border:"#FFCCBC" },
  { id:"bw",          label:"Ч/Б",               bg:"#ffffff", text:"#000000", accent:"#000000", sub:"#444", hl:"#000", hlt:"#fff", border:"#ddd" },
  { id:"pastel",      label:"Пастель",           bg:"#FDF6FF", text:"#2d1b3d", accent:"#9C27B0", sub:"#7B1FA2", hl:"#E1BEE7", hlt:"#4a148c", border:"#E1BEE7" },
  { id:"mint",        label:"Мятный",            bg:"#F0FFF8", text:"#0d2b1f", accent:"#00897B", sub:"#00695C", hl:"#00897B", hlt:"#fff", border:"#B2DFDB" },
  { id:"dark_gold",   label:"Тёмный + Золото",   bg:"#1a1400", text:"#fff8e1", accent:"#FFD600", sub:"#FFB300", hl:"#FFD600", hlt:"#1a1400", border:"#5a4500" },
  { id:"neon_night",  label:"Неон ночь",          bg:"#050014", text:"#ffffff", accent:"#00F5FF", sub:"rgba(255,255,255,.6)", hl:"#00F5FF", hlt:"#050014", border:"#1a0050" },
  { id:"aurora",      label:"Аврора",             bg:"#0d0a2e", text:"#ffffff", accent:"#A855F7", sub:"rgba(255,255,255,.6)", hl:"#A855F7", hlt:"#0d0a2e", border:"#2d1b69" },
];

function clamp(n:number,min:number,max:number){ return Math.max(min,Math.min(max,n)); }
function hexToRgb(hex:string){
  const h = (hex||"").trim().replace("#","");
  if(!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return { r:parseInt(h.slice(0,2),16), g:parseInt(h.slice(2,4),16), b:parseInt(h.slice(4,6),16) };
}
function rgbToHex(r:number,g:number,b:number){
  return "#"+[r,g,b].map(v=>clamp(Math.round(v),0,255).toString(16).padStart(2,"0")).join("");
}
function mixHex(a:string,b:string,t:number){
  const ca=hexToRgb(a), cb=hexToRgb(b); if(!ca||!cb) return a;
  return rgbToHex(ca.r+(cb.r-ca.r)*t, ca.g+(cb.g-ca.g)*t, ca.b+(cb.b-ca.b)*t);
}
function luminance(hex:string){
  const c=hexToRgb(hex); if(!c) return 0;
  const f=(v:number)=>{ const x=v/255; return x<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4); };
  return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b);
}
function deriveBrandTheme(primary:string, label="Бренд авто"){
  const safe = /^#[0-9a-fA-F]{6}$/.test(primary||"") ? primary : "#1B9AF5";
  const warm = ((hexToRgb(safe)?.r||0) + (hexToRgb(safe)?.g||0)*0.3) > ((hexToRgb(safe)?.b||0)*1.2);
  const lightBg = warm ? mixHex("#FFF8F1", safe, 0.05) : mixHex("#F4F8FF", safe, 0.06);
  const darkBg = warm ? mixHex("#1A1918", safe, 0.08) : mixHex("#0F172A", safe, 0.08);
  const border = mixHex(lightBg, safe, 0.18);
  const accent = safe;
  const sub = luminance(lightBg) > 0.45 ? "rgba(20,20,20,.62)" : "rgba(255,255,255,.68)";
  return {
    id: "brand_auto",
    label,
    bg: lightBg,
    text: luminance(lightBg) > 0.45 ? "#131313" : "#ffffff",
    accent,
    sub,
    hl: mixHex(accent, "#ffffff", 0.16),
    hlt: luminance(accent) > 0.55 ? "#0b0b0b" : "#ffffff",
    border,
    darkBg,
    brandLight: mixHex(accent, "#ffffff", 0.22),
    brandDark: mixHex(accent, "#000000", 0.32),
  };
}

const SIZES = [
  { id:"square",  label:"Квадрат 1:1", w:540, h:540 },
  { id:"portrait",label:"Портрет 4:5", w:540, h:675 },
  { id:"story",   label:"Сторис 9:16", w:405, h:720 },
];

const TEMPLATE_TOKENS = {
  contentMaxWidth: "86%",
  softPanelLight: "rgba(255,255,255,.06)",
  softPanelDark: "rgba(0,0,0,.22)",
  titleTracking: -0.6,
  bodyLineHeight: 1.65,
  tagLetterSpacing: 2.3,
};

const TEXT_POSITION_PRESETS = [
  { id:"full",   label:"Во всю ширину", justify:"flex-start", width:"100%", textAlign:"left" as const },
  { id:"left",   label:"Слева",         justify:"flex-start", width:"84%",  textAlign:"left" as const },
  { id:"center", label:"По центру",     justify:"center",     width:"93%",  textAlign:"center" as const },
  { id:"right",  label:"Справа",        justify:"flex-end",   width:"84%",  textAlign:"right" as const },
];
const DEFAULT_PHOTO_TRANSFORM = { x: 0, y: 0, scale: 1 };

// Free-tier limits
const FREE_SIZES = ["square"];
const FREE_THEMES = ["white_blue","white_coral","dark_blue","red_fire","coral_soft"];
const FREE_FONTS = ["montserrat"];
const FREE_LAYOUTS = ["bold_center","left_number"];
const INLINE_PHOTO_LAYOUTS = ["split_photo","magazine","before_after","photo","doc_story","doc_quote","doc_ending","cover_doc_network"];
const FREE_MAX_SLIDES = 5;

// Preset text color combos for "on photo" mode
const TEXT_PRESETS = [
  { id:"white",      label:"Белый",      title:"#ffffff", body:"rgba(255,255,255,0.85)", accent:"#ffffff", hl:"rgba(255,255,255,0.25)", hlt:"#ffffff" },
  { id:"yellow",     label:"Жёлтый",     title:"#FFD600", body:"rgba(255,255,255,0.85)", accent:"#FFD600", hl:"rgba(255,214,0,0.3)",    hlt:"#1a1400" },
  { id:"cyan",       label:"Голубой",    title:"#4FC3F7", body:"rgba(255,255,255,0.82)", accent:"#4FC3F7", hl:"rgba(79,195,247,0.3)",   hlt:"#fff" },
  { id:"coral",      label:"Коралл",     title:"#FF6B6B", body:"rgba(255,255,255,0.82)", accent:"#FF6B6B", hl:"rgba(255,107,107,0.3)",  hlt:"#fff" },
  { id:"green",      label:"Зелёный",    title:"#66BB6A", body:"rgba(255,255,255,0.82)", accent:"#66BB6A", hl:"rgba(102,187,106,0.3)",  hlt:"#fff" },
  { id:"pink",       label:"Розовый",    title:"#F48FB1", body:"rgba(255,255,255,0.82)", accent:"#F48FB1", hl:"rgba(244,143,177,0.3)",  hlt:"#fff" },
  { id:"dark",       label:"Тёмный",     title:"#1a1a1a", body:"rgba(0,0,0,0.75)",       accent:"#1a1a1a", hl:"rgba(0,0,0,0.15)",       hlt:"#fff" },
];

const OPENAI_API_KEY = String((import.meta as any).env?.VITE_OPENAI_API_KEY || "");
const OPENAI_MODEL = String((import.meta as any).env?.VITE_OPENAI_MODEL || "gpt-4o-mini");

const loadedFonts = new Set();
function loadFont(f) {
  if (!f?.url || loadedFonts.has(f.id)) return;
  loadedFonts.add(f.id);
  const l = document.createElement("link"); l.rel = "stylesheet"; l.href = f.url;
  document.head.appendChild(l);
}

// Pre-fetch & cache Google Font CSS+files as base64 for export
const fontEmbedCache = new Map();
async function embedFontCSS(f) {
  if (!f?.url) return "";
  if (fontEmbedCache.has(f.id)) return fontEmbedCache.get(f.id);
  try {
    const res = await fetch(f.url);
    let css = await res.text();
    const urls = css.match(/url\([^)]+\)/g) || [];
    for (const u of urls) {
      const href = u.slice(4, -1).replace(/['"]/g, "");
      if (href.startsWith("data:")) continue;
      try {
        const resolvedHref = new URL(href, res.url || window.location.href).toString();
        const r = await fetch(resolvedHref);
        const blob = await r.blob();
        const b64 = await new Promise(ok => { const rd = new FileReader(); rd.onload = () => ok(rd.result); rd.readAsDataURL(blob); });
        css = css.replace(href, b64 as string);
      } catch {}
    }
    fontEmbedCache.set(f.id, css);
    return css;
  } catch { fontEmbedCache.set(f.id, ""); return ""; }
}

// ── Accordion section ─────────────────────────────────────────────────────────
function Section({ title, badge, children, defaultOpen=false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{
      border:`1px solid ${open?"rgba(37,99,235,0.25)":"var(--color-border-tertiary)"}`,
      borderRadius:14, overflow:"hidden", marginBottom:10,
      background:"var(--color-card-bg)",
      boxShadow: open ? "0 4px 20px rgba(37,99,235,0.08)" : "0 1px 6px var(--color-card-shadow)",
      transition:"box-shadow .2s, border-color .2s",
    }}>
      <button onClick={()=>setOpen(o=>!o)} style={{
        width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"14px 18px",
        background: open ? "rgba(37,99,235,0.04)" : "var(--color-card-bg)",
        border:"none", borderLeft:`3px solid ${open?"#2563eb":"transparent"}`,
        cursor:"pointer", fontSize:13, fontWeight:700, letterSpacing:-0.1,
        color:"var(--color-text-primary)", transition:"all .2s",
        fontFamily:"inherit",
      }}>
        <span style={{ display:"flex", alignItems:"center", gap:8 }}>
          {title}
          {badge && <span style={{ fontSize:11, fontWeight:400, color:"var(--color-text-secondary)", background:"var(--color-section-bg)", padding:"2px 10px", borderRadius:20, border:"1px solid var(--color-border-tertiary)" }}>{badge}</span>}
        </span>
        <span style={{ fontSize:11, color:"var(--color-text-secondary)", transition:"transform .2s", display:"inline-block", transform:open?"rotate(180deg)":"rotate(0deg)" }}>▼</span>
      </button>
      {open && <div style={{ padding:"16px 18px", background:"var(--color-section-bg)", borderTop:"1px solid var(--color-border-tertiary)" }}>{children}</div>}
    </div>
  );
}

// ── Photo editor ──────────────────────────────────────────────────────────────
function PhotoEditor({ src, w, h, fitMode = "cover", onSave, onCancel }) {
  const [ox, setOx] = useState(0), [oy, setOy] = useState(0), [scale, setScale] = useState(1);
  const [imgNat, setImgNat] = useState({ w: 1, h: 1 });
  const drag = useRef<{ active: boolean; x: number; y: number }>({ active:false, x:0, y:0 });
  const PW = Math.min(380, w), PH = Math.round(PW * h / w);
  useEffect(() => {
    const img = new Image();
    img.onload = () => setImgNat({ w: img.width || 1, h: img.height || 1 });
    img.src = src;
  }, [src]);

  const getBaseScale = (targetW:number, targetH:number, imageW:number, imageH:number) => (
    fitMode === "contain"
      ? Math.min(targetW / imageW, targetH / imageH)
      : Math.max(targetW / imageW, targetH / imageH)
  );
  const previewBase = getBaseScale(PW, PH, imgNat.w, imgNat.h);
  const previewW = imgNat.w * previewBase * scale;
  const previewH = imgNat.h * previewBase * scale;
  const previewX = (PW - previewW) / 2 + ox;
  const previewY = (PH - previewH) / 2 + oy;

  const pd = e => {
    drag.current = { active:true, x:e.clientX, y:e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };
  const pm = e => {
    if(!drag.current.active) return;
    setOx(v=>v+(e.clientX-drag.current.x));
    setOy(v=>v+(e.clientY-drag.current.y));
    drag.current = { ...drag.current, x:e.clientX, y:e.clientY };
  };
  const pu = () => { drag.current = { ...drag.current, active:false }; };
  const onWheel = e => {
    e.preventDefault();
    setScale(v => Math.max(.5, Math.min(4, v + (e.deltaY > 0 ? -0.05 : 0.05))));
  };
  function save() {
    const c=document.createElement("canvas"); c.width=w; c.height=h;
    const ctx=c.getContext("2d"), img=new Image(); img.src=src;
    img.onload=()=>{
      const base=getBaseScale(w, h, img.width, img.height);
      const iw=img.width*base*scale, ih=img.height*base*scale;
      const x=(w-iw)/2+ox*(w/PW), y=(h-ih)/2+oy*(h/PH);
      // Keep empty margins clean when the user scales the image down.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img,x,y,iw,ih);
      onSave(c.toDataURL("image/jpeg",.92));
    };
  }
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.9)",zIndex:9999,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14}}>
      <p style={{color:"#fff",fontSize:14,margin:0}}>
        {fitMode === "contain"
          ? "Перетаскивай фото и увеличивай его без жёсткой обрезки по краям"
          : "Перетаскивай фото, меняй масштаб колесом или ползунком"}
      </p>
      <div onPointerDown={pd} onPointerMove={pm} onPointerUp={pu} onPointerCancel={pu} onWheel={onWheel}
        style={{width:PW,height:PH,overflow:"hidden",borderRadius:10,cursor:drag.current.active?"grabbing":"grab",position:"relative",border:"2px solid rgba(255,255,255,.3)",background:"#fff",userSelect:"none",touchAction:"none"}}>
        <img src={src} draggable={false} style={{position:"absolute",left:previewX,top:previewY,width:previewW,height:previewH,maxWidth:"none"}}/>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <span style={{color:"#aaa",fontSize:13}}>Масштаб</span>
        <input type="range" min={.5} max={3} step={.05} value={scale} onChange={e=>setScale(+e.target.value)} style={{width:130}}/>
        <span style={{color:"#fff",fontSize:13,minWidth:34}}>{Math.round(scale*100)}%</span>
        <button onClick={()=>{setOx(0); setOy(0); setScale(1);}} style={{padding:"6px 10px",borderRadius:8,border:"1px solid #666",background:"#1a1a1a",color:"#ddd",cursor:"pointer",fontSize:12}}>Сброс</button>
      </div>
      <div style={{display:"flex",gap:10}}>
        <button onClick={onCancel} style={{padding:"8px 20px",borderRadius:8,border:"1px solid #555",background:"transparent",color:"#fff",cursor:"pointer"}}>Отмена</button>
        <button onClick={save} style={{padding:"8px 24px",borderRadius:8,border:"none",background:"#1B9AF5",color:"#fff",cursor:"pointer",fontWeight:700}}>Применить</button>
      </div>
    </div>
  );
}

// ── Text parser ───────────────────────────────────────────────────────────────
function parseText(text, color, hlBg, hlColor) {
  if (!text) return null;
  return (text+"").split(/(\*[^*]+\*)/g).map((p,i) =>
    p.startsWith("*")&&p.endsWith("*")
      ? <span
          key={i}
          style={{
            background:hlBg,
            color:hlColor,
            padding:"0.04em 0.32em",
            borderRadius:"0.2em",
            display:"inline",
            boxDecorationBreak:"clone",
            WebkitBoxDecorationBreak:"clone",
            lineHeight:1.2,
          }}
        >
          {p.slice(1,-1)}
        </span>
      : <span key={i} style={{color}}>{p}</span>
  );
}

const NBSP = "\u00A0";
const HANGING_WORD_RE = /(^|[\s(«"“„])((?:а|и|но|или|либо|в|во|к|ко|с|со|у|о|об|обо|от|до|по|за|из|изо|для|без|над|под|при|про|через|между))\s+/giu;
function fixHangingWords(text: string) {
  if (!text) return "";
  return text
    .split("\n")
    .map(line => line.replace(HANGING_WORD_RE, (_m, prefix, word) => `${prefix}${word}${NBSP}`))
    .join("\n");
}
function normalizeSlideText(slide: any) {
  return {
    ...slide,
    title: fixHangingWords((slide?.title || "") as string),
    body: fixHangingWords((slide?.body || "") as string),
    tag: slide?.tag ? fixHangingWords(String(slide.tag)) : null,
    cta: slide?.cta ? fixHangingWords(String(slide.cta)) : null,
  };
}
function normalizeSlides(slides: any[]) {
  return (slides || []).map(normalizeSlideText);
}

// ── Slide ─────────────────────────────────────────────────────────────────────
function Slide({ slide, T, layout, idx, seqIdx, total, photo, beforePhoto, avatarPhoto, username, ff, w, h, moveMode, onEdit, textPreset, textOffset, textScale, onDragOffset, dragAxis = "y", photoTransform, beforePhotoTransform, igMode, textPositionPreset, editMode = false }) {
  const hasPhoto = !!photo;
  const isPhotoFullBg = hasPhoto && !INLINE_PHOTO_LAYOUTS.includes(layout);
  const slideSeq = typeof seqIdx === "number" ? seqIdx : (idx + 1);
  const activeTextPositionPreset = TEXT_POSITION_PRESETS.find((p)=>p.id===textPositionPreset) || TEXT_POSITION_PRESETS[0];

  const igRhythm = ["light","dark","gradient","light","dark","light","gradient"];
  const igVariant = igMode ? igRhythm[idx % igRhythm.length] : "theme";
  let slideBg = T.bg;

  if (igMode) {
    const primary = T.accent;
    const brandLight = (T as any).brandLight || mixHex(primary, "#ffffff", 0.22);
    const brandDark = (T as any).brandDark || mixHex(primary, "#000000", 0.32);
    const darkBg = (T as any).darkBg || "#0F172A";

    if (igVariant === "dark") {
      T = {
        ...T,
        bg: darkBg,
        text: "#ffffff",
        sub: "rgba(255,255,255,.74)",
        border: "rgba(255,255,255,.2)",
        hl: "rgba(255,255,255,.22)",
        hlt: "#ffffff",
      } as any;
      slideBg = darkBg;
    } else if (igVariant === "gradient") {
      T = {
        ...T,
        bg: darkBg,
        text: "#ffffff",
        sub: "rgba(255,255,255,.78)",
        border: "rgba(255,255,255,.24)",
        hl: "rgba(255,255,255,.24)",
        hlt: "#ffffff",
      } as any;
      slideBg = `linear-gradient(165deg, ${brandDark} 0%, ${primary} 50%, ${brandLight} 100%)`;
    } else {
      T = {
        ...T,
        bg: T.bg,
        text: "#131313",
        sub: "rgba(20,20,20,.62)",
        border: mixHex(T.bg, primary, 0.18),
        hl: mixHex(primary, "#ffffff", 0.18),
        hlt: luminance(primary) > 0.55 ? "#0B0B0B" : "#ffffff",
      } as any;
      slideBg = T.bg;
    }
  }

  // Colours: if photo on full bg → use textPreset, else use theme
  const tp = TEXT_PRESETS.find(p=>p.id===textPreset) || TEXT_PRESETS[0];
  const tc  = isPhotoFullBg ? tp.title   : T.text;
  const sc  = isPhotoFullBg ? tp.body    : T.sub;
  const ac  = isPhotoFullBg ? tp.accent  : T.accent;
  const hlB = isPhotoFullBg ? tp.hl      : T.hl;
  const hlT = isPhotoFullBg ? tp.hlt     : T.hlt;
  const activePhotoTransform = { ...DEFAULT_PHOTO_TRANSFORM, ...(photoTransform || {}) };
  const activeBeforePhotoTransform = { ...DEFAULT_PHOTO_TRANSFORM, ...(beforePhotoTransform || {}) };

  const getPhotoTransformStyle = (transform, fit: "contain" | "cover" = "cover", baseScale = 1) => ({
    position: "absolute" as const,
    left: "50%",
    top: "50%",
    width: "100%",
    height: "100%",
    maxWidth: "none",
    objectFit: fit,
    display: "block",
    transform: `translate(-50%, -50%) translate(${transform.x}px, ${transform.y}px) scale(${transform.scale * baseScale})`,
    transformOrigin: "center center",
  });

  // Per-field drag offsets: textOffset = { title: {x,y}, body: {x,y} }
  const offsets = textOffset || {};
  const scales = textScale || {};
  const dragRef = useRef(null);
  const makeDragStart = (field) => (e) => {
    if (!moveMode || !onDragOffset) return;
    e.preventDefault(); e.stopPropagation();
    const off = offsets[field] || { x: 0, y: 0 };
    const clientX = e.clientX;
    const clientY = e.clientY;
    dragRef.current = { field, startX: clientX - off.x, startY: clientY - off.y, baseOff: off };
    const move = (ev: PointerEvent) => {
      const activeDrag = dragRef.current;
      if (!activeDrag) return;
      const cx = ev.clientX;
      const cy = ev.clientY;
      const nextX = cx - activeDrag.startX;
      const nextY = cy - activeDrag.startY;
      if (dragAxis === "x") {
        onDragOffset(activeDrag.field, { x: nextX, y: activeDrag.baseOff.y });
        return;
      }
      if (dragAxis === "y") {
        onDragOffset(activeDrag.field, { x: activeDrag.baseOff.x, y: nextY });
        return;
      }
      onDragOffset(activeDrag.field, { x: nextX, y: nextY });
    };
    const up = () => { dragRef.current = null; window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const ET = ({ field, style, rows=2 }) => {
    const fOff = offsets[field] || { x: 0, y: 0 };
    const raw = slide[field] || "";
    const dragStyle = (fOff.x || fOff.y) ? { transform: `translate(${fOff.x}px,${fOff.y}px)` } : {};
    const scaleFactor = scales[field] || 1;
    const styleScaled = typeof style?.fontSize === "number" ? { ...style, fontSize: style.fontSize * scaleFactor } : style;
    const textColor = styleScaled?.color || tc;
    const applyPreset = field === "title" || field === "body";
    const dragHandleSize = Math.max(48, w * .085);
    const dragHandleInset = Math.max(8, w * .012);
    const dragHandleIcon = dragAxis === "x" ? "↔" : dragAxis === "free" ? "✥" : "↕";
    const dragHandleCursor = dragAxis === "x" ? "ew-resize" : dragAxis === "free" ? "grab" : "ns-resize";
    const dragHandleTitle = dragAxis === "x"
      ? "Переместить блок влево или вправо"
      : dragAxis === "free"
        ? "Свободно переместить блок"
        : "Переместить блок вверх или вниз";
    const positionedStyle = applyPreset
      ? {
          width: activeTextPositionPreset.width,
          maxWidth: activeTextPositionPreset.width,
          marginLeft: activeTextPositionPreset.justify === "center" || activeTextPositionPreset.justify === "flex-end" ? "auto" : undefined,
          marginRight: activeTextPositionPreset.justify === "center" ? "auto" : undefined,
          textAlign: activeTextPositionPreset.textAlign,
        }
      : {};
    if (moveMode) return (
      <div style={{...dragStyle, ...positionedStyle, position:"relative"}}>
        <button
          onPointerDown={makeDragStart(field)}
          title={dragHandleTitle}
          style={{
            position:"absolute", right:dragHandleInset, top:dragHandleInset, zIndex:2,
            width:dragHandleSize, height:dragHandleSize, padding:0,
            border:"1px solid rgba(255,255,255,.42)", borderRadius:Math.round(dragHandleSize * .28),
            background:"rgba(15,23,42,.78)", color:"#fff", cursor:dragHandleCursor,
            fontSize:Math.max(18, dragHandleSize * .38), fontWeight:900, lineHeight:1,
            touchAction:"none", display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:"0 10px 24px rgba(15,23,42,.25)", userSelect:"none", WebkitUserSelect:"none"
          }}
        >
          {dragHandleIcon}
        </button>
        <div
          style={{
            ...styleScaled,
            ...positionedStyle,
            background:"rgba(255,255,255,.06)",
            border:`1.5px dashed ${ac}`,
            borderRadius:6,
            width:"100%",
            boxSizing:"border-box",
            fontFamily:ff,
            padding:"18px 8px 6px",
            color:textColor,
            whiteSpace:"pre-wrap"
          }}
        >
          {parseText(raw, textColor, hlB, hlT)}
        </div>
      </div>
    );
    return <div style={{...styleScaled,...positionedStyle,...dragStyle,fontFamily:ff}}>{parseText(slide[field]||"",styleScaled?.color,hlB,hlT)}</div>;
  };

  const Dots = () => <div style={{display:"flex",gap:5}}>
    {Array.from({length:total}).map((_,i)=><div key={i} style={{width:i===idx?20:6,height:6,borderRadius:3,transition:"width .2s",background:i===idx?ac:(isPhotoFullBg?"rgba(255,255,255,.35)":T.border)}}/>)}
  </div>;

  const Footer = ({style={}}) => <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,...style}}>
    <span style={{fontSize:12,color:sc,fontFamily:ff}}>{username?`@${username.replace(/^@/,"")}`:" "}</span>
    <Dots/>
    {slide.cta ? (
      <div style={{minWidth:w*.16,maxWidth:w*.36,textAlign:"right"}}>
        {ET({field:"cta", rows:1, style:{fontSize:12,color:ac,fontWeight:700,textAlign:"right",lineHeight:1.3}})}
      </div>
    ) : <span style={{visibility:"hidden",fontSize:12}}>x</span>}
  </div>;

  const ph = `${h*.055}px ${w*.082}px`;
  const contentMaxWidth = TEMPLATE_TOKENS.contentMaxWidth;
  const softPanel = isPhotoFullBg ? TEMPLATE_TOKENS.softPanelDark : TEMPLATE_TOKENS.softPanelLight;
  const isLightSlide = igMode ? (igVariant === "light") : (luminance(T.bg || "#ffffff") > 0.45);
  const docBlue = "#28A8FF";
  const docRed = "#FF5F7A";
  const docBorder = "#DCEAF9";
  const docInk = "#171717";
  const docSub = "#4A4A4A";
  const docHandleBase = (username || "doc.expert").replace(/^@/,"").trim() || "doc.expert";
  const docHandleCompact = docHandleBase.replace(/\s+/g, "");
  const docBrandSlug = (docHandleCompact.replace(/^doc\./i, "").replace(/^doc_/i, "") || docHandleCompact);
  const firstSlugSegment = (docBrandSlug.split(/[._-]/)[0] || docBrandSlug).replace(/[^a-zA-Zа-яА-ЯёЁ0-9]/gi, "");
  const nameWords = docHandleBase.replace(/[._@]+/g, " ").trim().split(/\s+/).filter(Boolean);
  const docBrandCore = (() => {
    if (nameWords.length >= 2) {
      const w0 = nameWords[0].toLowerCase();
      const pick = (w0 === "doc" || w0 === "док") ? nameWords[1] : nameWords[0];
      return pick.toUpperCase().slice(0, 14);
    }
    return firstSlugSegment.slice(0, 12).toUpperCase();
  })();
  const docBrand = `DOC.${docBrandCore}`;
  const docDisplayName = docHandleBase
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((x) => x.toUpperCase())
    .join(" ");

  const DocHeader = ({ color = docBlue }: { color?: string }) => (
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      <div style={{flex:1,height:2,background:color,opacity:.95,borderRadius:999}}/>
      <span style={{
        fontSize:w*.017,
        fontWeight:800,
        letterSpacing:1.1,
        color,
        whiteSpace:"nowrap",
        maxWidth:`${w*.42}px`,
        overflow:"hidden",
        textOverflow:"ellipsis",
      }}>{docBrand}</span>
      <div style={{flex:1,height:2,background:color,opacity:.95,borderRadius:999}}/>
    </div>
  );

  const DocIllustration = ({
    frameHeight = "52%",
    imageScale = 1,
    borderColor = "transparent",
  }: {
    frameHeight?: string;
    imageScale?: number;
    borderColor?: string;
  }) => (
    <div style={{height:frameHeight,position:"relative",display:"flex",alignItems:"center",justifyContent:"center",width:"100%",minHeight:0}}>
      <div style={{
        position:"relative",
        width:"100%",
        maxWidth:`${w*.9}px`,
        height:`${h*.48}px`,
        maxHeight:"100%",
        borderRadius:20,
        border:borderColor === "transparent" ? "none" : `2px solid ${borderColor}`,
        display:"flex",
        alignItems:"center",
        justifyContent:"center",
        overflow:"hidden",
        boxSizing:"border-box",
      }}>
        {photo ? (
          <img src={photo} alt="" style={getPhotoTransformStyle(activePhotoTransform, "contain", imageScale)}/>
        ) : (
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,color:docBlue,opacity:.45}}>
            <span style={{fontSize:42}}>🖼</span>
            <span style={{fontSize:12,fontWeight:700}}>Иллюстрация</span>
          </div>
        )}
      </div>
    </div>
  );

  const IGOverlay = () => {
    if (!igMode) return null;
    const pct = ((idx + 1) / Math.max(total,1)) * 100;
    const trackColor = isLightSlide ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.12)";
    const fillColor = isLightSlide ? T.accent : "#ffffff";
    const labelColor = isLightSlide ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.45)";
    const arrowBg = isLightSlide ? "linear-gradient(90deg, transparent, rgba(0,0,0,0.06))" : "linear-gradient(90deg, transparent, rgba(255,255,255,0.08))";
    const arrowStroke = isLightSlide ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.38)";
    return (
      <>
        {idx < total - 1 && (
          <div style={{position:"absolute",top:0,bottom:0,right:0,width:42,display:"flex",alignItems:"center",justifyContent:"center",background:arrowBg,zIndex:8,pointerEvents:"none"}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={arrowStroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 6 15 12 9 18"/>
            </svg>
          </div>
        )}
        <div style={{position:"absolute",left:0,right:0,bottom:0,padding:`0 ${w*.052}px ${h*.03}px`,display:"flex",alignItems:"center",gap:8,zIndex:9,pointerEvents:"none"}}>
          <div style={{flex:1,height:3,borderRadius:999,background:trackColor,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${pct}%`,background:fillColor,borderRadius:999,transition:"width .25s"}} />
          </div>
          <span style={{fontSize:11,fontWeight:600,color:labelColor,minWidth:32,textAlign:"right",fontFamily:ff}}>{slideSeq}/{total}</span>
        </div>
      </>
    );
  };

  // Simple wrapper (drag is now per-field inside ET)
  const DragWrap = ({children, rootStyle}: {children: any, rootStyle: any}) => (
    <div style={{position:"relative",...rootStyle}}>{children}</div>
  );

  /** Обложка «Док»: первая строка заголовка — синяя, остальные — чёрные (разделитель — перевод строки в тексте). */
  const DocCoverTitle = () => {
    const field = "title";
    const raw = (slide.title || "") as string;
    const fOff = offsets[field] || { x: 0, y: 0 };
    const dragStyle = (fOff.x || fOff.y) ? { transform: `translate(${fOff.x}px,${fOff.y}px)` } : {};
    const scaleFactor = scales[field] || 1;
    const baseFont = w * 0.074 * scaleFactor;
    const lines = raw.split("\n");
    const positionedStyle =
      layout === "cover_doc_network"
        ? { width: "100%", maxWidth: "100%", marginLeft: "auto", marginRight: "auto", textAlign: "center" as const }
        : {
            width: activeTextPositionPreset.width,
            maxWidth: activeTextPositionPreset.width,
            marginLeft: activeTextPositionPreset.justify === "center" || activeTextPositionPreset.justify === "flex-end" ? "auto" : undefined,
            marginRight: activeTextPositionPreset.justify === "center" ? "auto" : undefined,
            textAlign: activeTextPositionPreset.textAlign,
          };
    const dragHandleSize = Math.max(48, w * 0.085);
    const dragHandleInset = Math.max(8, w * 0.012);
    const dragHandleIcon = dragAxis === "x" ? "↔" : dragAxis === "free" ? "✥" : "↕";
    const dragHandleCursor = dragAxis === "x" ? "ew-resize" : dragAxis === "free" ? "grab" : "ns-resize";
    const dragHandleTitle =
      dragAxis === "x"
        ? "Переместить блок влево или вправо"
        : dragAxis === "free"
          ? "Свободно переместить блок"
          : "Переместить блок вверх или вниз";
    const lineStyle = (i: number) => ({
      fontSize: baseFont,
      fontWeight: 900,
      lineHeight: layout === "cover_doc_network" ? 1.12 : 1.03,
      letterSpacing: layout === "cover_doc_network" ? -0.9 : -1.2,
      textAlign: "center" as const,
      marginTop: i > 0 ? (layout === "cover_doc_network" ? 8 : 6) : 0,
      color: i === 0 && lines.length > 1 ? docBlue : docInk,
    });
    const innerBlocks = lines.map((line, i) => (
      <div key={i} style={lineStyle(i)}>
        {parseText(line, lineStyle(i).color, hlB, hlT)}
      </div>
    ));
    if (moveMode) {
      return (
        <div style={{ ...dragStyle, ...positionedStyle, position: "relative" }}>
          <button
            onPointerDown={makeDragStart(field)}
            title={dragHandleTitle}
            style={{
              position: "absolute",
              right: dragHandleInset,
              top: dragHandleInset,
              zIndex: 2,
              width: dragHandleSize,
              height: dragHandleSize,
              padding: 0,
              border: "1px solid rgba(255,255,255,.42)",
              borderRadius: Math.round(dragHandleSize * 0.28),
              background: "rgba(15,23,42,.78)",
              color: "#fff",
              cursor: dragHandleCursor,
              fontSize: Math.max(18, dragHandleSize * 0.38),
              fontWeight: 900,
              lineHeight: 1,
              touchAction: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 10px 24px rgba(15,23,42,.25)",
              userSelect: "none",
              WebkitUserSelect: "none",
            }}
          >
            {dragHandleIcon}
          </button>
          <div
            style={{
              ...positionedStyle,
              background: "rgba(255,255,255,.06)",
              border: `1.5px dashed ${ac}`,
              borderRadius: 6,
              width: "100%",
              boxSizing: "border-box",
              fontFamily: ff,
              padding: "18px 8px 6px",
              whiteSpace: "pre-wrap",
            }}
          >
            {innerBlocks}
          </div>
        </div>
      );
    }
    return (
      <div style={{ ...dragStyle, ...positionedStyle, fontFamily: ff }}>
        {innerBlocks}
      </div>
    );
  };

  // SPLIT PHOTO
  if (layout==="split_photo") return (
    <DragWrap rootStyle={{width:"100%",height:"100%",overflow:"hidden"}}>
    <div style={{width:"100%",height:"100%",display:"flex",fontFamily:ff}}>
      <div style={{width:"47%",flexShrink:0,overflow:"hidden",background:T.accent+"18",position:"relative"}}>
        {photo?<img src={photo} alt="" style={getPhotoTransformStyle(activePhotoTransform, "cover")}/>
          :<div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8}}><span style={{fontSize:40,opacity:.25}}>🖼</span>{editMode&&<span style={{fontSize:12,color:T.accent,opacity:.5,fontFamily:ff}}>Фото</span>}</div>}
      </div>
      <div style={{flex:1,background:slideBg,display:"flex",flexDirection:"column",padding:`${h*.055}px ${w*.065}px`,boxSizing:"border-box"}}>
        <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",gap:14}}>
          {slide.tag&&<span style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:T.accent,fontWeight:700,fontFamily:ff}}>{slide.tag}</span>}
          {ET({field:"title", rows:3, style:{fontSize:w*.064,fontWeight:800,lineHeight:1.15,color:T.text}})}
          <div style={{width:32,height:3,background:T.accent,borderRadius:2}}/>
          {ET({field:"body", rows:3, style:{fontSize:w*.028,lineHeight:1.6,color:T.sub}})}
        </div>
        <Footer/>
      </div>
      <IGOverlay/>
    </div>
    </DragWrap>
  );

  // MAGAZINE
  if (layout==="magazine") return (
    <DragWrap rootStyle={{width:"100%",height:"100%",background:slideBg,overflow:"hidden"}}>
    <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",fontFamily:ff}}>
      <div style={{height:"52%",position:"relative",overflow:"hidden",flexShrink:0}}>
        {photo?<img src={photo} alt="" style={getPhotoTransformStyle(activePhotoTransform, "cover")}/>
          :<div style={{width:"100%",height:"100%",background:T.accent+"20",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:48,opacity:.2}}>🖼</span></div>}
        <div style={{position:"absolute",bottom:0,left:0,right:0,height:"55%",background:`linear-gradient(to top,${T.bg} 30%,transparent)`}}/>
      </div>
      <div style={{flex:1,padding:`${h*.015}px ${w*.074}px ${h*.048}px`,display:"flex",flexDirection:"column",justifyContent:"space-between"}}>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {slide.tag&&<div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:T.accent,fontWeight:700,fontFamily:ff}}>{slide.tag}</div>}
          {ET({field:"title", rows:2, style:{fontSize:w*.062,fontWeight:800,lineHeight:1.15,color:T.text}})}
          {ET({field:"body", rows:2, style:{fontSize:w*.028,lineHeight:1.55,color:T.sub}})}
        </div>
        <Footer/>
      </div>
      <IGOverlay/>
    </div>
    </DragWrap>
  );

  // PHOTO
  if (layout==="photo") return (
    <DragWrap rootStyle={{width:"100%",height:"100%",background:slideBg,overflow:"hidden"}}>
    <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",fontFamily:ff}}>
      <div style={{height:"76%",position:"relative",overflow:"hidden",flexShrink:0,background:T.accent+"18"}}>
        {photo
          ? <img src={photo} alt="" style={getPhotoTransformStyle(activePhotoTransform, "cover")}/>
          : <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8}}>
              <span style={{fontSize:48,opacity:.22}}>🖼</span>
              {editMode && <span style={{fontSize:12,color:T.accent,opacity:.6,fontFamily:ff}}>Фото</span>}
            </div>
        }
        <div style={{position:"absolute",left:0,right:0,bottom:0,height:5,background:T.accent,opacity:.85}}/>
      </div>
      <div style={{height:"24%",minHeight:0,padding:`${h*.02}px ${w*.058}px ${h*.022}px`,display:"grid",gridTemplateRows:"1fr auto",gap:8}}>
        <div style={{minHeight:0,overflow:"hidden",display:"flex",alignItems:"center"}}>
          <div style={{width:"100%",maxWidth:"100%"}}>
            {ET({field:"body", rows:5, style:{fontSize:w*.027,fontWeight:500,lineHeight:1.55,color:T.text}})}
          </div>
        </div>
        <Footer/>
      </div>
      <IGOverlay/>
    </div>
    </DragWrap>
  );

  // DOCTOR COVER
  if (layout==="cover_doc_network") return (
    <DragWrap rootStyle={{width:"100%",height:"100%",background:"#ffffff",overflow:"hidden"}}>
      <div style={{width:"100%",height:"100%",position:"relative",fontFamily:ff,background:"#ffffff"}}>
        <div style={{position:"absolute",inset:0,zIndex:1,padding:`${h*.042}px ${w*.08}px ${h*.045}px`,display:"flex",flexDirection:"column",minHeight:0}}>
          <DocHeader />
          <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"space-between",minHeight:0,gap:h*.016}}>
            <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"flex-start",alignItems:"center",textAlign:"center",gap:h*.02,minHeight:0,paddingTop:h*.008}}>
              {slide.tag && <div style={{fontSize:w*.02,fontWeight:800,color:docBlue,textTransform:"uppercase",letterSpacing:0.55,marginBottom:h*.004}}>{slide.tag}</div>}
              {/* Иллюстрация: максимально широкий блок, белый фон — меньше пустых полей по бокам */}
              <div style={{
                display:"flex",
                alignItems:"center",
                justifyContent:"center",
                width:`calc(100% + ${w * 0.12}px)`,
                maxWidth:`${w * 0.98}px`,
                marginLeft:`-${w * 0.06}px`,
                marginRight:`-${w * 0.06}px`,
                flexShrink:0,
              }}>
                <div
                  style={{
                    width:"100%",
                    height:`${h * 0.52 * 1.1}px`,
                    minHeight:`${h * 0.46 * 1.1}px`,
                    borderRadius:20,
                    background:"#ffffff",
                    overflow:"hidden",
                    display:"flex",
                    alignItems:"center",
                    justifyContent:"center",
                    position:"relative",
                  }}
                >
                  {photo ? (
                    <img src={photo} alt="" style={getPhotoTransformStyle(activePhotoTransform, "contain", 1)}/>
                  ) : (
                    <span style={{fontSize:Math.min(52,w*.12),opacity:.28}}>🖼</span>
                  )}
                </div>
              </div>
              <div style={{width:"100%",maxWidth:"92%",padding:`${h*.012}px ${w*.03}px 0`,boxSizing:"border-box"}}>
                <DocCoverTitle />
              </div>
              {slide.body ? (
                <div style={{maxWidth:"88%",marginTop:h*.008,padding:`0 ${w*.02}px`}}>
                  {ET({field:"body", rows:3, style:{fontSize:w*.023,lineHeight:1.5,color:docSub,textAlign:"center",fontWeight:500}})}
                </div>
              ) : null}
            </div>
            {/* Низ: аватар + ФИО + должность */}
            <div style={{
              display:"flex",
              flexDirection:"row",
              alignItems:"center",
              justifyContent:"flex-start",
              gap:w*.028,
              paddingTop:h*.018,
              paddingLeft:w*.04,
              paddingBottom:h*.008,
              flexShrink:0,
            }}>
              <div style={{
                width:w * 0.15 * 1.3 * 0.75,
                height:w * 0.15 * 1.3 * 0.75,
                borderRadius:"50%",
                border:`2.4px solid ${docBlue}`,
                background:"#ffffff",
                overflow:"hidden",
                flexShrink:0,
              }}>
                {avatarPhoto ? (
                  <img src={avatarPhoto} alt="" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"center"}}/>
                ) : (
                  <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,opacity:.35}}>👨‍⚕️</div>
                )}
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-start",justifyContent:"center",gap:3,minWidth:0}}>
                <div style={{fontSize:w*.032,fontWeight:900,color:docInk,letterSpacing:0.35,textTransform:"uppercase",lineHeight:1.15,textAlign:"left"}}>{docDisplayName}</div>
                <div style={{fontSize:w*.019,fontWeight:700,color:docInk,opacity:.88,letterSpacing:0.9,textTransform:"uppercase",lineHeight:1.3,textAlign:"left",maxWidth:`${w*.62}px`}}>{slide.cta || "Врач и автор карусели"}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DragWrap>
  );

  // DOCTOR STORY
  if (layout==="doc_story") return (
    <DragWrap rootStyle={{width:"100%",height:"100%",background:"#ffffff",overflow:"hidden"}}>
      <div style={{width:"100%",height:"100%",padding:`${h*.04}px ${w*.08}px ${h*.055}px`,display:"flex",flexDirection:"column",fontFamily:ff}}>
        <DocHeader />
        <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"space-between",padding:`${h*.03}px 0 ${h*.01}px`}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:10,textAlign:"center"}}>
            {slide.tag && <div style={{fontSize:w*.022,fontWeight:800,color:docBlue,textTransform:"uppercase",letterSpacing:.4}}>{slide.tag}</div>}
            {ET({field:"title", rows:3, style:{fontSize:w*.058,fontWeight:900,lineHeight:1.02,color:docBlue,letterSpacing:-.8,textAlign:"center"}})}
          </div>
          <DocIllustration frameHeight="52%" imageScale={1}/>
          <div style={{display:"flex",justifyContent:"center"}}>
            <div style={{width:"94%"}}>
              {ET({field:"body", rows:5, style:{fontSize:w*.03,fontWeight:800,lineHeight:1.33,color:docInk,textAlign:"center"}})}
            </div>
          </div>
        </div>
      </div>
    </DragWrap>
  );

  // DOCTOR QUOTE
  if (layout==="doc_quote") return (
    <DragWrap rootStyle={{width:"100%",height:"100%",background:"#ffffff",overflow:"hidden"}}>
      <div style={{width:"100%",height:"100%",padding:`${h*.04}px ${w*.08}px ${h*.05}px`,display:"flex",flexDirection:"column",fontFamily:ff}}>
        <DocHeader />
        <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"space-between",padding:`${h*.03}px 0 ${h*.008}px`}}>
          <div style={{display:"flex",justifyContent:"center"}}>
            <div style={{width:"100%",border:`2px solid ${docRed}55`,borderRadius:16,padding:`${h*.018}px ${w*.04}px`,background:"#ffffff",boxShadow:"0 10px 24px rgba(255,95,122,.08)"}}>
              {ET({field:"title", rows:3, style:{fontSize:w*.05,fontWeight:900,lineHeight:1.08,color:docRed,textAlign:"center"}})}
            </div>
          </div>
          <DocIllustration frameHeight="50%" imageScale={1}/>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
            <div style={{width:"92%"}}>
              {ET({field:"body", rows:5, style:{fontSize:w*.029,fontWeight:800,lineHeight:1.34,color:docInk,textAlign:"center"}})}
            </div>
            {slide.cta ? (
              <div style={{fontSize:w*.028,fontWeight:900,lineHeight:1.25,color:docBlue,textAlign:"center"}}>
                {parseText(String(slide.cta), docBlue, hlB, hlT)}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </DragWrap>
  );

  // DOCTOR ENDING
  if (layout==="doc_ending") return (
    <DragWrap rootStyle={{width:"100%",height:"100%",background:"#ffffff",overflow:"hidden"}}>
      <div style={{width:"100%",height:"100%",padding:`${h*.04}px ${w*.08}px ${h*.05}px`,display:"flex",flexDirection:"column",fontFamily:ff}}>
        <DocHeader />
        <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",textAlign:"center",gap:16}}>
          {slide.tag ? <div style={{fontSize:w*.03,fontWeight:900,color:docRed}}>{slide.tag}</div> : null}
          {ET({field:"title", rows:4, style:{fontSize:w*.052,fontWeight:900,lineHeight:1.08,color:docInk,textAlign:"center"}})}
          {slide.body ? (
            <div style={{width:"88%"}}>
              {ET({field:"body", rows:4, style:{fontSize:w*.032,fontWeight:800,lineHeight:1.35,color:docInk,textAlign:"center"}})}
            </div>
          ) : null}
          {slide.cta ? (
            <div style={{marginTop:4,fontSize:w*.038,fontWeight:900,lineHeight:1.15,color:docInk,textAlign:"center"}}>
              {parseText(String(slide.cta), docInk, hlB, hlT)}
            </div>
          ) : null}
        </div>
      </div>
    </DragWrap>
  );

  // BEFORE / AFTER
  if (layout === "before_after") return (
    <DragWrap rootStyle={{width:"100%",height:"100%",overflow:"hidden",position:"relative",fontFamily:ff,background:slideBg}}>
      {/* Split photos */}
      <div style={{position:"absolute",inset:0,display:"flex"}}>
        {/* LEFT — ДО */}
        <div style={{flex:1,position:"relative",overflow:"hidden"}}>
          {beforePhoto
            ? <img src={beforePhoto} alt="До" style={getPhotoTransformStyle(activeBeforePhotoTransform, "cover")}/>
            : <div style={{width:"100%",height:"100%",background:"#b0b0b0",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6}}>
                <span style={{fontSize:30,opacity:.25}}>🖼</span>
                <span style={{fontSize:11,color:"#555",fontFamily:ff}}>Фото ДО</span>
              </div>
          }
          <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(0,0,0,.72) 0%,rgba(0,0,0,.04) 55%,transparent 100%)"}}/>
          <div style={{position:"absolute",bottom:h*.038,left:0,right:0,textAlign:"center"}}>
            <span style={{fontSize:w*.056,fontWeight:900,color:"#ffffff",letterSpacing:5,textTransform:"uppercase",textShadow:"0 2px 14px rgba(0,0,0,.9)",fontFamily:ff}}>ДО</span>
          </div>
        </div>

        {/* Divider */}
        <div style={{width:4,background:"#ffffff",flexShrink:0,zIndex:2,boxShadow:"0 0 18px rgba(0,0,0,.55)"}}/>

        {/* RIGHT — ПОСЛЕ */}
        <div style={{flex:1,position:"relative",overflow:"hidden"}}>
          {photo
            ? <img src={photo} alt="После" style={getPhotoTransformStyle(activePhotoTransform, "cover")}/>
            : <div style={{width:"100%",height:"100%",background:"#d8d8d8",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6}}>
                <span style={{fontSize:30,opacity:.25}}>🖼</span>
                <span style={{fontSize:11,color:"#555",fontFamily:ff}}>Фото ПОСЛЕ</span>
              </div>
          }
          <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(0,0,0,.72) 0%,rgba(0,0,0,.04) 55%,transparent 100%)"}}/>
          <div style={{position:"absolute",bottom:h*.038,left:0,right:0,textAlign:"center"}}>
            <span style={{fontSize:w*.056,fontWeight:900,color:T.accent,letterSpacing:5,textTransform:"uppercase",textShadow:`0 2px 20px ${T.accent}99,0 0 40px ${T.accent}55`,fontFamily:ff}}>ПОСЛЕ</span>
          </div>
        </div>
      </div>

      {/* Top title bar */}
      <div style={{position:"absolute",top:0,left:0,right:0,zIndex:3,background:"linear-gradient(to bottom,rgba(0,0,0,.8) 0%,transparent 100%)",padding:`${h*.032}px ${w*.06}px ${h*.06}px`,textAlign:"center"}}>
        {slide.tag&&<div style={{fontSize:10,letterSpacing:2.5,textTransform:"uppercase",color:T.accent,fontWeight:700,marginBottom:5,fontFamily:ff}}>{slide.tag}</div>}
        {ET({field:"title", rows:1, style:{fontSize:w*.048,fontWeight:800,color:"#ffffff",lineHeight:1.2,textShadow:"0 2px 10px rgba(0,0,0,.7)",textAlign:"center"}})}
      </div>

      {/* Bottom — body + footer */}
      <div style={{position:"absolute",bottom:0,left:0,right:0,zIndex:3,padding:`${h*.17}px ${w*.05}px ${h*.032}px`}}>
        {ET({field:"body", rows:2, style:{fontSize:w*.027,lineHeight:1.55,color:"rgba(255,255,255,.88)",textAlign:"center",marginBottom:8,display:"block"}})}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontSize:12,color:"rgba(255,255,255,.6)",fontFamily:ff}}>{username?`@${username.replace(/^@/,"")}`:" "}</span>
          <Dots/>
          {slide.cta?<span style={{fontSize:12,color:T.accent,fontWeight:700,fontFamily:ff}}>{slide.cta} →</span>:<span style={{visibility:"hidden",fontSize:12}}>x</span>}
        </div>
      </div>
      <IGOverlay/>
    </DragWrap>
  );

  // FULL-BG LAYOUTS (photo or theme bg)
  // NOTE: photo/gradient layers tagged data-photo-layer="true" — excluded from html-to-image
  // and composited manually on canvas to fix WebKit/mobile export bug
  return (
    <div style={{width:"100%",height:"100%",position:"relative",fontFamily:ff}}>
      {photo&&<div data-photo-layer="true" style={{
        position:"absolute",inset:0,zIndex:0,
        backgroundImage:`url(${photo})`,
        backgroundSize:"cover",backgroundPosition:"center",backgroundRepeat:"no-repeat",
      }}/>}
      {photo&&<div data-photo-layer="true" style={{position:"absolute",inset:0,zIndex:1,background:"linear-gradient(160deg,rgba(0,0,0,.35) 0%,rgba(0,0,0,.75) 100%)"}}/>}
      {!photo&&<div style={{position:"absolute",inset:0,background:slideBg,zIndex:0}}/>}

      <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",zIndex:2,pointerEvents:"none"}} viewBox={`0 0 ${w} ${h}`}>
        {layout==="bold_center"&&<><circle cx={w*.9} cy={h*.1} r={w*.13} fill={ac} opacity=".08"/><circle cx={w*.1} cy={h*.9} r={w*.09} fill={ac} opacity=".06"/><rect x="0" y={h-4} width={w} height="4" fill={ac} opacity=".2"/></>}
        {layout==="left_number"&&<><rect x="0" y="0" width="5" height={h} fill={ac} opacity=".7"/><circle cx={w*.92} cy={h*.12} r={w*.07} fill={T.border} opacity=".2"/></>}
        {layout==="editorial"&&<rect x="24" y="24" width={w-48} height={h-48} fill="none" stroke={ac} strokeWidth="1.5" opacity=".2"/>}
        {layout==="quote"&&<><text x="20" y={h*.47} fontSize={w*.44} fontWeight="900" fill={ac} opacity=".07">"</text><rect x="30" y={h*.86} width="90" height="4" fill={ac} opacity=".5"/></>}
        {layout==="bold_number"&&<circle cx={w*.75} cy={h*.5} r={w*.38} fill={ac} opacity=".07"/>}
        {layout==="card_stack"&&<><rect x={w*.07} y={h*.07} width={w*.86} height={h*.86} rx="20" fill={ac} opacity=".04" stroke={ac} strokeWidth="1" strokeOpacity=".15"/><rect x={w*.1} y={h*.1} width={w*.8} height={h*.8} rx="16" fill={ac} opacity=".03"/></>}
        {layout==="diagonal"&&<>
          <polygon points={`0,${h*.28} ${w},${h*.52} ${w},${h*.7} 0,${h*.46}`} fill={ac} opacity=".12"/>
          <polygon points={`0,${h*.34} ${w},${h*.58} ${w},${h*.62} 0,${h*.38}`} fill={ac} opacity=".18"/>
          <circle cx={w*.9} cy={h*.12} r={w*.05} fill={ac} opacity=".15"/>
          <circle cx={w*.08} cy={h*.88} r={w*.04} fill={ac} opacity=".12"/>
          <rect x={w*.06} y={h*.06} width={w*.03} height={h*.12} rx="4" fill={ac} opacity=".12"/>
        </>}
        {layout==="neon_glow"&&<>
          <defs><filter id="neon-blur"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
          <rect x="12" y="12" width={w-24} height={h-24} rx="20" fill="none" stroke={ac} strokeWidth="1.5" opacity=".55" filter="url(#neon-blur)"/>
          <rect x="20" y="20" width={w-40} height={h-40} rx="14" fill="none" stroke={ac} strokeWidth=".6" opacity=".25"/>
          <circle cx={w*.85} cy={h*.15} r={w*.22} fill={ac} opacity=".05"/>
          <circle cx={w*.15} cy={h*.85} r={w*.18} fill={ac} opacity=".04"/>
        </>}
        {layout==="glass_card"&&<>
          <circle cx={w*.78} cy={h*.22} r={w*.4} fill={ac} opacity=".22"/>
          <circle cx={w*.15} cy={h*.8} r={w*.3} fill={T.border} opacity=".2"/>
          <circle cx={w*.9} cy={h*.72} r={w*.18} fill={ac} opacity=".09"/>
        </>}
        {layout==="radial_burst"&&<>
          <circle cx={w*.82} cy={h*.22} r={w*.34} fill={ac} opacity=".08"/>
          <circle cx={w*.82} cy={h*.22} r={w*.24} fill="none" stroke={ac} strokeWidth="2" opacity=".22"/>
          <circle cx={w*.82} cy={h*.22} r={w*.16} fill="none" stroke={ac} strokeWidth="1.5" opacity=".3"/>
          <polygon points={`${w*.08},${h*.86} ${w*.62},${h*.48} ${w*.72},${h*.58} ${w*.18},${h*.94}`} fill={ac} opacity=".16"/>
          <rect x={w*.06} y={h*.08} width={w*.32} height="4" rx="2" fill={ac} opacity=".5"/>
        </>}
        {layout==="spotlight"&&<>
          <defs>
            <radialGradient id="spot-grad" cx="50%" cy="30%" r="60%">
              <stop offset="0%" stopColor={ac} stopOpacity=".34"/>
              <stop offset="60%" stopColor={ac} stopOpacity=".08"/>
              <stop offset="100%" stopColor={ac} stopOpacity="0"/>
            </radialGradient>
          </defs>
          <rect x="0" y="0" width={w} height={h} fill="url(#spot-grad)"/>
          <circle cx={w*.5} cy={h*.27} r={w*.09} fill={ac} opacity=".13"/>
        </>}
        {layout==="timeline_flow"&&<>
          <rect x={w*.12} y={h*.12} width="3" height={h*.76} rx="2" fill={ac} opacity=".45"/>
          <circle cx={w*.121} cy={h*.2} r={w*.014} fill={ac}/>
          <circle cx={w*.121} cy={h*.42} r={w*.014} fill={ac} opacity=".75"/>
          <circle cx={w*.121} cy={h*.64} r={w*.014} fill={ac} opacity=".55"/>
          <circle cx={w*.121} cy={h*.84} r={w*.014} fill={ac} opacity=".4"/>
          <rect x={w*.2} y={h*.75} width={w*.7} height={h*.13} rx="14" fill={ac} opacity=".09"/>
        </>}
        {layout==="hero_statement"&&<>
          <rect x={w*.07} y={h*.12} width={w*.86} height={h*.72} rx="24" fill={ac} opacity=".08"/>
          <circle cx={w*.85} cy={h*.16} r={w*.07} fill={ac} opacity=".2"/>
          <rect x={w*.1} y={h*.84} width={w*.26} height="4" rx="2" fill={ac} opacity=".45"/>
        </>}
        {layout==="split_focus"&&<>
          <rect x={w*.52} y={h*.12} width={w*.36} height={h*.28} rx="18" fill={ac} opacity=".16"/>
          <rect x={w*.52} y={h*.44} width={w*.36} height={h*.28} rx="18" fill={ac} opacity=".09"/>
          <rect x={w*.1} y={h*.55} width={w*.28} height="5" rx="3" fill={ac} opacity=".5"/>
        </>}
        {layout==="story_flow"&&<>
          <path d={`M ${w*.12} ${h*.72} Q ${w*.34} ${h*.48} ${w*.5} ${h*.58} Q ${w*.7} ${h*.7} ${w*.88} ${h*.44}`} fill="none" stroke={ac} strokeWidth="3" strokeOpacity=".35"/>
          <circle cx={w*.12} cy={h*.72} r={w*.012} fill={ac}/>
          <circle cx={w*.5} cy={h*.58} r={w*.012} fill={ac} opacity=".8"/>
          <circle cx={w*.88} cy={h*.44} r={w*.012} fill={ac} opacity=".65"/>
        </>}
        {layout==="cover_clean"&&<>
          <circle cx={w*.86} cy={h*.18} r={w*.12} fill={ac} opacity=".12"/>
          <rect x={w*.08} y={h*.72} width={w*.42} height={h*.012} rx="3" fill={ac} opacity=".55"/>
        </>}
        {layout==="cover_spot"&&<>
          <defs>
            <radialGradient id="cover-spot-grad" cx="50%" cy="28%" r="65%">
              <stop offset="0%" stopColor={ac} stopOpacity=".28"/>
              <stop offset="60%" stopColor={ac} stopOpacity=".08"/>
              <stop offset="100%" stopColor={ac} stopOpacity="0"/>
            </radialGradient>
          </defs>
          <rect x="0" y="0" width={w} height={h} fill="url(#cover-spot-grad)"/>
          <rect x={w*.12} y={h*.72} width={w*.26} height="4" rx="2" fill={ac} opacity=".52"/>
        </>}
        {layout==="cover_split"&&<>
          <polygon points={`0,${h*.3} ${w},${h*.16} ${w},${h*.32} 0,${h*.46}`} fill={ac} opacity=".11"/>
          <polygon points={`0,${h*.86} ${w*.65},${h*.62} ${w*.72},${h*.72} ${w*.08},${h*.96}`} fill={ac} opacity=".16"/>
        </>}
        {layout==="cover_editorial"&&<>
          <rect x={w*.08} y={h*.1} width={w*.84} height={h*.78} fill="none" stroke={ac} strokeWidth="1.5" opacity=".2"/>
          <rect x={w*.12} y={h*.74} width={w*.2} height="3" rx="2" fill={ac} opacity=".55"/>
        </>}
        {layout==="cover_ribbon"&&<>
          <rect x={w*.08} y={h*.14} width={w*.84} height={h*.12} rx="14" fill={ac} opacity=".2"/>
          <rect x={w*.08} y={h*.74} width={w*.56} height={h*.11} rx="12" fill={ac} opacity=".14"/>
          <circle cx={w*.86} cy={h*.2} r={w*.04} fill={ac} opacity=".28"/>
        </>}
        {layout==="cover_glow"&&<>
          <defs>
            <radialGradient id="cover-glow-grad" cx="80%" cy="20%" r="75%">
              <stop offset="0%" stopColor={ac} stopOpacity=".32"/>
              <stop offset="55%" stopColor={ac} stopOpacity=".09"/>
              <stop offset="100%" stopColor={ac} stopOpacity="0"/>
            </radialGradient>
          </defs>
          <rect x="0" y="0" width={w} height={h} fill="url(#cover-glow-grad)"/>
          <rect x={w*.1} y={h*.75} width={w*.24} height="4" rx="2" fill={ac} opacity=".58"/>
        </>}
        {layout==="cover_wave"&&<>
          <path d={`M 0 ${h*.78} Q ${w*.22} ${h*.66} ${w*.46} ${h*.74} Q ${w*.7} ${h*.82} ${w} ${h*.64} L ${w} ${h} L 0 ${h} Z`} fill={ac} opacity=".14"/>
          <path d={`M 0 ${h*.86} Q ${w*.3} ${h*.75} ${w*.58} ${h*.85} Q ${w*.82} ${h*.93} ${w} ${h*.8} L ${w} ${h} L 0 ${h} Z`} fill={ac} opacity=".1"/>
        </>}
        {layout==="cover_orbit"&&<>
          <circle cx={w*.78} cy={h*.24} r={w*.2} fill="none" stroke={ac} strokeWidth="2.2" opacity=".26"/>
          <circle cx={w*.78} cy={h*.24} r={w*.14} fill="none" stroke={ac} strokeWidth="1.6" opacity=".2"/>
          <circle cx={w*.9} cy={h*.2} r={w*.02} fill={ac} opacity=".7"/>
          <rect x={w*.1} y={h*.76} width={w*.24} height="4" rx="2" fill={ac} opacity=".56"/>
        </>}
        {layout==="cover_prism"&&<>
          <polygon points={`${w*.04},${h*.88} ${w*.5},${h*.44} ${w*.62},${h*.58} ${w*.16},${h*.98}`} fill={ac} opacity=".18"/>
          <polygon points={`${w*.34},${h*.16} ${w*.94},${h*.22} ${w*.82},${h*.38}`} fill={ac} opacity=".12"/>
          <polygon points={`${w*.58},${h*.52} ${w*.96},${h*.64} ${w*.78},${h*.88}`} fill={ac} opacity=".1"/>
        </>}
        {layout==="cover_halo"&&<>
          <defs>
            <radialGradient id="cover-halo-grad" cx="50%" cy="24%" r="72%">
              <stop offset="0%" stopColor={ac} stopOpacity=".34"/>
              <stop offset="58%" stopColor={ac} stopOpacity=".12"/>
              <stop offset="100%" stopColor={ac} stopOpacity="0"/>
            </radialGradient>
          </defs>
          <rect x="0" y="0" width={w} height={h} fill="url(#cover-halo-grad)"/>
          <circle cx={w*.5} cy={h*.24} r={w*.24} fill="none" stroke={ac} strokeWidth="2" opacity=".22"/>
        </>}
        {layout==="cover_streak"&&<>
          <rect x={w*.06} y={h*.2} width={w*.88} height={h*.06} rx="10" fill={ac} opacity=".18" transform={`rotate(-8 ${w*.5} ${h*.23})`}/>
          <rect x={w*.02} y={h*.78} width={w*.74} height={h*.05} rx="10" fill={ac} opacity=".14" transform={`rotate(-10 ${w*.4} ${h*.8})`}/>
          <rect x={w*.08} y={h*.72} width={w*.22} height="4" rx="2" fill={ac} opacity=".58"/>
        </>}
        {layout==="cover_luxe"&&<>
          <rect x={w*.08} y={h*.1} width={w*.84} height={h*.8} rx="24" fill="none" stroke={ac} strokeWidth="1.4" opacity=".26"/>
          <circle cx={w*.18} cy={h*.16} r={w*.018} fill={ac} opacity=".65"/>
          <circle cx={w*.82} cy={h*.16} r={w*.018} fill={ac} opacity=".65"/>
          <circle cx={w*.18} cy={h*.84} r={w*.018} fill={ac} opacity=".65"/>
          <circle cx={w*.82} cy={h*.84} r={w*.018} fill={ac} opacity=".65"/>
        </>}
        {layout==="checklist"&&<>
          <rect x="0" y="0" width={w*.008} height={h} fill={ac} opacity=".6"/>
          <circle cx={w*.9} cy={h*.12} r={w*.07} fill={ac} opacity=".08"/>
        </>}
        {layout==="big_quote_mark"&&<>
          <text x={w*.05} y={h*.55} fontSize={w*.65} fontWeight="900" fill={ac} opacity=".14">"</text>
          <text x={w*.7} y={h*.95} fontSize={w*.65} fontWeight="900" fill={ac} opacity=".1">"</text>
        </>}
        {layout==="polaroid"&&<>
          <defs><filter id="polaroid-shadow"><feDropShadow dx="0" dy="10" stdDeviation="12" floodOpacity=".35"/></filter></defs>
          <rect x={w*.14} y={h*.1} width={w*.72} height={h*.8} rx="4" fill="#ffffff" opacity=".95" transform={`rotate(-3 ${w*.5} ${h*.5})`} filter="url(#polaroid-shadow)"/>
        </>}
        {layout==="ticket_stub"&&<>
          <rect x={w*.06} y={h*.14} width={w*.88} height={h*.72} rx="10" fill={ac} opacity=".08" stroke={ac} strokeWidth="1.5" strokeOpacity=".35" strokeDasharray="6 4"/>
          <circle cx={w*.06} cy={h*.5} r={w*.03} fill={T.bg||"#000"}/>
          <circle cx={w*.94} cy={h*.5} r={w*.03} fill={T.bg||"#000"}/>
          <line x1={w*.3} y1={h*.18} x2={w*.3} y2={h*.82} stroke={ac} strokeOpacity=".3" strokeDasharray="3 3"/>
        </>}
        {layout==="notebook_page"&&<>
          {Array.from({length:12}).map((_,i)=><rect key={i} x={w*.1} y={h*.15+i*h*.06} width={w*.82} height="1" fill={ac} opacity=".18"/>)}
          <rect x={w*.16} y={h*.1} width="2" height={h*.8} fill="#ef4444" opacity=".4"/>
          <circle cx={w*.08} cy={h*.22} r={w*.012} fill={ac} opacity=".3"/>
          <circle cx={w*.08} cy={h*.4} r={w*.012} fill={ac} opacity=".3"/>
          <circle cx={w*.08} cy={h*.58} r={w*.012} fill={ac} opacity=".3"/>
          <circle cx={w*.08} cy={h*.76} r={w*.012} fill={ac} opacity=".3"/>
        </>}
        {layout==="receipt"&&<>
          <rect x={w*.14} y={h*.08} width={w*.72} height={h*.84} fill="#ffffff" opacity=".94"/>
        </>}
        {layout==="terminal_code"&&<>
          <rect x={w*.05} y={h*.1} width={w*.9} height={h*.8} rx="12" fill="#0d1117" opacity=".96"/>
          <rect x={w*.05} y={h*.1} width={w*.9} height={h*.06} rx="12" fill="#161b22"/>
          <circle cx={w*.09} cy={h*.13} r="5" fill="#ff5f56"/>
          <circle cx={w*.115} cy={h*.13} r="5" fill="#ffbd2e"/>
          <circle cx={w*.14} cy={h*.13} r="5" fill="#27c93f"/>
        </>}
        {layout==="cta_save"&&<>
          <rect x={w*.06} y={h*.1} width={w*.88} height={h*.8} rx="20" fill={ac} opacity=".06" stroke={ac} strokeWidth="1.5" strokeOpacity=".25"/>
        </>}
        {layout==="cover_magazine"&&<>
          <rect x={w*.06} y={h*.08} width={w*.88} height="3" fill={ac}/>
          <rect x={w*.06} y={h-h*.08-3} width={w*.88} height="3" fill={ac}/>
          <rect x={w*.06} y={h*.18} width={w*.3} height="1" fill={ac} opacity=".4"/>
          <rect x={w*.06} y={h*.82} width={w*.5} height="1" fill={ac} opacity=".4"/>
        </>}
        {layout==="cover_torn"&&<>
          <path d={`M 0 ${h*.6} L ${w*.08} ${h*.58} L ${w*.14} ${h*.62} L ${w*.22} ${h*.57} L ${w*.3} ${h*.61} L ${w*.38} ${h*.56} L ${w*.48} ${h*.62} L ${w*.56} ${h*.58} L ${w*.66} ${h*.63} L ${w*.74} ${h*.57} L ${w*.82} ${h*.62} L ${w*.9} ${h*.58} L ${w} ${h*.6} L ${w} ${h} L 0 ${h} Z`} fill={ac} opacity=".12"/>
          <path d={`M 0 ${h*.64} L ${w*.1} ${h*.62} L ${w*.2} ${h*.66} L ${w*.32} ${h*.61} L ${w*.44} ${h*.66} L ${w*.56} ${h*.62} L ${w*.68} ${h*.66} L ${w*.8} ${h*.62} L ${w} ${h*.64} L ${w} ${h} L 0 ${h} Z`} fill={ac} opacity=".2"/>
        </>}
        {layout==="cover_sticker"&&<>
          <circle cx={w*.82} cy={h*.22} r={w*.13} fill={ac} opacity=".9" transform={`rotate(-15 ${w*.82} ${h*.22})`}/>
          <circle cx={w*.82} cy={h*.22} r={w*.105} fill="none" stroke="#ffffff" strokeWidth="2" strokeOpacity=".6" strokeDasharray="4 3"/>
          <rect x={w*.08} y={h*.78} width={w*.32} height="4" rx="2" fill={ac} opacity=".6"/>
        </>}
        {layout==="cover_film"&&<>
          <rect x="0" y="0" width={w} height={h*.08} fill="#0a0a0a" opacity=".9"/>
          <rect x="0" y={h-h*.08} width={w} height={h*.08} fill="#0a0a0a" opacity=".9"/>
          {Array.from({length:8}).map((_,i)=><rect key={`ft-${i}`} x={w*.05+i*w*.12} y={h*.02} width={w*.07} height={h*.04} rx="2" fill="#2a2a2a"/>)}
          {Array.from({length:8}).map((_,i)=><rect key={`fb-${i}`} x={w*.05+i*w*.12} y={h-h*.06} width={w*.07} height={h*.04} rx="2" fill="#2a2a2a"/>)}
        </>}
        {layout==="cover_minimal_type"&&<>
          <rect x={w*.06} y={h*.06} width={w*.88} height="1" fill={ac} opacity=".3"/>
          <rect x={w*.06} y={h*.94} width={w*.88} height="1" fill={ac} opacity=".3"/>
        </>}
        {layout==="cover_grid_lines"&&<>
          {Array.from({length:9}).map((_,i)=><rect key={`gv-${i}`} x={w*(i+1)/10} y="0" width=".5" height={h} fill={ac} opacity=".15"/>)}
          {Array.from({length:9}).map((_,i)=><rect key={`gh-${i}`} x="0" y={h*(i+1)/10} width={w} height=".5" fill={ac} opacity=".15"/>)}
          <rect x={w*.08} y={h*.08} width={w*.06} height="2" fill={ac} opacity=".7"/>
          <rect x={w*.08} y={h*.08} width="2" height={h*.06} fill={ac} opacity=".7"/>
          <text x={w*.08} y={h*.955} fontSize="9" fill={ac} opacity=".5" fontFamily="monospace">X: 00.00 / Y: 00.00</text>
        </>}
      </svg>

      <div style={{position:"absolute",inset:0,zIndex:3,display:"flex",flexDirection:"column",padding:ph,boxSizing:"border-box"}}>
        {layout==="bold_center"&&<>
          <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",gap:16,textAlign:"center"}}>
            {slide.tag&&<span style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:ac,fontWeight:700}}>{slide.tag}</span>}
            {ET({field:"title", rows:2, style:{fontSize:w*.076,fontWeight:800,lineHeight:1.1,letterSpacing:-.5,color:tc,textAlign:"center"}})}
            <div style={{width:40,height:3,background:ac,borderRadius:2}}/>
            {ET({field:"body", rows:3, style:{fontSize:w*.031,lineHeight:1.65,color:sc,textAlign:"center"}})}
          </div><Footer/>
        </>}
        {layout==="left_number"&&<>
          <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",gap:14}}>
            <div style={{fontSize:w*.22,fontWeight:900,lineHeight:.85,color:ac,opacity:.18,letterSpacing:-6,userSelect:"none"}}>{String(slideSeq).padStart(2,"0")}</div>
            {slide.tag&&<span style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:ac,fontWeight:700}}>{slide.tag}</span>}
            {ET({field:"title", rows:2, style:{fontSize:w*.066,fontWeight:800,lineHeight:1.15,color:tc}})}
            {ET({field:"body", rows:3, style:{fontSize:w*.031,lineHeight:1.65,color:sc}})}
          </div><Footer/>
        </>}
        {layout==="editorial"&&<>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:h*.04}}>
            {slide.tag&&<span style={{fontSize:10,letterSpacing:3,textTransform:"uppercase",color:ac}}>{slide.tag}</span>}
            <span style={{fontSize:10,letterSpacing:2,color:sc,marginLeft:"auto"}}>{String(slideSeq).padStart(2,"0")}/{String(total).padStart(2,"0")}</span>
          </div>
          <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",gap:16}}>
            {ET({field:"title", rows:2, style:{fontSize:w*.066,fontWeight:800,lineHeight:1.15,color:tc}})}
            <div style={{width:40,height:2,background:ac}}/>
            {ET({field:"body", rows:3, style:{fontSize:w*.031,lineHeight:1.65,color:sc}})}
          </div>
          <div style={{borderTop:`1px solid rgba(255,255,255,.15)`,paddingTop:12}}><Footer/></div>
        </>}
        {layout==="quote"&&<>
          <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",gap:16}}>
            <div style={{fontSize:w*.17,fontWeight:900,color:ac,lineHeight:.6,opacity:.5,userSelect:"none"}}>"</div>
            {ET({field:"title", rows:2, style:{fontSize:w*.059,fontWeight:700,lineHeight:1.2,color:tc}})}
            {ET({field:"body", rows:3, style:{fontSize:w*.031,fontStyle:"italic",lineHeight:1.7,color:sc}})}
            {slide.tag&&<div style={{fontSize:13,color:ac,fontWeight:600}}>— {slide.tag}</div>}
          </div><Footer/>
        </>}
        {layout==="bold_number"&&<>
          <div style={{position:"absolute",right:w*.04,top:"50%",transform:"translateY(-50%)",fontSize:w*.54,fontWeight:900,color:ac,opacity:.08,userSelect:"none",lineHeight:1}}>{String(slideSeq).padStart(2,"0")}</div>
          <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",gap:16,position:"relative"}}>
            {slide.tag&&<span style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:ac,fontWeight:700}}>{slide.tag}</span>}
            {ET({field:"title", rows:2, style:{fontSize:w*.072,fontWeight:900,lineHeight:1.05,letterSpacing:-1,color:tc}})}
            {ET({field:"body", rows:3, style:{fontSize:w*.031,lineHeight:1.65,color:sc}})}
          </div><Footer/>
        </>}
        {layout==="card_stack"&&<>
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{background:isPhotoFullBg?"rgba(0,0,0,.4)":"rgba(255,255,255,.06)",borderRadius:16,padding:`${h*.06}px ${w*.07}px`,maxWidth:"85%",backdropFilter:"blur(8px)",border:`1px solid ${isPhotoFullBg?"rgba(255,255,255,.12)":"rgba(255,255,255,.08)"}`,display:"flex",flexDirection:"column",gap:12,textAlign:"center",alignItems:"center"}}>
              {slide.tag&&<span style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:ac,fontWeight:700}}>{slide.tag}</span>}
              {ET({field:"title", rows:2, style:{fontSize:w*.062,fontWeight:800,lineHeight:1.15,color:tc,textAlign:"center"}})}
              <div style={{width:30,height:2,background:ac,borderRadius:1}}/>
              {ET({field:"body", rows:3, style:{fontSize:w*.029,lineHeight:1.7,color:sc,textAlign:"center"}})}
            </div>
          </div><Footer/>
        </>}
        {layout==="diagonal"&&<>
          <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"flex-end",gap:14,paddingBottom:h*.08}}>
            {slide.tag&&<span style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:ac,fontWeight:700}}>{slide.tag}</span>}
            {ET({field:"title", rows:2, style:{fontSize:w*.072,fontWeight:900,lineHeight:1.08,color:tc,letterSpacing:-.5}})}
            <div style={{width:50,height:3,background:ac,borderRadius:2}}/>
            {ET({field:"body", rows:3, style:{fontSize:w*.03,lineHeight:1.65,color:sc}})}
          </div><Footer/>
        </>}

        {layout==="neon_glow"&&<>
          <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",gap:18,textAlign:"center"}}>
            {slide.tag&&<span style={{fontSize:10,letterSpacing:3,textTransform:"uppercase",color:ac,fontWeight:700,border:`1px solid ${ac}55`,padding:"3px 16px",borderRadius:100}}>{slide.tag}</span>}
            {ET({field:"title", rows:2, style:{fontSize:w*.075,fontWeight:900,lineHeight:1.08,letterSpacing:-.5,color:tc,textAlign:"center",textShadow:`0 0 60px ${ac}88,0 0 120px ${ac}44`}})}
            <div style={{width:56,height:2,background:ac,borderRadius:1,boxShadow:`0 0 14px ${ac},0 0 28px ${ac}88`}}/>
            {ET({field:"body", rows:3, style:{fontSize:w*.031,lineHeight:1.7,color:sc,textAlign:"center"}})}
          </div>
          <div style={{background:`${ac}0d`,borderRadius:10,border:`1px solid ${ac}28`,padding:`${h*.014}px ${w*.04}px`}}>
            <Footer/>
          </div>
        </>}

        {layout==="glass_card"&&<>
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{
              background:"rgba(255,255,255,0.09)",
              backdropFilter:"blur(24px)", WebkitBackdropFilter:"blur(24px)",
              border:"1px solid rgba(255,255,255,0.22)",
              borderRadius:24, padding:`${h*.065}px ${w*.07}px`,
              width:"84%", display:"flex", flexDirection:"column",
              gap:13, textAlign:"center", alignItems:"center",
              boxShadow:`0 8px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.18)`,
            }}>
              {slide.tag&&<span style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:ac,fontWeight:700}}>{slide.tag}</span>}
              {ET({field:"title", rows:2, style:{fontSize:w*.064,fontWeight:800,lineHeight:1.15,color:tc,textAlign:"center"}})}
              <div style={{width:32,height:2,background:ac,borderRadius:1}}/>
              {ET({field:"body", rows:3, style:{fontSize:w*.029,lineHeight:1.7,color:sc,textAlign:"center"}})}
            </div>
          </div><Footer/>
        </>}
        {layout==="radial_burst"&&<>
          <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",gap:14}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              {slide.tag&&<span style={{
                fontSize:10,letterSpacing:2.5,textTransform:"uppercase",color:ac,fontWeight:700,
                border:`1px solid ${ac}66`,padding:"3px 10px",borderRadius:999
              }}>{slide.tag}</span>}
              <span style={{fontSize:11,color:sc,opacity:.9}}>Слайд {slideSeq}</span>
            </div>
            {ET({field:"title", rows:2, style:{
              fontSize:w*.078,fontWeight:900,lineHeight:1.04,color:tc,letterSpacing:-.8,
              textShadow:isPhotoFullBg?`0 6px 26px rgba(0,0,0,.45)`:"none"
            }})}
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:58,height:4,background:ac,borderRadius:4,boxShadow:`0 0 24px ${ac}55`}}/>
              <div style={{flex:1,height:2,background:`linear-gradient(90deg,${ac}66,transparent)`}}/>
            </div>
            {ET({field:"body", rows:3, style:{fontSize:w*.031,lineHeight:1.65,color:sc,maxWidth:"88%"}})}
          </div>
          <div style={{
            background:isPhotoFullBg?"rgba(0,0,0,.26)":"rgba(255,255,255,.05)",
            border:`1px solid ${isPhotoFullBg?"rgba(255,255,255,.16)":"rgba(255,255,255,.1)"}`,
            borderRadius:14,padding:`${h*.014}px ${w*.03}px`
          }}>
            <Footer/>
          </div>
        </>}
        {layout==="spotlight"&&<>
          <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",gap:14,textAlign:"center"}}>
            {slide.tag&&<span style={{fontSize:10,letterSpacing:3,textTransform:"uppercase",color:ac,fontWeight:700}}>{slide.tag}</span>}
            {ET({field:"title", rows:2, style:{fontSize:w*.074,fontWeight:900,lineHeight:1.05,color:tc,letterSpacing:-.8,textAlign:"center"}})}
            <div style={{width:64,height:4,background:ac,borderRadius:4}}/>
            <div style={{maxWidth:"82%"}}>
              {ET({field:"body", rows:3, style:{fontSize:w*.031,lineHeight:1.67,color:sc,textAlign:"center"}})}
            </div>
          </div>
          <Footer/>
        </>}
        {layout==="timeline_flow"&&<>
          <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",gap:12,paddingLeft:w*.2}}>
            {slide.tag&&<span style={{fontSize:10,letterSpacing:2.2,textTransform:"uppercase",color:ac,fontWeight:700}}>{slide.tag}</span>}
            {ET({field:"title", rows:2, style:{fontSize:w*.066,fontWeight:850,lineHeight:1.12,color:tc}})}
            <div style={{width:52,height:3,background:ac,borderRadius:2}}/>
            {ET({field:"body", rows:3, style:{fontSize:w*.03,lineHeight:1.65,color:sc,maxWidth:"90%"}})}
          </div>
          <Footer/>
        </>}
        {layout==="hero_statement"&&<>
          <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",gap:16}}>
            {slide.tag&&<span style={{fontSize:10,letterSpacing:TEMPLATE_TOKENS.tagLetterSpacing,textTransform:"uppercase",color:ac,fontWeight:700}}>{slide.tag}</span>}
            {ET({field:"title", rows:2, style:{fontSize:w*.082,fontWeight:900,lineHeight:1.04,color:tc,letterSpacing:TEMPLATE_TOKENS.titleTracking}})}
            <div style={{maxWidth:contentMaxWidth}}>
              {ET({field:"body", rows:3, style:{fontSize:w*.031,lineHeight:TEMPLATE_TOKENS.bodyLineHeight,color:sc}})}
            </div>
          </div>
          <Footer/>
        </>}
        {layout==="split_focus"&&<>
          <div style={{flex:1,display:"grid",gridTemplateColumns:"1fr .92fr",gap:w*.05,alignItems:"center"}}>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {slide.tag&&<span style={{fontSize:10,letterSpacing:TEMPLATE_TOKENS.tagLetterSpacing,textTransform:"uppercase",color:ac,fontWeight:700}}>{slide.tag}</span>}
              {ET({field:"title", rows:2, style:{fontSize:w*.067,fontWeight:850,lineHeight:1.1,color:tc}})}
            </div>
            <div style={{background:softPanel,borderRadius:16,padding:`${h*.03}px ${w*.04}px`}}>
              {ET({field:"body", rows:3, style:{fontSize:w*.029,lineHeight:TEMPLATE_TOKENS.bodyLineHeight,color:sc}})}
            </div>
          </div>
          <Footer/>
        </>}
        {layout==="story_flow"&&<>
          <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",gap:14}}>
            {slide.tag&&<span style={{fontSize:10,letterSpacing:TEMPLATE_TOKENS.tagLetterSpacing,textTransform:"uppercase",color:ac,fontWeight:700}}>{slide.tag}</span>}
            {ET({field:"title", rows:2, style:{fontSize:w*.069,fontWeight:850,lineHeight:1.08,color:tc}})}
            <div style={{width:60,height:3,background:ac,borderRadius:2}}/>
            <div style={{maxWidth:contentMaxWidth}}>
              {ET({field:"body", rows:3, style:{fontSize:w*.03,lineHeight:1.7,color:sc}})}
            </div>
          </div>
          <Footer/>
        </>}
        {layout==="cover_clean"&&<>
          <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",gap:16}}>
            {slide.tag&&<span style={{fontSize:10,letterSpacing:TEMPLATE_TOKENS.tagLetterSpacing,textTransform:"uppercase",color:ac,fontWeight:700}}>{slide.tag}</span>}
            {ET({field:"title", rows:2, style:{fontSize:w*.082,fontWeight:900,lineHeight:1.04,color:tc,letterSpacing:-.8}})}
            <div style={{maxWidth:contentMaxWidth}}>
              {ET({field:"body", rows:3, style:{fontSize:w*.031,lineHeight:1.67,color:sc}})}
            </div>
          </div>
          <Footer/>
        </>}
        {layout==="cover_spot"&&<>
          <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",gap:14,textAlign:"center"}}>
            {slide.tag&&<span style={{fontSize:10,letterSpacing:TEMPLATE_TOKENS.tagLetterSpacing,textTransform:"uppercase",color:ac,fontWeight:700}}>{slide.tag}</span>}
            {ET({field:"title", rows:2, style:{fontSize:w*.078,fontWeight:900,lineHeight:1.05,color:tc,letterSpacing:-.8,textAlign:"center"}})}
            <div style={{maxWidth:"86%"}}>
              {ET({field:"body", rows:3, style:{fontSize:w*.03,lineHeight:1.66,color:sc,textAlign:"center"}})}
            </div>
          </div>
          <Footer/>
        </>}
        {layout==="cover_split"&&<>
          <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",gap:14}}>
            {slide.tag&&<span style={{fontSize:10,letterSpacing:TEMPLATE_TOKENS.tagLetterSpacing,textTransform:"uppercase",color:ac,fontWeight:700}}>{slide.tag}</span>}
            {ET({field:"title", rows:2, style:{fontSize:w*.074,fontWeight:850,lineHeight:1.08,color:tc}})}
            <div style={{width:58,height:3,background:ac,borderRadius:2}}/>
            <div style={{maxWidth:"88%"}}>
              {ET({field:"body", rows:3, style:{fontSize:w*.03,lineHeight:1.66,color:sc}})}
            </div>
          </div>
          <Footer/>
        </>}
        {layout==="cover_editorial"&&<>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:h*.04}}>
            {slide.tag&&<span style={{fontSize:10,letterSpacing:3,textTransform:"uppercase",color:ac}}>{slide.tag}</span>}
            <span style={{fontSize:10,letterSpacing:2,color:sc,marginLeft:"auto"}}>{String(total).padStart(2,"0")} слайдов</span>
          </div>
          <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",gap:16}}>
            {ET({field:"title", rows:2, style:{fontSize:w*.068,fontWeight:850,lineHeight:1.12,color:tc}})}
            <div style={{width:40,height:2,background:ac}}/>
            {ET({field:"body", rows:3, style:{fontSize:w*.03,lineHeight:1.65,color:sc}})}
          </div>
          <div style={{borderTop:`1px solid rgba(255,255,255,.15)`,paddingTop:12}}><Footer/></div>
        </>}
        {layout==="cover_ribbon"&&<>
          <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",gap:14}}>
            {slide.tag&&<span style={{fontSize:10,letterSpacing:TEMPLATE_TOKENS.tagLetterSpacing,textTransform:"uppercase",color:ac,fontWeight:700}}>{slide.tag}</span>}
            {ET({field:"title", rows:2, style:{fontSize:w*.078,fontWeight:900,lineHeight:1.04,color:tc}})}
            <div style={{maxWidth:"86%"}}>
              {ET({field:"body", rows:3, style:{fontSize:w*.03,lineHeight:1.66,color:sc}})}
            </div>
          </div>
          <Footer/>
        </>}
        {layout==="cover_glow"&&<>
          <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",gap:14,textAlign:"center"}}>
            {slide.tag&&<span style={{fontSize:10,letterSpacing:TEMPLATE_TOKENS.tagLetterSpacing,textTransform:"uppercase",color:ac,fontWeight:700}}>{slide.tag}</span>}
            {ET({field:"title", rows:2, style:{fontSize:w*.08,fontWeight:900,lineHeight:1.03,color:tc,textAlign:"center",textShadow:`0 0 40px ${ac}55`}})}
            <div style={{maxWidth:"84%"}}>
              {ET({field:"body", rows:3, style:{fontSize:w*.03,lineHeight:1.65,color:sc,textAlign:"center"}})}
            </div>
          </div>
          <Footer/>
        </>}
        {layout==="cover_wave"&&<>
          <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",gap:14}}>
            {slide.tag&&<span style={{fontSize:10,letterSpacing:TEMPLATE_TOKENS.tagLetterSpacing,textTransform:"uppercase",color:ac,fontWeight:700}}>{slide.tag}</span>}
            {ET({field:"title", rows:2, style:{fontSize:w*.076,fontWeight:900,lineHeight:1.05,color:tc}})}
            <div style={{maxWidth:"88%"}}>
              {ET({field:"body", rows:3, style:{fontSize:w*.03,lineHeight:1.66,color:sc}})}
            </div>
          </div>
          <Footer/>
        </>}
        {layout==="cover_orbit"&&<>
          <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",gap:14}}>
            {slide.tag&&<span style={{fontSize:10,letterSpacing:TEMPLATE_TOKENS.tagLetterSpacing,textTransform:"uppercase",color:ac,fontWeight:700}}>{slide.tag}</span>}
            {ET({field:"title", rows:2, style:{fontSize:w*.078,fontWeight:900,lineHeight:1.04,color:tc,letterSpacing:-.7}})}
            <div style={{maxWidth:"85%"}}>
              {ET({field:"body", rows:3, style:{fontSize:w*.03,lineHeight:1.66,color:sc}})}
            </div>
          </div>
          <Footer/>
        </>}
        {layout==="cover_prism"&&<>
          <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",gap:14}}>
            {slide.tag&&<span style={{fontSize:10,letterSpacing:TEMPLATE_TOKENS.tagLetterSpacing,textTransform:"uppercase",color:ac,fontWeight:700}}>{slide.tag}</span>}
            {ET({field:"title", rows:2, style:{fontSize:w*.079,fontWeight:900,lineHeight:1.03,color:tc}})}
            <div style={{maxWidth:"88%"}}>
              {ET({field:"body", rows:3, style:{fontSize:w*.03,lineHeight:1.66,color:sc}})}
            </div>
          </div>
          <Footer/>
        </>}
        {layout==="cover_halo"&&<>
          <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",gap:14,textAlign:"center"}}>
            {slide.tag&&<span style={{fontSize:10,letterSpacing:TEMPLATE_TOKENS.tagLetterSpacing,textTransform:"uppercase",color:ac,fontWeight:700}}>{slide.tag}</span>}
            {ET({field:"title", rows:2, style:{fontSize:w*.08,fontWeight:900,lineHeight:1.03,color:tc,textAlign:"center",textShadow:`0 0 36px ${ac}44`}})}
            <div style={{maxWidth:"84%"}}>
              {ET({field:"body", rows:3, style:{fontSize:w*.03,lineHeight:1.65,color:sc,textAlign:"center"}})}
            </div>
          </div>
          <Footer/>
        </>}
        {layout==="cover_streak"&&<>
          <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",gap:14}}>
            {slide.tag&&<span style={{fontSize:10,letterSpacing:TEMPLATE_TOKENS.tagLetterSpacing,textTransform:"uppercase",color:ac,fontWeight:700}}>{slide.tag}</span>}
            {ET({field:"title", rows:2, style:{fontSize:w*.078,fontWeight:900,lineHeight:1.03,color:tc}})}
            <div style={{maxWidth:"86%"}}>
              {ET({field:"body", rows:3, style:{fontSize:w*.03,lineHeight:1.66,color:sc}})}
            </div>
          </div>
          <Footer/>
        </>}
        {layout==="cover_luxe"&&<>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:h*.035}}>
            {slide.tag&&<span style={{fontSize:10,letterSpacing:3,textTransform:"uppercase",color:ac,fontWeight:700}}>{slide.tag}</span>}
            <span style={{fontSize:10,letterSpacing:2,color:sc,marginLeft:"auto"}}>{String(total).padStart(2,"0")} слайдов</span>
          </div>
          <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",gap:16}}>
            {ET({field:"title", rows:2, style:{fontSize:w*.074,fontWeight:900,lineHeight:1.05,color:tc}})}
            <div style={{width:46,height:2,background:ac}}/>
            {ET({field:"body", rows:3, style:{fontSize:w*.03,lineHeight:1.65,color:sc}})}
          </div>
          <div style={{borderTop:`1px solid rgba(255,255,255,.15)`,paddingTop:12}}><Footer/></div>
        </>}

        {layout==="checklist"&&(()=>{
          const bodyStr=String(slide.body||"");
          const lines=bodyStr.split(/\n+/).map((s:string)=>s.trim()).filter(Boolean);
          const isList=lines.length>=2;
          return <>
            <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",gap:14,paddingLeft:w*.02}}>
              {slide.tag&&<span style={{fontSize:10,letterSpacing:TEMPLATE_TOKENS.tagLetterSpacing,textTransform:"uppercase",color:ac,fontWeight:700}}>{slide.tag}</span>}
              {ET({field:"title", rows:2, style:{fontSize:w*.062,fontWeight:850,lineHeight:1.12,color:tc}})}
              {isList?(
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {lines.slice(0,5).map((line:string,i:number)=>(
                    <div key={i} style={{display:"flex",alignItems:"flex-start",gap:10}}>
                      <div style={{width:w*.04,height:w*.04,borderRadius:"50%",background:ac,color:hlT,display:"flex",alignItems:"center",justifyContent:"center",fontSize:w*.024,fontWeight:900,flexShrink:0,marginTop:2}}>✓</div>
                      <div style={{fontSize:w*.029,lineHeight:1.5,color:sc,flex:1,wordBreak:"break-word"}}>{line}</div>
                    </div>
                  ))}
                </div>
              ):(
                <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                  <div style={{width:w*.04,height:w*.04,borderRadius:"50%",background:ac,color:hlT,display:"flex",alignItems:"center",justifyContent:"center",fontSize:w*.024,fontWeight:900,flexShrink:0,marginTop:2}}>✓</div>
                  <div style={{flex:1,minWidth:0}}>{ET({field:"body", rows:4, style:{fontSize:w*.029,lineHeight:1.6,color:sc}})}</div>
                </div>
              )}
            </div>
            <Footer/>
          </>;
        })()}

        {layout==="big_quote_mark"&&<>
          <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",gap:16,padding:`0 ${w*.04}px`,position:"relative",zIndex:1}}>
            {slide.tag&&<span style={{fontSize:10,letterSpacing:3,textTransform:"uppercase",color:ac,fontWeight:700}}>{slide.tag}</span>}
            {ET({field:"title", rows:3, style:{fontSize:w*.062,fontWeight:700,lineHeight:1.25,color:tc,fontStyle:"italic"}})}
            <div style={{width:40,height:3,background:ac,borderRadius:2}}/>
            {ET({field:"body", rows:2, style:{fontSize:w*.028,lineHeight:1.6,color:sc}})}
          </div>
          <Footer/>
        </>}

        {layout==="polaroid"&&<>
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{background:"#fff",padding:`${w*.04}px ${w*.04}px ${w*.1}px`,borderRadius:4,boxShadow:"0 12px 40px rgba(0,0,0,.4)",transform:"rotate(-3deg)",width:"74%",display:"flex",flexDirection:"column",gap:12}}>
              <div style={{aspectRatio:"1",background:photo?"transparent":"#e5e5e5",borderRadius:2,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center"}}>
                {photo?<img src={photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:40,opacity:.25}}>📷</span>}
              </div>
              <div style={{fontFamily:"'Caveat',cursive",fontSize:w*.042,color:"#222",textAlign:"center",lineHeight:1.2}}>{slide.title||"Твоя подпись"}</div>
            </div>
          </div>
          <div style={{position:"absolute",bottom:h*.04,left:0,right:0,padding:`0 ${w*.082}px`,zIndex:4}}><Footer/></div>
        </>}

        {layout==="ticket_stub"&&<>
          <div style={{flex:1,display:"flex",alignItems:"center",padding:`0 ${w*.08}px`}}>
            <div style={{width:"22%",display:"flex",flexDirection:"column",alignItems:"center",gap:6,borderRight:`2px dashed ${ac}40`,paddingRight:w*.03}}>
              <span style={{fontSize:9,letterSpacing:2,textTransform:"uppercase",color:ac,fontWeight:700}}>Admit</span>
              <span style={{fontSize:w*.1,fontWeight:900,color:ac,lineHeight:1}}>{String(slideSeq).padStart(2,"0")}</span>
              <span style={{fontSize:9,letterSpacing:2,textTransform:"uppercase",color:sc}}>of {String(total).padStart(2,"0")}</span>
            </div>
            <div style={{flex:1,padding:`0 ${w*.04}px`,display:"flex",flexDirection:"column",gap:10}}>
              {slide.tag&&<span style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:ac,fontWeight:700}}>{slide.tag}</span>}
              {ET({field:"title", rows:2, style:{fontSize:w*.048,fontWeight:900,lineHeight:1.15,color:tc,textTransform:"uppercase",letterSpacing:-.3}})}
              {ET({field:"body", rows:3, style:{fontSize:w*.026,lineHeight:1.55,color:sc}})}
            </div>
          </div>
          <Footer/>
        </>}

        {layout==="notebook_page"&&<>
          <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",paddingLeft:w*.12,gap:14,position:"relative",zIndex:1}}>
            {slide.tag&&<span style={{fontSize:11,fontFamily:"'Caveat',cursive",color:"#ef4444",fontWeight:700}}>{slide.tag}</span>}
            {ET({field:"title", rows:2, style:{fontSize:w*.06,fontFamily:"'Caveat',cursive",fontWeight:700,lineHeight:1.15,color:tc}})}
            {ET({field:"body", rows:4, style:{fontSize:w*.034,fontFamily:"'Caveat',cursive",lineHeight:1.7,color:sc}})}
          </div>
          <Footer/>
        </>}

        {layout==="receipt"&&<>
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{width:"72%",padding:`${h*.04}px ${w*.05}px`,fontFamily:"'Courier New',monospace",color:"#111",display:"flex",flexDirection:"column",gap:10}}>
              <div style={{textAlign:"center",borderBottom:"1.5px dashed #111",paddingBottom:8,display:"flex",flexDirection:"column",gap:4}}>
                <div style={{fontSize:w*.032,fontWeight:900,letterSpacing:2}}>{slide.tag||"RECEIPT"}</div>
                <div style={{fontSize:w*.02,opacity:.6}}>#{String(slideSeq).padStart(4,"0")} · {new Date().toISOString().slice(0,10)}</div>
              </div>
              <div style={{fontSize:w*.032,fontWeight:900,textAlign:"center",lineHeight:1.2}}>{slide.title||"Заголовок"}</div>
              <div style={{borderTop:"1px dashed #111",paddingTop:8,fontSize:w*.024,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{slide.body||"Описание"}</div>
              <div style={{borderTop:"1.5px dashed #111",paddingTop:8,display:"flex",justifyContent:"space-between",fontSize:w*.026,fontWeight:900}}>
                <span>TOTAL</span><span>{slide.cta||"∞"}</span>
              </div>
              <div style={{textAlign:"center",fontSize:w*.02,marginTop:4,letterSpacing:1}}>*** THANK YOU ***</div>
            </div>
          </div>
          <div style={{position:"absolute",bottom:h*.025,left:0,right:0,padding:`0 ${w*.082}px`,zIndex:4}}><Footer/></div>
        </>}

        {layout==="terminal_code"&&<>
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{width:"82%",padding:`${h*.08}px ${w*.04}px ${h*.04}px`,fontFamily:"'Fira Code','Courier New',monospace",color:"#e6edf3",display:"flex",flexDirection:"column",gap:8}}>
              <div style={{fontSize:w*.022,color:"#7ee787"}}>$ {slide.tag||"echo"} "{slide.title||"hello world"}"</div>
              <div style={{fontSize:w*.028,color:"#e6edf3",lineHeight:1.6,whiteSpace:"pre-wrap",minHeight:h*.2}}>{slide.body||"// комментарий\nconst result = magic();"}</div>
              <div style={{fontSize:w*.022,color:"#58a6ff",display:"flex",alignItems:"center",gap:4}}>$ <span style={{display:"inline-block",width:w*.012,height:w*.03,background:"#58a6ff",animation:"blink 1s step-end infinite"}}/></div>
            </div>
          </div>
          <div style={{position:"absolute",bottom:h*.025,left:0,right:0,padding:`0 ${w*.082}px`,zIndex:4}}><Footer/></div>
        </>}

        {layout==="cta_save"&&<>
          <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",gap:14,padding:`0 ${w*.03}px`}}>
            <div style={{display:"inline-flex",alignItems:"center",gap:8,alignSelf:"flex-start",padding:`${h*.008}px ${w*.025}px`,background:ac,color:hlT,borderRadius:100,fontSize:w*.022,fontWeight:900,letterSpacing:1.5,textTransform:"uppercase"}}>🔖 {slide.tag||"Сохрани"}</div>
            {ET({field:"title", rows:2, style:{fontSize:w*.064,fontWeight:900,lineHeight:1.08,color:tc,letterSpacing:-.5}})}
            <div style={{width:40,height:3,background:ac,borderRadius:2}}/>
            {ET({field:"body", rows:4, style:{fontSize:w*.03,lineHeight:1.6,color:sc}})}
            <div style={{marginTop:4,padding:`${h*.014}px ${w*.04}px`,border:`2px solid ${ac}`,borderRadius:12,fontSize:w*.026,fontWeight:800,color:ac,alignSelf:"flex-start"}}>
              {slide.cta||"Сохрани в закладки"}
            </div>
          </div>
          <Footer/>
        </>}

        {layout==="cover_magazine"&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:h*.02,marginBottom:h*.015}}>
            <span style={{fontSize:w*.032,fontWeight:900,color:ac,letterSpacing:2,textTransform:"uppercase"}}>{username?username.replace(/^@/,"").toUpperCase():"BRAND"}</span>
            <span style={{fontSize:10,letterSpacing:2,color:sc}}>№ {String(slideSeq).padStart(3,"0")} · {new Date().getFullYear()}</span>
          </div>
          <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"flex-end",gap:14,paddingBottom:h*.04}}>
            {slide.tag&&<span style={{fontSize:11,letterSpacing:3,textTransform:"uppercase",color:ac,fontWeight:800,background:ac+"22",padding:"4px 12px",borderRadius:4,alignSelf:"flex-start"}}>{slide.tag}</span>}
            {ET({field:"title", rows:3, style:{fontSize:w*.14,fontWeight:900,lineHeight:.92,color:tc,letterSpacing:-3,textTransform:"uppercase"}})}
            <div style={{display:"flex",gap:w*.03,marginTop:8}}>
              <div style={{flex:1,height:1,background:ac,opacity:.5,alignSelf:"center"}}/>
              {ET({field:"body", rows:3, style:{fontSize:w*.026,lineHeight:1.55,color:sc,flex:2}})}
            </div>
          </div>
        </>}

        {layout==="cover_torn"&&<>
          <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"flex-end",gap:14,paddingBottom:h*.02}}>
            {slide.tag&&<span style={{fontSize:10,letterSpacing:TEMPLATE_TOKENS.tagLetterSpacing,textTransform:"uppercase",color:ac,fontWeight:700}}>{slide.tag}</span>}
            {ET({field:"title", rows:2, style:{fontSize:w*.08,fontWeight:900,lineHeight:1.04,color:tc,letterSpacing:-1}})}
            <div style={{maxWidth:"86%"}}>
              {ET({field:"body", rows:3, style:{fontSize:w*.03,lineHeight:1.65,color:sc}})}
            </div>
          </div>
          <Footer/>
        </>}

        {layout==="cover_sticker"&&<>
          <div style={{position:"absolute",top:h*.1,right:w*.04,width:w*.26,height:w*.26,borderRadius:"50%",background:ac,color:hlT,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",transform:"rotate(-15deg)",boxShadow:"0 8px 24px rgba(0,0,0,.3)",zIndex:4}}>
            <span style={{fontSize:w*.022,fontWeight:800,letterSpacing:1.5,textTransform:"uppercase"}}>NEW</span>
            <span style={{fontSize:w*.05,fontWeight:900,letterSpacing:-1,lineHeight:1}}>№1</span>
            <span style={{fontSize:w*.018,fontWeight:600,opacity:.85}}>2026</span>
          </div>
          <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"flex-end",gap:14,paddingBottom:h*.02,paddingRight:w*.32}}>
            {slide.tag&&<span style={{fontSize:10,letterSpacing:TEMPLATE_TOKENS.tagLetterSpacing,textTransform:"uppercase",color:ac,fontWeight:700}}>{slide.tag}</span>}
            {ET({field:"title", rows:3, style:{fontSize:w*.072,fontWeight:900,lineHeight:1.04,color:tc,letterSpacing:-.8}})}
            <div style={{maxWidth:"100%"}}>
              {ET({field:"body", rows:3, style:{fontSize:w*.03,lineHeight:1.65,color:sc}})}
            </div>
          </div>
          <Footer/>
        </>}

        {layout==="cover_film"&&<>
          <div style={{paddingTop:h*.1}}/>
          <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",gap:14,padding:`0 ${w*.02}px`}}>
            <div style={{display:"flex",alignItems:"center",gap:8,color:ac,fontSize:w*.022,letterSpacing:3,textTransform:"uppercase",fontWeight:700}}>
              <span>● REC</span>
              <span style={{flex:1,height:1,background:ac,opacity:.3}}/>
              <span>{slide.tag||"SCENE 01"}</span>
            </div>
            {ET({field:"title", rows:3, style:{fontSize:w*.078,fontWeight:900,lineHeight:1.04,color:tc,letterSpacing:-.8,textTransform:"uppercase"}})}
            <div style={{width:60,height:3,background:ac}}/>
            {ET({field:"body", rows:3, style:{fontSize:w*.03,lineHeight:1.65,color:sc}})}
          </div>
          <div style={{paddingBottom:h*.1}}><Footer/></div>
        </>}

        {layout==="cover_minimal_type"&&<>
          <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",gap:16}}>
            {ET({field:"title", rows:4, style:{fontSize:w*.16,fontWeight:900,lineHeight:.88,color:tc,letterSpacing:-4}})}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginTop:h*.02}}>
              <div style={{maxWidth:"60%"}}>
                {ET({field:"body", rows:2, style:{fontSize:w*.024,lineHeight:1.5,color:sc}})}
              </div>
              <span style={{fontSize:w*.024,color:ac,fontWeight:800,letterSpacing:1.5}}>{slide.tag||"—"}</span>
            </div>
          </div>
          <Footer/>
        </>}

        {layout==="cover_grid_lines"&&<>
          <div style={{display:"flex",justifyContent:"space-between",fontFamily:"monospace",fontSize:9,color:ac,opacity:.7,marginBottom:h*.02}}>
            <span>[ COVER.01 ]</span>
            <span>GRID / {Math.round(w)}x{Math.round(h)}</span>
          </div>
          <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",gap:14,padding:`0 ${w*.02}px`}}>
            {slide.tag&&<span style={{fontSize:10,fontFamily:"monospace",color:ac,letterSpacing:2}}>// {slide.tag}</span>}
            {ET({field:"title", rows:3, style:{fontSize:w*.088,fontWeight:900,lineHeight:1,color:tc,letterSpacing:-1.5,textTransform:"uppercase",fontFamily:"monospace"}})}
            <div style={{display:"flex",gap:6}}>
              <div style={{width:w*.03,height:3,background:ac}}/>
              <div style={{width:w*.1,height:3,background:ac,opacity:.6}}/>
              <div style={{width:w*.04,height:3,background:ac,opacity:.3}}/>
            </div>
            {ET({field:"body", rows:3, style:{fontSize:w*.028,lineHeight:1.6,color:sc,fontFamily:"monospace"}})}
          </div>
          <Footer/>
        </>}
      </div>
      <IGOverlay/>
    </div>
  );
}

// ── Tiny controls ─────────────────────────────────────────────────────────────
function ThemeDot({ t, active, onClick }) {
  return <button onClick={onClick} title={t.label} style={{width:44,height:44,borderRadius:10,background:t.bg,cursor:"pointer",flexShrink:0,padding:6,border:`${active?"3px":"1.5px"} solid ${active?t.accent:t.border}`,boxShadow:active?`0 0 0 3px ${t.accent}33`:"none",position:"relative",overflow:"hidden"}}>
    <div style={{width:"75%",height:4,borderRadius:2,background:t.accent,marginBottom:3}}/>
    <div style={{width:"90%",height:3,borderRadius:2,background:t.sub,opacity:.5,marginBottom:2}}/>
    <div style={{width:"55%",height:3,borderRadius:2,background:t.sub,opacity:.3}}/>
    {active&&<div style={{position:"absolute",top:3,right:3,width:7,height:7,borderRadius:"50%",background:t.accent}}/>}
  </button>;
}

function LayoutBtn({ l, T, active, onClick }) {
  return <button onClick={onClick} style={{padding:"6px 11px",borderRadius:8,fontSize:12,border:`${active?"2px":"1px"} solid ${active?T.accent:"var(--color-border-tertiary)"}`,background:active?"var(--color-background-secondary)":"var(--color-background-primary)",cursor:"pointer",fontWeight:active?700:500,color:active?"var(--color-text-primary)":"var(--color-text-secondary)",whiteSpace:"nowrap"}}>{l.label}</button>;
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App({ onProfile }: { onProfile?: () => void }) {
  const { user, useGeneration } = useAuth();
  const isPro = user?.role === "pro";
  const isAdminUser = !!user?.isAdmin;
  const [contentAccess, setContentAccess] = useState<ContentAccessPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_PUBLIC_BASE}/api/public/content-access`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d && typeof d === "object" && d.layouts && d.covers) {
          setContentAccess(d as ContentAccessPayload);
        }
      })
      .catch(() => {
        if (!cancelled) setContentAccess(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleLayouts = useMemo(() => {
    if (isAdminUser || !contentAccess) return LAYOUTS;
    const v = LAYOUTS.filter((l) => isVisibleForUser(contentAccess.layouts[l.id], isPro, isAdminUser));
    return v.length > 0 ? v : LAYOUTS;
  }, [isAdminUser, contentAccess, isPro]);

  const layoutAllowedSet = useMemo(() => {
    if (isAdminUser || !contentAccess) return null;
    return new Set(visibleLayouts.map((l) => l.id));
  }, [isAdminUser, contentAccess, visibleLayouts]);

  const visibleCovers = useMemo(() => {
    if (isAdminUser || !contentAccess) return COVER_LAYOUTS;
    return COVER_LAYOUTS.filter((c) => isVisibleForUser(contentAccess.covers[c.id], isPro, isAdminUser));
  }, [isAdminUser, contentAccess, isPro]);

  const visibleFonts = useMemo(() => {
    if (isAdminUser || !contentAccess) return FONTS;
    return FONTS.filter((f) => isVisibleForUser(contentAccess.fonts[f.id], isPro, isAdminUser));
  }, [isAdminUser, contentAccess, isPro]);

  const visibleSizes = useMemo(() => {
    if (isAdminUser || !contentAccess) return SIZES;
    return SIZES.filter((s) => isVisibleForUser(contentAccess.sizes[s.id], isPro, isAdminUser));
  }, [isAdminUser, contentAccess, isPro]);

  const visibleThemes = useMemo(() => {
    if (isAdminUser || !contentAccess) return THEMES;
    return THEMES.filter((t) => isVisibleForUser(contentAccess.themes[t.id], isPro, isAdminUser));
  }, [isAdminUser, contentAccess, isPro]);

  const [topic, setTopic] = useState("");
  const [slideCount, setSlideCount] = useState(5);
  const [themeId, setThemeId] = useState("white_blue");
  const [layout, setLayout] = useState("bold_center");
  const [sizeId, setSizeId] = useState("square");
  const [fontId, setFontId] = useState("montserrat");
  const [textPreset, setTextPreset] = useState("white");
  const [username, setUsername] = useState("");
  const [composeMode, setComposeMode] = useState<"ai"|"manual">("ai");
  const [setupStep, setSetupStep] = useState<1|2>(1);
  const [designTab, setDesignTab] = useState<"cover"|"layout"|"font"|"size"|"theme">("layout");
  const [coverLayout, setCoverLayout] = useState("");
  const [contentNotes, setContentNotes] = useState("");
  const [showContentNotes, setShowContentNotes] = useState(false);
  const [voiceActiveField, setVoiceActiveField] = useState<"topic" | "notes" | null>(null);
  const [voiceMicPreparing, setVoiceMicPreparing] = useState(false);
  const [voicePreparingField, setVoicePreparingField] = useState<"topic" | "notes" | null>(null);
  const [voiceInterimText, setVoiceInterimText] = useState("");
  const [voiceMeterBars, setVoiceMeterBars] = useState<number[]>([]);
  const [speechSupported] = useState(() => !!getSpeechRecognitionCtor());
  const voiceFieldRef = useRef<"topic" | "notes">("topic");
  const speechRecognitionRef = useRef<SpeechRecognition | null>(null);
  const voiceRecIdRef = useRef(0);
  const voiceMediaStreamRef = useRef<MediaStream | null>(null);
  const voiceAudioCtxRef = useRef<AudioContext | null>(null);
  const voiceAnalyserRef = useRef<AnalyserNode | null>(null);
  const voiceRafRef = useRef(0);
  const lastHistoryTitleLabelRef = useRef("");
  const [slides, setSlides] = useState([]);
  const [aiTextSaved, setAiTextSaved] = useState(false);
  const [photos, setPhotos] = useState({});
  const [beforePhotos, setBeforePhotos] = useState({});
  const [avatarPhotos, setAvatarPhotos] = useState({} as Record<number, string>);
  const [photoTransforms, setPhotoTransforms] = useState({} as Record<number,{ x: number; y: number; scale: number }>);
  const [beforePhotoTransforms, setBeforePhotoTransforms] = useState({} as Record<number,{ x: number; y: number; scale: number }>);
  // rawPhoto/photoTarget removed — photos applied directly without editor
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [moveMode, setMoveMode] = useState(false);
  const [captureIdx, setCaptureIdx] = useState(-1);
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState("");
  const [textOffsets, setTextOffsets] = useState({});  // { slideIdx: { title: {x,y}, body: {x,y} } }
  const [textScales, setTextScales] = useState({});    // { slideIdx: { title: number, body: number, cta: number } }
  const [textPositionPresets, setTextPositionPresets] = useState({} as Record<number,string>);
  const [textMoveAxes, setTextMoveAxes] = useState({} as Record<number,"free" | "x" | "y">);
  const [photoEditor, setPhotoEditor] = useState<{ src: string; kind: "after" | "before"; slide: number } | null>(null);
  const [slideLayouts, setSlideLayouts] = useState({} as Record<number,string>); // per-slide layout overrides
  const [winW, setWinW] = useState(typeof window !== "undefined" ? window.innerWidth : 800);
  const slideRefs = useRef([]);
  const captureRef = useRef(null);
  const fileRef = useRef(null);
  const beforeFileRef = useRef(null);
  const avatarFileRef = useRef(null);
  const textEditorRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const touchStart = useRef({x:0,y:0,t:0});
  const [requestHistory, setRequestHistory] = useState<RequestHistoryItem[]>(() => readRequestHistoryFromStorage());

  useEffect(() => {
    const upd = () => setWinW(window.innerWidth);
    window.addEventListener("resize", upd);
    return () => window.removeEventListener("resize", upd);
  }, []);

  useEffect(() => {
    if (setupStep > 2) setSetupStep(2);
  }, [setupStep]);

  const cleanupVoiceAudio = useCallback(() => {
    if (voiceRafRef.current) {
      cancelAnimationFrame(voiceRafRef.current);
      voiceRafRef.current = 0;
    }
    voiceAnalyserRef.current = null;
    try {
      void voiceAudioCtxRef.current?.close();
    } catch {
      /* ignore */
    }
    voiceAudioCtxRef.current = null;
    voiceMediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    voiceMediaStreamRef.current = null;
    setVoiceMeterBars([]);
  }, []);

  useEffect(() => {
    return () => {
      voiceRecIdRef.current++;
      try {
        speechRecognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
      speechRecognitionRef.current = null;
      cleanupVoiceAudio();
    };
  }, [cleanupVoiceAudio]);

  const stopVoiceInput = useCallback(() => {
    voiceRecIdRef.current++;
    try {
      speechRecognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    speechRecognitionRef.current = null;
    setVoiceActiveField(null);
    setVoiceMicPreparing(false);
    setVoicePreparingField(null);
    setVoiceInterimText("");
    cleanupVoiceAudio();
  }, [cleanupVoiceAudio]);

  const beginVoiceRecognition = useCallback(
    async (field: "topic" | "notes") => {
      const Ctor = getSpeechRecognitionCtor();
      if (!Ctor) {
        setError("Голосовой ввод недоступен. Используйте Chrome, Edge или Safari.");
        return;
      }
      const myId = ++voiceRecIdRef.current;
      voiceFieldRef.current = field;
      setVoiceMicPreparing(true);
      setVoicePreparingField(field);
      setVoiceInterimText("");
      setVoiceMeterBars([]);
      cleanupVoiceAudio();

      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
      } catch {
        if (voiceRecIdRef.current !== myId) return;
        setError("Не удалось включить микрофон. Разрешите доступ в настройках браузера.");
        setVoiceMicPreparing(false);
        setVoicePreparingField(null);
        return;
      }

      if (voiceRecIdRef.current !== myId) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      voiceMediaStreamRef.current = stream;
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) {
        stream.getTracks().forEach((t) => t.stop());
        voiceMediaStreamRef.current = null;
        setError("Аудио в этом браузере недоступно.");
        setVoiceMicPreparing(false);
        setVoicePreparingField(null);
        return;
      }
      const ctx = new AC();
      voiceAudioCtxRef.current = ctx;
      try {
        await ctx.resume();
      } catch {
        /* ignore */
      }
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.82;
      source.connect(analyser);
      voiceAnalyserRef.current = analyser;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (voiceRecIdRef.current !== myId || !voiceAnalyserRef.current) return;
        voiceAnalyserRef.current.getByteFrequencyData(dataArray);
        const bars: number[] = [];
        const n = 8;
        const bin = Math.max(1, Math.floor(dataArray.length / n));
        for (let i = 0; i < n; i++) {
          let s = 0;
          for (let j = 0; j < bin; j++) s += dataArray[i * bin + j] ?? 0;
          bars.push(Math.min(1, (s / 255 / bin) * 2.8));
        }
        setVoiceMeterBars(bars);
        voiceRafRef.current = requestAnimationFrame(tick);
      };
      voiceRafRef.current = requestAnimationFrame(tick);

      const rec = new Ctor();
      speechRecognitionRef.current = rec;
      rec.lang = "ru-RU";
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.onresult = (e: SpeechRecognitionEvent) => {
        if (voiceRecIdRef.current !== myId) return;
        let newFinal = "";
        let fullInterim = "";
        for (let i = 0; i < e.results.length; i++) {
          const r = e.results[i];
          const tr = r[0].transcript;
          if (r.isFinal) newFinal += tr;
          else fullInterim += tr;
        }
        setVoiceInterimText(fullInterim);
        if (newFinal.trim()) {
          const f = voiceFieldRef.current;
          if (f === "topic") setTopic((prev) => appendVoiceChunk(prev, newFinal));
          else setContentNotes((prev) => appendVoiceChunk(prev, newFinal));
        }
      };
      rec.onerror = (e: SpeechRecognitionErrorEvent) => {
        if (e.error === "aborted") return;
        if (voiceRecIdRef.current !== myId) return;
        setVoiceActiveField(null);
        speechRecognitionRef.current = null;
        setVoiceInterimText("");
        cleanupVoiceAudio();
        const msg =
          e.error === "not-allowed"
            ? "Разрешите доступ к микрофону в настройках браузера."
            : e.error === "no-speech"
              ? "Речь не распознана. Попробуйте ещё раз."
              : e.error === "network"
                ? "Нет сети для распознавания. Проверьте подключение."
                : `Ошибка микрофона: ${e.error}`;
        setError(msg);
      };
      rec.onend = () => {
        if (voiceRecIdRef.current !== myId) return;
        speechRecognitionRef.current = null;
        setVoiceActiveField(null);
        setVoiceInterimText("");
        cleanupVoiceAudio();
      };
      try {
        rec.start();
        setVoiceActiveField(field);
        setError("");
      } catch {
        setError("Не удалось запустить распознавание речи.");
        speechRecognitionRef.current = null;
        setVoiceActiveField(null);
        cleanupVoiceAudio();
      } finally {
        setVoiceMicPreparing(false);
        setVoicePreparingField(null);
      }
    },
    [cleanupVoiceAudio]
  );

  const toggleVoiceInput = useCallback(
    (field: "topic" | "notes") => {
      if (!speechSupported) return;
      if (voiceMicPreparing && voicePreparingField === field) {
        stopVoiceInput();
        return;
      }
      if (voiceActiveField === field) {
        stopVoiceInput();
        return;
      }
      if (voiceActiveField !== null) {
        stopVoiceInput();
        queueMicrotask(() => {
          void beginVoiceRecognition(field).catch(() => {});
        });
        return;
      }
      void beginVoiceRecognition(field).catch(() => {});
    },
    [speechSupported, voiceMicPreparing, voicePreparingField, voiceActiveField, stopVoiceInput, beginVoiceRecognition]
  );

  const persistRequestHistory = useCallback((items: RequestHistoryItem[]) => {
    try {
      localStorage.setItem(REQUEST_HISTORY_KEY, JSON.stringify(items.slice(0, REQUEST_HISTORY_MAX)));
    } catch {
      /* quota / private mode */
    }
  }, []);

  const addRequestHistoryEntry = useCallback(
    (entry: Omit<RequestHistoryItem, "id" | "at">) => {
      const item: RequestHistoryItem = {
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        ...entry,
      };
      setRequestHistory((prev) => {
        const next = [item, ...prev].slice(0, REQUEST_HISTORY_MAX);
        persistRequestHistory(next);
        return next;
      });
    },
    [persistRequestHistory]
  );

  const removeRequestHistoryItem = useCallback(
    (id: string) => {
      setRequestHistory((prev) => {
        const next = prev.filter((x) => x.id !== id);
        persistRequestHistory(next);
        return next;
      });
    },
    [persistRequestHistory]
  );

  const applyRequestHistoryItem = useCallback((item: RequestHistoryItem) => {
    setTopic(item.topic);
    setContentNotes(item.notes);
    setSlideCount(item.slideCount);
    setUsername(item.username);
    setComposeMode(item.composeMode);
    if (item.notes.trim()) setShowContentNotes(true);
  }, []);

  // Resolve effective layout for a given slide index
  function resolveLayout(idx: number): string {
    if (slideLayouts[idx]) return slideLayouts[idx];
    if (idx === 0 && coverLayout) return coverLayout;
    if (idx === 0 && ["left_number","bold_number","timeline_flow"].includes(layout)) return "cover_clean";
    return layout;
  }

  const selectedTheme = THEMES.find(t=>t.id===themeId) || THEMES[0];
  const T = selectedTheme;
  const font = FONTS.find(f=>f.id===fontId);
  const size = SIZES.find(s=>s.id===sizeId);
  const currentLayout = resolveLayout(current);
  const currentLayoutIsPhoto = currentLayout === "photo";
  const currentInlinePhotoLayout = INLINE_PHOTO_LAYOUTS.includes(currentLayout);
  const currentTextPositionPreset = textPositionPresets[current] || "full";
  const currentTextMoveAxis = textMoveAxes[current] || "y";
  const currentPhotoTransform = { ...DEFAULT_PHOTO_TRANSFORM, ...(photoTransforms[current] || {}) };
  const currentBeforePhotoTransform = { ...DEFAULT_PHOTO_TRANSFORM, ...(beforePhotoTransforms[current] || {}) };
  const displayUsername = username;
  const igMode = false;
  const hasCoverSlide = resolveLayout(0).startsWith("cover_");

  useEffect(() => {
    if (isAdminUser || !layoutAllowedSet) return;
    if (!layoutAllowedSet.has(layout)) {
      const first = visibleLayouts[0]?.id || "bold_center";
      setLayout(first);
      setSlideLayouts({});
    }
  }, [isAdminUser, layoutAllowedSet, layout, visibleLayouts]);

  useEffect(() => {
    if (isAdminUser || !layoutAllowedSet) return;
    const allowed = layoutAllowedSet;
    setSlideLayouts((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        const idx = Number(k);
        const lid = next[idx];
        if (lid && !allowed.has(lid)) {
          delete next[idx];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [isAdminUser, layoutAllowedSet, contentAccess]);

  useEffect(() => {
    if (isAdminUser || !contentAccess) return;
    if (coverLayout && !isVisibleForUser(contentAccess.covers[coverLayout], isPro, isAdminUser)) {
      setCoverLayout("");
    }
  }, [isAdminUser, contentAccess, coverLayout, isPro]);

  useEffect(() => {
    if (isAdminUser || !contentAccess) return;
    if (!isVisibleForUser(contentAccess.fonts[fontId], isPro, isAdminUser)) {
      const first = visibleFonts[0] || FONTS[0];
      if (first) setFontId(first.id);
    }
  }, [isAdminUser, contentAccess, fontId, isPro, visibleFonts]);

  useEffect(() => {
    if (isAdminUser || !contentAccess) return;
    if (!isVisibleForUser(contentAccess.sizes[sizeId], isPro, isAdminUser)) {
      const first = visibleSizes[0] || SIZES[0];
      if (first) setSizeId(first.id);
    }
  }, [isAdminUser, contentAccess, sizeId, isPro, visibleSizes]);

  useEffect(() => {
    if (isAdminUser || !contentAccess) return;
    if (!isVisibleForUser(contentAccess.themes[themeId], isPro, isAdminUser)) {
      const first = visibleThemes[0] || THEMES[0];
      if (first) setThemeId(first.id);
    }
  }, [isAdminUser, contentAccess, themeId, isPro, visibleThemes]);

  useEffect(()=>{ loadFont(font); },[fontId]);

  async function generate() {
    if (!topic.trim()) return false;
    if (!OPENAI_API_KEY.trim()) {
      setError("Добавьте ключ OpenAI: переменная VITE_OPENAI_API_KEY в .env (локально) или в настройках окружения Vercel.");
      return false;
    }
    setLoading(true); setError(""); setSlides([]); setCurrent(0); setPhotos({}); setBeforePhotos({}); setAvatarPhotos({}); setPhotoTransforms({}); setBeforePhotoTransforms({}); setEditMode(false); setMoveMode(false); setTextOffsets({}); setTextScales({}); setTextPositionPresets({}); setTextMoveAxes({}); setSlideLayouts({}); setCoverLayout("");
    try {
      // Check generation limit
      const { allowed } = await useGeneration();
      if (!allowed) { setError("Лимит генераций исчерпан. Подключите Pro для безлимита!"); setLoading(false); return false; }
      const total = slideCount;
      const notes = contentNotes.trim();
      const userPrompt = `Создай Instagram карусель на тему: "${topic}". Количество слайдов: ровно ${total}.\nОсобенности текста: ${notes || "нет дополнительных требований"}.\nКаждый элемент: title (с *акцентами*), body (2–3 предложения, *важное* в звёздочках), tag (строка или null), cta (только у последнего слайда или null).\nВажно: НЕ используй нумерацию вроде "Слайд 1" в title или body. Русский язык. Не оставляй висячие предлоги/союзы в конце строки.\nВерни один JSON-объект с полем "slides" — массив из ${total} объектов в этом формате.`;
      let parsed: any = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: OPENAI_MODEL,
            temperature: 0.65,
            max_tokens: Math.max(1600, total * 180),
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content: "Ты помощник для контента Instagram. Отвечай только валидным JSON без markdown и пояснений.",
              },
              { role: "user", content: userPrompt },
            ],
          }),
        });
        const d = await res.json();
        if (res.status === 429 && attempt < 3) {
          setError(`Сервер перегружен, повтор ${attempt}/3…`);
          await new Promise(r => setTimeout(r, 2000 * attempt));
          setError("");
          continue;
        }
        if (!res.ok) throw new Error(d.error?.message || `OpenAI: ${res.status}`);
        const raw = d.choices?.[0]?.message?.content || "";
        if (!raw) throw new Error(d.error?.message || "Пустой ответ");
        try {
          parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
        } catch {
          throw new Error("Не удалось разобрать JSON от модели");
        }
        break;
      }
      const arr = Array.isArray(parsed) ? parsed : parsed?.slides;
      if (!Array.isArray(arr)) throw new Error("В ответе нет массива slides");
      const normalized = normalizeSlides(arr);
      setSlides(normalized);
      lastHistoryTitleLabelRef.current = formatHistorySlideTitle(
        String(normalized[0]?.title || ""),
        topic.trim()
      );
      setAiTextSaved(true);
      setLoading(false);
      return true;
    } catch (e) {
      setError(`Ошибка: ${(e as Error).message || "Попробуй ещё раз."}`);
    }
    setLoading(false);
    return false;
  }

  async function generateAndGoToStep2() {
    const ok = await generate();
    if (ok) {
      addRequestHistoryEntry({
        titleLabel:
          lastHistoryTitleLabelRef.current ||
          formatHistorySlideTitle("", topic.trim()),
        topic: topic.trim(),
        notes: contentNotes.trim(),
        slideCount,
        username: username.trim(),
        composeMode: "ai",
      });
      setSetupStep(2);
    }
  }

  function editSlide(i,field,val){ setSlides(p=>p.map((s,j)=>j===i?{...s,[field]:val}:s)); }

  function wrapSelectedInField(field: "title" | "body" | "cta") {
    const ta = textEditorRefs.current[field];
    if (!ta) return;
    const value = (slides[current]?.[field] || "") + "";
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;
    if (start === end) return;
    const selected = value.slice(start, end).replace(/^\*+|\*+$/g, "");
    const updated = `${value.slice(0, start)}*${selected}*${value.slice(end)}`;
    editSlide(current, field, updated);
    setTimeout(() => {
      const el = textEditorRefs.current[field];
      if (!el) return;
      el.focus();
      el.setSelectionRange(start, start + selected.length + 2);
    }, 0);
  }

  function createManual() {
    const empty = Array.from({length:slideCount}, (_,i) => ({
      title:"", body:"", tag:null, cta: i===slideCount-1 ? "Узнать больше" : null
    }));
    setSlides(empty); setCurrent(0); setPhotos({}); setBeforePhotos({}); setAvatarPhotos({}); setPhotoTransforms({}); setBeforePhotoTransforms({});
    setAiTextSaved(false);
    setEditMode(true); setMoveMode(false); setTextOffsets({}); setTextScales({}); setTextPositionPresets({}); setTextMoveAxes({}); setSlideLayouts({}); setCoverLayout(""); setError("");
  }

  function addSlide() {
    setSlides(p => {
      const n = [...p];
      n.splice(current+1, 0, {title:"", body:"", tag:null, cta:null});
      return n;
    });
    // Reindex photos and slideLayouts after insertion point
    const reindexUp = (p) => { const n={}; Object.entries(p).forEach(([k,v])=>{ const ki=+k; n[ki<current+1?ki:ki+1]=v; }); return n; };
    setPhotos(reindexUp); setBeforePhotos(reindexUp); setAvatarPhotos(reindexUp as any); setPhotoTransforms(reindexUp as any); setBeforePhotoTransforms(reindexUp as any); setTextOffsets(reindexUp as any); setTextScales(reindexUp as any); setTextPositionPresets(reindexUp as any); setTextMoveAxes(reindexUp as any); setSlideLayouts(reindexUp as any);
    setCurrent(c => c+1);
  }

  function removeSlide() {
    if (slides.length<=1) return;
    setSlides(p => { const n=[...p]; n.splice(current,1); return n; });
    const reindexDown = (p) => { const n={}; Object.entries(p).forEach(([k,v])=>{ const ki=+k; if(ki!==current) n[ki<current?ki:ki-1]=v; }); return n; };
    setPhotos(reindexDown); setBeforePhotos(reindexDown); setAvatarPhotos(reindexDown as any); setPhotoTransforms(reindexDown as any); setBeforePhotoTransforms(reindexDown as any); setTextOffsets(reindexDown as any); setTextScales(reindexDown as any); setTextPositionPresets(reindexDown as any); setTextMoveAxes(reindexDown as any); setSlideLayouts(reindexDown as any);
    setCurrent(c => Math.min(c, slides.length-2));
  }

  function onFileChange(e) {
    const f=e.target.files?.[0]; if(!f) return;
    const reader=new FileReader();
    reader.onload=ev=>setPhotoEditor({ src: ev.target.result as string, kind:"after", slide: current });
    reader.readAsDataURL(f); e.target.value="";
  }

  function onBeforeFileChange(e) {
    const f=e.target.files?.[0]; if(!f) return;
    const reader=new FileReader();
    reader.onload=ev=>setPhotoEditor({ src: ev.target.result as string, kind:"before", slide: current });
    reader.readAsDataURL(f); e.target.value="";
  }

  function onAvatarFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPhotos((p) => ({ ...p, [current]: ev.target?.result as string }));
    reader.readAsDataURL(f);
    e.target.value = "";
  }

  async function captureSlide(idx) {
    const {toCanvas}=await import("https://esm.sh/html-to-image@1.11.11");
    setCaptureIdx(idx);
    const fontCSS=await embedFontCSS(font);
    await new Promise(r=>setTimeout(r,350));
    const el=captureRef.current;
    if(!el) return null;

    const photo=photos[idx];
    const specialLayouts=INLINE_PHOTO_LAYOUTS;
    const effectiveLayout = resolveLayout(idx);
    const isFullBg=!specialLayouts.includes(effectiveLayout);

    if(photo&&isFullBg){
      // Mobile-safe export: html-to-image cannot render CSS backgroundImage on WebKit.
      // Solution: exclude photo/gradient layers from html-to-image, then composite manually.
      const slideCanvas=await toCanvas(el,{
        pixelRatio:2,
        fontEmbedCSS:fontCSS||undefined,
        filter:(node:Node)=>{
          if(!(node instanceof Element))return true;
          return node.getAttribute("data-photo-layer")!=="true";
        },
      });
      const W=slideCanvas.width, H=slideCanvas.height;
      const composite=document.createElement("canvas");
      composite.width=W; composite.height=H;
      const ctx=composite.getContext("2d")!;
      // 1. Draw photo (object-fit cover)
      await new Promise<void>(resolve=>{
        const img=new Image();
        img.onload=()=>{
          const r=Math.max(W/img.width,H/img.height);
          const iw=img.width*r, ih=img.height*r;
          ctx.drawImage(img,(W-iw)/2,(H-ih)/2,iw,ih);
          resolve();
        };
        img.onerror=()=>resolve();
        img.src=photo;
      });
      // 2. Dark gradient overlay (matches visual preview)
      const grad=ctx.createLinearGradient(W*.16,H*.16,W*.84,H*.84);
      grad.addColorStop(0,"rgba(0,0,0,0.35)");
      grad.addColorStop(1,"rgba(0,0,0,0.75)");
      ctx.fillStyle=grad; ctx.fillRect(0,0,W,H);
      // 3. Text, icons, decorators on top
      ctx.drawImage(slideCanvas,0,0);
      setCaptureIdx(-1);
      return composite;
    }

    const c=await toCanvas(el,{pixelRatio:2,backgroundColor:T.bg,fontEmbedCSS:fontCSS||undefined});
    setCaptureIdx(-1);
    return c;
  }

  async function dlSlide(idx) {
    const em=editMode; const mm=moveMode; const prev=current;
    setEditMode(false); setMoveMode(false); setSaving(true); setSaveProgress("Рендерим слайд...");
    try {
      const c=await captureSlide(idx); if(!c){ setSaving(false); return; }
      setSaveProgress("Сохраняем...");
      const dataUrl=c.toDataURL("image/png");
      try {
        const res=await fetch(dataUrl);
        const blob=await res.blob();
        const file=new File([blob],`slide-${idx+1}.png`,{type:"image/png"});
        if(navigator.canShare?.({files:[file]})){
          await navigator.share({files:[file],title:`Карусель ${idx+1}`});
          setCurrent(prev); setEditMode(em); setMoveMode(mm); setSaving(false); return;
        }
      } catch {}
      const a=document.createElement("a"); a.href=dataUrl; a.download=`slide-${idx+1}.png`; a.click();
    } catch { alert("Ошибка экспорта"); }
    setCurrent(prev); setEditMode(em); setMoveMode(mm); setSaving(false);
  }

  async function dlAll() {
    if(slides.length===0) return;
    const em=editMode; const mm=moveMode;
    setEditMode(false); setMoveMode(false); setSaving(true);
    try {
      const canvases: {c: HTMLCanvasElement, i: number}[] = [];
      for(let i=0;i<slides.length;i++){
        setSaveProgress(`Рендерим слайд ${i+1} из ${slides.length}...`);
        const c=await captureSlide(i); if(c) canvases.push({c,i});
      }
      // Определяем мобильное устройство
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if(isMobile && navigator.canShare) {
        // Мобильный путь: отдельные PNG → галерея через Web Share API
        setSaveProgress("Подготавливаем изображения...");
        const files: File[] = [];
        for(const {c,i} of canvases){
          const blob: Blob|null = await new Promise(r => c.toBlob(r, "image/png"));
          if(blob) files.push(new File([blob], `slide-${i+1}.png`, {type:"image/png"}));
        }
        // Разбиваем на чанки по 10 файлов (лимит Web Share API)
        const CHUNK = 10;
        const chunks: File[][] = [];
        for(let ci=0; ci<files.length; ci+=CHUNK) chunks.push(files.slice(ci, ci+CHUNK));
        for(let ch=0; ch<chunks.length; ch++){
          const chunk = chunks[ch];
          if(navigator.canShare({files: chunk})) {
            setSaveProgress(chunks.length > 1 ? `Сохраняем часть ${ch+1} из ${chunks.length}...` : "Сохраняем в галерею...");
            try { await navigator.share({files: chunk, title: chunks.length > 1 ? `Карусель (${ch+1}/${chunks.length})` : "Карусель"}); } catch {}
          } else {
            // Если чанк не поддерживается — по одному
            for(let fi=0; fi<chunk.length; fi++){
              setSaveProgress(`Сохраняем ${ch*CHUNK+fi+1} из ${files.length}...`);
              try { await navigator.share({files:[chunk[fi]], title:`Слайд ${ch*CHUNK+fi+1}`}); } catch {}
            }
          }
        }
      } else {
        // Десктоп путь: один ZIP-архив
        setSaveProgress("Упаковываем в архив...");
        const zip = new JSZip();
        for(const {c,i} of canvases){
          const dataUrl = c.toDataURL("image/png");
          const base64 = dataUrl.split(",")[1];
          zip.file(`slide-${i+1}.png`, base64, {base64: true});
        }
        setSaveProgress("Создаём ZIP...");
        const blob = await zip.generateAsync({type:"blob"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href=url; a.download="carousel.zip"; a.click();
        URL.revokeObjectURL(url);
      }
    } catch(e) { console.error(e); }
    setEditMode(em); setMoveMode(mm); setSaving(false);
  }

  const PANEL_W = Math.min(560, winW - 64);
  const sf = Math.min(1, PANEL_W / size.w);
  const dispW = Math.round(size.w * sf), dispH = Math.round(size.h * sf);

  const hasPhotoOnCurrentSlide = !!photos[current] && !INLINE_PHOTO_LAYOUTS.includes(currentLayout);

  const inp = {fontSize:14,borderRadius:10,border:"1px solid var(--color-border-tertiary)",padding:"10px 14px",background:"var(--color-input-bg)",color:"var(--color-text-primary)",outline:"none",width:"100%",boxSizing:"border-box",boxShadow:"0 1px 4px var(--color-card-shadow)"};
  const btn = {padding:"7px 13px",borderRadius:9,border:"1px solid var(--color-border-tertiary)",background:"var(--color-card-bg)",cursor:"pointer",fontSize:13,color:"var(--color-text-primary)",boxShadow:"0 1px 4px var(--color-card-shadow)"};

  // ── Swipe handlers ──
  const onTouchStart = (e) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };
  const onTouchEnd = (e) => {
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    const dt = Date.now() - touchStart.current.t;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 500) {
      if (dx < 0 && current < slides.length - 1) setCurrent(c => c + 1);
      if (dx > 0 && current > 0) setCurrent(c => c - 1);
    }
  };

  const setCurrentPhotoPlacement = (kind: "after" | "before", patch: Partial<typeof DEFAULT_PHOTO_TRANSFORM>) => {
    const setter = kind === "before" ? setBeforePhotoTransforms : setPhotoTransforms;
    setter((prev) => ({
      ...prev,
      [current]: {
        ...DEFAULT_PHOTO_TRANSFORM,
        ...(prev[current] || {}),
        ...patch,
      },
    }));
  };

  const resetCurrentPhotoPlacement = (kind: "after" | "before") => {
    setCurrentPhotoPlacement(kind, DEFAULT_PHOTO_TRANSFORM);
  };

  const currentPhotoPanels =
    currentLayout === "before_after"
      ? [
          beforePhotos[current]
            ? { key: "before" as const, label: "Фото ДО", transform: currentBeforePhotoTransform }
            : null,
          photos[current]
            ? { key: "after" as const, label: "Фото ПОСЛЕ", transform: currentPhotoTransform }
            : null,
        ].filter(Boolean)
      : (currentInlinePhotoLayout && photos[current])
        ? [{ key: "after" as const, label: "Фото в шаблоне", transform: currentPhotoTransform }]
        : [];

  const voicePanelField = voiceActiveField ?? voicePreparingField;
  const voiceTopicBusy =
    (voiceMicPreparing || voiceActiveField === "topic") && voicePanelField === "topic";
  const voiceNotesBusy =
    (voiceMicPreparing || voiceActiveField === "notes") && voicePanelField === "notes";

  return (
    <div style={{fontFamily:"var(--font-sans)",maxWidth:600,padding:"0.5rem 0"}}>
      <style>{`
        @keyframes voiceBarPulse { 0%,100%{opacity:.45;filter:brightness(.95)} 50%{opacity:1;filter:brightness(1.15)} }
        @keyframes voiceTextStream { from{opacity:.35;transform:translateY(3px)} to{opacity:1;transform:translateY(0)} }
        @keyframes voiceMicSpin { to { transform: rotate(360deg) } }
      `}</style>
      {/* Saving overlay */}
      {saving && (
        <div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,.7)",backdropFilter:"blur(6px)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:20}}>
          <div style={{width:56,height:56,border:"4px solid rgba(255,255,255,.15)",borderTop:"4px solid #E11D48",borderRadius:"50%",animation:"spin 1s linear infinite"}}/>
          <div style={{fontSize:20,fontWeight:700,color:"#fff",textAlign:"center",fontFamily:"var(--font-sans)"}}>Мы сохраняем Ваш шедевр ✨</div>
          <div style={{fontSize:14,color:"rgba(255,255,255,.7)",textAlign:"center"}}>{saveProgress}</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}

      {/* ── Step navigation (segmented control) ── */}
      <div style={{
        display:"flex", gap:4, marginBottom:14, padding:4,
        background:"var(--color-section-bg)",
        border:"1px solid var(--color-border-tertiary)",
        borderRadius:12,
      }}>
        {([[1,"Контент"],[2,"Дизайн"]] as const).map(([s,label])=>{
          const active = setupStep===s;
          return (
            <button
              key={s}
              onClick={()=>setSetupStep(s as 1|2)}
              style={{
                flex:1, padding:"10px 14px", borderRadius:9, border:"none",
                cursor:"pointer", fontSize:13, fontWeight:700, fontFamily:"inherit",
                background: active ? "linear-gradient(135deg,#E11D48 0%,#2563EB 60%,#0F2044 100%)" : "transparent",
                color: active ? "#fff" : "var(--color-text-secondary)",
                boxShadow: active ? "0 2px 10px rgba(225,29,72,0.25)" : "none",
                display:"flex", alignItems:"center", justifyContent:"center", gap:7,
                transition:"all .2s",
                letterSpacing:-0.2,
              }}
            >
              <span style={{
                display:"inline-flex", alignItems:"center", justifyContent:"center",
                width:20, height:20, borderRadius:"50%", fontSize:11, fontWeight:800,
                background: active ? "rgba(255,255,255,0.25)" : "var(--color-border-tertiary)",
                color: active ? "#fff" : "var(--color-text-secondary)",
              }}>{s}</span>
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Collapsible settings ── */}
      {setupStep===1 && <Section title="Этап 1: Контент" defaultOpen>
        <div style={{display:"grid",gap:12}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,padding:4,background:"var(--color-card-bg)",border:"1px solid var(--color-border-tertiary)",borderRadius:10}}>
            <button
              onClick={()=>setComposeMode("ai")}
              style={{
                padding:"9px 12px", borderRadius:7, border:"none", cursor:"pointer",
                fontSize:13, fontWeight:700, fontFamily:"inherit",
                background: composeMode==="ai" ? `${T.accent}18` : "transparent",
                color: composeMode==="ai" ? T.accent : "var(--color-text-secondary)",
                display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                transition:"all .15s",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2l2 6.5H21l-5.5 4 2 6.5L12 15l-5.5 4 2-6.5L3 8.5h7z"/>
              </svg>
              Через ИИ
            </button>
            <button
              onClick={()=>setComposeMode("manual")}
              style={{
                padding:"9px 12px", borderRadius:7, border:"none", cursor:"pointer",
                fontSize:13, fontWeight:700, fontFamily:"inherit",
                background: composeMode==="manual" ? `${T.accent}18` : "transparent",
                color: composeMode==="manual" ? T.accent : "var(--color-text-secondary)",
                display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                transition:"all .15s",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
              Вручную
            </button>
          </div>
        <div style={{position:"relative"}}>
          <textarea
            value={appendVoiceLive(topic, voiceActiveField === "topic" ? voiceInterimText : "")}
            onChange={e=>setTopic(e.target.value)}
            readOnly={voiceActiveField === "topic"}
            rows={3}
            placeholder="Тема карусели — например: «5 советов детского врача»"
            title={voiceActiveField === "topic" ? "Остановите запись микрофона, чтобы редактировать текст вручную" : undefined}
            style={{
              ...inp,
              resize:"vertical",
              lineHeight:1.6,
              fontSize:15,
              padding:"14px 52px 14px 16px",
              width:"100%",
              boxSizing:"border-box",
              transition:"box-shadow .2s, border-color .2s",
              boxShadow: voiceTopicBusy ? `0 0 0 2px ${T.accent}40, 0 4px 20px ${T.accent}18` : undefined,
              borderColor: voiceTopicBusy ? T.accent : undefined,
            }}
            aria-label="Тема карусели"
          />
          <button
            type="button"
            aria-pressed={voiceActiveField === "topic"}
            aria-label={voiceActiveField === "topic" ? "Остановить голосовой ввод" : "Голосовой ввод в поле темы"}
            title={
              !speechSupported
                ? "Голосовой ввод: Chrome, Edge или Safari"
                : voiceMicPreparing && voicePreparingField === "topic"
                  ? "Подключаем микрофон…"
                  : voiceActiveField === "topic"
                    ? "Остановить запись"
                    : "Нажмите и говорите — текст появится в поле"
            }
            disabled={!speechSupported || (voiceMicPreparing && voicePreparingField === "topic")}
            onClick={()=>toggleVoiceInput("topic")}
            style={{
              position:"absolute", right:10, top:10,
              width:36, height:36, borderRadius:8,
              border:`1px solid ${voiceActiveField === "topic" || voiceTopicBusy ? T.accent : "var(--color-border-tertiary)"}`,
              background: voiceActiveField === "topic" || voiceTopicBusy ? `${T.accent}24` : "var(--color-card-bg)",
              color: voiceActiveField === "topic" || voiceTopicBusy ? T.accent : "var(--color-text-secondary)",
              cursor: speechSupported && !(voiceMicPreparing && voicePreparingField === "topic") ? "pointer" : "not-allowed",
              display:"flex", alignItems:"center", justifyContent:"center",
              opacity: speechSupported ? 1 : 0.45,
              transition:"border-color .15s, background .15s, color .15s",
              flexShrink:0,
            }}
          >
            {voiceMicPreparing && voicePreparingField === "topic" ? (
              <span
                style={{
                  width:18,
                  height:18,
                  border:"2px solid rgba(0,0,0,.12)",
                  borderTop:`2px solid ${T.accent}`,
                  borderRadius:"50%",
                  animation:"voiceMicSpin .7s linear infinite",
                }}
                aria-hidden
              />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            )}
          </button>
        </div>
        {voiceTopicBusy && (
          <div
            role="status"
            aria-live="polite"
            style={{
              display:"flex",
              flexDirection:"column",
              gap:10,
              padding:"12px 14px",
              borderRadius:12,
              border:`1px solid ${T.accent}35`,
              background:`linear-gradient(135deg, ${T.accent}12 0%, var(--color-card-bg) 100%)`,
              animation:"voiceTextStream .35s ease-out",
            }}
          >
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
              <span style={{fontSize:12,fontWeight:800,letterSpacing:0.6,textTransform:"uppercase",color:T.accent}}>
                {voiceMicPreparing ? "Микрофон" : "Запись"}
              </span>
              <span style={{fontSize:12,color:"var(--color-text-secondary)",fontWeight:600}}>
                {voiceMicPreparing ? "Подключаем…" : "Говорите — текст появляется ниже"}
              </span>
            </div>
            <div style={{display:"flex",alignItems:"flex-end",justifyContent:"center",gap:4,height:40,padding:"0 8px"}}>
              {(voiceMeterBars.length > 0 ? voiceMeterBars : [0.08, 0.12, 0.18, 0.22, 0.18, 0.12, 0.08, 0.06]).map((h, i) => (
                <div
                  key={i}
                  style={{
                    width:6,
                    height: Math.max(6, 6 + h * 32),
                    borderRadius:3,
                    background: `linear-gradient(180deg, ${T.accent} 0%, ${T.accent}99 100%)`,
                    animation: voiceMicPreparing ? "none" : `voiceBarPulse ${0.55 + i * 0.06}s ease-in-out infinite`,
                    animationDelay: `${i * 0.04}s`,
                    transition:"height .08s ease-out",
                  }}
                />
              ))}
            </div>
            {voiceInterimText.trim() && voiceActiveField === "topic" && (
              <div
                style={{
                  fontSize:14,
                  lineHeight:1.45,
                  color:"var(--color-text-primary)",
                  fontWeight:600,
                  padding:"8px 10px",
                  borderRadius:8,
                  background:"var(--color-input-bg)",
                  border:"1px dashed var(--color-border-secondary)",
                  animation:"voiceTextStream .4s ease-out",
                }}
              >
                <span style={{fontSize:11,fontWeight:800,color:T.accent,textTransform:"uppercase",display:"block",marginBottom:4}}>
                  Распознаётся
                </span>
                {voiceInterimText}
              </div>
            )}
          </div>
        )}
        {!showContentNotes ? (
          <button
            onClick={()=>setShowContentNotes(true)}
            style={{
              padding:"9px 14px", borderRadius:9, fontSize:13, fontWeight:600,
              border:"1px dashed var(--color-border-secondary)",
              background:"transparent", color:"var(--color-text-secondary)",
              cursor:"pointer", alignSelf:"start", fontFamily:"inherit",
              display:"flex", alignItems:"center", gap:6, transition:"all .15s",
            }}
            onMouseOver={e=>{(e.currentTarget as HTMLElement).style.borderColor=T.accent;(e.currentTarget as HTMLElement).style.color=T.accent;}}
            onMouseOut={e=>{(e.currentTarget as HTMLElement).style.borderColor="var(--color-border-secondary)";(e.currentTarget as HTMLElement).style.color="var(--color-text-secondary)";}}
          >
            <span style={{fontSize:15,lineHeight:1,fontWeight:700}}>+</span>
            Добавить дополнительное описание
          </button>
        ) : (
          <div style={{display:"grid",gap:8}}>
            <div style={{position:"relative"}}>
              <textarea
                value={appendVoiceLive(contentNotes, voiceActiveField === "notes" ? voiceInterimText : "")}
                onChange={e=>setContentNotes(e.target.value)}
                readOnly={voiceActiveField === "notes"}
                rows={2}
                placeholder="Дополнительное описание — например: «Пиши с точки зрения врача», «Сделай стиль деловым», «Подчеркни экспертность и практическую пользу»"
                title={voiceActiveField === "notes" ? "Остановите запись микрофона, чтобы редактировать текст вручную" : undefined}
                style={{
                  ...inp,
                  resize:"vertical",
                  lineHeight:1.6,
                  fontSize:14,
                  padding:"12px 52px 12px 14px",
                  width:"100%",
                  boxSizing:"border-box",
                  transition:"box-shadow .2s, border-color .2s",
                  boxShadow: voiceNotesBusy ? `0 0 0 2px ${T.accent}40, 0 4px 20px ${T.accent}18` : undefined,
                  borderColor: voiceNotesBusy ? T.accent : undefined,
                }}
                aria-label="Дополнительное описание"
              />
              <button
                type="button"
                aria-pressed={voiceActiveField === "notes"}
                aria-label={voiceActiveField === "notes" ? "Остановить голосовой ввод" : "Голосовой ввод в дополнительное описание"}
                title={
                  !speechSupported
                    ? "Голосовой ввод: Chrome, Edge или Safari"
                    : voiceMicPreparing && voicePreparingField === "notes"
                      ? "Подключаем микрофон…"
                      : voiceActiveField === "notes"
                        ? "Остановить запись"
                        : "Нажмите и говорите — текст появится в поле"
                }
                disabled={!speechSupported || (voiceMicPreparing && voicePreparingField === "notes")}
                onClick={()=>toggleVoiceInput("notes")}
                style={{
                  position:"absolute", right:8, top:8,
                  width:34, height:34, borderRadius:8,
                  border:`1px solid ${voiceActiveField === "notes" || voiceNotesBusy ? T.accent : "var(--color-border-tertiary)"}`,
                  background: voiceActiveField === "notes" || voiceNotesBusy ? `${T.accent}24` : "var(--color-card-bg)",
                  color: voiceActiveField === "notes" || voiceNotesBusy ? T.accent : "var(--color-text-secondary)",
                  cursor: speechSupported && !(voiceMicPreparing && voicePreparingField === "notes") ? "pointer" : "not-allowed",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  opacity: speechSupported ? 1 : 0.45,
                  transition:"border-color .15s, background .15s, color .15s",
                  flexShrink:0,
                }}
              >
                {voiceMicPreparing && voicePreparingField === "notes" ? (
                  <span
                    style={{
                      width:14,
                      height:14,
                      border:"2px solid rgba(0,0,0,.12)",
                      borderTop:`2px solid ${T.accent}`,
                      borderRadius:"50%",
                      animation:"voiceMicSpin .7s linear infinite",
                    }}
                    aria-hidden
                  />
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/>
                    <line x1="8" y1="23" x2="16" y2="23"/>
                  </svg>
                )}
              </button>
            </div>
            {voiceNotesBusy && (
              <div
                role="status"
                aria-live="polite"
                style={{
                  display:"flex",
                  flexDirection:"column",
                  gap:10,
                  padding:"12px 14px",
                  borderRadius:12,
                  border:`1px solid ${T.accent}35`,
                  background:`linear-gradient(135deg, ${T.accent}12 0%, var(--color-card-bg) 100%)`,
                  animation:"voiceTextStream .35s ease-out",
                }}
              >
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
                  <span style={{fontSize:12,fontWeight:800,letterSpacing:0.6,textTransform:"uppercase",color:T.accent}}>
                    {voiceMicPreparing ? "Микрофон" : "Запись"}
                  </span>
                  <span style={{fontSize:12,color:"var(--color-text-secondary)",fontWeight:600}}>
                    {voiceMicPreparing ? "Подключаем…" : "Говорите — текст появляется ниже"}
                  </span>
                </div>
                <div style={{display:"flex",alignItems:"flex-end",justifyContent:"center",gap:4,height:40,padding:"0 8px"}}>
                  {(voiceMeterBars.length > 0 ? voiceMeterBars : [0.08, 0.12, 0.18, 0.22, 0.18, 0.12, 0.08, 0.06]).map((h, i) => (
                    <div
                      key={i}
                      style={{
                        width:6,
                        height: Math.max(6, 6 + h * 32),
                        borderRadius:3,
                        background: `linear-gradient(180deg, ${T.accent} 0%, ${T.accent}99 100%)`,
                        animation: voiceMicPreparing ? "none" : `voiceBarPulse ${0.55 + i * 0.06}s ease-in-out infinite`,
                        animationDelay: `${i * 0.04}s`,
                        transition:"height .08s ease-out",
                      }}
                    />
                  ))}
                </div>
                {voiceInterimText.trim() && voiceActiveField === "notes" && (
                  <div
                    style={{
                      fontSize:14,
                      lineHeight:1.45,
                      color:"var(--color-text-primary)",
                      fontWeight:600,
                      padding:"8px 10px",
                      borderRadius:8,
                      background:"var(--color-input-bg)",
                      border:"1px dashed var(--color-border-secondary)",
                      animation:"voiceTextStream .4s ease-out",
                    }}
                  >
                    <span style={{fontSize:11,fontWeight:800,color:T.accent,textTransform:"uppercase",display:"block",marginBottom:4}}>
                      Распознаётся
                    </span>
                    {voiceInterimText}
                  </div>
                )}
              </div>
            )}
            <button
              onClick={()=>{
                setShowContentNotes(false);
                setContentNotes("");
              }}
              style={{
                padding:"7px 12px", borderRadius:8, fontSize:12, fontWeight:600,
                border:"1px solid var(--color-border-tertiary)",
                background:"var(--color-card-bg)", color:"var(--color-text-secondary)",
                cursor:"pointer", justifySelf:"start", fontFamily:"inherit",
              }}
            >
              × Убрать описание
            </button>
          </div>
        )}

        <div style={{display:"flex",gap:8}}>
          <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="@username" style={{...inp,flex:1,padding:"11px 14px"}}/>
          <div style={{display:"flex",alignItems:"center",gap:4,background:"var(--color-card-bg)",border:"1px solid var(--color-border-tertiary)",borderRadius:10,padding:"4px 6px",flexShrink:0}}>
            <span style={{fontSize:12,color:"var(--color-text-secondary)",whiteSpace:"nowrap",fontWeight:600,padding:"0 6px 0 4px"}}>Слайдов</span>
            <button
              onClick={()=>setSlideCount(v=>Math.max(3, v-1))}
              disabled={slideCount<=3}
              style={{
                width:28, height:28, borderRadius:7, border:"none",
                background: slideCount<=3 ? "transparent" : "var(--color-section-bg)",
                color: slideCount<=3 ? "var(--color-text-secondary)" : "var(--color-text-primary)",
                fontSize:16, fontWeight:700, cursor: slideCount<=3 ? "default" : "pointer",
                opacity: slideCount<=3 ? 0.4 : 1, fontFamily:"inherit",
                display:"flex", alignItems:"center", justifyContent:"center",
                transition:"all .15s",
              }}
            >−</button>
            <span style={{fontSize:14,fontWeight:800,minWidth:22,textAlign:"center",color:"var(--color-text-primary)"}}>{slideCount}</span>
            <button
              onClick={()=>setSlideCount(v=>Math.min(isPro ? 20 : FREE_MAX_SLIDES, v+1))}
              disabled={slideCount>=(isPro ? 20 : FREE_MAX_SLIDES)}
              style={{
                width:28, height:28, borderRadius:7, border:"none",
                background: slideCount>=(isPro ? 20 : FREE_MAX_SLIDES) ? "transparent" : "var(--color-section-bg)",
                color: slideCount>=(isPro ? 20 : FREE_MAX_SLIDES) ? "var(--color-text-secondary)" : "var(--color-text-primary)",
                fontSize:16, fontWeight:700, cursor: slideCount>=(isPro ? 20 : FREE_MAX_SLIDES) ? "default" : "pointer",
                opacity: slideCount>=(isPro ? 20 : FREE_MAX_SLIDES) ? 0.4 : 1, fontFamily:"inherit",
                display:"flex", alignItems:"center", justifyContent:"center",
                transition:"all .15s",
              }}
            >+</button>
          </div>
        </div>
        </div>
      </Section>}

      {setupStep===1 && composeMode==="ai" && (
        <div style={{display:"flex",gap:8,marginBottom:10}}>
          {(() => {
            const canRun = !loading && !!topic.trim();
            return (
              <button
                onClick={generateAndGoToStep2}
                disabled={!canRun}
                style={{
                  flex:1,padding:"14px",borderRadius:14,fontSize:15,fontWeight:700,
                  background: canRun ? "linear-gradient(135deg,#E11D48 0%,#2563EB 60%,#0F2044 100%)" : "var(--color-border-tertiary)",
                  color: canRun ? "#fff" : "var(--color-text-secondary)",
                  border:"none",
                  cursor:canRun?"pointer":"default",
                  fontFamily:font.css,transition:"all .25s",
                  boxShadow: canRun ? "0 6px 28px rgba(225,29,72,0.38)" : "none",
                  display:"flex",alignItems:"center",justifyContent:"center",gap:8,letterSpacing:-0.2,
                }}
              >
                {loading ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true" style={{animation:"spin 1s linear infinite"}}>
                      <path d="M21 12a9 9 0 1 1-6.22-8.56"/>
                    </svg>
                    Генерирую…
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 2l2 6.5H21l-5.5 4 2 6.5L12 15l-5.5 4 2-6.5L3 8.5h7z"/>
                    </svg>
                    Сгенерировать и перейти к Этапу 2
                  </>
                )}
              </button>
            );
          })()}
        </div>
      )}
      {setupStep===1 && composeMode==="manual" && (
        <div style={{display:"flex",gap:8,marginBottom:10}}>
          <button
            onClick={()=>{
              createManual();
              addRequestHistoryEntry({
                titleLabel: formatHistorySlideTitle("", topic.trim()),
                topic: topic.trim(),
                notes: contentNotes.trim(),
                slideCount,
                username: username.trim(),
                composeMode: "manual",
              });
              setSetupStep(2);
            }}
            style={{
              flex:1,padding:"14px",borderRadius:14,fontSize:15,fontWeight:700,
              background:"linear-gradient(135deg,#E11D48 0%,#2563EB 60%,#0F2044 100%)",
              color:"#fff", border:"none", cursor:"pointer",
              fontFamily:font.css, transition:"all .25s",
              boxShadow:"0 6px 28px rgba(225,29,72,0.38)",
              display:"flex",alignItems:"center",justifyContent:"center",gap:8,letterSpacing:-0.2,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            Создать вручную и перейти к Этапу 2
          </button>
        </div>
      )}

      {setupStep===1 && (
        <div style={{ marginTop: 14, marginBottom: 8 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: 0.8,
              textTransform: "uppercase",
              fontWeight: 800,
              color: "var(--color-text-secondary)",
              marginBottom: 8,
            }}
          >
            История запросов
          </div>
          {requestHistory.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: 0, lineHeight: 1.5 }}>
              Здесь появятся темы после генерации ИИ или перехода «вручную» к этапу 2. Нажмите на строку, чтобы подставить в форму.
            </p>
          ) : (
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: 6,
                maxHeight: 180,
                overflowY: "auto",
              }}
            >
              {requestHistory.map((h) => (
                <li key={h.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => applyRequestHistoryItem(h)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        applyRequestHistoryItem(h);
                      }
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "7px 10px",
                      borderRadius: 10,
                      border: "1px solid var(--color-border-tertiary)",
                      background: "var(--color-card-bg)",
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: "inherit",
                      transition: "border-color .15s, box-shadow .15s",
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: 13,
                        fontWeight: 700,
                        color: "var(--color-text-primary)",
                        lineHeight: 1.25,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={h.titleLabel}
                    >
                      {h.titleLabel}
                    </div>
                    <span
                      style={{
                        flexShrink: 0,
                        fontSize: 10,
                        fontWeight: 700,
                        color: "var(--color-text-secondary)",
                        letterSpacing: 0.2,
                      }}
                    >
                      {h.slideCount} · {h.composeMode === "ai" ? "ИИ" : "рук."}
                    </span>
                    <span
                      style={{
                        flexShrink: 0,
                        fontSize: 10,
                        color: "var(--color-text-secondary)",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {new Date(h.at).toLocaleString("ru-RU", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <button
                      type="button"
                      aria-label="Удалить из истории"
                      title="Удалить"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeRequestHistoryItem(h.id);
                      }}
                      style={{
                        flexShrink: 0,
                        width: 28,
                        height: 28,
                        borderRadius: 7,
                        border: "1px solid var(--color-border-tertiary)",
                        background: "var(--color-section-bg)",
                        color: "var(--color-text-secondary)",
                        cursor: "pointer",
                        fontSize: 15,
                        lineHeight: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: "inherit",
                        transition: "background .15s, color .15s",
                      }}
                    >
                      ×
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p
            style={{
              fontSize: 11,
              lineHeight: 1.45,
              color: "var(--color-text-secondary)",
              margin: "10px 0 0",
              opacity: 0.92,
            }}
          >
            Внимание: эти данные не хранятся на сервере — только в локальном кэше вашего устройства для удобства. Очистка кэша или другого браузера удалит историю.
          </p>
        </div>
      )}

      {setupStep===1 && error && <p style={{color:"var(--color-text-danger)",fontSize:13,margin:"0 0 8px"}}>{error}</p>}

      {setupStep===2 && <Section title="Этап 2: Дизайн" badge={`${LAYOUTS.find(l=>l.id===layout)?.label} · ${size.label} · ${font?.label}`}>
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div style={{
            display:"flex",gap:4,padding:4,
            background:"var(--color-section-bg)",
            border:"1px solid var(--color-border-tertiary)",
            borderRadius:11,
            overflowX:"auto",
          }}>
            {([
              ["cover","Обложка"],
              ["layout","Шаблон"],
              ["font","Шрифт"],
              ["size","Размер"],
              ["theme","Цвет"],
            ] as const).map(([id,label])=>{
              const active = designTab===id;
              return (
                <button key={id} onClick={()=>setDesignTab(id)} style={{
                  flex:"1 1 0", minWidth:60, padding:"7px 10px", borderRadius:7,
                  border:"none", cursor:"pointer", fontSize:13, fontFamily:"inherit",
                  background: active ? "var(--color-card-bg)" : "transparent",
                  color: active ? T.accent : "var(--color-text-secondary)",
                  fontWeight: active ? 700 : 600,
                  boxShadow: active ? "0 1px 4px var(--color-card-shadow)" : "none",
                  transition:"all .15s",
                  whiteSpace:"nowrap",
                }}>{label}</button>
              );
            })}
          </div>

          {/* Cover */}
          {designTab==="cover" && <div>
            <div style={{fontSize:11,letterSpacing:1.2,color:"var(--color-text-secondary)",textTransform:"uppercase",marginBottom:8}}>
              Обложка (только слайд 1)
            </div>
            <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
              {visibleCovers.map(l=>{
                const active = coverLayout===l.id;
                return <div key={`cover-${l.id}`} style={{position:"relative"}}>
                  <LayoutBtn
                    l={l}
                    T={T}
                    active={active}
                    onClick={()=>setCoverLayout(l.id)}
                  />
                </div>;
              })}
              <button
                onClick={()=>setCoverLayout("")}
                style={{...btn,padding:"6px 10px",border:"1px dashed var(--color-border-tertiary)",background:"transparent",color:"var(--color-text-secondary)"}}
              >
                ↩ Как у остальных
              </button>
            </div>
          </div>}

          {/* Layout */}
          {designTab==="layout" && <div>
            <div style={{fontSize:11,letterSpacing:1.2,color:"var(--color-text-secondary)",textTransform:"uppercase",marginBottom:8}}>Шаблон</div>
            <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>{visibleLayouts.map(l=>{
              const locked = !isPro && !FREE_LAYOUTS.includes(l.id);
              return <div key={l.id} style={{position:"relative",opacity:locked?0.4:1}}>
                <LayoutBtn
                  l={l}
                  T={T}
                  active={layout===l.id&&!locked}
                  onClick={locked
                    ? ()=>onProfile?.()
                    : ()=>{
                        setLayout(l.id);
                        setSlideLayouts({});
                      }}
                />
                {locked&&<span style={{position:"absolute",top:-5,right:-5,fontSize:7,fontWeight:800,background:"linear-gradient(135deg,#E11D48,#2563EB)",color:"#fff",padding:"1px 4px",borderRadius:5,cursor:"pointer",zIndex:1}}>PRO</span>}
              </div>;
            })}</div>
          </div>}

          {/* Font */}
          {designTab==="font" && <div>
            <div style={{fontSize:11,letterSpacing:1.2,color:"var(--color-text-secondary)",textTransform:"uppercase",marginBottom:8}}>Шрифт</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {visibleFonts.map(f=>{
                const locked = !isPro && !FREE_FONTS.includes(f.id);
                return <button key={f.id} onClick={()=>locked ? onProfile?.() : setFontId(f.id)} style={{...btn,fontFamily:f.css,border:`${fontId===f.id&&!locked?"2px":"1px"} solid ${fontId===f.id&&!locked?T.accent:"var(--color-border-tertiary)"}`,fontWeight:fontId===f.id&&!locked?700:400,fontSize:13,opacity:locked?0.4:1,position:"relative"}}>{f.label}{locked&&<span style={{position:"absolute",top:-6,right:-6,fontSize:7,fontWeight:800,background:"linear-gradient(135deg,#E11D48,#2563EB)",color:"#fff",padding:"1px 4px",borderRadius:5}}>PRO</span>}</button>;
              })}
            </div>
          </div>}

          {/* Size */}
          {designTab==="size" && <div>
            <div style={{fontSize:11,letterSpacing:1.2,color:"var(--color-text-secondary)",textTransform:"uppercase",marginBottom:8}}>Размер</div>
            <div style={{display:"flex",gap:8}}>
              {visibleSizes.map(s=>{
                const locked = !isPro && !FREE_SIZES.includes(s.id);
                return <button key={s.id} onClick={()=>locked ? onProfile?.() : setSizeId(s.id)} style={{...btn,flex:1,justifyContent:"center",border:`${sizeId===s.id&&!locked?"2px":"1px"} solid ${sizeId===s.id&&!locked?T.accent:"var(--color-border-tertiary)"}`,fontWeight:sizeId===s.id&&!locked?700:400,fontSize:12,opacity:locked?0.4:1,position:"relative"}}>{s.label}{locked&&<span style={{position:"absolute",top:-6,right:-6,fontSize:8,fontWeight:800,background:"linear-gradient(135deg,#E11D48,#2563EB)",color:"#fff",padding:"1px 5px",borderRadius:6}}>PRO</span>}</button>;
              })}
            </div>
          </div>}

          {/* Theme */}
          {designTab==="theme" && <div>
            <div style={{fontSize:11,letterSpacing:1.2,color:"var(--color-text-secondary)",textTransform:"uppercase",marginBottom:8}}>
              Цветовая тема — <span style={{textTransform:"none",letterSpacing:0,fontWeight:600,color:"var(--color-text-primary)"}}>{selectedTheme.label}</span>
            </div>
            <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>{visibleThemes.map(t=>{
              const locked = !isPro && !FREE_THEMES.includes(t.id);
              return <div key={t.id} style={{position:"relative",opacity:locked?0.4:1}} onClick={locked?()=>onProfile?.():undefined}>
                <ThemeDot t={t} active={themeId===t.id&&!locked} onClick={locked?()=>{}:()=>setThemeId(t.id)}/>
                {locked&&<span style={{position:"absolute",top:-5,right:-5,fontSize:7,fontWeight:800,background:"linear-gradient(135deg,#E11D48,#2563EB)",color:"#fff",padding:"1px 4px",borderRadius:5,cursor:"pointer"}}>PRO</span>}
              </div>;
            })}</div>
          </div>}
        </div>
      </Section>}

      {setupStep===2 && error && <p style={{color:"var(--color-text-danger)",fontSize:13,margin:"0 0 8px"}}>{error}</p>}

      {/* ── Editor ── */}
      {setupStep===2 && slides.length>0&&(
        <div style={{border:"1px solid var(--color-border-tertiary)",borderRadius:14,overflow:"hidden",boxShadow:"0 2px 12px var(--color-card-shadow)"}}>
          {/* Toolbar */}
          <div style={{background:"var(--color-card-bg)",padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"center",borderBottom:"1px solid var(--color-border-tertiary)"}}>
            <div style={{display:"flex",gap:10,alignItems:"center",width:"100%",maxWidth:420}}>
              <button
                onClick={()=>setCurrent(Math.max(0,current-1))}
                disabled={current===0}
                aria-label="Предыдущий слайд"
                style={{
                  width:38, height:38, flexShrink:0, borderRadius:10,
                  border:"1px solid var(--color-border-tertiary)",
                  background:"var(--color-card-bg)",
                  boxShadow:"0 1px 3px var(--color-card-shadow)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  opacity: current===0 ? 0.4 : 1,
                  cursor: current===0 ? "default" : "pointer",
                  color: current===0 ? "var(--color-text-secondary)" : "var(--color-text-primary)",
                  transition:"all .15s",
                }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>
              <div style={{flex:1, display:"flex", flexDirection:"column", gap:6, minWidth:0}}>
                <div style={{display:"flex", alignItems:"baseline", justifyContent:"center", gap:5}}>
                  <span style={{fontSize:13, fontWeight:800, color:"var(--color-text-primary)", letterSpacing:-0.2}}>
                    Слайд {current+1}
                  </span>
                  <span style={{fontSize:12, fontWeight:600, color:"var(--color-text-secondary)"}}>
                    из {slides.length}
                  </span>
                </div>
                <div style={{height:4, borderRadius:999, background:"var(--color-border-tertiary)", overflow:"hidden"}}>
                  <div style={{height:"100%", width:`${((current+1)/Math.max(slides.length,1))*100}%`, background:`linear-gradient(90deg,${T.accent},${T.accent}cc)`, transition:"width .3s ease", borderRadius:999}} />
                </div>
              </div>
              <button
                onClick={()=>setCurrent(Math.min(slides.length-1,current+1))}
                disabled={current===slides.length-1}
                aria-label="Следующий слайд"
                style={{
                  width:38, height:38, flexShrink:0, borderRadius:10,
                  border:"1px solid var(--color-border-tertiary)",
                  background:"var(--color-card-bg)",
                  boxShadow:"0 1px 3px var(--color-card-shadow)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  opacity: current===slides.length-1 ? 0.4 : 1,
                  cursor: current===slides.length-1 ? "default" : "pointer",
                  color: current===slides.length-1 ? "var(--color-text-secondary)" : "var(--color-text-primary)",
                  transition:"all .15s",
                }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={onFileChange} style={{display:"none"}}/>
            <input ref={beforeFileRef} type="file" accept="image/*" onChange={onBeforeFileChange} style={{display:"none"}}/>
            <input ref={avatarFileRef} type="file" accept="image/*" onChange={onAvatarFileChange} style={{display:"none"}}/>
          </div>

          {/* Per-slide layout picker */}
          <div style={{background:"var(--color-section-bg)",borderBottom:"1px solid var(--color-border-tertiary)",padding:"8px 14px",display:"flex",alignItems:"center",gap:8,flexWrap:"nowrap",overflowX:"auto"}}>
            <span style={{
              fontSize:11, fontWeight:700, letterSpacing:0.3, flexShrink:0,
              padding:"3px 8px", borderRadius:6,
              background:`${T.accent}14`, color:T.accent,
              whiteSpace:"nowrap",
            }}>
              Слайд {current+1}
            </span>
            {visibleLayouts.map(l=>{
              const active = resolveLayout(current)===l.id;
              const locked = !isPro && !FREE_LAYOUTS.includes(l.id);
              return (
                <div key={l.id} style={{position:"relative",opacity:locked?0.4:1}}>
                  <LayoutBtn l={l} T={T} active={active&&!locked} onClick={()=>{ if(locked){onProfile?.();return;} setSlideLayouts(p=>({...p,[current]:l.id})); }} />
                  {locked&&<span style={{position:"absolute",top:-5,right:-5,fontSize:7,fontWeight:800,background:"linear-gradient(135deg,#E11D48,#2563EB)",color:"#fff",padding:"1px 4px",borderRadius:5}}>PRO</span>}
                </div>
              );
            })}
            {slideLayouts[current]&&(
              <button onClick={()=>setSlideLayouts(p=>{const n={...p};delete n[current];return n;})} title="Сбросить к общему шаблону" style={{
                padding:"4px 9px",borderRadius:7,fontSize:11,flexShrink:0,cursor:"pointer",
                border:"1px dashed var(--color-border-tertiary)",background:"transparent",
                color:"var(--color-text-secondary)",whiteSpace:"nowrap" as const,
              }}>↩ Сброс</button>
            )}
          </div>

          {/* Text colour picker — shown only when photo is full-bg */}
          {hasPhotoOnCurrentSlide&&(
            <div style={{background:"var(--color-section-bg)",padding:"8px 14px",borderBottom:"1px solid var(--color-border-tertiary)",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
              <span style={{fontSize:11,letterSpacing:1,textTransform:"uppercase",color:"var(--color-text-secondary)",flexShrink:0}}>Цвет текста</span>
              {TEXT_PRESETS.map(p=>(
                <button key={p.id} onClick={()=>setTextPreset(p.id)} title={p.label} style={{
                  display:"flex",alignItems:"center",gap:6,padding:"4px 10px",borderRadius:20,fontSize:12,cursor:"pointer",
                  border:`${textPreset===p.id?"2px":"1px"} solid ${textPreset===p.id?p.accent:"var(--color-border-tertiary)"}`,
                  background:"var(--color-background-primary)",color:"var(--color-text-primary)",fontWeight:textPreset===p.id?700:400,
                }}>
                  <span style={{width:10,height:10,borderRadius:"50%",background:p.accent,flexShrink:0,border:"1px solid rgba(0,0,0,.1)"}}/>
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {/* Slide viewer */}
          <div style={{background:"var(--color-section-bg)",padding:16}} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            <div style={{width:dispW,height:dispH,overflow:"hidden",borderRadius:10,border:`1px solid ${T.border}`,position:"relative",touchAction:"pan-y"}}>
              <div style={{display:"flex",width:slides.length*size.w,height:size.h,transform:`scale(${sf}) translateX(-${current*size.w}px)`,transformOrigin:"top left",transition:"transform .35s cubic-bezier(.4,0,.2,1)"}}>
                {slides.map((slide,i)=>(
                  <div key={i} ref={el=>slideRefs.current[i]=el} style={{width:size.w,height:size.h,flexShrink:0}}>
                    <Slide slide={slide} T={T} layout={resolveLayout(i)} idx={i} seqIdx={hasCoverSlide ? Math.max(1, i) : (i + 1)} total={slides.length} photo={photos[i]} beforePhoto={beforePhotos[i]} avatarPhoto={avatarPhotos[i]} username={displayUsername} ff={font.css} w={size.w} h={size.h} moveMode={moveMode&&i===current} onEdit={(f,v)=>editSlide(i,f,v)} textPreset={textPreset} textOffset={textOffsets[i]} textScale={textScales[i]} onDragOffset={moveMode&&i===current?((field,o)=>setTextOffsets(p=>({...p,[i]:{...(p[i]||{}),[field]:o}}))):undefined} dragAxis={textMoveAxes[i] || "y"} photoTransform={photoTransforms[i]} beforePhotoTransform={beforePhotoTransforms[i]} igMode={igMode} textPositionPreset={textPositionPresets[i]} editMode={editMode}/>
                  </div>
                ))}
              </div>
            </div>
            {/* Dots */}
            <div style={{display:"flex",gap:6,marginTop:12,alignItems:"center"}}>
              {slides.map((_,i)=>(
                <button key={i} onClick={()=>setCurrent(i)} style={{width:i===current?24:8,height:8,borderRadius:4,padding:0,border:"none",background:i===current?T.accent:"var(--color-border-tertiary)",cursor:"pointer",transition:"all .25s",position:"relative"}}>
                  {photos[i]&&<span style={{position:"absolute",top:-3,right:-3,width:7,height:7,borderRadius:"50%",background:T.accent,border:"1.5px solid var(--color-background-primary)"}}/>}
                </button>
              ))}
              {editMode&&(
                <span style={{marginLeft:8,fontSize:12,color:T.accent,fontWeight:600,display:"inline-flex",alignItems:"center",gap:5}}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                  </svg>
                  Редактор текста открыт ниже
                </span>
              )}
              {moveMode&&(
                <span style={{marginLeft:8,fontSize:12,color:T.accent,fontWeight:600,display:"inline-flex",alignItems:"center",gap:5}}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/>
                  </svg>
                  Положение текста и фото — ниже
                </span>
              )}
            </div>

            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:8,marginTop:12}}>
              <button onClick={()=>{
                setEditMode(v=>!v);
                setMoveMode(false);
              }} style={{
                ...btn,padding:"10px 12px",
                border:`1px solid ${editMode?T.accent:"var(--color-border-tertiary)"}`,
                background:editMode?`${T.accent}14`:"var(--color-card-bg)",
                color:editMode?T.accent:"var(--color-text-primary)",
                fontWeight:editMode?700:600,
                display:"flex",alignItems:"center",justifyContent:"center",gap:7,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
                Редактировать текст
              </button>
              <button onClick={()=>{
                setMoveMode(v=>!v);
                setEditMode(false);
              }} style={{
                ...btn,padding:"10px 12px",
                border:`1px solid ${moveMode?T.accent:"var(--color-border-tertiary)"}`,
                background:moveMode?`${T.accent}14`:"var(--color-card-bg)",
                color:moveMode?T.accent:"var(--color-text-primary)",
                fontWeight:moveMode?700:600,
                display:"flex",alignItems:"center",justifyContent:"center",gap:7,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/>
                </svg>
                Редактировать положения
              </button>
              <button onClick={addSlide} style={{
                ...btn,padding:"10px 12px",fontWeight:600,
                display:"flex",alignItems:"center",justifyContent:"center",gap:7,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Добавить слайд
              </button>
              <button onClick={removeSlide} disabled={slides.length<=1} style={{
                ...btn,padding:"10px 12px",fontWeight:600,
                opacity:slides.length<=1?0.4:1,
                cursor:slides.length<=1?"default":"pointer",
                color:slides.length<=1?"var(--color-text-secondary)":"var(--color-text-danger)",
                borderColor:slides.length<=1?"var(--color-border-tertiary)":"rgba(225,29,72,0.25)",
                display:"flex",alignItems:"center",justifyContent:"center",gap:7,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
                </svg>
                Удалить слайд
              </button>
              <button
                onClick={()=>{
                  if (currentLayout==="before_after") {
                    const src = photos[current] || beforePhotos[current];
                    if (!src) return;
                    setPhotoEditor({ src, kind: photos[current] ? "after" : "before", slide: current });
                    return;
                  }
                  if (!photos[current]) return;
                  setPhotoEditor({ src: photos[current], kind:"after", slide: current });
                }}
                disabled={currentLayout==="before_after" ? !(photos[current] || beforePhotos[current]) : !photos[current]}
                style={{
                  ...btn,padding:"10px 12px",fontWeight:600,
                  opacity:(currentLayout==="before_after" ? !(photos[current] || beforePhotos[current]) : !photos[current]) ? 0.45 : 1,
                  cursor:(currentLayout==="before_after" ? !(photos[current] || beforePhotos[current]) : !photos[current]) ? "default" : "pointer",
                  display:"flex",alignItems:"center",justifyContent:"center",gap:7,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                </svg>
                Редактировать фото
              </button>
              {currentLayout==="before_after" ? (
                <>
                  <button onClick={()=>beforeFileRef.current?.click()} style={{
                    ...btn,padding:"10px 12px",fontWeight:600,
                    display:"flex",alignItems:"center",justifyContent:"center",gap:7,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                    </svg>
                    Добавить фото ДО
                  </button>
                  <button onClick={()=>fileRef.current?.click()} style={{
                    ...btn,padding:"10px 12px",fontWeight:600,
                    display:"flex",alignItems:"center",justifyContent:"center",gap:7,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                    </svg>
                    Добавить фото ПОСЛЕ
                  </button>
                </>
              ) : currentLayout==="cover_doc_network" ? (
                <>
                  <button onClick={()=>fileRef.current?.click()} style={{
                    ...btn,padding:"10px 12px",fontWeight:600,
                    display:"flex",alignItems:"center",justifyContent:"center",gap:7,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                    </svg>
                    Фото в круге (обложка)
                  </button>
                  <button onClick={()=>avatarFileRef.current?.click()} style={{
                    ...btn,padding:"10px 12px",fontWeight:600,
                    display:"flex",alignItems:"center",justifyContent:"center",gap:7,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="8" r="4"/><path d="M4 20v-1a8 8 0 0 1 16 0v1"/>
                    </svg>
                    Фото лица (аватар)
                  </button>
                  {avatarPhotos[current] && (
                    <button
                      onClick={()=>setAvatarPhotos((p)=>{const n={...p};delete n[current];return n;})}
                      style={{
                        ...btn,padding:"10px 12px",fontWeight:600,
                        color:"var(--color-text-danger)",
                        borderColor:"rgba(225,29,72,0.25)",
                        display:"flex",alignItems:"center",justifyContent:"center",gap:7,
                      }}
                    >
                      Убрать аватар
                    </button>
                  )}
                </>
              ) : (
                <button onClick={()=>fileRef.current?.click()} style={{
                  ...btn,padding:"10px 12px",fontWeight:600,
                  display:"flex",alignItems:"center",justifyContent:"center",gap:7,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                  </svg>
                  Добавить фото
                </button>
              )}
            </div>

            {editMode && (
              <div style={{marginTop:10,border:"1px solid var(--color-border-tertiary)",borderRadius:12,padding:10,background:"var(--color-card-bg)",display:"grid",gap:8}}>
                <div style={{fontSize:12,color:"var(--color-text-secondary)"}}>Редактор текста слайда {current+1}. Для выделения выберите фрагмент и нажмите `* Выделить`.</div>
                {currentLayoutIsPhoto && (
                  <div style={{fontSize:12,color:"var(--color-text-secondary)"}}>
                    В шаблоне `Фото` заголовок и tag не показываются. Ниже редактируется только текст под изображением.
                  </div>
                )}
                <div style={{display:"grid",gap:6}}>
                  <div style={{fontSize:12,color:"var(--color-text-secondary)"}}>
                    Положение текста. Быстрые кнопки меняют выравнивание и ширину поля для заголовка и основного текста.
                  </div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {TEXT_POSITION_PRESETS.map((p) => {
                      const active = currentTextPositionPreset === p.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => {
                            setTextPositionPresets((prev) => ({ ...prev, [current]: p.id }));
                            setTextOffsets((prev) => ({
                              ...prev,
                              [current]: {
                                ...(prev[current] || {}),
                                title: { x: 0, y: (prev[current]?.title?.y || 0) as number },
                                body: { x: 0, y: (prev[current]?.body?.y || 0) as number },
                              },
                            }));
                          }}
                          style={{
                            ...btn,
                            padding:"6px 10px",
                            fontSize:12,
                            border:`1px solid ${active ? T.accent : "var(--color-border-tertiary)"}`,
                            background:active ? `${T.accent}14` : "var(--color-card-bg)",
                            color:active ? T.accent : "var(--color-text-primary)",
                            fontWeight:active ? 700 : 500,
                          }}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {!currentLayoutIsPhoto && (
                  <div style={{display:"grid",gridTemplateColumns:"auto 1fr auto",gap:8,alignItems:"center"}}>
                    <span style={{fontSize:12,color:"var(--color-text-secondary)"}}>Размер заголовка</span>
                    <input
                      type="range"
                      min={0.7}
                      max={1.8}
                      step={0.05}
                      value={(textScales[current]?.title || 1) as number}
                      onChange={e=>setTextScales(p=>({...p,[current]:{...(p[current]||{}),title:+e.target.value}}))}
                    />
                    <span style={{fontSize:12,fontWeight:700,minWidth:44,textAlign:"right"}}>{Math.round(((textScales[current]?.title || 1) as number)*100)}%</span>
                  </div>
                )}
                {!currentLayoutIsPhoto && (
                  <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8}}>
                    <textarea
                      ref={el=>{ textEditorRefs.current.title = el; }}
                      rows={2}
                      value={(slides[current]?.title || "") as string}
                      onChange={e=>editSlide(current,"title",e.target.value)}
                      placeholder="Заголовок"
                      style={{...inp,resize:"vertical",lineHeight:1.4}}
                    />
                    <button onClick={()=>wrapSelectedInField("title")} style={{...btn,whiteSpace:"nowrap",alignSelf:"start"}}>* Выделить</button>
                  </div>
                )}
                <div style={{display:"grid",gridTemplateColumns:"auto 1fr auto",gap:8,alignItems:"center"}}>
                  <span style={{fontSize:12,color:"var(--color-text-secondary)"}}>
                    {currentLayoutIsPhoto ? "Размер текста под фото" : "Размер текста"}
                  </span>
                  <input
                    type="range"
                    min={0.7}
                    max={1.8}
                    step={0.05}
                    value={(textScales[current]?.body || 1) as number}
                    onChange={e=>setTextScales(p=>({...p,[current]:{...(p[current]||{}),body:+e.target.value}}))}
                  />
                  <span style={{fontSize:12,fontWeight:700,minWidth:44,textAlign:"right"}}>{Math.round(((textScales[current]?.body || 1) as number)*100)}%</span>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8}}>
                  <textarea
                    ref={el=>{ textEditorRefs.current.body = el; }}
                    rows={5}
                    value={(slides[current]?.body || "") as string}
                    onChange={e=>editSlide(current,"body",e.target.value)}
                    placeholder={currentLayoutIsPhoto ? "Текст под фото" : "Основной текст"}
                    style={{...inp,resize:"vertical",lineHeight:1.5}}
                  />
                  <button onClick={()=>wrapSelectedInField("body")} style={{...btn,whiteSpace:"nowrap",alignSelf:"start"}}>* Выделить</button>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8}}>
                  <textarea
                    ref={el=>{ textEditorRefs.current.cta = el; }}
                    rows={2}
                    value={(slides[current]?.cta || "") as string}
                    onChange={e=>editSlide(current,"cta",e.target.value)}
                    placeholder="CTA (можно оставить пустым)"
                    style={{...inp,resize:"vertical",lineHeight:1.4}}
                  />
                  <button onClick={()=>wrapSelectedInField("cta")} style={{...btn,whiteSpace:"nowrap",alignSelf:"start"}}>* Выделить</button>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"auto 1fr auto",gap:8,alignItems:"center"}}>
                  <span style={{fontSize:12,color:"var(--color-text-secondary)"}}>Размер CTA</span>
                  <input
                    type="range"
                    min={0.7}
                    max={1.8}
                    step={0.05}
                    value={(textScales[current]?.cta || 1) as number}
                    onChange={e=>setTextScales(p=>({...p,[current]:{...(p[current]||{}),cta:+e.target.value}}))}
                  />
                  <span style={{fontSize:12,fontWeight:700,minWidth:44,textAlign:"right"}}>{Math.round(((textScales[current]?.cta || 1) as number)*100)}%</span>
                </div>
                {!currentLayoutIsPhoto && (
                  <input
                    value={(slides[current]?.tag || "") as string}
                    onChange={e=>editSlide(current,"tag",e.target.value)}
                    placeholder="Tag / рубрика"
                    style={{...inp,padding:"8px 10px",fontSize:13}}
                  />
                )}
                <button
                  onClick={()=>setTextScales(p=>({...p,[current]:{title:1,body:1,cta:1}}))}
                  style={{...btn,fontSize:12}}
                >
                  Сбросить размер текста (100%)
                </button>
              </div>
            )}

            {moveMode && (
              <div style={{marginTop:10,display:"grid",gap:8}}>
                {currentPhotoPanels.length > 0 && (
                  <div style={{border:"1px solid var(--color-border-tertiary)",borderRadius:12,padding:10,background:"var(--color-card-bg)",display:"grid",gap:8}}>
                    <div style={{fontSize:12,color:"var(--color-text-secondary)"}}>
                      Размер и положение фото внутри блока шаблона. Не затрагивает обрезку всего слайда при сохранении.
                    </div>
                    {currentPhotoPanels.map((panel) => (
                      <div key={panel.key} style={{display:"grid",gap:8,padding:"8px 0"}}>
                        <div style={{fontSize:12,fontWeight:700,color:"var(--color-text-primary)"}}>{panel.label}</div>
                        <div style={{display:"grid",gridTemplateColumns:"auto 1fr auto",gap:8,alignItems:"center"}}>
                          <span style={{fontSize:12,color:"var(--color-text-secondary)"}}>Размер фото</span>
                          <input
                            type="range"
                            min={0.5}
                            max={4.5}
                            step={0.05}
                            value={panel.transform.scale}
                            onChange={e=>setCurrentPhotoPlacement(panel.key, { scale: +e.target.value })}
                          />
                          <span style={{fontSize:12,fontWeight:700,minWidth:44,textAlign:"right"}}>{Math.round(panel.transform.scale*100)}%</span>
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"auto 1fr auto",gap:8,alignItems:"center"}}>
                          <span style={{fontSize:12,color:"var(--color-text-secondary)"}}>Сдвиг влево/вправо</span>
                          <input
                            type="range"
                            min={-420}
                            max={420}
                            step={1}
                            value={panel.transform.x}
                            onChange={e=>setCurrentPhotoPlacement(panel.key, { x: +e.target.value })}
                          />
                          <span style={{fontSize:12,fontWeight:700,minWidth:44,textAlign:"right"}}>{Math.round(panel.transform.x)} px</span>
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"auto 1fr auto",gap:8,alignItems:"center"}}>
                          <span style={{fontSize:12,color:"var(--color-text-secondary)"}}>Сдвиг вверх/вниз</span>
                          <input
                            type="range"
                            min={-420}
                            max={420}
                            step={1}
                            value={panel.transform.y}
                            onChange={e=>setCurrentPhotoPlacement(panel.key, { y: +e.target.value })}
                          />
                          <span style={{fontSize:12,fontWeight:700,minWidth:44,textAlign:"right"}}>{Math.round(panel.transform.y)} px</span>
                        </div>
                        <button
                          onClick={()=>resetCurrentPhotoPlacement(panel.key)}
                          style={{...btn,fontSize:12}}
                        >
                          Сбросить фото ({panel.label})
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{display:"grid",gap:6}}>
                  <div style={{fontSize:12,color:"var(--color-text-secondary)"}}>
                    Перемещение текста на слайде. По умолчанию блок двигается только вверх/вниз, чтобы его не уводило по диагонали.
                  </div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {[
                      { id:"y", label:"↕ Вверх/вниз" },
                      { id:"x", label:"↔ Влево/вправо" },
                      { id:"free", label:"✥ Свободно" },
                    ].map((mode) => {
                      const active = currentTextMoveAxis === mode.id;
                      return (
                        <button
                          key={mode.id}
                          onClick={()=>setTextMoveAxes((prev)=>({ ...prev, [current]: mode.id as "free" | "x" | "y" }))}
                          style={{
                            ...btn,
                            padding:"6px 10px",
                            fontSize:12,
                            border:`1px solid ${active ? T.accent : "var(--color-border-tertiary)"}`,
                            background:active ? `${T.accent}14` : "var(--color-card-bg)",
                            color:active ? T.accent : "var(--color-text-primary)",
                            fontWeight:active ? 700 : 500,
                          }}
                        >
                          {mode.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <button
                  onClick={()=>setTextOffsets(p=>({...p,[current]:{title:{x:0,y:0},body:{x:0,y:0},cta:{x:0,y:0}}}))}
                  style={{...btn,fontSize:12}}
                >
                  Сбросить позиции текста на слайде
                </button>
              </div>
            )}

            {/* Download bar */}
            <div style={{display:"flex",gap:10,marginTop:14}}>
              <button onClick={()=>dlSlide(current)} style={{
                flex:1, padding:"12px 0", borderRadius:12, border:"none", cursor:"pointer",
                background:`linear-gradient(135deg,${T.accent},${T.accent}cc)`,
                color:T.hlt, fontWeight:700, fontSize:14,
                boxShadow:`0 4px 18px ${T.accent}55`,
                display:"flex", alignItems:"center", justifyContent:"center", gap:7,
                transition:"transform .15s, box-shadow .15s",
              }}
              onMouseOver={e=>{(e.currentTarget as HTMLElement).style.transform="translateY(-1px)";(e.currentTarget as HTMLElement).style.boxShadow=`0 6px 24px ${T.accent}77`;}}
              onMouseOut={e=>{(e.currentTarget as HTMLElement).style.transform="";(e.currentTarget as HTMLElement).style.boxShadow=`0 4px 18px ${T.accent}55`;}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Слайд {current+1}
              </button>
              <button onClick={dlAll} style={{
                flex:2, padding:"12px 0", borderRadius:12, border:"none", cursor:"pointer",
                background:"linear-gradient(135deg,#E11D48 0%,#2563EB 60%,#0F2044 100%)",
                color:"#fff", fontWeight:700, fontSize:14,
                boxShadow:"0 4px 18px rgba(225,29,72,0.38)",
                display:"flex", alignItems:"center", justifyContent:"center", gap:7,
                transition:"transform .15s, box-shadow .15s",
              }}
              onMouseOver={e=>{(e.currentTarget as HTMLElement).style.transform="translateY(-1px)";(e.currentTarget as HTMLElement).style.boxShadow="0 6px 24px rgba(225,29,72,0.5)";}}
              onMouseOut={e=>{(e.currentTarget as HTMLElement).style.transform="";(e.currentTarget as HTMLElement).style.boxShadow="0 4px 18px rgba(225,29,72,0.38)";}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Скачать все {slides.length} слайдов
              </button>
            </div>
          </div>
        </div>
      )}

      {setupStep===2 && slides.length>0 && (
        <div style={{marginTop:10,border:"1px solid var(--color-border-tertiary)",borderRadius:12,padding:12,background:"var(--color-card-bg)",display:"grid",gap:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
            <div style={{fontSize:13,fontWeight:700,color:"var(--color-text-primary)"}}>
              Текст по блокам {aiTextSaved ? "(сгенерирован ИИ и сохранён)" : "(текущий черновик)"}
            </div>
            <div style={{fontSize:12,color:"var(--color-text-secondary)"}}>
              Редактирование тут тоже меняет слайды
            </div>
          </div>
          {(() => {
            const s = slides[current] || {};
            return (
            <div key={`text-block-${current}`} style={{border:"1px solid var(--color-border-tertiary)",borderRadius:10,padding:10,background:"var(--color-section-bg)",display:"grid",gap:8}}>
              <div style={{fontSize:12,fontWeight:700,color:"var(--color-text-secondary)"}}>Слайд {current+1}</div>
              {currentLayoutIsPhoto && (
                <div style={{fontSize:12,color:"var(--color-text-secondary)"}}>
                  Для шаблона `Фото` используется только текст под изображением.
                </div>
              )}
              {!currentLayoutIsPhoto && (
                <input
                  value={(s?.title || "") as string}
                  onChange={e=>editSlide(current,"title",e.target.value)}
                  placeholder="Заголовок"
                  style={inp}
                />
              )}
              <textarea
                rows={currentLayoutIsPhoto ? 5 : 3}
                value={(s?.body || "") as string}
                onChange={e=>editSlide(current,"body",e.target.value)}
                placeholder={currentLayoutIsPhoto ? "Текст под фото" : "Основной текст"}
                style={{...inp,resize:"vertical",lineHeight:1.5}}
              />
              <div style={{display:"grid",gridTemplateColumns:currentLayoutIsPhoto ? "1fr" : "1fr 1fr",gap:8}}>
                {!currentLayoutIsPhoto && (
                  <input
                    value={(s?.tag || "") as string}
                    onChange={e=>editSlide(current,"tag",e.target.value)}
                    placeholder="Tag"
                    style={inp}
                  />
                )}
                <input
                  value={(s?.cta || "") as string}
                  onChange={e=>editSlide(current,"cta",e.target.value)}
                  placeholder="CTA"
                  style={inp}
                />
              </div>
            </div>
            );
          })()}
        </div>
      )}

      {photoEditor && (
        <PhotoEditor
          src={photoEditor.src}
          w={size.w}
          h={size.h}
          fitMode={INLINE_PHOTO_LAYOUTS.includes(resolveLayout(photoEditor.slide)) ? "contain" : "cover"}
          onSave={(dataUrl)=>{
            if (photoEditor.kind === "before") setBeforePhotos(p=>({...p,[photoEditor.slide]:dataUrl}));
            else setPhotos(p=>({...p,[photoEditor.slide]:dataUrl}));
            setPhotoEditor(null);
          }}
          onCancel={()=>setPhotoEditor(null)}
        />
      )}

      {/* Hidden isolated render container for PNG export — on-screen but behind everything */}
      {captureIdx>=0&&captureIdx<slides.length&&(
        <div ref={captureRef} style={{position:"fixed",left:0,top:0,width:size.w,height:size.h,zIndex:-9999,pointerEvents:"none"}}>
          <Slide slide={slides[captureIdx]} T={T} layout={resolveLayout(captureIdx)} idx={captureIdx} seqIdx={hasCoverSlide ? Math.max(1, captureIdx) : (captureIdx + 1)} total={slides.length} photo={photos[captureIdx]} beforePhoto={beforePhotos[captureIdx]} avatarPhoto={avatarPhotos[captureIdx]} username={displayUsername} ff={font.css} w={size.w} h={size.h} moveMode={false} onEdit={()=>{}} textPreset={textPreset} textOffset={textOffsets[captureIdx]} textScale={textScales[captureIdx]} dragAxis={textMoveAxes[captureIdx] || "y"} photoTransform={photoTransforms[captureIdx]} beforePhotoTransform={beforePhotoTransforms[captureIdx]} igMode={igMode} textPositionPreset={textPositionPresets[captureIdx]} editMode={false}/>
        </div>
      )}
    </div>
  );
}
