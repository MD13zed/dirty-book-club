import { Link, useNavigate } from "react-router-dom";
import { useAuth, useTheme } from "../App";
import { THEMES } from "../theme";
import { useState, useEffect } from "react";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return isMobile;
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const { C, theme, updateTheme } = useTheme();
  const [themeOpen, setThemeOpen] = useState(false);
  const nav = useNavigate();
  const isMobile = useIsMobile();

  return (
    <nav style={{ background:`linear-gradient(180deg,${C.bg2},${C.bg})`, borderBottom:`1px solid ${C.border}`, padding: isMobile ? "10px 16px" : "12px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, position:"sticky", top:0, zIndex:50, backdropFilter:"blur(8px)" }}>

      <Link to="/" style={{ textDecoration:"none", display:"flex", alignItems:"baseline", gap:8 }}>
        <span style={{ fontFamily:"'Playfair Display',serif", fontSize: isMobile ? 20 : 24, fontWeight:900, color:C.accent, fontStyle:"italic" }}>DIRTY</span>
        <span style={{ fontFamily:"'Playfair Display',serif", fontSize: isMobile ? 11 : 13, fontWeight:700, color:C.dim, letterSpacing:2 }}>BOOK CLUB</span>
      </Link>

      {!isMobile && (
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <select value={theme} onChange={e => updateTheme(e.target.value)}
            style={{ background:C.vdark, border:`1px solid ${C.border}`, borderRadius:4, color:C.dim, fontFamily:"monospace", fontSize:11, padding:"5px 8px", cursor:"pointer", outline:"none" }}>
            {Object.entries(THEMES).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          {user?.is_admin && (
            <Link to="/admin" style={{ fontFamily:"monospace", fontSize:12, color:C.accent, textDecoration:"none", padding:"5px 10px", border:`1px solid ${C.accent}44`, borderRadius:4 }}>
              ⚙ Admin
            </Link>
          )}
          <Link to={`/profile/${user?.id}`} style={{ textDecoration:"none", display:"flex", alignItems:"center", gap:8 }}>
            {user?.avatar_url
              ? <img src={user.avatar_url} alt="" style={{ width:30, height:30, borderRadius:"50%", border:`2px solid ${C.accent}` }} />
              : <div style={{ width:30, height:30, borderRadius:"50%", background:C.accent2, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, color:C.bg, fontWeight:700 }}>
                  {(user?.display_name||"?")[0].toUpperCase()}
                </div>
            }
            <span style={{ fontFamily:"monospace", fontSize:12, color:C.muted }}>{user?.display_name}</span>
          </Link>
          <button onClick={() => { logout(); nav("/"); }} style={{ background:"transparent", border:`1px solid ${C.border}`, borderRadius:4, color:C.dimmer, fontFamily:"monospace", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
            Sign out
          </button>
        </div>
      )}

      {isMobile && (
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ position:"relative" }}>
            <button
              onClick={() => setThemeOpen(o => !o)}
              style={{ background:"transparent", border:`1px solid ${C.border}`, borderRadius:20, color:C.dim, fontFamily:"monospace", fontSize:11, padding:"5px 10px", cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>
              🎨 <span>{THEMES[theme]?.label?.split(" ")[0]}</span>
            </button>
            {themeOpen && (
              <div style={{ position:"absolute", top:"calc(100% + 6px)", right:0, background:C.card, border:`1px solid ${C.border}`, borderRadius:8, zIndex:200, minWidth:140, boxShadow:"0 8px 24px #0007", overflow:"hidden" }}>
                {Object.entries(THEMES).map(([k,v]) => (
                  <button key={k} onClick={() => { updateTheme(k); setThemeOpen(false); }}
                    style={{ display:"block", width:"100%", background:theme===k?C.accent+"22":"transparent", border:"none", borderBottom:`1px solid ${C.border2}`, color:theme===k?C.accent:C.dim, fontFamily:"monospace", fontSize:12, padding:"10px 14px", cursor:"pointer", textAlign:"left" }}>
                    {theme===k ? "✓ " : ""}{v.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {user?.is_admin && (
            <Link to="/admin" style={{ fontFamily:"monospace", fontSize:12, color:C.accent, textDecoration:"none", padding:"5px 9px", border:`1px solid ${C.accent}44`, borderRadius:4 }}>⚙</Link>
          )}
          <Link to={`/profile/${user?.id}`} style={{ textDecoration:"none" }}>
            {user?.avatar_url
              ? <img src={user.avatar_url} alt="" style={{ width:34, height:34, borderRadius:"50%", border:`2px solid ${C.accent}`, display:"block" }} />
              : <div style={{ width:34, height:34, borderRadius:"50%", background:C.accent2, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, color:C.bg, fontWeight:700 }}>
                  {(user?.display_name||"?")[0].toUpperCase()}
                </div>
            }
          </Link>
        </div>
      )}
    </nav>
  );
}
