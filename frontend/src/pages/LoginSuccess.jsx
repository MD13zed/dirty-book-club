import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../App";
import { api } from "../api";

export default function LoginSuccess() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState(false);

  useEffect(() => {
    // The token arrives in the URL fragment (#token=…), which never reaches servers or logs.
    // The old ?token=… form is still accepted so a login that started before an update still works.
    const fromHash  = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("token");
    const fromQuery = new URLSearchParams(window.location.search).get("token");
    const token = fromHash || fromQuery;
    window.history.replaceState(null, "", window.location.pathname);   // wipe it from the address bar/history immediately

    if (!token) { navigate("/"); return; }

    localStorage.setItem("dbc_token", token);
    api.getMe()
      .then(user => { login(token, user); navigate("/"); })
      .catch(() => { localStorage.removeItem("dbc_token"); setError(true); });
  }, []);

  if (error) return (
    <div style={{ minHeight:"100vh", background:"#0d0a14", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16 }}>
      <span style={{ fontFamily:"'Playfair Display',serif", fontSize:20, color:"#e05070", fontStyle:"italic" }}>
        Login failed — couldn't verify your account.
      </span>
      <button onClick={() => navigate("/")} style={{ background:"transparent", border:"1px solid #b08af0", borderRadius:4, color:"#b08af0", fontFamily:"monospace", fontSize:13, padding:"8px 20px", cursor:"pointer" }}>
        Back to home
      </button>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#0d0a14", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <span style={{ fontFamily:"'Playfair Display',serif", fontSize:20, color:"#b08af0", fontStyle:"italic" }}>
        Entering the library…
      </span>
    </div>
  );
}
