import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../App";
import { api } from "../api";

export default function LoginSuccess() {
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    // Token is in URL query param: /login-success?token=xxx
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    // Clear the token from the URL immediately
    window.history.replaceState(null, "", window.location.pathname);

    if (!token) { navigate("/"); return; }

    // Store token then fetch user profile
    localStorage.setItem("dbc_token", token);
    api.getMe()
      .then(user => { login(token, user); navigate("/"); })
      .catch(() => { localStorage.removeItem("dbc_token"); navigate("/"); });
  }, []);

  return (
    <div style={{ minHeight:"100vh", background:"#0d0a14", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <span style={{ fontFamily:"'Playfair Display',serif", fontSize:20, color:"#b08af0", fontStyle:"italic" }}>
        Entering the library…
      </span>
    </div>
  );
}
