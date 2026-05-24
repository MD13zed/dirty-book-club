import { useState, useEffect, useRef } from "react";
import { useTheme, useAuth } from "../App";
import { api } from "../api";
import BookCard from "../components/BookCard";
import BookModal from "../components/BookModal";
import { GenrePicker, GENRES, genreColor, TwPicker, Avatar } from "../components/ui";

const SORTS = [
  { value:"added_at",   label:"Recently Added" },
  { value:"date_read",  label:"Recently Read"  },
  { value:"avg_rating", label:"Highest Rated"  },
  { value:"title",      label:"Title A–Z"      },
  { value:"author",     label:"Author A–Z"     },
  { value:"series",     label:"Series A–Z"     },
];

export default function Library() {
  const { C }    = useTheme();
  const { user } = useAuth();

  const [view,     setView]     = useState("library"); // library | nominations
  const [books,    setBooks]    = useState([]);
  const [reviews,  setReviews]  = useState({});
  const [progress, setProgress] = useState([]);
  const [noms,     setNoms]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [search,   setSearch]   = useState("");
  const [filterG,  setFilterG]  = useState("");
  const [sortBy,   setSortBy]   = useState("added_at");
  const [form,     setForm]     = useState({ title:"", author:"", series:"", genres:[], trigger_warnings:[], date_read:"", cover_url:"", total_pages:"" });
  const [coverFile, setCoverFile] = useState(null);
  const titleRef = useRef();

  const INP = { width:"100%", background:C.bg, border:`1px solid ${C.border}`, borderRadius:3, color:C.text, fontFamily:"'EB Garamond',serif", fontSize:15, padding:"7px 11px", outline:"none", boxSizing:"border-box" };

  const load = async () => {
    setLoading(true);
    try {
      const [b, r, p, n] = await Promise.all([api.getBooks(), api.getReviews(), api.getProgress(), api.getNominations()]);
      setBooks(b); setReviews(r); setProgress(p); setNoms(n);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addBook = async () => {
    if (!form.title.trim()) return;
    let cover_url = form.cover_url;
    if (coverFile) { const r = await api.uploadCover(coverFile); cover_url = r.url; }
    const book = await api.addBook({ ...form, cover_url, total_pages: form.total_pages ? parseInt(form.total_pages) : null });
    setBooks(b => [book, ...b]);
    setForm({ title:"", author:"", series:"", genres:[], trigger_warnings:[], date_read:"", cover_url:"", total_pages:"" });
    setCoverFile(null);
    setShowForm(false);
  };

  const nominate = async (bookId) => {
    const updated = await api.nominate(bookId);
    setNoms(updated);
  };

  const vote = async (nomId, iVoted) => {
    const updated = iVoted ? await api.unvoteNomination(nomId) : await api.voteNomination(nomId);
    setNoms(updated);
  };

  const removeNom = async (nomId) => {
    const updated = await api.deleteNomination(nomId);
    setNoms(updated);
  };

  const filtered = books
    .filter(b => {
      const q = search.toLowerCase();
      return (!q || b.title.toLowerCase().includes(q) || (b.author||"").toLowerCase().includes(q) || (b.series||"").toLowerCase().includes(q))
        && (!filterG || (b.genres||[]).includes(filterG));
    })
    .sort((a, b) => {
      if (sortBy==="title")      return a.title.localeCompare(b.title);
      if (sortBy==="author")     return (a.author||"").localeCompare(b.author||"");
      if (sortBy==="series")     return (a.series||"zzz").localeCompare(b.series||"zzz");
      if (sortBy==="avg_rating") return (b.avg_rating||0)-(a.avg_rating||0);
      if (sortBy==="date_read")  return (b.date_read||"").localeCompare(a.date_read||"");
      return new Date(b.added_at)-new Date(a.added_at);
    });

  const myProgressMap = {};
  progress.forEach(p => { myProgressMap[p.book_id] = p; });

  const nominatedBookIds = new Set(noms.map(n => n.book_id));
  const activeGenres = GENRES.filter(g => books.some(b => (b.genres||[]).includes(g)));

  const tabBtn = (v, label) => (
    <button onClick={()=>setView(v)} style={{ fontFamily:"monospace", fontSize:13, padding:"8px 18px", cursor:"pointer", border:"none", background:view===v?C.accent2:"transparent", color:view===v?C.bg:C.dim, borderRadius:4, transition:"all 0.15s" }}>
      {label}
    </button>
  );

  return (
    <div style={{ minHeight:"calc(100vh - 55px)" }}>
      {/* Sub-header */}
      <div style={{ background:`linear-gradient(180deg,${C.bg2},${C.bg})`, borderBottom:`1px solid ${C.border}`, padding:"14px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
        <div style={{ display:"flex", gap:4 }}>
          {tabBtn("library",     `📚 Library (${books.length})`)}
          {tabBtn("nominations", `🗳 Nominations (${noms.length})`)}
        </div>
        {view==="library" && (
          <button onClick={()=>{ setShowForm(true); setTimeout(()=>titleRef.current?.focus(),50); }}
            style={{ background:`linear-gradient(135deg,${C.accent},${C.accent2})`, border:"none", borderRadius:4, color:C.bg, fontFamily:"'Playfair Display',serif", fontSize:14, fontWeight:700, padding:"9px 18px", cursor:"pointer" }}>
            + Add Book
          </button>
        )}
      </div>

      {/* ── NOMINATIONS VIEW ── */}
      {view==="nominations" && (
        <div style={{ padding:"24px", maxWidth:720, margin:"0 auto" }}>
          <div style={{ fontFamily:"'EB Garamond',serif", fontSize:14, color:C.dimmer, fontStyle:"italic", marginBottom:20 }}>
            Members nominate books for the next Book of the Month. Upvote your favourites — the admin picks from the shortlist.
          </div>

          {noms.length === 0 && (
            <div style={{ textAlign:"center", padding:60, color:C.dimmer }}>
              <div style={{ fontSize:36, marginBottom:10 }}>🗳</div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18 }}>No nominations yet</div>
              <div style={{ fontFamily:"'EB Garamond',serif", fontSize:14, marginTop:6, fontStyle:"italic" }}>Go to a book and nominate it for next month</div>
            </div>
          )}

          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {noms.map(n => (
              <div key={n.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:6, padding:"16px 18px", display:"flex", gap:14, alignItems:"center" }}>
                {n.cover_url && <img src={n.cover_url} alt={n.title} style={{ width:44, height:62, objectFit:"cover", borderRadius:3, flexShrink:0 }} />}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:"'Playfair Display',serif", fontSize:16, color:C.text, fontWeight:700 }}>{n.title}</div>
                  {n.author && <div style={{ fontFamily:"'EB Garamond',serif", fontSize:13, color:C.muted, fontStyle:"italic" }}>by {n.author}</div>}
                  <div style={{ fontFamily:"monospace", fontSize:11, color:C.dimmer, marginTop:4 }}>
                    Nominated by {n.nominated_by_name}
                  </div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
                  <button onClick={()=>vote(n.id, n.i_voted)}
                    style={{ background:n.i_voted?C.accent2+"33":"transparent", border:`1px solid ${n.i_voted?C.accent2:C.border}`, borderRadius:6, color:n.i_voted?C.accent2:C.dim, fontFamily:"monospace", fontSize:12, padding:"6px 14px", cursor:"pointer", transition:"all 0.15s" }}>
                    ▲ {n.vote_count}
                  </button>
                  {(n.i_nominated||user?.is_admin) && (
                    <button onClick={()=>removeNom(n.id)} style={{ background:"transparent", border:"none", color:C.dimmer, fontFamily:"monospace", fontSize:11, cursor:"pointer" }}>remove</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── LIBRARY VIEW ── */}
      {view==="library" && (
        <>
          {/* Genre strip */}
          {activeGenres.length > 0 && (
            <div style={{ display:"flex", borderBottom:`1px solid ${C.border2}` }}>
              {activeGenres.map(g => {
                const count = books.filter(b=>(b.genres||[]).includes(g)).length;
                return <div key={g} onClick={()=>setFilterG(filterG===g?"":g)} title={`${g}: ${count}`}
                  style={{ flex:count, height:5, background:filterG===g||!filterG?genreColor(g):genreColor(g)+"33", cursor:"pointer", transition:"background 0.2s" }} />;
              })}
            </div>
          )}

          {/* Filters */}
          <div style={{ padding:"12px 24px", display:"flex", gap:10, flexWrap:"wrap", borderBottom:`1px solid ${C.border2}` }}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search title, author, or series…"
              style={{ flex:1, minWidth:160, background:C.vdark, border:`1px solid ${C.border}`, borderRadius:3, color:C.text, fontFamily:"'EB Garamond',serif", fontSize:15, padding:"7px 13px", outline:"none" }} />
            <select value={filterG} onChange={e=>setFilterG(e.target.value)} style={{ background:C.vdark, border:`1px solid ${C.border}`, borderRadius:3, color:filterG?C.accent:C.dim, fontFamily:"monospace", fontSize:12, padding:"7px 10px", outline:"none" }}>
              <option value="">All Genres</option>
              {GENRES.map(g=><option key={g} value={g}>{g}</option>)}
            </select>
            <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{ background:C.vdark, border:`1px solid ${C.border}`, borderRadius:3, color:C.dim, fontFamily:"monospace", fontSize:12, padding:"7px 10px", outline:"none" }}>
              {SORTS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          {/* Add form */}
          {showForm && (
            <div style={{ background:C.bg2, borderBottom:`1px solid ${C.border}`, padding:"20px 24px" }}>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:17, marginBottom:14, color:C.accent, fontStyle:"italic" }}>Add a Book to the Club</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:12, marginBottom:14 }}>
                <div style={{ gridColumn:"span 2" }}>
                  <label style={{ display:"block", fontFamily:"monospace", fontSize:11, color:C.dimmer, marginBottom:3 }}>TITLE *</label>
                  <input ref={titleRef} value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} style={INP} />
                </div>
                <div>
                  <label style={{ display:"block", fontFamily:"monospace", fontSize:11, color:C.dimmer, marginBottom:3 }}>AUTHOR</label>
                  <input value={form.author} onChange={e=>setForm(f=>({...f,author:e.target.value}))} style={INP} />
                </div>
                <div>
                  <label style={{ display:"block", fontFamily:"monospace", fontSize:11, color:C.dimmer, marginBottom:3 }}>SERIES</label>
                  <input value={form.series} onChange={e=>setForm(f=>({...f,series:e.target.value}))} style={INP} />
                </div>
                <div>
                  <label style={{ display:"block", fontFamily:"monospace", fontSize:11, color:C.dimmer, marginBottom:3 }}>DATE READ</label>
                  <input type="date" value={form.date_read} onChange={e=>setForm(f=>({...f,date_read:e.target.value}))} style={{...INP,colorScheme:"dark"}} />
                </div>
                <div>
                  <label style={{ display:"block", fontFamily:"monospace", fontSize:11, color:C.dimmer, marginBottom:3 }}>TOTAL PAGES</label>
                  <input type="number" value={form.total_pages} onChange={e=>setForm(f=>({...f,total_pages:e.target.value}))} placeholder="e.g. 400" style={INP} />
                </div>
                <div>
                  <label style={{ display:"block", fontFamily:"monospace", fontSize:11, color:C.dimmer, marginBottom:3 }}>COVER URL</label>
                  <input value={form.cover_url} onChange={e=>setForm(f=>({...f,cover_url:e.target.value}))} placeholder="https://…" style={INP} />
                </div>
                <div>
                  <label style={{ display:"block", fontFamily:"monospace", fontSize:11, color:C.dimmer, marginBottom:3 }}>UPLOAD COVER</label>
                  <input type="file" accept="image/*" onChange={e=>setCoverFile(e.target.files[0])} style={{ color:C.muted, fontFamily:"monospace", fontSize:12, marginTop:6 }} />
                </div>
              </div>
              <div style={{ marginBottom:14 }}>
                <label style={{ display:"block", fontFamily:"monospace", fontSize:11, color:C.dimmer, marginBottom:8 }}>GENRES — pick up to 5</label>
                <GenrePicker value={form.genres} onChange={g=>setForm(f=>({...f,genres:g}))} />
              </div>
              <div style={{ marginBottom:14 }}>
                <label style={{ display:"block", fontFamily:"monospace", fontSize:11, color:"#c04040", marginBottom:8 }}>⚠ TRIGGER WARNINGS</label>
                <TwPicker value={form.trigger_warnings} onChange={t=>setForm(f=>({...f,trigger_warnings:t}))} />
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button onClick={addBook} style={{ background:`linear-gradient(135deg,${C.accent},${C.accent2})`, border:"none", borderRadius:3, color:C.bg, fontFamily:"'Playfair Display',serif", fontSize:13, fontWeight:700, padding:"8px 20px", cursor:"pointer" }}>Add to Library</button>
                <button onClick={()=>setShowForm(false)} style={{ background:"transparent", border:`1px solid ${C.border}`, borderRadius:3, color:C.dim, fontFamily:"monospace", fontSize:12, padding:"8px 14px", cursor:"pointer" }}>Cancel</button>
              </div>
            </div>
          )}

          {/* Book grid */}
          <div style={{ padding:"20px 24px" }}>
            {loading ? (
              <div style={{ textAlign:"center", color:C.dimmer, fontStyle:"italic", padding:80 }}>Loading the library…</div>
            ) : filtered.length===0 ? (
              <div style={{ textAlign:"center", padding:80 }}>
                <div style={{ fontSize:44, marginBottom:10 }}>🔥</div>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:20, color:C.dimmer }}>{books.length===0?"The library is empty":"No books match"}</div>
                {books.length===0 && <div style={{ fontStyle:"italic", color:C.dimmer, marginTop:8 }}>Add your first spicy read</div>}
              </div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:14 }}>
                {filtered.map(book => (
                  <div key={book.id} style={{ position:"relative" }}>
                    <BookCard book={book} reviews={reviews[book.id]||[]} myProgress={myProgressMap[book.id]} currentUser={user} onClick={setSelected} />
                    {/* Nominate button */}
                    {!nominatedBookIds.has(book.id) && !book.botm_month && (
                      <button onClick={e=>{e.stopPropagation();nominate(book.id);}}
                        title="Nominate for Book of the Month"
                        style={{ position:"absolute", bottom:18, right:10, background:"transparent", border:`1px solid ${C.border}`, borderRadius:20, color:C.dimmer, fontFamily:"monospace", fontSize:10, padding:"2px 8px", cursor:"pointer" }}>
                        + nominate
                      </button>
                    )}
                    {nominatedBookIds.has(book.id) && (
                      <div style={{ position:"absolute", bottom:18, right:10, fontFamily:"monospace", fontSize:10, color:C.accent2 }}>🗳 nominated</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {selected && (
        <BookModal
          book={selected}
          allReviews={reviews[selected.id]||[]}
          onClose={()=>setSelected(null)}
          onBookUpdated={b=>{setBooks(prev=>prev.map(x=>x.id===b.id?b:x));setSelected(b);}}
          onBookDeleted={id=>{setBooks(prev=>prev.filter(x=>x.id!==id));setSelected(null);api.deleteBook(id);}}
        />
      )}
    </div>
  );
}
