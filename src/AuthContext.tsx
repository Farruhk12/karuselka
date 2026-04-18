import { createContext, useContext, useState, useEffect, useCallback } from "react";

const isDev = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const BASE = isDev ? "https://karuselka.vercel.app" : "";

interface Profile {
  login: string;
  role: "free" | "pro";
  generationsLeft: number;
  proExpires: string | null;
  isAdmin?: boolean;
  totalGenerations?: number; // all-time carousels created
  createdAt?: string;        // account registration date ISO
}

interface AuthCtx {
  user: Profile | null;
  token: string | null;
  loading: boolean;
  login: (login: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  useGeneration: () => Promise<{ allowed: boolean; generationsLeft: number }>;
}

const Ctx = createContext<AuthCtx>({
  user: null, token: null, loading: true,
  login: async () => null,
  logout: async () => {},
  refreshProfile: async () => {},
  useGeneration: async () => ({ allowed: false, generationsLeft: 0 }),
});

export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  const headers = useCallback((t?: string) => ({
    "Content-Type": "application/json",
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  }), []);

  const refreshProfile = useCallback(async () => {
    const t = localStorage.getItem("token");
    if (!t) { setUser(null); setLoading(false); return; }
    try {
      const res = await fetch(`${BASE}/api/user/profile`, { headers: headers(t) });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        setToken(t);
      } else {
        localStorage.removeItem("token");
        setUser(null);
        setToken(null);
      }
    } catch {
      setUser(null);
    }
    setLoading(false);
  }, [headers]);

  useEffect(() => { refreshProfile(); }, [refreshProfile]);

  const loginFn = async (login: string, password: string): Promise<string | null> => {
    try {
      const res = await fetch(`${BASE}/api/auth/login`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ login, password }),
      });
      const data = await res.json();
      if (!res.ok) return data.error || "Ошибка входа";
      localStorage.setItem("token", data.token);
      setToken(data.token);
      setUser(data.profile);
      return null; // no error
    } catch {
      return "Ошибка сети";
    }
  };

  const logout = async () => {
    const t = localStorage.getItem("token");
    if (t) {
      fetch(`${BASE}/api/auth/logout`, { method: "POST", headers: headers(t) }).catch(() => {});
    }
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  const useGeneration = async (): Promise<{ allowed: boolean; generationsLeft: number }> => {
    const t = localStorage.getItem("token");
    if (!t) return { allowed: false, generationsLeft: 0 };
    try {
      const res = await fetch(`${BASE}/api/user/generate`, { method: "POST", headers: headers(t) });
      const data = await res.json();
      if (data.allowed !== undefined) {
        // Update local profile
        if (user) {
          setUser({ ...user, generationsLeft: data.generationsLeft === -1 ? user.generationsLeft : data.generationsLeft });
        }
        return data;
      }
      return { allowed: false, generationsLeft: 0 };
    } catch {
      return { allowed: false, generationsLeft: 0 };
    }
  };

  return (
    <Ctx.Provider value={{ user, token, loading, login: loginFn, logout, refreshProfile, useGeneration }}>
      {children}
    </Ctx.Provider>
  );
}
