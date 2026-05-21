import { useTheme } from "../App";
import { StarRating, Avatar, genreColor, ProgressBar, STATUS_COLORS } from "./ui";

export default function BookCard({ book, reviews = [], myProgress, currentUser, onClick }) {
  const { C } = useTheme();
  const avg     = reviews.filter(r=>r.rating>0).reduce((s,r,_,a) => s+r.rating/a.length, 0);
  const myReview= reviews.find(r => r.member_id === currentUser?.id);
  const genres  = book.genres || [];

  return (
    <div onClick={() => onClick(book)}
      style={{ background:`linear-gradient(160deg,${C.card} 60%,${C.card2})`, border:`1px solid ${C.border}`, borderRadius:4, padding:"0 0 14px", cursor:"pointer", position:"relative", display:"flex", flexDirection:"column", transition:"transform 0.18s,box-shadow 0.18s", boxShadow:"0 2px 14px #00000055", overflow:"hidden" }}
      onMouseEnter={e => { e.currentTarget.style.transform="translateY(-3px)"; e.currentTarget.style.boxShadow="0 8px 30px #000a"; }}
      onMouseLeave={e => { e.currentTarget.style.transform=""; e.currentTarget.style.boxShadow="0 2px 14px #00000055"; }}
    >
      {/* Cover image or colored accent */}
      {book.cover_url
        ? <img src={book.cover_url} alt={book.title} style={{ width:"100%", height:180, objectFit:"cover", display:"block" }} />
        : <div style={{ width:"100%", height:8, background:genres.length?genreColor(genres[0]):C.dim }} />
      }

      <div style={{ padding:"14px 16px 0", display:"flex", flexDirection:"column", gap:6, flex:1 }}>
        {/* Title + author */}
        <div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:15, color:C.text, fontWeight:700, lineHeight:1.3 }}>{book.title}</div>
          {book.author && <div style={{ fontFamily:"'EB Garamond',serif", fontSize:13, color:C.muted, fontStyle:"italic" }}>{book.author}</div>}
          {book.series && <div style={{ fontFamily:"monospace", fontSize:11, color:C.accent2, marginTop:2 }}>📚 {book.series}</div>}
        </div>

        {/* Genres */}
        {genres.length > 0 && (
          <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
            {genres.map(g => (
              <span key={g} style={{ fontFamily:"monospace", fontSize:10, color:genreColor(g), background:C.bg, padding:"1px 6px", borderRadius:20, border:`1px solid ${genreColor(g)}55` }}>{g}</span>
            ))}
          </div>
        )}

        {/* Rating */}
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <StarRating value={Math.round(avg)} size={13} />
          {reviews.length > 0 && <span style={{ fontFamily:"monospace", fontSize:11, color:C.dimmer }}>{avg.toFixed(1)} ({reviews.length})</span>}
        </div>

        {/* Member avatars */}
        {reviews.length > 0 && (
          <div style={{ display:"flex", gap:3, alignItems:"center", flexWrap:"wrap" }}>
            {reviews.slice(0,6).map(r => (
              <div key={r.member_id} title={r.member_name}>
                <Avatar name={r.member_name} src={r.member_avatar} size={20} />
              </div>
            ))}
            {!myReview && <span style={{ fontFamily:"monospace", fontSize:10, color:C.dimmer }}>not reviewed</span>}
          </div>
        )}

        {/* Reading progress */}
        {myProgress && myProgress.status !== "want_to_read" && (
          <div>
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
