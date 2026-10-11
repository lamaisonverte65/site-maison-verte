import { useEffect, useState } from "react";

const pageStyle = { minHeight: "100vh", background: "#f3f0e8", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", fontFamily: "Inter, sans-serif" };
const cardStyle = { background: "white", borderRadius: "28px", padding: "36px", maxWidth: "720px", width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.12)" };

export default function ReviewValidation() {
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [review, setReview] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch(`/.netlify/functions/guest-review-validation?token=${encodeURIComponent(token)}`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Lien invalide.");
        if (active) setReview(data.review);
      } catch (err) {
        if (active) setError(err.message || "Lien invalide.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [token]);

  async function decide(action) {
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/.netlify/functions/guest-review-validation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (data.review) setReview(data.review);
        throw new Error(data.error || "Action impossible.");
      }
      setReview(data.review);
      setMessage(action === "publish" ? "Avis publié sur le site." : "Avis refusé.");
    } catch (err) {
      setMessage(err.message || "Action impossible.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <p style={{ color: "#1f6f3d", fontWeight: 700, marginTop: 0 }}>La Maison Verte — Avis client</p>
        <h1 style={{ color: "#14532d" }}>Validation de l’avis</h1>
        {loading && <p>Chargement de l’avis…</p>}
        {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
        {review && (
          <>
            <p><strong>{review.displayName}</strong>{review.stayPeriod ? ` · ${review.stayPeriod}` : ""}</p>
            <p style={{ color: "#d97706", fontSize: "1.35rem" }}>{"★".repeat(Number(review.rating || 0))} <span style={{ color: "#374151", fontSize: "1rem" }}>{review.rating}/5</span></p>
            <div style={{ background: "#f8fafc", borderRadius: "18px", padding: "20px", whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{review.comment}</div>
            <p style={{ color: "#64748b" }}>Statut : <strong>{review.status}</strong></p>
            {review.status === "pending" ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "24px" }}>
                <button disabled={submitting} onClick={() => decide("publish")} style={{ border: 0, background: "#1f6f3d", color: "white", padding: "12px 20px", borderRadius: "999px", fontWeight: 700, cursor: submitting ? "wait" : "pointer" }}>Publier</button>
                <button disabled={submitting} onClick={() => decide("refuse")} style={{ border: "1px solid #b91c1c", background: "white", color: "#b91c1c", padding: "12px 20px", borderRadius: "999px", fontWeight: 700, cursor: submitting ? "wait" : "pointer" }}>Refuser</button>
                <a href="/admin" style={{ color: "#14532d", padding: "12px 8px", fontWeight: 700 }}>Ouvrir dans l’admin</a>
              </div>
            ) : (
              <p style={{ marginTop: "24px" }}>Cet avis a déjà été traité. <a href="/admin" style={{ color: "#14532d", fontWeight: 700 }}>Ouvrir dans l’admin</a></p>
            )}
            {message && <p style={{ marginTop: "20px", color: message.includes("publié") ? "#166534" : "#7f1d1d", fontWeight: 700 }}>{message}</p>}
          </>
        )}
      </section>
    </main>
  );
}
