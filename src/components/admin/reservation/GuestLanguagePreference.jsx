import { useEffect, useState } from "react";
import { supabase } from "../../../supabaseClient";
import { normalizeGuestLanguage } from "../../../../shared/guestLocale.js";
import { styles } from "../adminStyles";

const OPTIONS = [
  ["fr", "Français (FR)"],
  ["en", "English (EN)"],
  ["es", "Español (ES)"],
];

// Action séparée de la modification contractuelle : ni aperçu financier ni
// transmission de champs métier autres que bookingId et communicationLanguage.
export default function GuestLanguagePreference({ booking, onUpdated }) {
  const storedLanguage = normalizeGuestLanguage(booking?.communication_language);
  const [language, setLanguage] = useState(storedLanguage);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setLanguage(storedLanguage);
    setError("");
    setSuccess("");
  }, [booking?.id, storedLanguage]);

  async function saveLanguage() {
    if (!booking?.id || saving || language === storedLanguage) return;
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Session propriétaire expirée.");
      const response = await fetch("/.netlify/functions/update-booking-language", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ bookingId: booking.id, communicationLanguage: language }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok || result.communicationLanguage !== language) {
        throw new Error(result.error || "Enregistrement impossible.");
      }
      setSuccess("Langue enregistrée pour les prochains emails voyageurs.");
      await onUpdated?.();
    } catch (cause) {
      setError(cause?.message || "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section style={{ ...styles.panel, marginBottom: 18 }}>
      <h3 style={styles.subTitle}>Langue des communications voyageurs</h3>
      <p style={styles.muted}>
        Préférence utilisée pour les prochains emails automatiques. Les emails déjà envoyés
        et les éventuels renvois à l’identique ne changent pas. Les emails internes restent en français.
      </p>
      <div style={{ display: "flex", alignItems: "end", gap: "12px", flexWrap: "wrap" }}>
        <label style={{ display: "grid", gap: "6px", minWidth: 185 }}>
          <span style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>Langue</span>
          <select aria-label="Langue des communications voyageurs" style={{ ...styles.input, width: "100%" }}
            value={language} disabled={saving} onChange={(event) => { setLanguage(event.target.value); setError(""); setSuccess(""); }}>
            {OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <button type="button" style={styles.smallButton}
          onClick={saveLanguage} disabled={saving || language === storedLanguage}>
          {saving ? "Enregistrement…" : "Enregistrer la langue"}
        </button>
      </div>
      {error && <p role="alert" style={styles.error}>{error}</p>}
      {success && <p role="status" style={styles.info}>{success}</p>}
    </section>
  );
}
