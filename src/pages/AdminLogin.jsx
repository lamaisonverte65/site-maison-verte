import { useState } from "react";
import { supabase } from "../supabaseClient";

export default function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    onLogin();
  }

  return (
    <div style={styles.wrapper}>
      <form style={styles.form} onSubmit={handleSubmit}>
        <h1 style={styles.title}>Administration</h1>

        <p style={styles.subtitle}>La Maison Verte — Arreau</p>
        <p style={styles.help}>Identifiant = email. Le mot de passe est celui défini par le propriétaire, puis modifiable dans l’onglet Mon compte.</p>

        <input
          style={styles.input}
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <input
          style={styles.input}
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        {error && <p style={styles.error}>{error}</p>}

        <button style={styles.button} type="submit">
          {loading ? "Connexion..." : "Connexion"}
        </button>
      </form>
    </div>
  );
}

const styles = {
  wrapper: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f1f5f9",
    padding: "20px",
  },
  form: {
    width: "100%",
    maxWidth: "420px",
    background: "white",
    borderRadius: "28px",
    padding: "32px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  title: {
    margin: 0,
    fontSize: "32px",
  },
  subtitle: {
    marginTop: 0,
    color: "#64748b",
  },
  input: {
    padding: "14px",
    borderRadius: "14px",
    border: "1px solid #d1d5db",
    fontSize: "15px",
  },
  button: {
    border: "none",
    borderRadius: "14px",
    padding: "14px",
    background: "#2f4f35",
    color: "white",
    fontWeight: 700,
    cursor: "pointer",
  },
  help: {
    margin: "-4px 0 8px",
    color: "#64748b",
    fontSize: "13px",
    lineHeight: 1.45,
  },
  error: {
    color: "#dc2626",
    fontSize: "14px",
  },
};
