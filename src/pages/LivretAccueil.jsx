import { BookletWelcome } from "../components/booklet/BookletWelcome";
import { BookletWelcomeDetails } from "../components/booklet/BookletWelcome";
import { BookletHouseRules } from "../components/booklet/BookletHouseRules";
import { BookletHouseRulesDetails } from "../components/booklet/BookletHouseRules";
import { BookletPractical } from "../components/booklet/BookletPractical";
import { BookletPracticalDetails } from "../components/booklet/BookletPractical";
import { BookletDiscover } from "../components/booklet/BookletDiscover";
import { BookletDiscoverDetails } from "../components/booklet/BookletDiscover";
import { BookletInventory } from "../components/booklet/BookletInventory";
import { BookletInventoryDetails } from "../components/booklet/BookletInventory";
import { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import "../styles/livret.css";
import PublicNavigation from "../components/PublicNavigation";
import { localizeBookletTree, normalizeBookletLanguage } from "../booklet/localizeBooklet";
import { guestLanguageFromUrl } from "../../shared/guestLocale.js";

export default function LivretAccueil() {
  const [keyboxImageError, setKeyboxImageError] = useState(false);
  const [language] = useState(() => {
    // Le rendu serveur (tests SSR et génération HTML) ne possède pas de window.
    if (typeof window === "undefined") return "fr";
    return normalizeBookletLanguage(guestLanguageFromUrl(window.location.href));
  });
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("print") !== "1") return;

    let cancelled = false;
    let fallbackTimer = null;

    const wait = (delay) => new Promise((resolve) => window.setTimeout(resolve, delay));

    const waitForImages = () => {
      const images = Array.from(document.images || []);
      return Promise.all(
        images.map((image) => {
          if (image.complete) return Promise.resolve();

          return new Promise((resolve) => {
            image.addEventListener("load", resolve, { once: true });
            image.addEventListener("error", resolve, { once: true });
          });
        })
      );
    };

    async function launchPrint() {
      try {
        await Promise.race([
          Promise.all([
            document.fonts?.ready || Promise.resolve(),
            waitForImages(),
          ]),
          wait(3500),
        ]);

        await wait(500);

        if (!cancelled) {
          window.focus();
          window.print();
        }
      } catch {
        if (!cancelled) {
          window.focus();
          window.print();
        }
      }
    }

    function schedulePrint() {
      fallbackTimer = window.setTimeout(launchPrint, 300);
    }

    if (document.readyState === "complete") {
      schedulePrint();
    } else {
      window.addEventListener("load", schedulePrint, { once: true });
    }

    return () => {
      cancelled = true;
      if (fallbackTimer) window.clearTimeout(fallbackTimer);
      window.removeEventListener("load", schedulePrint);
    };
  }, []);

  return (
    <>
      <Helmet htmlAttributes={{ lang: language }}>
        <meta name="robots" content="noindex,follow" />
        <title>{language === "en" ? "Welcome booklet" : language === "es" ? "Guía de bienvenida" : "Livret d'accueil"} | La Maison Verte - Arreau</title>
        <meta
          name="description"
          content={language === "en"
            ? "La Maison Verte welcome booklet: arrival, access, key lockbox and practical information for your stay."
            : language === "es"
              ? "Guía de bienvenida de La Maison Verte: llegada, acceso, caja de llaves e información práctica."
              : "Livret d'accueil de La Maison Verte à Arreau : coordonnées, informations utiles, guide des vallées d'Aure et du Louron."}
        />
        <link rel="canonical" href={`https://lamaisonverte65.fr/livret${language === "fr" ? "" : `?lang=${language}`}`} />
        <link rel="alternate" hrefLang="fr" href="https://lamaisonverte65.fr/livret" />
        <link rel="alternate" hrefLang="en" href="https://lamaisonverte65.fr/livret?lang=en" />
        <link rel="alternate" hrefLang="es" href="https://lamaisonverte65.fr/livret?lang=es" />
        <link rel="alternate" hrefLang="x-default" href="https://lamaisonverte65.fr/livret" />
      </Helmet>

      <PublicNavigation solid={false} />

      <main className="livret" data-livret-lang={language}>
        <div className="livret-language-bar no-print">
          <button type="button" onClick={() => window.print()}>
            {language === "en" ? "Print / PDF" : language === "es" ? "Imprimir / PDF" : "Imprimer / PDF"}
          </button>
        </div>
        {/* PAGE 1 — COUVERTURE */}
        <BookletWelcome language={language} />

        {/* PAGE 2 — BIENVENUE */}
        <BookletWelcomeDetails language={language} />

        {/* PAGE 3 — FONCTIONNEMENT DU LOGEMENT */}
        <BookletHouseRules language={language} />

        {/* PAGE 4 — AVANT VOTRE DÉPART */}

        <BookletHouseRulesDetails language={language} />

        {/* PAGE 5 — INFORMATIONS PRATIQUES ET BONNES ADRESSES*/}

        <BookletPractical language={language} />

        {/* PAGE 6 - ACCES & STATIONNEMENT */}
        <BookletPracticalDetails language={language} />


        {/* PAGE 7 — DÉCOUVRIR LES VALLÉES */}
        <BookletDiscover language={language} />

        {/* PAGE 8 — VOTRE AVIS */}

        <BookletDiscoverDetails language={language} />

        {/* PAGE 9 — ARRIVÉE & BOÎTE À CLÉS */}
        {localizeBookletTree(<section
          id="boite-a-cles"
          className="livret-page livret-function-page"
          aria-label="Arrivée et boîte à clés"
        >
          <div className="livret-page-inner livret-function-inner">
            <header className="livret-page-header livret-function-header">
              <h1>Arrivée & boîte à clés</h1>
              <div className="livret-ornament" aria-hidden="true">⟡</div>
            </header>

            <div className="livret-function-layout">
              <article className="livret-function-card" style={{ gridColumn: "1 / -1" }}>
                {!keyboxImageError && (
                <img
                  src="/livret/procedure-boite-a-cles.webp"
                  alt="Procédure d’ouverture et de fermeture de la boîte à clés"
                  loading="eager"
                  onError={() => setKeyboxImageError(true)}
                  style={{
                    display: "block",
                    width: "88%",
                    maxWidth: "768px",
                    minWidth: "280px",
                    height: "auto",
                    margin: "0 auto",
                    borderRadius: "12px",
                  }}
                />
              )}
              </article>

              {keyboxImageError && (
                <>
<article className="livret-function-card">
                <h2>Récupérer les clés</h2>
                <p>
                  Les clés de La Maison Verte sont mises à votre disposition dans une boîte à clés.
                  Le code en vigueur vous est communiqué dans l'email envoyé deux jours avant votre arrivée.
                </p>
                <ol>
                  <li>Ouvrez le cache de protection en plastique sur la façade en tirant le haut du couvercle.</li>
                  <li>Enfoncez le bouton « CLEAR » (C), situé sous le clavier, pour effacer toute saisie précédente.</li>
                  <li>Appuyez sur les boutons correspondant au code qui vous a été communiqué.</li>
                  <li>Enfoncez et maintenez le bouton « OPEN », situé en haut du clavier.</li>
                  <li>Tirez la porte vers vous puis vers le bas pour l’ouvrir complètement et récupérez les clés.</li>
                </ol>
              </article>

              <article className="livret-function-card">
                <h2>Au moment du départ</h2>
                <p>
                  La boîte ne peut pas se refermer sans refaire la procédure :
                </p>
                <ol>
                  <li>Replacez les clés dans la boîte puis enfoncez le bouton « CLEAR » (C).</li>
                  <li>Entrez de nouveau le code qui vous a été communiqué.</li>
                  <li>Enfoncez et maintenez le bouton « OPEN ».</li>
                  <li>Remontez et fermez la porte du compartiment, puis relâchez le bouton.</li>
                  <li>Appuyez de nouveau sur « CLEAR » (C) pour brouiller le code, puis refermez le cache de protection.</li>
                </ol>
                <p>
                  En cas de difficulté, contactez-nous au <strong>06 95 93 83 15</strong>.
                </p>
              </article>
                </>
              )}
            </div>
            <footer className="livret-page-footer">
              <img src="/livret/liseret-separateur.webp" alt="" aria-hidden="true" />
              <div className="livret-page-number">9</div>
            </footer>
          </div>
        </section>, language)}

        {/* PAGE 10 — INVENTAIRE — REZ-DE-CHAUSSÉE */}
        <BookletInventory language={language} />

        {/* PAGE 11 — INVENTAIRE — ÉTAGES */}
        <BookletInventoryDetails language={language} />

      </main>
    </>
  );
}
