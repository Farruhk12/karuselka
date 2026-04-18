import { StrictMode, useState, useEffect, Component, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider, useAuth } from "./AuthContext";
import Landing from "./Landing";
import AppShell from "./AppShell";
import LoginPage from "./LoginPage";
import ProfilePage from "./ProfilePage";
import AdminPage from "./AdminPage";

// Apply saved theme on load
if (typeof window !== "undefined") {
  const saved = localStorage.getItem("theme");
  if (saved === "dark") document.documentElement.setAttribute("data-theme", "dark");
}

type Page = "landing" | "app" | "login" | "profile" | "admin";

class RootErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Root render failed", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: "100vh",
          background: "#0f1b2d",
          color: "#f8fafc",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          fontFamily: "system-ui, sans-serif",
        }}>
          <div style={{
            width: "100%",
            maxWidth: 680,
            background: "rgba(15, 23, 42, 0.88)",
            border: "1px solid rgba(148, 163, 184, 0.28)",
            borderRadius: 20,
            padding: 24,
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.35)",
          }}>
            <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 10 }}>Что-то пошло не так</div>
            <div style={{ fontSize: 16, lineHeight: 1.6, color: "rgba(226,232,240,0.88)", marginBottom: 16 }}>
              Приложение поймало ошибку вместо пустого экрана. Обновите страницу. Если ошибка повторится, текст ниже поможет быстро найти причину.
            </div>
            <pre style={{
              margin: 0,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontSize: 13,
              lineHeight: 1.5,
              padding: 16,
              borderRadius: 14,
              background: "rgba(2, 6, 23, 0.9)",
              color: "#fda4af",
              overflowX: "auto",
            }}>
              {this.state.error.message}
            </pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function hashToPage(): Page {
  const h = window.location.hash;
  if (h === "#app") return "app";
  if (h === "#login") return "login";
  if (h === "#profile") return "profile";
  if (h === "#admin") return "admin";
  return "landing";
}

function Router() {
  const [page, setPage] = useState<Page>(hashToPage);
  const { user, loading } = useAuth();

  useEffect(() => {
    const onHash = () => setPage(hashToPage());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = (p: Page) => {
    setPage(p);
    window.location.hash = p === "landing" ? "" : `#${p}`;
    window.scrollTo(0, 0);
  };

  // Redirect to login if not authed and trying to access app/profile
  if (!loading && !user && (page === "app" || page === "profile")) {
    go("login");
    return null;
  }

  if (loading && (page === "app" || page === "profile")) {
    return <div style={{ minHeight: "100vh", background: "var(--color-background-page)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontSize: 15, color: "var(--color-text-secondary)" }}>Загрузка...</span>
    </div>;
  }

  if (page === "admin") return <AdminPage onBack={() => go("landing")} />;
  if (page === "login") return <LoginPage onSuccess={() => go("app")} onBack={() => go("landing")} />;
  if (page === "profile") return <ProfilePage onBack={() => go("app")} onLogout={() => go("landing")} onAdmin={() => go("admin")} />;
  if (page === "app") return <AppShell onBack={() => go("landing")} onProfile={() => go("profile")} />;
  return <Landing onStart={() => user ? go("app") : go("login")} onLogin={() => go("login")} onProfile={() => go("profile")} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <RootErrorBoundary>
        <Router />
      </RootErrorBoundary>
    </AuthProvider>
  </StrictMode>
);
