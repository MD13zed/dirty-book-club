const BASE_URL = import.meta.env.VITE_API_URL;
const BASE = BASE_URL + "/api";

function token() { return localStorage.getItem("dbc_token") || ""; }

function headers(extra = {}) {
  return {
    "Content-Type": "application/json",
    ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
    ...extra,
  };
}

async function req(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: headers(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (res.status === 401) { localStorage.removeItem("dbc_token"); window.location.href = "/"; return; }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function reqAuth(method, path) {
  const res = await fetch(BASE_URL + path, {
    method,
    headers: headers(),
  });
  if (res.status === 401) { localStorage.removeItem("dbc_token"); window.location.href = "/"; return; }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  // Auth
  getMe: () => reqAuth("GET", "/auth/me"),

  // Books
  getBooks:   ()          => req("GET",    "/books"),
  getBook:    (id)        => req("GET",    `/books/${id}`),
  addBook:    (book)      => req("POST",   "/books", book),
  updateBook: (id, data)  => req("PATCH",  `/books/${id}`, data),
  deleteBook: (id)        => req("DELETE", `/books/${id}`),

  // Reviews
  getReviews:  (bookId)   => req("GET",    `/reviews${bookId ? `?bookId=${bookId}` : ""}`),
  saveReview:  (data)     => req("POST",   "/reviews", data),
  deleteReview:(bookId)   => req("DELETE", `/reviews/${bookId}`),

  // Progress
  getProgress: (bookId)   => req("GET",    `/progress${bookId ? `?bookId=${bookId}` : ""}`),
  saveProgress:(data)     => req("POST",   "/progress", data),

  // Members
  getMembers:  ()         => req("GET",    "/members"),
  getMember:   (id)       => req("GET",    `/members/${id}`),
  updateMe:    (data)     => req("PATCH",  "/members/me", data),

  // Reading now
  getReadingNow: () => req("GET", "/reading-now"),

  // Nominations
  getNominations:     ()    => req("GET",    "/nominations"),
  nominate:           (bid) => req("POST",   "/nominations", { book_id: bid }),
  voteNomination:     (id)  => req("POST",   `/nominations/${id}/vote`),
  unvoteNomination:   (id)  => req("DELETE", `/nominations/${id}/vote`),
  deleteNomination:   (id)  => req("DELETE", `/nominations/${id}`),

  // Admin
  getAdminStats:     ()           => req("GET",    "/admin/stats"),
  getAdminMembers:   ()           => req("GET",    "/admin/members"),
  toggleAdmin:       (id, v)      => req("PATCH",  `/admin/members/${id}/admin`, { is_admin: v }),
  adminDeleteMember: (id)         => req("DELETE", `/admin/members/${id}`),
  adminDeleteBook:   (id)         => req("DELETE", `/admin/books/${id}`),
  setBookOfTheMonth: (book_id, month, announce = true) => req("POST", "/admin/botm", { book_id, month, announce }),
  postTbrPoll:       (book_ids, duration_hours) => req("POST", "/admin/tbr-poll", { book_ids, duration_hours }),

  // Book search (proxied through our backend so clients never hit Open Library directly)
  searchBooks: async (q, signal) => {
    const res = await fetch(`${BASE_URL}/api/booksearch?q=${encodeURIComponent(q)}`, { headers: headers(), signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  // Upload
  uploadCover: async (file) => {
    const fd = new FormData();
    fd.append("cover", file);
    const res = await fetch(`${BASE_URL}/api/uploads/cover`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token()}` },
      body: fd,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },
};

// Rewrites cover URLs from hosts that are unreachable on some networks
// (Open Library) or http/mixed-content (Google Books thumbnails) to go through
// our own cover proxy. Cloudinary / uploaded / other URLs pass through as-is.
export const coverSrc = (url) => {
  if (!url) return "";
  if (/openlibrary\.org|books\.google\.|googleusercontent\.com/.test(url)) {
    return `${BASE_URL}/api/booksearch/cover?u=${encodeURIComponent(url)}`;
  }
  return url;
};
