import { useEffect, useState } from "react";

export default function BoiteACles() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/.netlify/functions/get-keybox-code", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Code indisponible.");
        if (active) setCode(String(data.keyboxCode || ""));
      })
      .catch(() => {
        if (active) setError("Le code n’est momentanément pas disponible. Contactez-nous directement.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  return (
    <main style={{ minHeight: "100vh", background: "#f3f0e8", padding: "28px 18px", fontFamily: "Inter, sans-serif" }}>
      <section style={{ maxWidth: "720px", margin: "0 auto", background: "white", borderRadius: "28px", padding: "34px", boxShadow: "0 20px 60px rgba(0,0,0,0.10)" }}>
        <p style={{ margin: 0, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "12px" }}>La Maison Verte · Arreau</p>
        <h1 style={{ color: "#14532d", marginBottom: "12px" }}>Boîte à clés</h1>
        <p style={{ color: "#334155", lineHeight: 1.7 }}>
          Les clés de La Maison Verte sont mises à votre disposition dans une boîte à clés.
        </p>

        <div style={{ margin: "28px 0", padding: "24px", borderRadius: "20px", background: "#f8fafc", textAlign: "center" }}>
          <div style={{ color: "#64748b", marginBottom: "8px" }}>Code actuel</div>
          {loading ? (
            <strong style={{ fontSize: "24px", color: "#334155" }}>Chargement…</strong>
          ) : error ? (
            <p style={{ color: "#b91c1c", margin: 0 }}>{error}</p>
          ) : code ? (
            <strong style={{ fontSize: "36px", letterSpacing: "0.12em", color: "#14532d" }}>{code}</strong>
          ) : (
            <p style={{ color: "#b91c1c", margin: 0 }}>Code non renseigné. Contactez-nous avant votre arrivée.</p>
          )}
        </div>

        <h2 style={{ color: "#14532d" }}>Utilisation</h2>
        <ol style={{ color: "#334155", lineHeight: 1.9, paddingLeft: "22px" }}>
          <li>Composez le code indiqué ci-dessus sur la boîte à clés.</li>
          <li>Ouvrez la boîte et prenez les clés du logement.</li>
          <li>Refermez correctement la boîte après avoir récupéré les clés.</li>
          <li>À votre départ, replacez les clés dans la boîte et refermez-la correctement.</li>
        </ol>

        <p style={{ color: "#334155", lineHeight: 1.7, marginTop: "26px" }}>
          En cas de difficulté, appelez-nous au <a href="tel:+33795938315" style={{ color: "#14532d", fontWeight: 700 }}>07 95 93 83 15</a>.
        </p>
        <a href="/livret" style={{ display: "inline-block", marginTop: "10px", color: "#14532d", fontWeight: 700 }}>Consulter le livret d’accueil</a>
      </section>
    </main>
  );
}
