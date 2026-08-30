import { createClient } from "@supabase/supabase-js";
import { ADMIN_PERMISSIONS } from "../../shared/adminPermissions.js";
import { authorizationResponse, authorizeAdminRequest } from "./_lib/admin-auth.js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function cleanNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function validateDateRange(startDate, endDate) {
  if (!startDate || !endDate) return "Dates obligatoires.";
  if (String(endDate) <= String(startDate)) return "La date de fin doit être après la date de début.";
  return null;
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const admin = await authorizeAdminRequest(event, supabase, { anyOf: [ADMIN_PERMISSIONS.managePricing] });
    if (!admin.ok) return authorizationResponse(admin);

    const body = JSON.parse(event.body || "{}");
    const { action, ruleType, id } = body;

    if (action === "delete") {
      const table = ruleType === "season" ? "season_prices" : "price_overrides";
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }
    if (action === "update_default_price") {
      const defaultNightPrice = cleanNumber(body.defaultNightPrice);

      if (defaultNightPrice === null || defaultNightPrice < 0) {
        return { statusCode: 400, body: JSON.stringify({ error: "Tarif par défaut invalide." }) };
      }

      const { data, error } = await supabase
        .from("pricing_settings")
        .upsert({
          id: "default",
          default_night_price: defaultNightPrice,
          notes: body.notes || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "id" })
        .select()
        .single();

      if (error) throw error;

      return { statusCode: 200, body: JSON.stringify({ success: true, settings: data }) };
    }


    const table = ruleType === "season" ? "season_prices" : "price_overrides";
    const payload = {
      label: body.label || (ruleType === "season" ? "Saison" : "Tarif spécifique"),
      start_date: body.startDate,
      end_date: body.endDate,
      night_price: cleanNumber(body.nightPrice),
      notes: body.notes || null,
      is_active: body.isActive !== false,
      updated_at: new Date().toISOString(),
    };

    const dateError = validateDateRange(payload.start_date, payload.end_date);
    if (dateError) return { statusCode: 400, body: JSON.stringify({ error: dateError }) };
    if (payload.night_price === null || payload.night_price < 0) {
      return { statusCode: 400, body: JSON.stringify({ error: "Prix invalide." }) };
    }

    if (ruleType === "season") {
      payload.minimum_nights = cleanNumber(body.minimumNights);
      payload.allowed_arrival_days = Array.isArray(body.allowedArrivalDays) ? body.allowedArrivalDays : null;
    } else {
      payload.reason = body.reason || null;
    }

    let result;
    if (action === "update" && id) {
      result = await supabase.from(table).update(payload).eq("id", id).select().single();
    } else {
      result = await supabase.from(table).insert([payload]).select().single();
    }

    if (result.error) throw result.error;

    return { statusCode: 200, body: JSON.stringify({ success: true, rule: result.data }) };
  } catch (error) {
    console.error("Erreur save-price-rule :", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
}
