import { localizeBookletTree } from "../../booklet/localizeBooklet";

export function BookletPractical({ language = "fr" } = {}) {
  return localizeBookletTree((
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
              <span
                aria-hidden="true"
                style={{
                  width: "30px",
                  height: "30px",
                  borderRadius: "50%",
                  background: "#eef3d8",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: "0 0 auto",
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ color: "#315d3b" }}
                >
                  <circle cx="12" cy="12" r="8" />
                  <path d="M12 7v5l3 2" />
                </svg>
              </span>
              <h2>Horaires</h2>
            </div>
            <br />
            <p>
              <strong>Arrivée habituelle :</strong> à partir de 16 h.<br />
              <strong>Départ :</strong> avant 10 h.
            </p>
            <p>Les horaires d’arrivée et de départ doivent être respectés lorsque les séjours s’enchaînent, afin de nous laisser le temps de préparer la maison pour les voyageurs suivants.
            </p>
            <p> En période plus calme, nous pouvons être beaucoup plus flexibles. N’hésitez pas à nous faire part de vos besoins : une arrivée anticipée ou un départ plus tardif peuvent être possibles.
            </p>
            <p>Vous trouverez les clés dans une boîte à clés dont le code vous sera envoyé par email 2 jours avant votre arrivée</p>
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
  ), language);
}

export function BookletPracticalDetails({ language = "fr" } = {}) {
  return localizeBookletTree((
<section
          id="plan-acces-stationnement"
          className="livret-page livret-parking-page"
          aria-label="Accès et stationnement à La Maison Verte"
        >
          <div className="livret-page-inner livret-parking-inner">

            <header className="livret-page-header livret-parking-header">
              <h1>Accès & stationnement</h1>
              <div className="livret-ornament" aria-hidden="true">&#10209;</div>
              <p>
                La Maison Verte se trouve au cœur d'Arreau,
                dans une petite impasse piétonne.
              </p>
            </header>

            <div className="livret-parking-intro">
              <div className="livret-parking-text">
                <h2>Arriver à Arreau</h2>
                <p>
                  Arreau se situe au carrefour des vallées d'Aure et du Louron,
                  sur la route de Saint-Lary, de l'Espagne, du col d'Aspin
                  et de Peyragudes.
                </p>
              </div>

              <img
                src="/livret/plan-parking-4.webp"
                alt="Plan général d'accès à Arreau et aux vallées environnantes"
              />
            </div>

            <div className="livret-parking-detail">
              <img
                src="/livret/plan-parking-3.webp"
                alt="Plan détaillé des accès et des parkings autour de La Maison Verte"
              />

              <div className="livret-parking-notes">
                <div>
                  <h2>Accès à La Maison Verte</h2>
                  <p>
                    La maison est située dans une impasse piétonne.
                    Pour charger ou décharger vos bagages, vous pouvez
                    vous approcher par la rue de la Coutellerie.
                  </p>
                  <p>
                    Attention : cette rue est également une impasse
                    et il n'est pas possible d'y faire demi-tour.
                  </p>
                </div>

                <div>
                  <h2>Où stationner ?</h2>
                  <p>
                    Plusieurs parkings gratuits sont disponibles à quelques
                    minutes à pied, notamment place du Monument aux Morts
                    et place de l'église Notre-Dame.
                  </p>
                </div>
              </div>
            </div>

            <footer className="livret-page-footer">
              <img
                src="/livret/liseret-separateur.webp"
                alt=""
                aria-hidden="true"
              />
              <div className="livret-page-number">6</div>
            </footer>

          </div>
        </section>
  ), language);
}
