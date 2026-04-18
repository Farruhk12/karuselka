import { useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import Logo from "./Logo";

const CRIMSON = "#E11D48";
const BLUE = "#2563EB";
const NAVY = "#0F2044";
const G = `linear-gradient(135deg,${CRIMSON} 0%,${BLUE} 60%,${NAVY} 100%)`;

export default function ProfilePage({ onBack, onLogout, onAdmin }: { onBack: () => void; onLogout: () => void; onAdmin?: () => void }) {
  const { user, logout } = useAuth();

  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return document.documentElement.getAttribute("data-theme") === "dark";
  });
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setDark(document.documentElement.getAttribute("data-theme") === "dark");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const BG_PAGE    = dark ? "#0c1624" : "#F8FAFC";
  const BG_CARD    = dark ? "#172236" : "#FFFFFF";
  const BG_SOFT    = dark ? "rgba(255,255,255,0.04)" : "#F1F5F9";
  const TEXT_P     = dark ? "#e8eef5" : NAVY;
  const TEXT_S     = dark ? "#8aafc8" : "#475569";
  const TEXT_M     = dark ? "#5a7a96" : "#64748B";
  const BORDER     = dark ? "rgba(255,255,255,0.08)" : "#E2E8F0";
  const CARD_SHADOW = dark ? "0 2px 16px rgba(0,0,0,0.35)" : "0 2px 16px rgba(15,32,68,0.07)";

  if (!user) return null;

  const isPro = user.role === "pro";
  const daysLeft = isPro && user.proExpires
    ? Math.max(0, Math.ceil((new Date(user.proExpires).getTime() - Date.now()) / 86400000))
    : 0;
  const totalGen = user.totalGenerations ?? 0;
  const memberDays = user.createdAt
    ? Math.max(1, Math.ceil((Date.now() - new Date(user.createdAt).getTime()) / 86400000))
    : 1;

  async function handleLogout() {
    await logout();
    onLogout();
  }

  return (
    <div style={{ minHeight: "100vh", background: BG_PAGE, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Plus Jakarta Sans',system-ui,-apple-system,sans-serif", transition: "background .3s" }}>
      <style>{`
        .pp-btn { transition: all .2s; font-family: inherit; }
        .pp-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 8px 28px rgba(225,29,72,0.45) !important; }
        .pp-btn-secondary:hover { background: ${dark ? "rgba(255,255,255,0.05)" : "#F8FAFC"} !important; border-color: ${dark ? "rgba(255,255,255,0.18)" : "#94A3B8"} !important; }
        .pp-btn-danger:hover { background: rgba(225,29,72,0.14) !important; }
        .pp-link:hover { opacity: 0.78; }
      `}</style>

      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <Logo size={36} />
            <span style={{ fontSize: 22, fontWeight: 800, color: TEXT_P, letterSpacing: -0.4 }}>Каруселька</span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: TEXT_P, margin: 0, letterSpacing: -0.8 }}>Профиль</h1>
        </div>

        {/* Card */}
        <div style={{
          background: BG_CARD, borderRadius: 16, padding: "28px 24px",
          boxShadow: CARD_SHADOW, border: `1px solid ${BORDER}`,
          transition: "background .3s, border-color .3s",
        }}>
          {/* Avatar + Name */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: isPro ? G : (dark ? "rgba(255,255,255,0.06)" : "rgba(15,32,68,0.06)"),
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, fontWeight: 800, color: isPro ? "#fff" : TEXT_P,
              boxShadow: isPro ? "0 6px 24px rgba(225,29,72,0.28)" : "none",
              flexShrink: 0,
            }}>
              {user.login[0].toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: TEXT_P, overflow: "hidden", textOverflow: "ellipsis" }}>{user.login}</div>
              <div style={{
                display: "inline-block", marginTop: 4, padding: "3px 12px", borderRadius: 20,
                fontSize: 11, fontWeight: 700, letterSpacing: 1,
                background: isPro ? G : BG_SOFT,
                color: isPro ? "#fff" : TEXT_M,
                textTransform: "uppercase",
              }}>
                {isPro ? "PRO" : "Free"}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            {/* Generations */}
            <div style={{
              flex: 1, padding: "16px 14px", borderRadius: 12,
              background: isPro ? (dark ? "rgba(37,99,235,0.12)" : "rgba(37,99,235,0.06)") : (dark ? "rgba(225,29,72,0.10)" : "rgba(225,29,72,0.05)"),
              border: `1px solid ${isPro ? "rgba(37,99,235,0.22)" : "rgba(225,29,72,0.18)"}`,
              textAlign: "center",
            }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: isPro ? BLUE : CRIMSON, letterSpacing: -0.5 }}>
                {isPro ? "∞" : user.generationsLeft}
              </div>
              <div style={{ fontSize: 12, color: TEXT_M, marginTop: 4 }}>
                {isPro ? "Безлимит" : `из 5 генераций`}
              </div>
            </div>

            {/* Days left / Status */}
            <div style={{
              flex: 1, padding: "16px 14px", borderRadius: 12,
              background: isPro ? (dark ? "rgba(37,99,235,0.12)" : "rgba(37,99,235,0.06)") : BG_SOFT,
              border: `1px solid ${isPro ? "rgba(37,99,235,0.22)" : BORDER}`,
              textAlign: "center",
            }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: isPro ? BLUE : TEXT_M, letterSpacing: -0.5 }}>
                {isPro ? daysLeft : "—"}
              </div>
              <div style={{ fontSize: 12, color: TEXT_M, marginTop: 4 }}>
                {isPro ? "дней Pro" : "нет подписки"}
              </div>
            </div>
          </div>

          {/* Mini stats */}
          <div style={{
            display: "flex", gap: 8, marginBottom: 16,
            padding: "14px 16px", borderRadius: 12,
            background: BG_SOFT,
            border: `1px solid ${BORDER}`,
          }}>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{
                fontSize: 22, fontWeight: 800, letterSpacing: -0.5,
                background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
              }}>{totalGen}</div>
              <div style={{ fontSize: 11, color: TEXT_M, marginTop: 2, lineHeight: 1.3 }}>каруселей<br/>создано</div>
            </div>
            <div style={{ width: 1, background: BORDER, alignSelf: "stretch" }}/>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: TEXT_P, letterSpacing: -0.5 }}>{memberDays}</div>
              <div style={{ fontSize: 11, color: TEXT_M, marginTop: 2, lineHeight: 1.3 }}>дней<br/>с нами</div>
            </div>
            <div style={{ width: 1, background: BORDER, alignSelf: "stretch" }}/>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: BLUE, letterSpacing: -0.5 }}>
                {memberDays > 0 ? (totalGen / memberDays).toFixed(1) : "0"}
              </div>
              <div style={{ fontSize: 11, color: TEXT_M, marginTop: 2, lineHeight: 1.3 }}>в среднем<br/>в день</div>
            </div>
          </div>

          {/* Progress for free users */}
          {!isPro && (
            <div style={{ marginBottom: 20 }}>
              <div style={{
                height: 6, borderRadius: 3, background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                overflow: "hidden",
              }}>
                <div style={{
                  height: "100%", borderRadius: 3,
                  width: `${(user.generationsLeft / 5) * 100}%`,
                  background: user.generationsLeft > 2 ? BLUE : user.generationsLeft > 0 ? "#F59E0B" : CRIMSON,
                  transition: "width 0.3s",
                }} />
              </div>
              <div style={{ fontSize: 12, color: TEXT_M, marginTop: 8, textAlign: "center" }}>
                {user.generationsLeft > 0
                  ? `Осталось ${user.generationsLeft} из 5 бесплатных генераций`
                  : "Лимит исчерпан"}
              </div>
              {/* Pro upgrade CTA */}
              <div style={{
                marginTop: 16, padding: "16px", borderRadius: 12,
                background: dark ? "linear-gradient(135deg, rgba(225,29,72,0.10), rgba(37,99,235,0.10))" : "linear-gradient(135deg, rgba(225,29,72,0.06), rgba(37,99,235,0.06))",
                border: `1px solid ${dark ? "rgba(37,99,235,0.25)" : "rgba(37,99,235,0.18)"}`,
              }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: TEXT_P, marginBottom: 6, textAlign: "center", letterSpacing: -0.3 }}>
                  Перейдите на Pro
                </div>
                <div style={{ fontSize: 13, color: TEXT_S, lineHeight: 1.55, textAlign: "center" }}>
                  Безлимитные генерации, все шаблоны, шрифты и размеры
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                  <a href="https://t.me/Farrukh_Baqoev" target="_blank" rel="noopener noreferrer" className="pp-link" style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    padding: "11px 14px", borderRadius: 10, fontSize: 14, fontWeight: 700,
                    background: "#0088cc", color: "#fff", textDecoration: "none",
                    boxShadow: "0 4px 16px rgba(0,136,204,0.28)",
                    transition: "opacity .2s",
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-2.04 9.607c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.53 14.6l-2.948-.92c-.64-.204-.654-.64.136-.953l11.51-4.44c.537-.194 1.006.131.834.96z"/>
                    </svg>
                    Написать в Телеграм
                  </a>
                  <a href="tel:+992900446498" className="pp-link" style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    padding: "11px 14px", borderRadius: 10, fontSize: 14, fontWeight: 700,
                    background: BG_SOFT, color: TEXT_P, textDecoration: "none",
                    border: `1px solid ${BORDER}`,
                    transition: "opacity .2s",
                  }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.6 1.2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.77a16 16 0 0 0 6.29 6.29l1.84-1.84a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                    +992 900 446 498
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Pro expiry info */}
          {isPro && user.proExpires && (
            <div style={{
              padding: "12px 16px", borderRadius: 10, marginBottom: 20,
              background: daysLeft <= 3
                ? (dark ? "rgba(225,29,72,0.10)" : "rgba(225,29,72,0.06)")
                : (dark ? "rgba(37,99,235,0.10)" : "rgba(37,99,235,0.06)"),
              border: `1px solid ${daysLeft <= 3 ? "rgba(225,29,72,0.22)" : "rgba(37,99,235,0.18)"}`,
              fontSize: 13, color: daysLeft <= 3 ? CRIMSON : BLUE, textAlign: "center", fontWeight: 500,
            }}>
              {daysLeft <= 3 && daysLeft > 0
                ? `Подписка истекает через ${daysLeft} дн.!`
                : daysLeft === 0
                  ? "Подписка истекает сегодня!"
                  : `Подписка активна до ${new Date(user.proExpires).toLocaleDateString("ru-RU")}`}
            </div>
          )}

          {/* Admin button */}
          {user.isAdmin && onAdmin && (
            <button onClick={onAdmin} className="pp-btn pp-btn-primary" style={{
              width: "100%", padding: 12, borderRadius: 10, fontSize: 14, fontWeight: 700,
              border: "none", background: G, cursor: "pointer", color: "#fff",
              marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: "0 4px 16px rgba(225,29,72,0.28)",
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              Админ-панель
            </button>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onBack} className="pp-btn pp-btn-secondary" style={{
              flex: 1, padding: 12, borderRadius: 10, fontSize: 14, fontWeight: 600,
              border: `1px solid ${BORDER}`, background: BG_CARD,
              cursor: "pointer", color: TEXT_P,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
              <span style={{ fontSize: 16, lineHeight: 1 }}>←</span> К генератору
            </button>
            <button onClick={handleLogout} className="pp-btn pp-btn-danger" style={{
              padding: "12px 20px", borderRadius: 10, fontSize: 14, fontWeight: 600,
              border: `1px solid ${dark ? "rgba(225,29,72,0.25)" : "rgba(225,29,72,0.18)"}`,
              background: dark ? "rgba(225,29,72,0.10)" : "rgba(225,29,72,0.06)",
              cursor: "pointer", color: CRIMSON,
            }}>
              Выйти
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
