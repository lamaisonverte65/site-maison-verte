import { useState } from "react";
import { supabase } from "../supabaseClient";

function cleanText(value) {
  return String(value ?? "").trim();
}

function babyBedPayloadValue(value) {
  if (value === "yes") return true;
  if (value === "no") return false;
  return null;
}

export function useExternalCustomer() {
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  async function getAuthHeaders() {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    };
  }

  async function saveExternalCustomer({ initialExternalData, form }) {
    setSaving(true);
    setStatusMessage("");

    try {
      const response = await fetch("/.netlify/functions/update-external-reservation-client", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          uid: initialExternalData.uid,
          source: initialExternalData.source,
          startDate: initialExternalData.startDate,
          endDate: initialExternalData.endDate,
          customerId: initialExternalData.customerId,
          firstName: cleanText(form.firstName),
          lastName: cleanText(form.lastName),
          email: cleanText(form.email),
          phone: cleanText(form.phone),
          arrivalTime: cleanText(form.arrivalTime),
          childrenCount: cleanText(form.childrenCount),
          babyBedNeeded: babyBedPayloadValue(form.babyBedNeeded),
          notes: cleanText(form.notes),
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Erreur lors de l'enregistrement.");

      setStatusMessage(payload.warning ? `Informations enregistrées. ${payload.warning}` : "Informations enregistrées.");
      return payload;
    } catch (error) {
      const message = `Erreur : ${error.message}`;
      setStatusMessage(message);
      throw error;
    } finally {
      setSaving(false);
    }
  }

  function clearStatusMessage() {
    setStatusMessage("");
  }

  return {
    saving,
    statusMessage,
    saveExternalCustomer,
    clearStatusMessage,
  };
}
