import MaisonVerte from "./components/MaisonVerte";
import { useState } from "react";
import Admin from "./components/Admin";
import GuideValleesAureLouron from "./pages/GuideValleesAureLouron";

function PaymentSuccess() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f3f0e8",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: "28px",
          padding: "40px",
          maxWidth: "700px",
          width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.12)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: "90px",
            height: "90px",
            borderRadius: "999px",
            background: "#16a34a",
            margin: "0 auto 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: "42px",
            fontWeight: "bold",
          }}
        >
          ✓
        </div>

        <h1
          style={{
            marginBottom: "18px",
            color: "#14532d",
            fontSize: "clamp(28px, 4vw, 42px)",
          }}
        >
          Paiement reçu ✅
        </h1>

        <p
          style={{
            fontSize: "18px",
            lineHeight: 1.7,
            color: "#334155",
          }}
        >
          Votre paiement a bien été enregistré.
        </p>

        <p
          style={{
            fontSize: "18px",
            lineHeight: 1.7,
            color: "#334155",
          }}
        >
          Un email de confirmation vient de vous être envoyé.
        </p>

        <p
          style={{
            fontSize: "16px",
            lineHeight: 1.7,
            color: "#64748b",
            marginTop: "20px",
          }}
        >
          Pensez à vérifier vos courriers indésirables / spams
          si vous ne recevez pas notre email rapidement.
        </p>

        <div
          style={{
            marginTop: "30px",
            padding: "20px",
            borderRadius: "18px",
            background: "#f8fafc",
            textAlign: "left",
          }}
        >
          <h3 style={{ marginTop: 0 }}>
            Suite de votre réservation
          </h3>

          <ul
            style={{
              lineHeight: 1.8,
              color: "#334155",
              paddingLeft: "20px",
            }}
          >
            <li>Votre paiement a été pris en compte.</li>
            <li>Un email de confirmation vient de vous être envoyé.</li>
            <li>Merci de nous communiquer votre heure d’arrivée estimée si ce n’est pas déjà fait.</li>
          </ul>
        </div>

        <a
          href="/"
          style={{
            marginTop: "30px",
            display: "inline-block",
            background: "#2f4f35",
            color: "white",
            padding: "14px 24px",
            borderRadius: "999px",
            textDecoration: "none",
            fontWeight: "bold",
          }}
        >
          Retour au site
        </a>
      </div>
    </main>
  );
}

function PaymentCancel() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f3f0e8",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: "28px",
          padding: "40px",
          maxWidth: "650px",
          width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.12)",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            marginBottom: "20px",
            color: "#b91c1c",
          }}
        >
          Paiement annulé
        </h1>

        <p
          style={{
            fontSize: "18px",
            lineHeight: 1.7,
            color: "#334155",
          }}
        >
          Aucun paiement n’a été effectué.
        </p>

        <p
          style={{
            fontSize: "16px",
            lineHeight: 1.7,
            color: "#64748b",
          }}
        >
          Vous pouvez reprendre votre réservation plus tard
          si les dates sont toujours disponibles.
        </p>

        <a
          href="/"
          style={{
            marginTop: "30px",
            display: "inline-block",
            background: "#2f4f35",
            color: "white",
            padding: "14px 24px",
            borderRadius: "999px",
            textDecoration: "none",
            fontWeight: "bold",
          }}
        >
          Retour au site
        </a>
      </div>
    </main>
  );
}

function ArrivalTimePage() {
  const params = new URLSearchParams(window.location.search);
  const bookingId = params.get("booking") || "";
  const [arrivalTime, setArrivalTime] = useState("");
  const [status, setStatus] = useState("");

  async function submitArrivalTime(event) {
    event.preventDefault();

    if (!bookingId || !arrivalTime) {
      setStatus("Merci de renseigner votre heure d’arrivée.");
      return;
    }

    try {
      const response = await fetch("/.netlify/functions/update-arrival-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, arrivalTime }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      setStatus("Merci, votre heure d’arrivée a bien été transmise ✅");
    } catch (error) {
      setStatus("Une erreur est survenue. Vous pouvez aussi nous contacter directement par téléphone ou email.");
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f3f0e8", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", fontFamily: "Inter, sans-serif" }}>
      <form onSubmit={submitArrivalTime} style={{ background: "white", borderRadius: "28px", padding: "40px", maxWidth: "640px", width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.12)", textAlign: "center" }}>
        <h1 style={{ color: "#14532d", marginTop: 0 }}>Heure d’arrivée</h1>
        <p style={{ color: "#334155", lineHeight: 1.7 }}>Merci de nous indiquer votre heure d’arrivée estimée afin d’organiser votre accueil à La Maison Verte.</p>
        <input type="text" value={arrivalTime} onChange={(event) => setArrivalTime(event.target.value)} placeholder="Exemple : 17h30" style={{ width: "100%", padding: "16px", borderRadius: "16px", border: "1px solid #d1d5db", fontSize: "16px", marginTop: "18px" }} />
        <button type="submit" style={{ marginTop: "22px", border: "none", background: "#2f4f35", color: "white", padding: "14px 24px", borderRadius: "999px", fontWeight: "bold", cursor: "pointer" }}>Envoyer</button>
        {status && <p style={{ marginTop: "22px", color: status.includes("✅") ? "#166534" : "#b91c1c" }}>{status}</p>}
        <a href="/" style={{ marginTop: "24px", display: "inline-block", color: "#2f4f35" }}>Retour au site</a>
      </form>
    </main>
  );
}

export default function App() {
  const path = window.location.pathname;

  if (path === "/admin") {
    return <Admin />;
  }

  if (path === "/success") {
    return <PaymentSuccess />;
  }

  if (path === "/cancel") {
    return <PaymentCancel />;
  }

  if (path === "/arrival") {
    return <ArrivalTimePage />;
  }
  if (path === "/guide-vallees-aure-louron") {
    return <GuideValleesAureLouron />;
  }

  return <MaisonVerte />;
}