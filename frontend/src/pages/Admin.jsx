import { useState, useEffect } from "react";
import { useTheme } from "../App";
import { api } from "../api";
import { Avatar } from "../components/ui";

export default function Admin() {
  const { C } = useTheme();
  const [stats,   setStats]   = useState(null);
  const [members, setMembers] = useState([]);
  const [tab,     setTab]     = useState("stats");

  useEffect(() => {
    api.getAdminStats().then(setStats).catch(console.error);
    api.getAdminMembers().then(setMembers).catch(console.error);
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

      {/* Tabs */}
      <div style={{ display:"flex", gap:4, marginBottom:24, borderBottom:`1px solid ${C.border}`, paddingBottom:12 }}>
        <button style={tabStyle("stats")}   onClick={()=>setTab("stats")}>Stats</button>
        <button style={tabStyle("members")} onClick={()=>setTab("members")}>Members ({members.length})</button>
        <button style={tabStyle("activity")} onClick={()=>setTab("activity")}>Activity</button>
      </div>

      {tab === "stats" && stats && (
        <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:12 }}>
            <Stat label="Total Books"   value={stats.total_books} />
            <Stat label="Total Reviews" value={stats.total_reviews} color={C.accent2} />
            <Stat label="Members"       value={stats.total_members} color="#60a080" />
            <Stat label="Avg Rating"    value={stats.avg_rating ? `${stats.avg_rating}★` : "—"} color="#c07040" />
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, flexWrap:"wrap" }}>
            {/* Top books */}
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
                {stats.top_books.length === 0 && <div style={{ color:C.dimmer, fontStyle:"italic", fontSize:14 }}>No reviews yet</div>}
              </div>
            </div>

            {/* Genre breakdown */}
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:6, padding:"18px 20px" }}>
              <div style={{ fontFamily:"monospace", fontSize:11, color:C.dimmer, letterSpacing:1, marginBottom:14 }}>GENRE BREAKDOWN</div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {stats.genre_counts.slice(0,8).map(g => {
                  const pct = stats.total_books ? Math.round((g.count/stats.total_books)*100) : 0;
                  const color = { "Dark Romance":"#c06090", "Smut":"#d060a0", "Romantasy":"#a060d0" }[g.genre] || "#7a54c8";
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

      {tab === "members" && (
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
                <button onClick={()=>toggleAdmin(m.id, m.is_admin)} style={{ background:"transparent", border:`1px solid ${C.border}`, borderRadius:3, color:C.dim, fontFamily:"monospace", fontSize:11, padding:"4px 10px", cursor:"pointer" }}>
                  {m.is_admin ? "Revoke admin" : "Make admin"}
                </button>
                <button onClick={()=>removeMember(m.id)} style={{ background:"transparent", border:"1px solid #5a1a30", borderRadius:3, color:"#c05070", fontFamily:"monospace", fontSize:11, padding:"4px 10px", cursor:"pointer" }}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "activity" && stats && (
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
    </div>
  );
}
