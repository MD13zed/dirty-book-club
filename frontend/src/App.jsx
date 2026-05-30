import { useState, useEffect, createContext, useContext } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { api }       from "./api";
import { getTheme }  from "./theme";
import ErrorBoundary  from "./components/ErrorBoundary";
import Navbar        from "./components/Navbar";
import Login         from "./pages/Login";
import Library       from "./pages/Library";
import Profile       from "./pages/Profile";
import Admin         from "./pages/Admin";
import LoginSuccess  from "./pages/LoginSuccess";

// ── Auth Context ──────────────────────────────────────────────────────────────
export const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

// ── Theme Context ─────────────────────────────────────────────────────────────
export const ThemeCtx = createContext(null);
export const useTheme = () => useContext(ThemeCtx);

export default function App() {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme,   setThemeName] = useState("dark-purple");
  const C = getTheme(theme);

  useEffect(() => {
    const t = localStorage.getItem("dbc_token");
    if (!t) { setLoading(false); return; }
    api.getMe()
      .then(u => { setUser(u); setThemeName(u.theme || "dark-purple"); })
      .catch(() => localStorage.removeItem("dbc_token"))
      .finally(() => setLoading(false));
  }, []);

  const login = (token, userData) => {
    localStorage.setItem("dbc_token", token);
    setUser(userData);
    setThemeName(userData.theme || "dark-purple");
  };

  const logout = () => {
    localStorage.removeItem("dbc_token");
    setUser(null);
  };

  const updateTheme = async (name) => {
    setThemeName(name);
    if (user) {
      await api.updateMe({ ...user, theme: name });
      setUser(u => ({ ...u, theme: name }));
    }
  };

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#0d0a14", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <span style={{ fontFamily:"'Playfair Display',serif", fontSize:22, color:"#b08af0", fontStyle:"italic" }}>Loading…</span>
    </div>
  );

  return (
    <AuthCtx.Provider value={{ user, login, logout }}>
      <ThemeCtx.Provider value={{ C, theme, updateTheme }}>
        <div style={{ minHeight:"100vh", background:C.bg, color:C.text, fontFamily:"'EB Garamond',serif" }}>
          {user && <Navbar />}
          <ErrorBoundary>
            <Routes>
              <Route path="/"              element={user ? <Library /> : <Login />} />
              <Route path="/login-success" element={<LoginSuccess />} />
              <Route path="/profile/:id"   element={user ? <Profile /> : <Navigate to="/" />} />
              <Route path="/admin"         element={user?.is_admin ? <Admin /> : <Navigate to="/" />} />
              <Route path="*"              element={<Navigate to="/" />} />
            </Routes>
          </ErrorBoundary>
        </div>
      </ThemeCtx.Provider>
    </AuthCtx.Provider>
  );
}
