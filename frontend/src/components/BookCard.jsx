import { useState } from "react";
import { useTheme } from "../App";
import { StarRating, Avatar, genreColor, ProgressBar, STATUS_COLORS } from "./ui";

// Safe date formatter — handles strings, Date objects, and bad values
function fmtDate(d) {
  if (!d) return null;
  try {
    const s = typeof d === "object" ? d.toISOString().slice(0,10) : String(d).slice(0,10);
    const dt = new Date(s + "T12:00:00");
    if (isNaN(dt)) return null;
    return dt.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  } catch { return null; }
}

export default function BookCard({ book, reviews = [], myProgress, currentUser, onClick }) {
  const { C }  = useTheme();
  const [showTw, setShowTw] = useState(false);

  const avg      = reviews.filter(r=>r.rating>0).reduce((s,r,_,a) => s+r.rating/a.length, 0);
  const myReview = reviews.find(r => r.member_id === currentUser?.id);
  const genres   = book.genres || [];
  const tws      = book.trigger_warnings || [];
  const isBotm   = !!book.botm_month;
  const readDate = fmtDate(book.date_read);

  return (
    <div style={{ background:`linear-gradient(160deg,${C.card} 60%,${C.card2})`, border:`1px solid ${isBotm?"#d4af37":C.border}`, borderRadius:4, padding:"0 0 14px", cursor:"pointer", position:"relative", display:"flex", flexDirection:"column", transition:"transform 0.18s,box-shadow 0.18s", boxShadow:isBotm?"0 2px 20px #d4af3744":"0 2px 14px #00000055", overflow:"hidden" }}
      onMouseEnter={e => { e.currentTarget.style.transform="translateY(-3px)"; e.currentTarget.style.boxShadow=isBotm?"0 8px 30px #d4af3755":"0 8px 30px #000a"; }}
      onMouseLeave={e => { e.currentTarget.style.transform=""; e.currentTarget.style.boxShadow=isBotm?"0 2px 20px #d4af3744":"0 2px 14px #00000055"; }}
    >
      {/* BOTM banner */}
      {isBotm && (
        <div style={{ position:"absolute", top:0, left:0, right:0, background:"linear-gradient(90deg,#b8860b,#d4af37,#b8860b)", padding:"5px 10px", display:"flex", alignItems:"center", justifyContent:"center", gap:6, zIndex:2 }}>
          <span style={{ fontSize:12 }}>🔥</span>
          <span style={{ fontFamily:"monospace", fontSize:10, fontWeight:700, color:"#1a1000", letterSpacing:1 }}>BOOK OF THE MONTH — {book.botm_month.toUpperCase()}</span>
          <span style={{ fontSize:12 }}>🔥</span>
        </div>
      )}

      {/* Cover */}
      <div onClick={() => onClick(book)}>
        {book.cover_url
          ? <img src={book.cover_url} alt={book.title} style={{ width:"100%", height:isBotm?207:180, objectFit:"cover", display:"block", marginTop:isBotm?27:0 }} />
          : <div style={{ width:"100%", height:isBotm?35:8, background:genres.length?genreColor(genres[0]):C.dim, marginTop:isBotm?27:0 }} />
        }
      </div>

      <div style={{ padding:"14px 16px 0", display:"flex", flexDirection:"column", gap:6, flex:1 }}>
        {/* Title + author */}
        <div onClick={() => onClick(book)} style={{ cursor:"pointer" }}>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:15, color:C.text, fontWeight:700, lineHeight:1.3 }}>{book.title}</div>
          {book.author && <div style={{ fontFamily:"'EB Garamond',serif", fontSize:13, color:C.muted, fontStyle:"italic" }}>{book.author}</div>}
          {book.series && <div style={{ fontFamily:"monospace", fontSize:11, color:C.accent2, marginTop:2 }}>📚 {book.series}</div>}
          {readDate && <div style={{ fontFamily:"monospace", fontSize:10, color:C.dimmer, marginTop:2 }}>Read {readDate}</div>}
        </div>

        {/* Genres */}
        {genres.length > 0 && (
          <div onClick={() => onClick(book)} style={{ display:"flex", gap:4, flexWrap:"wrap", cursor:"pointer" }}>
            {genres.map(g => (
              <span key={g} style={{ fontFamily:"monospace", fontSize:10, color:genreColor(g), background:C.bg, padding:"1px 6px", borderRadius:20, border:`1px solid ${genreColor(g)}55` }}>{g}</span>
            ))}
          </div>
        )}

        {/* Trigger warnings */}
        {tws.length > 0 && (
          <div>
            <button onClick={e => { e.stopPropagation(); setShowTw(v => !v); }}
              style={{ background:"transparent", border:"1px solid #c0404055", borderRadius:20, color:"#c04040", fontFamily:"monospace", fontSize:10, padding:"2px 8px", cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>
              ⚠ {showTw ? "Hide" : "Show"} trigger warnings ({tws.length})
            </button>
            {showTw && (
              <div style={{ marginTop:5, display:"flex", flexWrap:"wrap", gap:4 }}>
                {tws.map(t => (
                  <span key={t} style={{ fontFamily:"monospace", fontSize:10, color:"#e06060", background:"#c0404022", padding:"1px 7px", borderRadius:20, border:"1px solid #c0404044" }}>{t}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Rating */}
        <div onClick={() => onClick(book)} style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer" }}>
          <StarRating value={Math.round(avg)} size={13} />
          {reviews.length > 0 && <span style={{ fontFamily:"monospace", fontSize:11, color:C.dimmer }}>{avg.toFixed(1)} ({reviews.length})</span>}
        </div>

        {/* Member avatars */}
        {reviews.length > 0 && (
          <div onClick={() => onClick(book)} style={{ display:"flex", gap:3, alignItems:"center", flexWrap:"wrap", cursor:"pointer" }}>
            {reviews.slice(0,6).map(r => (
              <div key={r.member_id} title={r.member_name}><Avatar name={r.member_name} src={r.member_avatar} size={20} /></div>
            ))}
            {!myReview && <span style={{ fontFamily:"monospace", fontSize:10, color:C.dimmer }}>not reviewed</span>}
          </div>
        )}

        {/* Reading progress */}
        {myProgress && myProgress.status !== "want_to_read" && (
          <div onClick={() => onClick(book)} style={{ cursor:"pointer" }}>
            <span style={{ fontFamily:"monospace", fontSize:10, color:STATUS_COLORS[myProgress.status] }}>
              {myProgress.status === "reading" && myProgress.total_pages
                ? `📖 p.${myProgress.current_page}/${myProgress.total_pages}`
                : myProgress.status === "finished" ? "✅ Finished"
                : myProgress.status === "dnf" ? "💀 DNF" : ""}
            </span>
            {myProgress.status === "reading" && myProgress.total_pages && (
              <ProgressBar current={myProgress.current_page} total={myProgress.total_pages} color={C.accent} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
