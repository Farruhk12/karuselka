import { useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import Logo from "./Logo";

const CRIMSON = "#E11D48";
const BLUE = "#2563EB";
const NAVY = "#0F2044";
const G = `linear-gradient(135deg,${CRIMSON} 0%,${BLUE} 60%,${NAVY} 100%)`;

export default function LoginPage({ onSuccess, onBack }: { onSuccess: () => void; onBack: () => void }) {
  const { login } = useAuth();
  const [loginVal, setLoginVal] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
  const BG_INPUT   = dark ? "#0f1a2b" : "#F8FAFC";
  const TEXT_P     = dark ? "#e8eef5" : NAVY;
  const TEXT_S     = dark ? "#8aafc8" : "#475569";
  const TEXT_M     = dark ? "#5a7a96" : "#64748B";
  const BORDER     = dark ? "rgba(255,255,255,0.08)" : "#E2E8F0";
  const BORDER_IN  = dark ? "rgba(255,255,255,0.10)" : "#CBD5E1";
  const CARD_SHADOW = dark ? "0 2px 16px rgba(0,0,0,0.35)" : "0 2px 16px rgba(15,32,68,0.07)";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!loginVal.trim() || !password) return;
    setLoading(true);
    setError("");
    const err = await login(loginVal.trim(), password);
    setLoading(false);
    if (err) setError(err);
    else onSuccess();
  }

  const canSubmit = !loading && !!loginVal.trim() && !!password;

  return (
    <div style={{ minHeight: "100vh", background: BG_PAGE, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Plus Jakarta Sans',system-ui,-apple-system,sans-serif", transition: "background .3s" }}>
      <style>{`
        .lp-primary { transition: all .2s; }
        .lp-primary:not(:disabled):hover { transform: translateY(-1px); box-shadow: 0 8px 28px rgba(225,29,72,0.45) !important; }
        .lp-input { transition: border-color .15s, box-shadow .15s; }
        .lp-input:focus { border-color: ${BLUE} !important; box-shadow: 0 0 0 3px rgba(37,99,235,0.15) !important; }
        .lp-link { transition: opacity .2s; }
        .lp-link:hover { opacity: 0.75; }
      `}</style>

      <div style={{ width: "100%", maxWidth: 400 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <Logo size={36} />
            <span style={{ fontSize: 22, fontWeight: 800, color: TEXT_P, letterSpacing: -0.4 }}>Каруселька</span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: TEXT_P, margin: 0, letterSpacing: -0.8 }}>Вход в аккаунт</h1>
          <p style={{ fontSize: 14, color: TEXT_M, margin: "8px 0 0" }}>Введите логин и пароль</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{
          background: BG_CARD, borderRadius: 16, padding: "28px 24px",
          boxShadow: CARD_SHADOW, border: `1px solid ${BORDER}`,
          transition: "background .3s, border-color .3s",
        }}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: TEXT_S, display: "block", marginBottom: 6 }}>Логин</label>
            <input
              value={loginVal} onChange={e => setLoginVal(e.target.value)}
              placeholder="Ваш логин"
              className="lp-input"
              style={{
                width: "100%", padding: "12px 14px", fontSize: 15, borderRadius: 10,
                border: `1px solid ${BORDER_IN}`, outline: "none", boxSizing: "border-box",
                background: BG_INPUT, color: TEXT_P,
                fontFamily: "inherit",
              }}
            />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: TEXT_S, display: "block", marginBottom: 6 }}>Пароль</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Ваш пароль"
              className="lp-input"
              style={{
                width: "100%", padding: "12px 14px", fontSize: 15, borderRadius: 10,
                border: `1px solid ${BORDER_IN}`, outline: "none", boxSizing: "border-box",
                background: BG_INPUT, color: TEXT_P,
                fontFamily: "inherit",
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: "10px 14px", borderRadius: 10, marginBottom: 14,
              background: dark ? "rgba(225,29,72,0.12)" : "rgba(225,29,72,0.07)",
              border: `1px solid rgba(225,29,72,0.22)`,
              color: CRIMSON, fontSize: 13, fontWeight: 500,
            }}>{error}</div>
          )}

          <button type="submit" disabled={!canSubmit} className="lp-primary" style={{
            width: "100%", padding: 14, borderRadius: 12, fontSize: 15, fontWeight: 700,
            border: "none", cursor: loading ? "wait" : (canSubmit ? "pointer" : "not-allowed"),
            background: canSubmit ? G : (dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"),
            color: canSubmit ? "#fff" : TEXT_M,
            boxShadow: canSubmit ? "0 6px 24px rgba(225,29,72,0.35)" : "none",
            fontFamily: "inherit",
          }}>
            {loading ? "Входим..." : "Войти"}
          </button>
        </form>

        {/* Back */}
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button onClick={onBack} className="lp-link" style={{
            background: "none", border: "none", color: BLUE, fontSize: 14,
            cursor: "pointer", fontWeight: 600, fontFamily: "inherit",
            display: "inline-flex", alignItems: "center", gap: 6,
          }}>
            <span>←</span> На главную
          </button>
        </div>
      </div>
    </div>
  );
}
