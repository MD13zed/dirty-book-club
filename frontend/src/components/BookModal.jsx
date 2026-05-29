import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme, useAuth } from "../App";
import { StarRating, Avatar, genreColor, ProgressBar, STATUS_LABELS, STATUS_COLORS, GenrePicker, TwPicker } from "./ui";
import { api } from "../api";

const INP = (C) => ({ width:"100%", background:C.bg, border:`1px solid ${C.border}`, borderRadius:3, color:C.text, fontFamily:"'EB Garamond',serif", fontSize:15, padding:"7px 11px", outline:"none", boxSizing:"border-box" });

function fmtDate(d) {
  if (!d) return null;
  try {
    const s = typeof d === "object" ? d.toISOString().slice(0,10) : String(d).slice(0,10);
    const dt = new Date(s + "T12:00:00");
    if (isNaN(dt)) return null;
    return dt.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  } catch { return null; }
}

// ── DNF members section ───────────────────────────────────────────────────────
function DnfMembersSection({ dnfRows, C, onClose, navigate }) {
  const [openIds, setOpenIds] = useState(new Set());
  const toggle = (id) => setOpenIds(s => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  return (
    <div>
      <div style={{ fontFamily:"monospace", fontSize:11, color:"#904040", marginBottom:10, letterSpacing:1 }}>💀 DID NOT FINISH</div>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {dnfRows.map(p => (
          <div key={p.member_id} style={{ background:"#c0404011", border:"1px solid #90404033", borderRadius:6, padding:"10px 14px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, justifyContent:"space-between" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <Avatar name={p.member_name} src={p.member_avatar} size={24} />
                <span onClick={() => { onClose(); navigate(`/profile/${p.member_id}`); }}
                  style={{ fontFamily:"monospace", fontSize:12, color:C.accent, cursor:"pointer", textDecoration:"underline", textDecorationStyle:"dotted" }}>
                  {p.member_name}
                </span>
              </div>
              {p.dnf_reason && (
                <button onClick={() => toggle(p.member_id)}
                  style={{ background:"transparent", border:"1px solid #90404055", borderRadius:20, color:"#c06060", fontFamily:"monospace", fontSize:10, padding:"2px 10px", cursor:"pointer" }}>
                  {openIds.has(p.member_id) ? "hide reason ▲" : "why? ▼"}
                </button>
              )}
              {!p.dnf_reason && (
                <span style={{ fontFamily:"monospace", fontSize:10, color:"#904040", opacity:0.5 }}>no reason left</span>
              )}
            </div>
            {p.dnf_reason && openIds.has(p.member_id) && (
              <div style={{ fontFamily:"'EB Garamond',serif", fontSize:14, color:"#c06060", fontStyle:"italic", marginTop:8, paddingTop:8, borderTop:"1px solid #90404033", lineHeight:1.5 }}>
                💀 "{p.dnf_reason}"
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BookModal({ book: initialBook, allReviews, onClose, onBookUpdated, onBookDeleted, onReviewSaved, onProgressSaved }) {
  const { C }    = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [book, setBook]           = useState(initialBook);
  const [reviews, setReviews]     = useState(allReviews || []);
  const [progress, setProgress]   = useState(null);
  const [allProgress, setAllProgress] = useState([]);
  const [myRating, setMyRating]   = useState(0);
  const [myNotes,  setMyNotes]    = useState("");
  const [saved,    setSaved]      = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [editing,  setEditing]    = useState(false);
  const [editForm, setEditForm]   = useState({
    title:            book.title,
    author:           book.author||"",
    series:           book.series||"",
    date_read:        book.date_read ? String(book.date_read).slice(0,10) : "",
    genres:           book.genres||[],
    trigger_warnings: book.trigger_warnings||[],
    cover_url:        book.cover_url||"",
    total_pages:      book.total_pages||"",
  });
  const [coverFile, setCoverFile] = useState(null);
  const [tab, setTab]             = useState("reviews");
  const [showTw, setShowTw]       = useState(false);
  const [dnfReason, setDnfReason] = useState("");
  const [finishedAt, setFinishedAt] = useState("");

  const genres = book.genres || [];
  const tws    = book.trigger_warnings || [];

  useEffect(() => {
    const h = e => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  useEffect(() => {
    const myReview = reviews.find(r => r.member_id === user?.id);
    if (myReview) { setMyRating(myReview.rating); setMyNotes(myReview.notes||""); }
    api.getProgress(book.id).then(rows => {
      setAllProgress(rows);
      const mine = rows.find(r => r.member_id === user?.id);
      if (mine) { setProgress(mine); setDnfReason(mine.dnf_reason||""); setFinishedAt(mine.finished_at ? String(mine.finished_at).slice(0,10) : ""); }
    }).catch(() => {});
  }, []);

  const saveReview = async () => {
    await api.saveReview({ book_id:book.id, rating:myRating, notes:myNotes });
    const fresh = await api.getReviews(book.id);
    setReviews(fresh);
    onReviewSaved?.(book.id, fresh);
    // Refresh book to get updated avg_rating / review_count
    const updatedBook = await api.getBook(book.id);
    setBook(updatedBook);
    onBookUpdated?.(updatedBook);
    setSaved(true); setTimeout(() => setSaved(false), 1500);
  };

  const saveProgress = async (updates) => {
    const p = { book_id:book.id, ...(progress||{}), ...updates };
    const saved = await api.saveProgress(p);
    setProgress(saved);
    onProgressSaved?.(saved);
  };

  const saveEdit = async () => {
    let cover_url = editForm.cover_url;
    if (coverFile) { const r = await api.uploadCover(coverFile); cover_url = r.url; }
    const updated = await api.updateBook(book.id, {
      ...editForm,
      cover_url,
      total_pages: editForm.total_pages ? parseInt(editForm.total_pages) : null,
    });
    setBook(updated);
    setEditing(false);
    onBookUpdated?.(updated);
  };

  const others = reviews.filter(r => r.member_id !== user?.id);
  const avg    = reviews.filter(r=>r.rating>0).reduce((s,r,_,a)=>s+r.rating/a.length,0);

  const tabStyle = (t) => ({
    fontFamily:"monospace", fontSize:12, padding:"6px 14px", cursor:"pointer", border:"none",
    background:tab===t?C.accent2:"transparent", color:tab===t?C.bg:C.dim, borderRadius:3, transition:"all 0.15s"
  });

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"#00000099", zIndex:100, display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"12px 8px", overflowY:"auto" }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:`linear-gradient(160deg,${C.card},${C.card2})`, border:`1px solid ${C.border}`, borderLeft:`5px solid ${genres.length?genreColor(genres[0]):C.dim}`, borderRadius:6, maxWidth:560, width:"100%", boxShadow:"0 20px 60px #00000099", overflowY:"auto" }}>

        {book.cover_url && <img src={book.cover_url} alt={book.title} style={{ width:"100%", maxHeight:240, objectFit:"cover", objectPosition:"top" }} />}

        <div style={{ padding:"28px 24px", display:"flex", flexDirection:"column", gap:14 }}>

          {/* Edit form */}
          {editing ? (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              <input value={editForm.title}  onChange={e=>setEditForm(f=>({...f,title:e.target.value}))}  placeholder="Title"  style={INP(C)} />
              <input value={editForm.author} onChange={e=>setEditForm(f=>({...f,author:e.target.value}))} placeholder="Author" style={INP(C)} />
              <input value={editForm.series} onChange={e=>setEditForm(f=>({...f,series:e.target.value}))} placeholder="Series" style={INP(C)} />
              <div style={{ display:"flex", gap:10 }}>
                <div style={{ flex:1 }}>
                  <label style={{ fontFamily:"monospace", fontSize:11, color:C.dimmer, display:"block", marginBottom:3 }}>DATE READ</label>
                  <input type="date" value={editForm.date_read} onChange={e=>setEditForm(f=>({...f,date_read:e.target.value}))} style={{...INP(C),colorScheme:"dark"}} />
                </div>
                <div style={{ flex:1 }}>
                  <label style={{ fontFamily:"monospace", fontSize:11, color:C.dimmer, display:"block", marginBottom:3 }}>TOTAL PAGES</label>
                  <input type="number" value={editForm.total_pages} onChange={e=>setEditForm(f=>({...f,total_pages:e.target.value}))} placeholder="e.g. 400" style={INP(C)} />
                </div>
              </div>
              <input value={editForm.cover_url} onChange={e=>setEditForm(f=>({...f,cover_url:e.target.value}))} placeholder="Cover URL" style={INP(C)} />
              <input type="file" accept="image/*" onChange={e=>setCoverFile(e.target.files[0])} style={{ color:C.muted, fontFamily:"monospace", fontSize:12 }} />
              <div>
                <label style={{ fontFamily:"monospace", fontSize:11, color:C.dimmer, display:"block", marginBottom:6 }}>GENRES — up to 5</label>
                <GenrePicker value={editForm.genres} onChange={g=>setEditForm(f=>({...f,genres:g}))} />
              </div>
              <div>
                <label style={{ fontFamily:"monospace", fontSize:11, color:"#c04040", display:"block", marginBottom:6 }}>⚠ TRIGGER WARNINGS</label>
                <TwPicker value={editForm.trigger_warnings} onChange={t=>setEditForm(f=>({...f,trigger_warnings:t}))} />
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={saveEdit} style={{ background:C.accent2, border:"none", borderRadius:3, color:C.bg, fontFamily:"'Playfair Display',serif", fontSize:13, fontWeight:700, padding:"7px 16px", cursor:"pointer" }}>Save</button>
                <button onClick={()=>setEditing(false)} style={{ background:"transparent", border:`1px solid ${C.border}`, borderRadius:3, color:C.dim, fontFamily:"monospace", fontSize:12, padding:"7px 12px", cursor:"pointer" }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, color:C.text, fontWeight:700, lineHeight:1.3 }}>{book.title}</div>
              {book.author && <div style={{ fontFamily:"'EB Garamond',serif", fontSize:15, color:C.muted, fontStyle:"italic" }}>by {book.author}</div>}
              {book.series && <div style={{ fontFamily:"monospace", fontSize:12, color:C.accent2 }}>📚 {book.series}</div>}
              {book.total_pages && <div style={{ fontFamily:"monospace", fontSize:11, color:C.dimmer, marginTop:2 }}>{book.total_pages} pages</div>}
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:8 }}>
                {genres.map(g=><span key={g} style={{ fontFamily:"monospace", fontSize:12, color:genreColor(g), background:C.bg, padding:"2px 9px", borderRadius:20, border:`1px solid ${genreColor(g)}55` }}>{g}</span>)}
                {fmtDate(book.date_read) && <span style={{ fontFamily:"monospace", fontSize:12, color:C.dimmer }}>Read {fmtDate(book.date_read)}</span>}
                {reviews.length > 0 && <span style={{ fontFamily:"monospace", fontSize:12, color:C.dimmer }}>Club avg: {avg.toFixed(1)}★</span>}
              </div>
              {/* TW toggle */}
              {tws.length > 0 && (
                <div style={{ marginTop:8 }}>
                  <button onClick={()=>setShowTw(v=>!v)} style={{ background:"transparent", border:"1px solid #c0404055", borderRadius:20, color:"#c04040", fontFamily:"monospace", fontSize:11, padding:"3px 10px", cursor:"pointer" }}>
                    ⚠ {showTw?"Hide":"Show"} trigger warnings ({tws.length})
                  </button>
                  {showTw && (
                    <div style={{ marginTop:6, display:"flex", flexWrap:"wrap", gap:4 }}>
                      {tws.map(t=><span key={t} style={{ fontFamily:"monospace", fontSize:11, color:"#e06060", background:"#c0404022", padding:"2px 9px", borderRadius:20, border:"1px solid #c0404044" }}>{t}</span>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tabs */}
          <div style={{ display:"flex", gap:4, borderBottom:`1px solid ${C.border}`, paddingBottom:10 }}>
            <button style={tabStyle("reviews")}  onClick={()=>setTab("reviews")}>Reviews ({reviews.length})</button>
            <button style={tabStyle("progress")} onClick={()=>setTab("progress")}>My Progress</button>
          </div>

          {/* Reviews tab */}
          {tab === "reviews" && (
            <>
              <div style={{ background:C.vdark, border:`1px solid ${C.border}`, borderRadius:4, padding:"16px 18px" }}>
                <div style={{ fontFamily:"monospace", fontSize:11, color:C.accent, marginBottom:8, letterSpacing:1 }}>MY REVIEW</div>
                <StarRating value={myRating} onChange={setMyRating} size={22} />
                <textarea value={myNotes} onChange={e=>setMyNotes(e.target.value)} placeholder="Your thoughts…" rows={3}
                  style={{ width:"100%", marginTop:10, background:C.bg, border:`1px solid ${C.border}`, borderRadius:3, color:C.text, fontFamily:"'EB Garamond',serif", fontSize:15, padding:"8px 12px", outline:"none", resize:"vertical", boxSizing:"border-box" }} />
                <button onClick={saveReview} style={{ marginTop:10, background:saved?`#1a3a2a`:`linear-gradient(135deg,${C.accent},${C.accent2})`, border:"none", borderRadius:3, color:saved?"#7aff7a":C.bg, fontFamily:"'Playfair Display',serif", fontSize:13, fontWeight:700, padding:"7px 18px", cursor:"pointer", transition:"background 0.3s" }}>
                  {saved?"✓ Saved":"Save Review"}
                </button>
              </div>

              {others.length > 0 && (
                <div>
                  <div style={{ fontFamily:"monospace", fontSize:11, color:C.dimmer, marginBottom:10, letterSpacing:1 }}>CLUB REVIEWS</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                    {others.map(r => (
                      <div key={r.member_id} style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                        <div onClick={()=>{ onClose(); navigate(`/profile/${r.member_id}`); }} style={{ cursor:"pointer" }}>
                          <Avatar name={r.member_name} src={r.member_avatar} size={28} />
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:2 }}>
                            <span onClick={()=>{ onClose(); navigate(`/profile/${r.member_id}`); }}
                              style={{ fontFamily:"monospace", fontSize:12, color:C.accent, cursor:"pointer", textDecoration:"underline", textDecorationStyle:"dotted" }}>
                              {r.member_name}
                            </span>
                            <StarRating value={r.rating} size={12} />
                          </div>
                          {r.notes && <div style={{ fontFamily:"'EB Garamond',serif", fontSize:14, color:C.muted, fontStyle:"italic", lineHeight:1.5 }}>"{r.notes}"</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DNF members — tap to reveal reason */}
              {allProgress.filter(p => p.member_id !== user?.id && p.status === "dnf").length > 0 && (
                <DnfMembersSection
                  dnfRows={allProgress.filter(p => p.member_id !== user?.id && p.status === "dnf")}
                  C={C}
                  onClose={onClose}
                  navigate={navigate}
                />
              )}
            </>
          )}

          {/* Progress tab */}
          {tab === "progress" && (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <div>
                <label style={{ fontFamily:"monospace", fontSize:11, color:C.dimmer, display:"block", marginBottom:6 }}>STATUS</label>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {Object.entries(STATUS_LABELS).map(([k,v]) => (
                    <button key={k} onClick={()=>saveProgress({status:k})}
                      style={{ background:progress?.status===k?STATUS_COLORS[k]+"44":"transparent", border:`1px solid ${progress?.status===k?STATUS_COLORS[k]:C.border}`, borderRadius:20, color:progress?.status===k?STATUS_COLORS[k]:C.dim, fontFamily:"monospace", fontSize:11, padding:"4px 12px", cursor:"pointer" }}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {(progress?.status==="reading"||progress?.status==="finished") && (
                <div style={{ display:"flex", gap:10 }}>
                  <div style={{ flex:1 }}>
                    <label style={{ fontFamily:"monospace", fontSize:11, color:C.dimmer, display:"block", marginBottom:4 }}>CURRENT PAGE</label>
                    <input type="number" min={0} value={progress?.current_page||0}
                      onChange={e=>saveProgress({current_page:parseInt(e.target.value)||0})} style={INP(C)} />
                  </div>
                  <div style={{ flex:1 }}>
                    <label style={{ fontFamily:"monospace", fontSize:11, color:C.dimmer, display:"block", marginBottom:4 }}>TOTAL PAGES</label>
                    <input type="number" min={1} value={progress?.total_pages||book.total_pages||""}
                      onChange={e=>saveProgress({total_pages:parseInt(e.target.value)||null})} placeholder="e.g. 400" style={INP(C)} />
                  </div>
                </div>
              )}

              {progress?.status==="reading" && progress?.total_pages && (
                <ProgressBar current={progress.current_page} total={progress.total_pages} color={C.accent} />
              )}

              {progress?.status==="finished" && (
                <div>
                  <label style={{ fontFamily:"monospace", fontSize:11, color:C.dimmer, display:"block", marginBottom:4 }}>DATE FINISHED</label>
                  <input type="date" value={finishedAt}
                    onChange={e => { setFinishedAt(e.target.value); saveProgress({ finished_at: e.target.value || null }); }}
                    style={INP(C)} />
                </div>
              )}

              {progress?.status==="dnf" && (                <div>
                  <label style={{ fontFamily:"monospace", fontSize:11, color:"#904040", display:"block", marginBottom:4 }}>WHY DID YOU DNF?</label>
                  <textarea value={dnfReason} onChange={e=>setDnfReason(e.target.value)} placeholder="Optional — what made you stop?" rows={2}
                    style={{ width:"100%", background:C.bg, border:"1px solid #90404055", borderRadius:3, color:C.text, fontFamily:"'EB Garamond',serif", fontSize:14, padding:"7px 11px", outline:"none", resize:"vertical", boxSizing:"border-box" }} />
                  <button onClick={()=>saveProgress({status:"dnf",dnf_reason:dnfReason})}
                    style={{ marginTop:6, background:"transparent", border:"1px solid #904040", borderRadius:3, color:"#c06060", fontFamily:"monospace", fontSize:12, padding:"5px 12px", cursor:"pointer" }}>
                    Save reason
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", borderTop:`1px solid ${C.border}`, paddingTop:14 }}>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={onClose} style={{ background:"transparent", border:`1px solid ${C.border}`, borderRadius:3, color:C.dim, fontFamily:"monospace", fontSize:12, padding:"6px 14px", cursor:"pointer" }}>Close</button>
              {(user?.is_admin||book.added_by===user?.id) && !editing && (
                <button onClick={()=>setEditing(true)} style={{ background:"transparent", border:`1px solid ${C.border}`, borderRadius:3, color:C.dim, fontFamily:"monospace", fontSize:12, padding:"6px 14px", cursor:"pointer" }}>Edit</button>
              )}
            </div>
            {(user?.is_admin||book.added_by===user?.id) && (
              confirmDel
                ? <div style={{ display:"flex", gap:8 }}>
                    <span style={{ fontFamily:"monospace", fontSize:12, color:"#c05070", alignSelf:"center" }}>Remove?</span>
                    <button onClick={()=>{onBookDeleted(book.id);onClose();}} style={{ background:"#5a1a30", border:"1px solid #a33", borderRadius:3, color:"#ffaacc", fontFamily:"monospace", fontSize:12, padding:"5px 12px", cursor:"pointer" }}>Yes</button>
                    <button onClick={()=>setConfirmDel(false)} style={{ background:"transparent", border:`1px solid ${C.border}`, borderRadius:3, color:C.dim, fontFamily:"monospace", fontSize:12, padding:"5px 12px", cursor:"pointer" }}>No</button>
                  </div>
                : <button onClick={()=>setConfirmDel(true)} style={{ background:"transparent", border:`1px solid ${C.border}`, borderRadius:3, color:C.dimmer, fontFamily:"monospace", fontSize:12, padding:"6px 12px", cursor:"pointer" }}>Remove book</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
