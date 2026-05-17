import MaisonVerte from "./components/MaisonVerte";
import Admin from "./components/Admin";

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
          Votre acompte a bien été enregistré.
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
            <li>Votre réservation est maintenant enregistrée.</li>
            <li>Le solde sera demandé environ 30 jours avant votre arrivée.</li>
            <li>
              Merci de nous communiquer votre heure d’arrivée estimée.
            </li>
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

  return <MaisonVerte />;
}