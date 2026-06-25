import { Helmet } from "react-helmet";

const travelTimes = [
  ["Saint-Lary téléphérique", "15 min"],
  ["Saint-Lary Pla d'Adet", "30 min"],
  ["Loudenvielle", "15 min"],
  ["Peyragudes", "20 min"],
  ["Val Louron", "25 min"],
  ["Piau-Engaly", "35 min"],
  ["Nistos Cap Nestès", "45 min"],
  ["Néouvielle / lac d'Orédon", "45 min"],
  ["Vallée de Pineta / Mont-Perdu", "1h15"],
];

const stayIdeas = [
  {
    title: "Week-end découverte",
    items: [
      "Flâner dans le centre historique d'Arreau",
      "Découvrir la halle, la Maison des Lys et les ruelles anciennes",
      "Monter vers le col d'Aspin ou la Hourquette d'Ancizan",
      "Terminer la journée à Balnéa ou Sensoria",
    ],
  },
  {
    title: "Semaine en famille",
    items: [
      "Alterner balades faciles, patrimoine et villages de montagne",
      "Profiter des stations familiales de Saint-Lary, Val Louron ou Peyragudes",
      "Prévoir une sortie aux grottes de Gargas ou au Gouffre d'Esparros",
      "Découvrir les parcours aventure, la via ferrata ou les activités autour du lac de Loudenvielle",
    ],
  },
  {
    title: "Séjour sportif",
    items: [
      "Enchaîner les cols mythiques : Aspin, Azet, Peyresourde, Portet, Hourquette d'Ancizan",
      "Rouler en VTT, gravel ou enduro entre vallée d'Aure et vallée du Louron",
      "Randonner vers le Néouvielle et les grands lacs d'altitude",
      "Découvrir parapente, trail, canyoning, rafting, pêche ou triathlon selon la saison",
    ],
  },
];

const guideSections = [
  {
    kicker: "Situation centrale",
    title: "Pourquoi choisir Arreau ?",
    image: "/guide/arreau-panorama.webp",
    alt: "Vue panoramique d'Arreau au cœur des Pyrénées",
    caption: "Arreau, à la confluence des vallées d'Aure et du Louron — Crédit photo : Wikimedia Commons.",
    paragraphs: [
      "Arreau occupe une position rare dans les Pyrénées : le village se situe à la confluence de la vallée d'Aure et de la vallée du Louron. Cette situation centrale permet de rayonner facilement en étoile vers les stations de ski, les cols mythiques, les lacs du Néouvielle, les villages de montagne, les événements sportifs, le piémont pyrénéen et l'Espagne.",
      "Séjourner à Arreau permet de profiter d'un village vivant, avec commerces et restaurants accessibles à pied, tout en conservant une grande liberté d'excursions. C'est l'un des grands avantages de La Maison Verte : poser les valises au cœur du village, puis choisir chaque jour une ambiance différente.",
    ],
  },
  {
    kicker: "Village et patrimoine",
    title: "Arreau : halle, Maison des Lys, marchés et histoire locale",
    image: "/guide/arreau-halle-mairie.webp",
    alt: "Halle et mairie d'Arreau",
    caption: "La halle-mairie d'Arreau, repère central du village — Crédit photo : Wikimedia Commons.",
    paragraphs: [
      "Arreau s'est développé comme lieu de passage, de foires et de marchés, au débouché des vallées d'Aure et du Louron. La halle-mairie rappelle cette tradition d'échanges et reste l'un des repères du centre du village.",
      "La Maison des Lys, demeure gothique emblématique, fait partie des monuments les plus marquants d'Arreau. Le village possède également le Château des Nestes, le Château de Ségure, la chapelle Saint-Exupère, l'église Notre-Dame, des maisons à colombages et plusieurs façades remarquables.",
      "Le jeudi matin, le marché sous la halle permet de retrouver l'ambiance locale : producteurs, fromages, charcuteries, miel, spécialités pyrénéennes et échanges de village. C'est souvent l'un des moments les plus authentiques d'un séjour à Arreau.",
      "Le Musée des Cagots, installé au Château des Nestes, apporte aussi un éclairage original sur une page méconnue de l'histoire du Sud-Ouest et des Pyrénées.",
    ],
  },
  {
    kicker: "Aure et Louron",
    title: "Deux vallées, une multitude d'excursions",
    image: "/guide/arreau-pont-neste.webp",
    alt: "Pont sur la Neste à Arreau",
    caption: "Arreau et les ponts sur les Nestes, entre vallée d'Aure et vallée du Louron — Crédit photo : Wikimedia Commons.",
    paragraphs: [
      "La vallée d'Aure mène vers Saint-Lary, Vielle-Aure, Ancizan, Aragnouet, Piau-Engaly, le tunnel de Bielsa et les accès vers le Néouvielle. La vallée du Louron ouvre vers Loudenvielle, Génos, Val Louron et Peyragudes.",
      "Les deux vallées sont labellisées Pays d'Art et d'Histoire, avec un patrimoine religieux et architectural très riche : églises romanes, chapelles, retables, fresques, clochers et villages de caractère.",
      "Pour les visiteurs, cette double ouverture est idéale : ski le matin, balade patrimoniale l'après-midi, bain thermal en soirée, ou grande journée montagne selon les envies.",
    ],
  },
  {
    kicker: "Hiver",
    title: "Ski, neige et stations accessibles depuis Arreau",
    image: "/guide/saint-lary-pla-adet.webp",
    alt: "Saint-Lary Pla d'Adet",
    caption: "Saint-Lary Pla d'Adet, l'une des stations accessibles depuis Arreau — Crédit photo : Wikimedia Commons.",
    paragraphs: [
      "En hiver, Arreau offre une situation très pratique pour varier les domaines skiables. Le téléphérique de Saint-Lary est à environ 15 minutes, le Pla d'Adet à environ 30 minutes, Peyragudes à environ 20 minutes, Val Louron à 25 minutes et Piau-Engaly à 35 minutes.",
      "Saint-Lary séduit par son village animé et son domaine skiable, Peyragudes par son exposition et ses équipements modernes, Val Louron par son ambiance familiale, et Piau-Engaly par son altitude et son environnement de haute montagne.",
      "Les amateurs de ski nordique et de raquettes peuvent également découvrir deux secteurs remarquables. Côté français, Nistos Cap Nestès propose un domaine dédié au ski de fond, aux itinéraires nordiques et aux panoramas sur les Pyrénées. Côté espagnol, l'Espace Nordique Piau-Pineta permet de pratiquer ski de fond, raquettes et ski de randonnée dans un environnement préservé, au cœur du Parc National d'Ordesa et du Mont-Perdu.",
      "Selon la météo, l'enneigement ou le niveau des skieurs, il est donc facile d'adapter son programme sans être enfermé dans une seule station.",
    ],
  },
  {
    kicker: "Vélo",
    title: "Cols mythiques, Tour de France et sorties en étoile",
    image: "/guide/col-aspin-cyclisme.webp",
    alt: "Cyclistes au col d'Aspin",
    caption: "Le col d'Aspin, ascension emblématique des Pyrénées et du Tour de France — Crédit photo : Wikimedia Commons.",
    paragraphs: [
      "Arreau est un camp de base exceptionnel pour le vélo de route. Depuis le village, les cyclistes peuvent rejoindre directement plusieurs ascensions mythiques : col d'Aspin, col d'Azet, col de Peyresourde, Hourquette d'Ancizan et col du Portet.",
      "Ces cols sont intimement liés à l'histoire du Tour de France. Ils permettent de composer des sorties très variées : montée unique, boucle entre vallées, enchaînement de cols ou grande journée montagne.",
      "Pour les accompagnants, Arreau reste pratique : cafés, commerces, marché et balades sont accessibles à pied pendant que les cyclistes partent rouler.",
    ],
  },
  {
    kicker: "VTT, gravel et trail",
    title: "Loudenvielle, Peyragudes et les grands rendez-vous sportifs",
    image: "/guide/lac-genos-loudenvielle.webp",
    alt: "Lac de Génos-Loudenvielle dans la vallée du Louron",
    caption: "Le lac de Génos-Loudenvielle, au cœur de la vallée du Louron — Crédit photo : Wikimedia Commons.",
    paragraphs: [
      "La vallée du Louron est devenue un territoire majeur pour le VTT, l'enduro, la descente et le gravel. Le secteur Loudenvielle-Peyragudes accueille le Pyrénées Bike Festival et une manche des UCI Mountain Bike World Series.",
      "Autour d'Arreau, les amateurs de VTT peuvent trouver des itinéraires variés : boucles de cross-country, pistes de montagne, parcours plus techniques, descentes et itinéraires adaptés au gravel.",
      "Le trail occupe également une place importante dans la région, avec des événements majeurs comme le Grand Raid des Pyrénées, le Patou Trail à Saint-Lary ou les courses de montagne organisées dans les vallées.",
    ],
  },
  {
    kicker: "Air, eau, rocher",
    title: "Parapente, canyoning, via ferrata et parcours aventure",
    image: "/guide/loudenvielle-parapente-lac.webp",
    alt: "Parapente au-dessus du lac de Génos-Loudenvielle",
    caption: "Parapente au-dessus de Loudenvielle et du lac de Génos — Crédit photo : Wikimedia Commons.",
    paragraphs: [
      "Les vallées d'Aure et du Louron ne se limitent pas au ski et à la randonnée. Le parapente est l'une des activités phares du secteur, notamment autour de Loudenvielle, Peyragudes et du PLAF, le Pyrénées Louron Air Festival.",
      "Les eaux vives permettent aussi de varier les plaisirs : rafting, canyoning et activités de rivière se pratiquent dans les vallées pyrénéennes et sur les secteurs adaptés selon la saison, l'encadrement et les niveaux d'eau.",
      "Les vallées d'Aure et du Louron sont également appréciées des pêcheurs. La Neste d'Aure, la Neste du Louron, les torrents de montagne et les lacs d'altitude comme Orédon, Aubert ou Aumar offrent de nombreuses possibilités de pêche dans un environnement naturel préservé.",
      "La via ferrata de Camous permet de découvrir la verticalité pyrénéenne avec un parcours équipé accessible à différents niveaux. Le Parcours Aventure du Moudang, dans les gorges du Moudang à Aragnouet, combine accrobranche, via ferrata, ponts de singe et tyroliennes dans un cadre de montagne spectaculaire.",
      "Pour les familles ou les groupes, N'Co Park à Lannemezan propose aussi des parcours aventure, tyroliennes et activités en forêt. Côté canyoning, les vallées pyrénéennes offrent plusieurs possibilités, tandis que la Sierra de Guara, en Espagne, reste une référence européenne accessible pour une grande excursion à la journée.",
    ],
  },
  {
    kicker: "Randonnée et nature",
    title: "Néouvielle, lacs d'altitude et faune pyrénéenne",
    image: "/guide/neouvielle-lacs-aumar-aubert.webp",
    alt: "Lacs d'Aumar et d'Aubert dans le Néouvielle",
    caption: "Les lacs d'Aumar et d'Aubert, joyaux de la réserve naturelle du Néouvielle — Crédit photo : Wikimedia Commons.",
    paragraphs: [
      "La réserve naturelle nationale du Néouvielle fait partie des plus beaux sites des Pyrénées. Les lacs d'Orédon, d'Aubert, d'Aumar et de Cap-de-Long offrent des paysages spectaculaires, entre pins à crochets, granit, eau turquoise et sommets.",
      "Autour d'Arreau, les possibilités de randonnée sont nombreuses : balades faciles, circuits patrimoniaux, sentiers de moyenne montagne, randonnées vers les lacs ou itinéraires plus sportifs.",
      "La faune pyrénéenne est également remarquable. On peut observer isards, marmottes, vautours fauves, gypaète barbu, et découvrir l'existence du desman des Pyrénées, petit mammifère semi-aquatique rare et discret, emblématique des torrents de montagne aux eaux pures.",
    ],
  },
  {
    kicker: "Bien-être",
    title: "Balnéa, Sensoria et récupération après l'effort",
    image: "/guide/lac-genos-loudenvielle.webp",
    alt: "Lac de Génos-Loudenvielle près de Balnéa",
    caption: "Loudenvielle et le lac de Génos, à proximité de Balnéa — Crédit photo : Wikimedia Commons.",
    paragraphs: [
      "Après une journée de ski, de vélo, de randonnée ou de trail, les espaces bien-être des vallées sont très appréciés. Balnéa, à Génos-Loudenvielle, est un centre thermo-ludique emblématique des Pyrénées.",
      "À Saint-Lary, Sensoria Rio et les thermes complètent l'offre avec des espaces d'eau chaude, de détente, de soins et de récupération. C'est une excellente idée pour les jours de météo incertaine, les séjours en famille ou les lendemains de grandes sorties sportives.",
    ],
  },
  {
    kicker: "Espagne",
    title: "Bielsa, Aínsa, Ordesa et la Sierra de Guara",
    image: "/guide/ainsa-plaza-mayor.webp",
    alt: "Plaza Mayor d'Aínsa en Espagne",
    caption: "Aínsa, village médiéval espagnol accessible en excursion depuis Arreau — Crédit photo : Wikimedia Commons.",
    paragraphs: [
      "Depuis Arreau, l'Espagne est une vraie possibilité d'excursion. Le tunnel de Bielsa permet de rejoindre le versant espagnol des Pyrénées, avec des ambiances très différentes en quelques kilomètres.",
      "Aínsa, le parc national d'Ordesa et du Mont-Perdu, Torla ou la Sierra de Guara offrent des idées de sorties remarquables pour les séjours d'une semaine. La Sierra de Guara est particulièrement réputée pour le canyoning, avec des parcours connus dans toute l'Europe.",
      "La vallée de Pineta constitue l'une des plus belles excursions accessibles depuis Arreau. Dominée par les impressionnantes falaises du massif du Mont-Perdu, classé au patrimoine mondial de l'UNESCO, elle offre des paysages spectaculaires, des cascades, des randonnées accessibles et une ambiance de haute montagne unique dans les Pyrénées.",
      "En hiver, l'Espace Nordique Piau-Pineta permet également la pratique du ski de fond, des raquettes, du ski de randonnée et des activités nordiques dans un cadre exceptionnel, entre Piau-Engaly, Bielsa, Pineta et le Parc National d'Ordesa et du Mont-Perdu.",
    ],
  },
  {
    kicker: "Piémont",
    title: "Gouffre d'Esparros, Gargas, Petite Amazonie et marbre de Sarrancolin",
    image: "/guide/gouffre-esparros-artigaleou.webp",
    alt: "Gouffre d'Esparros dans les Hautes-Pyrénées",
    caption: "Le Gouffre d'Esparros, site souterrain majeur du piémont pyrénéen — Crédit photo : Wikimedia Commons.",
    paragraphs: [
      "Le piémont pyrénéen offre de belles idées de sorties lorsque l'on souhaite varier les plaisirs ou descendre un peu en altitude. Le Gouffre d'Esparros est célèbre pour ses cristallisations d'aragonite et son univers souterrain fragile.",
      "Les grottes de Gargas sont les seules grottes ornées des Hautes-Pyrénées ouvertes au public, connues pour leurs mains négatives préhistoriques. La Gourgue d'Asque, surnommée la Petite Amazonie des Pyrénées, offre une ambiance de forêt humide et de gorge luxuriante très différente des paysages d'altitude.",
      "À Sarrancolin, le marbre raconte une autre histoire du territoire. Le marbre de Sarrancolin a été utilisé dans des lieux prestigieux comme Versailles, l'Opéra Garnier et, selon plusieurs sources patrimoniales, le hall de l'Empire State Building. C'est une anecdote forte pour comprendre le rayonnement de ce petit territoire pyrénéen.",
    ],
  },
  {
    kicker: "Culture et jours de pluie",
    title: "Cinémas, médiathèque, animations et sorties calmes",
    image: "/guide/arreau-eglise-notre-dame.webp",
    alt: "Église Notre-Dame d'Arreau",
    caption: "L'église Notre-Dame d'Arreau, témoin du patrimoine religieux local — Crédit photo : Wikimedia Commons.",
    paragraphs: [
      "Un bon guide doit aussi penser aux jours plus calmes. Autour d'Arreau, on peut prévoir une séance de cinéma à Saint-Lary ou à Lannemezan, une visite patrimoniale, une animation locale, une exposition ou un moment à la médiathèque d'Arreau.",
      "La médiathèque, le musée des Cagots, les parcours numériques d'Arreau, les agendas de Pyrénées2Vallées et les animations des villages permettent de compléter un séjour lorsque la météo change ou que l'on souhaite lever le pied.",
    ],
  },
  {
    kicker: "Gastronomie",
    title: "Goûter les Pyrénées",
    image: "/guide/arreau-halle-mairie.webp",
    alt: "Halle d'Arreau, lieu du marché hebdomadaire",
    caption: "La halle d'Arreau, lieu de marché et de vie locale — Crédit photo : Wikimedia Commons.",
    paragraphs: [
      "Un séjour dans les Pyrénées passe aussi par l'assiette. Garbure, fromage de brebis, gâteau à la broche, tourte des Pyrénées, porc noir de Bigorre, miel, charcuteries et produits de montagne font partie des plaisirs simples du territoire.",
      "Le marché d'Arreau est une bonne occasion de composer un repas local à déguster à La Maison Verte, ou de rapporter quelques spécialités à partager après une journée dehors.",
    ],
  },
];

const majorEvents = [
  {
    title: "PLAF – Pyrénées Louron Air Festival",
    text: "Festival gratuit autour du vol libre à Loudenvielle : parapente, deltaplane, cerf-volant, démonstrations, compétitions, concerts et animations.",
    url: "https://plafvallouron.fr/",
  },
  {
    title: "Pyrénées Bike Festival",
    text: "Grand rendez-vous VTT à Loudenvielle-Peyragudes, avec Coupe du Monde UCI, descente, enduro, exposants et ambiance festival.",
    url: "https://www.pyreneesbikefestival.com/",
  },
  {
    title: "Grand Raid des Pyrénées",
    text: "Un des grands ultra-trails pyrénéens, avec plusieurs formats et des parcours majeurs autour des Hautes-Pyrénées.",
    url: "https://www.grandraidpyrenees.com/",
  },
  {
    title: "Patou Trail Saint-Lary",
    text: "Trois jours de trail en montagne à Saint-Lary, avec plusieurs formats de course au cœur de la vallée d'Aure.",
    url: "https://www.patoutrailsaintlary.com/",
  },
  {
    title: "BalnéaMan Triathlon",
    text: "Triathlon à Loudenvielle-Génos : natation dans le lac, vélo sur les cols et course à pied dans un cadre de montagne.",
    url: "https://balneamantriathlon.fr/",
  },
];

const usefulLinks = [
  {
    category: "Randonnées, balades et patrimoine d'Arreau",
    links: [
      ["Carte officielle des randonnées d'Arreau", "https://www.mairie-arreau.fr/decouverte-village/porte-vallees-aure-louron/carte-randonnees/file.html"],
      ["Les petits coins d'Arreau", "https://www.mairie-arreau.fr/decouverte-village/porte-vallees-aure-louron/les-petits-coins-d-arreau/file.html"],
      ["Patrimoine architectural d'Arreau", "https://www.mairie-arreau.fr/decouverte-village/porte-vallees-aure-louron/patrimoine-architectural.html"],
      ["Musée des Cagots", "https://www.mairie-arreau.fr/loisirs/vie-culturelle/musee-cagots.html"],
      ["Les églises classées des vallées", "https://patrimoine-aure-louron.fr/notre-patrimoine/focus-sur-les-monuments-incontournables/"],
      ["Médiathèque d'Arreau", "https://www.facebook.com/mediathequedarreau/"],
      ["Mairie d'Arreau", "https://www.mairie-arreau.fr/"],
    ],
  },
  {
    category: "Offices, stations et agenda",
    links: [
      ["Pyrénées2Vallées", "https://www.pyrenees2vallees.com/"],
      ["Agenda vallée du Louron", "https://www.vallee-du-louron.com/fr/evenements"],
      ["Saint-Lary Tourisme", "https://www.saintlary.com/"],
      ["Peyragudes", "https://www.peyragudes.com/"],
      ["Piau-Engaly", "https://www.piau-engaly.com/"],
      ["Val Louron", "https://www.val-louron-ski.com/"],
      ["Espace Nordique Piau-Pineta", "https://piau-engaly.com/espace-nordique-piau-pineta/"],
      ["Nistos Cap Nestès", "https://nistos-ski.fr/"],
    ],
  },
  {
    category: "Vélo, VTT, trail et événements sportifs",
    links: [
      ["Louron Bike & Trail", "https://louronbikeandtrail.com/"],
      ["Pyrénées Bike Festival", "https://www.pyreneesbikefestival.com/"],
      ["Grand Raid des Pyrénées", "https://www.grandraidpyrenees.com/"],
      ["Patou Trail Saint-Lary", "https://www.patoutrailsaintlary.com/"],
      ["BalnéaMan Triathlon", "https://balneamantriathlon.fr/"],
    ],
  },
  {
    category: "Parapente, canyoning et aventure",
    links: [
      ["PLAF – Pyrénées Louron Air Festival", "https://plafvallouron.fr/"],
      ["Via ferrata de Camous", "https://www.pyrenees2vallees.com/via-ferrata-vallees-aure-louron"],
      ["Parcours Aventure du Moudang", "https://parcoursaventuremoudang.com/"],
      ["N'Co Park Aventure", "https://ncopark.com/"],
      ["Pêche Hautes-Pyrénées", "https://www.peche65.fr/"],
    ],
  },
  {
    category: "Bien-être, grottes et piémont",
    links: [
      ["Balnéa", "https://www.balnea.fr/"],
      ["Sensoria Saint-Lary", "https://www.sensoria-rio.fr/"],
      ["Gouffre d'Esparros", "https://www.gouffre-esparros.fr/"],
      ["Grottes de Gargas", "https://grottesdegargas.fr/"],
      ["Petite Amazonie des Pyrénées", "https://coeurdespyrenees.com/la-petite-amazonie-des-pyrenees/"],
      ["Marbre de Sarrancolin", "https://fr.anecdotrip.com/sarrancolin-la-capitale-haute-pyreneenne-du-celebre-marbre-du-roi-soleil"],
    ],
  },
];

function ExternalLink({ href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        color: "#2f4f35",
        fontWeight: "700",
        textDecoration: "none",
      }}
    >
      {children}
    </a>
  );
}

export default function GuideValleesAureLouron() {
  return (
    <>
      <Helmet>
        <title>
          Guide vallée d'Aure et du Louron – Que faire autour d'Arreau | La Maison Verte
        </title>
        <meta
          name="description"
          content="Guide complet de la vallée d'Aure et du Louron depuis Arreau : ski, ski de fond à Nistos et Piau-Pineta, randonnée, pêche, vélo, VTT, parapente, canyoning, Néouvielle, Pineta, Mont-Perdu, patrimoine et liens utiles."
        />
        <link
          rel="canonical"
          href="https://lamaisonverte65.fr/guide-vallees-aure-louron"
        />
        <meta
          property="og:title"
          content="Guide complet de la vallée d'Aure et du Louron"
        />
        <meta
          property="og:description"
          content="Que faire autour d'Arreau ? Stations de ski, ski nordique à Nistos et Piau-Pineta, pêche, cols, VTT, parapente, Néouvielle, vallée de Pineta, Mont-Perdu, patrimoine et idées de séjour."
        />
        <meta
          property="og:image"
          content="https://lamaisonverte65.fr/guide/arreau-panorama.webp"
        />
        <meta
          property="og:url"
          content="https://lamaisonverte65.fr/guide-vallees-aure-louron"
        />
        <meta property="og:type" content="article" />
      </Helmet>

      <main
        style={{
          minHeight: "100vh",
          background: "#f6f3ee",
          color: "#1e2b1f",
          fontFamily: "'Lora', serif",
        }}
      >
        <section
          style={{
            minHeight: "70vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "90px 24px 80px",
            background:
              "linear-gradient(rgba(0,0,0,0.28), rgba(0,0,0,0.40)), url('/guide/vue-calvaire-arreau-nuit.webp')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            backgroundColor: "#000000",
            color: "white",
            textAlign: "center",
            position: "relative",
          }}
        >
          <div style={{ maxWidth: "1040px", margin: "0 auto" }}>

            <h1
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "clamp(3rem, 10vw, 4rem)",
                lineHeight: "1.5",
                margin: "0",
                fontWeight: "600",
                letterSpacing: "+3px",
                textShadow: "0 8px 35px rgba(0,0,0,0.65)",
              }}
            >
              Guide complet
              <br />
              de la vallée d'Aure
              <br />
              et du Louron
            </h1>
          </div>

          <div
            style={{
              position: "absolute",
              right: "18px",
              bottom: "14px",
              fontSize: "0.78rem",
              color: "rgba(255,255,255,0.75)",
              textShadow: "0 2px 8px rgba(0,0,0,0.8)",
            }}
          >
            
          </div>
        </section>

        <section
          style={{
            background: "#000000",
            color: "white",
            padding: "32px 24px 48px",
            textAlign: "center",
          }}
        >
          <div style={{ maxWidth: "900px", margin: "0 auto" }}>
            <div
              style={{
                textTransform: "uppercase",
                letterSpacing: "4px",
                fontWeight: "700",
                marginBottom: "18px",
                opacity: 0.85,
              }}
            >
              Arreau • Hautes-Pyrénées
            </div>

            <h2
              style={{
                color: "#f5f1e8",
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "clamp(1.8rem, 3vw, 2.6rem)",
                marginBottom: "20px",
              }}
            >
              Que faire autour d'Arreau ?
            </h2>

            <p style={{ lineHeight: "1.9", fontSize: "1.1rem", margin: 0 }}>
              Situé à la confluence des vallées d'Aure et du Louron, Arreau constitue un point de départ idéal pour découvrir les Pyrénées. Stations de ski, cols mythiques du Tour de France, VTT, parapente, canyoning, randonnée, patrimoine, gastronomie et grands espaces naturels : ce guide rassemble les incontournables pour préparer votre séjour.
            </p>
          </div>
        </section>

        <section
          style={{
            maxWidth: "1120px",
            margin: "0 auto 0",
            padding: "54px 24px 80px",
            position: "relative",
            zIndex: 2,
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: "34px",
              padding: "clamp(28px, 5vw, 48px)",
              boxShadow: "0 18px 60px rgba(0,0,0,0.10)",
              marginBottom: "34px",
            }}
          >
            <h2
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "clamp(2.2rem, 5vw, 3.4rem)",
                color: "#2f4f35",
                margin: "0 0 18px",
              }}
            >
              Arreau, le point de départ idéal pour rayonner en étoile
            </h2>

            <p
              style={{
                fontSize: "1.12rem",
                lineHeight: "1.9",
                color: "#475569",
                marginBottom: "28px",
              }}
            >
              Situé à la confluence des vallées d'Aure et du Louron, Arreau
              permet de multiplier les possibilités sans changer d'hébergement :
              ski, vélo, VTT, parapente, randonnée, bien-être, patrimoine,
              événements sportifs, Espagne et sorties dans le piémont pyrénéen.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                gap: "12px",
              }}
            >
              {travelTimes.map(([place, time]) => (
                <div
                  key={place}
                  style={{
                    background: "#f4f7f4",
                    border: "1px solid #dbe7dc",
                    borderRadius: "18px",
                    padding: "16px 18px",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "16px",
                    alignItems: "center",
                  }}
                >
                  <span style={{ color: "#334155", fontWeight: "700" }}>
                    {place}
                  </span>
                  <span style={{ color: "#2f4f35", fontWeight: "800" }}>
                    {time}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "18px",
              marginBottom: "42px",
            }}
          >
            {stayIdeas.map((idea) => (
              <div
                key={idea.title}
                style={{
                  background: "white",
                  borderRadius: "28px",
                  padding: "26px",
                  boxShadow: "0 14px 45px rgba(0,0,0,0.08)",
                }}
              >
                <h2
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    color: "#2f4f35",
                    fontSize: "1.9rem",
                    margin: "0 0 14px",
                  }}
                >
                  {idea.title}
                </h2>
                <ul style={{ paddingLeft: "20px", color: "#475569", lineHeight: "1.8" }}>
                  {idea.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <article
            style={{
              background: "white",
              borderRadius: "36px",
              padding: "clamp(30px, 5vw, 58px)",
              boxShadow: "0 18px 60px rgba(0,0,0,0.08)",
              color: "#334155",
              lineHeight: "1.9",
            }}
          >
            {guideSections.map((section, index) => (
              <section
                key={section.title}
                style={{
                  borderTop: index === 0 ? "none" : "1px solid #e5e7eb",
                  paddingTop: index === 0 ? 0 : "42px",
                  marginTop: index === 0 ? 0 : "42px",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                    gap: "34px",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div
                      style={{
                        color: "#2f4f35",
                        textTransform: "uppercase",
                        letterSpacing: "2px",
                        fontWeight: "800",
                        fontSize: "0.8rem",
                        marginBottom: "10px",
                      }}
                    >
                      {section.kicker}
                    </div>

                    <h2
                      style={{
                        fontFamily: "'Cormorant Garamond', serif",
                        fontSize: "clamp(2rem, 4vw, 3rem)",
                        lineHeight: "1.05",
                        color: "#2f4f35",
                        margin: "0 0 18px",
                      }}
                    >
                      {section.title}
                    </h2>

                    {section.paragraphs.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>

                  <figure style={{ margin: 0 }}>
                    <img
                      src={section.image}
                      alt={section.alt}
                      loading="lazy"
                      style={{
                        width: "100%",
                        minHeight: "280px",
                        maxHeight: "420px",
                        objectFit: "cover",
                        borderRadius: "28px",
                        boxShadow: "0 14px 45px rgba(0,0,0,0.12)",
                      }}
                    />
                    <figcaption
                      style={{
                        color: "#64748b",
                        fontSize: "0.9rem",
                        marginTop: "10px",
                        textAlign: "center",
                      }}
                    >
                      {section.caption}
                    </figcaption>
                  </figure>
                </div>
              </section>
            ))}

            <section
              style={{
                marginTop: "54px",
                padding: "34px",
                borderRadius: "30px",
                background: "#f4f7f4",
                border: "1px solid #dbe7dc",
              }}
            >
              <h2
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: "clamp(2.1rem, 4vw, 3.2rem)",
                  color: "#2f4f35",
                  marginTop: 0,
                }}
              >
                Les grands événements de l'année
              </h2>

              <p>
                La vallée d'Aure et la vallée du Louron accueillent plusieurs
                événements majeurs autour du sport, de la montagne et de la
                culture locale. Les dates changent chaque année : vérifiez
                toujours les sites officiels avant votre séjour.
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: "16px",
                  marginTop: "24px",
                }}
              >
                {majorEvents.map((event) => (
                  <a
                    key={event.title}
                    href={event.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "block",
                      background: "white",
                      borderRadius: "22px",
                      padding: "22px",
                      textDecoration: "none",
                      color: "#334155",
                      boxShadow: "0 8px 26px rgba(0,0,0,0.06)",
                    }}
                  >
                    <h3
                      style={{
                        color: "#2f4f35",
                        margin: "0 0 10px",
                        fontSize: "1.15rem",
                      }}
                    >
                      {event.title}
                    </h3>
                    <p style={{ margin: 0, lineHeight: "1.7" }}>{event.text}</p>
                  </a>
                ))}
              </div>
            </section>

            <section style={{ marginTop: "54px" }}>
              <h2
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: "clamp(2.1rem, 4vw, 3.2rem)",
                  color: "#2f4f35",
                }}
              >
                Préparer son séjour : liens utiles
              </h2>

              <p>
                Voici les principaux liens pour vérifier les horaires, réserver
                certaines activités, consulter les agendas et préparer vos sorties.
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: "18px",
                  marginTop: "24px",
                }}
              >
                {usefulLinks.map((group) => (
                  <div
                    key={group.category}
                    style={{
                      background: "#f8fafc",
                      borderRadius: "24px",
                      padding: "24px",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <h3
                      style={{
                        color: "#2f4f35",
                        marginTop: 0,
                        marginBottom: "14px",
                      }}
                    >
                      {group.category}
                    </h3>

                    <ul
                      style={{
                        paddingLeft: "20px",
                        margin: 0,
                        lineHeight: "1.9",
                      }}
                    >
                      {group.links.map(([label, url]) => (
                        <li key={url}>
                          <ExternalLink href={url}>{label}</ExternalLink>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            <section
              style={{
                marginTop: "58px",
                padding: "38px",
                borderRadius: "32px",
                background: "#2f4f35",
                color: "white",
                textAlign: "center",
              }}
            >
              <h2
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: "clamp(2.4rem, 5vw, 3.8rem)",
                  margin: "0 0 18px",
                }}
              >
                Se loger à Arreau
              </h2>

              <p
                style={{
                  maxWidth: "780px",
                  margin: "0 auto 28px",
                  lineHeight: "1.9",
                  fontSize: "1.08rem",
                }}
              >
                Située au cœur historique d'Arreau, La Maison Verte est une
                maison de vacances rénovée pour 4 personnes. Sa localisation
                permet de rayonner facilement vers les stations de ski, les
                cols mythiques, les sentiers de randonnée, les événements
                sportifs, le Néouvielle, le Louron et les grands sites des
                Pyrénées.
              </p>

              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: "16px",
                  flexWrap: "wrap",
                }}
              >
                <a
                  href="/#reservation"
                  style={{
                    display: "inline-block",
                    padding: "16px 32px",
                    background: "white",
                    color: "#2f4f35",
                    borderRadius: "999px",
                    textDecoration: "none",
                    fontWeight: "800",
                  }}
                >
                  Voir les disponibilités
                </a>

                <a
                  href="/"
                  style={{
                    display: "inline-block",
                    padding: "16px 32px",
                    border: "1px solid rgba(255,255,255,0.8)",
                    color: "white",
                    borderRadius: "999px",
                    textDecoration: "none",
                    fontWeight: "800",
                  }}
                >
                  Découvrir La Maison Verte
                </a>
              </div>
            </section>
          </article>
        </section>
      </main>
    </>
  );
}
