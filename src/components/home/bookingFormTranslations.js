// Textes du formulaire public uniquement. Les prix, dates, validations,
// snapshots et appels de réservation demeurent dans MaisonVerte.jsx.
import { normalizeGuestLanguage } from "../../../shared/guestLocale.js";

const copy = {
  fr: {
    title: "Réserver votre séjour",
    intro1: "Sélectionnez vos dates d'arrivée et de départ.",
    intro2: "Après acceptation de votre demande, un lien de paiement sécurisé, valable 24h, vous sera envoyé par email.",
    intro3: "Votre réservation sera confirmée après règlement de l'acompte.",
    weekdays: ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"],
    arrival: "Date d’arrivée sélectionnée", departure: "Date de départ sélectionnée",
    from: "À partir de", perNight: "/ nuit", contact: "Contact principal",
    firstName: "Votre prénom", lastName: "Votre nom", email: "Votre email", phone: "Votre téléphone",
    address: "Votre adresse", postalCode: "Code postal", city: "Ville", country: "Pays",
    optional: "(facultatif)", additional: "Contacts supplémentaires",
    additionalHelp: "Ajoutez un autre occupant ou une personne joignable pendant le séjour. Chaque contact disposera de sa propre fiche client.",
    contactNumber: "Contact {number}", removeContact: "Supprimer ce contact", addContact: "+ Ajouter un contact",
    firstNameRequired: "Prénom *", lastNameRequired: "Nom *", emailRequired: "Email *", phoneRequired: "Téléphone *",
    addressOptional: "Adresse (facultatif)", postalOptional: "Code postal (facultatif)", cityOptional: "Ville (facultatif)", countryOptional: "Pays (facultatif)",
    travellers: "Voyageurs", adults: "Adultes", children: "Enfants", babyBed: "Lit bébé / bébé à prévoir",
    cleaningOption: "Forfait ménage de fin de séjour", cleaningLoading: "(tarif en cours de chargement)",
    paymentTitle: "Paiement de la réservation",
    depositInfo: "Par défaut, un acompte de {percent} % sera demandé après acceptation de votre réservation. Le solde sera demandé 30 jours avant votre arrivée, soit dans {days} jour{plural}.",
    fullPaymentChoice: "Je préfère régler la totalité du séjour en une seule fois.",
    fullPaymentRequired: "Votre arrivée étant prévue dans 30 jours ou moins, le règlement intégral du séjour sera demandé après acceptation de votre réservation.",
    cleaningWarning: "Vous choisissez de ne pas prendre le forfait ménage de fin de séjour.",
    cleaningDuties: "Vous vous engagez à rendre le logement dans un état de propreté comparable à celui dans lequel vous l’avez trouvé à votre arrivée : sols aspirés et nettoyés si nécessaire, cuisine et équipements nettoyés, vaisselle propre et rangée, sanitaires et salle de bains nettoyés, poubelles vidées et déchets déposés dans les conteneurs prévus.",
    cleaningInspection: "Après votre départ, nous effectuons dans tous les cas un passage de contrôle et la remise en état nécessaire entre deux locations, notamment la préparation du linge et des lits. Ce contrôle permet également de vérifier le ménage effectué. Si ces obligations ne sont pas respectées ou si le ménage est manifestement insuffisant, le forfait ménage de {fee} prévu pour votre réservation pourra être facturé.",
    cleaningConsent: "J’ai pris connaissance de ces obligations et les accepte. J’accepte, dans les conditions prévues au contrat, la facturation du forfait ménage de {fee} si le ménage de fin de séjour n’est pas effectué ou est manifestement insuffisant.",
    childrenAges: "Âge des enfants : ex. 4 ans, 8 ans", childrenWarning: "Indiquez entre 1 et 4 voyageurs. Si des enfants sont présents, précisez leurs âges.",
    message: "Message optionnel : arrivée tardive, question particulière, ancien client, promo...",
    marketingConsent: "J’accepte de recevoir occasionnellement des nouvelles, offres et informations de La Maison Verte (vos données restent confidentielles).",
    contractPrefix: "J’ai lu et j’accepte le", contractLink: "contrat de location", contractTerms: "et les conditions générales", contractEnd: "de réservation",
    contractFrenchNotice: "", bookletTitle: "Préparer votre séjour", bookletLink: "Consulter le livret d’accueil",
    loyaltyCode: "Code fidélité", loyaltyPlaceholder: "VOTRE CODE ICI", loyaltyApplied: "Code {code} appliqué : -{amount} sur l’hébergement.", loyaltyNotApplied: "Ce code n’est pas applicable à cette demande.",
    stayLine: "Séjour x {nights} nuits", discount: "Remise {code}", tax: "Taxe de séjour", cleaningFee: "Forfait ménage", total: "Total", totalToPay: "Total à régler", depositToPay: "Acompte à régler ({percent} %)", balance: "Solde à régler à J-30",
    fieldFirstName: "Prénom", fieldLastName: "Nom", fieldAddress: "Adresse", fieldPostalCode: "Code postal", fieldCity: "Ville", fieldCountry: "Pays",
    errorRequired: "{field} requis.", errorTooLong: "{field} trop long ({max} caractères maximum).",
    errorEmailRequired: "Adresse email requise.", errorEmailInvalid: "Adresse email invalide.",
    errorPhoneRequired: "Numéro de téléphone requis.", errorPhoneInvalid: "Numéro de téléphone invalide.",
    errorEmailDuplicate: "Adresse email déjà renseignée.", errorPhoneDuplicate: "Numéro de téléphone déjà renseigné.",
    errorStayMinimum: "Le séjour doit comporter au minimum {nights} nuits sur cette période.",
    errorChildrenAges: "Précisez l’âge des enfants.", errorGuestCount: "Indiquez entre 1 et 4 voyageurs.",
    errorContract: "Acceptez le contrat de location et les conditions générales de réservation.",
    errorUnexpected: "Une erreur inattendue est survenue. Vos informations sont conservées ; réessayez.",
    errorValidation: "Certaines informations sont invalides. Vérifiez le formulaire puis réessayez.",
    errorDateConflict: "Une réservation vient d’être enregistrée sur tout ou partie de ces dates. Merci de choisir d’autres dates.",
    errorDuplicate: "Cette demande semble avoir déjà été envoyée. Aucun nouvel envoi n’a été créé.",
    errorRateLimit: "Trop de tentatives ont été effectuées. Patientez quelques minutes avant de réessayer.",
    errorServer: "Nous n’avons pas pu confirmer l’enregistrement de votre demande. Vos informations sont conservées ; réessayez ou contactez-nous.",
    errorTimeout: "La demande prend plus de temps que prévu. Vos informations sont conservées ; vous pouvez réessayer.",
    errorNetwork: "Connexion impossible. Vos informations sont conservées ; vérifiez votre connexion puis réessayez.",
    validationTitle: "Votre demande ne peut pas encore être envoyée.", validationHelp: "Merci de compléter :",
    sendingNotice: "Demande en cours d’envoi, merci de patienter. Ne cliquez pas une deuxième fois.",
    sendingButton: "Envoi en cours...", submitButton: "Faire une demande de réservation",
    confirmationTitle: "Votre demande a bien été envoyée",
    confirmationPending: "Votre demande a bien été enregistrée. L’envoi de l’email de confirmation n’a pas pu être confirmé immédiatement. Ne renvoyez pas le formulaire et contactez-nous si vous ne recevez rien.",
    confirmationEmail: "Vous allez recevoir un email de confirmation dans quelques instants.",
    confirmationSpamTitle: "Pensez à vérifier vos courriers indésirables (spams)",
    confirmationSpamHelp: "et, si possible, à enregistrer notre adresse email dans vos contacts.",
    confirmationPayment: "Si votre demande est acceptée, le lien permettant de confirmer votre réservation par paiement sera également envoyé par email et restera valable",
    confirmationAdditionalContacts: "Votre demande est bien enregistrée. L’enregistrement d’au moins un contact supplémentaire doit être vérifié. Ne renvoyez pas le formulaire ; nous disposons des informations transmises et vous contacterons si nécessaire.",
    confirmationClose: "J’ai compris",
    selectDates: "Sélectionnez vos dates d’arrivée et de départ.", minimumStay: "Séjour minimum : {nights} nuits sur cette période.", busyPeriod: "Votre demande concerne une période de forte demande. Elle sera étudiée avant confirmation.", enterContact: "Renseignez vos coordonnées.", unavailableDates: "Cette période contient une date déjà réservée.",
  },
  en: {
    title: "Book your stay",
    intro1: "Select your arrival and departure dates.",
    intro2: "Once your request has been accepted, a secure payment link valid for 24 hours will be emailed to you.",
    intro3: "Your booking will be confirmed after the deposit has been paid.",
    weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    arrival: "Selected arrival date", departure: "Selected departure date",
    from: "From", perNight: "/ night", contact: "Main contact",
    firstName: "Your first name", lastName: "Your last name", email: "Your email", phone: "Your phone number",
    address: "Your street address", postalCode: "Postcode", city: "City", country: "Country",
    optional: "(optional)", additional: "Additional contacts",
    additionalHelp: "Add another guest or someone who can be reached during the stay. Each contact will have their own guest record.",
    contactNumber: "Contact {number}", removeContact: "Remove this contact", addContact: "+ Add a contact",
    firstNameRequired: "First name *", lastNameRequired: "Last name *", emailRequired: "Email *", phoneRequired: "Phone *",
    addressOptional: "Address (optional)", postalOptional: "Postcode (optional)", cityOptional: "City (optional)", countryOptional: "Country (optional)",
    travellers: "Guests", adults: "Adults", children: "Children", babyBed: "Travel cot / baby expected",
    cleaningOption: "End-of-stay cleaning service", cleaningLoading: "(price loading)",
    paymentTitle: "Booking payment",
    depositInfo: "By default, a {percent}% deposit will be requested after your booking is accepted. The remaining balance will be requested 30 days before arrival, in {days} day{plural}.",
    fullPaymentChoice: "I would prefer to pay the full amount in one payment.",
    fullPaymentRequired: "As your arrival is in 30 days or less, full payment will be requested once your booking is accepted.",
    cleaningWarning: "You have chosen not to purchase the end-of-stay cleaning service.",
    cleaningDuties: "You agree to leave the accommodation as clean as you found it on arrival: floors vacuumed and cleaned where necessary, kitchen and appliances cleaned, dishes washed and put away, toilets and bathroom cleaned, bins emptied and waste taken to the designated containers.",
    cleaningInspection: "After departure we always inspect and prepare the accommodation for the next guests, including the bed linen and beds. We also check the cleaning carried out. If these obligations have not been met, or cleaning is clearly insufficient, the {fee} cleaning charge specified for your booking may be invoiced.",
    cleaningConsent: "I have read and accept these obligations. Under the conditions set out in the rental agreement, I agree that the {fee} cleaning charge may be billed if end-of-stay cleaning is not carried out or is clearly insufficient.",
    childrenAges: "Children's ages: e.g. 4 years, 8 years", childrenWarning: "Enter between 1 and 4 guests. If children are travelling, enter their ages.",
    message: "Optional message: late arrival, special request, returning guest, promotion...",
    marketingConsent: "I agree to occasionally receive news, offers and updates from La Maison Verte (your data stays confidential).",
    contractPrefix: "I have read and accept the", contractLink: "rental agreement", contractTerms: "and the general booking", contractEnd: "terms and conditions",
    contractFrenchNotice: "The reference rental agreement is currently available in French.", bookletTitle: "Prepare for your stay", bookletLink: "Read the welcome booklet",
    loyaltyCode: "Loyalty code", loyaltyPlaceholder: "ENTER YOUR CODE", loyaltyApplied: "Code {code} applied: -{amount} on accommodation.", loyaltyNotApplied: "This code cannot be applied to this request.",
    stayLine: "Stay × {nights} nights", discount: "Discount {code}", tax: "Tourist tax", cleaningFee: "Cleaning service", total: "Total", totalToPay: "Total to pay", depositToPay: "Deposit due ({percent}%)", balance: "Balance due 30 days before arrival",
    fieldFirstName: "First name", fieldLastName: "Last name", fieldAddress: "Address", fieldPostalCode: "Postcode", fieldCity: "City", fieldCountry: "Country",
    errorRequired: "{field} is required.", errorTooLong: "{field} is too long (maximum {max} characters).",
    errorEmailRequired: "Email address is required.", errorEmailInvalid: "Invalid email address.",
    errorPhoneRequired: "Phone number is required.", errorPhoneInvalid: "Invalid phone number.",
    errorEmailDuplicate: "This email address has already been entered.", errorPhoneDuplicate: "This phone number has already been entered.",
    errorStayMinimum: "A minimum of {nights} nights is required for these dates.",
    errorChildrenAges: "Please enter the children's ages.", errorGuestCount: "Please enter between 1 and 4 guests.",
    errorContract: "Please accept the rental agreement and the general booking terms and conditions.",
    errorUnexpected: "An unexpected error occurred. Your details have been kept; please try again.",
    errorValidation: "Some information is invalid. Please check the form and try again.",
    errorDateConflict: "Another booking has just been recorded for some or all of these dates. Please choose different dates.",
    errorDuplicate: "This request appears to have already been submitted. No new request was created.",
    errorRateLimit: "Too many attempts. Please wait a few minutes before trying again.",
    errorServer: "We could not confirm that your request was saved. Your details have been kept; please try again or contact us.",
    errorTimeout: "Your request is taking longer than expected. Your details have been kept; you can try again.",
    errorNetwork: "Unable to connect. Your details have been kept; check your internet connection and try again.",
    validationTitle: "Your request cannot be submitted yet.", validationHelp: "Please complete the following:",
    sendingNotice: "Sending your request. Please wait and do not click again.",
    sendingButton: "Sending...", submitButton: "Send booking request",
    confirmationTitle: "Your request has been sent",
    confirmationPending: "Your request has been recorded, but we could not immediately confirm delivery of the confirmation email. Please do not submit the form again. Contact us if you do not receive an email.",
    confirmationEmail: "You will receive a confirmation email shortly.",
    confirmationSpamTitle: "Please check your junk or spam folder",
    confirmationSpamHelp: "and, if possible, add our email address to your contacts.",
    confirmationPayment: "If your request is accepted, a payment link to confirm your booking will also be emailed to you. It will remain valid for",
    confirmationAdditionalContacts: "Your request has been recorded, but at least one additional contact needs to be checked. Please do not submit the form again; we have received your details and will contact you if necessary.",
    confirmationClose: "Understood",
    selectDates: "Select your arrival and departure dates.", minimumStay: "Minimum stay: {nights} nights for these dates.", busyPeriod: "These dates are in high demand. Your request will be reviewed before confirmation.", enterContact: "Enter your contact details.", unavailableDates: "Some dates in this period are already booked.",
  },
  es: {
    title: "Reservar tu estancia",
    intro1: "Selecciona las fechas de llegada y salida.",
    intro2: "Una vez aceptada tu solicitud, recibirás por correo electrónico un enlace de pago seguro válido durante 24 horas.",
    intro3: "Tu reserva quedará confirmada después de pagar el anticipo.",
    weekdays: ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"],
    arrival: "Fecha de llegada seleccionada", departure: "Fecha de salida seleccionada",
    from: "Desde", perNight: "/ noche", contact: "Contacto principal",
    firstName: "Tu nombre", lastName: "Tus apellidos", email: "Tu correo electrónico", phone: "Tu teléfono",
    address: "Tu dirección", postalCode: "Código postal", city: "Ciudad", country: "País",
    optional: "(opcional)", additional: "Contactos adicionales",
    additionalHelp: "Añade otro huésped o una persona de contacto durante la estancia. Cada contacto tendrá su propia ficha de cliente.",
    contactNumber: "Contacto {number}", removeContact: "Eliminar este contacto", addContact: "+ Añadir un contacto",
    firstNameRequired: "Nombre *", lastNameRequired: "Apellidos *", emailRequired: "Correo electrónico *", phoneRequired: "Teléfono *",
    addressOptional: "Dirección (opcional)", postalOptional: "Código postal (opcional)", cityOptional: "Ciudad (opcional)", countryOptional: "País (opcional)",
    travellers: "Huéspedes", adults: "Adultos", children: "Niños", babyBed: "Cuna de viaje / bebé previsto",
    cleaningOption: "Servicio de limpieza al final de la estancia", cleaningLoading: "(cargando precio)",
    paymentTitle: "Pago de la reserva",
    depositInfo: "Por defecto, se solicitará un anticipo del {percent}% tras aceptar tu reserva. El saldo se solicitará 30 días antes de la llegada, es decir, dentro de {days} día{plural}.",
    fullPaymentChoice: "Prefiero pagar la estancia completa en un solo pago.",
    fullPaymentRequired: "Como tu llegada será dentro de 30 días o menos, se solicitará el pago íntegro una vez aceptada tu reserva.",
    cleaningWarning: "Has elegido no contratar el servicio de limpieza al final de la estancia.",
    cleaningDuties: "Te comprometes a dejar el alojamiento tan limpio como lo encontraste al llegar: suelos aspirados y limpiados cuando sea necesario, cocina y electrodomésticos limpios, vajilla limpia y guardada, aseos y baño limpios, papeleras vacías y residuos depositados en los contenedores previstos.",
    cleaningInspection: "Después de la salida, siempre revisamos y preparamos el alojamiento para los siguientes huéspedes, incluida la ropa de cama y la preparación de las camas. También comprobamos la limpieza realizada. Si no se cumplen estas obligaciones o la limpieza es claramente insuficiente, se podrá cobrar el suplemento de limpieza de {fee} previsto para tu reserva.",
    cleaningConsent: "He leído y acepto estas obligaciones. Acepto que, según las condiciones del contrato de alquiler, se pueda cobrar el suplemento de limpieza de {fee} si no se realiza la limpieza final o es claramente insuficiente.",
    childrenAges: "Edades de los niños: p. ej., 4 y 8 años", childrenWarning: "Indica entre 1 y 4 huéspedes. Si viajan niños, especifica sus edades.",
    message: "Mensaje opcional: llegada tardía, consulta, cliente habitual, promoción...",
    marketingConsent: "Acepto recibir ocasionalmente noticias, ofertas e información de La Maison Verte (tus datos seguirán siendo confidenciales).",
    contractPrefix: "He leído y acepto el", contractLink: "contrato de alquiler", contractTerms: "y las condiciones generales", contractEnd: "de reserva",
    contractFrenchNotice: "El contrato de referencia está disponible actualmente en francés.", bookletTitle: "Prepara tu estancia", bookletLink: "Consultar la guía de bienvenida",
    loyaltyCode: "Código de fidelidad", loyaltyPlaceholder: "INTRODUCE TU CÓDIGO", loyaltyApplied: "Código {code} aplicado: -{amount} en el alojamiento.", loyaltyNotApplied: "Este código no se puede aplicar a esta solicitud.",
    stayLine: "Estancia × {nights} noches", discount: "Descuento {code}", tax: "Tasa turística", cleaningFee: "Servicio de limpieza", total: "Total", totalToPay: "Total a pagar", depositToPay: "Anticipo a pagar ({percent}%)", balance: "Saldo a pagar 30 días antes de la llegada",
    fieldFirstName: "Nombre", fieldLastName: "Apellidos", fieldAddress: "Dirección", fieldPostalCode: "Código postal", fieldCity: "Ciudad", fieldCountry: "País",
    errorRequired: "{field}: campo obligatorio.", errorTooLong: "{field}: demasiados caracteres (máximo {max}).",
    errorEmailRequired: "El correo electrónico es obligatorio.", errorEmailInvalid: "El correo electrónico no es válido.",
    errorPhoneRequired: "El número de teléfono es obligatorio.", errorPhoneInvalid: "El número de teléfono no es válido.",
    errorEmailDuplicate: "Este correo electrónico ya se ha indicado.", errorPhoneDuplicate: "Este número de teléfono ya se ha indicado.",
    errorStayMinimum: "La estancia debe tener un mínimo de {nights} noches en estas fechas.",
    errorChildrenAges: "Indica las edades de los niños.", errorGuestCount: "Indica entre 1 y 4 huéspedes.",
    errorContract: "Acepta el contrato de alquiler y las condiciones generales de reserva.",
    errorUnexpected: "Se ha producido un error inesperado. Tus datos se han conservado; inténtalo de nuevo.",
    errorValidation: "Algunos datos no son válidos. Revisa el formulario e inténtalo de nuevo.",
    errorDateConflict: "Se acaba de registrar otra reserva en parte o en todas estas fechas. Elige otras fechas.",
    errorDuplicate: "Parece que ya has enviado esta solicitud. No se ha creado otra solicitud.",
    errorRateLimit: "Se han realizado demasiados intentos. Espera unos minutos antes de volver a intentarlo.",
    errorServer: "No hemos podido confirmar el registro de tu solicitud. Tus datos se han conservado; inténtalo de nuevo o contacta con nosotros.",
    errorTimeout: "La solicitud está tardando más de lo previsto. Tus datos se han conservado; puedes intentarlo de nuevo.",
    errorNetwork: "No se puede conectar. Tus datos se han conservado; comprueba tu conexión e inténtalo de nuevo.",
    validationTitle: "Todavía no se puede enviar tu solicitud.", validationHelp: "Por favor, completa lo siguiente:",
    sendingNotice: "Enviando tu solicitud. Espera y no vuelvas a pulsar el botón.",
    sendingButton: "Enviando...", submitButton: "Enviar solicitud de reserva",
    confirmationTitle: "Tu solicitud se ha enviado correctamente",
    confirmationPending: "Tu solicitud se ha registrado, pero no hemos podido confirmar inmediatamente el envío del correo de confirmación. No vuelvas a enviar el formulario. Contacta con nosotros si no recibes el correo.",
    confirmationEmail: "Recibirás un correo electrónico de confirmación en breve.",
    confirmationSpamTitle: "Comprueba la carpeta de correo no deseado (spam)",
    confirmationSpamHelp: "y, si es posible, añade nuestra dirección de correo a tus contactos.",
    confirmationPayment: "Si aceptamos tu solicitud, también recibirás por correo un enlace de pago para confirmar la reserva, válido durante",
    confirmationAdditionalContacts: "Tu solicitud se ha registrado, pero hay que comprobar al menos un contacto adicional. No vuelvas a enviar el formulario; tenemos tus datos y nos pondremos en contacto contigo si es necesario.",
    confirmationClose: "Entendido",
    selectDates: "Selecciona las fechas de llegada y salida.", minimumStay: "Estancia mínima: {nights} noches para estas fechas.", busyPeriod: "Estas fechas tienen mucha demanda. Tu solicitud se estudiará antes de confirmarse.", enterContact: "Introduce tus datos de contacto.", unavailableDates: "Algunas fechas de este periodo ya están reservadas.",
  },
};

export function getBookingFormCopy(language) {
  return copy[normalizeGuestLanguage(language)];
}

// Le serveur renvoie des codes stables (kind). Nous localisons uniquement
// le message présenté, sans toucher aux réponses, retries ou validations.
const failureCopyKeys = Object.freeze({
  validation: "errorValidation",
  date_conflict: "errorDateConflict",
  duplicate: "errorDuplicate",
  rate_limit: "errorRateLimit",
  server_error: "errorServer",
  timeout: "errorTimeout",
  network_error: "errorNetwork",
});

export function localizeBookingFailure(kind, language, frenchMessage = "") {
  const lang = normalizeGuestLanguage(language);
  if (lang === "fr" && frenchMessage) return frenchMessage;
  const key = failureCopyKeys[kind];
  // Un type inconnu ne doit pas afficher un message serveur en français
  // sur une page anglaise ou espagnole.
  return getBookingFormCopy(lang)[key || "errorServer"];
}

export function interpolateBookingCopy(template, values = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_match, key) => String(values[key] ?? ""));
}

// Les montants du serveur ne sont jamais recalculés par cette fonction.
// La version française conserve le format historiquement affiché.
export function formatBookingMoney(amount, language) {
  if (normalizeGuestLanguage(language) === "fr") return `${amount}€`;
  const locale = normalizeGuestLanguage(language) === "es" ? "es-ES" : "en-GB";
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(Number(amount));
}

// Les cases du calendrier sont étroites sur smartphone : prix courts sans
// perdre les centimes éventuels (ex. 95 €, mais 95,50 € si applicable).
export function formatBookingCalendarMoney(amount, language) {
  const lang = normalizeGuestLanguage(language);
  if (lang === "fr") return `${amount}€`;
  return new Intl.NumberFormat(lang === "es" ? "es-ES" : "en-GB", {
    style: "currency", currency: "EUR",
    minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(Number(amount));
}
