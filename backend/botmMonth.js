// Book-of-the-Month months are stored as text like "October 2026".
// Turns one into a sortable number (year*12 + month); -1 if it can't be read.
const MONTHS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
function monthValue(text) {
  const m = /^([A-Za-z]+)\s+(\d{4})$/.exec(String(text || "").trim());
  if (!m) return -1;
  const idx = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
  return idx < 0 ? -1 : Number(m[2]) * 12 + idx;
}
module.exports = { monthValue };
