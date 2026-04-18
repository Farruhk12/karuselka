import { useState, useEffect } from "react";
import App from "../carousel_generator";
import Logo from "./Logo";
import { useAuth } from "./AuthContext";

const BLUE = "#2563EB";
const NAVY = "#0F2044";
const CRIMSON = "#E11D48";
const G = `linear-gradient(135deg,${CRIMSON} 0%,${BLUE} 60%,${NAVY} 100%)`;

function useTheme() {
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("theme") === "dark";
  });
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);
  return { dark, toggle: () => setDark(d => !d) };
}

export default function AppShell({ onBack, onProfile }: { onBack: () => void; onProfile?: () => void }) {
  const { user } = useAuth();
  const isPro = user?.role === "pro";
  const { dark, toggle: toggleTheme } = useTheme();

  return (
    <div style={{ minHeight:"100vh", background: dark ? "#0c1624" : "#F8FAFC", transition:"background .3s" }}>
      <style>{`
        @media (max-width:600px) {
          .as-back-text   { display:none !important; }
          .as-back-btn    { padding:0 !important; width:36px !important; height:36px !important; gap:0 !important; justify-content:center !important; }
          .as-prof-label  { display:none !important; }
          .as-prof-btn    { padding:4px !important; }
        }
        .as-nav-btn { transition: all .2s; }
        .as-nav-btn:hover { border-color: ${dark ? "rgba(255,255,255,0.18)" : "#94A3B8"} !important; transform: translateY(-1px); }
      `}</style>
      {/* Sticky nav */}
      <nav style={{
        position:"sticky", top:0, zIndex:100,
        background: dark ? "rgba(12,22,36,0.92)" : "rgba(248,250,252,0.92)", backdropFilter:"blur(20px)",
        borderBottom:`1px solid ${dark ? "rgba(255,255,255,0.07)" : "rgba(15,32,68,0.08)"}`,
        transition:"background .3s, border-color .3s",
      }}>
        <div style={{ maxWidth:1000, margin:"0 auto", padding:"0 20px", height:58, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <button onClick={onBack} className="as-back-btn as-nav-btn" title="Главная" style={{
              display:"flex", alignItems:"center", gap:6,
              padding:"7px 14px", borderRadius:10,
              background:"var(--color-card-bg)", border:"1px solid var(--color-border-tertiary)",
              color:"var(--color-text-secondary)", cursor:"pointer", fontSize:13, fontWeight:600,
              boxShadow:"0 1px 3px var(--color-card-shadow)",
            }}>← <span className="as-back-text">Главная</span></button>
            {/* Theme toggle */}
            <button onClick={toggleTheme} className="as-nav-btn" title={dark ? "Светлая тема" : "Тёмная тема"} style={{
              width:36, height:36, borderRadius:10, border:"1px solid var(--color-border-tertiary)",
              background:"var(--color-card-bg)", cursor:"pointer",
              color:"var(--color-text-secondary)",
              display:"flex", alignItems:"center", justifyContent:"center",
              boxShadow:"0 1px 3px var(--color-card-shadow)",
            }}>
              {dark ? (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              ) : (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
            </button>
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:9 }}>
            <Logo size={30}/>
            <span style={{ fontWeight:800, fontSize:16, color: dark ? "#e8eef5" : NAVY, letterSpacing:-0.4 }}>Каруселька</span>
          </div>

          {/* Profile button */}
          {user ? (
            <button onClick={onProfile} className="as-prof-btn as-nav-btn" style={{
              display:"flex", alignItems:"center", gap:8,
              padding:"5px 5px 5px 12px", borderRadius:20,
              background:"var(--color-card-bg)", border:"1px solid var(--color-border-tertiary)",
              cursor:"pointer", fontSize:13, color: dark ? "#e8eef5" : NAVY,
              boxShadow:"0 1px 3px var(--color-card-shadow)",
            }}>
              <span className="as-prof-label">
                {isPro ? (
                  <span style={{
                    fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:10,
                    background:G, color:"#fff", letterSpacing:0.8,
                  }}>PRO</span>
                ) : (
                  <span style={{ fontSize:12, color:"var(--color-text-secondary)", fontWeight:600 }}>
                    {user.generationsLeft}/5
                  </span>
                )}
              </span>
              <div style={{
                width:28, height:28, borderRadius:"50%",
                background: isPro ? G : (dark ? "rgba(255,255,255,0.08)" : "rgba(15,32,68,0.08)"),
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:12, fontWeight:700, color: isPro ? "#fff" : (dark ? "#e8eef5" : NAVY),
                flexShrink:0,
              }}>
                {user.login[0].toUpperCase()}
              </div>
            </button>
          ) : (
            <div style={{ width:36 }} />
          )}
        </div>
      </nav>

      {/* Generator */}
      <div style={{ maxWidth:600, margin:"0 auto", padding:"1.5rem 1rem 4rem" }}>
        <App onProfile={onProfile} />
      </div>
    </div>
  );
}
