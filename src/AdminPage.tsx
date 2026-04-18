import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import {
  LAYOUTS,
  COVER_ITEMS,
  FONT_ITEMS,
  SIZE_ITEMS,
  THEME_ITEMS,
  VISIBILITY_OPTIONS,
  defaultContentAccess,
  normalizeContentAccess,
  type ContentAccessPayload,
  type VisibilityMode,
} from "./contentAccessCatalog";

interface RegRequest {
  id: string;
  phone: string;
  telegram: string;
  createdAt: string;
}

const CRIMSON = "#E11D48";
const BLUE = "#2563EB";
const NAVY = "#0F2044";
const BG_PAGE = "#F8FAFC";
const G = `linear-gradient(135deg,${CRIMSON} 0%,${BLUE} 60%,${NAVY} 100%)`;

const isDev = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const BASE = isDev ? "https://karuselka.vercel.app" : "";
const API = `${BASE}/api/admin/users`;

interface AdminUser {
  login: string;
  role: "free" | "pro";
  generationsLeft: number;
  proExpires: string | null;
  createdAt: string;
  isAdmin?: boolean;
}

function daysLeft(iso: string | null): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

/* ─── Styles ─── */
const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #E2E8F0",
  borderRadius: 16,
  padding: "24px",
  boxShadow: "0 2px 16px rgba(15,32,68,0.06)",
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #CBD5E1",
  background: "#F8FAFC",
  fontSize: 14,
  color: NAVY,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
  transition: "border-color .15s, box-shadow .15s",
};
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer" };
const btnPrimary: React.CSSProperties = {
  background: G,
  color: "#fff",
  border: "none",
  borderRadius: 10,
  padding: "10px 22px",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
  boxShadow: "0 4px 16px rgba(225,29,72,0.28)",
  transition: "all .2s",
  fontFamily: "inherit",
};
const btnDanger: React.CSSProperties = {
  background: "rgba(225,29,72,0.08)",
  color: CRIMSON,
  border: "1px solid rgba(225,29,72,0.18)",
  borderRadius: 8,
  padding: "6px 14px",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
  transition: "all .15s",
  fontFamily: "inherit",
};
const btnSecondary: React.CSSProperties = {
  background: "#fff",
  color: NAVY,
  border: "1px solid #E2E8F0",
  borderRadius: 8,
  padding: "6px 14px",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
  transition: "all .15s",
  fontFamily: "inherit",
};
const label: React.CSSProperties = { display: "block", fontWeight: 600, fontSize: 13, color: "#475569", marginBottom: 4 };

export default function AdminPage({ onBack }: { onBack: () => void }) {
  const { user: authUser, token: authToken } = useAuth();
  const isTokenAdmin = !!authUser?.isAdmin && !!authToken;

  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem("adminKey") || "");
  const [authed, setAuthed] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Create form
  const [newLogin, setNewLogin] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newRole, setNewRole] = useState<"free" | "pro">("free");
  const [newDays, setNewDays] = useState(30);

  // Edit modal
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [editRole, setEditRole] = useState<"free" | "pro">("free");
  const [editDays, setEditDays] = useState(0);
  const [editGens, setEditGens] = useState(0);
  const [editPass, setEditPass] = useState("");
  const [editIsAdmin, setEditIsAdmin] = useState(false);

  // Delete confirm
  const [deleting, setDeleting] = useState<string | null>(null);

  // Registration requests
  const [regRequests, setRegRequests] = useState<RegRequest[]>([]);
  const [regLoading, setRegLoading] = useState(false);

  const [contentAccess, setContentAccess] = useState<ContentAccessPayload | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentSaving, setContentSaving] = useState(false);

  // Build auth headers: token for admin users, X-Admin-Key for secret key
  const headers = useCallback(
    (): Record<string, string> => {
      const h: Record<string, string> = { "Content-Type": "application/json" };
      if (isTokenAdmin) h["Authorization"] = `Bearer ${authToken}`;
      else h["X-Admin-Key"] = adminKey;
      return h;
    },
    [adminKey, isTokenAdmin, authToken]
  );

  const fetchContentAccess = useCallback(async () => {
    setContentLoading(true);
    try {
      const h: Record<string, string> = { "Content-Type": "application/json" };
      if (isTokenAdmin) h["Authorization"] = `Bearer ${authToken}`;
      else h["X-Admin-Key"] = adminKey;
      const r = await fetch(`${BASE}/api/admin/content-access`, { headers: h });
      if (r.ok) {
        const data = await r.json();
        setContentAccess(normalizeContentAccess(data));
      } else {
        setContentAccess(defaultContentAccess());
      }
    } catch (_) {
      setContentAccess(defaultContentAccess());
    }
    setContentLoading(false);
  }, [adminKey, isTokenAdmin, authToken]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const h: Record<string, string> = {};
      if (isTokenAdmin) h["Authorization"] = `Bearer ${authToken}`;
      else h["X-Admin-Key"] = adminKey;
      const r = await fetch(API, { headers: h });
      if (!r.ok) throw new Error(r.status === 403 ? "Неверный ключ" : "Ошибка сервера");
      const data = await r.json();
      setUsers(data.users || []);
      setAuthed(true);
      if (!isTokenAdmin) sessionStorage.setItem("adminKey", adminKey);
      fetchRegRequests();
      fetchContentAccess();
    } catch (e: any) {
      setError(e.message);
      setAuthed(false);
    }
    setLoading(false);
  }, [adminKey, isTokenAdmin, authToken, fetchContentAccess]);

  // Auto-login: admin users auto-auth, or key from sessionStorage
  useEffect(() => {
    if (isTokenAdmin) { fetchUsers(); return; }
    if (adminKey && !authed) fetchUsers();
  }, [isTokenAdmin]); // eslint-disable-line

  /* ─── Actions ─── */
  async function createUser() {
    if (!newLogin || !newPass) return setError("Логин и пароль обязательны");
    setError("");
    try {
      const r = await fetch(API, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ login: newLogin, password: newPass, role: newRole, proDays: newRole === "pro" ? newDays : 0 }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setNewLogin("");
      setNewPass("");
      setNewRole("free");
      fetchUsers();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function updateUser() {
    if (!editing) return;
    setError("");
    try {
      const body: any = { login: editing.login, role: editRole, generationsLeft: editGens, isAdmin: editIsAdmin };
      if (editRole === "pro" && editDays > 0) body.proDays = editDays;
      if (editPass) body.password = editPass;
      const r = await fetch(API, { method: "PUT", headers: headers(), body: JSON.stringify(body) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setEditing(null);
      setEditPass("");
      fetchUsers();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function deleteUser(login: string) {
    setError("");
    try {
      const r = await fetch(API, { method: "DELETE", headers: headers(), body: JSON.stringify({ login }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setDeleting(null);
      fetchUsers();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function fetchRegRequests() {
    setRegLoading(true);
    try {
      const h: Record<string, string> = {};
      if (isTokenAdmin) h["Authorization"] = `Bearer ${authToken}`;
      else h["X-Admin-Key"] = adminKey;
      const r = await fetch(`${BASE}/api/admin/requests`, { headers: h });
      if (r.ok) {
        const data = await r.json();
        setRegRequests(data.requests || []);
      }
    } catch (_) {}
    setRegLoading(false);
  }

  async function saveContentAccessCfg() {
    if (!contentAccess) return;
    const anyLayout = Object.values(contentAccess.layouts).some((m) => m !== "none");
    if (!anyLayout) {
      setError("Нужен хотя бы один шаблон, не скрытый для всех");
      return;
    }
    setError("");
    setContentSaving(true);
    try {
      const r = await fetch(`${BASE}/api/admin/content-access`, {
        method: "PUT",
        headers: headers(),
        body: JSON.stringify(contentAccess),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Не удалось сохранить");
      setContentAccess(normalizeContentAccess(data));
    } catch (e: any) {
      setError(e.message);
    }
    setContentSaving(false);
  }

  function setVisibility<K extends keyof ContentAccessPayload>(category: K, id: string, mode: VisibilityMode) {
    setContentAccess((prev) => {
      const base = prev || defaultContentAccess();
      const cat = { ...base[category], [id]: mode };
      return { ...base, [category]: cat };
    });
  }

  function setCategoryAll<K extends keyof ContentAccessPayload>(category: K, mode: VisibilityMode) {
    setContentAccess((prev) => {
      const base = prev || defaultContentAccess();
      const keys = Object.keys(base[category]);
      const cat = { ...base[category] };
      for (const k of keys) (cat as Record<string, VisibilityMode>)[k] = mode;
      return { ...base, [category]: cat };
    });
  }

  async function dismissRegRequest(id: string) {
    try {
      const h: Record<string, string> = { "Content-Type": "application/json" };
      if (isTokenAdmin) h["Authorization"] = `Bearer ${authToken}`;
      else h["X-Admin-Key"] = adminKey;
      await fetch(`${BASE}/api/admin/requests`, {
        method: "DELETE",
        headers: h,
        body: JSON.stringify({ id }),
      });
      setRegRequests(prev => prev.filter(r => r.id !== id));
    } catch (_) {}
  }

  function openEdit(u: AdminUser) {
    setEditing(u);
    setEditRole(u.role);
    setEditDays(daysLeft(u.proExpires));
    setEditGens(u.generationsLeft);
    setEditPass("");
    setEditIsAdmin(!!u.isAdmin);
  }

  /* ─── Loading state for token-admin ─── */
  if (isTokenAdmin && !authed) {
    return (
      <div style={{ minHeight: "100vh", background: BG_PAGE, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Plus Jakarta Sans',system-ui,-apple-system,sans-serif" }}>
        <span style={{ fontSize: 15, color: "#888" }}>Загрузка...</span>
      </div>
    );
  }

  /* ─── Login gate (skip for token-admin users) ─── */
  if (!authed && !isTokenAdmin) {
    return (
      <div style={{ minHeight: "100vh", background: BG_PAGE, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Plus Jakarta Sans',system-ui,-apple-system,sans-serif" }}>
        <div style={{ ...card, maxWidth: 400, width: "100%", textAlign: "center", padding: "32px 28px" }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, background: G,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
            boxShadow: "0 6px 20px rgba(225,29,72,0.28)",
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: NAVY, marginBottom: 6, letterSpacing: -0.6 }}>Админ-панель</div>
          <div style={{ fontSize: 14, color: "#64748B", marginBottom: 22 }}>Введите секретный ключ</div>
          <input
            style={inputStyle}
            type="password"
            placeholder="Ключ администратора"
            value={adminKey}
            onChange={e => setAdminKey(e.target.value)}
            onKeyDown={e => e.key === "Enter" && fetchUsers()}
          />
          {error && (
            <div style={{
              marginTop: 10, padding: "8px 12px", borderRadius: 8,
              background: "rgba(225,29,72,0.06)", border: "1px solid rgba(225,29,72,0.18)",
              color: CRIMSON, fontSize: 13, fontWeight: 500,
            }}>{error}</div>
          )}
          <button style={{ ...btnPrimary, width: "100%", marginTop: 18, padding: "13px 0" }} onClick={fetchUsers} disabled={loading}>
            {loading ? "Проверка..." : "Войти"}
          </button>
          <div style={{ marginTop: 18 }}>
            <button onClick={onBack} style={{
              background: "none", border: "none", color: BLUE, fontSize: 14, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
            }}>← На главную</button>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Main admin panel ─── */
  return (
    <div style={{ minHeight: "100vh", background: BG_PAGE, padding: "0 0 40px", fontFamily: "'Plus Jakarta Sans',system-ui,-apple-system,sans-serif" }}>
      {/* Header */}
      <div style={{
        background: G, padding: "14px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 10,
        boxShadow: "0 2px 16px rgba(15,32,68,0.15)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} style={{
            background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)",
            color: "#fff", cursor: "pointer", width: 34, height: 34, borderRadius: 9,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
            fontFamily: "inherit",
          }}>←</button>
          <span style={{ color: "#fff", fontWeight: 800, fontSize: 18, letterSpacing: -0.3 }}>Админ-панель</span>
        </div>
        <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 500 }}>{users.length} пользователей</span>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "20px 16px" }}>
        {error && (
          <div style={{
            background: "rgba(225,29,72,0.06)", color: CRIMSON, padding: "10px 16px",
            borderRadius: 10, marginBottom: 16, fontSize: 14, fontWeight: 500,
            border: "1px solid rgba(225,29,72,0.18)",
          }}>
            {error}
          </div>
        )}

        {/* Create user form */}
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: NAVY, marginBottom: 16, letterSpacing: -0.2 }}>Создать пользователя</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={label}>Логин</label>
              <input style={inputStyle} placeholder="Логин" value={newLogin} onChange={e => setNewLogin(e.target.value)} />
            </div>
            <div>
              <label style={label}>Пароль</label>
              <input style={inputStyle} placeholder="Пароль" value={newPass} onChange={e => setNewPass(e.target.value)} />
            </div>
            <div>
              <label style={label}>Роль</label>
              <select style={selectStyle} value={newRole} onChange={e => setNewRole(e.target.value as "free" | "pro")}>
                <option value="free">Обычный (Free)</option>
                <option value="pro">Pro</option>
              </select>
            </div>
            {newRole === "pro" && (
              <div>
                <label style={label}>Дней Pro</label>
                <input style={inputStyle} type="number" min={1} value={newDays} onChange={e => setNewDays(+e.target.value)} />
              </div>
            )}
          </div>
          <button style={{ ...btnPrimary, marginTop: 16 }} onClick={createUser}>Создать</button>
        </div>

        {/* Доступность опций дизайна (не админы — по правилам ниже; админы видят всё) */}
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: NAVY, letterSpacing: -0.2 }}>Доступ к контенту</div>
              <div style={{ fontSize: 13, color: "#64748B", marginTop: 4, maxWidth: 620 }}>
                Обложки, шаблоны слайдов, шрифты, размеры и цветовые темы. Учётные записи с флагом администратора всегда видят полный список в редакторе.
              </div>
            </div>
            <button type="button" style={{ ...btnSecondary, fontSize: 12 }} onClick={fetchContentAccess} disabled={contentLoading}>
              {contentLoading ? "…" : "Обновить"}
            </button>
          </div>

          {contentAccess === null ? (
            <div style={{ color: "#94A3B8", fontSize: 14, padding: "12px 0" }}>Загрузка настроек…</div>
          ) : (
            <>
              {(
                [
                  ["covers", "Обложки", COVER_ITEMS, "covers"] as const,
                  ["layouts", "Шаблоны слайдов", LAYOUTS, "layouts"] as const,
                  ["fonts", "Шрифты", FONT_ITEMS, "fonts"] as const,
                  ["sizes", "Размеры", SIZE_ITEMS, "sizes"] as const,
                  ["themes", "Цвета (темы)", THEME_ITEMS, "themes"] as const,
                ] as const
              ).map(([sectionId, title, items, cat]) => (
                <div
                  key={sectionId}
                  style={{
                    marginBottom: 18,
                    paddingTop: 14,
                    borderTop: sectionId === "covers" ? "none" : "1px solid #F1F5F9",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: NAVY }}>{title}</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        style={{ ...btnSecondary, fontSize: 11, padding: "4px 10px" }}
                        onClick={() => setCategoryAll(cat, "all")}
                        disabled={contentLoading}
                      >
                        Все «видно всем»
                      </button>
                      <button
                        type="button"
                        style={{ ...btnSecondary, fontSize: 11, padding: "4px 10px" }}
                        onClick={() => setCategoryAll(cat, "none")}
                        disabled={contentLoading}
                      >
                        Все «скрыть для всех»
                      </button>
                    </div>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gap: 6,
                      maxHeight: sectionId === "layouts" ? 280 : 220,
                      overflowY: "auto",
                      paddingRight: 4,
                    }}
                  >
                    {items.map((row) => (
                      <div
                        key={row.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "minmax(120px, 1fr) minmax(200px, 2fr)",
                          gap: 10,
                          alignItems: "center",
                          fontSize: 12,
                          color: NAVY,
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{row.label}</span>
                        <select
                          value={contentAccess[cat][row.id] || "all"}
                          onChange={(e) => setVisibility(cat, row.id, e.target.value as VisibilityMode)}
                          style={{
                            ...selectStyle,
                            fontSize: 12,
                            padding: "6px 8px",
                            maxWidth: "100%",
                          }}
                        >
                          {VISIBILITY_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value} title={o.hint}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <button
                type="button"
                style={{ ...btnPrimary, marginTop: 8 }}
                onClick={saveContentAccessCfg}
                disabled={contentSaving}
              >
                {contentSaving ? "Сохранение…" : "Сохранить доступ к контенту"}
              </button>
            </>
          )}
        </div>

        {/* Registration requests */}
        {regRequests.length > 0 && (
          <div style={{ ...card, marginBottom: 20, border: "1px solid rgba(37,99,235,0.22)", background: "linear-gradient(180deg, rgba(37,99,235,0.04), rgba(37,99,235,0.01))" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 16, color: NAVY, letterSpacing: -0.2 }}>Заявки на регистрацию</span>
                <span style={{
                  fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 10,
                  background: G, color: "#fff", letterSpacing: 0.5,
                }}>{regRequests.length}</span>
              </div>
              <button onClick={fetchRegRequests} style={{ ...btnSecondary, fontSize: 12 }}>
                {regLoading ? "..." : "Обновить"}
              </button>
            </div>

            {regRequests.map(req => (
              <div key={req.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 14px", borderRadius: 10, marginBottom: 8,
                background: "#fff", border: "1px solid rgba(37,99,235,0.12)",
                flexWrap: "wrap", gap: 8,
              }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  {req.phone && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.6 1.2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.77a16 16 0 0 0 6.29 6.29l1.84-1.84a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                      </svg>
                      <a href={`tel:${req.phone}`} style={{ fontWeight: 600, fontSize: 14, color: NAVY, textDecoration: "none" }}>
                        {req.phone}
                      </a>
                    </div>
                  )}
                  {req.telegram && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="#64748B" aria-hidden="true">
                        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-2.04 9.607c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.53 14.6l-2.948-.92c-.64-.204-.654-.64.136-.953l11.51-4.44c.537-.194 1.006.131.834.96z"/>
                      </svg>
                      <a href={`https://t.me/${req.telegram}`} target="_blank" rel="noopener noreferrer"
                        style={{ fontWeight: 600, fontSize: 14, color: BLUE, textDecoration: "none" }}>
                        @{req.telegram}
                      </a>
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 4 }}>
                    {new Date(req.createdAt).toLocaleString("ru-RU", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" })}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {req.telegram && (
                    <a href={`https://t.me/${req.telegram}`} target="_blank" rel="noopener noreferrer"
                      style={{ ...btnSecondary, textDecoration: "none", display: "flex", alignItems: "center" }}>
                      Написать
                    </a>
                  )}
                  <button style={btnDanger} onClick={() => dismissRegRequest(req.id)}>✓ Обработано</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Users list */}
        <div style={{ ...card }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 16, color: NAVY, letterSpacing: -0.2 }}>Пользователи</span>
            <button onClick={fetchUsers} style={{ ...btnSecondary, fontSize: 12 }}>{loading ? "..." : "Обновить"}</button>
          </div>

          {users.length === 0 && <div style={{ color: "#94A3B8", fontSize: 14, textAlign: "center", padding: "24px 0" }}>Нет пользователей</div>}

          {users.map((u, idx) => (
            <div
              key={u.login}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 0",
                borderBottom: idx === users.length - 1 ? "none" : "1px solid #F1F5F9",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: NAVY }}>{u.login}</span>
                  {u.isAdmin && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: "rgba(225,29,72,0.1)", color: CRIMSON, letterSpacing: 0.5 }}>АДМИН</span>}
                </div>
                <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>Создан: {fmtDate(u.createdAt)}</div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  padding: "3px 10px",
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 0.8,
                  background: u.role === "pro" ? G : "#F1F5F9",
                  color: u.role === "pro" ? "#fff" : "#64748B",
                }}>
                  {u.role === "pro" ? "PRO" : "FREE"}
                </span>

                {u.role === "pro" && u.proExpires && (
                  <span style={{ fontSize: 12, color: BLUE, fontWeight: 600 }}>{daysLeft(u.proExpires)}д</span>
                )}
                {u.role === "free" && (
                  <span style={{ fontSize: 12, color: "#94A3B8", fontWeight: 600 }}>{u.generationsLeft}/5</span>
                )}
              </div>

              <div style={{ display: "flex", gap: 6 }}>
                <button style={btnSecondary} onClick={() => openEdit(u)}>Изменить</button>
                <button style={btnDanger} onClick={() => setDeleting(u.login)}>Удалить</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit modal */}
      {editing && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,32,68,0.55)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }} onClick={() => setEditing(null)}>
          <div style={{ ...card, maxWidth: 420, width: "100%", padding: "28px 24px", boxShadow: "0 24px 80px rgba(15,32,68,0.25)" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 800, fontSize: 18, color: NAVY, marginBottom: 18, letterSpacing: -0.3 }}>Редактировать: <span style={{ color: BLUE }}>{editing.login}</span></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={label}>Роль</label>
                <select style={selectStyle} value={editRole} onChange={e => setEditRole(e.target.value as "free" | "pro")}>
                  <option value="free">Обычный (Free)</option>
                  <option value="pro">Pro</option>
                </select>
              </div>
              {editRole === "pro" && (
                <div>
                  <label style={label}>Дней Pro (от сегодня)</label>
                  <input style={inputStyle} type="number" min={0} value={editDays} onChange={e => setEditDays(+e.target.value)} />
                </div>
              )}
              {editRole === "free" && (
                <div>
                  <label style={label}>Генерации</label>
                  <input style={inputStyle} type="number" min={0} value={editGens} onChange={e => setEditGens(+e.target.value)} />
                </div>
              )}
              <div>
                <label style={label}>Новый пароль (оставьте пустым чтобы не менять)</label>
                <input style={inputStyle} type="text" placeholder="Новый пароль" value={editPass} onChange={e => setEditPass(e.target.value)} />
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 14, color: NAVY, fontWeight: 600, padding: "10px 12px", borderRadius: 10, background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                <input type="checkbox" checked={editIsAdmin} onChange={e => setEditIsAdmin(e.target.checked)} style={{ width: 18, height: 18, accentColor: BLUE }} />
                Доступ к админ-панели (модератор)
              </label>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <button style={{ ...btnPrimary, flex: 1 }} onClick={updateUser}>Сохранить</button>
              <button style={{ ...btnSecondary, padding: "10px 22px" }} onClick={() => setEditing(null)}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleting && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,32,68,0.55)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }} onClick={() => setDeleting(null)}>
          <div style={{ ...card, maxWidth: 380, width: "100%", textAlign: "center", padding: "28px 24px", boxShadow: "0 24px 80px rgba(15,32,68,0.25)" }} onClick={e => e.stopPropagation()}>
            <div style={{
              width: 48, height: 48, borderRadius: 12, margin: "0 auto 14px",
              background: "rgba(225,29,72,0.1)", border: "1px solid rgba(225,29,72,0.22)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={CRIMSON} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: NAVY, marginBottom: 6, letterSpacing: -0.3 }}>Удалить пользователя?</div>
            <div style={{ fontSize: 14, color: "#64748B", marginBottom: 22 }}><strong style={{ color: NAVY }}>{deleting}</strong> будет удалён без возможности восстановления</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button style={{ ...btnDanger, padding: "11px 22px", fontSize: 14 }} onClick={() => deleteUser(deleting)}>Удалить</button>
              <button style={{ ...btnSecondary, padding: "11px 22px", fontSize: 14 }} onClick={() => setDeleting(null)}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
