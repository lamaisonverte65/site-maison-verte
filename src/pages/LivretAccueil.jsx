import { useEffect } from "react";
import { Helmet } from "react-helmet";
import "../styles/livret.css";

export default function LivretAccueil() {
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
      <Helmet>
        <title>Livret d'accueil | La Maison Verte - Arreau</title>
        <meta
          name="description"
          content="Livret d'accueil de La Maison Verte à Arreau : coordonnées, informations utiles, guide des vallées d'Aure et du Louron."
        />
        <link rel="canonical" href="https://lamaisonverte65.fr/livret" />
      </Helmet>

      <main className="livret">
        {/* PAGE 1 — COUVERTURE */}
        <section className="livret-page livret-cover" aria-label="Couverture du livret d'accueil">
          <div className="livret-cover-photo">
            <div className="livret-cover-title-wrap">
              <h1 className="livret-cover-title">
                <span>Livret</span>
                <span>d'accueil</span>
              </h1>
            </div>
          </div>

          <div className="livret-cover-footer">
            <img
              className="livret-cover-banner"
              src="/livret/banniere-contacts.png"
              alt="La Maison Verte - Email : lamaisonverte65@gmail.com - Adresse : 3 Impasse Trassens, 65240 Arreau"
            />
          </div>
        </section>

        {/* PAGE 2 — BIENVENUE */}
        <section className="livret-page livret-welcome" aria-label="Bienvenue à La Maison Verte">
          <div className="livret-page-inner">
            <header className="livret-page-header">
              <h1>
                Bienvenue
                <br />à La Maison Verte
              </h1>
              <div className="livret-ornament" aria-hidden="true">
                ⟡
              </div>
            </header>

            <div className="livret-welcome-grid">
              <div className="livret-welcome-main">
                <p>
                  Nous sommes heureux de vous accueillir à <strong>La Maison Verte</strong>.
                </p>

                <p>
                  Cette maison a été rénovée avec soin afin de préserver son caractère pyrénéen
                  tout en offrant le confort nécessaire à un agréable séjour.
                </p>

                <p>
                  Nous espérons que vous profiterez pleinement d'Arreau, de ses montagnes,
                  de ses villages et des nombreuses activités proposées dans les vallées
                  d'Aure et du Louron.
                </p>

                <p>Nous vous souhaitons d'excellentes vacances.</p>

                <p className="livret-signature">Raphaël et Emmanuelle</p>

                <div className="livret-separator-line" />

                <section className="livret-summary" aria-labelledby="sommaire-livret">
                  <h2 id="sommaire-livret">Sommaire</h2>

                  <nav className="livret-summary-list" aria-label="Sommaire du livret">
                    <a href="#fonctionnement-logement">
                      <span>Page 3</span>
                      <strong>Fonctionnement du logement</strong>
                    </a>

                    <a href="#depart">
                      <span>Page 4</span>
                      <strong>Avant votre départ</strong>
                    </a>

                    <a href="#informations-pratiques">
                      <span>Page 5</span>
                      <strong>Informations & bonnes adresses</strong>
                    </a>

                    <a href="#decouvrir-vallees">
                      <span>Page 6</span>
                      <strong>Découvrir les vallées</strong>
                    </a>

                    <a href="#votre-avis">
                      <span>Page 7</span>
                      <strong>Votre avis compte</strong>
                    </a>

                    <a href="#inventaire">
                      <span>Page 8</span>
                      <strong>Inventaire complet</strong>
                    </a>
                  </nav>
                </section>
              </div>

              <aside className="livret-welcome-side" aria-label="QR codes utiles">
                <div className="livret-vertical-line" />

                <div className="livret-qr-grid">
                  <div className="livret-qr-block">
                    <a href="https://lamaisonverte65.fr/" target="_blank" rel="noopener noreferrer">
                    <div className="livret-qr-icon">◎</div>
                    <h2>Site officiel</h2>
                    <img src="/livret/qr-site.svg" alt="QR code vers le site officiel La Maison Verte" />
                    </a>
                  </div>

                  <div className="livret-qr-block">
                    <a href="mailto:contact@lamaisonverte65.fr">
                    <div className="livret-qr-icon">✉</div>
                    <h2>Nous écrire</h2>
                    <img src="/livret/qr-email.svg" alt="QR code pour écrire à La Maison Verte" />
                    </a>
                  </div>

                  <div className="livret-qr-block">
                    <a href="tel:+33663076314">
                    <div className="livret-qr-icon">☎</div>
                    <h2>Nous appeler</h2>
                    <img src="/livret/qr-telephone.svg" alt="QR code pour appeler La Maison Verte" />
                    </a>
                  </div>

                  <div className="livret-qr-block">
                    <a href="https://lamaisonverte65.fr/guide-vallees-aure-louron" target="_blank" rel="noopener noreferrer">
                    <div className="livret-qr-icon">▴</div>
                    <h2>Guide des vallées</h2>
                    <img src="/livret/qr-guide.svg" alt="QR code vers le guide des vallées d'Aure et du Louron" />
                    </a>
                  </div>
                </div>
              </aside>
            </div>

            <footer className="livret-page-footer">
              <img src="/livret/liseret-separateur.webp" alt="" aria-hidden="true" />
              <div className="livret-page-number">2</div>
            </footer>
          </div>
        </section>

        {/* PAGE 3 — FONCTIONNEMENT DU LOGEMENT */}
        <section
          id="fonctionnement-logement"
          className="livret-page livret-function-page"
          aria-label="Fonctionnement du logement"
        >
          <div className="livret-page-inner livret-function-inner">
            <header className="livret-page-header livret-function-header">
              <h1>Fonctionnement du logement</h1>
              <div className="livret-ornament" aria-hidden="true">
                ⟡
              </div>
            </header>

            <div className="livret-function-grid">
              <article className="livret-info-card">
                <div className="livret-info-title">
                  <img src="/livret/icone-chauffage.svg" alt="" aria-hidden="true" />
                  <h2>Chauffage</h2>
                </div>

                <p>Le logement est équipé de radiateurs électriques individuels.</p>
                <p>Pour votre confort et afin de limiter la consommation d'énergie :</p>

                <ul>
                  <li>fermez les portes des étages afin de conserver la chaleur au rez-de-chaussée ;</li>
                  <li>adaptez la température à votre présence ;</li>
                  <li>baissez ou coupez les radiateurs lorsque vous quittez la maison ou aérez;</li>
                  <li>vous pouvez utiliser le mode « Boost » du sèche-serviettes en choisissant la durée souhaitée.</li>
                </ul>
              </article>

              <article className="livret-info-card">
                <div className="livret-info-title">
                  <img src="/livret/icone-ventilation.svg" alt="" aria-hidden="true" />
                  <h2>Ventilation</h2>
                </div>

                <p>La maison est équipée d'une extraction d'air dans la douche.</p>
                <p>Utilisez la cordelette située sous la bouche d'extraction pour activer ou arrêter la ventilation selon vos besoins.</p>
                <p>Utilisez la hotte aspirante de la cuisine pour la cuisson.</p>
                <p>Ces ventilations contribuent au confort du logement et à la préservation du bâtiment.</p>
                <p>Pour ouvrir la fenêtre de la chambre sous combles, vous trouverez une poignée sur le meuble de droite. Celle-ci est amovible afin de ne pas gêner le coulissement du store.</p>
              </article>

              <article className="livret-info-card">
                <div className="livret-info-title">
                  <img src="/livret/icone-salle-eau.svg" alt="" aria-hidden="true" />
                  <h2>Salle d'eau</h2>
                </div>

                <p>Le ballon d'eau chaude a une capacité de 200 litres.</p>
                <p>L'eau est principalement chauffée durant la nuit. Une utilisation raisonnée permet de conserver suffisamment d'eau chaude pour l'ensemble des occupants, notamment en soirée.</p>
                <p>En cas de fuite, dysfonctionnement ou anomalie, merci de nous prévenir rapidement.</p>
                <p>La vanne d'eau se trouve derrière le rideau à côté du lave vaisselle au rdc.</p>

              </article>

              <article className="livret-info-card">
                <div className="livret-info-title">
                  <img src="/livret/icone-regles.svg" alt="" aria-hidden="true" />
                  <h2>Règles de la maison</h2>
                </div>

                <p>Pour le confort de tous :</p>

                <ul>
                  <li>logement non-fumeur ;</li>
                  <li>animaux non acceptés ;</li>
                  <li>respect du calme du voisinage ;</li>
                  <li>aucune nuisance sonore après 22 h ;</li>
                  <li>fêtes et rassemblements bruyants non autorisés.</li>
                </ul>

              </article>
            </div>

            <article className="livret-info-card livret-eco-card">
              <div className="livret-info-title">
                <img src="/livret/icone-bon-a-savoir.svg" alt="" aria-hidden="true" />
                <h2>Bon à savoir</h2>
              </div>

              <p>Le tableau électrique se situe à droite de la porte d'entrée.</p>
              <p>La télévision peut être connectée à Internet. Activez le partage de connexion de votre téléphone puis connectez la télévision au réseau Wi-Fi créé.</p>
              <p>Les conteneurs de tri sont situés à l'entrée du parking du Monument aux Morts. En sortant de l'impasse, tournez à droite puis continuez tout droit.</p>
              <p>De l'huile, du sel, du sucre, du café ainsi que quelques condiments sont laissés à votre disposition pour faciliter votre arrivée ou les courts séjours.</p>
              <p>Vous trouverez aussi des tablettes de lave vaisselle sous l'évier</p>
              <p>Dans le placard haut de la buanderie se trouvent de la lessive et adoussissant, des amploules, des rouloeaux de paier toilette en cas de besoin</p>
            </article>

            <footer className="livret-page-footer">
              <img src="/livret/liseret-separateur.webp" alt="" aria-hidden="true" />
              <div className="livret-page-number">3</div>
            </footer>
          </div>
        </section>

        {/* PAGE 4 — AVANT VOTRE DÉPART */}

        <section
          id="depart"
          className="livret-page"
          aria-label="Avant votre départ"
        >
          <div className="livret-page-inner livret-function-inner">

        <header className="livret-page-header livret-function-header">
          <h1>Avant votre départ</h1>
          <div className="livret-ornament" aria-hidden="true">
            ⟡
          </div>
        </header>

        <div className="livret-function-grid">

          <article className="livret-info-card">
            <div className="livret-info-title">
              <img src="/livret/icone-depart.svg" alt="" aria-hidden="true" />
              <h2>Check-list de départ</h2>
            </div>

            <p>Avant de quitter le logement, merci de bien vouloir :</p>

            <ul>
              <li>vider le réfrigérateur ;</li>
              <li>vider le lave-vaisselle ;</li>
              <li>sortir les poubelles ;</li>
              <li>fermer les fenêtres ;</li>
              <li>éteindre toutes les lumières ;</li>
              <li>éteindre tous les radiateurs.</li>
            </ul>
          </article>

          <article className="livret-info-card">
            <div className="livret-info-title">
              <img src="/livret/icone-linge.svg" alt="" aria-hidden="true" />
              <h2>Linge de maison</h2>
            </div>

            <p>Merci de déposer le linge utilisé dans la buanderie :</p>

            <ul>
              <li>draps ;</li>
              <li>housses de couette ;</li>
              <li>taies d'oreiller ;</li>
              <li>tapis de salle de bain ;</li>
              <li>torchons.</li>
            </ul>
          </article>

          <article className="livret-info-card">
            <div className="livret-info-title">
              <img src="/livret/icone-menage.svg" alt="" aria-hidden="true" />
              <h2>Ménage</h2>
            </div>

            <p>
              Aucun forfait ménage n'est inclus dans votre réservation.
            </p>
            <p>
              Nous vous remercions de rendre le logement dans un état
              de propreté similaire à celui dans lequel vous l'avez trouvé
              à votre arrivée.
            </p>
            <p>Vous trouverez tous les éléments sous l'évier et dans la buanderie</p>

            <p>
              Si vous préférez ne pas effectuer le ménage de fin de séjour,
              merci de nous contacter avant votre départ.
            </p>

            <p>
              Selon nos disponibilités, nous pourrons vous proposer
              un forfait ménage de 30 €.
            </p>
          </article>

          <article className="livret-info-card">
            <div className="livret-info-title">
              <img src="/livret/icone-signalement.svg" alt="" aria-hidden="true" />
              <h2>À nous signaler</h2>
            </div>

            <p>
              Avant votre départ, merci de nous signaler toute anomalie
              ou problème constaté pendant le séjour.
            </p>

            <p>
              Cela nous permet d'intervenir rapidement pour les prochains
              voyageurs.
            </p>
          </article>
        </div>
        <br/>
        <article className="livret-info-card livret-eco-card">
          <div className="livret-info-title">
            <img src="/livret/icone-merci.svg" alt="" aria-hidden="true" />
            <h2>Merci</h2>
          </div>

          <p>
            Nous espérons que vous avez passé un agréable séjour
            à Arreau et que le logement a répondu favorablement à vos attentes.
          </p>

          <p>
            Au plaisir de vous accueillir à nouveau dans les Pyrénées.
          </p>
        </article>

        <footer className="livret-page-footer">
          <img
            src="/livret/liseret-separateur.webp"
            alt=""
            aria-hidden="true"
          />
          <div className="livret-page-number">4</div>
        </footer>
        

          </div>
        </section>

        {/* PAGE 5 — INFORMATIONS PRATIQUES ET BONNES ADRESSES*/}

        <section
          id="informations-pratiques"
          className="livret-page"
          aria-label="Informations pratiques"
        >
          <div className="livret-page-inner livret-function-inner">

        <header className="livret-page-header livret-function-header">
          <h1>Informations pratiques</h1>
          <h1>&</h1>
          <h1>Bonnes adresses</h1>
          <div className="livret-ornament" aria-hidden="true">
            ⟡
          </div>
        </header>

        <div className="livret-function-grid">

          <article className="livret-info-card">
            <div className="livret-info-title">
              <img src="/livret/icone-parking.svg" alt="" aria-hidden="true" />
              <h2>Accès & stationnement</h2>
            </div>
            <br />
            <p>
              La Maison Verte se situe dans une impasse piétonne.
            </p>
            <br />
            <p>
              Vous pouvez vous approcher en voiture par la rue de la
              Coutellerie pour charger ou décharger vos bagages.
            </p>
            <p>
              Cette rue est également une impasse et il n'est pas
              possible d'y faire demi-tour.
            </p>
            <br />
            <p>
              Plusieurs parkings gratuits sont disponibles à proximité,
              notamment :
            </p>

            <ul>
              <li>parking du Monument aux Morts ;</li>
              <li>parking de l'église Notre-Dame.</li>
            </ul>
          </article>

          <article className="livret-info-card">
            <div className="livret-info-title">
              <img src="/livret/icone-commerces.svg" alt="" aria-hidden="true" />
              <h2>Commerces</h2>
            </div>
            <br />
            <p>
              Tous ces commerces sont accessibles à pied depuis la maison :
            </p>

            <ul>
              <li>Le Pain en Aure (boulangerie) ;</li>
              <li>Boucherie d'Arreau ;</li>
              <li>Le Vagabond Immobile (librairie) ;</li>
              <li>Gourmandises Montagnardes, bord de Neste (produits locaux) ;</li>
              <li>Carrefour Market (environ 10 minutes à pied) ;</li>
              <li>Le Marché hebdomadaire le jeudi matin.</li>
            </ul>
          </article>

          <article className="livret-info-card">
            <div className="livret-info-title">
              <img src="/livret/icone-restaurant.svg" alt="" aria-hidden="true" />
              <h2>Restaurants</h2>
            </div>
            <br />
            <p>
              À Arreau :
            </p>

            <ul>
              <li>Restaurant l'Arbizon : cuisine traditionnelle, valeur sûre.</li>
              <li>L'Entre-Deux-Nestes : cuisine maison, ambiance chaleureuse.</li>
              <li>Pizzeria Le Florida : pizzas, salades et repas décontractés.</li>
              <li>La Crêpe d'Aure : excellente adresse pour une galette ou une crêpe, très appréciée des familles.</li>
            </ul>
            <br />
            <p>
              Quelques belles tables dans les vallées :
            </p>

            <ul>
              <li>Les Aryelets à Aulon ;</li>
              <li>Erassens à Sailhan ;</li>
              <li>La Grange à Saint-Lary ;</li>
              <li>Ors à Tramezaïgues.</li>
              <li>Jòia (restaurant à desserts) à Saint-Lary ;</li>
              
            </ul>
          </article>

          <article className="livret-info-card">
            <div className="livret-info-title">
              <img src="/livret/icone-urgences.svg" alt="" aria-hidden="true" />
              <h2>Santé & urgences</h2>
            </div>
            <br />
            <p>
              <strong>Pharmacie des Lys</strong><br />
              Grande Rue, Arreau
            </p>
            <br />
            <p>
              <strong>Maison de la Santé</strong><br />
              Avenue de la Gare, Arreau
            </p>
            <br />
            <p>
              <strong>En cas d'urgence :</strong>
            </p>

            <ul>
              <li>Urgences européennes : 112 ;</li>
              <li>SAMU : 15 ;</li>
              <li>Pompiers : 18 ;</li>
              <li>Police / Gendarmerie : 17.</li>
            </ul>
          </article>

        </div>

        <footer className="livret-page-footer">
          <img
            src="/livret/liseret-separateur.webp"
            alt=""
            aria-hidden="true"
          />
          <div className="livret-page-number">5</div>
        </footer>
        

          </div>
        </section>

        {/* PAGE 6 — DÉCOUVRIR LES VALLÉES */}
        <section
          id="decouvrir-vallees"
          className="livret-page livret-discover-page"
          aria-label="Découvrir les vallées d'Aure et du Louron"
        >
          <div className="livret-page-inner livret-function-inner">
            <header className="livret-page-header livret-function-header">
              <h1>Découvrir les vallées</h1>
              <div className="livret-ornament" aria-hidden="true">⟡</div>
            </header>

            <p className="livret-discover-quote">
              « Les plus beaux souvenirs naissent souvent au détour d'un sentier,
              d'un village ou d'une rencontre. »
            </p>
            <br/>
            <div className="livret-discover-grid">
              <article className="livret-info-card">
                <div className="livret-info-title">
                  <h2>Randonnées & nature</h2>
                </div>
                <p>Des centaines de kilomètres de sentiers permettent de découvrir :</p>
                <ul>
                  <li>la Réserve Naturelle du Néouvielle ;</li>
                  <li>les lacs d'altitude ;</li>
                  <li>les villages de montagne ;</li>
                  <li>les panoramas des vallées d'Aure et du Louron ;</li>
                  <li>le Parc national des Pyrénées et le Parc national d'Ordesa et du Mont-Perdu.</li>
                </ul>
              </article>

              <article className="livret-info-card">
                <div className="livret-info-title">
                  <h2>Sports & loisirs</h2>
                </div>
                <p>En toute saison :</p>
                <ul>
                  <li>vélo de route : Aspin, Azet, Peyresourde ;</li>
                  <li>VTT ;</li>
                  <li>parapente ;</li>
                  <li>rafting et canyoning ;</li>
                  <li>pêche ;</li>
                  <li>ski alpin et nordique ;</li>
                  <li>balnéo.</li>
                </ul>
              </article>

              <article className="livret-info-card">
                <div className="livret-info-title">
                  <h2>Patrimoine & villages</h2>
                </div>
                <p>Ne manquez pas :</p>
                <ul>
                  <li>Arreau et ses maisons à colombages ;</li>
                  <li>Aulon ;</li>
                  <li>Saint-Lary-Soulan ;</li>
                  <li>Loudenvielle ;</li>
                  <li>les églises romanes inscrites au patrimoine mondial de l'UNESCO ;</li>
                  <li>les marchés locaux.</li>
                </ul>
              </article>
            </div>
            <br/>
            <article className="livret-info-card livret-guide-card">
              <div>
                <div className="livret-info-title">
                  <h2>Guide complet</h2>
                </div>
                <p>
                  Retrouvez dans notre guide toutes nos idées de sorties : randonnées,
                  lacs d'altitude, cols mythiques, villages, patrimoine, stations de ski,
                  itinéraires vélo, activités familiales et bien d'autres découvertes.
                </p>
                <a
                  href="https://lamaisonverte65.fr/guide-vallees-aure-louron"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  lamaisonverte65.fr/guide-vallees-aure-louron
                </a>
              </div>

              <img
                src="/livret/qr-guide.svg"
                alt="QR code vers le guide des vallées d'Aure et du Louron"
              />
            </article>

            <footer className="livret-page-footer">
              <img src="/livret/liseret-separateur.webp" alt="" aria-hidden="true" />
              <div className="livret-page-number">6</div>
            </footer>
          </div>
        </section>

        {/* PAGE 7 — VOTRE AVIS */}

        <section
          id="votre-avis"
          className="livret-page"
          aria-label="Votre avis compte beaucoup"
        >
          <div className="livret-page-inner livret-function-inner">

            <header className="livret-page-header livret-function-header">
              <h1>Votre avis compte beaucoup</h1>
              <div className="livret-ornament" aria-hidden="true">
                ⟡
              </div>
            </header>

            <p className="livret-discover-quote">
              Merci d'avoir choisi La Maison Verte. Votre confiance nous encourage à offrir le meilleur accueil possible à chacun de nos voyageurs.
            </p>

            <div className="livret-function-grid">

              <article className="livret-info-card">
                <div className="livret-info-title">
                  <h2>Pourquoi votre avis est important ?</h2>
                </div>

                <p>
                  Si vous avez apprécié votre séjour à La Maison Verte,
                  votre avis est l'un des plus beaux encouragements que vous
                  puissiez nous offrir.
                </p>

                <p>
                  Sur les plateformes de réservation, les notes ne sont pas
                  toujours interprétées comme à l'école.
                  Une note de <strong>5/5</strong> ou <strong>10/10</strong>
                  correspond à un séjour conforme ou supérieur aux attentes.
                </p>

                <p>
                  À l'inverse, une note de <strong>4/5</strong> ou
                  <strong>8/10</strong> est souvent interprétée comme un séjour
                  présentant plusieurs points d'amélioration, même si le
                  voyageur s'est déclaré satisfait.
                </p>
              </article>

              <article className="livret-info-card">
                <div className="livret-info-title">
                  <h2>Nous sommes à votre écoute</h2>
                </div>

                <p>
                  Si un détail n'a pas répondu à vos attentes,
                  n'hésitez surtout pas à nous en parler.
                </p>

                <p>
                  Vos remarques nous permettent d'améliorer continuellement
                  le logement et d'offrir la meilleure expérience possible
                  à nos futurs voyageurs.
                </p>

                <p>
                  Merci beaucoup pour votre confiance et au plaisir de vous
                  accueillir à nouveau dans les Pyrénées.
                </p>
              </article>

            </div>

            <div className="livret-review-grid">

              <article className="livret-review-card">

                <img
                  src="/livret/qr-google-avis.svg"
                  alt="QR Code vers les avis Google"
                />

                <h3>Avis Google</h3>
                <br/>
                <p>
                  Partagez votre expérience afin d'aider
                  les futurs voyageurs.
                </p>

                <a
                  href="https://g.page/r/CasA-_8IxkGjEBM/review"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Laisser un avis Google
                </a>

              </article>

              <article className="livret-review-card">

                <img
                  src="/livret/qr-site-avis.svg"
                  alt="QR Code vers les avis du site"
                />

                <h3>Avis Site</h3>
                <br/>
                <p>
                  Votre témoignage sera publié sur
                  le site officiel de La Maison Verte.
                </p>

                <a
                  href="https://lamaisonverte65.fr/?review=1#laisser-un-avis"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Déposer un avis
                </a>

              </article>

            </div>

            <footer className="livret-page-footer">
              <img
                src="/livret/liseret-separateur.webp"
                alt=""
                aria-hidden="true"
              />
              <div className="livret-page-number">
                7
              </div>
            </footer>

          </div>
        </section>

        {/* PAGE 8 — INVENTAIRE — REZ-DE-CHAUSSÉE */}
        <section
          id="inventaire"
          className="livret-page livret-inventory-page"
          aria-label="Inventaire — rez-de-chaussée"
        >
          <div className="livret-page-inner livret-function-inner">
            <header className="livret-page-header livret-function-header">
              <h1>Inventaire : rez-de-chaussée</h1>
              <div className="livret-ornament" aria-hidden="true">⟡</div>
            </header>

            <div className="livret-inventory-rdc-layout">
              <div className="livret-inventory-rdc-left">
<section className="livret-inventory-section">
                  <h2>Entrée</h2>
                  <ul>
                      <li><span>1</span>Meuble à chaussures</li>
                      <li><span>1</span>Paillasson noir</li>
                      <li><span>1</span>Patère Montagne Pyrogravée</li>
                      <li><span>1</span>Porte manteau bois</li>
                  </ul>
                </section>

<section className="livret-inventory-section">
                  <h2>Buanderie</h2>
                  <ul>
                      <li><span>1</span>Lave Linge</li>
                      <li><span>2</span>Aspirateurs (1 sans fils)</li>
                      <li><span>1</span>Balai</li>
                      <li><span>1</span>Balai serpillère</li>
                      <li><span>1</span>Bassine</li>
                      <li><span>1</span>Couvercle micro-ondes</li>
                      <li><span>1</span>Fer à repasser</li>
                      <li><span>1</span>Housse à repasser</li>
                      <li><span>1</span>Plumeau poussière</li>
                      <li><span>1</span>Seau + essoreur</li>
                      
                  </ul>
                </section>
              </div>

              <div className="livret-inventory-rdc-right">
<section className="livret-inventory-section">
                  <h2>Salon</h2>
                  <ul>
                      <li><span>1</span>Bougie</li>
                      <li><span>1</span>Bout de canapé rondin bois</li>
                      <li><span>5</span>Cadres déco bois</li>
                      <li><span>1</span>Canapé + pouf</li>
                      <li><span>4</span>Coussins</li>
                      <li><span>1</span>Étagère métal noir d&#x27;angle</li>
                      <li><span>1</span>Guirlande lumineuse boules</li>
                      <li><span>1</span>Meuble TV</li>
                      <li><span>1</span>Plaid vert</li>
                      <li><span>1</span>Suspension plante plastique</li>
                      <li><span>2</span>Tables basses gigognes</li>
                      <li><span>1</span>Télévision avec télécommande</li>
                  </ul>
                </section>
              </div>

              <div className="livret-inventory-rdc-cuisine">
                <h2 className="livret-inventory-cuisine-title">Cuisine</h2>

                <div className="livret-cuisine-grid">
                <section className="livret-inventory-section">
                  <ul>
                      <li><span>6</span>Assiettes à dessert blanches</li>
                      <li><span>12</span>Assiettes moyennes vert ancien</li>
                      <li><span>1</span>Boîte à pain</li>
                      <li><span>1</span>Bouilloire</li>
                      <li><span>2</span>Brosses plastique</li>
                      <li><span>1</span>Cafetière italienne (petite)</li>
                      <li><span>1</span>Cafetière à filtre</li>             
                      <li><span>1</span>Carafe verre</li>
                      <li><span>2</span>Casseroles</li>
                      <li><span>1</span>Cocotte minute</li>
                      <li><span>1</span>Corbeille fruit métal blanc</li>
                      <li><span>1</span>Couteau à découper</li>
                      <li><span>1</span>Couteau à pain</li>
                      <li><span>6</span>Couteaux</li>
                      <li><span>3</span>Couteaux à viande</li>
                      <li><span>3</span>Couvercles verre</li>
                      <li><span>3</span>Couverts à service en bois</li>
                      <li><span>6</span>Cuillères</li>
                      <li><span>2</span>Cuillères à service</li>
                      <li><span>1</span>Desserte trolley noir</li>
                      <li><span>1</span>Dessous plat teck</li>
                      <li><span>1</span>Économe</li>
                      <li><span>1</span>Égouttoir</li>
                      <li><span>2</span>Éponges</li>
                      <li><span>4</span>Éponges tissus</li>
                      <li><span>1</span>Essoreuse salade</li>
                      <li><span>2</span>Étagères</li>
                      <li><span>1</span>Fausse plante</li>
                      <li><span>6</span>Fourchettes</li>
                      <li><span>1</span>Grand saladier bakélite</li>
                      <li><span>4</span>Grandes assiettes noir/blanc</li>
                  </ul>
                </section>

                <section className="livret-inventory-section">
                  <ul>
                      <li><span>2</span>Grandes tasses vert/noir</li>
                      <li><span>2</span>Grands bols noir/vert</li>
                      <li><span>1</span>Grille-pain</li>
                      <li><span>1</span>Passoire</li>
                      <li><span>1</span>Petite louche</li>
                      <li><span>6</span>Petites cuillères</li>
                      <li><span>6</span>Petites fourchettes</li>
                      <li><span>2</span>Petits bols kaki</li>
                      <li><span>2</span>Petits bols vert/noir</li>
                      <li><span>6</span>Petits couteaux</li>
                      <li><span>2</span>Petits saladiers noir/vert et bois/noir</li>
                      <li><span>1</span>Plateau kaki bambou</li>
                      <li><span>2</span>Plats verre four rectangles</li>
                      <li><span>2</span>Poêles</li>
                      <li><span>1</span>Poignée</li>
                      <li><span>1</span>Porte sopalin</li>
                      <li><span>1</span>Pot à sucre vert ancien</li>
                      <li><span>2</span>Pots en verre vert</li>
                      <li><span>1</span>Poubelle</li>
                      <li><span>1</span>Protège robinet plastique</li>
                      <li><span>1</span>Rouleau à pâtisserie</li>
                      <li><span>1</span>Séparateur couverts bambou</li>
                      <li><span>1</span>Set de table lin</li>
                      <li><span>1</span>Tapis égouttoir</li>
                      <li><span>6</span>Tasses à café vert ancien</li>
                      <li><span>4</span>Tasses animaux noir et blanc</li>
                      <li><span>3</span>Tasses vert ancien</li>
                      <li><span>3</span>Torchons</li>
                      <li><span>6</span>Verres à pied</li>
                      <li><span>6</span>Verres hauts</li>
                  </ul>
                </section>
                </div>
              </div>
            </div>

            <footer className="livret-page-footer">
              <img src="/livret/liseret-separateur.webp" alt="" aria-hidden="true" />
              <div className="livret-page-number">8</div>
            </footer>
          </div>
        </section>

        {/* PAGE 9 — INVENTAIRE — ÉTAGES */}
        <section
          id="inventaire-etages"
          className="livret-page livret-inventory-page"
          aria-label="Inventaire — étages"
        >
          <div className="livret-page-inner livret-function-inner">
            <header className="livret-page-header livret-function-header">
              <h1>Inventaire : étages</h1>
              <div className="livret-ornament" aria-hidden="true">⟡</div>
            </header>

            <div className="livret-inventory-floor-section">
              <div className="livret-inventory-floor-title">Premier étage</div>

              <div className="livret-inventory-floor-grid">
                <div className="livret-inventory-column">
<section className="livret-inventory-section">
                  <h2>Palier</h2>
                  <ul>
                      <li><span>1</span>Caissette mini</li>
                      <li><span>3</span>Décos teck pyrogravées</li>
                      <li><span>1</span>Meuble</li>
                  </ul>
                </section>

<section className="livret-inventory-section">
                  <h2>WC</h2>
                  <ul>
                      <li><span>1</span>Balayette WC bambou</li>
                      <li><span>1</span>Cadre Arbizon</li>
                      <li><span>1</span>Meuble papier WC bambou</li>
                      <li><span>1</span>Porte papier WC métal noir</li>
                  </ul>
                </section>

<section className="livret-inventory-section">
                  <h2>Salle de bain</h2>
                  <ul>
                      <li><span>2</span>Fausses petites plantes</li>
                      <li><span>1</span>Faux aloès</li>
                      <li><span>1</span>Miroir</li>
                      <li><span>6</span>Panières rangement motifs</li>
                      <li><span>6</span>Panières rangement noires</li>
                      <li><span>1</span>Porte-manteau bambou</li>
                      <li><span>1</span>Porte-savon</li>
                      <li><span>1</span>Porte-shampoing douche</li>
                      <li><span>1</span>Poubelle à pied noire</li>
                      <li><span>1</span>Raclette douche</li>
                      <li><span>1</span>Tapis de salle de bain</li>
                      <li><span>1</span>Verre brosses à dents</li>
                  </ul>
                </section>
                </div>

                <div className="livret-inventory-column">
<section className="livret-inventory-section">
                  <h2>Chambre</h2>
                  <ul>
                      <li><span>1</span>3 petits tiroirs bleus</li>
                      <li><span>1</span>Attache rideau</li>
                      <li><span>1</span>Bureau</li>
                      <li><span>1</span>Chaise bois</li>
                      <li><span>1</span>Couette doublée</li>
                      <li><span>2</span>Coussins or et blanc</li>
                      <li><span>1</span>Dessus lit blanc</li>
                      <li><span>1</span>Flocon bois</li>
                      <li><span>1</span>Housse de couette</li>
                      <li><span>1</span>Lampe de bureau blanc</li>
                      <li><span>2</span>Lampes de chevet</li>
                      <li><span>1</span>Miroir rond</li>
                      <li><span>2</span>Oreillers</li>
                      <li><span>1</span>Panière poubelle osier</li>
                      <li><span>1</span>Rond de chaise fourrure blanc</li>
                      <li><span>1</span>Table de chevet vieux bois</li>
                      <li><span>2</span>Tables de chevet</li>
                  </ul>
                </section>

<section className="livret-inventory-section">
                  <h2>Balcon</h2>
                  <ul>
                      <li><span>1</span>Assise fausse fourrure</li>
                      <li><span>1</span>Cabane insecte</li>
                      <li><span>2</span>Chaises de jardin métal vert</li>
                      <li><span>1</span>Échelle bois</li>
                      <li><span>1</span>Fauteuil rotin</li>
                      <li><span>2</span>Pots de fleur vert métal</li>
                      <li><span>1</span>Table de jardin métal vert</li>
                  </ul>
                </section>
                </div>
              </div>
            </div>

            <div className="livret-inventory-floor-section livret-inventory-floor-section-second">
              <div className="livret-inventory-floor-title">Deuxième étage</div>

              <div className="livret-inventory-floor-grid">
                <div className="livret-inventory-column">
<section className="livret-inventory-section">
                  <h2>Chambre</h2>
                  <ul>
                      <li><span>1</span>Chaise bois</li>
                      <li><span>2</span>Couettes doublées</li>
                      <li><span>1</span>Coussin étoile fourrure</li>
                      <li><span>2</span>Coussins rectangles dorés</li>
                      <li><span>1</span>Guirlande lumineuse boules</li>
                      <li><span>3</span>Jeux de société</li>
                      <li><span>2</span>Lits jumeaux</li>
                      <li><span>3</span>Luminaires métal blanc + ampoules</li>
                      <li><span>2</span>Oreillers</li>
                      <li><span>1</span>Rond de chaise fourrure blanc</li>
                      <li><span>1</span>Table de toilette</li>
                      <li><span>2</span>Tables de chevet rondes</li>
                      <li><span>2</span>Tapis fourrure grise</li>
                  </ul>
                </section>
                </div>

                <div className="livret-inventory-column">
<section className="livret-inventory-section">
                  <h2>Palier 2</h2>
                  <ul>
                      <li><span>1</span>Porte-manteau</li>
                      <li><span>1</span>Pouf de rangement</li>
                      <li><span>1</span>Sapin bois</li>
                  </ul>
                </section>
                </div>
              </div>
            </div>

            <footer className="livret-page-footer">
              <img src="/livret/liseret-separateur.webp" alt="" aria-hidden="true" />
              <div className="livret-page-number">9</div>
            </footer>
          </div>
        </section>

      </main>
    </>
  );
}
