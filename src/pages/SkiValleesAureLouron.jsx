import { Helmet } from "react-helmet";
import PublicNavigation from "../components/PublicNavigation";
import { languageForPublicPage, localizePublicHref } from "../../shared/publicSiteLocale.js";

const SKI_COPY = {
  en: {
    title: "Ski and snowboard lessons in Peyragudes – Aure and Louron valleys | La Maison Verte",
    seo: "Personalised ski and snowboard lessons in Peyragudes with a qualified instructor. Combine your lessons with a stay at La Maison Verte in Arreau.",
    og: "Ski lessons – Aure and Louron valleys",
    valleys: "Aure & Louron valleys",
    hero: "Ski & snowboard lessons",
    instructor: "Qualified ski instructor",
    custom: "Personalised lessons in Peyragudes",
    lessonText: "In winter, enjoy personalised ski and snowboard lessons in Peyragudes with a qualified instructor.",
    package: "Accommodation + ski lessons",
    packageText: "Combine your lessons with a stay at La Maison Verte in Arreau, at the meeting point of the Aure and Louron valleys.",
    discount: "Special rate: up to 15% off accommodation when booking a stay with ski lessons.",
    contact: "Contact us",
    accommodation: "View the accommodation",
  },
  es: {
    title: "Clases de esquí y snowboard en Peyragudes – Valles de Aure y Louron | La Maison Verte",
    seo: "Clases personalizadas de esquí y snowboard en Peyragudes con un monitor titulado. Combina las clases con una estancia en La Maison Verte, en Arreau.",
    og: "Clases de esquí – Valles de Aure y Louron",
    valleys: "Valles de Aure y Louron",
    hero: "Clases de esquí y snowboard",
    instructor: "Monitor de esquí titulado",
    custom: "Clases personalizadas en Peyragudes",
    lessonText: "En invierno, disfruta de clases personalizadas de esquí y snowboard en Peyragudes con un monitor titulado.",
    package: "Alojamiento + clases de esquí",
    packageText: "Combina las clases con una estancia en La Maison Verte, en Arreau, en la confluencia de los valles de Aure y Louron.",
    discount: "Tarifa especial: hasta un 15 % de descuento en el alojamiento al reservar estancia y clases de esquí.",
    contact: "Contáctanos",
    accommodation: "Ver el alojamiento",
  },
};

export default function SkiValleesAureLouron() {
  const language = typeof window === "undefined" ? "fr" : languageForPublicPage(window.location.href);
  const copy = SKI_COPY[language];
  const pageUrl = `https://lamaisonverte65.fr${localizePublicHref("/ski-vallees-aure-louron", language)}`;
  return (
    <>
      <Helmet htmlAttributes={{ lang: language }}>
        <title>{copy?.title || "Cours de ski à Peyragudes – Vallées d’Aure et du Louron | La Maison Verte"}</title>
        <meta
          name="description"
          content={copy?.seo || "Cours de ski et de snowboard personnalisés à Peyragudes avec un moniteur diplômé. Possibilité de combiner les cours avec un séjour à La Maison Verte à Arreau."}
        />
        <link rel="canonical" href={pageUrl} />
        <meta property="og:title" content={copy?.og || "Cours de ski – Vallées d’Aure et du Louron"} />
        <meta
          property="og:description"
          content={copy?.seo || "Cours de ski et snowboard personnalisés à Peyragudes avec un moniteur diplômé, avec possibilité de séjour à La Maison Verte à Arreau."}
        />
        <meta property="og:image" content="https://lamaisonverte65.fr/activite-ski.webp" />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:type" content="website" />
      </Helmet>

      <PublicNavigation solid={false} />

      <main style={{ minHeight: "100vh", background: "#f6f3ee", color: "#1e2b1f" }}>
        <section
          style={{
            minHeight: "68vh",
            display: "flex",
            alignItems: "flex-end",
            padding: "130px 24px 70px",
            boxSizing: "border-box",
            color: "white",
            background:
              "linear-gradient(rgba(8,25,15,0.18), rgba(8,25,15,0.72)), url('/activite-ski.webp') center 42% / cover no-repeat",
          }}
        >
          <div style={{ width: "min(1050px, 100%)", margin: "0 auto" }}>
            <div
              style={{
                textTransform: "uppercase",
                letterSpacing: "3px",
                fontWeight: "800",
                marginBottom: "14px",
                textShadow: "0 3px 14px rgba(0,0,0,0.55)",
              }}
            >
              {copy?.valleys || "Vallées d’Aure & du Louron"}
            </div>
            <h1
              style={{
                margin: 0,
                maxWidth: "850px",
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "clamp(3rem, 8vw, 5.8rem)",
                lineHeight: 0.98,
                textShadow: "0 8px 35px rgba(0,0,0,0.65)",
              }}
            >
              {copy?.hero || "Cours de ski & snowboard"}
            </h1>
          </div>
        </section>

        <section style={{ maxWidth: "1050px", margin: "0 auto", padding: "70px 24px 86px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
              gap: "34px",
              alignItems: "start",
            }}
          >
            <div>
              <div
                style={{
                  display: "inline-block",
                  padding: "8px 14px",
                  borderRadius: "999px",
                  background: "#e3eee5",
                  color: "#1f6f3d",
                  fontWeight: "800",
                  marginBottom: "18px",
                }}
              >
                {copy?.instructor || "Moniteur de ski diplômé"}
              </div>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(2.3rem, 5vw, 3.5rem)", margin: "0 0 20px" }}>
                {copy?.custom || "Des cours personnalisés à Peyragudes"}
              </h2>
              <p style={{ lineHeight: 1.9, color: "#4b5563", fontSize: "1.08rem" }}>
                {copy?.lessonText || "En hiver, profitez de cours de ski et de snowboard personnalisés sur la station de Peyragudes avec un moniteur de ski diplômé."}
              </p>
            </div>

            <div
              style={{
                background: "#1f6f3d",
                color: "white",
                borderRadius: "32px",
                padding: "34px",
                boxShadow: "0 18px 50px rgba(0,0,0,0.13)",
              }}
            >
              <h2 style={{ marginTop: 0, color: "white" }}>{copy?.package || "Séjour + cours de ski"}</h2>
              <p style={{ lineHeight: 1.8, opacity: 0.96 }}>
                {copy?.packageText || "Vous pouvez combiner vos cours avec un séjour à La Maison Verte à Arreau, au carrefour des vallées d’Aure et du Louron."}
              </p>
              <p style={{ lineHeight: 1.8, marginBottom: "26px" }}>
                <strong>{copy?.discount || "Tarif préférentiel : jusqu’à 15% de réduction sur le logement pour une formule séjour + cours de ski."}</strong>
              </p>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <a
                  href={localizePublicHref("/#contact", language)}
                  style={{
                    display: "inline-block",
                    background: "white",
                    color: "#1f6f3d",
                    padding: "13px 20px",
                    borderRadius: "999px",
                    textDecoration: "none",
                    fontWeight: "800",
                  }}
                >
                  {copy?.contact || "Nous contacter"}
                </a>
                <a
                  href={localizePublicHref("/#reservation", language)}
                  style={{
                    display: "inline-block",
                    border: "1px solid rgba(255,255,255,0.72)",
                    color: "white",
                    padding: "13px 20px",
                    borderRadius: "999px",
                    textDecoration: "none",
                    fontWeight: "800",
                  }}
                >
                  {copy?.accommodation || "Voir le logement"}
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
