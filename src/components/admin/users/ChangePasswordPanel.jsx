import { useState } from "react";
import { styles } from "../adminStyles";

export default function ChangePasswordPanel({ onChangePassword }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (password.length < 8) return alert("Le mot de passe doit contenir au moins 8 caractères.");
    if (password !== confirmation) return alert("Les deux mots de passe ne correspondent pas.");

    setLoading(true);
    try {
      await onChangePassword(password);
      setPassword("");
      setConfirmation("");
      alert("Mot de passe modifié.");
    } catch (error) {
      alert("Erreur : " + error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section style={styles.card}>
      <h3 style={styles.subTitle}>Mon compte</h3>
      <p style={styles.muted}>Changer le mot de passe du compte actuellement connecté.</p>
      <form onSubmit={submit} style={{ display: "grid", gap: "10px", maxWidth: "460px" }}>
        <input
          style={styles.input}
          type="password"
          placeholder="Nouveau mot de passe"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <input
          style={styles.input}
          type="password"
          placeholder="Confirmation"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
        <button style={styles.primaryButton} type="submit" disabled={loading}>{loading ? "Modification..." : "Changer mon mot de passe"}</button>
      </form>
    </section>
  );
}
