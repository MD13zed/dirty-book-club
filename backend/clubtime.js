// The club lives in Aruba. "Today", "this month" and "last year" are worked out
// in that timezone instead of the server's (UTC on Vercel), so an evening finish
// on Dec 31 still counts for that year. Override with CLUB_TIMEZONE if needed.
const CLUB_TIMEZONE = process.env.CLUB_TIMEZONE || "America/Aruba";

function ymd(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CLUB_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date); // YYYY-MM-DD
}

module.exports = {
  CLUB_TIMEZONE,
  clubToday:      () => ymd(),
  clubYear:       () => Number(ymd().slice(0, 4)),
  clubMonthStart: () => ymd().slice(0, 7) + "-01",
};
