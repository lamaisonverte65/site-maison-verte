import { createClient } from "@supabase/supabase-js";
import { ADMIN_PERMISSIONS } from "../../shared/adminPermissions.js";
import { authorizationResponse, authorizeAdminRequest } from "./_lib/admin-auth.js";
import { calculateTouristTaxStay, eurosToCents } from "./_lib/tourist-tax.js";

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

    if (action === "get_tourist_tax_config") {
      const [{ data: settings, error: settingsError }, { data: rules, error: rulesError }] = await Promise.all([
        supabase.from("pricing_settings").select("tourist_tax_classification").eq("id", "default").maybeSingle(),
        supabase.from("tourist_tax_rules")
          .select("id,effective_from,effective_to,classification,calculation_type,base_rate_basis_points,department_additional_basis_points,regional_additional_basis_points,base_cap_cents,fixed_rate_cents,notes,is_active,created_at,updated_at")
          .eq("is_active", true)
          .order("classification", { ascending: true })
          .order("effective_from", { ascending: true }),
      ]);
      if (settingsError) throw settingsError;
      if (rulesError) throw rulesError;
      return {
        statusCode: 200,
        body: JSON.stringify({
          classification: settings?.tourist_tax_classification || "unclassified",
          rules: rules || [],
          today: new Date().toISOString().slice(0, 10),
        }),
      };
    }

    if (action === "update_tourist_tax_classification") {
      const classification = String(body.classification || "");
      if (!["unclassified", "1_star", "2_star", "3_star"].includes(classification)) {
        return { statusCode: 400, body: JSON.stringify({ error: "Classement taxe de séjour invalide." }) };
      }
      const { data, error } = await supabase.from("pricing_settings")
        .update({ tourist_tax_classification: classification, updated_at: new Date().toISOString() })
        .eq("id", "default")
        .select("tourist_tax_classification")
        .single();
      if (error) throw error;
      return { statusCode: 200, body: JSON.stringify({ success: true, classification: data.tourist_tax_classification }) };
    }

    if (action === "simulate_tourist_tax_rule") {
      const classification = String(body.classification || "");
      const calculationType = String(body.calculationType || "");
      const nights = Number(body.nights);
      const adults = Number(body.adults);
      const children = Number(body.children || 0);
      const nightlyAccommodationEuros = Number(body.nightlyAccommodationEuros);
      if (!["unclassified", "1_star", "2_star", "3_star"].includes(classification)) {
        return { statusCode: 400, body: JSON.stringify({ error: "Classement taxe de séjour invalide." }) };
      }
      if (!Number.isInteger(nights) || nights < 1 || nights > 60 || !Number.isInteger(adults) || adults < 1 || !Number.isInteger(children) || children < 0 || adults + children > 20 || !Number.isFinite(nightlyAccommodationEuros) || nightlyAccommodationEuros < 0) {
        return { statusCode: 400, body: JSON.stringify({ error: "Cas test invalide." }) };
      }
      const toIntegerOrNull = (value) => value === null || value === undefined || value === "" ? null : Number(value);
      const proposedRule = {
        id: "simulation-new-rule",
        classification,
        calculation_type: calculationType,
        effective_from: String(body.effectiveFrom || new Date().toISOString().slice(0, 10)),
        effective_to: null,
        base_rate_basis_points: toIntegerOrNull(body.baseRateBasisPoints),
        department_additional_basis_points: toIntegerOrNull(body.departmentAdditionalBasisPoints),
        regional_additional_basis_points: toIntegerOrNull(body.regionalAdditionalBasisPoints),
        base_cap_cents: toIntegerOrNull(body.baseCapCents),
        fixed_rate_cents: toIntegerOrNull(body.fixedRateCents),
      };
      const today = new Date().toISOString().slice(0, 10);
      const { data: currentRules, error: currentRuleError } = await supabase.from("tourist_tax_rules")
        .select("id,effective_from,effective_to,classification,calculation_type,base_rate_basis_points,department_additional_basis_points,regional_additional_basis_points,base_cap_cents,fixed_rate_cents,is_active")
        .eq("classification", classification).eq("is_active", true).lte("effective_from", today)
        .or(`effective_to.is.null,effective_to.gte.${today}`).order("effective_from", { ascending: false }).limit(1);
      if (currentRuleError) throw currentRuleError;
      const currentRule = currentRules?.[0];
      if (!currentRule) return { statusCode: 400, body: JSON.stringify({ error: "Aucune règle actuelle à comparer." }) };
      const nightlyAccommodationCents = Array.from({ length: nights }, () => eurosToCents(nightlyAccommodationEuros));
      const occupants = adults + children;
      const run = (rule) => calculateTouristTaxStay({ nightlyAccommodationCents, occupants, taxablePeople: adults, rulesByNight: Array.from({ length: nights }, () => rule) });
      const summarize = (result) => {
        const first = result.nights[0];
        const r = first.rule;
        const formula = r.calculationType === "fixed"
          ? `Taxe = ${(r.fixedRateCents / 100).toFixed(2)} € × ${adults} adulte(s) taxable(s) × ${nights} nuit(s)`
          : `Par nuit : base = arrondi((${nightlyAccommodationEuros.toFixed(2)} € ÷ ${occupants} voyageur(s)) × ${(r.baseRateBasisPoints / 100).toFixed(2)} %) ; plafond ${(r.baseCapCents / 100).toFixed(2)} € ; département +${(r.departmentAdditionalBasisPoints / 100).toFixed(2)} % ; région +${(r.regionalAdditionalBasisPoints / 100).toFixed(2)} % ; total × ${adults} adulte(s) taxable(s), puis somme sur ${nights} nuit(s).`;
        return {
          totalTaxCents: result.totalTaxCents,
          formula,
          perNight: { baseTaxCents: first.baseTaxCents, cappedBaseTaxCents: first.cappedBaseTaxCents, departmentTaxCents: first.departmentTaxCents, regionalTaxCents: first.regionalTaxCents, personNightRateCents: first.personNightRateCents },
        };
      };
      return { statusCode: 200, body: JSON.stringify({ current: summarize(run(currentRule)), proposed: summarize(run(proposedRule)), case: { nights, adults, children, occupants, nightlyAccommodationEuros } }) };
    }

    if (action === "create_tourist_tax_rule") {
      const classification = String(body.classification || "");
      const calculationType = String(body.calculationType || "");
      const effectiveFrom = String(body.effectiveFrom || "");
      if (!["unclassified", "1_star", "2_star", "3_star"].includes(classification)) {
        return { statusCode: 400, body: JSON.stringify({ error: "Classement taxe de séjour invalide." }) };
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) {
        return { statusCode: 400, body: JSON.stringify({ error: "Date de début invalide." }) };
      }
      if (!["proportional", "fixed"].includes(calculationType)) {
        return { statusCode: 400, body: JSON.stringify({ error: "Type de règle invalide." }) };
      }
      const toIntegerOrNull = (value) => value === null || value === undefined || value === "" ? null : Number(value);
      const params = {
        p_classification: classification,
        p_effective_from: effectiveFrom,
        p_calculation_type: calculationType,
        p_base_rate_basis_points: toIntegerOrNull(body.baseRateBasisPoints),
        p_department_additional_basis_points: toIntegerOrNull(body.departmentAdditionalBasisPoints),
        p_regional_additional_basis_points: toIntegerOrNull(body.regionalAdditionalBasisPoints),
        p_base_cap_cents: toIntegerOrNull(body.baseCapCents),
        p_fixed_rate_cents: toIntegerOrNull(body.fixedRateCents),
        p_notes: String(body.notes || "").trim() || null,
      };
      for (const [key, value] of Object.entries(params)) {
        if (key.startsWith("p_") && key.endsWith("_cents") || key.endsWith("_basis_points")) {
          if (value !== null && (!Number.isInteger(value) || value < 0)) {
            return { statusCode: 400, body: JSON.stringify({ error: "Paramètres de taxe invalides." }) };
          }
        }
      }
      const { data, error } = await supabase.rpc("admin_add_tourist_tax_rule", params);
      if (error) throw error;
      return { statusCode: 200, body: JSON.stringify({ success: true, rule: data }) };
    }

    if (action === "get_keybox_code") {
      const { data, error } = await supabase
        .from("pricing_settings")
        .select("keybox_code")
        .eq("id", "default")
        .maybeSingle();

      if (error) throw error;

      return {
        statusCode: 200,
        body: JSON.stringify({ keyboxCode: String(data?.keybox_code || "").trim() }),
      };
    }

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


    if (action === "update_cleaning_fee") {
      const cleaningFee = cleanNumber(body.cleaningFee);

      if (cleaningFee === null || !Number.isInteger(cleaningFee) || cleaningFee < 0) {
        return { statusCode: 400, body: JSON.stringify({ error: "Forfait ménage invalide." }) };
      }

      const { data, error } = await supabase
        .from("pricing_settings")
        .upsert({
          id: "default",
          cleaning_fee: cleaningFee,
          updated_at: new Date().toISOString(),
        }, { onConflict: "id" })
        .select()
        .single();

      if (error) throw error;

      return { statusCode: 200, body: JSON.stringify({ success: true, settings: data }) };
    }


    if (action === "update_keybox_code") {
      const keyboxCode = String(body.keyboxCode || "").trim();

      if (!keyboxCode || keyboxCode.length > 32) {
        return { statusCode: 400, body: JSON.stringify({ error: "Code de boîte à clés invalide." }) };
      }

      const { data, error } = await supabase
        .from("pricing_settings")
        .upsert({
          id: "default",
          keybox_code: keyboxCode,
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
