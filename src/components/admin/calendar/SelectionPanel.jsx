import { useEffect, useState } from "react";
import { supabase } from "../../../supabaseClient";
import { styles } from "./calendarStyles";
import { formatDate, formatMoney, nightsBetween } from "./calendarHelpers";

const RESERVATION_ACTIONS = ["personal", "site", "booking", "airbnb"];

function getActionLabel(action) {
  if (action === "block") return "Bloquer les dates";
  if (action === "personal") return "Réservation personnelle";
  if (action === "site") return "Réservation client / site";
  if (action === "booking") return "Réservation Booking";
  if (action === "airbnb") return "Réservation Airbnb";
  return action;
}

function getCustomerName(customer = {}) {
  return [customer.last_name, customer.first_name].filter(Boolean).join(" ") || "Client sans nom";
}

function getCustomerDetails(customer = {}) {
  return [customer.phone, customer.email, customer.source].filter(Boolean).join(" · ");
}

export default function SelectionPanel({ selection, form, setForm, total, customers = [], onClose, onSubmit, mode = "create", editingReservation = null }) {
  const selectedCustomer = customers.find((customer) => String(customer.id) === String(form.customerId));
  const search = String(form.customerSearch || "").toLowerCase().trim();

  const filteredCustomers = search.length < 2
    ? []
    : customers
        .filter((customer) => {
          return [
            customer.first_name,
            customer.last_name,
            customer.email,
            customer.phone,
            customer.source,
            customer.notes,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(search);
        })
        .slice(0, 8);

  const isReservationAction = RESERVATION_ACTIONS.includes(form.action);
  const isSiteReservation = form.action === "site";
  const isPersonalReservation = form.action === "personal";
  const isV410Edit = mode === "edit" && isSiteReservation
    && editingReservation?.contract_total != null
    && editingReservation?.deposit_rate != null
    && editingReservation?.deposit_basis != null
    && editingReservation?.deposit_amount != null;
  const needsPaymentEmail = isSiteReservation && form.paymentMethod !== "cash" && form.sendPaymentLink;
  const nights = nightsBetween(form.startDate || selection.startStr, form.endDate || selection.endStr);
  const validDates = Boolean(nights.length && (form.endDate || selection.endStr) > (form.startDate || selection.startStr));
  const [quote, setQuote] = useState(null);
  const [quoteState, setQuoteState] = useState("idle");
  const [quoteError, setQuoteError] = useState("");

  useEffect(() => {
    if (!isSiteReservation || mode === "edit") {
      setQuote(null);
      setQuoteState("idle");
      return;
    }
    const adults = Number(form.adults || 0);
    const children = Number(form.children || 0);
    if (!validDates || !Number.isInteger(adults) || adults < 1 || !Number.isInteger(children) || children < 0 || adults + children > 4) {
      setQuote(null);
      setQuoteState("needs_guests");
      return;
    }
    const controller = new AbortController();
    setQuote(null);
    setQuoteState("loading");
    setQuoteError("");
    const timer = setTimeout(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch("/.netlify/functions/admin-booking-quote", {
          method: "POST", signal: controller.signal,
          headers: { "Content-Type": "application/json", ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
          body: JSON.stringify({
            startDate: form.startDate || selection.startStr,
            endDate: form.endDate || selection.endStr,
            adultsCount: adults, childrenCount: children,
            cleaningOption: form.cleaningOption !== false,
            promotionCode: form.promotionCode || "",
            specialAccommodation: form.total === "" ? null : form.total,
          }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Devis non disponible");
        if (!controller.signal.aborted) { setQuote(result); setQuoteState("ready"); }
      } catch (error) {
        if (!controller.signal.aborted) { setQuote(null); setQuoteState("error"); setQuoteError(error.message); }
      }
    }, 220);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [isSiteReservation, mode, form.startDate, form.endDate, form.adults, form.children, form.cleaningOption, form.promotionCode, form.total, selection.startStr, selection.endStr]);


  function updateAction(nextAction) {
    const next = {
      ...form,
      action: nextAction,
      total: "",
      amountPaid: "0",
      sendPaymentLink: nextAction === "site",
      paymentMethod: nextAction === "site" ? "stripe" : "none",
      sendInfoEmail: nextAction === "site",
    };

    if (nextAction === "personal") {
      next.customerId = "";
      next.customerSearch = "";
      next.customerSource = "";
      next.marketingConsent = false;
      next.sendInfoEmail = false;
    }

    if (["booking", "airbnb"].includes(nextAction)) {
      next.total = "0";
      next.amountPaid = "0";
      next.sendPaymentLink = false;
      next.customerSource = nextAction;
    }

    if (nextAction === "site" && !next.customerSource) {
      next.customerSource = "site";
    }

    setForm(next);
  }

  function selectCustomer(customer) {
    setForm({
      ...form,
      customerId: customer?.id || "",
      customerSearch: getCustomerName(customer),
      firstName: customer?.first_name || "",
      lastName: customer?.last_name || "",
      phone: customer?.phone || "",
      email: customer?.email || "",
      customerNotes: customer?.notes || "",
      customerSource: customer?.source || form.customerSource || form.action,
      marketingConsent: Boolean(customer?.marketing_consent),
    });
  }

  function clearSelectedCustomer() {
    setForm({
      ...form,
      customerId: "",
      customerSearch: "",
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      customerNotes: "",
      customerSource: form.action === "site" ? "site" : form.action,
      marketingConsent: false,
    });
  }

  return (
    <form onSubmit={(event) => {
      if (mode !== "edit" && isSiteReservation && quoteState !== "ready") {
        event.preventDefault();
        window.alert("Attends le devis détaillé (nuits, ménage et taxe) avant de créer la réservation.");
        return;
      }
      if (mode === "edit") {
        const ok = window.confirm("Attention : vous allez modifier une réservation existante. Les dates, les informations client, les messages et les notes visibles par le ménage peuvent être mis à jour. Continuer ?");
        if (!ok) {
          event.preventDefault();
          return;
        }
      }
      onSubmit(event);
    }}>
      <button type="button" style={styles.closePanelButton} onClick={onClose}>Fermer</button>

      <h3>{mode === "edit" ? "Modifier la réservation" : "Période sélectionnée"}</h3>
      <p style={styles.muted}>{formatDate(form.startDate || selection.startStr)} → {formatDate(form.endDate || selection.endStr)}</p>

      {isReservationAction && (
        <div style={styles.formGrid}>
          <h4 style={styles.panelSubtitle || undefined}>Dates du séjour {validDates ? `· ${nights.length} nuit${nights.length > 1 ? "s" : ""}` : "· dates à vérifier"}</h4>
          <label style={styles.label}>Arrivée
            <input
              type="date"
              style={styles.input}
              value={form.startDate || selection.startStr}
              onChange={(event) => setForm({ ...form, startDate: event.target.value })}
            />
          </label>
          <label style={styles.label}>Départ
            <input
              type="date"
              style={styles.input}
              value={form.endDate || selection.endStr}
              onChange={(event) => setForm({ ...form, endDate: event.target.value })}
            />
          </label>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <label style={{ ...styles.label, flex: 1 }}>Action
        <select style={styles.input} value={form.action} onChange={(event) => updateAction(event.target.value)}>
          {mode !== "edit" && <option value="block">{getActionLabel("block")}</option>}
          <option value="personal">{getActionLabel("personal")}</option>
          <option value="site">{getActionLabel("site")}</option>
          <option value="booking">{getActionLabel("booking")}</option>
          <option value="airbnb">{getActionLabel("airbnb")}</option>
        </select>
        </label>
        <details style={{ position: "relative", alignSelf: "center" }}>
          <summary title="Explication des actions" aria-label="Explication des actions" style={{ display: "inline-flex", width: 28, height: 28, alignItems: "center", justifyContent: "center", borderRadius: "50%", border: "1px solid #94a3b8", color: "#334155", fontWeight: 700, cursor: "pointer", listStyle: "none" }}>i</summary>
          <div style={{ position: "absolute", zIndex: 12, right: 0, width: 285, padding: 12, background: "white", border: "1px solid #cbd5e1", borderRadius: 10, boxShadow: "0 8px 18px #0002", fontSize: "0.8rem" }}>
            <p><b>Bloquer :</b> indisponibilité, sans client ni paiement.</p>
            <p><b>Personnelle :</b> usage privé, coordonnées et emails facultatifs, sans facturation automatique.</p>
            <p><b>Client / site :</b> tarif, ménage, taxe et paiement Stripe ou espèces.</p>
            <p><b>Booking / Airbnb :</b> enregistrement administratif, paiements sur la plateforme.</p>
            <p>Les règles tarifaires se gèrent dans l'onglet Tarifs.</p>
          </div>
        </details>
      </div>

      {form.action === "block" && (
        <>
          <input style={styles.input} placeholder="Titre" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          <textarea style={styles.textarea} placeholder="Notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
        </>
      )}

      {isReservationAction && (
        <div style={styles.formGrid}>
          {isPersonalReservation ? (
            <>
              <h4 style={styles.panelSubtitle || undefined}>Réservation personnelle</h4>
              <input style={styles.input} placeholder="Nom sur le calendrier (facultatif)" value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} />
              <input style={styles.input} placeholder="Prénom (facultatif)" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} />
              <input style={styles.input} placeholder="Nom (facultatif)" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} />
              <input style={styles.input} placeholder="Téléphone (facultatif)" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
              <input style={styles.input} type="email" placeholder="Email (facultatif)" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              <input style={styles.input} placeholder="Adultes" value={form.adults} onChange={(event) => setForm({ ...form, adults: event.target.value })} />
              <input style={styles.input} placeholder="Enfants" value={form.children} onChange={(event) => setForm({ ...form, children: event.target.value })} />
              <label style={styles.checkboxLine}><input type="checkbox" checked={Boolean(form.babyBedNeeded)} onChange={(event) => setForm({ ...form, babyBedNeeded: event.target.checked })} />Lit bébé demandé</label>
              <input style={styles.input} placeholder="Heure d’arrivée (facultatif)" value={form.arrivalTime} onChange={(event) => setForm({ ...form, arrivalTime: event.target.value })} />
              <textarea style={styles.textarea} placeholder="Message client (facultatif)" value={form.clientMessage} onChange={(event) => setForm({ ...form, clientMessage: event.target.value })} />
              <textarea style={styles.textarea} placeholder="Notes ménage (facultatif)" value={form.housekeepingNotes || ""} onChange={(event) => setForm({ ...form, housekeepingNotes: event.target.value })} />
              <textarea style={styles.textarea} placeholder="Notes propriétaire (facultatif)" value={form.internalNotes} onChange={(event) => setForm({ ...form, internalNotes: event.target.value })} />
              <label style={styles.checkboxLine}><input type="checkbox" disabled={!form.email} checked={Boolean(form.sendInfoEmail) && Boolean(form.email)} onChange={(event) => setForm({ ...form, sendInfoEmail: event.target.checked })} />Emails de confirmation, d’arrivée J-2 et demande d’avis</label>
              {!form.email && <p style={styles.muted}>Sans email, la réservation est créée normalement et aucun envoi n’est programmé.</p>}
            </>
          ) : (
            <>
              <h4 style={styles.panelSubtitle || undefined}>Fiche client</h4>

              {selectedCustomer ? (
                <div style={{ border: "1px solid #bbf7d0", background: "#f0fdf4", borderRadius: "14px", padding: "12px" }}>
                  <strong>✓ Client sélectionné</strong>
                  <p style={styles.muted}>{getCustomerName(selectedCustomer)}</p>
                  {getCustomerDetails(selectedCustomer) && <p style={styles.muted}>{getCustomerDetails(selectedCustomer)}</p>}
                  <button type="button" style={styles.smallButton || styles.closePanelButton} onClick={clearSelectedCustomer}>Changer de client</button>
                </div>
              ) : (
                <div style={{ position: "relative" }}>
                  <input
                    style={styles.input}
                    placeholder="Rechercher un client (nom, prénom, téléphone, email)..."
                    value={form.customerSearch}
                    onChange={(event) => setForm({ ...form, customerSearch: event.target.value, customerId: "" })}
                    autoComplete="off"
                  />
                  {form.customerSearch && String(form.customerSearch).trim().length < 2 && (
                    <p style={styles.muted}>Tape au moins 2 caractères pour afficher les clients correspondants.</p>
                  )}
                  {filteredCustomers.length > 0 && (
                    <div style={{ border: "1px solid #d1d5db", borderRadius: "14px", background: "white", boxShadow: "0 12px 28px rgba(15,23,42,0.14)", overflow: "hidden", marginTop: "6px", zIndex: 5 }}>
                      {filteredCustomers.map((customer) => (
                        <button
                          key={customer.id}
                          type="button"
                          onClick={() => selectCustomer(customer)}
                          style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px", background: "white", border: "0", borderBottom: "1px solid #e5e7eb", cursor: "pointer" }}
                        >
                          <strong>{getCustomerName(customer)}</strong>
                          {getCustomerDetails(customer) && <div style={{ color: "#64748b", fontSize: "0.9rem", marginTop: "2px" }}>{getCustomerDetails(customer)}</div>}
                        </button>
                      ))}
                    </div>
                  )}
                  {search.length >= 2 && filteredCustomers.length === 0 && (
                    <p style={styles.muted}>Aucun client trouvé : continue à remplir les champs pour créer une nouvelle fiche.</p>
                  )}
                </div>
              )}

              <input style={styles.input} placeholder="Prénom *" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} />
              <input style={styles.input} placeholder="Nom *" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} />
              <input style={styles.input} placeholder="Téléphone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
              <input style={styles.input} placeholder={needsPaymentEmail ? "Email *" : "Email"} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              <input style={styles.input} placeholder="Source client (site, Booking, Airbnb, téléphone...)" value={form.customerSource} onChange={(event) => setForm({ ...form, customerSource: event.target.value })} />
              <label style={styles.checkboxLine}>
                <input type="checkbox" checked={Boolean(form.marketingConsent)} onChange={(event) => setForm({ ...form, marketingConsent: event.target.checked })} />
                Accord pour recevoir des nouvelles / offres futures
              </label>
              <textarea
                style={styles.textarea}
                placeholder="Notes fiche client / informations utiles"
                value={form.customerNotes}
                onChange={(event) => setForm({ ...form, customerNotes: event.target.value })}
              />

              <h4 style={styles.panelSubtitle || undefined}>Fiche réservation</h4>
              <input style={styles.input} placeholder="Adultes" value={form.adults} onChange={(event) => setForm({ ...form, adults: event.target.value })} />
              <input style={styles.input} placeholder="Enfants" value={form.children} onChange={(event) => setForm({ ...form, children: event.target.value })} />
              <label style={styles.checkboxLine}>
                <input type="checkbox" checked={Boolean(form.babyBedNeeded)} onChange={(event) => setForm({ ...form, babyBedNeeded: event.target.checked })} />
                Lit bébé demandé
              </label>
              <input style={styles.input} placeholder="Heure d'arrivée prévue (ex : 16h)" value={form.arrivalTime} onChange={(event) => setForm({ ...form, arrivalTime: event.target.value })} />
              <textarea
                style={styles.textarea}
                placeholder="Message client (demande, précision donnée par le client, échange utile)"
                value={form.clientMessage}
                onChange={(event) => setForm({ ...form, clientMessage: event.target.value })}
              />
              <textarea
                style={styles.textarea}
                placeholder="Notes admin — visibles dans le planning ménage et la fiche sommaire"
                value={form.housekeepingNotes}
                onChange={(event) => setForm({ ...form, housekeepingNotes: event.target.value })}
              />
              <textarea
                style={styles.textarea}
                placeholder="Message ou réponse du propriétaire au client"
                value={form.internalNotes}
                onChange={(event) => setForm({ ...form, internalNotes: event.target.value })}
              />

              {isSiteReservation && (
                <>
                  <h4 style={styles.panelSubtitle || undefined}>Paiement</h4>
                  {isV410Edit ? (
                    <p style={styles.muted}>Total contractuel actuel : <strong>{formatMoney(editingReservation.contract_total)}</strong>. Il sera recalculé automatiquement si les dates ou les voyageurs changent. Aucun paiement ni remboursement n'est déclenché automatiquement.</p>
                  ) : (
                    <>
                      <p style={styles.muted}>Hébergement automatique pour {nights.length} nuit{nights.length > 1 ? "s" : ""} : <strong>{formatMoney(total)}</strong> (avant ménage et taxe de séjour).</p>
                      <input
                        style={styles.input}
                        type="number" min="0" step="0.01"
                        placeholder="Tarif spécial hébergement (€) — laisser vide pour le calcul automatique"
                        value={form.total}
                        onChange={(event) => setForm({ ...form, total: event.target.value })}
                      />
                      <p style={styles.muted}>Tarif spécial facultatif. Sans saisie, le serveur applique automatiquement les tarifs des nuits sélectionnées, même si les dates sont modifiées.</p>
                      <label style={styles.checkboxLine}>
                        <input type="checkbox" checked={form.cleaningOption !== false} onChange={(event) => setForm({ ...form, cleaningOption: event.target.checked })} />
                        Ajouter le forfait ménage
                      </label>
                      <input style={styles.input} placeholder="Code promotion (optionnel)" value={form.promotionCode || ""} onChange={(event) => setForm({ ...form, promotionCode: event.target.value.toUpperCase() })} />
                      <label style={styles.label}>Mode de paiement
                        <select style={styles.input} value={form.paymentMethod || "stripe"} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value, sendPaymentLink: event.target.value === "stripe", sendInfoEmail: true })}>
                          <option value="stripe">Stripe — en ligne</option>
                          <option value="cash">Espèces — à encaisser à l'arrivée</option>
                        </select>
                      </label>
                      {form.paymentMethod !== "cash" ? (
                        <>
                          <select style={styles.input} value={form.paymentPreference || "deposit"} onChange={(event) => setForm({ ...form, paymentPreference: event.target.value })}>
                            <option value="deposit">Acompte puis solde</option>
                            <option value="full">Paiement intégral</option>
                          </select>
                          <label style={styles.checkboxLine}>
                            <input type="checkbox" checked={Boolean(form.sendPaymentLink)} onChange={(event) => setForm({ ...form, sendPaymentLink: event.target.checked })} />
                            Envoyer le lien Stripe après création
                          </label>
                        </>
                      ) : <p style={styles.muted}>Aucun lien Stripe, aucune relance d'acompte ou de solde. L'encaissement sera à enregistrer manuellement.</p>}
                      <label style={styles.checkboxLine}>
                        <input type="checkbox" checked={Boolean(form.sendInfoEmail)} disabled={!form.email} onChange={(event) => setForm({ ...form, sendInfoEmail: event.target.checked })} />
                        Confirmation et emails pratiques du séjour
                      </label>
                      {needsPaymentEmail && !form.email && <p style={styles.muted}>Un email est obligatoire pour envoyer le lien Stripe.</p>}
                      {form.paymentMethod === "cash" && !form.email && <p style={styles.muted}>Sans email, la réservation en espèces peut être créée, mais aucun email ne sera envoyé.</p>}
                      {quoteState === "loading" && <p style={styles.muted}>Calcul du devis détaillé…</p>}
                      {quoteState === "needs_guests" && <p style={styles.muted}>Indique le nombre d'adultes et d'enfants pour calculer la taxe de séjour et le total.</p>}
                      {quoteState === "error" && <p role="alert" style={{ color: "#b91c1c" }}>Devis indisponible : {quoteError}. Ne valide pas avant vérification.</p>}
                      {quoteState === "ready" && quote && (
                        <div style={{ border: "1px solid #bdd3c0", borderRadius: 12, padding: 12, background: "#f0fdf4", display: "grid", gap: 5 }} aria-live="polite">
                          <strong>Devis — {quote.nights} nuit{quote.nights > 1 ? "s" : ""}</strong>
                          <div>Hébergement : {formatMoney(quote.accommodation)}</div>
                          {quote.discount > 0 && <div>Réduction : −{formatMoney(quote.discount)}</div>}
                          <div>Ménage : {formatMoney(quote.cleaning)}</div>
                          <div>Taxe de séjour : {formatMoney(quote.touristTax)}</div>
                          <strong>Total : {formatMoney(quote.total)}</strong>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {["booking", "airbnb"].includes(form.action) && (
                <p style={styles.muted}>
                  Aucun montant n'est demandé ici : les paiements {form.action === "booking" ? "Booking" : "Airbnb"} restent gérés sur la plateforme.
                </p>
              )}
            </>
          )}
        </div>
      )}

      <button style={styles.primaryButton} type="submit">{mode === "edit" ? "Enregistrer les modifications" : "Valider"}</button>
    </form>
  );
}
