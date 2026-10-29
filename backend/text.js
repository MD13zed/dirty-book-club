// Text helpers for anything that goes into Discord messages or SQL LIKE patterns.

// Member names and book titles are typed by users. Without this, a display name like
// "**[click](https://evil.example)**" would render as bold text with a live link in
// our Discord embeds. Backslash-escapes Discord's markdown characters so the text
// shows exactly as typed.
function md(text) {
  return String(text ?? "").replace(/([\\*_~`|>\[\]])/g, "\\$1");
}

// For ILIKE / LIKE: make %, _ and \ in what someone typed match literally instead of acting as wildcards.
function likeEscape(text) {
  return String(text ?? "").replace(/[\\%_]/g, "\\$&");
}

module.exports = { md, likeEscape };
