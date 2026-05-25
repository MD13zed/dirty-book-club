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
  "Action","Adventure","Age Gap","Alien Romance","Alternate History",
  "Angel Romance","Anthology","Arranged Marriage","Athlete Romance",
  "BDSM","Beach Read","Best Friend's Brother","Billionaire Romance",
  "Biography","Bodyguard Romance","Bondage","Breeding Kink","Bully Romance",
  "Celebrity Romance","Chick Lit","Childhood Sweethearts","Coming of Age",
  "Consensual Non-Con","Contemporary","Cowboy Romance","Cozy Fantasy","Cozy Mystery","Crime","Cyberpunk",
  "Daddy Dom","Dark Erotica","Dark Fantasy","Dark Romance","Demon Romance",
  "Doctor Romance","Dragon Romance","Dubcon","Dystopian",
  "Enemies to Lovers","Epic Fantasy","Erotica","Essays","Exhibitionism",
  "F/F Romance","Fae Romance","Fairy Tale Retelling","Family Saga",
  "Fantasy","Fantasy Erotica","Fiction","Forbidden Love",
  "Forbidden Student Teacher","Forced Proximity","Found Family","Free Use",
  "Friends to Lovers",
  "Ghost Romance","Gothic","Graphic Novel","Grumpy Sunshine",
  "High Fantasy","Historical Fiction","Holiday Romance","Horror",
  "Humor / Comedy","Hurt Comfort",
  "Instalove","Isekai",
  "Literary Fiction",
  "M/M Romance","Mafia Romance","Magical Realism","Marriage of Convenience",
  "Memoir","Menage","Mermaid Romance","Military Romance","Monster Romance",
  "Mystery","Mythology",
  "New Adult","Nonfiction","Novella",
  "Obsessive Hero","Office Romance","Omegaverse","Other",
  "Paranormal Erotica","Paranormal Romance","Pet Play","Poetry","Polyamory",
  "Possessive Hero","Post-Apocalyptic","Power Exchange","Praise Kink",
  "Prey / Predator","Psychological Thriller",
  "Queer Romance",
  "Reverse Harem","Rockstar Romance","Romance","Romantasy","Royal Romance",
  "Sapphic Romance","Satire","Sci-Fi","Sci-Fi Erotica","Second Chance",
  "Secret Baby","Self Help","Shifter Romance","Short Stories","Single Dad",
  "Size Difference","Slice of Life","Slow Burn","Small Town","Smut",
  "Space Opera","Spicy Contemporary","Sports Romance","Stalker Romance",
  "Steampunk","Steamy Fantasy","Steamy Thriller","Step Romance","Suspense",
  "Taboo","Thriller","Time Travel","True Crime",
  "Urban Fantasy",
  "Vampire Romance","Voyeurism",
  "Werewolf Romance","Why Choose","Witch Romance","Women's Fiction",
  "Young Adult",
];

const GENRE_COLORS = {
  "Action":"#a06040","Adventure":"#5090a0","Age Gap":"#c05080",
  "Alien Romance":"#4060c0","Alternate History":"#806050",
  "Angel Romance":"#9090d0","Anthology":"#708090",
  "Arranged Marriage":"#906080","Athlete Romance":"#5090c0",
  "BDSM":"#600020","Beach Read":"#40a0c0","Best Friend's Brother":"#a04080",
  "Billionaire Romance":"#a08040","Biography":"#808090",
  "Bodyguard Romance":"#705080","Bondage":"#602050",
  "Breeding Kink":"#c03080","Bully Romance":"#a03050",
  "Celebrity Romance":"#d07050","Chick Lit":"#e080a0",
  "Childhood Sweethearts":"#d080a0","Coming of Age":"#80b080",
  "Consensual Non-Con":"#700030","Contemporary":"#60a080",
  "Cozy Fantasy":"#70b090","Cozy Mystery":"#60b090",
  "Cowboy Romance":"#a07050","Crime":"#804050","Cyberpunk":"#40c0a0",
  "Daddy Dom":"#c04090","Dark Erotica":"#500020",
  "Dark Fantasy":"#504060","Dark Romance":"#c06090",
  "Demon Romance":"#800060","Doctor Romance":"#5080a0",
  "Dragon Romance":"#a04030","Dubcon":"#900040","Dystopian":"#806070",
  "Enemies to Lovers":"#b04070","Epic Fantasy":"#8060d0",
  "Erotica":"#e050a0","Essays":"#909070","Exhibitionism":"#b06080",
  "F/F Romance":"#e070a0","Fae Romance":"#6050d0",
  "Fairy Tale Retelling":"#a070d0","Family Saga":"#808060",
  "Fantasy":"#9070d0","Fantasy Erotica":"#8040b0","Fiction":"#6090a0",
  "Forbidden Love":"#9040a0","Forbidden Student Teacher":"#800050",
  "Forced Proximity":"#9050a0","Found Family":"#70a060",
  "Free Use":"#d04090","Friends to Lovers":"#80a060",
  "Ghost Romance":"#8090a0","Gothic":"#605070",
  "Graphic Novel":"#7080b0","Grumpy Sunshine":"#e08040",
  "High Fantasy":"#9070e0","Historical Fiction":"#9080a0",
  "Holiday Romance":"#c04060","Horror":"#904040",
  "Humor / Comedy":"#d0a040","Hurt Comfort":"#9060a0",
  "Instalove":"#e06080","Isekai":"#6060d0",
  "Literary Fiction":"#708090",
  "M/M Romance":"#4090c0","Magical Realism":"#70a090",
  "Mafia Romance":"#b03060","Marriage of Convenience":"#b07080",
  "Memoir":"#908080","Menage":"#a050b0","Mermaid Romance":"#4090b0",
  "Military Romance":"#607080","Monster Romance":"#6040b0",
  "Mystery":"#a05070","Mythology":"#9060a0",
  "New Adult":"#9080c0","Nonfiction":"#707080","Novella":"#908090",
  "Obsessive Hero":"#900050","Office Romance":"#6080a0",
  "Omegaverse":"#7040d0","Other":"#706090",
  "Paranormal Erotica":"#7030a0","Paranormal Romance":"#8050c0",
  "Pet Play":"#c050a0","Poetry":"#b060b0","Polyamory":"#d080b0",
  "Post-Apocalyptic":"#907060","Possessive Hero":"#a03050",
  "Power Exchange":"#703060","Praise Kink":"#e090b0",
  "Prey / Predator":"#804040","Psychological Thriller":"#906050",
  "Queer Romance":"#c060c0",
  "Reverse Harem":"#7050c0","Rockstar Romance":"#c06050",
  "Romance":"#e06090","Romantasy":"#a060d0","Royal Romance":"#806090",
  "Sapphic Romance":"#d060b0","Satire":"#a0a060","Sci-Fi":"#5080c0",
  "Sci-Fi Erotica":"#5040c0","Second Chance":"#8060b0",
  "Secret Baby":"#d06070","Self Help":"#70a0a0",
  "Shifter Romance":"#806040","Short Stories":"#a090b0",
  "Single Dad":"#6070a0","Size Difference":"#7050b0",
  "Slice of Life":"#60a070","Slow Burn":"#c08050","Small Town":"#70a070",
  "Smut":"#d060a0","Space Opera":"#4050c0","Spicy Contemporary":"#d05060",
  "Sports Romance":"#5090b0","Stalker Romance":"#800040",
  "Steamy Fantasy":"#b050d0","Steamy Thriller":"#c07040",
  "Steampunk":"#a07030","Step Romance":"#b03070","Suspense":"#a06050",
  "Taboo":"#800030","Thriller":"#a07040","Time Travel":"#5070b0",
  "True Crime":"#904060",
  "Urban Fantasy":"#7060a0",
  "Vampire Romance":"#900040","Voyeurism":"#905090",
  "Werewolf Romance":"#705030","Why Choose":"#a040c0",
  "Witch Romance":"#705090","Women's Fiction":"#c07090",
  "Young Adult":"#80c090",
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
  "Abuse","Addiction","Animal Harm",
  "Cheating / Infidelity","Child Abuse","Cliffhanger",
  "Dark Themes","Death of a Child","Death of Loved One","Domestic Violence",
  "Dubious Consent",
  "Eating Disorder",
  "Forced Pregnancy",
  "Gaslighting","Gore","Grief",
  "Homophobia / Transphobia","Human Trafficking",
  "Kidnapping",
  "Manipulation","Medical Trauma","Mental Illness",
  "Non-Con",
  "Open Ending",
  "Pregnancy Loss",
  "Racism / Racial Violence","Religious Trauma",
  "SA","Self Harm","Stalking","Suicide",
  "Terminal Illness","Torture","Trauma / PTSD",
  "Violence","War / Combat",
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
