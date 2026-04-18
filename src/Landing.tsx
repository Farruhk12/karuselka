import { useState, useEffect } from "react";
import Logo from "./Logo";
import { useAuth } from "./AuthContext";

// ── Brand palette ──────────────────────────────────────────────
// Обновлённая палитра: более яркая и энергичная
const CRIMSON = "#E11D48";
const BLUE    = "#2563EB";
const NAVY    = "#0F2044";

const G  = `linear-gradient(135deg,${CRIMSON} 0%,${BLUE} 60%,${NAVY} 100%)`;
const GT: React.CSSProperties = {
  background: G,
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
};

// ── SVG Feature icons ──────────────────────────────────────────
function FeatureIcon({ type, color }: { type: string; color: string }) {
  const s = { fill: "none", stroke: color, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (type === "bolt")
    return <svg width="22" height="22" viewBox="0 0 24 24" fill={color}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>;
  if (type === "layout")
    return <svg width="22" height="22" viewBox="0 0 24 24" {...s}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>;
  if (type === "edit")
    return <svg width="22" height="22" viewBox="0 0 24 24" {...s}><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>;
  if (type === "smartphone")
    return <svg width="22" height="22" viewBox="0 0 24 24" {...s}><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="17" r="1" fill={color} stroke="none"/></svg>;
  if (type === "download")
    return <svg width="22" height="22" viewBox="0 0 24 24" {...s}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
  if (type === "sparkles")
    return <svg width="22" height="22" viewBox="0 0 24 24" fill={color}><path d="M12 2l2 6.5H21l-5.5 4 2 6.5L12 15l-5.5 4 2-6.5L3 8.5h7z"/></svg>;
  return null;
}

// Все иконки — единый акцентный цвет (убираем цветовой шум)
const ICON_COLOR = BLUE;

const FEATURES = [
  { iconType: "bolt",       title: "За 30 секунд",      desc: "Введи тему — ИИ напишет заголовок и текст для каждого слайда" },
  { iconType: "sparkles",   title: "Мульти-агент",      desc: "Несколько ИИ-агентов создают, критикуют и улучшают контент — ты получаешь готовый результат" },
  { iconType: "layout",     title: "10+ шаблонов",      desc: "Минимализм, журнал, жирные заголовки, цитаты — на любой вкус" },
  { iconType: "edit",       title: "Правка в браузере", desc: "Меняй любой текст прямо на слайде — без Photoshop и Canva" },
  { iconType: "smartphone", title: "Все форматы",       desc: "Квадрат 1:1, портрет 4:5 и сторис 9:16 — в один клик" },
  { iconType: "download",   title: "Экспорт PNG",       desc: "Скачай готовые слайды и публикуй сразу в Instagram" },
];

const STEPS = [
  { n:"01", color: CRIMSON, title:"Опиши тему",          desc:"«5 лайфхаков для продуктивности» или «Как зарабатывать на Instagram» — любая идея" },
  { n:"02", color: BLUE,    title:"ИИ создаёт карусель", desc:"Несколько агентов пишут цепляющие заголовки и тексты для каждого слайда за секунды" },
  { n:"03", color: NAVY,    title:"Настрой и скачай",    desc:"Выбери шаблон, добавь фото, экспортируй PNG и загружай прямо в Instagram" },
];

const SLIDE_COLORS = [CRIMSON, BLUE, "#9BB3C8", NAVY];
const SLIDE_LABELS = ["Советы блогера", "Личный бренд", "Контент план", "Заработок"];

const isDev = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
const BASE_URL = isDev ? "https://karuselka.vercel.app" : "";

export default function Landing({ onStart, onLogin, onProfile }: { onStart: () => void; onLogin?: () => void; onProfile?: () => void }) {
  const { user } = useAuth();
  const isPro = user?.role === "pro";
  const [annual, setAnnual] = useState(false);

  // ── Модалка «Написать администратору» ──────────────────────
  const [showReg, setShowReg] = useState(false);

  // Синхронизация с тёмной темой из AppShell / OS
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return document.documentElement.getAttribute("data-theme") === "dark";
  });

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setDark(document.documentElement.getAttribute("data-theme") === "dark");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onMQ = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem("theme")) setDark(e.matches);
    };
    mq.addEventListener("change", onMQ);

    return () => { observer.disconnect(); mq.removeEventListener("change", onMQ); };
  }, []);

  function openRegModal() {
    setShowReg(true);
  }

  // ── Адаптивные цветовые токены ─────────────────────────────
  // Light: SaaS General palette (F8FAFC base) — чистый современный белый
  // Dark: тёмно-синяя схема без изменений
  const BG_PAGE     = dark ? "#0c1624" : "#F8FAFC";    // slate-50 — почти белый, SaaS-стандарт
  const BG_CARD     = dark ? "#172236" : "#FFFFFF";    // чисто белые карточки
  const BG_SECTION  = dark ? "#111d2e" : "#F1F5F9";    // slate-100 — лёгкое разделение секций
  const BG_STATS    = dark ? "#071018" : NAVY;          // Stats bar — NAVY фон (остаётся)
  const TEXT_P      = dark ? "#e8eef5" : NAVY;          // 12.5:1 на F8FAFC ✓
  const TEXT_S      = dark ? "#8aafc8" : "#334155";     // slate-700 — 7.5:1 ✓
  const TEXT_M      = dark ? "#5a7a96" : "#64748B";     // slate-500 — 4.6:1 ✓
  const BORDER_CARD = dark ? "rgba(255,255,255,0.08)" : "#E2E8F0"; // slate-200
  const BORDER_NAV  = dark ? "rgba(255,255,255,0.07)" : "rgba(15,32,68,0.10)";
  const NAV_BG      = dark ? "rgba(12,22,36,0.92)" : "rgba(248,250,252,0.92)"; // slate-50/92
  const CARD_SHADOW = dark ? "0 2px 16px rgba(0,0,0,0.35)" : "0 2px 16px rgba(15,32,68,0.07)";

  const CARD: React.CSSProperties = {
    background: BG_CARD,
    border: `1px solid ${BORDER_CARD}`,
    borderRadius: 16,
    padding: "28px 24px",
    boxShadow: CARD_SHADOW,
    transition: "background .3s, border-color .3s",
  };

  return (
    <div style={{ background: BG_PAGE, color: TEXT_P, fontFamily:"'Plus Jakarta Sans',system-ui,-apple-system,sans-serif", lineHeight:1.6, overflowX:"hidden", transition:"background .3s,color .3s" }}>
      <style>{`
        @keyframes floatUp  { 0%,100%{transform:translateY(0) rotate(-1deg)} 50%{transform:translateY(-10px) rotate(-1deg)} }
        @keyframes floatUpR { 0%,100%{transform:translateY(0) rotate(4deg) translateY(8px)} 50%{transform:translateY(-8px) rotate(4deg) translateY(8px)} }

        .l-btn-primary { transition: all .22s !important; cursor:pointer !important; }
        .l-btn-primary:hover { box-shadow: 0 8px 40px rgba(225,29,72,0.5) !important; transform: translateY(-2px) !important; }

        .l-feat-card { transition: box-shadow .2s, border-color .2s, transform .2s !important; }
        .l-feat-card:hover { box-shadow: 0 8px 32px rgba(37,99,235,0.18) !important; border-color: rgba(37,99,235,0.3) !important; transform: translateY(-2px) !important; }

        .l-step-card { transition: box-shadow .2s !important; }
        .l-step-card:hover { box-shadow: 0 6px 24px rgba(15,32,68,0.12) !important; }

        .l-btn-ghost { transition: all .2s !important; cursor:pointer !important; }
        .l-btn-ghost:hover { border-color: rgba(37,99,235,0.35) !important; color: rgba(15,32,68,0.85) !important; }

        .l-cta-white { transition: all .22s !important; cursor:pointer !important; }
        .l-cta-white:hover { transform: translateY(-2px) !important; box-shadow: 0 8px 32px rgba(0,0,0,0.25) !important; }

        /* Мобильная версия */
        @media (max-width:600px) {
          /* Все 4 карточки — уменьшенные, в ряд */
          .l-hero-cards { display:flex !important; justify-content:center !important; margin-top:32px !important; gap:8px !important; }
          .l-hero-cards > * { transform:none !important; width:68px !important; height:88px !important; animation:none !important; border-radius:10px !important; }
          .l-hero-cards > *:nth-child(2) { width:80px !important; height:100px !important; animation:floatUp 4s ease-in-out infinite !important; }

          /* Nav — все кнопки icon-only */
          .l-login-text  { display:none !important; }
          .l-login-icon  { display:flex !important; }
          .l-nav-login   { padding:0 !important; width:36px !important; height:36px !important; min-width:0 !important; justify-content:center !important; }
          .l-nav-admin-text { display:none !important; }
          .l-nav-admin   { padding:0 !important; width:36px !important; height:36px !important; min-width:0 !important; justify-content:center !important; }
          .l-nav-try-text { display:none !important; }
          .l-nav-try     { padding:0 !important; width:36px !important; height:36px !important; min-width:0 !important; justify-content:center !important; font-size:18px !important; }

          .l-features-grid { grid-template-columns:1fr !important; }
          .l-pricing-grid  { grid-template-columns:1fr !important; }
          .l-pricing-pro   { transform:none !important; }
          .l-stats-inner   { gap:24px 40px !important; }
          .l-hero-cta      { flex-direction:column !important; align-items:stretch !important; }
          .l-hero-cta button { text-align:center !important; }
          .l-footer-inner  { flex-direction:column !important; align-items:center !important; text-align:center !important; }
          .l-cta-banner    { padding:40px 24px !important; }
        }
      `}</style>

      {/* Ambient blobs — тонкие на белом фоне */}
      <div style={{ position:"fixed", top:0, left:0, right:0, height:480, background:`linear-gradient(180deg,rgba(225,29,72,0.05) 0%,transparent 100%)`, pointerEvents:"none", zIndex:0 }}/>
      <div style={{ position:"fixed", top:160, right:"-8%", width:480, height:480, borderRadius:"50%", background:`radial-gradient(circle,rgba(37,99,235,0.07) 0%,transparent 70%)`, pointerEvents:"none", zIndex:0 }}/>
      <div style={{ position:"fixed", top:380, left:"-6%", width:380, height:380, borderRadius:"50%", background:`radial-gradient(circle,rgba(225,29,72,0.05) 0%,transparent 70%)`, pointerEvents:"none", zIndex:0 }}/>

      <div style={{ position:"relative", zIndex:1 }}>

        {/* ── NAV ── */}
        <nav style={{
          position:"sticky", top:0, zIndex:100,
          background: NAV_BG, backdropFilter:"blur(20px)",
          borderBottom:`1px solid ${BORDER_NAV}`,
          transition:"background .3s",
        }}>
          <div style={{ maxWidth:1100, margin:"0 auto", padding:"0 20px", height:62, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <Logo size={34}/>
              <span style={{ fontWeight:800, fontSize:17, letterSpacing:-0.4, color: TEXT_P }}>Каруселька</span>
            </div>
            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              {/* Desktop: текст, Mobile: SVG иконка */}
              <button
                onClick={openRegModal}
                className="l-btn-ghost l-nav-admin"
                title="Написать администратору"
                style={{
                  display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                  padding:"8px 16px", borderRadius:10,
                  background:"transparent", border:`1px solid ${BORDER_CARD}`,
                  color: TEXT_S, fontSize:13, whiteSpace:"nowrap",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                </svg>
                <span className="l-nav-admin-text">Написать администратору</span>
              </button>
              {user ? (
                /* Авторизован — кнопка профиля */
                <button
                  className="l-nav-login l-btn-ghost as-prof-btn"
                  onClick={onProfile || onStart}
                  title={user.login}
                  style={{
                    display:"flex", alignItems:"center", justifyContent:"center", gap:7,
                    padding:"6px 14px", borderRadius:20,
                    background:"transparent", border:`1px solid ${BORDER_CARD}`,
                    color: TEXT_S, fontSize:13, cursor:"pointer",
                  }}
                >
                  <div style={{
                    width:26, height:26, borderRadius:"50%", flexShrink:0,
                    background: isPro
                      ? `linear-gradient(135deg,#E11D48 0%,#2563EB 60%,#0F2044 100%)`
                      : "rgba(15,32,68,0.1)",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:12, fontWeight:700, color: isPro ? "#fff" : NAVY,
                  }}>
                    {user.login[0].toUpperCase()}
                  </div>
                  <span className="l-login-text" style={{ fontWeight:600 }}>
                    {isPro ? <span style={{ fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:10, background:`linear-gradient(135deg,#E11D48,#2563EB)`, color:"#fff" }}>PRO</span> : user.login}
                  </span>
                </button>
              ) : (
                /* Не авторизован — кнопка входа */
                <button
                  className="l-nav-login l-btn-ghost"
                  onClick={onLogin || onStart}
                  title="Войти"
                  style={{
                    display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                    padding:"8px 18px", borderRadius:10,
                    background:"transparent", border:`1px solid ${BORDER_CARD}`,
                    color: TEXT_S, fontSize:14,
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  <span className="l-login-text">Войти</span>
                </button>
              )}
              <button onClick={onStart} className="l-btn-primary l-nav-try" title="Попробовать" style={{
                display:"flex", alignItems:"center", justifyContent:"center", gap:4,
                padding:"9px 22px", borderRadius:10, background:G, border:"none",
                color:"#fff", fontSize:14, fontWeight:700,
                boxShadow:`0 4px 20px rgba(225,29,72,0.35)`,
              }}>
                <span className="l-nav-try-text">Попробовать</span>
                <span>→</span>
              </button>
            </div>
          </div>
        </nav>

        {/* ── HERO ── */}
        <section style={{ maxWidth:900, margin:"0 auto", padding:"80px 20px 60px", textAlign:"center" }}>
          <h1 style={{ fontSize:"clamp(38px,6.5vw,78px)", fontWeight:900, lineHeight:1.05, letterSpacing:-2, margin:"0 0 20px", color: TEXT_P }}>
            Карусели для Instagram<br/>
            <span style={GT}>за 30 секунд</span>
          </h1>

          {/* Один чёткий подзаголовок вместо двух конкурирующих */}
          <p style={{ fontSize:"clamp(16px,2.2vw,20px)", color: TEXT_S, maxWidth:520, margin:"0 auto 12px", lineHeight:1.65, fontWeight:500 }}>
            Введи тему — ИИ напишет заголовки, текст и структуру каждого слайда.
          </p>
          <p style={{ fontSize:14, color: TEXT_M, maxWidth:480, margin:"0 auto 32px", lineHeight:1.6 }}>
            Мульти-агент: стратег → копирайтер → критик → редактор
          </p>

          <div className="l-hero-cta" style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" }}>
            <button onClick={onStart} className="l-btn-primary" style={{
              padding:"15px 36px", borderRadius:14, background:G, border:"none", color:"#fff",
              fontSize:16, fontWeight:700, boxShadow:`0 6px 32px rgba(225,29,72,0.4)`,
            }}>Создать карусель бесплатно →</button>
            <button onClick={openRegModal} className="l-btn-ghost" style={{
              padding:"15px 26px", borderRadius:14,
              background: BG_CARD, border:`1px solid ${BORDER_CARD}`,
              color: TEXT_S, fontSize:16, boxShadow: CARD_SHADOW,
              display:"flex", alignItems:"center", gap:8,
            }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
              </svg>
              Написать администратору
            </button>
          </div>
          <p style={{ marginTop:16, fontSize:13, color: TEXT_M }}>Нет аккаунта? Оставьте заявку — мы свяжемся с вами</p>

          {/* Слайды — на мобильном показываем центральный */}
          <div className="l-hero-cards" style={{ marginTop:64, display:"flex", justifyContent:"center", gap:14, alignItems:"center" }}>
            {SLIDE_COLORS.map((c, i) => {
              const isC = i === 1;
              return (
                <div key={c} style={{
                  width:isC?148:112, height:isC?185:140,
                  borderRadius:14, background:c, flexShrink:0,
                  transform:i===0?"rotate(-5deg) translateY(10px)":i===2?"rotate(4deg) translateY(6px)":i===3?"rotate(-2deg) translateY(14px)":"scale(1.04)",
                  boxShadow:isC?`0 24px 56px ${c}66`:"0 10px 28px rgba(0,0,0,0.18)",
                  zIndex:isC?3:i===0?2:1, position:"relative", overflow:"hidden",
                  animation:isC?"floatUp 4s ease-in-out infinite":i===2?"floatUpR 5s ease-in-out infinite":undefined,
                  display:"flex", flexDirection:"column", justifyContent:"flex-end", padding:12,
                }}>
                  <div style={{ position:"absolute", inset:0, background:"linear-gradient(160deg,rgba(0,0,0,0.04),rgba(0,0,0,0.45))" }}/>
                  <div style={{ position:"relative", zIndex:1 }}>
                    <div style={{ display:"flex", gap:2, marginBottom:6 }}>
                      {[1,1.5,0.8].map((f,j) => <div key={j} style={{ height:2.5, flex:f, borderRadius:2, background:"rgba(255,255,255,0.55)" }}/>)}
                    </div>
                    <div style={{ fontSize:isC?9.5:8, fontWeight:800, color:"#fff", lineHeight:1.3, letterSpacing:.5, textTransform:"uppercase" }}>
                      {SLIDE_LABELS[i]}
                    </div>
                    <div style={{ marginTop:5, display:"flex", flexDirection:"column", gap:2.5 }}>
                      {[75,55,35].map((w,j) => <div key={j} style={{ width:`${w}%`, height:1.5, background:"rgba(255,255,255,0.3)", borderRadius:1 }}/>)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── STATS — NAVY фон для визуальной дифференциации ── */}
        <div style={{ background: BG_STATS, padding:"32px 20px", transition:"background .3s" }}>
          <div className="l-stats-inner" style={{ maxWidth:900, margin:"0 auto", display:"flex", justifyContent:"center", gap:"clamp(20px,5vw,80px)", flexWrap:"wrap" }}>
            {([
              ["3–4 часа", "экономии в неделю",            "#F87171"],
              ["30 сек",   "на одну карусель",              "#60A5FA"],
              ["10+",      "профессиональных шаблонов",     "#93C5FD"],
              ["3 формата","для Instagram",                  "#CBD5E1"],
            ] as const).map(([v, l, c]) => (
              <div key={v} style={{ textAlign:"center" }}>
                <div style={{ fontSize:28, fontWeight:900, letterSpacing:-1, color:c }}>{v}</div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,0.55)", marginTop:2 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── FEATURES ── */}
        <section style={{ maxWidth:1100, margin:"0 auto", padding:"80px 20px 60px" }}>
          <div style={{ textAlign:"center", marginBottom:52 }}>
            <div style={{ fontSize:12, fontWeight:700, letterSpacing:2, textTransform:"uppercase", color: CRIMSON, marginBottom:12 }}>Возможности</div>
            <h2 style={{ fontSize:"clamp(26px,4vw,44px)", fontWeight:900, letterSpacing:-1.5, margin:0, color: TEXT_P }}>Всё что нужно блогеру</h2>
            <p style={{ color: TEXT_S, marginTop:12, fontSize:16 }}>Создавай контент быстрее конкурентов — без дизайнера и копирайтера</p>
          </div>
          <div className="l-features-grid" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:14 }}>
            {FEATURES.map(f => (
              <div key={f.title} className="l-feat-card" style={{ ...CARD }}>
                <div style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:50, height:50, background:`${ICON_COLOR}18`, borderRadius:13, marginBottom:14 }}>
                  <FeatureIcon type={f.iconType} color={ICON_COLOR}/>
                </div>
                <div style={{ fontWeight:700, fontSize:16, marginBottom:7, color: TEXT_P }}>{f.title}</div>
                <div style={{ color: TEXT_S, fontSize:14, lineHeight:1.7 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section style={{ background: BG_SECTION, padding:"0 0 80px", transition:"background .3s" }}>
          <div style={{ maxWidth:860, margin:"0 auto", padding:"80px 20px 0" }}>
            <div style={{ textAlign:"center", marginBottom:48 }}>
              <div style={{ fontSize:12, fontWeight:700, letterSpacing:2, textTransform:"uppercase", color: CRIMSON, marginBottom:12 }}>Процесс</div>
              <h2 style={{ fontSize:"clamp(26px,4vw,44px)", fontWeight:900, letterSpacing:-1.5, margin:0, color: TEXT_P }}>Три шага до готового поста</h2>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {STEPS.map(s => (
                <div key={s.n} className="l-step-card" style={{ ...CARD, display:"flex", alignItems:"flex-start", gap:24, borderLeft:`3px solid ${s.color}` }}>
                  <div style={{ fontSize:"clamp(26px,4vw,36px)", fontWeight:900, lineHeight:1, flexShrink:0, color:s.color, minWidth:44 }}>{s.n}</div>
                  <div style={{ paddingTop:2 }}>
                    <div style={{ fontWeight:700, fontSize:17, marginBottom:6, color: TEXT_P }}>{s.title}</div>
                    <div style={{ color: TEXT_S, fontSize:14, lineHeight:1.7 }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── PRICING ── */}
        <section style={{ maxWidth:800, margin:"0 auto", padding:"80px 20px 90px" }}>
          <div style={{ textAlign:"center", marginBottom:48 }}>
            <div style={{ fontSize:12, fontWeight:700, letterSpacing:2, textTransform:"uppercase", color: CRIMSON, marginBottom:12 }}>Тарифы</div>
            <h2 style={{ fontSize:"clamp(26px,4vw,44px)", fontWeight:900, letterSpacing:-1.5, margin:"0 0 24px", color: TEXT_P }}>Простые цены</h2>
            <div style={{ display:"inline-flex", background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)", borderRadius:100, padding:4, border:`1px solid ${BORDER_CARD}` }}>
              {(["Месяц","Год −33%"] as const).map((l, i) => (
                <button key={l} onClick={() => setAnnual(i===1)} style={{
                  padding:"8px 22px", borderRadius:100, border:"none", cursor:"pointer", fontSize:13, fontWeight:600,
                  background: annual===(i===1) ? BG_CARD : "transparent",
                  color: annual===(i===1) ? TEXT_P : TEXT_M,
                  boxShadow: annual===(i===1) ? CARD_SHADOW : "none",
                  transition:"all .2s",
                }}>{l}</button>
              ))}
            </div>
          </div>

          <div className="l-pricing-grid" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, alignItems:"start" }}>

            {/* Free */}
            <div style={{ ...CARD }}>
              <div style={{ fontSize:11, fontWeight:700, letterSpacing:2, textTransform:"uppercase", color: TEXT_M, marginBottom:18 }}>Бесплатно</div>
              <div style={{ display:"flex", alignItems:"baseline", gap:5, marginBottom:4 }}>
                <div style={{ fontSize:44, fontWeight:900, letterSpacing:-2, lineHeight:1, color: TEXT_P }}>0</div>
                <div style={{ fontSize:20, fontWeight:700, color: BLUE }}>сом</div>
              </div>
              <div style={{ color: TEXT_M, fontSize:13, marginBottom:28, paddingBottom:22, borderBottom:`1px solid ${BORDER_CARD}` }}>навсегда</div>
              {["5 карусели в месяц","6 базовых шаблонов","Экспорт PNG","Все форматы Instagram"].map(f => (
                <div key={f} style={{ display:"flex", gap:9, alignItems:"center", marginBottom:10, fontSize:14, color: TEXT_S }}>
                  <span style={{ color: CRIMSON, fontSize:15, fontWeight:700 }}>✓</span>{f}
                </div>
              ))}
              <button onClick={onStart} style={{
                marginTop:26, width:"100%", padding:"12px", borderRadius:12, cursor:"pointer",
                background: dark ? "rgba(225,29,72,0.12)" : "rgba(225,29,72,0.07)",
                border:`1px solid rgba(225,29,72,0.25)`, color: CRIMSON, fontSize:15, fontWeight:700,
                transition:"all .2s",
              }}>Начать бесплатно</button>
            </div>

            {/* Pro — усиленный визуальный вес */}
            <div className="l-pricing-pro" style={{
              background: dark ? "linear-gradient(160deg,#1a2d4a,#1e3560)" : "linear-gradient(160deg,#f9f4f0,#eef2f8)",
              border: `2px solid ${BLUE}`,
              borderRadius: 16,
              padding: "28px 24px",
              boxShadow: dark
                ? `0 16px 56px rgba(37,99,235,0.3), 0 0 0 4px rgba(37,99,235,0.1)`
                : `0 16px 56px rgba(37,99,235,0.18), 0 0 0 4px rgba(37,99,235,0.07)`,
              position:"relative", overflow:"hidden",
              transform:"scale(1.03)",
              transition:"all .3s",
            }}>
              <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:G }}/>
              {/* Бейдж свисает сверху по центру */}
              <div style={{
                position:"absolute", top:0, left:"50%", transform:"translateX(-50%)",
                background:G, color:"#fff", fontSize:11, fontWeight:700,
                padding:"4px 16px", borderRadius:"0 0 10px 10px",
                letterSpacing:1.5, textTransform:"uppercase", whiteSpace:"nowrap",
              }}>ПОПУЛЯРНЫЙ</div>

              <div style={{ fontSize:11, fontWeight:700, letterSpacing:2, textTransform:"uppercase", color: BLUE, marginBottom:14, marginTop:18 }}>Pro</div>
              <div style={{ display:"flex", alignItems:"baseline", gap:5, marginBottom:4 }}>
                <div style={{ fontSize:44, fontWeight:900, letterSpacing:-2, lineHeight:1, color: TEXT_P }}>{annual?"67":"100"}</div>
                <div style={{ fontSize:20, fontWeight:700, color: BLUE }}>сом</div>
                <div style={{ fontSize:14, color: TEXT_M }}>/мес</div>
              </div>
              <div style={{ color: TEXT_M, fontSize:13, marginBottom:28, paddingBottom:22, borderBottom:`1px solid rgba(37,99,235,0.2)` }}>
                {annual ? "800 сом в год · экономия 400 сом" : "отменить в любой момент"}
              </div>
              {["Безлимит карусели","Все 10+ шаблонов","Все цветовые темы","Приоритетная генерация","Ранний доступ к функциям"].map(f => (
                <div key={f} style={{ display:"flex", gap:9, alignItems:"center", marginBottom:10, fontSize:14, color: TEXT_S }}>
                  <span style={{ color: BLUE, fontSize:15, fontWeight:700 }}>✓</span>{f}
                </div>
              ))}
              <button onClick={onStart} className="l-btn-primary" style={{
                marginTop:26, width:"100%", padding:"13px", borderRadius:12,
                background:G, border:"none", color:"#fff", fontSize:15, fontWeight:700,
                boxShadow:`0 6px 28px rgba(225,29,72,0.35)`,
              }}>Подключить Pro →</button>
            </div>
          </div>
        </section>

        {/* ── CTA BANNER ── */}
        <section style={{ maxWidth:860, margin:"0 auto 90px", padding:"0 20px" }}>
          <div className="l-cta-banner" style={{
            background:G, borderRadius:24, padding:"60px 48px", textAlign:"center",
            position:"relative", overflow:"hidden",
            boxShadow:`0 16px 64px rgba(225,29,72,0.35)`,
          }}>
            <div style={{ position:"absolute", top:-60, right:-60, width:240, height:240, borderRadius:"50%", background:"rgba(255,255,255,0.07)", pointerEvents:"none" }}/>
            <div style={{ position:"absolute", bottom:-40, left:-40, width:180, height:180, borderRadius:"50%", background:"rgba(255,255,255,0.05)", pointerEvents:"none" }}/>
            {/* Точечная сетка вместо generic blur */}
            <div style={{
              position:"absolute", inset:0, pointerEvents:"none",
              backgroundImage:"radial-gradient(circle at 1px 1px, rgba(255,255,255,0.09) 1px, transparent 0)",
              backgroundSize:"28px 28px",
            }}/>
            <h2 style={{ fontSize:"clamp(22px,4vw,38px)", fontWeight:900, letterSpacing:-1, margin:"0 0 14px", color:"#fff", position:"relative" }}>
              Попробуй прямо сейчас
            </h2>
            <p style={{ color:"rgba(255,255,255,0.78)", fontSize:16, margin:"0 0 32px", position:"relative" }}>
              Первые 5 карусели — бесплатно. Без регистрации.
            </p>
            <button onClick={onStart} className="l-cta-white" style={{
              position:"relative", padding:"14px 42px", borderRadius:14,
              background:"#fff", border:"none", color: BLUE,
              fontSize:16, fontWeight:800, boxShadow:"0 4px 24px rgba(0,0,0,0.2)",
            }}>
              Создать карусель →
            </button>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer style={{ background: BG_SECTION, borderTop:`1px solid ${BORDER_CARD}`, padding:"32px 20px", transition:"background .3s" }}>
          <div className="l-footer-inner" style={{ maxWidth:1100, margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:16 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <Logo size={26}/>
              <span style={{ fontWeight:800, fontSize:15, color: TEXT_P }}>Каруселька</span>
            </div>
            <p style={{ color: TEXT_M, fontSize:13, margin:0 }}>© 2026 Каруселька · ИИ-генератор контента для Instagram</p>
            <button onClick={onStart} className="l-btn-ghost" style={{
              padding:"7px 18px", borderRadius:8,
              background:"transparent", border:`1px solid ${BORDER_CARD}`,
              color: TEXT_M, fontSize:13,
            }}>Открыть приложение →</button>
          </div>
        </footer>

      </div>

      {/* ── МОДАЛКА: Заявка на регистрацию ── */}
      {showReg && (
        <div
          onClick={() => setShowReg(false)}
          style={{
            position:"fixed", inset:0, zIndex:200,
            background:"rgba(0,0,0,0.55)", backdropFilter:"blur(6px)",
            display:"flex", alignItems:"center", justifyContent:"center",
            padding:20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: BG_CARD, borderRadius:20, padding:"36px 32px",
              maxWidth:420, width:"100%",
              border:`1px solid ${BORDER_CARD}`,
              boxShadow:"0 24px 80px rgba(0,0,0,0.35)",
              position:"relative",
            }}
          >
            {/* Закрыть */}
            <button
              onClick={() => setShowReg(false)}
              style={{
                position:"absolute", top:16, right:16,
                width:32, height:32, borderRadius:8,
                background:"transparent", border:`1px solid ${BORDER_CARD}`,
                color: TEXT_M, cursor:"pointer", fontSize:18, lineHeight:1,
                display:"flex", alignItems:"center", justifyContent:"center",
              }}
              aria-label="Закрыть"
            >×</button>

                {/* Заголовок */}
              <div style={{ textAlign:"center", marginBottom:28 }}>
                <div style={{
                  width:52, height:52, borderRadius:16, background:G,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  margin:"0 auto 14px",
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
                <div style={{ fontSize:20, fontWeight:800, color: TEXT_P, marginBottom:6 }}>
                  Написать администратору
                </div>
                <p style={{ color: TEXT_S, fontSize:14, lineHeight:1.6, margin:0 }}>
                  Свяжитесь с нами — создадим аккаунт и расскажем об условиях
                </p>
              </div>

              {/* Контакты */}
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <a
                  href="https://t.me/Farrukh_Baqoev"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display:"flex", alignItems:"center", justifyContent:"center", gap:10,
                    padding:"14px 20px", borderRadius:14, textDecoration:"none",
                    background:"#0088cc", color:"#fff",
                    fontSize:15, fontWeight:700,
                    boxShadow:"0 4px 20px rgba(0,136,204,0.35)",
                    transition:"opacity .2s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
                  onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-2.04 9.607c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.53 14.6l-2.948-.92c-.64-.204-.654-.64.136-.953l11.51-4.44c.537-.194 1.006.131.834.96z"/>
                  </svg>
                  Написать в Telegram
                </a>

                <a
                  href="tel:+992900446498"
                  style={{
                    display:"flex", alignItems:"center", justifyContent:"center", gap:10,
                    padding:"14px 20px", borderRadius:14, textDecoration:"none",
                    background: dark ? "rgba(255,255,255,0.07)" : "rgba(15,32,68,0.06)",
                    border:`1px solid ${BORDER_CARD}`,
                    color: TEXT_P, fontSize:15, fontWeight:700,
                    transition:"opacity .2s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = "0.75")}
                  onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
                >
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.6 1.2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.77a16 16 0 0 0 6.29 6.29l1.84-1.84a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                  +992 900 446 498
                </a>
              </div>

              <p style={{ marginTop:16, fontSize:12, color: TEXT_M, textAlign:"center" }}>
                Отвечаем быстро · Пн–Вс 9:00–21:00
              </p>
          </div>
        </div>
      )}
    </div>
  );
}
