import { localizeBookletTree } from "../../booklet/localizeBooklet";

export function BookletWelcome({ language = "fr" } = {}) {
  return localizeBookletTree((
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
              src="/livret/banniere-contacts.webp"
              alt="La Maison Verte - Email : lamaisonverte65@gmail.com - Adresse : 3 Impasse Trassens, 65240 Arreau"
            />
          </div>
        </section>
  ), language);
}

export function BookletWelcomeDetails({ language = "fr" } = {}) {
  return localizeBookletTree((
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

                    <a href="#plan-acces-stationnement">
                      <span>Page 6</span>
                      <strong>Accès & stationnement</strong>
                    </a>

                    <a href="#decouvrir-vallees">
                      <span>Page 7</span>
                      <strong>Découvrir les vallées</strong>
                    </a>

                    <a href="#votre-avis">
                      <span>Page 8</span>
                      <strong>Votre avis compte</strong>
                    </a>

                    <a href="#boite-a-cles">
                      <span>Page 9</span>
                      <strong>Arrivée & boîte à clés</strong>
                    </a>

                    <a href="#inventaire">
                      <span>Page 10</span>
                      <strong>Inventaire complet</strong>
                    </a>
                  </nav>
                </section>
              </div>

              <aside className="livret-welcome-side" aria-label="QR codes utiles">
                <div className="livret-vertical-line" />

                <div className="livret-qr-grid livret-welcome-qr-grid">
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
                    <a href="tel:+33695938315">
                    <div className="livret-qr-icon">☎</div>
                    <h2>Nous appeler</h2>
                    <img src="/livret/qr-telephone.svg" alt="QR code pour appeler La Maison Verte" />
                    </a>
                  </div>

                  <div className="livret-qr-block livret-qr-block-wifi">
                    <div className="livret-qr-icon">⌁</div>
                    <h2>WI-FI DU LOGEMENT</h2>
                    <img
                      src="/livret/qr-wifi.svg"
                      alt="QR code de connexion au Wi-Fi de La Maison Verte"
                    />
                    <p className="livret-wifi-code">Code : lamaisonverte65</p>
                  </div>

                  <div className="livret-qr-block">
                    <a href="https://lamaisonverte65.fr/guide-vallees-aure-louron" target="_blank" rel="noopener noreferrer">
                    <div className="livret-qr-icon">▴</div>
                    <h2>Guide des vallées</h2>
                    <img src="/livret/qr-guide.svg" alt="QR code vers le guide des vallées d'Aure et du Louron" />
                    </a>
                  </div>

                  <div className="livret-qr-block">
                    <a href="https://wa.me/message/EKRAB2I476GVP1?src=qr" target="_blank" rel="noopener noreferrer">
                    <div className="livret-qr-icon">◉</div>
                    <h2>WhatsApp</h2>
                    <img src="/livret/qr-whatsapp.png" alt="QR code WhatsApp de La Maison Verte" />
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
  ), language);
}
