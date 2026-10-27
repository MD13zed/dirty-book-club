// Small shared helpers for route handlers.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v) => typeof v === "string" && UUID_RE.test(v);

// router.param("id", uuidParam) → bad ids get a clean 400 instead of a database error
function uuidParam(req, res, next, value) {
  if (!isUuid(value)) return res.status(400).json({ error: "Invalid id" });
  next();
}

// Turn a caught error into a clean response. Known database problems become
// helpful 4xx messages; anything else is logged and returned as a generic 500
// so database/internal details never reach the browser.
const PG_ERRORS = {
  "23503": [404, "Referenced item not found"],
  "23502": [400, "A required value is missing"],
  "23505": [409, "That already exists"],
  "23514": [400, "A value is out of range"],
  "22001": [400, "A value is too long"],
  "22P02": [400, "Invalid value"],
  "22007": [400, "Invalid date"],
  "22008": [400, "Invalid date"],
};
function fail(res, e) {
  const known = PG_ERRORS[e?.code];
  if (known) return res.status(known[0]).json({ error: known[1] });
  console.error(e);
  return res.status(500).json({ error: "Something went wrong — please try again." });
}

module.exports = { isUuid, uuidParam, fail };
