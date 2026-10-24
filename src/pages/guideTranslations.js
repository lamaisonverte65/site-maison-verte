// Textes du guide public : les noms de lieux, URL, images, distances et données
// métier restent dans GuideValleesAureLouron.jsx, source française de référence.
// Les tableaux traduits suivent strictement l'ordre des contenus français.
import { normalizeGuestLanguage } from "../../shared/guestLocale.js";

const en = {
  seoTitle: "Aure and Louron valleys guide – Things to do near Arreau | La Maison Verte",
  seoDescription: "Explore the Aure and Louron valleys from Arreau: skiing, Nordic skiing, hiking, fishing, cycling, mountain biking, paragliding, canyoning, Néouvielle, Pineta, heritage and useful links.",
  seoOgTitle: "Complete guide to the Aure and Louron valleys",
  seoOgDescription: "Things to do near Arreau: ski resorts, Nordic skiing, cycling climbs, mountain biking, fishing, paragliding, Néouvielle, Pineta Valley, Monte Perdido and local heritage.",
  hero: ["Your complete guide", "to the Aure Valley", "and the Louron Valley"],
  introTitle: "What can you do around Arreau?",
  intro: "At the meeting point of the Aure and Louron valleys, Arreau is an ideal base for exploring the Pyrenees. Ski resorts, legendary Tour de France climbs, mountain biking, paragliding, canyoning, hiking, heritage, local food and spectacular natural spaces: this guide brings together the highlights to help you plan your stay.",
  locationTitle: "Arreau: the ideal base for exploring in every direction",
  locationText: "At the meeting point of the Aure and Louron valleys, Arreau offers countless possibilities without changing accommodation: skiing, road cycling, mountain biking, paragliding, hiking, wellness, heritage, sporting events, Spain and excursions into the Pyrenean foothills.",
  eventsTitle: "Major events throughout the year",
  eventsIntro: "The Aure and Louron valleys host major events celebrating sport, the mountains and local culture. Dates change each year: always check the official websites before your stay.",
  linksTitle: "Plan your stay: useful links",
  linksIntro: "Here are the main websites for checking opening times, booking activities, consulting event calendars and planning your excursions.",
  accommodationTitle: "Stay in Arreau",
  accommodationText: "In the historic heart of Arreau, La Maison Verte is a renovated holiday home for four guests. Its location makes it easy to explore the ski resorts, legendary mountain passes, hiking trails, sporting events, Néouvielle, the Louron Valley and the major sights of the Pyrenees.",
  availabilityButton: "Check availability",
  homeButton: "Discover La Maison Verte",
  places: ["Saint-Lary cable car", "Saint-Lary Pla d’Adet", "Loudenvielle", "Peyragudes", "Val Louron", "Piau-Engaly", "Nistos Cap Nestès", "Néouvielle / Lake Orédon", "Pineta Valley / Monte Perdido"],
  stayIdeas: [
    {title: "A weekend of discovery", items: [
      "Wander through Arreau’s historic centre",
      "Discover the market hall, Maison des Lys and old lanes",
      "Head towards the Col d’Aspin or Hourquette d’Ancizan",
      "End the day at Balnéa or Sensoria",
    ]},
    {title: "A family week", items: [
      "Alternate easy walks with heritage visits and mountain villages",
      "Enjoy the family-friendly resorts of Saint-Lary, Val Louron or Peyragudes",
      "Visit the Gargas Caves or the Gouffre d’Esparros",
      "Try adventure courses, a via ferrata or activities around Lake Loudenvielle",
    ]},
    {title: "An active holiday", items: [
      "Tackle legendary passes: Aspin, Azet, Peyresourde, Portet and Hourquette d’Ancizan",
      "Go mountain biking, gravel riding or enduro riding between the Aure and Louron valleys",
      "Hike in Néouvielle and around its high-altitude lakes",
      "Discover paragliding, trail running, canyoning, rafting, fishing or triathlon according to the season",
    ]},
  ],
  sections: [
    {
      kicker: "Central location", title: "Why choose Arreau?",
      alt: "Panoramic view of Arreau in the heart of the Pyrenees",
      caption: "Arreau, where the Aure and Louron valleys meet — Photo credit: Wikimedia Commons.",
      paragraphs: [
        "Arreau enjoys an unusual position in the Pyrenees: the village lies at the meeting point of the Aure and Louron valleys. From here, you can easily explore ski resorts, legendary mountain passes, the Néouvielle lakes, mountain villages, sporting events, the Pyrenean foothills and Spain on day trips.",
        "Staying in Arreau means enjoying a lively village, with shops and restaurants within walking distance, while keeping your options open for excursions. That is one of La Maison Verte’s main advantages: unpack in the heart of the village, then discover something different every day.",
      ],
    },
    {
      kicker: "Village and heritage", title: "Arreau: the market hall, Maison des Lys, markets and local history",
      alt: "Arreau market hall and town hall", caption: "Arreau’s market hall and town hall, a central village landmark — Photo credit: Wikimedia Commons.",
      paragraphs: [
        "Arreau grew as a crossroads for travellers, fairs and markets at the entrance to the Aure and Louron valleys. The market hall and town hall recall this trading tradition and remain a landmark in the village centre.",
        "The Maison des Lys, a distinctive Gothic house, is one of Arreau’s most striking monuments. Other sights include Château des Nestes, Château de Ségure, Saint-Exupère chapel, Notre-Dame church, half-timbered houses and several remarkable façades.",
        "On Thursday mornings, the market under the hall captures the local atmosphere: producers, cheeses, cured meats, honey, Pyrenean specialities and village conversations. It is often one of the most authentic parts of a stay in Arreau.",
        "The Musée des Cagots, housed in Château des Nestes, also sheds light on a lesser-known chapter in the history of south-western France and the Pyrenees.",
      ],
    },
    {
      kicker: "Aure and Louron", title: "Two valleys, countless excursions",
      alt: "Bridge across the Neste in Arreau", caption: "Arreau and its bridges over the Neste rivers, between the Aure and Louron valleys — Photo credit: Wikimedia Commons.",
      paragraphs: [
        "The Aure Valley leads towards Saint-Lary, Vielle-Aure, Ancizan, Aragnouet, Piau-Engaly, the Bielsa tunnel and the routes into Néouvielle. The Louron Valley opens towards Loudenvielle, Génos, Val Louron and Peyragudes.",
        "Both valleys carry the Pays d’Art et d’Histoire (Land of Art and History) designation and have a rich religious and architectural heritage: Romanesque churches, chapels, altarpieces, frescoes, bell towers and characterful villages.",
        "This choice of directions is ideal for visitors: ski in the morning, explore heritage sites in the afternoon, enjoy thermal baths in the evening, or spend a full day in the mountains.",
      ],
    },
    {
      kicker: "Winter", title: "Skiing, snow and resorts within easy reach of Arreau",
      alt: "Saint-Lary Pla d’Adet", caption: "Saint-Lary Pla d’Adet, one of the ski areas accessible from Arreau — Photo credit: Wikimedia Commons.",
      paragraphs: [
        "In winter, Arreau makes it easy to try different ski areas. The Saint-Lary cable car is about 15 minutes away, Pla d’Adet around 30 minutes, Peyragudes around 20 minutes, Val Louron 25 minutes and Piau-Engaly 35 minutes.",
        "Saint-Lary is popular for its lively village and ski area; Peyragudes for its aspect and modern facilities; Val Louron for its family atmosphere; and Piau-Engaly for its altitude and high-mountain setting.",
        "Cross-country skiers and snowshoers can also discover two remarkable areas. On the French side, Nistos Cap Nestès offers cross-country trails, Nordic routes and views across the Pyrenees. On the Spanish side, the Piau-Pineta Nordic Area offers cross-country skiing, snowshoeing and ski touring in an unspoilt setting at the heart of Ordesa and Monte Perdido National Park.",
        "Depending on the weather, snow conditions and skiers’ abilities, you can easily adapt your plans instead of being tied to a single resort.",
      ],
    },
    {
      kicker: "Road cycling", title: "Legendary climbs, the Tour de France and rides from your doorstep",
      alt: "Cyclists on the Col d’Aspin", caption: "Col d’Aspin, an iconic Pyrenean climb and Tour de France landmark — Photo credit: Wikimedia Commons.",
      paragraphs: [
        "Arreau is an exceptional base for road cycling. From the village, riders can reach several famous climbs directly: Col d’Aspin, Col d’Azet, Col de Peyresourde, Hourquette d’Ancizan and Col du Portet.",
        "These passes are closely linked to Tour de France history. They offer endless options: a single ascent, a circuit between valleys, a series of climbs or a full day in the mountains.",
        "For non-cycling companions, Arreau is equally convenient: cafés, shops, the market and walks are all within easy reach while the cyclists are out riding.",
      ],
    },
    {
      kicker: "Mountain biking, gravel and trail running", title: "Loudenvielle, Peyragudes and major sporting events",
      alt: "Lake Génos-Loudenvielle in the Louron Valley", caption: "Lake Génos-Loudenvielle, at the heart of the Louron Valley — Photo credit: Wikimedia Commons.",
      paragraphs: [
        "The Louron Valley has become a major destination for mountain biking, enduro, downhill riding and gravel cycling. The Loudenvielle–Peyragudes area hosts the Pyrénées Bike Festival and a round of the UCI Mountain Bike World Series.",
        "Around Arreau, mountain bikers can find varied routes: cross-country loops, mountain tracks, more technical trails, downhill runs and gravel-friendly itineraries.",
        "Trail running is also a big part of local sporting life, with major events such as the Grand Raid des Pyrénées, the Patou Trail in Saint-Lary and mountain races throughout the valleys.",
      ],
    },
    {
      kicker: "Air, water and rock", title: "Paragliding, canyoning, via ferrata and adventure courses",
      alt: "Paragliding above Lake Génos-Loudenvielle", caption: "Paragliding above Loudenvielle and Lake Génos — Photo credit: Wikimedia Commons.",
      paragraphs: [
        "The Aure and Louron valleys offer much more than skiing and hiking. Paragliding is one of the area’s signature activities, particularly around Loudenvielle and Peyragudes and during PLAF, the Pyrénées Louron Air Festival.",
        "White-water activities add even more variety: rafting, canyoning and river sports are available in Pyrenean valleys and suitable locations depending on the season, supervision and water levels.",
        "The Aure and Louron valleys also attract anglers. The Neste d’Aure, Neste du Louron, mountain streams and high-altitude lakes such as Orédon, Aubert and Aumar offer many fishing opportunities in a protected natural environment.",
        "The Camous via ferrata offers a way to experience Pyrenean rock faces on an equipped route suitable for different abilities. The Moudang Adventure Course, in the Moudang gorges at Aragnouet, combines treetop activities, via ferrata, rope bridges and zip lines in a spectacular mountain setting.",
        "For families and groups, N’Co Park in Lannemezan also offers adventure courses, zip lines and forest activities. Several Pyrenean valleys are suitable for canyoning, while Spain’s Sierra de Guara is a renowned European destination that can be visited on a full-day excursion.",
      ],
    },
    {
      kicker: "Hiking and nature", title: "Néouvielle, mountain lakes and Pyrenean wildlife",
      alt: "Lakes Aumar and Aubert in Néouvielle", caption: "Lakes Aumar and Aubert, jewels of the Néouvielle nature reserve — Photo credit: Wikimedia Commons.",
      paragraphs: [
        "The Néouvielle National Nature Reserve is one of the most beautiful sites in the Pyrenees. Lakes Orédon, Aubert, Aumar and Cap-de-Long reveal spectacular landscapes of mountain pines, granite, turquoise water and peaks.",
        "There is no shortage of hiking around Arreau: easy strolls, heritage walks, mid-mountain paths, hikes to lakes and more demanding routes.",
        "Pyrenean wildlife is equally remarkable. Look out for Pyrenean chamois, marmots, griffon vultures and bearded vultures, and learn about the rare, elusive Pyrenean desman, a small semi-aquatic mammal associated with clean mountain streams.",
      ],
    },
    {
      kicker: "Wellness", title: "Balnéa, Sensoria and recovery after an active day",
      alt: "Lake Génos-Loudenvielle near Balnéa", caption: "Loudenvielle and Lake Génos, near Balnéa — Photo credit: Wikimedia Commons.",
      paragraphs: [
        "After skiing, cycling, hiking or trail running, the valley’s wellness centres are a welcome treat. Balnéa, at Génos-Loudenvielle, is one of the Pyrenees’ best-known thermal leisure centres.",
        "In Saint-Lary, Sensoria Rio and the thermal baths add hot-water facilities, relaxation, treatments and recovery options. They are a great choice for changeable weather, family holidays or the day after a big mountain outing.",
      ],
    },
    {
      kicker: "Spain", title: "Bielsa, Aínsa, Ordesa and the Sierra de Guara",
      alt: "Plaza Mayor in Aínsa, Spain", caption: "Aínsa, a medieval Spanish village that can be visited from Arreau — Photo credit: Wikimedia Commons.",
      paragraphs: [
        "Spain is a genuine day-trip option from Arreau. The Bielsa tunnel takes you to the Spanish side of the Pyrenees, where the scenery and atmosphere change dramatically within a few kilometres.",
        "Aínsa, Ordesa and Monte Perdido National Park, Torla and the Sierra de Guara offer outstanding excursions for a week-long stay. The Sierra de Guara is especially famous for canyoning, with routes known throughout Europe.",
        "The Pineta Valley is one of the finest excursions from Arreau. Beneath the imposing cliffs of the UNESCO World Heritage-listed Monte Perdido massif, you will find dramatic scenery, waterfalls, accessible hikes and a distinctive high-mountain atmosphere.",
        "In winter, the Piau-Pineta Nordic Area also offers cross-country skiing, snowshoeing, ski touring and other Nordic activities in an exceptional setting between Piau-Engaly, Bielsa, Pineta and Ordesa and Monte Perdido National Park.",
      ],
    },
    {
      kicker: "Pyrenean foothills", title: "Gouffre d’Esparros, Gargas, Little Amazonia and Sarrancolin marble",
      alt: "Gouffre d’Esparros in the Hautes-Pyrénées", caption: "Gouffre d’Esparros, an outstanding underground site in the Pyrenean foothills — Photo credit: Wikimedia Commons.",
      paragraphs: [
        "The Pyrenean foothills offer wonderful excursions when you want a change of scenery or a day at lower altitude. The Gouffre d’Esparros is famous for its aragonite formations and delicate underground environment.",
        "The Gargas Caves are the only decorated prehistoric caves in the Hautes-Pyrénées open to the public, famous for their ancient hand stencils. The Gourgue d’Asque, nicknamed the Little Amazonia of the Pyrenees, has a damp, lush woodland gorge atmosphere quite unlike the high mountains.",
        "In Sarrancolin, marble tells another part of the area’s story. Sarrancolin marble was used in prestigious buildings including Versailles and the Palais Garnier opera house and, according to several heritage sources, the lobby of the Empire State Building. It is a fascinating insight into the reach of this small Pyrenean region.",
      ],
    },
    {
      kicker: "Culture and rainy days", title: "Cinemas, library, local events and relaxed outings",
      alt: "Notre-Dame church in Arreau", caption: "Notre-Dame church in Arreau, a witness to the area’s religious heritage — Photo credit: Wikimedia Commons.",
      paragraphs: [
        "A useful guide should also cover quieter days. Around Arreau, you can plan a cinema trip in Saint-Lary or Lannemezan, a heritage visit, a local event, an exhibition or some time at Arreau’s media library.",
        "The media library, Musée des Cagots, Arreau’s digital discovery trails, Pyrénées2Vallées event calendars and activities in nearby villages offer plenty of options when the weather changes or you want to slow down.",
      ],
    },
    {
      kicker: "Food and local flavours", title: "Taste the Pyrenees",
      alt: "Arreau market hall, home of the weekly market", caption: "Arreau’s market hall, a place for shopping and local life — Photo credit: Wikimedia Commons.",
      paragraphs: [
        "A trip to the Pyrenees is also about food. Garbure soup, sheep’s cheese, gâteau à la broche (spit cake), Pyrenean torte, Porc Noir de Bigorre pork, honey, cured meats and mountain produce are among the area’s simple pleasures.",
        "Arreau market is a perfect place to put together a local meal to enjoy at La Maison Verte or to pick up specialities to share after a day outdoors.",
      ],
    },
  ],
  events: [
    "A free festival celebrating free flight in Loudenvielle: paragliding, hang gliding, kite flying, demonstrations, competitions, concerts and activities.",
    "A major mountain biking event in Loudenvielle–Peyragudes, featuring a UCI World Cup, downhill and enduro racing, exhibitors and a festival atmosphere.",
    "One of the great Pyrenean ultra-trail events, with several race distances and major routes across the Hautes-Pyrénées.",
    "Three days of mountain trail running in Saint-Lary, with races of different lengths in the heart of the Aure Valley.",
    "A triathlon at Loudenvielle–Génos: lake swimming, cycling over mountain passes and running in a spectacular mountain setting.",
  ],
  linkGroups: [
    {category: "Walks, hikes and heritage in Arreau", labels: ["Official Arreau hiking map", "Arreau’s hidden corners", "Arreau’s architectural heritage", "Musée des Cagots", "The valleys’ listed churches", "Arreau media library", "Arreau town hall"]},
    {category: "Tourist offices, ski resorts and events", labels: ["Pyrénées2Vallées", "Louron Valley events calendar", "Saint-Lary Tourist Office", "Peyragudes", "Piau-Engaly", "Val Louron", "Piau-Pineta Nordic Area", "Nistos Cap Nestès"]},
    {category: "Cycling, mountain biking, trail running and sports events", labels: ["Louron Bike & Trail", "Pyrénées Bike Festival", "Grand Raid des Pyrénées", "Patou Trail Saint-Lary", "BalnéaMan Triathlon"]},
    {category: "Paragliding, canyoning and adventure", labels: ["PLAF – Pyrénées Louron Air Festival", "Camous via ferrata", "Moudang Adventure Course", "N’Co Park Aventure", "Fishing in the Hautes-Pyrénées"]},
    {category: "Wellness, caves and foothills", labels: ["Balnéa", "Sensoria Saint-Lary", "Gouffre d’Esparros", "Gargas Caves", "Little Amazonia of the Pyrenees", "Sarrancolin marble"]},
  ],
};

const es = {
  seoTitle: "Guía de los valles de Aure y Louron – Qué hacer cerca de Arreau | La Maison Verte",
  seoDescription: "Descubre los valles de Aure y Louron desde Arreau: esquí, esquí nórdico, senderismo, pesca, ciclismo, BTT, parapente, barranquismo, Néouvielle, Pineta, patrimonio y enlaces útiles.",
  seoOgTitle: "Guía completa de los valles de Aure y Louron",
  seoOgDescription: "Qué hacer cerca de Arreau: estaciones de esquí, esquí nórdico, puertos ciclistas, BTT, pesca, parapente, Néouvielle, valle de Pineta, Monte Perdido y patrimonio.",
  hero: ["Guía completa", "del valle de Aure", "y del valle de Louron"],
  introTitle: "¿Qué hacer en los alrededores de Arreau?",
  intro: "Situado en la confluencia de los valles de Aure y Louron, Arreau es una base ideal para descubrir los Pirineos. Estaciones de esquí, puertos míticos del Tour de Francia, BTT, parapente, barranquismo, senderismo, patrimonio, gastronomía y grandes espacios naturales: esta guía reúne lo imprescindible para preparar tu estancia.",
  locationTitle: "Arreau, el punto de partida ideal para explorar la región",
  locationText: "En la confluencia de los valles de Aure y Louron, Arreau ofrece muchas posibilidades sin cambiar de alojamiento: esquí, ciclismo, BTT, parapente, senderismo, bienestar, patrimonio, eventos deportivos, excursiones a España y visitas al piedemonte pirenaico.",
  eventsTitle: "Los grandes eventos del año",
  eventsIntro: "Los valles de Aure y Louron acogen destacados eventos de deporte, montaña y cultura local. Las fechas cambian cada año: consulta siempre las páginas oficiales antes de tu estancia.",
  linksTitle: "Prepara tu estancia: enlaces útiles",
  linksIntro: "Aquí encontrarás las principales páginas para consultar horarios, reservar actividades, ver agendas y organizar tus excursiones.",
  accommodationTitle: "Alójate en Arreau",
  accommodationText: "Situada en el casco histórico de Arreau, La Maison Verte es una casa de vacaciones renovada para cuatro personas. Su ubicación permite explorar fácilmente las estaciones de esquí, los puertos míticos, los senderos, los eventos deportivos, Néouvielle, el valle de Louron y los grandes atractivos de los Pirineos.",
  availabilityButton: "Consultar disponibilidad",
  homeButton: "Descubrir La Maison Verte",
  places: ["Teleférico de Saint-Lary", "Saint-Lary Pla d’Adet", "Loudenvielle", "Peyragudes", "Val Louron", "Piau-Engaly", "Nistos Cap Nestès", "Néouvielle / lago de Orédon", "Valle de Pineta / Monte Perdido"],
  stayIdeas: [
    {title: "Un fin de semana para descubrir", items: [
      "Pasear por el casco histórico de Arreau",
      "Descubrir el mercado cubierto, la Maison des Lys y las callejuelas antiguas",
      "Subir hacia el col de Aspin o la Hourquette d’Ancizan",
      "Terminar el día en Balnéa o Sensoria",
    ]},
    {title: "Una semana en familia", items: [
      "Alternar paseos sencillos, visitas culturales y pueblos de montaña",
      "Disfrutar de las estaciones familiares de Saint-Lary, Val Louron o Peyragudes",
      "Visitar las cuevas de Gargas o la sima de Esparros",
      "Probar circuitos de aventura, vías ferratas o actividades junto al lago de Loudenvielle",
    ]},
    {title: "Una estancia deportiva", items: [
      "Recorrer puertos míticos: Aspin, Azet, Peyresourde, Portet y Hourquette d’Ancizan",
      "Practicar BTT, gravel o enduro entre los valles de Aure y Louron",
      "Hacer senderismo por Néouvielle y sus lagos de alta montaña",
      "Descubrir parapente, trail, barranquismo, rafting, pesca o triatlón según la temporada",
    ]},
  ],
  sections: [
    {
      kicker: "Ubicación privilegiada", title: "¿Por qué elegir Arreau?",
      alt: "Vista panorámica de Arreau en el corazón de los Pirineos", caption: "Arreau, en la confluencia de los valles de Aure y Louron — Crédito de la foto: Wikimedia Commons.",
      paragraphs: [
        "Arreau ocupa una posición poco habitual en los Pirineos: el pueblo se encuentra en la confluencia de los valles de Aure y Louron. Su situación central permite realizar excursiones a estaciones de esquí, puertos míticos, lagos de Néouvielle, pueblos de montaña, eventos deportivos, el piedemonte pirenaico y España.",
        "Alojarse en Arreau permite disfrutar de un pueblo lleno de vida, con tiendas y restaurantes a los que se puede ir andando, y una gran libertad para organizar excursiones. Es una de las grandes ventajas de La Maison Verte: instalarse en pleno centro y descubrir cada día un entorno diferente.",
      ],
    },
    {
      kicker: "Pueblo y patrimonio", title: "Arreau: mercado cubierto, Maison des Lys, mercadillos e historia local",
      alt: "Mercado cubierto y ayuntamiento de Arreau", caption: "El mercado cubierto y ayuntamiento de Arreau, un lugar emblemático del centro — Crédito de la foto: Wikimedia Commons.",
      paragraphs: [
        "Arreau se desarrolló como lugar de paso, ferias y mercados a la entrada de los valles de Aure y Louron. El edificio del mercado y ayuntamiento recuerda esta tradición comercial y sigue siendo uno de los puntos de referencia del centro.",
        "La Maison des Lys, una emblemática casa gótica, es uno de los monumentos más singulares de Arreau. También destacan el Château des Nestes, el Château de Ségure, la capilla de Saint-Exupère, la iglesia de Notre-Dame, las casas con entramado de madera y varias fachadas notables.",
        "Los jueves por la mañana, el mercado bajo la cubierta permite disfrutar del ambiente local: productores, quesos, embutidos, miel, especialidades pirenaicas y charlas entre vecinos. Suele ser uno de los momentos más auténticos de una estancia en Arreau.",
        "El Musée des Cagots, situado en el Château des Nestes, permite conocer un episodio poco conocido de la historia del suroeste de Francia y los Pirineos.",
      ],
    },
    {
      kicker: "Aure y Louron", title: "Dos valles, innumerables excursiones",
      alt: "Puente sobre el río Neste en Arreau", caption: "Arreau y sus puentes sobre los ríos Neste, entre los valles de Aure y Louron — Crédito de la foto: Wikimedia Commons.",
      paragraphs: [
        "El valle de Aure conduce hacia Saint-Lary, Vielle-Aure, Ancizan, Aragnouet, Piau-Engaly, el túnel de Bielsa y los accesos a Néouvielle. El valle de Louron se abre hacia Loudenvielle, Génos, Val Louron y Peyragudes.",
        "Ambos valles cuentan con el distintivo Pays d’Art et d’Histoire (País de Arte e Historia) y un rico patrimonio religioso y arquitectónico: iglesias románicas, capillas, retablos, frescos, campanarios y pueblos con encanto.",
        "Esta doble orientación es ideal: esquiar por la mañana, descubrir el patrimonio por la tarde, relajarse en aguas termales por la noche o disfrutar de una jornada completa en la montaña.",
      ],
    },
    {
      kicker: "Invierno", title: "Esquí, nieve y estaciones cerca de Arreau",
      alt: "Saint-Lary Pla d’Adet", caption: "Saint-Lary Pla d’Adet, una de las estaciones accesibles desde Arreau — Crédito de la foto: Wikimedia Commons.",
      paragraphs: [
        "En invierno, Arreau ofrece una ubicación muy práctica para alternar estaciones. El teleférico de Saint-Lary está a unos 15 minutos; Pla d’Adet, a unos 30; Peyragudes, a unos 20; Val Louron, a 25; y Piau-Engaly, a 35 minutos.",
        "Saint-Lary destaca por su pueblo animado y su dominio esquiable; Peyragudes, por su orientación y sus instalaciones modernas; Val Louron, por su ambiente familiar; y Piau-Engaly, por su altitud y su entorno de alta montaña.",
        "Quienes disfrutan del esquí de fondo y las raquetas también encontrarán dos zonas excepcionales. En Francia, Nistos Cap Nestès ofrece pistas de fondo, recorridos nórdicos y vistas panorámicas de los Pirineos. En la vertiente española, el Espacio Nórdico Piau-Pineta permite practicar esquí de fondo, raquetas y esquí de travesía en un entorno protegido, en pleno Parque Nacional de Ordesa y Monte Perdido.",
        "Según la meteorología, el estado de la nieve y el nivel de los esquiadores, es fácil adaptar los planes sin depender de una sola estación.",
      ],
    },
    {
      kicker: "Ciclismo", title: "Puertos míticos, Tour de Francia y rutas desde Arreau",
      alt: "Ciclistas en el col de Aspin", caption: "El col de Aspin, ascensión emblemática de los Pirineos y del Tour de Francia — Crédito de la foto: Wikimedia Commons.",
      paragraphs: [
        "Arreau es una base excepcional para el ciclismo de carretera. Desde el pueblo se puede acceder directamente a varias ascensiones legendarias: col de Aspin, col de Azet, col de Peyresourde, Hourquette d’Ancizan y col du Portet.",
        "Estos puertos están estrechamente vinculados a la historia del Tour de Francia. Permiten diseñar rutas muy diferentes: una sola subida, un circuito entre valles, varios puertos enlazados o una gran jornada de montaña.",
        "Para quienes no montan en bicicleta, Arreau también resulta práctico: cafeterías, tiendas, mercado y paseos a pie mientras los ciclistas están de ruta.",
      ],
    },
    {
      kicker: "BTT, gravel y trail", title: "Loudenvielle, Peyragudes y grandes citas deportivas",
      alt: "Lago de Génos-Loudenvielle en el valle de Louron", caption: "El lago de Génos-Loudenvielle, en el corazón del valle de Louron — Crédito de la foto: Wikimedia Commons.",
      paragraphs: [
        "El valle de Louron se ha convertido en un destino destacado para la BTT, el enduro, el descenso y el gravel. La zona de Loudenvielle-Peyragudes acoge el Pyrénées Bike Festival y una prueba de las UCI Mountain Bike World Series.",
        "En los alrededores de Arreau hay rutas de BTT muy variadas: circuitos de campo a través, pistas de montaña, recorridos más técnicos, descensos e itinerarios aptos para gravel.",
        "El trail también tiene mucho protagonismo en la región, con eventos importantes como el Grand Raid des Pyrénées, el Patou Trail de Saint-Lary y las carreras de montaña de los valles.",
      ],
    },
    {
      kicker: "Aire, agua y roca", title: "Parapente, barranquismo, vías ferratas y parques de aventura",
      alt: "Parapente sobre el lago de Génos-Loudenvielle", caption: "Parapente sobre Loudenvielle y el lago de Génos — Crédito de la foto: Wikimedia Commons.",
      paragraphs: [
        "Los valles de Aure y Louron ofrecen mucho más que esquí y senderismo. El parapente es una de sus actividades emblemáticas, especialmente en Loudenvielle, Peyragudes y durante el PLAF, Pyrénées Louron Air Festival.",
        "Las aguas bravas añaden otras posibilidades: rafting, barranquismo y actividades de río en los valles pirenaicos y en zonas adecuadas según la temporada, la supervisión y el caudal.",
        "Los valles de Aure y Louron también atraen a los aficionados a la pesca. Los ríos Neste d’Aure y Neste du Louron, los torrentes de montaña y los lagos de altura como Orédon, Aubert o Aumar ofrecen muchas oportunidades en un entorno natural protegido.",
        "La vía ferrata de Camous permite disfrutar de la verticalidad pirenaica en un recorrido equipado para distintos niveles. El Parcours Aventure du Moudang, en las gargantas de Moudang, en Aragnouet, combina circuitos entre árboles, vía ferrata, puentes colgantes y tirolinas en un espectacular entorno de montaña.",
        "Para familias y grupos, N’Co Park en Lannemezan también propone circuitos de aventura, tirolinas y actividades forestales. Los valles pirenaicos ofrecen distintas opciones de barranquismo, mientras que la Sierra de Guara, en España, sigue siendo un referente europeo al que se puede dedicar una excursión de un día completo.",
      ],
    },
    {
      kicker: "Senderismo y naturaleza", title: "Néouvielle, lagos de altura y fauna pirenaica",
      alt: "Lagos de Aumar y Aubert en Néouvielle", caption: "Los lagos de Aumar y Aubert, joyas de la reserva natural de Néouvielle — Crédito de la foto: Wikimedia Commons.",
      paragraphs: [
        "La Reserva Natural Nacional de Néouvielle es uno de los lugares más bellos de los Pirineos. Los lagos de Orédon, Aubert, Aumar y Cap-de-Long ofrecen paisajes espectaculares entre pinos negros, granito, aguas turquesas y cumbres.",
        "En los alrededores de Arreau abundan las opciones de senderismo: paseos sencillos, rutas patrimoniales, caminos de media montaña, excursiones a los lagos y recorridos más exigentes.",
        "La fauna pirenaica también es extraordinaria. Se pueden observar rebecos pirenaicos, marmotas, buitres leonados y quebrantahuesos, y conocer al desmán de los Pirineos, un pequeño mamífero semiacuático, raro y esquivo, propio de los torrentes de montaña de aguas limpias.",
      ],
    },
    {
      kicker: "Bienestar", title: "Balnéa, Sensoria y descanso después del esfuerzo",
      alt: "Lago de Génos-Loudenvielle cerca de Balnéa", caption: "Loudenvielle y el lago de Génos, cerca de Balnéa — Crédito de la foto: Wikimedia Commons.",
      paragraphs: [
        "Después de un día de esquí, ciclismo, senderismo o trail, los centros de bienestar de los valles son una opción muy apreciada. Balnéa, en Génos-Loudenvielle, es un destacado centro termolúdico de los Pirineos.",
        "En Saint-Lary, Sensoria Rio y las termas completan la oferta con aguas calientes, relajación, tratamientos y recuperación. Es una magnífica idea para días de tiempo inestable, vacaciones en familia o para descansar después de una gran salida deportiva.",
      ],
    },
    {
      kicker: "España", title: "Bielsa, Aínsa, Ordesa y la Sierra de Guara",
      alt: "Plaza Mayor de Aínsa, España", caption: "Aínsa, un pueblo medieval español que se puede visitar desde Arreau — Crédito de la foto: Wikimedia Commons.",
      paragraphs: [
        "Desde Arreau, España es una verdadera opción de excursión. El túnel de Bielsa permite llegar a la vertiente española de los Pirineos y descubrir paisajes y ambientes muy diferentes a pocos kilómetros de distancia.",
        "Aínsa, el Parque Nacional de Ordesa y Monte Perdido, Torla y la Sierra de Guara son destinos excepcionales para estancias de una semana. La Sierra de Guara es especialmente conocida por el barranquismo, con descensos famosos en toda Europa.",
        "El valle de Pineta es una de las mejores excursiones desde Arreau. Bajo las impresionantes paredes del macizo de Monte Perdido, declarado Patrimonio Mundial de la UNESCO, ofrece paisajes espectaculares, cascadas, rutas de senderismo accesibles y un ambiente único de alta montaña.",
        "En invierno, el Espacio Nórdico Piau-Pineta también permite practicar esquí de fondo, raquetas, esquí de travesía y otras actividades nórdicas en un entorno excepcional entre Piau-Engaly, Bielsa, Pineta y el Parque Nacional de Ordesa y Monte Perdido.",
      ],
    },
    {
      kicker: "Piedemonte pirenaico", title: "Sima de Esparros, Gargas, Pequeña Amazonia y mármol de Sarrancolin",
      alt: "Sima de Esparros en los Altos Pirineos", caption: "La sima de Esparros, uno de los grandes enclaves subterráneos del piedemonte pirenaico — Crédito de la foto: Wikimedia Commons.",
      paragraphs: [
        "El piedemonte pirenaico ofrece buenas excursiones cuando apetece variar de paisajes o bajar de altitud. La sima de Esparros es famosa por sus formaciones de aragonito y su frágil mundo subterráneo.",
        "Las cuevas de Gargas son las únicas cuevas con arte rupestre de los Altos Pirineos abiertas al público, conocidas por sus siluetas de manos prehistóricas. La Gourgue d’Asque, apodada la Pequeña Amazonia de los Pirineos, ofrece un bosque húmedo y una garganta frondosa muy distintos de los paisajes de altura.",
        "En Sarrancolin, el mármol cuenta otra historia de la región. El mármol de Sarrancolin se utilizó en lugares prestigiosos como Versalles, la Ópera Garnier y, según varias fuentes patrimoniales, el vestíbulo del Empire State Building. Es una anécdota reveladora de la proyección de este pequeño territorio pirenaico.",
      ],
    },
    {
      kicker: "Cultura y días de lluvia", title: "Cines, biblioteca, actividades y planes tranquilos",
      alt: "Iglesia de Notre-Dame de Arreau", caption: "La iglesia de Notre-Dame de Arreau, testimonio del patrimonio religioso local — Crédito de la foto: Wikimedia Commons.",
      paragraphs: [
        "Una buena guía también debe pensar en los días tranquilos. Cerca de Arreau puedes ir al cine en Saint-Lary o Lannemezan, visitar monumentos, asistir a una actividad local o una exposición, o pasar un rato en la mediateca de Arreau.",
        "La mediateca, el Musée des Cagots, los recorridos digitales de Arreau, las agendas de Pyrénées2Vallées y las actividades de los pueblos permiten completar la estancia cuando cambia el tiempo o apetece bajar el ritmo.",
      ],
    },
    {
      kicker: "Gastronomía", title: "Saborea los Pirineos",
      alt: "Mercado cubierto de Arreau, sede del mercado semanal", caption: "El mercado cubierto de Arreau, lugar de compras y vida local — Crédito de la foto: Wikimedia Commons.",
      paragraphs: [
        "Un viaje a los Pirineos también se disfruta en la mesa. La garbure (sopa tradicional), el queso de oveja, el gâteau à la broche (pastel al espetón), la tarta de los Pirineos, el cerdo negro de Bigorre, la miel, los embutidos y los productos de montaña forman parte de los placeres sencillos de la región.",
        "El mercado de Arreau es una buena ocasión para preparar una comida con productos locales que disfrutar en La Maison Verte o llevarse especialidades para compartir después de un día de actividades.",
      ],
    },
  ],
  events: [
    "Festival gratuito dedicado al vuelo libre en Loudenvielle: parapente, ala delta, cometas, exhibiciones, competiciones, conciertos y actividades.",
    "Gran cita de BTT en Loudenvielle-Peyragudes, con Copa del Mundo UCI, descenso, enduro, expositores y ambiente festivo.",
    "Uno de los grandes ultratrails de los Pirineos, con varias distancias y recorridos destacados por los Altos Pirineos.",
    "Tres días de trail de montaña en Saint-Lary, con distintas distancias en pleno valle de Aure.",
    "Triatlón en Loudenvielle-Génos: natación en el lago, ciclismo por los puertos y carrera a pie en un entorno de montaña.",
  ],
  linkGroups: [
    {category: "Senderismo, paseos y patrimonio de Arreau", labels: ["Mapa oficial de senderismo de Arreau", "Los rincones de Arreau", "Patrimonio arquitectónico de Arreau", "Musée des Cagots", "Iglesias protegidas de los valles", "Mediateca de Arreau", "Ayuntamiento de Arreau"]},
    {category: "Oficinas de turismo, estaciones y agenda", labels: ["Pyrénées2Vallées", "Agenda del valle de Louron", "Turismo Saint-Lary", "Peyragudes", "Piau-Engaly", "Val Louron", "Espacio Nórdico Piau-Pineta", "Nistos Cap Nestès"]},
    {category: "Ciclismo, BTT, trail y eventos deportivos", labels: ["Louron Bike & Trail", "Pyrénées Bike Festival", "Grand Raid des Pyrénées", "Patou Trail Saint-Lary", "BalnéaMan Triathlon"]},
    {category: "Parapente, barranquismo y aventura", labels: ["PLAF – Pyrénées Louron Air Festival", "Vía ferrata de Camous", "Parque de Aventura de Moudang", "N’Co Park Aventure", "Pesca en los Altos Pirineos"]},
    {category: "Bienestar, cuevas y piedemonte", labels: ["Balnéa", "Sensoria Saint-Lary", "Sima de Esparros", "Cuevas de Gargas", "Pequeña Amazonia de los Pirineos", "Mármol de Sarrancolin"]},
  ],
};

// On ne réécrit ni les URL, ni les crédits iconographiques, ni les noms propres
// utilisés comme clés : seul le texte affiché est remplacé.
export function getGuideCopy(language) {
  const lang = normalizeGuestLanguage(language);
  return lang === "en" ? en : lang === "es" ? es : null;
}

export function localizeGuideRecords(records, translatedRecords, fields) {
  if (!translatedRecords) return records;
  if (!Array.isArray(records) || records.length !== translatedRecords.length) {
    throw new Error("Guide translations do not match their French source records");
  }
  return records.map((record, index) => {
    const translated = translatedRecords[index];
    const result = { ...record };
    for (const field of fields) {
      if (translated[field] !== undefined) result[field] = translated[field];
    }
    return result;
  });
}

export function localizeGuideLinks(groups, translatedGroups) {
  if (!translatedGroups) return groups;
  if (groups.length !== translatedGroups.length) throw new Error("Guide link groups translation count mismatch");
  return groups.map((group, index) => {
    const translated = translatedGroups[index];
    if (group.links.length !== translated.labels.length) throw new Error("Guide link translation count mismatch");
    return {
      ...group,
      category: translated.category,
      links: group.links.map(([label, url], linkIndex) => [translated.labels[linkIndex] || label, url]),
    };
  });
}
