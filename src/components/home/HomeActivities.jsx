export function HomeActivities() {
  return (
<section id="activites" className="section">
        <h2>Activités & expériences</h2>

        <p
          style={{
            textAlign: "center",
            maxWidth: "780px",
            margin: "0 auto 55px",
            lineHeight: "1.8",
            color: "#555",
          }}
        >
          Profitez de la centralité unique d'Arreau pour vous offir une
          multitude d'activités possibles. Au coeur d'un cadre naturel
          exceptionnel, organisez votre séjour sportif, culturel, récréatif ou
          bien-être selon vos envies.
        </p>

        {/* OFFRE SKI */}

        <div
          style={{
            background: "#1f6f3d",
            color: "white",
            borderRadius: "36px",
            padding: "42px",
            marginBottom: "42px",
            display: "grid",
            gridTemplateColumns: "1fr 320px",
            gap: "30px",
            alignItems: "center",
            boxShadow: "0 20px 60px rgba(0,0,0,0.14)",
          }}
        >
          <div>
            <h3
              style={{
                color: "white",
                marginBottom: "16px",
              }}
            >
              Offre hiver : logement + cours de ski
            </h3>

            <p
              style={{
                lineHeight: "1.8",
                opacity: 0.95,
                marginBottom: "20px",
              }}
            >
              En hiver, combinez votre séjour à La Maison Verte avec des cours
              de ski et de snowboard personnalisés sur la station de Peyragudes
              avec un moniteur de ski diplômé.
            </p>

            <strong>
              Tarif préférentiel : jusqu’à 15% de réduction sur le logement pour
              une formule séjour + cours de ski. Nous contacter pour plus
              d'information.
            </strong>

            <div style={{ marginTop: "24px" }}>
              <a
                href="/ski-vallees-aure-louron"
                style={{
                  display: "inline-block",
                  background: "white",
                  color: "#1f6f3d",
                  padding: "12px 20px",
                  borderRadius: "999px",
                  textDecoration: "none",
                  fontWeight: "800",
                }}
              >
                Découvrir les cours de ski
              </a>
            </div>
          </div>

          <img
            src="/activite-ski.webp"
            alt="Cours de ski dans les Pyrénées"
            style={{
              width: "100%",
              height: "220px",
              objectFit: "cover",
              borderRadius: "28px",
            }}
          />
        </div>

        {/* CARTES ACTIVITES */}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
            gap: "28px",
          }}
        >
          {[
            {
              title: "Nature & randonnées",
              image: "/activite-randonnee.webp",
              alt: "Randonnée dans les Pyrénées et réserve du Néouvielle",
              text: "Lacs d’altitude, panoramas exceptionnels au coeur du massif, depuis un «3000» ou un sommet surplombant le piémont, Parcs Nationaux des Pyrénées et d'Ordessa, réserve du Néouvielle, circuits avec nuités en refuge : une destination idéale pour découvrir les Pyrénées, respirer l'air pur des montagnes, se ressourcer.",
              links: [
                {
                  label: "Réserve du Néouvielle",
                  url: "https://www.visit-neouvielle.com/",
                },
                {
                  label: "Parc National Pyrénées",
                  url: "https://www.pyrenees-parcnational.fr/",
                },
                {
                  label: "Pyrénées 2 Vallées",
                  url: "https://www.pyrenees2vallees.com/la-randonnee-%C3%A0-pyrenees2vall%C3%A9es",
                },
                {
                  label: "Parc national d'Ordessa Mont Perdu",
                  url: "https://www.turismodearagon.com/fr/ficha/ordesa-y-monte-perdido/",
                },
                {
                  label: "Randonnée et activités outdoor",
                  url: "https://www.agence-outdoor.fr",
                },
                {
                  label: "Cabanes et refuges",
                  url: "https://www.pyrenees-refuges.com/",
                },
                {
                  label: "Guide de hte montagne",
                  url: "http://pierre.guide.free.fr/",
                },
              ],
            },
            {
              title: "Vélo & cols mythiques",
              image: "/activite-velo.webp",
              alt: "Cyclisme dans les cols des Hautes-Pyrénées",
              text: "Partez à la découverte des grands cols pyrénéens : Aspin, Peyresourde, Tourmalet, Hourquette d'Ancizan, Portet et Azet : un terrain de jeu rêvé pour les cyclistes. Dévalez en VTT les pistes de la Coupe du Monde Mountain Bike UCI de la vallée du Louron, mais aussi celles en vallée d'Aure et de la Zona Zero en Espagne.",
              links: [
                {
                  label: "Route des cols",
                  url: "https://www.tourisme-hautes-pyrenees.com/montagne-ete/velo/ascensions-cols-pyrenees/grande-route-cols/",
                },
                {
                  label: "Cols, cartes et profils",
                  url: "https://climbfinder.com/fr/carte#lnglat=0.359832/42.905098&position=11.22/42.905098/0.359832",
                },
                {
                  label: "Louron Bike & Trail",
                  url: "https://louronbikeandtrail.com/fr",
                },
                {
                  label: "VTT Aure Louron ",
                  url: "https://www.pyrenees2vallees.com/vtt",
                },
                {
                  label: "VTT Ainsa - Zona Zero ",
                  url: "https://zonazeropirineos.com/fr/",
                },
              ],
            },
            {
              title: "Eau vive & sensations",
              image: "/activite-eauvive.webp",
              alt: "Rafting canyoning eau vive dans les Pyrénées",
              text: "Descente en rafting de la Neste d'Aure, canyon sportif sur les flancs du Mont Perdu ou ludique dans les eaux turquoises de la Sierra de Guara, via ferrata, activités sportives familiales ou sensationnelles pour ajouter une dose d’aventure à votre séjour.",
              links: [
                {
                  label: "Rafting et Canyoning",
                  url: "https://pyragua.com/",
                },
                {
                  label: "Canyon Sierra de Guara",
                  url: "https://www.canyonsierradeguara.com/",
                },
                {
                  label: "Activités Louron",
                  url: "https://www.vallee-du-louron.com/fr/activites-2",
                },
                {
                  label: "Activités vallée d'Aure",
                  url: "https://www.tourisme-hautes-pyrenees.com/montagne-ete/lieux-de-sejour/saint-lary-et-la-vallee-aure/",
                },
                {
                  label: "Activités Piémont",
                  url: "https://coeurdespyrenees.com/office-de-tourisme-lannemezan-et-capvern/je-suis-touriste/",
                },
                {
                  label: "Baronnies - Barousse",
                  url: "https://tourisme-neste-barousse.fr/",
                },
                {
                  label: "Parapente",
                  url: "https://virevolte.net/",
                },
              ],
            },
            {
              title: "Bien-être & découvertes",
              image: "/activite-detente.webp",
              alt: "Balnéa Loudenvielle détente et patrimoine",
              text: "Après une journée en montagne, profitez d'un moment de détente à Balnéa, découvrez les villages pyrénéens, Saint-Lary, Loudenvielle, le patrimoine architectural, la gastronomie locale ou une escapade vers l’Espagne.",
              links: [
                {
                  label: "Balnéa",
                  url: "https://www.balnea.fr/",
                },
                {
                  label: "Arreau",
                  url: "https://www.mairie-arreau.fr/",
                },
                {
                  label: "Le patrimoine des vallées d’Aure et du Louron",
                  url: "https://patrimoine-aure-louron.fr/notre-patrimoine/focus-sur-les-monuments-incontournables/",
                },
                {
                  label: "Gastronomie et producteurs locaux",
                  url: "https://www.hapy-saveurs.com/",
                },
                {
                  label: "Infos locales",
                  url: "https://www.scoop.it.pyrenees-aure-louron.eu/",
                },
                {
                  label: "Le marché d'Arreau",
                  url: "https://www.paysdesnestes.fr/marche-de-arreau/",
                },
              ],
            },
          ].map((activity) => (
            <div
              key={activity.title}
              style={{
                background: "white",
                borderRadius: "32px",
                overflow: "hidden",
                boxShadow: "0 15px 40px rgba(0,0,0,0.08)",
                transition: "0.35s",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = "translateY(-6px)";
                e.currentTarget.style.boxShadow =
                  "0 22px 55px rgba(0,0,0,0.13)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow =
                  "0 15px 40px rgba(0,0,0,0.08)";
              }}
            >
              <img
                src={activity.image}
                alt={activity.alt}
                style={{
                  width: "100%",
                  height: "240px",
                  objectFit: "cover",
                }}
              />

              <div
                style={{
                  padding: "28px",
                }}
              >
                <h3
                  style={{
                    marginBottom: "14px",
                  }}
                >
                  {activity.title}
                </h3>

                <p
                  style={{
                    lineHeight: "1.8",
                    color: "#555",
                    marginBottom: "24px",
                  }}
                >
                  {activity.text}
                </p>

                <details
                  style={{
                    marginTop: "18px",
                  }}
                >
                  <summary
                    style={{
                      color: "#1f6f3d",
                      fontWeight: "700",
                      cursor: "pointer",
                    }}
                  >
                    Liens utiles
                  </summary>

                  <div
                    style={{
                      display: "grid",
                      gap: "10px",
                      marginTop: "16px",
                    }}
                  >
                    {activity.links.map((link) => (
                      <a
                        key={link.url}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: "#1f6f3d",
                          textDecoration: "none",
                          fontWeight: "500",
                        }}
                      >
                        {link.label} →
                      </a>
                    ))}
                  </div>
                </details>
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            textAlign: "center",
            maxWidth: "900px",
            margin: "60px auto 0",
            padding: "0 24px",
          }}
        >
          <h3
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "clamp(2rem, 4vw, 2.8rem)",
              color: "#2f4f35",
              marginBottom: "16px",
              fontWeight: "600",
            }}
          >
            Découvrir la vallée d'Aure
          </h3>

          <p
            style={{
              fontSize: "1.1rem",
              lineHeight: "1.8",
              color: "#555",
              maxWidth: "750px",
              margin: "0 auto 28px",
            }}
          >
            Stations de ski, cols mythiques des Pyrénées, lacs du Néouvielle,
            randonnées, patrimoine, villages de montagne et bien-être :
            découvrez notre guide complet pour préparer votre séjour à Arreau et
            explorer les incontournables de la vallée d'Aure.
          </p>

          <a
            href="/guide-vallees-aure-louron"
            style={{
              display: "inline-block",
              padding: "16px 34px",
              background: "#2f4f35",
              color: "white",
              borderRadius: "999px",
              textDecoration: "none",
              fontWeight: "600",
              fontSize: "1rem",
              boxShadow: "0 8px 25px rgba(47,79,53,0.25)",
              transition: "all 0.3s ease",
            }}
          >
            Voir le guide complet →
          </a>
        </div>

      </section>
  );
}
