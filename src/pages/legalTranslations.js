// Traductions informatives fondées sur les pages FR du dossier travail (27 octobre 2026).
// Elles ne remplacent pas le contrat de location français signé.
export const LEGAL_COPY = {
  en: {
    back: "Back to the website", source: "French source", updated: "Last updated: October 2026",
    mentions: {
      title: "Legal notice", description: "Legal notice for the official La Maison Verte website in Arreau.",
      intro: "This is the official website of La Maison Verte, a holiday rental property in Arreau, in the Hautes-Pyrénées region of France.",
      sections: [
        { heading: "Website publisher", details: [
          ["Person responsible for publication", "Raphaël BENOIT"], ["Trading name", "La Maison Verte"],
          ["Property address", "3 Impasse Trassens, 65240 Arreau, France"],
          ["Email", "lamaisonverte65@gmail.com", "mailto:lamaisonverte65@gmail.com"],
          ["Telephone", "+33 6 95 93 83 15", "tel:+33695938315"],
        ] },
        { heading: "Hosting", paragraphs: ["This website is hosted by:"], details: [
          ["Provider", "Netlify, Inc."], ["Address", "101 2nd Street, San Francisco, CA 94105, United States"],
          ["Website", "netlify.com", "https://www.netlify.com/"],
        ] },
        { heading: "Intellectual property", paragraphs: ["The texts, photographs, illustrations, graphics, logos and other content on this website are protected by copyright. Any reproduction, representation, modification or distribution, in whole or in part, without prior permission is prohibited."] },
        { heading: "Liability", paragraphs: ["The information on this website is provided for guidance and may be changed at any time. La Maison Verte endeavours to ensure the accuracy of published information but cannot be held liable for errors, omissions or temporary unavailability of the website."] },
        { heading: "External links", paragraphs: ["The website may contain links to third-party sites, such as mapping services, review platforms, tourism offices and local providers. La Maison Verte does not control these websites and cannot be held responsible for their content or privacy policies."] },
        { heading: "Contractual documents", paragraphs: [{ before: "The rental agreement and booking terms and conditions are available here: ", text: "rental agreement and booking terms", href: "/documents/contrat-location-en.pdf", after: "." }] },
      ],
    },
    privacy: {
      title: "Privacy policy", description: "Privacy policy and GDPR information for the La Maison Verte website in Arreau.",
      intro: "This policy explains how personal data is collected and used through the official La Maison Verte website.",
      sections: [
        { heading: "Data controller", paragraphs: [{ before: "The data controller is Raphaël BENOIT, for La Maison Verte. Contact: ", text: "lamaisonverte65@gmail.com", href: "mailto:lamaisonverte65@gmail.com", after: "." }] },
        { heading: "Data collected", paragraphs: ["The following data may be collected:"], items: [
          "Last name, first name, email address and telephone number;",
          "The booker's postal address (street, postcode, city and country);",
          "Contact details and optional information about additional contacts supplied by the booker;",
          "The chosen language for communications relating to the stay;",
          "Requested stay dates, number of guests and, where applicable, children's ages;",
          "A free-text message submitted with a booking enquiry;",
          "Preferences relating to the stay, such as a request for a travel cot;",
          "Any consent to receive news or offers;",
          "Guest reviews submitted through the website;",
          "Limited technical visit data used for internal website statistics.",
        ] },
        { heading: "Purposes", paragraphs: ["This data is used to:"], items: [
          "Respond to booking enquiries;", "Prepare, manage and follow up stays;", "Send booking-related emails;",
          "Manage secure payments and administrative follow-up;", "Publish guest reviews only with consent;",
          "Occasionally send news or offers only with consent;", "Measure website traffic and improve its operation.",
        ] },
        { heading: "Legal bases", paragraphs: ["Depending on the circumstances, processing is based on pre-contractual steps or performance of a contract, legitimate interests in managing the website and bookings, compliance with legal obligations, or consent where requested."] },
        { heading: "Recipients and service providers", paragraphs: ["Data is intended for La Maison Verte. It may be processed by technical service providers needed to operate the website and bookings, including website hosting, the database, email delivery and secure payment services. The website uses Netlify, Supabase, Resend and Stripe, among others."] },
        { heading: "Retention period", paragraphs: ["Data relating to enquiries and bookings is kept for as long as necessary to manage a stay, then archived for the period required for administrative, accounting or legal follow-up. Data used to send news or offers is retained until consent is withdrawn. Published guest reviews may remain visible until the guest requests removal."] },
        { heading: "Cookies and statistics", paragraphs: ["For internal website statistics, the site currently records page views, not unique visitor counts. A visitor identifier and a session identifier are stored only for the browsing session. Each page view may include the page path, device type, the language reported by the browser and the visit source (referring website domain or the « utm_source » campaign source). Information entered into forms is not collected for these statistics. The current tracker no longer records clicks, scrolling, sections viewed, time spent on pages or form starts. Events collected before this simplification remain in the technical history. La Maison Verte does not use advertising tracking."] },
        { heading: "External services", paragraphs: ["Some links may open external services, such as Google Maps, Google Reviews, Booking.com, Airbnb or tourism websites. These services have their own privacy policies."] },
        { heading: "Your rights", paragraphs: [
          "You may request access to your personal data, rectification, erasure, restriction of processing, or object to certain processing where permitted by law. You may withdraw your consent to optional communications at any time.",
          { before: "To exercise your rights, contact us at: ", text: "lamaisonverte65@gmail.com", href: "mailto:lamaisonverte65@gmail.com", after: "." },
          { before: "You may also lodge a complaint with the French data protection authority (CNIL): ", text: "cnil.fr", href: "https://www.cnil.fr/", after: "." },
        ] },
      ],
    },
  },
  es: {
    back: "Volver al sitio web", source: "Original en francés", updated: "Última actualización: octubre de 2026",
    mentions: {
      title: "Aviso legal", description: "Aviso legal del sitio web oficial de La Maison Verte en Arreau.",
      intro: "Este es el sitio web oficial de La Maison Verte, un alojamiento de alquiler vacacional situado en Arreau, en los Altos Pirineos (Francia).",
      sections: [
        { heading: "Editor del sitio web", details: [
          ["Responsable de la publicación", "Raphaël BENOIT"], ["Nombre comercial", "La Maison Verte"],
          ["Dirección del alojamiento", "3 Impasse Trassens, 65240 Arreau, Francia"],
          ["Correo electrónico", "lamaisonverte65@gmail.com", "mailto:lamaisonverte65@gmail.com"],
          ["Teléfono", "+33 6 95 93 83 15", "tel:+33695938315"],
        ] },
        { heading: "Alojamiento web", paragraphs: ["El sitio web está alojado por:"], details: [
          ["Proveedor", "Netlify, Inc."], ["Dirección", "101 2nd Street, San Francisco, CA 94105, Estados Unidos"],
          ["Sitio web", "netlify.com", "https://www.netlify.com/"],
        ] },
        { heading: "Propiedad intelectual", paragraphs: ["Los textos, fotografías, ilustraciones, elementos gráficos, logotipos y demás contenidos del sitio están protegidos por derechos de autor. Queda prohibida su reproducción, representación, modificación o difusión, total o parcial, sin autorización previa."] },
        { heading: "Responsabilidad", paragraphs: ["La información publicada en el sitio se ofrece a título informativo y puede modificarse en cualquier momento. La Maison Verte procura garantizar la exactitud de los datos publicados, pero no se hace responsable de errores, omisiones o indisponibilidades temporales del sitio."] },
        { heading: "Enlaces externos", paragraphs: ["El sitio web puede contener enlaces a páginas de terceros, como servicios de mapas, plataformas de reseñas, oficinas de turismo o proveedores locales. La Maison Verte no controla esas páginas y no se hace responsable de sus contenidos ni de sus políticas de privacidad."] },
        { heading: "Documentos contractuales", paragraphs: [{ before: "El contrato de alquiler y las condiciones generales de reserva están disponibles aquí: ", text: "contrato de alquiler y condiciones de reserva", href: "/documents/contrat-location-es.pdf", after: "." }] },
      ],
    },
    privacy: {
      title: "Política de privacidad", description: "Política de privacidad e información sobre el RGPD del sitio web de La Maison Verte en Arreau.",
      intro: "Esta política explica cómo se recopilan y utilizan los datos personales a través del sitio web oficial de La Maison Verte.",
      sections: [
        { heading: "Responsable del tratamiento", paragraphs: [{ before: "El responsable del tratamiento es Raphaël BENOIT, para La Maison Verte. Contacto: ", text: "lamaisonverte65@gmail.com", href: "mailto:lamaisonverte65@gmail.com", after: "." }] },
        { heading: "Datos recopilados", paragraphs: ["Pueden recopilarse los siguientes datos:"], items: [
          "Apellidos, nombre, dirección de correo electrónico y número de teléfono;",
          "Dirección postal de quien realiza la reserva (calle, código postal, ciudad y país);",
          "Datos de contacto e información opcional de los contactos adicionales indicados por quien realiza la reserva;",
          "Idioma elegido para las comunicaciones relacionadas con la estancia;",
          "Fechas de estancia solicitadas, número de huéspedes y, en su caso, edades de los menores;",
          "Mensaje libre enviado con la solicitud de reserva;", "Preferencias de la estancia, como la solicitud de una cuna de viaje;",
          "Posible consentimiento para recibir noticias u ofertas;", "Reseñas enviadas por huéspedes a través del sitio web;",
          "Datos técnicos limitados de visitas necesarios para las estadísticas internas del sitio.",
        ] },
        { heading: "Finalidades", paragraphs: ["Estos datos se utilizan para:"], items: [
          "Responder a las solicitudes de reserva;", "Preparar, gestionar y hacer seguimiento de las estancias;",
          "Enviar correos electrónicos relacionados con las reservas;", "Gestionar los pagos seguros y el seguimiento administrativo;",
          "Publicar reseñas de huéspedes únicamente con consentimiento;", "Enviar ocasionalmente noticias u ofertas solo con consentimiento;",
          "Medir las visitas al sitio y mejorar su funcionamiento.",
        ] },
        { heading: "Bases jurídicas", paragraphs: ["Según el caso, los tratamientos se basan en medidas precontractuales o en la ejecución de un contrato, el interés legítimo en la gestión del sitio y las reservas, el cumplimiento de obligaciones legales o el consentimiento cuando se solicite."] },
        { heading: "Destinatarios y proveedores", paragraphs: ["Los datos están destinados a La Maison Verte. Pueden ser tratados por proveedores técnicos necesarios para el funcionamiento del sitio y de las reservas, como los servicios de alojamiento web, base de datos, envío de correos electrónicos y pagos seguros. El sitio utiliza, entre otros, Netlify, Supabase, Resend y Stripe."] },
        { heading: "Plazo de conservación", paragraphs: ["Los datos relativos a solicitudes y reservas se conservan durante el tiempo necesario para gestionar la estancia y después se archivan durante el período requerido para el seguimiento administrativo, contable o jurídico. Los datos usados para enviar noticias u ofertas se conservan hasta la retirada del consentimiento. Las reseñas publicadas pueden permanecer visibles hasta que el huésped solicite su retirada."] },
        { heading: "Cookies y estadísticas", paragraphs: ["Para las estadísticas internas del sitio, actualmente se registran las páginas vistas, no el número de visitantes únicos. Durante la sesión de navegación se guardan un identificador de visitante y otro de sesión; ambos se limitan a esa sesión. Cada página vista puede incluir la ruta de la página, el tipo de dispositivo, el idioma indicado por el navegador y la procedencia de la visita (dominio del sitio de referencia o fuente de campaña « utm_source »). Los datos introducidos en los formularios no se recopilan para estas estadísticas. El seguimiento actual ya no registra clics, desplazamientos, secciones consultadas, tiempo de lectura ni inicios de formularios. Los eventos recopilados antes de esta simplificación permanecen en el historial técnico. La Maison Verte no realiza seguimiento publicitario."] },
        { heading: "Servicios externos", paragraphs: ["Algunos enlaces pueden abrir servicios externos, como Google Maps, Google Reseñas, Booking.com, Airbnb o sitios turísticos. Estos servicios tienen sus propias políticas de privacidad."] },
        { heading: "Sus derechos", paragraphs: [
          "Puede solicitar el acceso a sus datos, su rectificación, supresión o la limitación del tratamiento, así como oponerse a ciertos tratamientos cuando la ley lo permita. También puede retirar en cualquier momento su consentimiento a las comunicaciones opcionales.",
          { before: "Para ejercer sus derechos, contacte con nosotros en: ", text: "lamaisonverte65@gmail.com", href: "mailto:lamaisonverte65@gmail.com", after: "." },
          { before: "También puede presentar una reclamación ante la autoridad francesa de protección de datos (CNIL): ", text: "cnil.fr", href: "https://www.cnil.fr/", after: "." },
        ] },
      ],
    },
  },
};
