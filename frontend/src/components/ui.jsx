import { useState, useRef } from "react";
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

export const MAX_GENRES = 8;

export const GENRES = [
  "Academic", "Action", "Adventure", "African American Fiction", "Age Gap", "Alien Romance",
  "Alpha Hero", "Alternate History", "Amnesia", "Ancient Egypt", "Angel Romance", "Anthology",
  "Anthropology", "Architecture", "Arranged Marriage", "Art", "Art History", "Artist Romance",
  "Asexual Romance", "Assassin Romance", "Astronomy", "Athlete Romance", "Baseball Romance",
  "BDSM", "Beach Read", "Best Friend's Brother", "Beta Hero", "Bi / Pan Romance", "Biker Romance",
  "Billionaire Romance", "Biography", "Biology", "Biopunk", "Blood Play", "Boarding School",
  "Bodyguard Romance", "Bondage", "BookTok Favorite", "Bratva Romance", "Breeding Kink",
  "Bully Romance", "Business", "Captive Romance", "Cartel Romance", "Celebrity Romance",
  "Chef Romance", "Chick Lit", "Childhood Sweethearts", "Children's", "Christian Fiction",
  "Christmas", "Cinnamon Roll Hero", "Classics", "Clean Romance", "Cli-Fi", "College Romance",
  "Comics", "Coming of Age", "Consensual Non-Con", "Contemporary", "Contemporary Fantasy",
  "Contemporary Romance", "Cookbook", "Cosmic Horror", "Cowboy Romance", "Cozy Fantasy",
  "Cozy Mystery", "Cozy Romance", "Cozy Sci-Fi", "Crafts", "Crime", "Cuckolding / Hotwife",
  "Cultivation", "Cyberpunk", "Daddy Dom", "Dark Academia", "Dark Comedy", "Dark Erotica",
  "Dark Fantasy", "Dark Romance", "Death Romance", "Degradation", "Demon Romance", "Design",
  "Detective", "Diary / Journal", "Doctor Romance", "Domestic Thriller", "Dragon Romance", "Drama",
  "Dubcon", "Dungeons & Dragons", "Dystopian", "Economics", "Education",
  "Enemies to Friends to Lovers", "Enemies to Lovers", "Environment", "Epic Fantasy", "Epistolary",
  "Erotic Thriller", "Erotica", "Espionage", "Essays", "Exhibitionism", "F/F Romance",
  "F1 / Racing Romance", "Fae Romance", "Fairy Tale Retelling", "Fake Dating", "Fake Engagement",
  "Family Saga", "Fanfiction Origin", "Fantasy", "Fantasy Erotica", "Fashion", "Fast Burn",
  "Fated Mates", "Femdom", "Feminism", "Fiction", "Firefighter Romance", "First Love", "Fitness",
  "Folk Horror", "Folklore", "Food & Drink", "Football Romance", "Forbidden Love",
  "Forbidden Student Teacher", "Forced Proximity", "Found Family", "Free Use", "Friends to Lovers",
  "Friends with Benefits", "Gaming", "Gardening", "Gargoyle Romance", "Gaslamp Fantasy",
  "Gender Studies", "Ghost Romance", "Gods & Goddesses Romance", "Gothic", "Gothic Romance",
  "Graphic Novel", "Greek Mythology", "Grimdark", "Grumpy Sunshine", "Hard Sci-Fi",
  "Haunted House", "He Falls First", "Health & Wellness", "Heist", "Hidden Identity",
  "High Fantasy", "Highlander Romance", "Hip Hop", "Historical Fiction", "Historical Mystery",
  "Historical Romance", "History", "Hockey Romance", "Holiday Romance", "Home & Garden", "Horror",
  "Horror Comedy", "Humanities", "Humor / Comedy", "Hurt Comfort", "Impact Play",
  "Incubus / Succubus", "Inspirational", "Instalove", "Interracial Romance", "Isekai",
  "Jewish Fiction", "Knife Play", "Knotting", "Law", "Legal Thriller", "LGBTQ+", "Light Academia",
  "Literary Fiction", "LitRPG", "Locked Room", "Love Triangle", "Low Fantasy", "M/M Romance",
  "Mafia Romance", "Magical Realism", "Maledom", "Manga", "Marriage of Convenience", "Mathematics",
  "Mating Heat", "Medical Thriller", "Medieval Romance", "Memoir", "Menage", "Mental Health",
  "Mermaid Romance", "Middle Grade", "Military History", "Military Romance", "Military Sci-Fi",
  "Mistaken Identity", "MMA / Fighter Romance", "Monster Romance", "Morally Grey", "Music",
  "Mutual Pining", "Mystery", "Mythic Fantasy", "Mythology", "Nature", "Neighbors to Lovers",
  "New Adult", "Noir", "Nonbinary Romance", "Nonfiction", "Norse Mythology", "Novella",
  "Obsessive Hero", "Occult", "Office Romance", "Older Woman Younger Man", "Omegaverse",
  "One Night Stand", "Only One Bed", "Opposites Attract", "Orgasm Control", "Paranormal",
  "Paranormal Erotica", "Paranormal Mystery", "Paranormal Romance", "Parenting", "Pet Play",
  "Philosophy", "Photography", "Physics", "Picture Book", "Pirate Romance", "Poetry",
  "Police Procedural", "Political Thriller", "Politics", "Polyamory", "Pop Culture",
  "Portal Fantasy", "Possessive Hero", "Post-Apocalyptic", "Power Exchange", "Praise Kink",
  "Pregnancy Romance", "Prey / Predator", "Productivity", "Professor Romance",
  "Progression Fantasy", "Protective Hero", "Psychological Horror", "Psychological Thriller",
  "Psychology", "Public Play", "Queer Romance", "Redemption Arc", "Reference", "Regency Romance",
  "Religion", "Reverse Harem", "Rivals to Lovers", "Road Trip Romance", "Rockstar Romance",
  "Romance", "Romantasy", "Romantic Comedy", "Romantic Suspense", "Roommates", "Royal Romance",
  "Runaway Bride", "Sapphic Romance", "Satire", "Sci-Fi", "Sci-Fi Erotica", "Science",
  "Science Fiction Romance", "Second Chance", "Secret Baby", "Secret Identity", "Self Help",
  "Shifter Romance", "Short Stories", "Single Dad", "Siren Romance", "Size Difference", "Slasher",
  "Slice of Life", "Slow Burn", "Small Town", "Smut", "Southern Gothic", "Southern Romance",
  "Space Opera", "Spanking", "Spicy Contemporary", "Spirituality", "Sports Romance", "Spy Romance",
  "Stalker Romance", "Steampunk", "Steamy Fantasy", "Steamy Thriller", "Step Romance", "Superhero",
  "Supernatural", "Suspense", "Swingers", "Sword & Sorcery", "Taboo", "Tattoo Artist Romance",
  "Technology", "Tentacle Erotica", "Theatre", "Thriller", "Time Travel", "Touch Her and Die",
  "Touch Starved", "Toxic Relationship", "Trans Romance", "Travel", "True Crime", "Urban Fantasy",
  "Vampire Romance", "Victorian Romance", "Viking Romance", "Villain Romance", "Voyeurism", "War",
  "Werewolf Romance", "Western", "Western Romance", "Whodunit", "Why Choose", "Widow Romance",
  "Witch Romance", "Women's Fiction", "Wuxia", "Xianxia", "Young Adult", "Zombie", "Other",
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
// Genres without an explicit colour above get a stable, muted colour derived from their name
function hashColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hue = h % 360, s = 0.38, l = 0.52;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + hue / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
export const genreColor = (g) => GENRE_COLORS[g] || hashColor(g || "");

export function GenrePicker({ value, onChange }) {
  const { C } = useTheme();
  const [q, setQ] = useState("");
  const toggle = (g) => {
    if (value.includes(g)) onChange(value.filter(x => x !== g));
    else if (value.length < MAX_GENRES) onChange([...value, g]);
  };
  const visible = q.trim()
    ? GENRES.filter(g => g.toLowerCase().includes(q.toLowerCase()))
    : GENRES;
  return (
    <div>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search genres…"
        style={{ width:"100%", background:C.bg, border:`1px solid ${C.border}`, borderRadius:6, color:C.text, fontFamily:"monospace", fontSize:12, padding:"6px 10px", outline:"none", marginBottom:8, boxSizing:"border-box" }} />
      <div style={{ display:"flex", flexWrap:"wrap", gap:5, maxHeight:180, overflowY:"auto" }}>
        {visible.map(g => {
          const sel  = value.includes(g);
          const full = !sel && value.length >= MAX_GENRES;
          return (
            <button key={g} onClick={() => toggle(g)} disabled={full}
              style={{ background:sel?genreColor(g)+"33":"transparent", border:`1px solid ${sel?genreColor(g):C.border}`, borderRadius:20, color:sel?genreColor(g):full?C.dimmer:C.dim, fontFamily:"monospace", fontSize:11, padding:"3px 10px", cursor:full?"not-allowed":"pointer", transition:"all 0.15s" }}>
              {g}
            </button>
          );
        })}
        {visible.length === 0 && <span style={{ fontFamily:"monospace", fontSize:11, color:C.dimmer }}>No genres match</span>}
      </div>
      {value.length > 0 && (
        <div style={{ marginTop:6, fontFamily:"monospace", fontSize:11, color:C.dimmer }}>{value.length}/{MAX_GENRES} selected: {value.join(", ")}</div>
      )}
    </div>
  );
}

// ── Trigger Warnings ──────────────────────────────────────────────────────────
export const TW_TAGS = [
  "Abandonment", "Ableism", "Abortion", "Abuse", "Addiction", "Adoption / Foster Care",
  "Animal Death", "Animal Harm", "Antisemitism", "Anxiety / Panic Attacks", "Attempted Suicide",
  "Bipolar Disorder", "Blood", "Blood Play", "Body Horror", "Body Shaming", "Bullying", "Cancer",
  "Cannibalism", "Captivity", "Car Accident", "Character Death", "Cheating / Infidelity",
  "Child Abuse", "Child Neglect", "Childbirth", "Choking / Breath Play", "Chronic Illness",
  "Classism", "Claustrophobia", "Cliffhanger", "Coercive Control", "Colonization",
  "Conversion Therapy", "Cult / Religious Extremism", "Cyberbullying", "Dark Themes",
  "Death of a Child", "Death of a Parent", "Death of a Pet", "Death of a Sibling",
  "Death of a Spouse", "Death of Loved One", "Degradation", "Depression", "Disability",
  "Dissociation", "Domestic Violence", "Drowning", "Drug Use", "Drugging", "Dubious Consent",
  "Eating Disorder", "Elder Abuse", "Emotional Abuse", "Explicit Sexual Content", "Fatphobia",
  "Fire / Burning", "Forced Marriage", "Forced Pregnancy", "Gaslighting", "Genocide", "Gore",
  "Grief", "Grooming", "Gun Violence", "Hate Crime", "Homelessness", "Homophobia / Transphobia",
  "Hospitalization", "Hostage Situation", "Human Trafficking", "Humiliation",
  "Immigration / Deportation", "Incarceration", "Incest", "Infertility", "Insects / Spiders",
  "Kidnapping", "Kidnapping of a Child", "Knife Play", "Major Character Death", "Manipulation",
  "Mass Shooting", "Medical Trauma", "Mental Illness", "Miscarriage", "Misogyny", "Murder",
  "Natural Disaster", "Needles / Medical Procedures", "No HEA / Unhappy Ending", "Non-Con", "OCD",
  "Open Ending", "Overdose", "Parental Abuse", "Parental Neglect", "Physical Abuse", "Plane Crash",
  "Police Brutality", "Postpartum Depression", "Poverty", "Pregnancy Loss",
  "Psychosis / Schizophrenia", "Public Humiliation", "Racial Slurs", "Racism / Racial Violence",
  "Rape", "Religious Trauma", "Revenge", "SA", "School Shooting", "Self Harm", "Sexism",
  "Sexual Coercion", "Sexual Harassment", "Sexual Violence", "Slavery", "Stalking", "Stillbirth",
  "Substance Abuse / Alcoholism", "Suicidal Ideation", "Suicide", "Terminal Illness", "Terrorism",
  "Torture", "Toxic Relationship", "Trauma / PTSD", "Underage Sex", "Verbal Abuse", "Violence",
  "Vomit", "War / Combat", "War Crimes", "Xenophobia",
];

export function TwPicker({ value, onChange }) {
  const { C } = useTheme();
  const [q, setQ] = useState("");
  const toggle = (t) => {
    if (value.includes(t)) onChange(value.filter(x => x !== t));
    else onChange([...value, t]);
  };
  const visible = q.trim()
    ? TW_TAGS.filter(t => t.toLowerCase().includes(q.toLowerCase()))
    : TW_TAGS;
  return (
    <div>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search trigger warnings…"
        style={{ width:"100%", background:C.bg, border:`1px solid #c0404055`, borderRadius:6, color:C.text, fontFamily:"monospace", fontSize:12, padding:"6px 10px", outline:"none", marginBottom:8, boxSizing:"border-box" }} />
      <div style={{ display:"flex", flexWrap:"wrap", gap:5, maxHeight:150, overflowY:"auto" }}>
        {visible.map(t => {
          const sel = value.includes(t);
          return (
            <button key={t} onClick={() => toggle(t)}
              style={{ background:sel?"#c0404033":"transparent", border:`1px solid ${sel?"#c04040":C.border}`, borderRadius:20, color:sel?"#e06060":C.dim, fontFamily:"monospace", fontSize:11, padding:"3px 10px", cursor:"pointer", transition:"all 0.15s" }}>
              {t}
            </button>
          );
        })}
        {visible.length === 0 && <span style={{ fontFamily:"monospace", fontSize:11, color:C.dimmer }}>No warnings match</span>}
      </div>
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


// ── DateField ─────────────────────────────────────────────────────────────────
// Native date input that reliably opens the calendar on tap/click (mobile AND
// desktop). Desktop browsers normally only open the picker from the tiny
// indicator icon, so we call showPicker() on click/focus. Font size is 16px so
// iOS doesn't zoom, and a 📅 icon makes it obvious it is a calendar.
export function DateField({ value, onChange, style, C, max }) {
  const ref = useRef(null);
  const open = () => {
    const el = ref.current;
    if (!el) return;
    try { el.showPicker?.(); } catch { /* already open / not allowed — native behaviour takes over */ }
  };
  return (
    <div style={{ position:"relative", width:"100%" }}>
      <input
        ref={ref}
        type="date"
        value={value || ""}
        max={max}
        onChange={e => onChange(e.target.value)}
        onClick={open}
        onFocus={open}
        style={{
          width:"100%", minHeight:42, fontSize:16, colorScheme:"dark",
          background:C.bg, border:`1px solid ${C.border}`, borderRadius:3, color:C.text,
          fontFamily:"'EB Garamond',serif", padding:"7px 38px 7px 11px",
          outline:"none", boxSizing:"border-box", cursor:"pointer",
          WebkitAppearance:"none", appearance:"none", ...style,
        }}
      />
      <span onClick={open} style={{ position:"absolute", right:11, top:"50%", transform:"translateY(-50%)", pointerEvents:"none", fontSize:16 }}>📅</span>
    </div>
  );
}
