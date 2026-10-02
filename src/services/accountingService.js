import { mergeExternalFinancialRow } from "../utils/externalReservationFinancialImport.js";

const ENTRY_FIELDS = "*, accounting_categories(id,entry_kind,code,name), accounting_fixed_assets(*)";

function assertSupabase(result, fallback) {
  if (result?.error) throw new Error(result.error.message || fallback);
  return result?.data;
}

export async function fetchAccountingData(supabase) {
  const [categoriesResult, entriesResult, importsResult] = await Promise.all([
    supabase.from("accounting_categories").select("*").order("entry_kind").order("sort_order").order("name"),
    supabase.from("accounting_entries").select(ENTRY_FIELDS).order("entry_date", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("accounting_import_batches").select("*").order("created_at", { ascending: false }),
  ]);
  return {
    categories: assertSupabase(categoriesResult, "Impossible de charger les catégories comptables.") || [],
    entries: assertSupabase(entriesResult, "Impossible de charger le journal comptable.") || [],
    importBatches: assertSupabase(importsResult, "Impossible de charger les imports comptables.") || [],
  };
}

export async function createAccountingCategory(supabase, values) {
  const payload = {
    entry_kind: values.entry_kind,
    code: String(values.code || "").trim(),
    name: String(values.name || "").trim(),
    sort_order: Number(values.sort_order || 500),
  };
  if (!payload.code || !payload.name) throw new Error("Code et nom du domaine obligatoires.");
  const result = await supabase.from("accounting_categories").insert(payload).select("*").single();
  return assertSupabase(result, "Impossible de créer le domaine comptable.");
}

function entryPayload(values) {
  return {
    entry_date: values.entry_date,
    entry_kind: values.entry_kind,
    category_id: values.category_id || null,
    label: String(values.label || "").trim(),
    counterparty: String(values.counterparty || "").trim() || null,
    amount_ttc: Number(values.amount_ttc),
    treatment: values.treatment || "current",
    source: "manual",
    payment_method: String(values.payment_method || "").trim() || null,
    notes: String(values.notes || "").trim() || null,
    metadata: values.entry_kind === "income" && values.receipt_origin ? { receipt_origin: String(values.receipt_origin).trim() } : {},
  };
}

function assetPayload(entryId, values) {
  return {
    accounting_entry_id: entryId,
    asset_category: String(values.asset_category || "").trim() || "Autre immobilisation",
    in_service_date: values.in_service_date || values.entry_date,
    acquisition_value: Number(values.acquisition_value ?? values.amount_ttc),
    depreciation_method: values.depreciation_method || null,
    depreciation_duration_months: values.depreciation_duration_months ? Number(values.depreciation_duration_months) : null,
    residual_value: Number(values.residual_value || 0),
    notes: String(values.asset_notes || "").trim() || null,
  };
}

export async function createManualAccountingEntry(supabase, values) {
  const payload = entryPayload(values);
  if (!payload.entry_date || !payload.label || !Number.isFinite(payload.amount_ttc) || payload.amount_ttc < 0) {
    throw new Error("Date, libellé et montant valide sont obligatoires.");
  }
  const inserted = assertSupabase(
    await supabase.from("accounting_entries").insert(payload).select("*").single(),
    "Impossible de créer l'écriture comptable.",
  );
  try {
    if (payload.treatment === "fixed_asset") {
      assertSupabase(
        await supabase.from("accounting_fixed_assets").insert(assetPayload(inserted.id, values)).select("*").single(),
        "Impossible de créer la fiche immobilisation.",
      );
    }
  } catch (error) {
    await supabase.from("accounting_entries").delete().eq("id", inserted.id).eq("source", "manual");
    throw error;
  }
  return inserted;
}

export async function updateManualAccountingEntry(supabase, id, values) {
  const payload = { ...entryPayload(values), updated_at: new Date().toISOString() };
  const updated = assertSupabase(
    await supabase.from("accounting_entries").update(payload).eq("id", id).eq("source", "manual").select("*").single(),
    "Impossible de modifier l'écriture comptable.",
  );
  if (payload.treatment === "fixed_asset") {
    const asset = assetPayload(id, values);
    assertSupabase(
      await supabase.from("accounting_fixed_assets").upsert(asset, { onConflict: "accounting_entry_id" }).select("*").single(),
      "Impossible de mettre à jour la fiche immobilisation.",
    );
  } else {
    assertSupabase(
      await supabase.from("accounting_fixed_assets").delete().eq("accounting_entry_id", id),
      "Impossible de retirer la fiche immobilisation.",
    );
  }
  return updated;
}

export async function deleteManualAccountingEntry(supabase, id) {
  const result = await supabase.from("accounting_entries").delete().eq("id", id).eq("source", "manual").select("id");
  const rows = assertSupabase(result, "Impossible de supprimer l'écriture comptable.") || [];
  if (!rows.length) throw new Error("Seules les écritures manuelles peuvent être supprimées ici.");
  return true;
}

export function accountingYearSummary(entries, year) {
  const selected = (entries || []).filter((entry) => String(entry.entry_date || "").startsWith(`${year}-`));
  const income = selected.filter((entry) => entry.entry_kind === "income").reduce((sum, entry) => sum + Number(entry.amount_ttc || 0), 0);
  const expense = selected.filter((entry) => entry.entry_kind === "expense").reduce((sum, entry) => sum + Number(entry.amount_ttc || 0), 0);
  return { income, expense, result: income - expense, count: selected.length };
}

export async function sha256File(file) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function saveAccountingImportSnapshot(supabase, { file, sha256, source, exerciseYear, statement, entries, format }) {
  if (!file || !sha256 || !source || !exerciseYear) throw new Error("Import incomplet.");
  if (!entries.length) throw new Error("Aucune écriture à importer.");
  const duplicate = await supabase.from("accounting_import_batches").select("id,status").eq("source", source).eq("file_sha256", sha256).maybeSingle();
  if (duplicate.error) throw new Error(duplicate.error.message || "Impossible de contrôler le fichier importé.");
  if (duplicate.data) throw new Error("Ce fichier a déjà été importé.");
  const totals=statement.totals || {};
  const fees = source === "booking" ? Number(totals.commission||0)+Number(totals.paymentFee||0) : -Math.abs(Number(totals.serviceFee||0));
  const batch = assertSupabase(await supabase.from("accounting_import_batches").insert({
    source, original_filename:file.name, file_sha256:sha256, status:"draft", exercise_year:exerciseYear,
    imported_rows:statement.items.length, accepted_rows:statement.items.length, rejected_rows:0,
    gross_total:Number(totals.gross||0), fees_total:Math.round(fees*100)/100, net_total:Number(totals.net||0),
    metadata:{ format, payment_groups:(statement.payments||statement.payouts||[]).length, tax_remitted_by_platform:Number(totals.taxRemitted||0) }
  }).select("*").single(), "Impossible de créer le lot d'import.");
  try {
    const rpc=await supabase.rpc("admin_commit_accounting_import_snapshot", { p_new_batch_id:batch.id, p_source:source, p_exercise_year:exerciseYear, p_entries:entries });
    if (rpc.error) throw new Error(rpc.error.message || "Impossible de valider l'instantané comptable.");
    return rpc.data;
  } catch(error) {
    await supabase.from("accounting_import_batches").delete().eq("id",batch.id).eq("status","draft");
    throw error;
  }
}

export async function saveBookingStatementImport(supabase, payload) {
  return saveAccountingImportSnapshot(supabase, { ...payload, source:"booking", exerciseYear:payload.exerciseYear, format:"booking_statements_csv_v2" });
}


export async function saveExternalReservationFinancials(supabase, rows) {
  if (!Array.isArray(rows) || !rows.length) throw new Error("Aucune donnée financière plateforme à enregistrer.");
  const source = rows[0].source;
  if (!source || rows.some((row) => row.source !== source || !row.external_reference)) {
    throw new Error("Données financières plateforme incohérentes.");
  }
  const references = [...new Set(rows.map((row) => String(row.external_reference)))];
  const existingResponse = await supabase
    .from("external_reservation_financials")
    .select("*")
    .eq("source", source)
    .in("external_reference", references);
  if (existingResponse.error) throw new Error(existingResponse.error.message || "Impossible de lire les données financières plateforme.");

  const existingByReference = new Map((existingResponse.data || []).map((row) => [String(row.external_reference), row]));
  const merged = rows.map((row) => {
    const existing = existingByReference.get(String(row.external_reference));
    return existing ? mergeExternalFinancialRow(existing, row) : row;
  });
  const response = await supabase
    .from("external_reservation_financials")
    .upsert(merged, { onConflict: "source,external_reference" })
    .select("*");
  if (response.error) throw new Error(response.error.message || "Impossible d'enregistrer les données financières plateforme.");
  return response.data || [];
}
