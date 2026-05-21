// All available themes
export const THEMES = {
  "dark-purple": {
    label: "Dark Purple",
    bg:      "#0d0a14", bg2:     "#130d1f",
    card:    "#1a1228", card2:   "#221838",
    border:  "#2e2448", border2: "#1e1a30",
    accent:  "#b08af0", accent2: "#7a54c8",
    text:    "#e8daf8", muted:   "#8a78a8",
    dim:     "#5a4a78", dimmer:  "#3a2e58",
    vdark:   "#1e1a2e",
  },
  "midnight": {
    label: "Midnight",
    bg:      "#080810", bg2:     "#0e0e1a",
    card:    "#12121e", card2:   "#18182a",
    border:  "#252535", border2: "#1a1a28",
    accent:  "#7878ff", accent2: "#5050cc",
    text:    "#d8d8f8", muted:   "#7878a8",
    dim:     "#4a4a78", dimmer:  "#2a2a58",
    vdark:   "#0c0c18",
  },
  "rose-gold": {
    label: "Rose Gold",
    bg:      "#120a0a", bg2:     "#1e0e0e",
    card:    "#221212", card2:   "#2a1818",
    border:  "#3e2020", border2: "#2a1818",
    accent:  "#e8905a", accent2: "#c06040",
    text:    "#f5ddd5", muted:   "#a07878",
    dim:     "#704848", dimmer:  "#4a2828",
    vdark:   "#180e0e",
  },
  "forest": {
    label: "Dark Forest",
    bg:      "#060e0a", bg2:     "#0a1410",
    card:    "#0e1a12", card2:   "#12201a",
    border:  "#1e3028", border2: "#162018",
    accent:  "#60c880", accent2: "#409060",
    text:    "#d5f0e0", muted:   "#6a9878",
    dim:     "#3a6848", dimmer:  "#244030",
    vdark:   "#0a140e",
  },
  "ocean": {
    label: "Deep Ocean",
    bg:      "#060a12", bg2:     "#0a101e",
    card:    "#0e1622", card2:   "#121c2a",
    border:  "#1a2840", border2: "#141e30",
    accent:  "#48a8e8", accent2: "#2878b8",
    text:    "#d0e8f5", muted:   "#6090b0",
    dim:     "#3a6080", dimmer:  "#244050",
    vdark:   "#0a1018",
  },
  "blood": {
    label: "Blood Moon",
    bg:      "#0e0808", bg2:     "#160c0c",
    card:    "#1a1010", card2:   "#221414",
    border:  "#3a1818", border2: "#281010",
    accent:  "#e83030", accent2: "#a82020",
    text:    "#f5d8d8", muted:   "#a07070",
    dim:     "#703030", dimmer:  "#4a1818",
    vdark:   "#120c0c",
  },
};

export function getTheme(name) {
  return THEMES[name] || THEMES["dark-purple"];
}
