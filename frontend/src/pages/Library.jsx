import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useTheme, useAuth } from "../App";
import { api } from "../api";
import BookCard from "../components/BookCard";
import BookModal from "../components/BookModal";
import { GenrePicker, GENRES, genreColor, TwPicker, Avatar } from "../components/ui";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return isMobile;
}

// ── Strip trailing series/edition info from a title ────────────────────────
// Search results (Open Library, Google Books) often embed series info in the
// title itself, e.g. "Twisted Trails (Rogue Riders Duet Book 2)" or
// "The Name of the Wind (The Kingkiller Chronicle, #1)". Our library stores
// series separately, so for matching/dedup purposes (and when filling the
// form) we strip this trailing parenthetical to get the core title.
// Returns { title, series } — series is "" if nothing was stripped.
function stripSeriesFromTitle(rawTitle) {
  if (!rawTitle) return { title: "", series: "" };
  const match = rawTitle.match(/^(.+?)\s*\((.+)\)\s*$/);
  if (!match) return { title: rawTitle.trim(), series: "" };

  const core   = match[1].trim();
  const inside = match[2].trim();

  // Only treat the parenthetical as series info if it looks like one —
  // contains "book N", "#N", "series", "duet", "trilogy", etc. Otherwise
  // it might just be a subtitle/clarification and shouldn't be stripped.
  if (/book\s*\d|#\s*\d|\bseries\b|\bduet\b|\btrilogy\b|\bsaga\b/i.test(inside)) {
    return { title: core, series: inside };
  }
  return { title: rawTitle.trim(), series: "" };
}

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
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=6&fields=key,title,author_name,cover_i,number_of_pages_median,first_publish_year,isbn,subject,series`;
  const res = await fetch(url);
  const data = await res.json();
  return (data.docs || []).map(d => ({
    title:       d.title,
    author:      (d.author_name || [])[0] || "",
    cover_url:   d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : "",
    total_pages: d.number_of_pages_median || "",
    isbn:        (d.isbn || [])[0] || "",
    series:      (d.series || [])[0] || "",
    subjects:    d.subject || [],
    source:      "openlibrary",
  }));
}

// ── Google Books search ────────────────────────────────────────────────────
// Covers indie/self-published titles much better than Open Library.
// No API key needed for basic search queries.
async function searchGoogleBooks(query) {
  if (!query || query.length < 3) return [];
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=6`;
  const res = await fetch(url);
  if (res.status === 429 || res.status === 403) return []; // rate limited — silently skip
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items || []).map(item => {
    const info = item.volumeInfo || {};
    const series = info.subtitle && /book\s*\d|#\d|series|duet|trilogy/i.test(info.subtitle)
      ? info.subtitle
      : "";
    return {
      title:       info.title || "",
      author:      (info.authors || [])[0] || "",
      cover_url:   info.imageLinks?.thumbnail?.replace("http://", "https://") || "",
      total_pages: info.pageCount || "",
      isbn:        (info.industryIdentifiers || []).find(id => id.type === "ISBN_13")?.identifier
                 || (info.industryIdentifiers || []).find(id => id.type === "ISBN_10")?.identifier
                 || "",
      series,
      subjects:    info.categories || [],
      source:      "googlebooks",
    };
  });
}

// ── Merge & dedupe search results ──────────────────────────────────────────
// Combines results from multiple sources, removing entries that represent
// the same book (matched on normalized core title + author, with any
// series/edition info stripped from the title first). Open Library results
// are kept over Google Books duplicates when both exist, since Open Library
// covers tend to be slightly higher quality — but Google Books-only hits
// (common for indie/self-published books) are always included.
function normalizeKey(title, author) {
  const norm = s => (s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  const { title: coreTitle } = stripSeriesFromTitle(title);
  return `${norm(coreTitle)}|${norm(author)}`;
}

function mergeSearchResults(openLibraryResults, googleBooksResults, limit = 8) {
  const merged = [];
  const seen   = new Set();

  for (const r of openLibraryResults) {
    const key = normalizeKey(r.title, r.author);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(r);
  }
  for (const r of googleBooksResults) {
    const key = normalizeKey(r.title, r.author);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(r);
  }
  return merged.slice(0, limit);
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

  // Goodreads puts series info inside the title: "The Name of the Wind (The Kingkiller Chronicle, #1)"
  // Extract it into a separate series field
  function extractSeries(rawTitle) {
    const match = rawTitle.match(/^(.+?)\s*\((.+?),?\s*#([\d.]+)\)\s*$/);
    if (match) {
      return {
        title:  match[1].trim(),
        series: `${match[2].trim()} #${match[3]}`,
      };
    }
    return { title: rawTitle, series: "" };
  }

  const books = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseRow(lines[i]);
    if (row.length < 3) continue;

    const shelf = col(row, "exclusive_shelf");
    if (shelf !== "read") continue;

    const rawTitle = col(row, "title");
    if (!rawTitle) continue;

    const { title, series } = extractSeries(rawTitle);

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
      series,
      author:      col(row, "author"),
      total_pages: parseInt(col(row, "number_of_pages")) || null,
      date_read:   date_read || null,
      isbn:        isbn13 || isbn || "",
      cover_url:   "",
      genres:      [],
      trigger_warnings: [],
    });
  }
  return books;
}

// ── Cover fetch via ISBN ───────────────────────────────────────────────────
// Uses Open Library Books API (returns JSON) to get the cover ID, then builds
// the cover URL — avoids CORS issues with HEAD requests to covers.openlibrary.org
async function fetchCoverByISBN(isbn) {
  if (!isbn) return "";
  try {
    const res  = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
    const data = await res.json();
    const book = data[`ISBN:${isbn}`];
    if (!book) return "";
    // cover.medium is most reliable; fall back to large then small
    return book.cover?.medium || book.cover?.large || book.cover?.small || "";
  } catch {
    return "";
  }
}

// ── CSV Import Modal ───────────────────────────────────────────────────────
function CsvImportModal({ C, onClose, onImported, existingBooks }) {
  const isMobile = window.innerWidth < 640;
  const [stage, setStage]     = useState("upload");   // upload | preview | importing | done
  const [parsed, setParsed]   = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [skipped, setSkipped]  = useState(0);
  const [progress, setProgress] = useState({ done: 0, total: 0, current: "" });
  const [error, setError]     = useState("");
  const fileRef = useRef();

  // Build a lowercase title set from the current library for duplicate detection
  const existingTitles = new Set(
    (existingBooks || []).map(b => b.title.toLowerCase().trim())
  );

  const INP = { background: C.bg, border: `1px solid ${C.border}`, borderRadius: 3, color: C.text, fontFamily: "'EB Garamond',serif", fontSize: 14, padding: "7px 11px", outline: "none", boxSizing: "border-box" };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith(".csv")) { setError("Please upload a .csv file"); return; }
    setError("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const all  = parseGoodreadsCSV(ev.target.result);
        if (all.length === 0) { setError("No 'read' books found in this CSV. Make sure you're using a Goodreads export."); return; }
        // Split into new and already-in-library
        const newBooks  = all.filter(b => !existingTitles.has(b.title.toLowerCase().trim()));
        const dupCount  = all.length - newBooks.length;
        setSkipped(dupCount);
        if (newBooks.length === 0) { setError(`All ${dupCount} book${dupCount!==1?"s":""} in this CSV are already in the library.`); return; }
        setParsed(newBooks);
        setSelected(new Set(newBooks.map((_, i) => i)));
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
          silent:     true,
          source:     "csv",
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
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"#00000099", zIndex:200, display:"flex", alignItems: isMobile ? "flex-end" : "flex-start", justifyContent:"center", padding: isMobile ? 0 : "12px 8px", overflowY: isMobile ? "hidden" : "auto" }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:C.bg2, border:`1px solid ${C.border}`, borderRadius: isMobile ? "16px 16px 0 0" : 8, padding: isMobile ? "0 16px 20px" : "20px 16px", width:"100%", maxWidth:620, overflowY:"auto", maxHeight: isMobile ? "92dvh" : "none", paddingBottom: isMobile ? `calc(20px + env(safe-area-inset-bottom))` : undefined }}>
        {isMobile && <div style={{ width:36, height:4, background:"#3d2f5e", borderRadius:2, margin:"10px auto 16px" }} />}

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
                {skipped > 0 && (
                  <span style={{ color:C.dimmer }}> · {skipped} already in library, skipped</span>
                )}
              </div>
              <button onClick={toggleAll} style={{ background:"transparent", border:`1px solid ${C.border}`, borderRadius:3, color:C.dim, fontFamily:"monospace", fontSize:11, padding:"4px 10px", cursor:"pointer" }}>
                {selected.size === parsed.length ? "Deselect all" : "Select all"}
              </button>
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:6, maxHeight:340, overflowY:"auto", paddingRight:4 }}>
              {parsed.map((book, i) => (
                <div key={i} onClick={() => toggle(i)}
                  style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 10px", borderRadius:4, border:`1px solid ${selected.has(i)?C.accent+55:C.border}`, background:selected.has(i)?C.accent+"11":"transparent", cursor:"pointer", transition:"all 0.12s" }}>
                  <div style={{ width:22, height:22, borderRadius:4, border:`2px solid ${selected.has(i)?C.accent:C.border}`, background:selected.has(i)?C.accent:"transparent", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    {selected.has(i) && <span style={{ color:C.bg, fontSize:13, lineHeight:1, fontWeight:700 }}>✓</span>}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:"'EB Garamond',serif", fontSize:14, color:C.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{book.title}</div>
                    <div style={{ fontFamily:"monospace", fontSize:11, color:C.dimmer }}>
                      {book.author}{book.total_pages ? ` · ${book.total_pages}pp` : ""}{book.date_read ? ` · ${book.date_read.slice(0,4)}` : ""}
                    </div>
                  </div>
                  {book.isbn && <div style={{ fontFamily:"monospace", fontSize:10, color:C.accent2, flexShrink:0 }}>📷</div>}
                </div>
              ))}
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:8, marginTop:16 }}>
              <button onClick={doImport} disabled={selected.size === 0}
                style={{ background:`linear-gradient(135deg,${C.accent},${C.accent2})`, border:"none", borderRadius:6, color:C.bg, fontFamily:"'Playfair Display',serif", fontSize:14, fontWeight:700, padding:"12px 22px", cursor:selected.size?'pointer':'not-allowed', opacity:selected.size?1:0.5, width:"100%" }}>
                Import {selected.size} book{selected.size!==1?"s":""}
              </button>
              <button onClick={onClose} style={{ background:"transparent", border:`1px solid ${C.border}`, borderRadius:6, color:C.dim, fontFamily:"monospace", fontSize:12, padding:"11px 14px", cursor:"pointer", width:"100%" }}>Cancel</button>
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
// Rendered via portal so no parent overflow/stacking context can clip it.
// Defined outside Library so it has a stable identity across re-renders.
function SearchDropdown({ results, anchorEl, onPick, C }) {
  if (!results.length || !anchorEl) return null;
  const rect = anchorEl.getBoundingClientRect();
  return createPortal(
    <div style={{
      position:"fixed",
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      background:C.card,
      border:`1px solid ${C.border}`,
      borderRadius:4,
      zIndex:9999,
      boxShadow:"0 8px 24px #0008",
      overflow:"hidden",
      maxHeight:320,
      overflowY:"auto",
    }}>
      {results.map((r, i) => (
        <div key={i}
          onMouseDown={e => { e.preventDefault(); onPick(r); }}
          onTouchEnd={e => { e.preventDefault(); onPick(r); }}
          style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderBottom: i < results.length-1 ? `1px solid ${C.border2}` : "none", cursor:"pointer", background:"transparent" }}
          onTouchStart={e => { e.currentTarget.style.background = C.bg2; }}
          onTouchCancel={e => { e.currentTarget.style.background = "transparent"; }}
          onMouseEnter={e => { e.currentTarget.style.background = C.bg2; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
          {r.cover_url
            ? <img src={r.cover_url} alt="" style={{ width:28, height:40, objectFit:"cover", borderRadius:2, flexShrink:0 }} />
            : <div style={{ width:28, height:40, background:C.border, borderRadius:2, flexShrink:0 }} />
          }
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontFamily:"'EB Garamond',serif", fontSize:14, color:C.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{r.title}</div>
            <div style={{ fontFamily:"monospace", fontSize:11, color:C.dimmer }}>{r.author}{r.total_pages ? ` · ${r.total_pages}pp` : ""}</div>
          </div>
          {r.alreadyInLibrary && (
            <span style={{ fontFamily:"monospace", fontSize:10, color:C.accent2, border:`1px solid ${C.accent2}55`, borderRadius:3, padding:"2px 6px", flexShrink:0 }}>In library</span>
          )}
        </div>
      ))}
    </div>,
    document.body
  );
}

export default function Library() {
  const { C }    = useTheme();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const nav      = useNavigate();

  const [view,     setView]     = useState("library");
  const [books,    setBooks]    = useState([]);
  const [reviews,  setReviews]  = useState({});
  const [progress, setProgress] = useState([]);
  const [noms,     setNoms]     = useState([]);
  const [readingNow, setReadingNow] = useState([]);
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
  const gridRef  = useRef();
  const titleRef = useRef();

  const closeForm = () => {
    setShowForm(false);
    setTimeout(() => gridRef.current?.scrollIntoView({ behavior:"smooth", block:"start" }), 50);
  };

  // ── Book search state ──────────────────────────────────────────────────
  const [bookQuery,      setBookQuery]      = useState("");
  const [searchResults,  setSearchResults]  = useState([]);
  const [searchLoading,  setSearchLoading]  = useState(false);
  const [showResults,    setShowResults]    = useState(false);
  const [searchError, setSearchError] = useState("");
  const searchDebounce = useRef(null);
  const searchInputRef = useRef(null);
  const searchWrapRef  = useRef(null);

  // Close dropdown when tapping outside the search area
  useEffect(() => {
    const handler = (e) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, []);

  const INP = { width:"100%", background:C.bg, border:`1px solid ${C.border}`, borderRadius:3, color:C.text, fontFamily:"'EB Garamond',serif", fontSize:15, padding:"7px 11px", outline:"none", boxSizing:"border-box" };

  const load = async () => {
    setLoading(true);
    try {
      const [b, r, p, n, rn] = await Promise.all([api.getBooks(), api.getReviews(), api.getProgress(), api.getNominations(), api.getReadingNow()]);
      setBooks(b); setReviews(r); setProgress(p); setNoms(n); setReadingNow(rn);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // ── Debounced search — Open Library + Google Books, merged ──────────────
  const handleBookQueryChange = (val) => {
    setBookQuery(val);
    setSearchError("");
    clearTimeout(searchDebounce.current);
    if (!val.trim()) { setSearchResults([]); setShowResults(false); return; }
    if (val.trim().length < 3) return;
    searchDebounce.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const [olResults, gbResults] = await Promise.all([
          searchOpenLibrary(val).catch(() => []),
          searchGoogleBooks(val).catch(() => []),  // 429s caught here, returns []
        ]);
        const merged = mergeSearchResults(olResults, gbResults);

        // Flag results that match a book already in the library.
        // Match on normalized title+author first (handles subtitle/edition
        // differences like "Twisted Trails" vs "Twisted Trails (Rogue Riders
        // Duet Book 2)"); fall back to title-only in case author is missing
        // on either side.
        const existingByTitleAuthor = new Set(books.map(b => normalizeKey(b.title, b.author)));
        const existingByTitleOnly   = new Set(books.map(b => normalizeKey(b.title, "")));
        const flagged = merged.map(r => ({
          ...r,
          alreadyInLibrary:
            existingByTitleAuthor.has(normalizeKey(r.title, r.author)) ||
            existingByTitleOnly.has(normalizeKey(r.title, "")),
        }));

        setSearchResults(flagged);
        setShowResults(true);
        setSearchError("");
      } catch (err) {
        console.error("Search error:", err);
        setSearchError(err.message || "Search failed");
      }
      setSearchLoading(false);
    }, 700);
  };

  const pickSearchResult = (result) => {
    // Match Open Library subjects against our GENRES list (case-insensitive)
    const matchedGenres = GENRES.filter(g =>
      (result.subjects || []).some(s => s.toLowerCase().includes(g.toLowerCase()) || g.toLowerCase().includes(s.toLowerCase()))
    ).slice(0, 5);

    // Some results embed series info in the title itself, e.g.
    // "Twisted Trails (Rogue Riders Duet Book 2)" — split that out so the
    // title field stays clean and the series field gets populated.
    const { title: cleanTitle, series: titleSeries } = stripSeriesFromTitle(result.title);

    setForm(f => ({
      ...f,
      title:       cleanTitle || result.title,
      author:      result.author,
      cover_url:   result.cover_url,
      total_pages: result.total_pages ? String(result.total_pages) : f.total_pages,
      series:      result.series || titleSeries || f.series,
      genres:      matchedGenres.length > 0 ? matchedGenres : f.genres,
    }));
    setBookQuery("");
    setShowResults(false);
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
    closeForm();
  };

  const [toast, setToast] = useState(null);

  const showToast = (msg, color = C.accent) => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 3000);
  };

  const nominate = async (bookId) => {
    const updated = await api.nominate(bookId);
    setNoms(updated);
    const book = books.find(b => b.id === bookId);
    showToast(`📚 "${book?.title}" nominated!`);
  };

  const [confirmRemoveNom, setConfirmRemoveNom] = useState(null);

  const vote = async (nomId, iVoted) => {
    const updated = iVoted ? await api.unvoteNomination(nomId) : await api.voteNomination(nomId);
    setNoms(updated);
    showToast(iVoted ? "Vote removed" : "👍 Vote cast!", iVoted ? C.dimmer : C.accent);
  };

  const removeNom = async (nomId) => {
    const updated = await api.deleteNomination(nomId);
    setNoms(updated);
    setConfirmRemoveNom(null);
    showToast("Nomination removed", C.dimmer);
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
    <button onClick={()=>setView(v)} style={{ fontFamily:"monospace", fontSize: isMobile ? 12 : 13, padding: isMobile ? "7px 10px" : "8px 18px", cursor:"pointer", border:"none", background:view===v?C.accent2:"transparent", color:view===v?C.bg:C.dim, borderRadius:4, transition:"all 0.15s" }}>
      {label}
    </button>
  );

  // BOTM books sorted newest first
  const botmBooks = [...books].filter(b => b.botm_month).sort((a,b) => {
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const parse = (s) => { const [m,y] = s.split(" "); return parseInt(y)*12 + months.indexOf(m); };
    return parse(b.botm_month) - parse(a.botm_month);
  });

  return (
    <div style={{ minHeight:"calc(100vh - 55px)" }}>
      {/* Sub-header */}
      <div style={{ background:`linear-gradient(180deg,${C.bg2},${C.bg})`, borderBottom:`1px solid ${C.border}`, padding: isMobile ? "10px 12px" : "14px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
        <div style={{ display:"flex", gap:4 }}>
          {tabBtn("library",     isMobile ? `📚 (${books.length})`        : `📚 Library (${books.length})`)}
          {tabBtn("reading-now", isMobile ? `📖 (${readingNow.length})`   : `📖 Reading Now (${readingNow.length})`)}
          {tabBtn("nominations", isMobile ? `🗳 (${noms.length})`         : `🗳 Nominations (${noms.length})`)}
          {tabBtn("botm",        isMobile ? `🏆`                          : `🏆 BOTM History`)}
        </div>
        {view==="library" && (          <div style={{ display:"flex", gap:6 }}>
            <button
              onClick={() => setShowCsvModal(true)}
              title="Import from Goodreads"
              style={{ background:"transparent", border:`1px solid ${C.border}`, borderRadius:4, color:C.dim, fontFamily:"monospace", fontSize:12, padding: isMobile ? "7px 10px" : "8px 14px", cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
              {isMobile ? "📥" : "📥 Import from Goodreads"}
            </button>
            <button onClick={()=>{ setShowForm(!showForm); setTimeout(()=>titleRef.current?.focus(),50); }}
              style={{ background:`linear-gradient(135deg,${C.accent},${C.accent2})`, border:"none", borderRadius:4, color:C.bg, fontFamily:"'Playfair Display',serif", fontSize: isMobile ? 13 : 14, fontWeight:700, padding: isMobile ? "7px 14px" : "9px 18px", cursor:"pointer" }}>
              {isMobile ? "+" : "+ Add Book"}
            </button>
          </div>
        )}
      </div>

      {/* ── NOMINATIONS VIEW ── */}
      {view==="nominations" && (
        <div style={{ padding: isMobile ? "16px 12px" : "24px", maxWidth:720, margin:"0 auto" }}>
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

          <div style={{ display:"flex", flexDirection:"column", gap: isMobile ? 8 : 12 }}>
            {[...noms].sort((a,b) => (b.vote_count||0) - (a.vote_count||0)).map(n => (
              <div key={n.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:6, padding: isMobile ? "12px" : "16px 18px", display:"flex", gap: isMobile ? 10 : 14, alignItems:"center" }}>
                {n.cover_url && <img src={n.cover_url} alt={n.title} style={{ width: isMobile ? 36 : 44, height: isMobile ? 50 : 62, objectFit:"cover", borderRadius:3, flexShrink:0 }} />}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:"'Playfair Display',serif", fontSize: isMobile ? 14 : 16, color:C.text, fontWeight:700, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{n.title}</div>
                  {n.author && <div style={{ fontFamily:"'EB Garamond',serif", fontSize:13, color:C.muted, fontStyle:"italic" }}>by {n.author}</div>}
                  <div style={{ fontFamily:"monospace", fontSize:11, color:C.dimmer, marginTop:4 }}>
                    Nominated by{" "}
                    <span onClick={e => { e.stopPropagation(); if (n.nominated_by_id) nav(`/profile/${n.nominated_by_id}`); }}
                      style={{ color:n.nominated_by_id?C.accent:C.dimmer, cursor:n.nominated_by_id?"pointer":"default", textDecoration:n.nominated_by_id?"underline":"none" }}>
                      {n.nominated_by_name}
                    </span>
                  </div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
                  <button onClick={()=>vote(n.id, n.i_voted)}
                    style={{ background:n.i_voted?C.accent2+"33":"transparent", border:`1px solid ${n.i_voted?C.accent2:C.border}`, borderRadius:6, color:n.i_voted?C.accent2:C.dim, fontFamily:"monospace", fontSize: isMobile ? 13 : 12, padding: isMobile ? "10px 14px" : "6px 14px", cursor:"pointer", transition:"all 0.15s", minWidth: isMobile ? 48 : "auto", minHeight: isMobile ? 48 : "auto", display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
                    <span style={{ fontSize: isMobile ? 14 : 12 }}>▲</span>
                    <span style={{ fontWeight:700 }}>{n.vote_count}</span>
                  </button>
                  {(n.i_nominated||user?.is_admin) && (
                    confirmRemoveNom === n.id
                      ? <div style={{ display:"flex", gap:4, alignItems:"center" }}>
                          <button onClick={() => removeNom(n.id)} style={{ background:"#5a1a30", border:"1px solid #a33", borderRadius:3, color:"#ffaacc", fontFamily:"monospace", fontSize:11, padding:"3px 8px", cursor:"pointer" }}>Yes</button>
                          <button onClick={() => setConfirmRemoveNom(null)} style={{ background:"transparent", border:`1px solid ${C.border}`, borderRadius:3, color:C.dim, fontFamily:"monospace", fontSize:11, padding:"3px 8px", cursor:"pointer" }}>No</button>
                        </div>
                      : <button onClick={() => setConfirmRemoveNom(n.id)} style={{ background:"transparent", border:"none", color:C.dimmer, fontFamily:"monospace", fontSize:11, cursor:"pointer" }}>remove</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── READING NOW VIEW ── */}
      {view==="reading-now" && (
        <div style={{ padding: isMobile ? "16px 12px" : "24px", maxWidth:720, margin:"0 auto" }}>
          <div style={{ fontFamily:"'EB Garamond',serif", fontSize:14, color:C.dimmer, fontStyle:"italic", marginBottom:20 }}>
            What club members are reading right now.
          </div>
          {readingNow.length === 0 ? (
            <div style={{ textAlign:"center", padding:60, color:C.dimmer }}>
              <div style={{ fontSize:36, marginBottom:10 }}>📖</div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18 }}>Nobody's reading right now</div>
              <div style={{ fontFamily:"'EB Garamond',serif", fontSize:14, marginTop:6, fontStyle:"italic" }}>Pick up a book and get started!</div>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {readingNow.map((r,i) => {
                const pct = r.total_pages && r.current_page ? Math.round((r.current_page/r.total_pages)*100) : null;
                const book = books.find(b => b.id === r.book_id);
                return (
                  <div key={i} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:6, padding:"14px 16px", display:"flex", gap:12, alignItems:"center" }}>
                    {/* Book area — opens modal */}
                    <div onClick={() => book && setSelected(book)} style={{ display:"flex", gap:12, alignItems:"center", flex:1, minWidth:0, cursor:"pointer" }}>
                      {r.cover_url
                        ? <img src={r.cover_url} alt={r.title} style={{ width:44, height:62, objectFit:"cover", borderRadius:3, flexShrink:0 }} />
                        : <div style={{ width:44, height:62, background:C.border, borderRadius:3, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>📚</div>
                      }
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:15, color:C.text, fontWeight:700, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{r.title}</div>
                        {r.author && <div style={{ fontFamily:"'EB Garamond',serif", fontSize:13, color:C.muted, fontStyle:"italic" }}>by {r.author}</div>}
                        {pct !== null && (
                          <>
                            <div style={{ background:C.bg, borderRadius:10, height:4, overflow:"hidden", margin:"8px 0 3px" }}>
                              <div style={{ height:"100%", width:`${pct}%`, background:`linear-gradient(90deg,${C.accent},${C.accent2})`, borderRadius:10 }} />
                            </div>
                            <div style={{ fontFamily:"monospace", fontSize:10, color:C.dimmer }}>{pct}% · p.{r.current_page} of {r.total_pages}</div>
                          </>
                        )}
                      </div>
                    </div>
                    {/* Member avatar — navigates to profile */}
                    <div onClick={() => nav(`/profile/${r.member_id}`)} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, flexShrink:0, cursor:"pointer" }}>
                      {r.avatar_url
                        ? <img src={r.avatar_url} alt="" style={{ width:28, height:28, borderRadius:"50%", border:`2px solid ${C.accent}` }} />
                        : <div style={{ width:28, height:28, borderRadius:"50%", background:C.accent2, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, color:C.bg, fontWeight:700 }}>
                            {(r.display_name||r.username||"?")[0].toUpperCase()}
                          </div>
                      }
                      <div style={{ fontFamily:"monospace", fontSize:9, color:C.accent, textAlign:"center", maxWidth:50, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.display_name||r.username}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── BOTM HISTORY VIEW ── */}
      {view==="botm" && (
        <div style={{ padding: isMobile ? "16px 12px" : "24px", maxWidth:720, margin:"0 auto" }}>
          <div style={{ fontFamily:"'EB Garamond',serif", fontSize:14, color:C.dimmer, fontStyle:"italic", marginBottom:20 }}>
            Every book the club has read together, newest first.
          </div>
          {botmBooks.length === 0 ? (
            <div style={{ textAlign:"center", padding:60, color:C.dimmer }}>
              <div style={{ fontSize:36, marginBottom:10 }}>🏆</div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18 }}>No BOTMs yet</div>
              <div style={{ fontFamily:"'EB Garamond',serif", fontSize:14, marginTop:6, fontStyle:"italic" }}>Admins can set the Book of the Month from the admin dashboard</div>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {botmBooks.map((book, i) => {
                const bookReviews = reviews[book.id] || [];
                const avg = bookReviews.filter(r=>r.rating>0).reduce((s,r)=>s+r.rating,0) / (bookReviews.filter(r=>r.rating>0).length||1);
                return (
                  <div key={book.id} onClick={() => setSelected(book)}
                    style={{ background:C.card, border:`1px solid ${C.border}`, borderLeft:`4px solid #ffd700`, borderRadius:6, padding:"14px 16px", display:"flex", gap:12, alignItems:"center", cursor:"pointer" }}>
                    {book.cover_url
                      ? <img src={book.cover_url} alt={book.title} style={{ width:44, height:62, objectFit:"cover", borderRadius:3, flexShrink:0 }} />
                      : <div style={{ width:44, height:62, background:C.border, borderRadius:3, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>📚</div>
                    }
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:"monospace", fontSize:10, color:"#ffd700", marginBottom:3 }}>🏆 {book.botm_month}</div>
                      <div style={{ fontFamily:"'Playfair Display',serif", fontSize:15, color:C.text, fontWeight:700, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{book.title}</div>
                      {book.author && <div style={{ fontFamily:"'EB Garamond',serif", fontSize:13, color:C.muted, fontStyle:"italic", marginBottom:6 }}>by {book.author}</div>}
                      <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
                        {bookReviews.filter(r=>r.rating>0).length > 0 && <span style={{ fontFamily:"monospace", fontSize:11, color:C.dimmer }}>⭐ {avg.toFixed(1)} avg</span>}
                        {bookReviews.length > 0 && <span style={{ fontFamily:"monospace", fontSize:11, color:C.dimmer }}>💬 {bookReviews.length} review{bookReviews.length!==1?"s":""}</span>}
                        {book.total_pages && <span style={{ fontFamily:"monospace", fontSize:11, color:C.dimmer }}>📖 {book.total_pages}pp</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── LIBRARY VIEW ── */}
      {view==="library" && (
        <>
          {/* Genre strip */}
          {activeGenres.length > 0 && (
            <div>
              <div style={{ display:"flex", borderBottom:`1px solid ${C.border2}` }}>
                {activeGenres.map(g => {
                  const count = books.filter(b=>(b.genres||[]).includes(g)).length;
                  return <div key={g} onClick={()=>setFilterG(filterG===g?"":g)} title={`${g}: ${count}`}
                    style={{ flex:count, height:5, background:filterG===g||!filterG?genreColor(g):genreColor(g)+"33", cursor:"pointer", transition:"background 0.2s" }} />;
                })}
              </div>
              {isMobile && filterG && (
                <div style={{ padding:"4px 12px", display:"flex", alignItems:"center", gap:6 }}>
                  <div style={{ width:8, height:8, borderRadius:"50%", background:genreColor(filterG), flexShrink:0 }} />
                  <span style={{ fontFamily:"monospace", fontSize:10, color:genreColor(filterG) }}>{filterG}</span>
                  <button onClick={()=>setFilterG("")} style={{ background:"transparent", border:"none", color:C.dimmer, fontFamily:"monospace", fontSize:10, cursor:"pointer", marginLeft:2 }}>✕ clear</button>
                </div>
              )}
            </div>
          )}

          {/* Filters */}
          {isMobile ? (
            <div style={{ borderBottom:`1px solid ${C.border2}` }}>
              {/* Search */}
              <div style={{ padding:"10px 12px 6px" }}>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search title, author, or series…"
                  style={{ width:"100%", background:C.vdark, border:`1px solid ${C.border}`, borderRadius:6, color:C.text, fontFamily:"'EB Garamond',serif", fontSize:15, padding:"8px 13px", outline:"none", boxSizing:"border-box" }} />
              </div>
              {/* Sort chips */}
              <div style={{ display:"flex", gap:6, overflowX:"auto", padding:"4px 12px", scrollbarWidth:"none" }}>
                {SORTS.map(s => (
                  <button key={s.value} onClick={()=>setSortBy(s.value)}
                    style={{ flexShrink:0, background:sortBy===s.value?C.accent+"22":"transparent", border:`1px solid ${sortBy===s.value?C.accent:C.border}`, borderRadius:20, color:sortBy===s.value?C.accent:C.dim, fontFamily:"monospace", fontSize:10, padding:"4px 11px", cursor:"pointer", whiteSpace:"nowrap" }}>
                    {s.label}
                  </button>
                ))}
              </div>
              {/* Genre chips — only active genres */}
              <div style={{ display:"flex", gap:6, overflowX:"auto", padding:"4px 12px", scrollbarWidth:"none" }}>
                <button onClick={()=>setFilterG("")}
                  style={{ flexShrink:0, background:!filterG?C.accent+"22":"transparent", border:`1px solid ${!filterG?C.accent:C.border}`, borderRadius:20, color:!filterG?C.accent:C.dim, fontFamily:"monospace", fontSize:10, padding:"4px 11px", cursor:"pointer" }}>
                  All
                </button>
                {activeGenres.map(g => (
                  <button key={g} onClick={()=>setFilterG(filterG===g?"":g)}
                    style={{ flexShrink:0, background:filterG===g?genreColor(g)+"33":"transparent", border:`1px solid ${filterG===g?genreColor(g):C.border}`, borderRadius:20, color:filterG===g?genreColor(g):C.dim, fontFamily:"monospace", fontSize:10, padding:"4px 11px", cursor:"pointer", whiteSpace:"nowrap" }}>
                    {g}
                  </button>
                ))}
              </div>
              {/* Status chips */}
              <div style={{ display:"flex", gap:6, overflowX:"auto", padding:"4px 12px 10px", scrollbarWidth:"none" }}>
                {[["","All"],["reading","📖 Reading"],["finished","✅ Finished"],["want_to_read","📚 Want to Read"],["dnf","💀 DNF"]].map(([val,label]) => (
                  <button key={val} onClick={()=>setStatusFilter(val)}
                    style={{ flexShrink:0, background:statusFilter===val?C.accent+"22":"transparent", border:`1px solid ${statusFilter===val?C.accent:C.border}`, borderRadius:20, color:statusFilter===val?C.accent:C.dim, fontFamily:"monospace", fontSize:10, padding:"4px 11px", cursor:"pointer", whiteSpace:"nowrap" }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
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
          )}

          {/* Add form */}
          {/* Add form — single unified form, works on mobile and desktop */}
          {showForm && (
            <div style={{ background:C.bg2, borderBottom:`1px solid ${C.border}`, padding: isMobile ? "16px 12px" : "20px 24px" }}>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:17, marginBottom:14, color:C.accent, fontStyle:"italic" }}>Add a Book to the Club</div>

              {/* ── Open Library search ── */}
              <div ref={searchWrapRef} style={{ marginBottom:18, position:"relative" }}>
                <label style={{ display:"block", fontFamily:"monospace", fontSize:11, color:C.accent2, marginBottom:4 }}>🔍 SEARCH TO PRE-FILL</label>
                <div style={{ position:"relative" }}>
                  <input
                    ref={searchInputRef}
                    value={bookQuery}
                    onChange={e => handleBookQueryChange(e.target.value)}
                    onFocus={() => searchResults.length > 0 && setShowResults(true)}
                    placeholder="Type a title or author to look up details…"
                    style={{ ...INP, paddingRight: searchLoading ? 36 : 11 }}
                  />
                  {searchLoading && (
                    <span style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", color:C.dimmer, fontSize:12, fontFamily:"monospace" }}>…</span>
                  )}
                </div>
                {searchError && (
                  <div style={{ fontFamily:"monospace", fontSize:11, color:"#c04040", marginTop:4 }}>⚠ {searchError}</div>
                )}
                {showResults && <SearchDropdown results={searchResults} anchorEl={searchInputRef.current} onPick={pickSearchResult} C={C} />}
              </div>

              {/* Manual fields */}
              <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill,minmax(200px,1fr))", gap:12, marginBottom:14 }}>
                <div style={{ gridColumn: isMobile ? "auto" : "span 2" }}>
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
                <button onClick={closeForm} style={{ background:"transparent", border:`1px solid ${C.border}`, borderRadius:3, color:C.dim, fontFamily:"monospace", fontSize:12, padding:"8px 14px", cursor:"pointer" }}>Cancel</button>
              </div>
            </div>
          )}

          {/* Book grid */}
          <div style={{ padding: isMobile ? "12px" : "20px 24px" }} ref={gridRef}>
            {loading ? (
              <div style={{ textAlign:"center", color:C.dimmer, fontStyle:"italic", padding:80 }}>Loading the library…</div>
            ) : filtered.length===0 ? (
              <div style={{ textAlign:"center", padding:80 }}>
                <div style={{ fontSize:44, marginBottom:10 }}>🔥</div>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:20, color:C.dimmer }}>{books.length===0?"The library is empty":"No books match"}</div>
                {books.length===0 && <div style={{ fontStyle:"italic", color:C.dimmer, marginTop:8 }}>Add your first spicy read</div>}
              </div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(auto-fill,minmax(200px,1fr))", gap: isMobile ? 10 : 14, alignItems:"stretch" }}>
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
          onReviewSaved={(bookId, fresh) => setReviews(prev => ({ ...prev, [bookId]: fresh }))}
          onProgressSaved={async (saved) => {
            setProgress(prev => {
              const next = prev.filter(p => !(p.book_id === saved.book_id && p.member_id === saved.member_id));
              return [...next, saved];
            });
            try {
              const rn = await api.getReadingNow();
              setReadingNow(rn);
            } catch (e) { console.error(e); }
          }}
        />
      )}

      {showCsvModal && (
        <CsvImportModal
          C={C}
          onClose={() => setShowCsvModal(false)}
          onImported={handleCsvImported}
          existingBooks={books}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)", background:C.card, border:`1px solid ${toast.color}55`, borderRadius:8, padding:"10px 20px", fontFamily:"'EB Garamond',serif", fontSize:15, color:toast.color, boxShadow:"0 4px 20px #00000066", zIndex:300, whiteSpace:"nowrap", animation:"fadein 0.2s ease" }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
