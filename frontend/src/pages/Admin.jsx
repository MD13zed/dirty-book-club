import { useState, useEffect } from "react";
import { useTheme } from "../App";
import { api } from "../api";
import { Avatar } from "../components/ui";

export default function Admin() {
  const { C } = useTheme();
  const [stats,   setStats]   = useState(null);
  const [members, setMembers] = useState([]);
  const [books,   setBooks]   = useState([]);
  const [noms,    setNoms]    = useState([]);
  const [tab,     setTab]     = useState("stats");

  const [botmBookId,        setBotmBookId]        = useState("");
  const [botmMonth,         setBotmMonth]          = useState("");
  const [botmStatus,        setBotmStatus]         = useState("");
  const [announceToDiscord, setAnnounceToDiscord]  = useState(true);

  const [pollSelected,  setPollSelected]  = useState([]);
  const [pollDuration,  setPollDuration]  = useState(48);
  const [pollStatus,    setPollStatus]    = useState("");

  useEffect(() => {
    api.getAdminStats().then(setStats).catch(console.error);
    api.getAdminMembers().then(setMembers).catch(console.error);
    api.getBooks().then(setBooks).catch(console.error);
    api.getNominations().then(setNoms).catch(console.error);
  }, []);

  const toggleAdmin = async (id, current) => {
    await api.toggleAdmin(id, !current);
    setMembers(m => m.map(x => x.id===id ? {...x, is_admin:!current} : x));
  };

  const removeMember = async (id) => {
    if (!confirm("Remove this member? All their reviews and progress will be deleted.")) return;
    await api.adminDeleteMember(id);
    setMembers(m => m.filter(x => x.id!==id));
  };

  const announceBotm = async () => {
    if (!botmBookId || !botmMonth.trim()) { setBotmStatus("Please select a book and enter a month."); return; }
    try {
      setBotmStatus(announceToDiscord ? "Announcing..." : "Saving...");
      await api.setBookOfTheMonth(botmBookId, botmMonth.trim(), announceToDiscord);
      setBotmStatus(announceToDiscord ? "✅ Announced and thread created in Discord!" : "✅ Saved!");
      setBotmBookId(""); setBotmMonth("");
      api.getBooks().then(setBooks);
    } catch (e) { setBotmStatus("❌ Error: " + e.message); }
  };

  const postPoll = async () => {
    if (pollSelected.length < 2) { setPollStatus("Select at least 2 books."); return; }
    try {
      setPollStatus("Posting poll...");
      await api.postTbrPoll(pollSelected, pollDuration);
      setPollStatus("✅ Poll posted to Discord!");
      setPollSelected([]);
    } catch (e) { setPollStatus("❌ Error: " + e.message); }
  };

  const togglePollBook = (id) => {
    setPollSelected(prev =>
      prev.includes(id) ? prev.filter(x=>x!==id) : prev.length < 10 ? [...prev, id] : prev
    );
  };

  const removeNom = async (id) => {
    const updated = await api.deleteNomination(id);
    setNoms(updated);
  };

  const tabStyle = (t) => ({
    fontFamily:"monospace", fontSize:12, padding:"8px 16px", cursor:"pointer", border:"none",
    background:tab===t?C.accent2:"transparent", color:tab===t?C.bg:C.dim, borderRadius:4,
  });

  const Stat = ({ label, value, color }) => (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:6, padding:"20px 24px", textAlign:"center" }}>
      <div style={{ fontFamily:"'Playfair Display',serif", fontSize:36, fontWeight:900, color:color||C.accent }}>{value ?? "—"}</div>
      <div style={{ fontFamily:"monospace", fontSize:11, color:C.dimmer, marginTop:4 }}>{label}</div>
    </div>
  );

  return (
    <div style={{ maxWidth:900, margin:"0 auto", padding:"32px 24px" }}>
      <div style={{ fontFamily:"'Playfair Display',serif", fontSize:26, fontWeight:900, color:C.accent, fontStyle:"italic", marginBottom:24 }}>Admin Dashboard</div>

      <div style={{ display:"flex", gap:4, marginBottom:24, borderBottom:`1px solid ${C.border}`, paddingBottom:12, flexWrap:"wrap" }}>
        <button style={tabStyle("stats")}    onClick={()=>setTab("stats")}>Stats</button>
        <button style={tabStyle("members")}  onClick={()=>setTab("members")}>Members ({members.length})</button>
        <button style={tabStyle("activity")} onClick={()=>setTab("activity")}>Activity</button>
        <button style={tabStyle("botm")}     onClick={()=>setTab("botm")}>📔 Book of the Month</button>
        <button style={tabStyle("noms")}     onClick={()=>setTab("noms")}>🗳 Nominations ({noms.length})</button>
      </div>

      {/* ── STATS ── */}
      {tab==="stats" && stats && (
        <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:12 }}>
            <Stat label="Total Books"   value={stats.total_books} />
            <Stat label="Total Reviews" value={stats.total_reviews} color={C.accent2} />
            <Stat label="Members"       value={stats.total_members} color="#60a080" />
            <Stat label="Avg Rating"    value={stats.avg_rating?`${stats.avg_rating}★`:"—"} color="#c07040" />
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:6, padding:"18px 20px" }}>
              <div style={{ fontFamily:"monospace", fontSize:11, color:C.dimmer, letterSpacing:1, marginBottom:14 }}>TOP RATED BOOKS</div>
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {stats.top_books.map((b,i) => (
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div>
                      <div style={{ fontFamily:"'Playfair Display',serif", fontSize:14, color:C.text }}>{b.title}</div>
                      <div style={{ fontFamily:"'EB Garamond',serif", fontSize:12, color:C.muted, fontStyle:"italic" }}>{b.author}</div>
                    </div>
                    <div style={{ fontFamily:"monospace", fontSize:13, color:C.accent, textAlign:"right" }}>
                      {b.avg}★<br/><span style={{ fontSize:10, color:C.dimmer }}>{b.reviews} reviews</span>
                    </div>
                  </div>
                ))}
                {stats.top_books.length===0 && <div style={{ color:C.dimmer, fontStyle:"italic", fontSize:14 }}>No reviews yet</div>}
              </div>
            </div>
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:6, padding:"18px 20px" }}>
              <div style={{ fontFamily:"monospace", fontSize:11, color:C.dimmer, letterSpacing:1, marginBottom:14 }}>GENRE BREAKDOWN</div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {stats.genre_counts.slice(0,8).map(g => {
                  const pct   = stats.total_books ? Math.round((g.count/stats.total_books)*100) : 0;
                  const color = {"Dark Romance":"#c06090","Smut":"#d060a0","Romantasy":"#a060d0"}[g.genre]||"#7a54c8";
                  return (
                    <div key={g.genre}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
                        <span style={{ fontFamily:"monospace", fontSize:11, color:C.muted }}>{g.genre}</span>
                        <span style={{ fontFamily:"monospace", fontSize:11, color:C.dimmer }}>{g.count}</span>
                      </div>
                      <div style={{ height:4, background:C.vdark, borderRadius:2 }}>
                        <div style={{ height:"100%", width:`${pct}%`, background:color, borderRadius:2 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MEMBERS ── */}
      {tab==="members" && (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {members.map(m => (
            <div key={m.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:6, padding:"14px 18px", display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
              <div style={{ flex:1, minWidth:0, display:"flex", gap:12, alignItems:"center" }}>
                <Avatar name={m.display_name||m.username} size={36} />
                <div>
                  <div style={{ fontFamily:"'Playfair Display',serif", fontSize:15, color:C.text }}>{m.display_name||m.username}</div>
                  <div style={{ fontFamily:"monospace", fontSize:11, color:C.dimmer }}>@{m.username} · {m.reviews} reviews · joined {new Date(m.joined_at).toLocaleDateString()}</div>
                </div>
              </div>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                {m.is_admin && <span style={{ fontFamily:"monospace", fontSize:11, color:C.accent }}>✦ admin</span>}
                <button onClick={()=>toggleAdmin(m.id,m.is_admin)} style={{ background:"transparent", border:`1px solid ${C.border}`, borderRadius:3, color:C.dim, fontFamily:"monospace", fontSize:11, padding:"4px 10px", cursor:"pointer" }}>
                  {m.is_admin?"Revoke admin":"Make admin"}
                </button>
                <button onClick={()=>removeMember(m.id)} style={{ background:"transparent", border:"1px solid #5a1a30", borderRadius:3, color:"#c05070", fontFamily:"monospace", fontSize:11, padding:"4px 10px", cursor:"pointer" }}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── ACTIVITY ── */}
      {tab==="activity" && stats && (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          <div style={{ fontFamily:"monospace", fontSize:11, color:C.dimmer, letterSpacing:1, marginBottom:8 }}>RECENT REVIEWS</div>
          {stats.recent_activity.map((a,i) => (
            <div key={i} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:6, padding:"12px 16px", display:"flex", justifyContent:"space-between" }}>
              <div>
                <span style={{ fontFamily:"monospace", fontSize:12, color:C.accent }}>{a.member}</span>
                <span style={{ fontFamily:"'EB Garamond',serif", fontSize:14, color:C.muted }}> reviewed </span>
                <span style={{ fontFamily:"'Playfair Display',serif", fontSize:14, color:C.text }}>{a.book}</span>
              </div>
              <span style={{ fontFamily:"monospace", fontSize:11, color:C.dimmer }}>{new Date(a.ts).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── BOTM ── */}
      {tab==="botm" && (
        <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
          <div style={{ background:C.card, border:`1px solid #d4af3755`, borderRadius:6, padding:"24px 28px" }}>
            <div style={{ fontFamily:"monospace", fontSize:11, color:"#d4af37", letterSpacing:1, marginBottom:18 }}>SET BOOK OF THE MONTH</div>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <label style={{ fontFamily:"monospace", fontSize:11, color:C.dimmer, display:"block", marginBottom:6 }}>MONTH (e.g. June 2025)</label>
                <input value={botmMonth} onChange={e=>setBotmMonth(e.target.value)} placeholder="June 2025"
                  style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:4, color:C.text, fontFamily:"monospace", fontSize:13, padding:"9px 12px", width:"100%", boxSizing:"border-box" }} />
              </div>
              <div>
                <label style={{ fontFamily:"monospace", fontSize:11, color:C.dimmer, display:"block", marginBottom:6 }}>SELECT BOOK</label>
                <select value={botmBookId} onChange={e=>setBotmBookId(e.target.value)}
                  style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:4, color:C.text, fontFamily:"monospace", fontSize:13, padding:"9px 12px", width:"100%", boxSizing:"border-box" }}>
                  <option value="">— Choose a book —</option>
                  {books.map(b=><option key={b.id} value={b.id}>{b.title}{b.author?` — ${b.author}`:""}</option>)}
                </select>
              </div>
              {botmBookId && botmMonth && (() => {
                const b = books.find(x=>x.id===botmBookId);
                return b ? (
                  <div style={{ background:C.bg, border:`1px solid #d4af3744`, borderRadius:4, padding:"12px 16px" }}>
                    <div style={{ fontFamily:"monospace", fontSize:10, color:"#d4af37", marginBottom:6 }}>
                      {announceToDiscord ? "THREAD WILL BE CREATED:" : "WILL BE SAVED AS BOTM:"}
                    </div>
                    <div style={{ fontFamily:"monospace", fontSize:12, color:C.text }}>📔 {botmMonth} 📖 {b.title}</div>
                  </div>
                ) : null;
              })()}
              <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer" }}>
                <input type="checkbox" checked={announceToDiscord} onChange={e=>setAnnounceToDiscord(e.target.checked)}
                  style={{ width:14, height:14, accentColor:"#d4af37", cursor:"pointer" }} />
                <span style={{ fontFamily:"monospace", fontSize:12, color:C.dimmer }}>Post announcement to Discord</span>
              </label>
              <button onClick={announceBotm}
                style={{ background:"linear-gradient(90deg,#b8860b,#d4af37)", border:"none", borderRadius:4, color:"#1a1000", fontFamily:"monospace", fontSize:13, fontWeight:700, padding:"12px 24px", cursor:"pointer", letterSpacing:1 }}>
                {announceToDiscord ? "🔥 ANNOUNCE & CREATE THREAD" : "💾 SAVE BOOK OF THE MONTH"}
              </button>
              {botmStatus && <div style={{ fontFamily:"monospace", fontSize:12, color:botmStatus.startsWith("✅")?"#60a080":botmStatus.startsWith("❌")?"#c05070":C.dimmer }}>{botmStatus}</div>}
            </div>
          </div>
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:6, padding:"18px 20px" }}>
            <div style={{ fontFamily:"monospace", fontSize:11, color:C.dimmer, letterSpacing:1, marginBottom:14 }}>PREVIOUS BOOKS OF THE MONTH</div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {books.filter(b=>b.botm_month).length===0 && <div style={{ color:C.dimmer, fontStyle:"italic", fontSize:14 }}>None set yet</div>}
              {books.filter(b=>b.botm_month).sort((a,b)=>{ const p=s=>{ const [m,y]=s.split(" "); return new Date(`${y}-${["January","February","March","April","May","June","July","August","September","October","November","December"].indexOf(m)+1}-01`); }; return p(b.botm_month)-p(a.botm_month); }).map(b=>(
                <div key={b.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ fontFamily:"'Playfair Display',serif", fontSize:14, color:C.text }}>{b.title}</div>
                  <div style={{ fontFamily:"monospace", fontSize:11, color:"#d4af37" }}>🔥 {b.botm_month}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── NOMINATIONS ── */}
      {tab==="noms" && (
        <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
          <div style={{ background:C.card, border:`1px solid ${C.accent2}44`, borderRadius:6, padding:"24px 28px" }}>
            <div style={{ fontFamily:"monospace", fontSize:11, color:C.accent2, letterSpacing:1, marginBottom:6 }}>POST TBR POLL TO DISCORD</div>
            <div style={{ fontFamily:"'EB Garamond',serif", fontSize:14, color:C.dimmer, fontStyle:"italic", marginBottom:16 }}>
              Select books below to include in a Discord poll — members vote for what to read next.
            </div>
            <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:14, flexWrap:"wrap" }}>
              <label style={{ fontFamily:"monospace", fontSize:11, color:C.dimmer }}>POLL DURATION</label>
              <select value={pollDuration} onChange={e=>setPollDuration(Number(e.target.value))}
                style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:3, color:C.text, fontFamily:"monospace", fontSize:12, padding:"5px 10px", outline:"none" }}>
                <option value={24}>24 hours</option>
                <option value={48}>48 hours</option>
                <option value={72}>72 hours</option>
              </select>
              <span style={{ fontFamily:"monospace", fontSize:11, color:C.dimmer }}>{pollSelected.length}/10 selected</span>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:16 }}>
              {noms.length===0 && <div style={{ color:C.dimmer, fontStyle:"italic", fontSize:14 }}>No nominations yet</div>}
              {noms.map(n => (
                <div key={n.id} onClick={()=>togglePollBook(n.book_id)}
                  style={{ display:"flex", gap:12, alignItems:"center", padding:"10px 14px", borderRadius:4, border:`1px solid ${pollSelected.includes(n.book_id)?C.accent2:C.border}`, background:pollSelected.includes(n.book_id)?C.accent2+"22":"transparent", cursor:"pointer", transition:"all 0.15s" }}>
                  <div style={{ width:16, height:16, borderRadius:3, border:`2px solid ${pollSelected.includes(n.book_id)?C.accent2:C.border}`, background:pollSelected.includes(n.book_id)?C.accent2:"transparent", flexShrink:0 }} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:"'Playfair Display',serif", fontSize:14, color:C.text }}>{n.title}</div>
                    {n.author && <div style={{ fontFamily:"'EB Garamond',serif", fontSize:12, color:C.muted, fontStyle:"italic" }}>by {n.author}</div>}
                  </div>
                  <div style={{ fontFamily:"monospace", fontSize:11, color:C.accent2 }}>▲ {n.vote_count}</div>
                </div>
              ))}
            </div>
            <button onClick={postPoll}
              style={{ background:`linear-gradient(135deg,${C.accent},${C.accent2})`, border:"none", borderRadius:4, color:C.bg, fontFamily:"monospace", fontSize:13, fontWeight:700, padding:"10px 20px", cursor:"pointer" }}>
              Post Poll to Discord
            </button>
            {pollStatus && <div style={{ marginTop:10, fontFamily:"monospace", fontSize:12, color:pollStatus.startsWith("✅")?"#60a080":pollStatus.startsWith("❌")?"#c05070":C.dimmer }}>{pollStatus}</div>}
          </div>

          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:6, padding:"18px 20px" }}>
            <div style={{ fontFamily:"monospace", fontSize:11, color:C.dimmer, letterSpacing:1, marginBottom:14 }}>ALL NOMINATIONS</div>
            {noms.length===0 && <div style={{ color:C.dimmer, fontStyle:"italic", fontSize:14 }}>No nominations yet</div>}
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {noms.map(n => (
                <div key={n.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div style={{ fontFamily:"'Playfair Display',serif", fontSize:14, color:C.text }}>{n.title}</div>
                    <div style={{ fontFamily:"monospace", fontSize:11, color:C.dimmer }}>by {n.nominated_by_name} · ▲ {n.vote_count} votes</div>
                  </div>
                  <button onClick={()=>removeNom(n.id)} style={{ background:"transparent", border:"1px solid #5a1a30", borderRadius:3, color:"#c05070", fontFamily:"monospace", fontSize:11, padding:"3px 8px", cursor:"pointer" }}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
