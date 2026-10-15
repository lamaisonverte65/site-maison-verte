export function BookletHouseRules() {
  return (
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
                <p>Une utilisation raisonnée est nécessaire afin de conserver suffisamment d'eau chaude.</p>
                <p>Une petite raclette se trouve sous le mitigeur et permet d'évacuer un maximum d'eau, de garder la douche propre et saine</p>
                <p>En cas de fuite, dysfonctionnement ou anomalie, merci de nous prévenir rapidement.</p>
                <p>La vanne d'eau se trouve à côté du lave vaisselle.</p>

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
                  <li>des chaussons sont disponibles dans le meuble du palier d'entrée.</li>
                  <li>2 couettes sont disponibles par lit</li>

                </ul>

              </article>
            </div>

            <article className="livret-info-card livret-eco-card">
              <div className="livret-info-title">
                <img src="/livret/icone-bon-a-savoir.svg" alt="" aria-hidden="true" />
                <h2>Bon à savoir</h2>
              </div>

              <p>Le tableau électrique se situe derrière la porte d'entrée.</p>
              <p>Le Wi-Fi 7 est disponible dans le logement. La télévision est directement reliée à Internet par câble Ethernet. Les informations de connexion au Wi-Fi vous sont communiquées avant votre arrivée.</p>
              <p>Une poubelle de tri est à votre disposition dans le logement. Les conteneurs de tri sont situés à l'entrée du parking du Monument aux Morts. En sortant de l'impasse, tournez à droite puis continuez tout droit.</p>
              <p>De l'huile, du sel, du sucre, du café ainsi que quelques condiments sont laissés à votre disposition pour faciliter votre arrivée ou les courts séjours, merci de ne pas en abuser.</p>
              <p>Vous trouverez aussi des tablettes de lave vaisselle sous l'évier.</p>
              <p>Dans le placard haut de la buanderie se trouvent de la lessive et adoussissant, des amploules, des rouleaux de papier toilette en cas de besoin.</p>
            </article>

            <footer className="livret-page-footer">
              <img src="/livret/liseret-separateur.webp" alt="" aria-hidden="true" />
              <div className="livret-page-number">3</div>
            </footer>
          </div>
        </section>
  );
}

export function BookletHouseRulesDetails() {
  return (
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

            <p>Les serviettes de toilette sont fournies : une grande serviette 70 × 140 cm et une petite serviette 33 × 50 cm par personne.</p>

            <p>Merci de déposer le linge utilisé dans la buanderie :</p>

            <ul>
              <li>draps ;</li>
              <li>housses de couette ;</li>
              <li>taies d'oreiller ;</li>
              <li>serviettes de toilette ;</li>
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
              Si vous avez choisi le forfait ménage de fin de séjour lors de votre réservation,
              vous n'avez pas à effectuer le ménage complet avant votre départ.
            </p>
            <p>
              Si vous avez choisi d'effectuer vous-même le ménage de fin de séjour,
              merci de rendre le logement dans un état de propreté similaire à celui
              dans lequel vous l'avez trouvé à votre arrivée.
            </p>
            <p>Vous trouverez tous les éléments nécessaires sous l'évier et dans la buanderie.</p>
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
  );
}
