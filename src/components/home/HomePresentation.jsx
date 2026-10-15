export function HomePresentation() {
  return (
<section id="presentation" className="section" style={{ scrollMarginTop: "86px" }}>
        <h2
          style={{
            marginBottom: "34px",
          }}
        >
          La maison
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 0.8fr",
            gap: "40px",
            alignItems: "start",
          }}
        >
          <div
            style={{
              background: "white",
              padding: "40px",
              borderRadius: "35px",
              boxShadow: "0 15px 45px rgba(0,0,0,0.08)",
            }}
          >
            <h3>Un petit cocon niché au cœur d'un village traditionnel</h3>

            <p
              style={{
                lineHeight: "1.9",
                color: "#555",
                marginTop: "20px",
              }}
            >
              Meublé de tourisme officiellement classé 3 étoiles, entièrement
              rénové pour 4 personnes et niché dans le centre historique
              d’Arreau. Situé à la Confluence des vallées
              d’Aure (Saint-Lary) et du Louron (Loudenvielle), au pied de 4
              stations de ski, de nombreux cols mythiques et de multiples
              possibilités de randonnées.
            </p>

            <p
              style={{
                lineHeight: "1.9",
                color: "#555",
              }}
            >
              La Maison Verte est une location de vacances de particulier à
              particulier située au cœur d'Arreau. Réservez directement auprès
              du propriétaire, sans intermédiaire ni frais de plateforme, pour
              préparer votre séjour dans les Pyrénées en toute simplicité. Une
              solution idéale pour les voyageurs recherchant un hébergement
              authentique proche de Saint-Lary, Loudenvielle, Peyragudes, Val
              Louron, du Néouvielle et du Mont-Perdu.
            </p>


            <p
              style={{
                lineHeight: "1.9",
                color: "#555",
              }}
            >
              Sur 3 niveaux, elle offre un séjour avec cuisine entièrement
              équipée, une chambre parentale avec balcon ensoleillé, une salle
              de bain, des WC séparés et une chambre sous combles avec deux lits
              jumeaux.
            </p>

            <p
              style={{
                lineHeight: "1.9",
                color: "#555",
              }}
            >
              Toutes les commodités sont accessibles à pied en moins de 3
              minutes : boulangerie, boucherie, pharmacie, librairie, bars,
              restaurants et commerces du village.
            </p>
          </div>

          <div
            style={{
              background: "#1f6f3d",
              color: "white",
              padding: "35px",
              borderRadius: "35px",
              boxShadow: "0 15px 45px rgba(0,0,0,0.12)",
            }}
          >
            <h3
              style={{
                color: "white",
                marginBottom: "25px",
              }}
            >
              En bref
            </h3>

            <div
              style={{
                display: "grid",
                gap: "18px",
              }}
            >
              <div>🏡 Maison rénovée sur 3 niveaux</div>
              <div>👨‍👩‍👧‍👦 Idéale pour 4 personnes</div>
              <div>🛏️ 2 chambres : 1 grand lit, 2 lits jumeaux</div>
              <div>☀️ Balcon exposé sud</div>
              <div>🚶 Commerces à pied</div>
              <div>⛷️ Situation centrale stratégique </div>
              <div>🚴 Hébergement idéal pour cyclistes</div>
              <div>🏍️ Accueil pratique pour motards</div>
              <div>📶 Wi-Fi 7</div>
              <div>🤝 Réservation directe propriétaire</div>
              <div>🐕 Animaux non acceptés</div>
            </div>

            <div
              style={{
                marginTop: "26px",
                paddingTop: "22px",
                borderTop: "1px solid rgba(255,255,255,0.28)",
                display: "flex",
                alignItems: "center",
                gap: "14px",
              }}
            >
              <img
                src="/classement/panonceau-meuble-tourisme-3-etoiles-2026.webp"
                alt="Panonceau officiel du classement Meublé de tourisme 3 étoiles"
                style={{ width: "92px", height: "auto", flex: "0 0 auto" }}
              />
              <div style={{ lineHeight: 1.45, fontSize: "0.92rem" }}>
                <strong>Meublé de tourisme classé 3 étoiles</strong>
                <br />
                Classement officiel Atout France
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: "45px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
            gap: "18px",
          }}
        >
          {[
            "Cuisine équipée",
            "Machine à laver",
            "Lave-vaisselle",
            "Congélateur",
            "Smart TV",
            "Cafetière italienne",
            "Cafetière à filtres",
            "Bouilloire",
            "Grille-pain",
            "Appareil à raclette",
            "Sèche cheveux",
            "Fer à repasser",
            "Lit parapluie",
            "58 m²",
            "Balcon avec table et chaises",
            "Linge de lit et serviettes fournis",
            "Poubelle de tri",
            "Animaux non acceptés",
            "Parking gratuit proche",
            "Impasse piétonne",
          ].map((item) => (
            <div
              key={item}
              style={{
                background: "white",
                padding: "20px",
                borderRadius: "22px",
                boxShadow: "0 8px 25px rgba(0,0,0,0.06)",
                textAlign: "center",
                fontWeight: "500",
              }}
            >
              ✓ {item}
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: "34px",
            textAlign: "center",
          }}
        >
          <a
            href="/livret"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              padding: "20px 38px",
              borderRadius: "999px",
              background: "#eef7f0",
              color: "#1f6f3d",
              fontWeight: "700",
              fontSize: "1.12rem",
              textDecoration: "none",
              boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
            }}
          >
            Consulter le livret d’accueil
          </a>

          <p
            style={{
              marginTop: "12px",
              color: "#666",
              lineHeight: "1.7",
            }}
          >
            Vous y trouverez toutes les informations utiles pour préparer votre séjour :
            fonctionnement du logement, accès, bonnes adresses, activités, consignes et inventaire complet des équipements.
          </p>
        </div>
      </section>
  );
}
