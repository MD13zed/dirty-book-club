import { useState } from "react";
import { useTheme } from "../App";

const RATINGS = [1,2,3,4,5];

export function StarRating({ value, onChange, size = 20 }) {
  const { C } = useTheme();
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display:"flex", gap:2 }}>
      {RATINGS.map(s => (
        <span key={s}
          onClick={() => onChange?.(value === s ? 0 : s)}
          onMouseEnter={() => onChange && setHover(s)}
          onMouseLeave={() => onChange && setHover(0)}
          style={{ fontSize:size, cursor:onChange?"pointer":"default", color:s<=(hover||value)?C.accent:"#2e2448", transition:"color 0.15s", userSelect:"none" }}>
          ★
        </span>
      ))}
    </div>
  );
}

export function Avatar({ name, src, size = 28 }) {
  const { C } = useTheme();
  const color = (() => {
    let h = 0;
    for (const c of (name||"?")) h = (h*31 + c.charCodeAt(0)) & 0xffff;
    return `hsl(${(h%120)+250},55%,65%)`;
  })();

  if (src) return <img src={src} alt={name} style={{ width:size, height:size, borderRadius:"50%", objectFit:"cover", flexShrink:0 }} />;
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", background:color, display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*0.42, fontWeight:700, color:"#0d0a14", flexShrink:0, fontFamily:"monospace" }}>
      {(name||"?")[0].toUpperCase()}
    </div>
  );
}

const GENRES = [
  "Dark Romance","Smut","Romantasy","Enemies to Lovers","Forbidden Love",
  "Reverse Harem","Steamy Thriller","Monster Romance","Paranormal Romance",
  "Fantasy","Fiction","Mystery","Horror","Thriller","Sci-Fi",
  "Historical Fiction","Contemporary","Poetry","Other"
];
const GENRE_COLORS = {
  "Dark Romance":"#c06090","Smut":"#d060a0","Romantasy":"#a060d0","Enemies to Lovers":"#b04070",
  "Forbidden Love":"#9040a0","Reverse Harem":"#7050c0","Steamy Thriller":"#c07040",
  "Monster Romance":"#6040b0","Paranormal Romance":"#8050c0",Fantasy:"#9070d0",
  Fiction:"#6090a0",Mystery:"#a05070",Horror:"#904040",Thriller:"#a07040","Sci-Fi":"#5080c0",
  "Historical Fiction":"#9080a0",Contemporary:"#60a080",Poetry:"#b060b0",Other:"#706090"
};
export const genreColor = (g) => GENRE_COLORS[g] || "#706090";
export { GENRES };

export function GenrePicker({ value, onChange }) {
  const { C } = useTheme();
  const toggle = (g) => {
    if (value.includes(g)) onChange(value.filter(x => x !== g));
    else if (value.length < 3) onChange([...value, g]);
  };
  return (
    <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
      {GENRES.map(g => {
        const sel  = value.includes(g);
        const full = !sel && value.length >= 3;
        return (
          <button key={g} onClick={() => toggle(g)} disabled={full}
            style={{ background:sel?genreColor(g)+"33":"transparent", border:`1px solid ${sel?genreColor(g):C.border}`, borderRadius:20, color:sel?genreColor(g):full?C.dimmer:C.dim, fontFamily:"monospace", fontSize:11, padding:"3px 10px", cursor:full?"not-allowed":"pointer", transition:"all 0.15s" }}>
            {g}
          </button>
        );
      })}
      {value.length > 0 && <span style={{ fontFamily:"monospace", fontSize:11, color:C.dimmer, alignSelf:"center" }}>{value.length}/3</span>}
    </div>
  );
}

export function ProgressBar({ current, total, color }) {
  const pct = total ? Math.min(100, Math.round((current/total)*100)) : 0;
  return (
    <div style={{ height:4, background:"#ffffff18", borderRadius:2, overflow:"hidden", marginTop:4 }}>
      <div style={{ height:"100%", width:`${pct}%`, background: color || "#b08af0", borderRadius:2, transition:"width 0.3s" }} />
    </div>
  );
}

export const STATUS_LABELS = {
  want_to_read: "📚 Want to read",
  reading:      "📖 Reading",
  finished:     "✅ Finished",
  dnf:          "💀 DNF",
};
export const STATUS_COLORS = {
  want_to_read: "#5a4a78",
  reading:      "#7a54c8",
  finished:     "#409060",
  dnf:          "#904040",
};
