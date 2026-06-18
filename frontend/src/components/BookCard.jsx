import { useState, useEffect } from "react";
import { useTheme } from "../App";
import { StarRating, Avatar, genreColor, ProgressBar, STATUS_COLORS } from "./ui";
import { coverSrc } from "../api";

function fmtDate(d) {
  if (!d) return null;
  try {
    const s = typeof d === "object" ? d.toISOString().slice(0,10) : String(d).slice(0,10);
    const dt = new Date(s + "T12:00:00");
    if (isNaN(dt)) return null;
    return dt.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  } catch { return null; }
}

const COVER_H = 180; // fixed cover height for all cards

function twDismissKey(userId, bookId) { return `tw_dismissed_${userId}_${bookId}`; }

export default function BookCard({ book, reviews = [], myProgress, currentUser, onClick, onNominate, isNominated }) {
  const { C }  = useTheme();
  const [showTw,     setShowTw]     = useState(false);
  const [twDismissed, setTwDismissed] = useState(false);

  // Load dismissed state from localStorage on mount
  useEffect(() => {
    if (!currentUser?.id || !book.id) return;
    const dismissed = localStorage.getItem(twDismissKey(currentUser.id, book.id));
    if (dismissed === "1") setTwDismissed(true);
  }, [currentUser?.id, book.id]);

  const dismissTw = (e) => {
    e.stopPropagation();
    localStorage.setItem(twDismissKey(currentUser.id, book.id), "1");
    setTwDismissed(true);
    setShowTw(false);
  };

  const undismissTw = (e) => {
    e.stopPropagation();
    localStorage.removeItem(twDismissKey(currentUser.id, book.id));
    setTwDismissed(false);
  };

  const avg      = reviews.filter(r=>r.rating>0).reduce((s,r,_,a) => s+r.rating/a.length, 0);
  const myReview = reviews.find(r => r.member_id === currentUser?.id);
  const genres   = book.genres || [];
  const tws      = book.trigger_warnings || [];
  const isBotm   = !!book.botm_month;
  const readDate = fmtDate(book.date_read);
  const mainColor = genres.length ? genreColor(genres[0]) : C.dim;

  return (
    <div style={{ background:`linear-gradient(160deg,${C.card} 60%,${C.card2})`, border:`1px solid ${isBotm?"#d4af37":C.border}`, borderRadius:4, cursor:"pointer", display:"flex", flexDirection:"column", transition:"transform 0.18s,box-shadow 0.18s", boxShadow:isBotm?"0 2px 20px #d4af3744":"0 2px 14px #00000055", overflow:"hidden", height:"100%" }}
      onMouseEnter={e => { e.currentTarget.style.transform="translateY(-3px)"; e.currentTarget.style.boxShadow=isBotm?"0 8px 30px #d4af3755":"0 8px 30px #000a"; }}
      onMouseLeave={e => { e.currentTarget.style.transform=""; e.currentTarget.style.boxShadow=isBotm?"0 2px 20px #d4af3744":"0 2px 14px #00000055"; }}
    >
      {/* Fixed-height cover area — same for every card */}
      <div onClick={() => onClick(book)} style={{ position:"relative", width:"100%", height:COVER_H, flexShrink:0, overflow:"hidden" }}>
        {book.cover_url
          ? <img src={coverSrc(book.cover_url)} alt={book.title} style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
          : <div style={{ width:"100%", height:"100%", background:`linear-gradient(160deg,${mainColor}33,${mainColor}11)`, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontFamily:"'Playfair Display',serif", fontSize:13, color:mainColor, opacity:0.6, textAlign:"center", padding:"0 16px", lineHeight:1.4 }}>{book.title}</span>
            </div>
        }
        {/* BOTM banner overlaid on cover */}
        {isBotm && (
          <div style={{ position:"absolute", top:0, left:0, right:0, background:"linear-gradient(90deg,#b8860bcc,#d4af37cc,#b8860bcc)", padding:"5px 10px", display:"flex", alignItems:"center", justifyContent:"center", gap:6, backdropFilter:"blur(2px)" }}>
            <span style={{ fontSize:10 }}>🔥</span>
            <span style={{ fontFamily:"monospace", fontSize:9, fontWeight:700, color:"#1a1000", letterSpacing:1 }}>BOTM — {book.botm_month.toUpperCase()}</span>
            <span style={{ fontSize:10 }}>🔥</span>
          </div>
        )}
        {/* Genre accent bar at bottom of cover */}
        <div style={{ position:"absolute", bottom:0, left:0, right:0, height:3, background:mainColor, opacity:0.8 }} />
      </div>

      {/* Card body — flex:1 so all cards fill equal height */}
      <div style={{ padding:"12px 14px", display:"flex", flexDirection:"column", gap:5, flex:1 }}>

        {/* Title + author */}
        <div onClick={() => onClick(book)} style={{ cursor:"pointer" }}>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:14, color:C.text, fontWeight:700, lineHeight:1.3 }}>{book.title}</div>
          {book.author && <div style={{ fontFamily:"'EB Garamond',serif", fontSize:12, color:C.muted, fontStyle:"italic" }}>{book.author}</div>}
          {book.series && <div style={{ fontFamily:"monospace", fontSize:10, color:C.accent2, marginTop:1 }}>📚 {book.series}</div>}
          {readDate && <div style={{ fontFamily:"monospace", fontSize:10, color:C.dimmer, marginTop:1 }}>Read {readDate}</div>}
        </div>

        {/* Genres */}
        {genres.length > 0 && (
          <div onClick={() => onClick(book)} style={{ display:"flex", gap:3, flexWrap:"wrap", cursor:"pointer" }}>
            {genres.map(g => (
              <span key={g} style={{ fontFamily:"monospace", fontSize:9, color:genreColor(g), background:C.bg, padding:"1px 5px", borderRadius:20, border:`1px solid ${genreColor(g)}55` }}>{g}</span>
            ))}
          </div>
        )}

        {/* Trigger warnings */}
        {tws.length > 0 && (
          <div>
            {twDismissed ? (
              // Dismissed — show a subtle "TW" hint they can tap to restore
              <button onClick={undismissTw}
                style={{ background:"transparent", border:"none", color:"#c0404066", fontFamily:"monospace", fontSize:9, padding:"0", cursor:"pointer" }}>
                ⚠ TW dismissed — show again
              </button>
            ) : (
              <>
                <button onClick={e => { e.stopPropagation(); setShowTw(v => !v); }}
                  style={{ background:"transparent", border:"1px solid #c0404055", borderRadius:20, color:"#c04040", fontFamily:"monospace", fontSize:9, padding:"2px 7px", cursor:"pointer" }}>
                  ⚠ {showTw ? "hide" : "show"} TW ({tws.length})
                </button>
                {showTw && (
                  <div style={{ marginTop:4 }}>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:3, marginBottom:4 }}>
                      {tws.map(t => (
                        <span key={t} style={{ fontFamily:"monospace", fontSize:9, color:"#e06060", background:"#c0404022", padding:"1px 6px", borderRadius:20, border:"1px solid #c0404044" }}>{t}</span>
                      ))}
                    </div>
                    <button onClick={dismissTw}
                      style={{ background:"transparent", border:"none", color:"#c0404088", fontFamily:"monospace", fontSize:9, padding:0, cursor:"pointer", textDecoration:"underline" }}>
                      dismiss — don't show again
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Rating */}
        <div onClick={() => onClick(book)} style={{ display:"flex", alignItems:"center", gap:5, cursor:"pointer" }}>
          <StarRating value={Math.round(avg)} size={12} />
          {reviews.length > 0 && <span style={{ fontFamily:"monospace", fontSize:10, color:C.dimmer }}>{avg.toFixed(1)} ({reviews.length})</span>}
        </div>

        {/* Member avatars */}
        {reviews.length > 0 && (
          <div onClick={() => onClick(book)} style={{ display:"flex", gap:4, alignItems:"flex-end", flexWrap:"wrap", cursor:"pointer" }}>
            {reviews.slice(0,6).map(r => (
              <div key={r.member_id} title={r.member_name} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
                <Avatar name={r.member_name} src={r.member_avatar} size={18} />
                <span style={{ fontFamily:"monospace", fontSize:8, color:C.dimmer, maxWidth:30, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", textAlign:"center" }}>
                  {(r.member_name||"").split(" ")[0]}
                </span>
              </div>
            ))}
            {!myReview && <span style={{ fontFamily:"monospace", fontSize:9, color:C.dimmer, alignSelf:"center" }}>not reviewed</span>}
          </div>
        )}

        {/* Reading progress */}
        {myProgress && myProgress.status !== "want_to_read" && (
          <div onClick={() => onClick(book)} style={{ cursor:"pointer" }}>
            {myProgress.status === "reading" && (
              <>
                <span style={{ fontFamily:"monospace", fontSize:9, color:STATUS_COLORS["reading"] }}>
                  📖 {myProgress.current_page && myProgress.total_pages
                    ? `p.${myProgress.current_page} of ${myProgress.total_pages} · ${Math.round((myProgress.current_page/myProgress.total_pages)*100)}%`
                    : myProgress.current_page ? `p.${myProgress.current_page}` : "Reading"}
                </span>
                {myProgress.current_page && myProgress.total_pages && (
                  <ProgressBar current={myProgress.current_page} total={myProgress.total_pages} color={STATUS_COLORS["reading"]} />
                )}
              </>
            )}
            {myProgress.status === "finished" && (
              <>
                <span style={{ fontFamily:"monospace", fontSize:9, color:STATUS_COLORS["finished"] }}>✅ Finished{fmtDate(myProgress.finished_at) ? ` · ${fmtDate(myProgress.finished_at)}` : ""}</span>
                <ProgressBar current={1} total={1} color={STATUS_COLORS["finished"]} />
              </>
            )}
            {myProgress.status === "dnf" && (
              <span style={{ fontFamily:"monospace", fontSize:9, color:STATUS_COLORS["dnf"] }}>
                💀 DNF{myProgress.current_page && myProgress.total_pages ? ` · ${Math.round((myProgress.current_page/myProgress.total_pages)*100)}%` : ""}
              </span>
            )}
          </div>
        )}

        {/* Spacer pushes nominate to bottom */}
        <div style={{ flex:1 }} />

        {/* Nominate button — inside card at the bottom */}
        {(onNominate || isNominated) && (
          <div style={{ borderTop:`1px solid ${C.border2}`, paddingTop:8, marginTop:4 }}>
            {isNominated
              ? <span style={{ fontFamily:"monospace", fontSize:10, color:C.accent2 }}>🗳 Nominated</span>
              : <button onClick={e => { e.stopPropagation(); onNominate(); }}
                  style={{ width:"100%", background:"transparent", border:`1px solid ${C.border}`, borderRadius:4, color:C.dimmer, fontFamily:"monospace", fontSize:10, padding:"4px 0", cursor:"pointer", transition:"all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor=C.accent2; e.currentTarget.style.color=C.accent2; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor=C.border; e.currentTarget.style.color=C.dimmer; }}>
                  + Nominate for BOTM
                </button>
            }
          </div>
        )}
      </div>
    </div>
  );
}
