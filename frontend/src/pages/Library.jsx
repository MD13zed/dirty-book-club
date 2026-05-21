import { useState, useEffect, useRef } from "react";
import { useTheme, useAuth } from "../App";
import { api } from "../api";
import BookCard from "../components/BookCard";
import BookModal from "../components/BookModal";
import { GenrePicker, GENRES, genreColor } from "../components/ui";

const SORTS = [
  { value:"added_at", label:"Recently Added" },
  { value:"date_read", label:"Recently Read" },
  { value:"avg_rating", label:"Highest Rated" },
  { value:"title", label:"Title A–Z" },
  { value:"author", label:"Author A–Z" },
  { value:"series", label:"Series A–Z" },
];

export default function Library() {
  const { C } = useTheme();
  const { user } = useAuth();

  const [books,    setBooks]    = useState([]);
  const [reviews,  setReviews]  = useState({});
  const [progress, setProgress] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [search,   setSearch]   = useState("");
  const [filterG,  setFilterG]  = useState("");
  const [sortBy,   setSortBy]   = useState("added_at");
  const [form, setForm] = useState({ title:"", author:"", series:"", genres:[], date_read:"", cover_url:"" });
  const [coverFile, setCoverFile] = useState(null);
  const titleRef = useRef();

  const INP = { width:"100%", background:C.bg, border:`1px solid ${C.border}`, borderRadius:3, color:C.text, fontFamily:"'EB Garamond',serif", fontSize:15, padding:"7px 11px", outline:"none", boxSizing:"border-box" };

  const load = async () => {
    setLoading(true);
    try {
      const [b, r, p] = await Promise.all([api.getBooks(), api.getReviews(), api.getProgress()]);
      setBooks(b);
      setReviews(r);
      setProgress(p);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addBook = async () => {
    if (!form.title.trim()) return;
    let cover_url = form.cover_url;
    if (coverFile) {
      const res = await api.uploadCover(coverFile);
      cover_url = res.url;
    }
    const book = await api.addBook({ ...form, cover_url });
    setBooks(b => [book, ...b]);
    setForm({ title:"", author:"", series:"", genres:[], date_read:"", cover_url:"" });
    setCoverFile(null);
    setShowForm(false);
  };

  const filtered = books
    .filter(b => {
      const q = search.toLowerCase();
      return (!q || b.title.toLowerCase().includes(q) || (b.author||"").toLowerCase().includes(q) || (b.series||"").toLowerCase().includes(q))
        && (!filterG || (b.genres||[]).includes(filterG));
    })
    .sort((a, b) => {
      if (sortBy === "title")       return a.title.localeCompare(b.title);
      if (sortBy === "author")      return (a.author||"").localeCompare(b.author||"");
      if (sortBy === "series")      return (a.series||"zzz").localeCompare(b.series||"zzz");
      if (sortBy === "avg_rating")  return (b.avg_rating||0) - (a.avg_rating||0);
      if (sortBy === "date_read")   return (b.date_read||"").localeCompare(a.date_read||"");
      return new Date(b.added_at) - new Date(a.added_at);
    });

  const myProgressMap = {};
  progress.forEach(p => { myProgressMap[p.book_id] = p; });

  const activeGenres = GENRES.filter(g => books.some(b => (b.genres||[]).includes(g)));

  return (
    <div style={{ minHeight:"calc(100vh - 55px)" }}>
      {/* Sub-header */}
      <div style={{ background:`linear-gradient(180deg,${C.bg2},${C.bg})`, borderBottom:`1px solid ${C.border}`, padding:"16px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
        <div style={{ fontFamily:"'EB Garamond',serif", fontSize:14, color:C.dimmer, fontStyle:"italic" }}>
          {books.length} {books.length===1?"book":"books"} in the library
        </div>
        <button onClick={() => { setShowForm(true); setTimeout(()=>titleRef.current?.focus(),50); }}
          style={{ background:`linear-gradient(135deg,${C.accent},${C.accent2})`, border:"none", borderRadius:4, color:C.bg, fontFamily:"'Playfair Display',serif", fontSize:14, fontWeight:700, padding:"9px 18px", cursor:"pointer" }}>
          + Add Book
        </button>
      </div>

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
              <label style={{ display:"block", fontFamily:"monospace", fontSize:11, color:C.dimmer, marginBottom:3 }}>COVER URL</label>
              <input value={form.cover_url} onChange={e=>setForm(f=>({...f,cover_url:e.target.value}))} placeholder="https://…" style={INP} />
            </div>
            <div>
              <label style={{ display:"block", fontFamily:"monospace", fontSize:11, color:C.dimmer, marginBottom:3 }}>UPLOAD COVER</label>
              <input type="file" accept="image/*" onChange={e=>setCoverFile(e.target.files[0])} style={{ color:C.muted, fontFamily:"monospace", fontSize:12, marginTop:6 }} />
            </div>
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={{ display:"block", fontFamily:"monospace", fontSize:11, color:C.dimmer, marginBottom:8 }}>GENRES — pick up to 3</label>
            <GenrePicker value={form.genres} onChange={g=>setForm(f=>({...f,genres:g}))} />
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={addBook} style={{ background:`linear-gradient(135deg,${C.accent},${C.accent2})`, border:"none", borderRadius:3, color:C.bg, fontFamily:"'Playfair Display',serif", fontSize:13, fontWeight:700, padding:"8px 20px", cursor:"pointer" }}>Add to Library</button>
            <button onClick={()=>setShowForm(false)} style={{ background:"transparent", border:`1px solid ${C.border}`, borderRadius:3, color:C.dim, fontFamily:"monospace", fontSize:12, padding:"8px 14px", cursor:"pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Grid */}
      <div style={{ padding:"20px 24px" }}>
        {loading ? (
          <div style={{ textAlign:"center", color:C.dimmer, fontStyle:"italic", padding:80 }}>Loading the library…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:"center", padding:80 }}>
            <div style={{ fontSize:44, marginBottom:10 }}>🔥</div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:20, color:C.dimmer }}>{books.length===0?"The library is empty":"No books match"}</div>
            {books.length===0 && <div style={{ fontStyle:"italic", color:C.dimmer, marginTop:8 }}>Add your first spicy read</div>}
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:14 }}>
            {filtered.map(book => (
              <BookCard key={book.id} book={book} reviews={reviews[book.id]||[]} myProgress={myProgressMap[book.id]} currentUser={user} onClick={setSelected} />
            ))}
          </div>
        )}
      </div>

      {selected && (
        <BookModal
          book={selected}
          allReviews={reviews[selected.id]||[]}
          onClose={()=>setSelected(null)}
          onBookUpdated={b => { setBooks(prev=>prev.map(x=>x.id===b.id?b:x)); setSelected(b); }}
          onBookDeleted={id => { setBooks(prev=>prev.filter(x=>x.id!==id)); setSelected(null); api.deleteBook(id); }}
        />
      )}
    </div>
  );
}
