import { localizeBookletTree } from "../../booklet/localizeBooklet";

export function BookletDiscover({ language = "fr" } = {}) {
  return localizeBookletTree((
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
              <div className="livret-page-number">7</div>
            </footer>
          </div>
        </section>
  ), language);
}

export function BookletDiscoverDetails({ language = "fr" } = {}) {
  return localizeBookletTree((
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
                8
              </div>
            </footer>

          </div>
        </section>
  ), language);
}
