const BASE = import.meta.env.VITE_API_URL + "/api";

function token() {
  return localStorage.getItem("dbc_token") || "";
}

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
  if (res.status === 401) {
    localStorage.removeItem("dbc_token");
    window.location.href = "/";
    return;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  // Auth
  getMe: () => fetch(`${import.meta.env.VITE_API_URL}/auth/me`, { headers: headers() }).then(r => r.json()),

  // Books
  getBooks: ()           => req("GET",    "/books"),
  getBook:  (id)         => req("GET",    `/books/${id}`),
  addBook:  (book)       => req("POST",   "/books", book),
  updateBook:(id, data)  => req("PATCH",  `/books/${id}`, data),
  deleteBook:(id)        => req("DELETE", `/books/${id}`),

  // Reviews
  getReviews: (bookId)   => req("GET",    `/reviews${bookId ? `?bookId=${bookId}` : ""}`),
  saveReview: (data)     => req("POST",   "/reviews", data),
  deleteReview:(bookId)  => req("DELETE", `/reviews/${bookId}`),

  // Progress
  getProgress: (bookId)  => req("GET",    `/progress${bookId ? `?bookId=${bookId}` : ""}`),
  saveProgress:(data)    => req("POST",   "/progress", data),

  // Members
  getMembers:  ()        => req("GET",    "/members"),
  getMember:   (id)      => req("GET",    `/members/${id}`),
  updateMe:    (data)    => req("PATCH",  "/members/me", data),

  // Admin
  getAdminStats:   ()    => req("GET",    "/admin/stats"),
  getAdminMembers: ()    => req("GET",    "/admin/members"),
  toggleAdmin:(id, v)    => req("PATCH",  `/admin/members/${id}/admin`, { is_admin: v }),
  adminDeleteMember:(id) => req("DELETE", `/admin/members/${id}`),
  adminDeleteBook:(id)   => req("DELETE", `/admin/books/${id}`),

  // Upload
  uploadCover: async (file) => {
    const fd = new FormData();
    fd.append("cover", file);
    const res = await fetch("/api/uploads/cover", {
      method: "POST",
      headers: { Authorization: `Bearer ${token()}` },
      body: fd,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },
};

// Helper to get auth URL
export const discordLoginUrl = () => "/auth/discord";
