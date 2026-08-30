import { styles } from "./calendarStyles";
import { formatDate, formatMoney } from "./calendarHelpers";

const RESERVATION_ACTIONS = ["personal", "site", "booking", "airbnb"];

function getActionLabel(action) {
  if (action === "block") return "Bloquer les dates";
  if (action === "personal") return "Réservation personnelle";
  if (action === "site") return "Réservation client / site";
  if (action === "booking") return "Réservation Booking";
  if (action === "airbnb") return "Réservation Airbnb";
  if (action === "price") return "Changer les tarifs de cette période";
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
  const needsCustomer = ["site", "booking", "airbnb"].includes(form.action);
  const isSiteReservation = form.action === "site";
  const isPersonalReservation = form.action === "personal";
  const totalNumber = Number(String(form.total || "0").replace(",", "."));
  const needsPaymentEmail = isSiteReservation && totalNumber > 0 && form.sendPaymentLink;

  function updateAction(nextAction) {
    const next = {
      ...form,
      action: nextAction,
      total: nextAction === "site" ? String(total || 0) : "0",
      amountPaid: "0",
      sendPaymentLink: nextAction === "site",
    };

    if (nextAction === "personal") {
      next.customerId = "";
      next.customerSearch = "";
      next.customerSource = "";
      next.marketingConsent = false;
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
          <h4 style={styles.panelSubtitle || undefined}>Dates du séjour</h4>
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

      <label style={styles.label}>Action
        <select style={styles.input} value={form.action} onChange={(event) => updateAction(event.target.value)}>
          {mode !== "edit" && <option value="block">{getActionLabel("block")}</option>}
          <option value="personal">{getActionLabel("personal")}</option>
          <option value="site">{getActionLabel("site")}</option>
          <option value="booking">{getActionLabel("booking")}</option>
          <option value="airbnb">{getActionLabel("airbnb")}</option>
          {mode !== "edit" && <option value="price">{getActionLabel("price")}</option>}
        </select>
      </label>

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
              <input
                style={styles.input}
                placeholder="Nom affiché dans le calendrier * (ex : Famille Benoit, Amis de Toulouse)"
                value={form.displayName}
                onChange={(event) => setForm({ ...form, displayName: event.target.value })}
              />
              <textarea
                style={styles.textarea}
                placeholder="Notes admin / informations utiles visibles par le ménage"
                value={form.housekeepingNotes || ""}
                onChange={(event) => setForm({ ...form, housekeepingNotes: event.target.value })}
              />
              <textarea
                style={styles.textarea}
                placeholder="Message ou réponse du propriétaire au client"
                value={form.internalNotes}
                onChange={(event) => setForm({ ...form, internalNotes: event.target.value })}
              />
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
                  <p style={styles.muted}>Prix théorique selon les tarifs actuels : <strong>{formatMoney(total)}</strong></p>
                  <input
                    style={styles.input}
                    placeholder="Montant du séjour (€)"
                    value={form.total}
                    onChange={(event) => setForm({ ...form, total: event.target.value })}
                  />
                  <label style={styles.checkboxLine}>
                    <input type="checkbox" checked={Boolean(form.sendPaymentLink)} onChange={(event) => setForm({ ...form, sendPaymentLink: event.target.checked })} />
                    Envoyer le lien Stripe après création
                  </label>
                  {needsPaymentEmail && !form.email && (
                    <p style={styles.muted}>Un email est obligatoire pour envoyer le lien Stripe.</p>
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

      {form.action === "price" && (
        <div style={styles.formGrid}>
          <p style={styles.muted}>Prix théorique selon les tarifs actuels : <strong>{formatMoney(total)}</strong></p>
          <input style={styles.input} placeholder="Nom du tarif" value={form.priceLabel} onChange={(event) => setForm({ ...form, priceLabel: event.target.value })} />
          <input style={styles.input} placeholder="Prix par nuit (€)" value={form.nightPrice} onChange={(event) => setForm({ ...form, nightPrice: event.target.value })} />
          <select style={styles.input} value={form.priceReason} onChange={(event) => setForm({ ...form, priceReason: event.target.value })}>
            <option value="ajustement">Ajustement</option>
            <option value="promo">Promo</option>
            <option value="vacances">Vacances</option>
            <option value="pont">Pont / week-end spécial</option>
            <option value="evenement">Événement</option>
          </select>
          <textarea style={styles.textarea} placeholder="Notes" value={form.priceNotes} onChange={(event) => setForm({ ...form, priceNotes: event.target.value })} />
        </div>
      )}

      <button style={styles.primaryButton} type="submit">{mode === "edit" ? "Enregistrer les modifications" : "Valider"}</button>
    </form>
  );
}
