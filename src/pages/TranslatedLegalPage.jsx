import { Helmet } from "react-helmet";
import { LEGAL_COPY } from "./legalTranslations.js";

const pageStyle = { minHeight: "100vh", background: "#f6f3ee", padding: "120px 16px 70px" };
const cardStyle = { maxWidth: "920px", margin: "0 auto", background: "white", borderRadius: "30px", padding: "clamp(20px, 5vw, 42px)", boxShadow: "0 14px 40px rgba(0,0,0,0.08)", lineHeight: 1.8, color: "#334155" };
const linkStyle = { color: "#1f6f3d", fontWeight: 700 };
const h2Style = { color: "#2f4f35", marginTop: "28px", marginBottom: "10px" };

function Paragraph({ value }) {
  if (typeof value === "string") return <p>{value}</p>;
  const external = value.href?.endsWith(".pdf") || value.href?.startsWith("https:");
  return <p>{value.before}<a href={value.href} style={linkStyle} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>{value.text}</a>{value.after}</p>;
}

export default function TranslatedLegalPage({ type, language }) {
  const languageCopy = LEGAL_COPY[language];
  const copy = languageCopy?.[type];
  if (!copy) return null;
  const slug = type === "mentions" ? "mentions-legales" : "politique-confidentialite";
  const canonical = `https://lamaisonverte65.fr/${language}/${slug}`;
  return <>
    <Helmet htmlAttributes={{ lang: language }}>
      <title>{copy.title} | La Maison Verte - Arreau</title>
      <meta name="description" content={copy.description} />
      <meta name="robots" content="noindex,follow" />
      <link rel="canonical" href={canonical} />
    </Helmet>
    <main style={pageStyle}>
      <article style={cardStyle}>
        <nav aria-label={language === "en" ? "Legal page navigation" : "Navegación legal"} style={{ display: "flex", gap: "12px 24px", flexWrap: "wrap", marginBottom: "24px" }}>
          <a href={`/${language}/`} style={linkStyle}>← {languageCopy.back}</a>
          <a href={`/${slug}`} style={linkStyle}>{languageCopy.source}</a>
          <a href={`/${language}/${type === "mentions" ? "politique-confidentialite" : "mentions-legales"}`} style={linkStyle}>{type === "mentions" ? languageCopy.privacy.title : languageCopy.mentions.title}</a>
        </nav>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(2.4rem, 5vw, 3.5rem)", color: "#2f4f35", marginBottom: "20px" }}>{copy.title}</h1>
        <p>{copy.intro}</p>
        {copy.sections.map((section, index) => <section key={index}>
          <h2 style={h2Style}>{section.heading}</h2>
          {section.paragraphs?.map((value, i) => <Paragraph key={i} value={value} />)}
          {section.details && <p>{section.details.map(([label, value, href], i) => <span key={i}><strong>{label}:</strong> {href ? <a href={href} style={linkStyle} target={href.startsWith("https:") ? "_blank" : undefined} rel={href.startsWith("https:") ? "noopener noreferrer" : undefined}>{value}</a> : value}<br /></span>)}</p>}
          {section.items && <ul>{section.items.map((item, i) => <li key={i}>{item}</li>)}</ul>}
        </section>)}
        <p style={{ marginTop: "32px", fontSize: "0.9rem", color: "#64748b" }}>{languageCopy.updated}</p>
      </article>
    </main>
  </>;
}
