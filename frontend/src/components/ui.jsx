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

export const GENRES = [
  "Dark Romance","Smut","Romantasy","Enemies to Lovers","Forbidden Love",
  "Reverse Harem","Steamy Thriller","Monster Romance","Paranormal Romance",
  "Mafia Romance","Bully Romance","Age Gap","Second Chance","Small Town",
  "Sports Romance","Rockstar Romance","Billionaire Romance","Office Romance",
  "Forced Proximity","Fake Dating","Friends to Lovers","Slow Burn",
  "Why Choose","Instalove","Spicy Contemporary","Marriage of Convenience",
  "Secret Baby","Bodyguard Romance","Single Dad","Roommate Romance",
  "Holiday Romance","Beach Read","Grumpy Sunshine","Hurt Comfort",
  "Childhood Sweethearts","Best Friend's Brother","Forbidden Student Teacher",
  "Arranged Marriage","Royal Romance","Military Romance","Doctor Romance",
  "Cowboy Romance","Athlete Romance","Celebrity Romance",
  "Erotica","Taboo","Omegaverse","Dubcon","Consensual Non-Con",
  "BDSM","Daddy Dom","Step Romance","Menage","Voyeurism",
  "Exhibitionism","Power Exchange","Bondage","Dark Erotica",
  "Paranormal Erotica","Fantasy Erotica","Sci-Fi Erotica",
  "Vampire Romance","Fae Romance","Shifter Romance","Witch Romance",
  "Dragon Romance","Demon Romance","Angel Romance","Ghost Romance",
  "Werewolf Romance","Mermaid Romance","Steamy Fantasy",
  "Fantasy","Fiction","Mystery","Horror","Thriller","Sci-Fi",
  "Historical Fiction","Contemporary","Poetry","Literary Fiction",
  "Dystopian","Post-Apocalyptic","Urban Fantasy","Epic Fantasy",
  "High Fantasy","Cozy Mystery","Crime","Suspense","Psychological Thriller",
  "Gothic","Magical Realism","Satire","Adventure","Action",
  "Coming of Age","Women's Fiction","Chick Lit","New Adult",
  "Young Adult","Graphic Novel","Short Stories","Memoir","Biography",
  "True Crime","Self Help","Other"
];

const GENRE_COLORS = {
  "Dark Romance":"#c06090","Smut":"#d060a0","Romantasy":"#a060d0",
  "Enemies to Lovers":"#b04070","Forbidden Love":"#9040a0",
  "Reverse Harem":"#7050c0","Steamy Thriller":"#c07040",
  "Monster Romance":"#6040b0","Paranormal Romance":"#8050c0",
  "Mafia Romance":"#b03060","Bully Romance":"#a03050","Age Gap":"#c05080",
  "Second Chance":"#8060b0","Small Town":"#70a070","Sports Romance":"#5090b0",
  "Rockstar Romance":"#c06050","Billionaire Romance":"#a08040",
  "Office Romance":"#6080a0","Forced Proximity":"#9050a0",
  "Fake Dating":"#d07090","Friends to Lovers":"#80a060","Slow Burn":"#c08050",
  "Why Choose":"#a040c0","Instalove":"#e06080","Spicy Contemporary":"#d05060",
  "Marriage of Convenience":"#b07080","Secret Baby":"#d06070",
  "Bodyguard Romance":"#705080","Single Dad":"#6070a0",
  "Roommate Romance":"#80b070","Holiday Romance":"#c04060",
  "Beach Read":"#40a0c0","Grumpy Sunshine":"#e08040","Hurt Comfort":"#9060a0",
  "Childhood Sweethearts":"#d080a0","Best Friend's Brother":"#a04080",
  "Forbidden Student Teacher":"#800050","Arranged Marriage":"#906080",
  "Royal Romance":"#806090","Military Romance":"#607080",
  "Doctor Romance":"#5080a0","Cowboy Romance":"#a07050",
  "Athlete Romance":"#5090c0","Celebrity Romance":"#d07050",
  "Erotica":"#e050a0","Taboo":"#800030","Omegaverse":"#7040d0",
  "Dubcon":"#900040","Consensual Non-Con":"#700030","BDSM":"#600020",
  "Daddy Dom":"#c04090","Step Romance":"#b03070","Menage":"#a050b0",
  "Voyeurism":"#905090","Exhibitionism":"#b06080","Power Exchange":"#703060",
  "Bondage":"#602050","Dark Erotica":"#500020","Paranormal Erotica":"#7030a0",
  "Fantasy Erotica":"#8040b0","Sci-Fi Erotica":"#5040c0",
  "Vampire Romance":"#900040","Fae Romance":"#6050d0",
  "Shifter Romance":"#806040","Witch Romance":"#705090",
  "Dragon Romance":"#a04030","Demon Romance":"#800060",
  "Angel Romance":"#9090d0","Ghost Romance":"#8090a0",
  "Werewolf Romance":"#705030","Mermaid Romance":"#4090b0",
  "Steamy Fantasy":"#b050d0",
  Fantasy:"#9070d0",Fiction:"#6090a0",Mystery:"#a05070",
  Horror:"#904040",Thriller:"#a07040","Sci-Fi":"#5080c0",
  "Historical Fiction":"#9080a0",Contemporary:"#60a080",Poetry:"#b060b0",
  "Literary Fiction":"#708090","Dystopian":"#806070",
  "Post-Apocalyptic":"#907060","Urban Fantasy":"#7060a0",
  "Epic Fantasy":"#8060d0","High Fantasy":"#9070e0","Cozy Mystery":"#60b090",
  Crime:"#804050",Suspense:"#a06050","Psychological Thriller":"#906050",
  Gothic:"#605070","Magical Realism":"#70a090",Satire:"#a0a060",
  Adventure:"#5090a0",Action:"#a06040","Coming of Age":"#80b080",
  "Women's Fiction":"#c07090","Chick Lit":"#e080a0","New Adult":"#9080c0",
  "Young Adult":"#80c090","Graphic Novel":"#7080b0","Short Stories":"#a090b0",
  Memoir:"#908080",Biography:"#808090","True Crime":"#904060",
  "Self Help":"#70a0a0",Other:"#706090"
};
export const genreColor = (g) => GENRE_COLORS[g] || "#706090";

export function GenrePicker({ value, onChange }) {
  const { C } = useTheme();
  const toggle = (g) => {
    if (value.includes(g)) onChange(value.filter(x => x !== g));
    else if (value.length < 5) onChange([...value, g]);
  };
  return (
    <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
      {GENRES.map(g => {
        const sel  = value.includes(g);
        const full = !sel && value.length >= 5;
        return (
          <button key={g} onClick={() => toggle(g)} disabled={full}
            style={{ background:sel?genreColor(g)+"33":"transparent", border:`1px solid ${sel?genreColor(g):C.border}`, borderRadius:20, color:sel?genreColor(g):full?C.dimmer:C.dim, fontFamily:"monospace", fontSize:11, padding:"3px 10px", cursor:full?"not-allowed":"pointer", transition:"all 0.15s" }}>
            {g}
          </button>
        );
      })}
      {value.length > 0 && <span style={{ fontFamily:"monospace", fontSize:11, color:C.dimmer, alignSelf:"center" }}>{value.length}/5</span>}
    </div>
  );
}

// ── Trigger Warnings ──────────────────────────────────────────────────────────
export const TW_TAGS = [
  "Dubious Consent","Non-Con","SA","Dark Themes","Violence","Gore",
  "Abuse","Child Abuse","Animal Harm","Self Harm","Suicide",
  "Eating Disorder","Addiction","Trauma / PTSD","Grief","Death of Loved One",
  "Pregnancy Loss","Cheating / Infidelity","Kidnapping","Stalking",
  "Manipulation","Gaslighting","Torture","Cliffhanger","Open Ending",
];

export function TwPicker({ value, onChange }) {
  const { C } = useTheme();
  const toggle = (t) => {
    if (value.includes(t)) onChange(value.filter(x => x !== t));
    else onChange([...value, t]);
  };
  return (
    <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
      {TW_TAGS.map(t => {
        const sel = value.includes(t);
        return (
          <button key={t} onClick={() => toggle(t)}
            style={{ background:sel?"#c0404033":"transparent", border:`1px solid ${sel?"#c04040":C.border}`, borderRadius:20, color:sel?"#e06060":C.dim, fontFamily:"monospace", fontSize:11, padding:"3px 10px", cursor:"pointer", transition:"all 0.15s" }}>
            {t}
          </button>
        );
      })}
    </div>
  );
}

export function ProgressBar({ current, total, color }) {
  const pct = total ? Math.min(100, Math.round((current/total)*100)) : 0;
  return (
    <div style={{ height:4, background:"#ffffff18", borderRadius:2, overflow:"hidden", marginTop:4 }}>
      <div style={{ height:"100%", width:`${pct}%`, background:color||"#b08af0", borderRadius:2, transition:"width 0.3s" }} />
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
