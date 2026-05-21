import { getTheme } from "../theme";
const C = getTheme("dark-purple");

export default function Login() {
  return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:`linear-gradient(160deg,${C.card},${C.card2})`, border:`1px solid ${C.border}`, borderRadius:8, padding:"48px 40px", maxWidth:400, width:"100%", boxShadow:"0 24px 80px #00000099", textAlign:"center" }}>

        <div style={{ fontSize:48, marginBottom:12 }}>🔥</div>
        <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:34, fontWeight:900, color:C.text, fontStyle:"italic", lineHeight:1 }}>DIRTY</h1>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:16, fontWeight:700, color:C.muted, letterSpacing:3, marginBottom:8 }}>BOOK CLUB</div>
        <p style={{ fontFamily:"'EB Garamond',serif", fontSize:15, color:C.dim, fontStyle:"italic", marginBottom:36 }}>
          Your private library of spicy reads
        </p>

        {/* Discord Login Button */}
        <a href="/auth/discord" style={{ textDecoration:"none" }}>
          <button style={{
            width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:12,
            background:"#5865F2", border:"none", borderRadius:6,
            color:"#fff", fontFamily:"'Playfair Display',serif", fontSize:16, fontWeight:700,
            padding:"14px 0", cursor:"pointer",
            boxShadow:"0 4px 20px #5865F244",
            transition:"transform 0.15s, box-shadow 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow="0 8px 30px #5865F266"; }}
          onMouseLeave={e => { e.currentTarget.style.transform=""; e.currentTarget.style.boxShadow="0 4px 20px #5865F244"; }}
          >
            {/* Discord logo SVG */}
            <svg width="22" height="22" viewBox="0 0 71 55" fill="none">
              <path d="M60.1 4.9A58.5 58.5 0 0 0 45.5.6a40.3 40.3 0 0 0-1.8 3.7 54 54 0 0 0-16.3 0A40 40 0 0 0 25.6.6 58.4 58.4 0 0 0 10.9 5C1.6 18.8-1 32.3.3 45.6a58.9 58.9 0 0 0 18 9.1 44.3 44.3 0 0 0 3.8-6.2 38.3 38.3 0 0 1-6-2.9l1.5-1.1a42 42 0 0 0 35.9 0l1.5 1.1a38.3 38.3 0 0 1-6 2.9 44 44 0 0 0 3.8 6.2 58.7 58.7 0 0 0 18-9.1C72 30.2 68.4 16.8 60.1 4.9ZM23.7 37.6c-3.5 0-6.4-3.2-6.4-7.1s2.8-7.1 6.4-7.1 6.4 3.2 6.4 7.1-2.9 7.1-6.4 7.1Zm23.6 0c-3.5 0-6.4-3.2-6.4-7.1s2.8-7.1 6.4-7.1 6.4 3.2 6.4 7.1-2.9 7.1-6.4 7.1Z" fill="currentColor"/>
            </svg>
            Login with Discord
          </button>
        </a>

        <p style={{ marginTop:20, fontFamily:"monospace", fontSize:11, color:C.dimmer }}>
          Only Discord username &amp; avatar are used — no messages, no servers.
        </p>
      </div>
    </div>
  );
}
