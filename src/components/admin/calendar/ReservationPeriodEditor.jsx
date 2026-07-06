import { useState } from "react";
import { styles } from "./calendarStyles";
import { formatDate } from "./calendarHelpers";
import { useCustomerSearch } from "../../../hooks/useCustomerSearch";

function createEmptyImportItem(sourceEvent, type = "reservation") {
  return {
    type,
    startDate: sourceEvent?.start_date || sourceEvent?.start || "",
    endDate: sourceEvent?.end_date || sourceEvent?.end || "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    adults: "",
    children: "",
    babyBedNeeded: false,
    arrivalTime: "",
    notes: "",
    total: "0",
    amountPaid: "0",
    title: "Blocage perso",
    customerId: null,
    selectedCustomer: null,
  };
}


function getCustomerDisplayName(customer = {}) {
  return [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim() || "Client sans nom";
}

function getReservationTypeLabel(type, sourceLabel) {
  if (type === "personal_reservation") return "Réservation perso / directe";
  if (type === "block") return "Blocage personnel";
  return `Réservation ${sourceLabel}`;
}

function CustomerSuggestionList({ results = [], activeIndex = 0, loading = false, onSelect }) {
  if (loading) {
    return <div style={suggestionStyles.box}><p style={suggestionStyles.empty}>Recherche client...</p></div>;
  }

  if (!results.length) return null;

  return (
    <div style={suggestionStyles.box}>
      {results.map((customer, index) => (
        <button
          key={customer.id}
          type="button"
          style={index === activeIndex ? suggestionStyles.activeItem : suggestionStyles.item}
          onMouseDown={(event) => {
            event.preventDefault();
            onSelect(customer);
          }}
        >
          {getCustomerDisplayName(customer)}
        </button>
      ))}
    </div>
  );
}

function ImportReservationFields({ item, index, updateItem }) {
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const { results, loading } = useCustomerSearch({
    firstName: item.firstName,
    lastName: item.lastName,
    minLength: 2,
  });

  const selectedName = item.selectedCustomer ? getCustomerDisplayName(item.selectedCustomer) : "";
  const showSuggestions = !item.customerId && (String(item.firstName || "").trim().length >= 2 || String(item.lastName || "").trim().length >= 2);

  function updateIdentityField(key, value) {
    const patch = { [key]: value };

    if (item.customerId) {
      const expected = key === "firstName" ? item.selectedCustomer?.first_name : item.selectedCustomer?.last_name;
      if (String(value || "").trim() !== String(expected || "").trim()) {
        patch.customerId = null;
        patch.selectedCustomer = null;
      }
    }

    updateItem(index, patch);
    setActiveSuggestionIndex(0);
  }

  function selectCustomer(customer) {
    updateItem(index, {
      customerId: customer.id,
      selectedCustomer: customer,
      firstName: customer.first_name || "",
      lastName: customer.last_name || "",
      phone: customer.phone || "",
      email: customer.email || "",
    });
    setActiveSuggestionIndex(0);
  }

  function handleSuggestionKeyDown(event) {
    if (!showSuggestions || !results.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestionIndex((current) => Math.min(current + 1, results.length - 1));
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestionIndex((current) => Math.max(current - 1, 0));
    }

    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      selectCustomer(results[activeSuggestionIndex] || results[0]);
    }
  }

  return (
    <>
      <div style={styles.formGridTwoCols}>
        <label style={{ ...styles.label, position: "relative" }}>
          Prénom
          <input
            style={styles.input}
            placeholder="Prénom"
            value={item.firstName}
            onChange={(changeEvent) => updateIdentityField("firstName", changeEvent.target.value)}
            onKeyDown={handleSuggestionKeyDown}
            autoComplete="off"
          />
          {showSuggestions && (
            <CustomerSuggestionList
              results={results}
              activeIndex={activeSuggestionIndex}
              loading={loading}
              onSelect={selectCustomer}
            />
          )}
        </label>

        <label style={{ ...styles.label, position: "relative" }}>
          Nom
          <input
            style={styles.input}
            placeholder="Nom"
            value={item.lastName}
            onChange={(changeEvent) => updateIdentityField("lastName", changeEvent.target.value)}
            onKeyDown={handleSuggestionKeyDown}
            autoComplete="off"
          />
        </label>

        <input style={styles.input} placeholder="Téléphone" value={item.phone} onChange={(changeEvent) => updateItem(index, { phone: changeEvent.target.value })} />
        <input style={styles.input} placeholder="Email" type="email" value={item.email} onChange={(changeEvent) => updateItem(index, { email: changeEvent.target.value })} />
        <input style={styles.input} placeholder="Adultes" value={item.adults} onChange={(changeEvent) => updateItem(index, { adults: changeEvent.target.value })} />
        <input style={styles.input} placeholder="Enfants" value={item.children} onChange={(changeEvent) => updateItem(index, { children: changeEvent.target.value })} />
        <input style={styles.input} placeholder="Heure arrivée" value={item.arrivalTime} onChange={(changeEvent) => updateItem(index, { arrivalTime: changeEvent.target.value })} />
        <input style={styles.input} placeholder="Prix total (€)" value={item.total} onChange={(changeEvent) => updateItem(index, { total: changeEvent.target.value })} />
      </div>

      {item.customerId && (
        <div style={suggestionStyles.selectedBox}>
          ✓ Client existant sélectionné : <strong>{selectedName}</strong>
          <button
            type="button"
            style={suggestionStyles.clearButton}
            onClick={() => updateItem(index, { customerId: null, selectedCustomer: null })}
          >
            Dissocier
          </button>
        </div>
      )}

      <label style={styles.checkboxLine}>
        <input type="checkbox" checked={Boolean(item.babyBedNeeded)} onChange={(changeEvent) => updateItem(index, { babyBedNeeded: changeEvent.target.checked })} />
        Lit bébé demandé
      </label>
      <textarea style={styles.textarea} placeholder="Message / remarques" value={item.notes} onChange={(changeEvent) => updateItem(index, { notes: changeEvent.target.value })} />
    </>
  );
}

function ExternalImportPanel({ event, onApplyExternalAction }) {
  const [items, setItems] = useState([createEmptyImportItem(event, "reservation")]);
  const [loading, setLoading] = useState(false);
  const sourceLabel = event.source === "airbnb" ? "Airbnb" : "Booking";

  function updateItem(index, patch) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  function addReservation() {
    setItems((current) => [...current, createEmptyImportItem(event, "reservation")]);
  }

  function addPersonalReservation() {
    setItems((current) => [...current, createEmptyImportItem(event, "personal_reservation")]);
  }

  function addBlock() {
    setItems((current) => [...current, createEmptyImportItem(event, "block")]);
  }

  function removeItem(index) {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function submit(eventSubmit) {
    eventSubmit.preventDefault();

    if (!items.length) return alert("Ajoute au moins une période.");

    for (const item of items) {
      if (!item.startDate || !item.endDate || item.endDate <= item.startDate) {
        return alert("Une période est invalide.");
      }
      if (item.type !== "block" && !String(item.firstName || "").trim() && !String(item.lastName || "").trim()) {
        return alert("Nom ou prénom obligatoire pour chaque réservation.");
      }
    }

    setLoading(true);
    try {
      await onApplyExternalAction({
        action: "manual_periods",
        source: event.source,
        uid: event.uid,
        title: event.title || event.guest_name || "Bloc externe",
        startDate: event.start_date || event.start,
        endDate: event.end_date || event.end,
        items,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <h3>Import {sourceLabel} à compléter</h3>
      <p style={styles.muted}>{event.title || event.guest_name || "Bloc externe"}</p>
      <p style={styles.muted}>{formatDate(event.start_date || event.start)} → {formatDate(event.end_date || event.end)}</p>

      <div style={styles.warningBox}>
        Ce bloc vient de l'ICS {sourceLabel}. L'import brut reste la référence, mais tu peux créer les vraies périodes métier à afficher dans l'admin.
      </div>

      <div style={styles.infoBox}>
        <strong>Création de périodes métier</strong>
        <p style={styles.muted}>L’ICS brut reste affiché. Crée ici les vraies réservations ou blocages à afficher en parallèle.</p>
      </div>

      {items.map((item, index) => (
        <section key={index} style={styles.importItem}>
          <div style={styles.sectionHeader}>
            <h4>{getReservationTypeLabel(item.type, sourceLabel)} {index + 1}</h4>
            {items.length > 1 && <button type="button" style={styles.deleteButton} onClick={() => removeItem(index)}>Supprimer</button>}
          </div>

          <label style={styles.label}>Type
            <select style={styles.input} value={item.type} onChange={(changeEvent) => updateItem(index, { type: changeEvent.target.value })}>
              <option value="reservation">Réservation {sourceLabel}</option>
              <option value="personal_reservation">Réservation perso / directe</option>
              <option value="block">Blocage personnel</option>
            </select>
          </label>

          <div style={styles.formGridTwoCols}>
            <label style={styles.label}>Début
              <input style={styles.input} type="date" value={item.startDate} onChange={(changeEvent) => updateItem(index, { startDate: changeEvent.target.value })} />
            </label>
            <label style={styles.label}>Fin
              <input style={styles.input} type="date" value={item.endDate} onChange={(changeEvent) => updateItem(index, { endDate: changeEvent.target.value })} />
            </label>
          </div>

          {item.type === "block" ? (
            <>
              <input style={styles.input} placeholder="Titre du blocage" value={item.title} onChange={(changeEvent) => updateItem(index, { title: changeEvent.target.value })} />
              <textarea style={styles.textarea} placeholder="Commentaire / raison du blocage" value={item.notes} onChange={(changeEvent) => updateItem(index, { notes: changeEvent.target.value })} />
            </>
          ) : (
            <ImportReservationFields
              item={item}
              index={index}
              updateItem={updateItem}
            />
          )}
        </section>
      ))}

      <div style={styles.actionsRow}>
        <button type="button" style={styles.smallButton} onClick={addReservation}>Ajouter une réservation {sourceLabel}</button>
        <button type="button" style={styles.smallButton} onClick={addPersonalReservation}>Ajouter une résa perso / directe</button>
        <button type="button" style={styles.smallButton} onClick={addBlock}>Ajouter un blocage</button>
      </div>

      <button style={styles.primaryButton} type="submit" disabled={loading}>{loading ? "Traitement..." : "Valider"}</button>
    </form>
  );
}


export default function ReservationPeriodEditor({ event, onApplyExternalAction }) {
  return <ExternalImportPanel event={event} onApplyExternalAction={onApplyExternalAction} />;
}

const suggestionStyles = {
  box: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    zIndex: 20,
    marginTop: "4px",
    background: "white",
    border: "1px solid #d1d5db",
    borderRadius: "14px",
    boxShadow: "0 16px 34px rgba(15,23,42,0.16)",
    padding: "6px",
    display: "grid",
    gap: "4px",
  },
  item: {
    border: "none",
    background: "transparent",
    textAlign: "left",
    padding: "9px 10px",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: 700,
    color: "#334155",
  },
  activeItem: {
    border: "none",
    background: "#ecfdf5",
    textAlign: "left",
    padding: "9px 10px",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: 800,
    color: "#166534",
  },
  empty: {
    margin: 0,
    padding: "9px 10px",
    color: "#64748b",
    fontWeight: 700,
  },
  selectedBox: {
    background: "#ecfdf5",
    border: "1px solid #86efac",
    color: "#166534",
    borderRadius: "14px",
    padding: "10px 12px",
    fontWeight: 700,
    display: "flex",
    gap: "8px",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
  },
  clearButton: {
    border: "none",
    borderRadius: "999px",
    padding: "6px 10px",
    background: "#dcfce7",
    color: "#166534",
    cursor: "pointer",
    fontWeight: 800,
  },
};
