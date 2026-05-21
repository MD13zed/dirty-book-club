import { Link, useNavigate } from "react-router-dom";
import { useAuth, useTheme } from "../App";
import { THEMES } from "../theme";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { C, theme, updateTheme } = useTheme();
  const nav = useNavigate();

  return (
    <nav style={{ background:`linear-gradient(180deg,${C.bg2},${C.bg})`, borderBottom:`1px solid ${C.border}`, padding:"12px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap", position:"sticky", top:0, zIndex:50, backdropFilter:"blur(8px)" }}>
      <Link to="/" style={{ textDecoration:"none", display:"flex", alignItems:"baseline", gap:8 }}>
        <span style={{ fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:900, color:C.accent, fontStyle:"italic" }}>DIRTY</span>
        <span style={{ fontFamily:"'Playfair Display',serif", fontSize:13, fontWeight:700, color:C.dim, letterSpacing:2 }}>BOOK CLUB</span>
      </Link>

      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        {/* Theme picker */}
        <select value={theme} onChange={e => updateTheme(e.target.value)}
          style={{ background:C.vdark, border:`1px solid ${C.border}`, borderRadius:4, color:C.dim, fontFamily:"monospace", fontSize:11, padding:"5px 8px", cursor:"pointer", outline:"none" }}>
          {Object.entries(THEMES).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>

        {user?.is_admin && (
          <Link to="/admin" style={{ fontFamily:"monospace", fontSize:12, color:C.accent, textDecoration:"none", padding:"5px 10px", border:`1px solid ${C.accent}44`, borderRadius:4 }}>
            ⚙ Admin
          </Link>
        )}

        {/* Avatar + profile link */}
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
    </nav>
  );
}
