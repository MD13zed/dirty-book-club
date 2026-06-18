import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTheme, useAuth } from "../App";
import { api, coverSrc } from "../api";
import { StarRating, Avatar, ProgressBar, STATUS_LABELS, STATUS_COLORS } from "../components/ui";
import { THEMES } from "../theme";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return isMobile;
}

// ── Progress card — DNF ones are tap-to-reveal ────────────────────────────────
function DnfCard({ p, C, isMobile }) {
  const [open, setOpen] = useState(false);
  const isDnf = p.status === "dnf";

  return (
    <div
      onClick={() => isDnf && p.dnf_reason && setOpen(o => !o)}
      style={{
        background: C.card,
        border: `1px solid ${isDnf ? "#90404055" : C.border}`,
        borderRadius: 6,
        padding: isMobile ? "10px 12px" : "12px 16px",
        cursor: isDnf && p.dnf_reason ? "pointer" : "default",
        transition: "border-color 0.15s",
      }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize: isMobile ? 13 : 14, color:C.text, flex:1, minWidth:0, marginRight:8, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{p.book_title}</div>
        <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
          <span style={{ fontFamily:"monospace", fontSize:10, color:STATUS_COLORS[p.status], background:STATUS_COLORS[p.status]+"22", padding:"2px 6px", borderRadius:10 }}>{STATUS_LABELS[p.status]}</span>
          {isDnf && p.dnf_reason && (
            <span style={{ fontFamily:"monospace", fontSize:10, color:"#c06060", opacity:0.7 }}>{open ? "▲" : "▼"}</span>
          )}
        </div>
      </div>
      {p.status === "reading" && p.total_pages && (
        <>
          <div style={{ fontFamily:"monospace", fontSize:11, color:C.dimmer, marginTop:4 }}>p.{p.current_page} of {p.total_pages}</div>
          <ProgressBar current={p.current_page} total={p.total_pages} color={C.accent} />
        </>
      )}
      {isDnf && p.dnf_reason && open && (
        <div style={{ fontFamily:"'EB Garamond',serif", fontSize:14, color:"#c06060", fontStyle:"italic", marginTop:8, paddingTop:8, borderTop:"1px solid #90404033", lineHeight:1.5 }}>
          💀 "{p.dnf_reason}"
        </div>
      )}
      {isDnf && !p.dnf_reason && (
        <div style={{ fontFamily:"monospace", fontSize:11, color:C.dimmer, marginTop:4 }}>No reason left</div>
      )}
    </div>
  );
}

export default function Profile() {
  const { id }  = useParams();
  const { C, theme, updateTheme } = useTheme();
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const isMobile = useIsMobile();

  const [member,      setMember]      = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [editing,     setEditing]     = useState(false);
  const [form,        setForm]        = useState({ display_name:"", bio:"", theme:"dark-purple" });
  const [ratingFilter, setRatingFilter] = useState("all"); // "all" | "5" | "4" | "3" | "2" | "1"

  const isMe = user?.id === id;

  const loadMember = () => {
    api.getMember(id)
      .then(m => { setMember(m); setForm({ display_name:m.display_name||"", bio:m.bio||"", theme:m.theme||"dark-purple" }); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadMember();
    window.addEventListener("focus", loadMember);
    return () => window.removeEventListener("focus", loadMember);
  }, [id]);

  const save = async () => {
    const updated = await api.updateMe(form);
    setMember(m => ({ ...m, ...updated }));
    setEditing(false);
    if (form.theme !== theme) updateTheme(form.theme);
  };

  const INP = { width:"100%", background:C.bg, border:`1px solid ${C.border}`, borderRadius:3, color:C.text, fontFamily:"'EB Garamond',serif", fontSize:15, padding:"8px 12px", outline:"none", boxSizing:"border-box" };

  if (loading) return <div style={{ textAlign:"center", padding:80, color:C.dimmer, fontStyle:"italic" }}>Loading…</div>;
  if (!member) return <div style={{ textAlign:"center", padding:80, color:C.dimmer }}>Member not found</div>;

  const finished  = (member.progress||[]).filter(p=>p.status==="finished").length;
  const reading   = (member.progress||[]).filter(p=>p.status==="reading").length;
  const avgRating = member.reviews?.length
    ? (member.reviews.reduce((s,r)=>s+r.rating,0)/member.reviews.length).toFixed(1)
    : "—";

  // Filter reviews by star rating
  const filteredReviews = ratingFilter === "all"
    ? (member.reviews||[])
    : (member.reviews||[]).filter(r => r.rating === parseInt(ratingFilter));

  return (
    <div style={{ maxWidth:720, margin:"0 auto", padding: isMobile ? "16px 12px" : "32px 24px" }}>

      {/* Header card */}
      <div style={{ background:`linear-gradient(160deg,${C.card},${C.card2})`, border:`1px solid ${C.border}`, borderRadius:8, padding: isMobile ? "24px 16px" : "28px 24px", marginBottom:20, display:"flex", flexDirection: isMobile ? "column" : "row", gap:20, alignItems: isMobile ? "center" : "flex-start", textAlign: isMobile ? "center" : "left" }}>
        <Avatar name={member.display_name||member.username} src={member.avatar_url} size={72} />
        <div style={{ flex:1, minWidth:0, width: isMobile ? "100%" : "auto" }}>
          {editing ? (
            <div style={{ display:"flex", flexDirection:"column", gap:12, width:"100%", textAlign:"left" }}>
              <div>
                <label style={{ fontFamily:"monospace", fontSize:11, color:C.dimmer, display:"block", marginBottom:4 }}>DISPLAY NAME</label>
                <input value={form.display_name} onChange={e=>setForm(f=>({...f,display_name:e.target.value}))} style={INP} />
              </div>
              <div>
                <label style={{ fontFamily:"monospace", fontSize:11, color:C.dimmer, display:"block", marginBottom:4 }}>BIO</label>
                <textarea value={form.bio} onChange={e=>setForm(f=>({...f,bio:e.target.value}))} rows={3} style={{...INP,resize:"vertical"}} placeholder="Tell the club about yourself…" />
              </div>
              <div>
                <label style={{ fontFamily:"monospace", fontSize:11, color:C.dimmer, display:"block", marginBottom:8 }}>THEME</label>
                <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fill, minmax(130px,1fr))", gap:6 }}>
                  {Object.entries(THEMES).map(([k,v]) => (
                    <button key={k} onClick={()=>setForm(f=>({...f,theme:k}))}
                      style={{ background:form.theme===k?v.accent2+"33":"transparent", border:`2px solid ${form.theme===k?v.accent2:C.border}`, borderRadius:6, color:form.theme===k?v.accent2:C.dim, fontFamily:"monospace", fontSize:11, padding:"8px 10px", cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ width:10, height:10, borderRadius:"50%", background:v.accent, display:"inline-block", flexShrink:0 }} />
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display:"flex", gap:8, marginTop:4 }}>
                <button onClick={save} style={{ background:C.accent2, border:"none", borderRadius:6, color:C.bg, fontFamily:"'Playfair Display',serif", fontSize:13, fontWeight:700, padding: isMobile ? "11px" : "7px 16px", cursor:"pointer", flex: isMobile ? 1 : "none" }}>Save</button>
                <button onClick={()=>setEditing(false)} style={{ background:"transparent", border:`1px solid ${C.border}`, borderRadius:6, color:C.dim, fontFamily:"monospace", fontSize:12, padding: isMobile ? "11px" : "7px 12px", cursor:"pointer", flex: isMobile ? 1 : "none" }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:24, color:C.text, fontWeight:700 }}>{member.display_name||member.username}</div>
              {member.is_admin && <span style={{ fontFamily:"monospace", fontSize:11, color:C.accent, background:C.accent+"22", padding:"2px 8px", borderRadius:10, display:"inline-block", marginTop:4 }}>✦ Admin</span>}
              {member.bio && <p style={{ fontFamily:"'EB Garamond',serif", fontSize:15, color:C.muted, fontStyle:"italic", marginTop:8, lineHeight:1.6 }}>{member.bio}</p>}
              <div style={{ marginTop:12, display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, auto)", gap: isMobile ? 8 : 16, justifyContent: isMobile ? "stretch" : "start" }}>
                {[["Books Finished",finished],["Currently Reading",reading],["Reviews",member.reviews?.length||0],["Avg Rating",avgRating]].map(([l,v]) => (
                  <div key={l} style={{ textAlign:"center", background: isMobile ? C.bg : "transparent", borderRadius: isMobile ? 8 : 0, padding: isMobile ? "12px 8px" : 0, border: isMobile ? `1px solid ${C.border}` : "none" }}>
                    <div style={{ fontFamily:"'Playfair Display',serif", fontSize: isMobile ? 22 : 22, color:C.accent, fontWeight:700 }}>{v}</div>
                    <div style={{ fontFamily:"monospace", fontSize:10, color:C.dimmer, marginTop:2 }}>{l.toUpperCase()}</div>
                  </div>
                ))}
              </div>
              {isMe && (
                <div style={{ marginTop:16, display:"flex", flexDirection:"column", gap:8, width: isMobile ? "100%" : "auto", alignItems: isMobile ? "stretch" : "flex-start" }}>
                  {isMobile && <div style={{ height:1, background:C.border, margin:"0 0 4px" }} />}
                  <button onClick={()=>setEditing(true)} style={{ background:"transparent", border:`1px solid ${C.border}`, borderRadius:6, color:C.dim, fontFamily:"monospace", fontSize:12, padding: isMobile ? "10px" : "6px 12px", cursor:"pointer", width: isMobile ? "100%" : "auto" }}>Edit profile</button>
                  {!isMobile && (
                    <button onClick={() => { logout(); nav("/"); }}
                      style={{ background:"transparent", border:`1px solid ${C.border}`, borderRadius:3, color:C.dimmer, fontFamily:"monospace", fontSize:11, padding:"6px 16px", cursor:"pointer" }}>
                      Sign out
                    </button>
                  )}
                  {isMobile && (
                    <button onClick={() => { logout(); nav("/"); }}
                      style={{ background:"transparent", border:`1px solid ${C.border}`, borderRadius:6, color:C.dimmer, fontFamily:"monospace", fontSize:11, padding:"10px", cursor:"pointer", width:"100%" }}>
                      Sign out
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Reviews — filterable by star rating */}
      {member.reviews?.length > 0 && (
        <div style={{ marginBottom:20 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <div style={{ fontFamily:"monospace", fontSize:11, color:C.dimmer, letterSpacing:1 }}>
              REVIEWS ({filteredReviews.length}{ratingFilter!=="all"?` × ${ratingFilter}★`:""})
            </div>
            {/* Star rating filter */}
            <div style={{ display:"flex", gap:4 }}>
              {["all","5","4","3","2","1"].map(v => (
                <button key={v} onClick={()=>setRatingFilter(v)}
                  style={{ background:ratingFilter===v?C.accent2+"44":"transparent", border:`1px solid ${ratingFilter===v?C.accent2:C.border}`, borderRadius:4, color:ratingFilter===v?C.accent2:C.dim, fontFamily:"monospace", fontSize:11, padding:"3px 8px", cursor:"pointer", transition:"all 0.15s" }}>
                  {v==="all" ? "All" : `${v}★`}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display:"grid", gap:10 }}>
            {filteredReviews.slice(0,20).map(r => (
              <div key={r.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:6, padding:"14px 16px", display:"flex", gap:14, alignItems:"flex-start" }}>
                {r.cover_url && <img src={coverSrc(r.cover_url)} alt="" style={{ width:40, height:56, objectFit:"cover", borderRadius:3, flexShrink:0 }} />}
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:"'Playfair Display',serif", fontSize:15, color:C.text, fontWeight:700 }}>{r.book_title}</div>
                  <div style={{ fontFamily:"'EB Garamond',serif", fontSize:13, color:C.muted, fontStyle:"italic", marginBottom:4 }}>{r.book_author}</div>
                  <StarRating value={r.rating} size={14} />
                  {r.notes && <p style={{ fontFamily:"'EB Garamond',serif", fontSize:14, color:C.muted, fontStyle:"italic", marginTop:4, lineHeight:1.5 }}>"{r.notes}"</p>}
                </div>
              </div>
            ))}
            {filteredReviews.length === 0 && (
              <div style={{ color:C.dimmer, fontStyle:"italic", fontFamily:"'EB Garamond',serif", fontSize:14, textAlign:"center", padding:20 }}>
                No {ratingFilter!=="all"?`${ratingFilter}★ `:""}reviews yet
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reading progress */}
      {member.progress?.filter(p=>p.status!=="want_to_read").length > 0 && (
        <div style={{ marginBottom:20 }}>
          <div style={{ fontFamily:"monospace", fontSize:11, color:C.dimmer, letterSpacing:1, marginBottom:12 }}>READING PROGRESS</div>
          <div style={{ display:"grid", gap:8 }}>
            {member.progress.filter(p=>p.status!=="want_to_read").map(p => (
              <DnfCard key={p.id} p={p} C={C} isMobile={isMobile} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
