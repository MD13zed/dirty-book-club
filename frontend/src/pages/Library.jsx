import { useState, useEffect, useRef, useCallback } from "react";
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

// ── Open Library search ────────────────────────────────────────────────────
async function searchOpenLibrary(query) {
  if (!query || query.length < 3) return [];
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=6&fields=key,title,author_name,cover_i,number_of_pages_median,first_publish_year,isbn`;
  const res = await fetch(url);
  const data = await res.json();
  return (data.docs || []).map(d => ({
    title:       d.title,
    author:      (d.author_name || [])[0] || "",
    cover_url:   d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : "",
    total_pages: d.number_of_pages_median || "",
    isbn:        (d.isbn || [])[0] || "",
  }));
}

// ── Goodreads CSV parser ───────────────────────────────────────────────────
function parseGoodreadsCSV(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  // Parse CSV row respecting quoted fields
  function parseRow(line) {
    const cells = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && inQ && line[i+1] === '"') { cur += '"'; i++; }
      else if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { cells.push(cur.trim()); cur = ""; }
      else { cur += ch; }
    }
    cells.push(cur.trim());
    return cells;
  }

  const headers = parseRow(lines[0]).map(h => h.toLowerCase().replace(/\s+/g,"_"));
  const col = (row, name) => {
    const i = headers.indexOf(name);
    return i >= 0 ? (row[i] || "").replace(/^=?"?|"?$/g, "").trim() : "";
  };

  const books = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseRow(lines[i]);
    if (row.length < 3) continue;

    const shelf = col(row, "exclusive_shelf");
    if (shelf !== "read") continue; // only import read books

    const title = col(row, "title");
    if (!title) continue;

    // Parse date — Goodreads exports as YYYY/MM/DD
    const rawDate = col(row, "date_read");
    let date_read = "";
    if (rawDate) {
      const parts = rawDate.split("/");
      if (parts.length === 3) date_read = `${parts[0]}-${parts[1].padStart(2,"0")}-${parts[2].padStart(2,"0")}`;
      else if (parts.length === 1 && parts[0].length === 4) date_read = `${parts[0]}-01-01`;
    }

    const isbn13 = col(row, "isbn13").replace(/[^0-9]/g,"");
    const isbn   = col(row, "isbn").replace(/[^0-9]/g,"");

    books.push({
      title,
      author:      col(row, "author"),
      total_pages: parseInt(col(row, "number_of_pages")) || null,
      date_read:   date_read || null,
      isbn:        isbn13 || isbn || "",
      // cover will be fetched via Open Library ISBN lookup
      cover_url:   "",
      genres:      [],
      trigger_warnings: [],
      series:      "",
    });
  }
  return books;
}

// ── Cover fetch via ISBN ───────────────────────────────────────────────────
async function fetchCoverByISBN(isbn) {
  if (!isbn) return "";
  // Try Open Library cover API directly — no rate limits for individual lookups
  const url = `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false`;
  try {
    const res = await fetch(url, { method: "HEAD" });
    if (res.ok) return `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`;
  } catch {}
  return "";
}

// ── CSV Import Modal ───────────────────────────────────────────────────────
function CsvImportModal({ C, onClose, onImported }) {
  const [stage, setStage]     = useState("upload");   // upload | preview | importing | done
  const [parsed, setParsed]   = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [progress, setProgress] = useState({ done: 0, total: 0, current: "" });
  const [error, setError]     = useState("");
  const fileRef = useRef();

  const INP = { background: C.bg, border: `1px solid ${C.border}`, borderRadius: 3, color: C.text, fontFamily: "'EB Garamond',serif", fontSize: 14, padding: "7px 11px", outline: "none", boxSizing: "border-box" };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith(".csv")) { setError("Please upload a .csv file"); return; }
    setError("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const books = parseGoodreadsCSV(ev.target.result);
        if (books.length === 0) { setError("No 'read' books found in this CSV. Make sure you're using a Goodreads export."); return; }
        setParsed(books);
        setSelected(new Set(books.map((_, i) => i)));
        setStage("preview");
      } catch (err) {
        setError("Could not parse CSV: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  const toggleAll = () => {
    if (selected.size === parsed.length) setSelected(new Set());
    else setSelected(new Set(parsed.map((_, i) => i)));
  };

  const toggle = (i) => {
    const s = new Set(selected);
    s.has(i) ? s.delete(i) : s.add(i);
    setSelected(s);
  };

  const doImport = async () => {
    const toImport = parsed.filter((_, i) => selected.has(i));
    setProgress({ done: 0, total: toImport.length, current: "" });
    setStage("importing");

    const added = [];
    for (let i = 0; i < toImport.length; i++) {
      const book = toImport[i];
      setProgress({ done: i, total: toImport.length, current: book.title });
      try {
        // Fetch cover if we have an ISBN
        let cover_url = book.cover_url;
        if (!cover_url && book.isbn) {
          cover_url = await fetchCoverByISBN(book.isbn);
        }
        const created = await api.addBook({
          title:      book.title,
          author:     book.author,
          series:     book.series,
          date_read:  book.date_read,
          total_pages: book.total_pages,
          cover_url,
          genres:     [],
          trigger_warnings: [],
        });
        added.push(created);
      } catch (err) {
        console.warn(`Skipped "${book.title}":`, err.message);
      }
    }

    setProgress({ done: toImport.length, total: toImport.length, current: "" });
    setStage("done");
    onImported(added);
  };

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"#00000099", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:C.bg2, border:`1px solid ${C.border}`, borderRadius:8, padding:28, width:"100%", maxWidth:620, maxHeight:"80vh", overflowY:"auto" }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
          <div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:19, color:C.accent, fontStyle:"italic" }}>Import from Goodreads</div>
            <div style={{ fontFamily:"monospace", fontSize:11, color:C.dimmer, marginTop:3 }}>
              Export your library from Goodreads → My Books → Import/Export → Export Library
            </div>
          </div>
          <button onClick={onClose} style={{ background:"transparent", border:"none", color:C.dim, fontSize:20, cursor:"pointer", lineHeight:1 }}>✕</button>
        </div>

        {/* Upload stage */}
        {stage === "upload" && (
          <div>
            <div style={{ border:`2px dashed ${C.border}`, borderRadius:6, padding:40, textAlign:"center", cursor:"pointer" }}
              onClick={() => fileRef.current?.click()}>
              <div style={{ fontSize:32, marginBottom:10 }}>📂</div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:16, color:C.text }}>Drop your CSV here or click to browse</div>
              <div style={{ fontFamily:"monospace", fontSize:11, color:C.dimmer, marginTop:6 }}>goodreads_library_export.csv</div>
              <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} style={{ display:"none" }} />
            </div>
            {error && <div style={{ color:"#e05050", fontFamily:"monospace", fontSize:12, marginTop:10 }}>{error}</div>}
            <div style={{ marginTop:16, fontFamily:"'EB Garamond',serif", fontSize:13, color:C.dimmer, fontStyle:"italic", lineHeight:1.6 }}>
              Only books from your "Read" shelf will be imported. Covers are automatically fetched from Open Library using the ISBN. Genres and trigger warnings can be added afterwards.
            </div>
          </div>
        )}

        {/* Preview stage */}
        {stage === "preview" && (
          <div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
              <div style={{ fontFamily:"monospace", fontSize:12, color:C.dim }}>
                {selected.size} of {parsed.length} books selected
              </div>
              <button onClick={toggleAll} style={{ background:"transparent", border:`1px solid ${C.border}`, borderRadius:3, color:C.dim, fontFamily:"monospace", fontSize:11, padding:"4px 10px", cursor:"pointer" }}>
                {selected.size === parsed.length ? "Deselect all" : "Select all"}
              </button>
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:6, maxHeight:340, overflowY:"auto", paddingRight:4 }}>
              {parsed.map((book, i) => (
                <div key={i} onClick={() => toggle(i)}
                  style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 10px", borderRadius:4, border:`1px solid ${selected.has(i)?C.accent+55:C.border}`, background:selected.has(i)?C.accent+"11":"transparent", cursor:"pointer", transition:"all 0.12s" }}>
                  <div style={{ width:16, height:16, borderRadius:3, border:`2px solid ${selected.has(i)?C.accent:C.border}`, background:selected.has(i)?C.accent:"transparent", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    {selected.has(i) && <span style={{ color:C.bg, fontSize:10, lineHeight:1 }}>✓</span>}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:"'EB Garamond',serif", fontSize:14, color:C.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{book.title}</div>
                    <div style={{ fontFamily:"monospace", fontSize:11, color:C.dimmer }}>
                      {book.author}{book.total_pages ? ` · ${book.total_pages}pp` : ""}{book.date_read ? ` · read ${book.date_read.slice(0,4)}` : ""}
                    </div>
                  </div>
                  {book.isbn && <div style={{ fontFamily:"monospace", fontSize:10, color:C.dimmer, flexShrink:0 }}>has cover</div>}
                </div>
              ))}
            </div>

            <div style={{ display:"flex", gap:10, marginTop:16 }}>
              <button onClick={doImport} disabled={selected.size === 0}
                style={{ background:`linear-gradient(135deg,${C.accent},${C.accent2})`, border:"none", borderRadius:3, color:C.bg, fontFamily:"'Playfair Display',serif", fontSize:13, fontWeight:700, padding:"9px 22px", cursor:selected.size?'pointer':'not-allowed', opacity:selected.size?1:0.5 }}>
                Import {selected.size} book{selected.size!==1?"s":""}
              </button>
              <button onClick={onClose} style={{ background:"transparent", border:`1px solid ${C.border}`, borderRadius:3, color:C.dim, fontFamily:"monospace", fontSize:12, padding:"9px 14px", cursor:"pointer" }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Importing stage */}
        {stage === "importing" && (
          <div style={{ textAlign:"center", padding:"20px 0" }}>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, color:C.accent, marginBottom:16 }}>Importing your books…</div>
            <div style={{ background:C.bg, borderRadius:20, height:8, overflow:"hidden", margin:"0 auto 16px", maxWidth:400 }}>
              <div style={{ height:"100%", background:`linear-gradient(90deg,${C.accent},${C.accent2})`, width:`${(progress.done/progress.total)*100}%`, transition:"width 0.3s", borderRadius:20 }} />
            </div>
            <div style={{ fontFamily:"monospace", fontSize:12, color:C.dimmer }}>{progress.done} / {progress.total}</div>
            {progress.current && (
              <div style={{ fontFamily:"'EB Garamond',serif", fontSize:13, color:C.dim, marginTop:8, fontStyle:"italic" }}>"{progress.current}"</div>
            )}
          </div>
        )}

        {/* Done stage */}
        {stage === "done" && (
          <div style={{ textAlign:"center", padding:"20px 0" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🎉</div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, color:C.accent }}>Import complete!</div>
            <div style={{ fontFamily:"'EB Garamond',serif", fontSize:14, color:C.dim, marginTop:8 }}>
              {progress.total} book{progress.total!==1?"s":""} added to the library. You can add genres and trigger warnings by clicking into each book.
            </div>
            <button onClick={onClose} style={{ background:`linear-gradient(135deg,${C.accent},${C.accent2})`, border:"none", borderRadius:3, color:C.bg, fontFamily:"'Playfair Display',serif", fontSize:13, fontWeight:700, padding:"9px 22px", cursor:"pointer", marginTop:20 }}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Library component ─────────────────────────────────────────────────
export default function Library() {
  const { C }    = useTheme();
  const { user } = useAuth();

  const [view,     setView]     = useState("library");
  const [books,    setBooks]    = useState([]);
  const [reviews,  setReviews]  = useState({});
  const [progress, setProgress] = useState([]);
  const [noms,     setNoms]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [search,   setSearch]   = useState("");
  const [filterG,  setFilterG]  = useState("");
  const [sortBy,   setSortBy]   = useState("added_at");
  const [statusFilter, setStatusFilter] = useState("");
  const [form,     setForm]     = useState({ title:"", author:"", series:"", genres:[], trigger_warnings:[], date_read:"", cover_url:"", total_pages:"" });
  const [coverFile, setCoverFile] = useState(null);
  const titleRef = useRef();

  // ── Book search state ──────────────────────────────────────────────────
  const [bookQuery,      setBookQuery]      = useState("");
  const [searchResults,  setSearchResults]  = useState([]);
  const [searchLoading,  setSearchLoading]  = useState(false);
  const [showResults,    setShowResults]    = useState(false);
  const searchDebounce = useRef(null);

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

  // ── Debounced Open Library search ──────────────────────────────────────
  const handleBookQueryChange = (val) => {
    setBookQuery(val);
    clearTimeout(searchDebounce.current);
    if (!val.trim()) { setSearchResults([]); setShowResults(false); return; }
    searchDebounce.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await searchOpenLibrary(val);
        setSearchResults(results);
        setShowResults(true);
      } catch {}
      setSearchLoading(false);
    }, 400);
  };

  const pickSearchResult = (result) => {
    setForm(f => ({
      ...f,
      title:       result.title,
      author:      result.author,
      cover_url:   result.cover_url,
      total_pages: result.total_pages ? String(result.total_pages) : f.total_pages,
    }));
    setBookQuery("");
    setShowResults(false);
    // Focus the series field next since title+author+cover are filled
    setTimeout(() => titleRef.current?.focus(), 50);
  };

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

  const handleCsvImported = (addedBooks) => {
    setBooks(b => [...addedBooks, ...b]);
    setShowCsvModal(false);
  };

  const myProgressMap = {};
  progress.forEach(p => { myProgressMap[p.book_id] = p; });

  const filtered = books
    .filter(b => {
      const q = search.toLowerCase();
      return (!q || b.title.toLowerCase().includes(q) || (b.author||"").toLowerCase().includes(q) || (b.series||"").toLowerCase().includes(q))
        && (!filterG || (b.genres||[]).includes(filterG))
        && (!statusFilter || myProgressMap[b.id]?.status === statusFilter);
    })
    .sort((a, b) => {
      if (sortBy==="title")      return a.title.localeCompare(b.title);
      if (sortBy==="author")     return (a.author||"").localeCompare(b.author||"");
      if (sortBy==="series")     return (a.series||"zzz").localeCompare(b.series||"zzz");
      if (sortBy==="avg_rating") return (b.avg_rating||0)-(a.avg_rating||0);
      if (sortBy==="date_read")  return (b.date_read||"").localeCompare(a.date_read||"");
      return new Date(b.added_at)-new Date(a.added_at);
    });

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
          <div style={{ display:"flex", gap:8 }}>
            <button
              onClick={() => setShowCsvModal(true)}
              style={{ background:"transparent", border:`1px solid ${C.border}`, borderRadius:4, color:C.dim, fontFamily:"monospace", fontSize:12, padding:"8px 14px", cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
              📥 Import from Goodreads
            </button>
            <button onClick={()=>{ setShowForm(!showForm); setTimeout(()=>titleRef.current?.focus(),50); }}
              style={{ background:`linear-gradient(135deg,${C.accent},${C.accent2})`, border:"none", borderRadius:4, color:C.bg, fontFamily:"'Playfair Display',serif", fontSize:14, fontWeight:700, padding:"9px 18px", cursor:"pointer" }}>
              + Add Book
            </button>
          </div>
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
            <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{ background:C.vdark, border:`1px solid ${C.border}`, borderRadius:3, color:statusFilter?C.accent:C.dim, fontFamily:"monospace", fontSize:12, padding:"7px 10px", outline:"none" }}>
              <option value="">All Statuses</option>
              <option value="reading">📖 Reading</option>
              <option value="finished">✅ Finished</option>
              <option value="want_to_read">📚 Want to Read</option>
              <option value="dnf">💀 DNF</option>
            </select>
          </div>

          {/* Add form */}
          {showForm && (
            <div style={{ background:C.bg2, borderBottom:`1px solid ${C.border}`, padding:"20px 24px" }}>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:17, marginBottom:14, color:C.accent, fontStyle:"italic" }}>Add a Book to the Club</div>

              {/* ── Open Library search ── */}
              <div style={{ marginBottom:18, position:"relative" }}>
                <label style={{ display:"block", fontFamily:"monospace", fontSize:11, color:C.accent2, marginBottom:4 }}>🔍 SEARCH TO PRE-FILL</label>
                <div style={{ position:"relative" }}>
                  <input
                    value={bookQuery}
                    onChange={e => handleBookQueryChange(e.target.value)}
                    onBlur={() => setTimeout(() => setShowResults(false), 150)}
                    onFocus={() => searchResults.length > 0 && setShowResults(true)}
                    placeholder="Type a title or author to look up details…"
                    style={{ ...INP, paddingRight: searchLoading ? 36 : 11 }}
                  />
                  {searchLoading && (
                    <span style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", color:C.dimmer, fontSize:12, fontFamily:"monospace" }}>…</span>
                  )}
                </div>

                {showResults && searchResults.length > 0 && (
                  <div style={{ position:"absolute", top:"100%", left:0, right:0, background:C.card, border:`1px solid ${C.border}`, borderRadius:4, zIndex:50, boxShadow:"0 8px 24px #0005", overflow:"hidden" }}>
                    {searchResults.map((r, i) => (
                      <div key={i} onMouseDown={() => pickSearchResult(r)}
                        style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", borderBottom: i < searchResults.length-1 ? `1px solid ${C.border2}` : "none", cursor:"pointer", transition:"background 0.1s" }}
                        onMouseEnter={e => e.currentTarget.style.background = C.bg2}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        {r.cover_url
                          ? <img src={r.cover_url} alt="" style={{ width:28, height:40, objectFit:"cover", borderRadius:2, flexShrink:0 }} />
                          : <div style={{ width:28, height:40, background:C.border, borderRadius:2, flexShrink:0 }} />
                        }
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontFamily:"'EB Garamond',serif", fontSize:14, color:C.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{r.title}</div>
                          <div style={{ fontFamily:"monospace", fontSize:11, color:C.dimmer }}>
                            {r.author}{r.total_pages ? ` · ${r.total_pages}pp` : ""}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Manual fields */}
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
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:14, alignItems:"stretch" }}>
                {filtered.map(book => (
                  <BookCard
                    key={book.id}
                    book={book}
                    reviews={reviews[book.id]||[]}
                    myProgress={myProgressMap[book.id]}
                    currentUser={user}
                    onClick={setSelected}
                    onNominate={!nominatedBookIds.has(book.id) && !book.botm_month ? () => nominate(book.id) : null}
                    isNominated={nominatedBookIds.has(book.id)}
                  />
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

      {showCsvModal && (
        <CsvImportModal
          C={C}
          onClose={() => setShowCsvModal(false)}
          onImported={handleCsvImported}
        />
      )}
    </div>
  );
}
