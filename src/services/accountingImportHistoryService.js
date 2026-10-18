// Registre financier (RLS owner-only) : lecture seule à l'ouverture de l'onglet Imports.
const REGISTRY_FIELDS = 'id,source,external_reference,start_date,end_date,payment_date,payment_reference,traveler_total,accommodation_amount,cleaning_fee,tourist_tax_amount,commission_amount,payment_fee_amount,net_payout,provenance,created_at,updated_at';
const PAGE_SIZE = 500;

export async function fetchPlatformFinancialRegistry(supabase) {
  const rows = [];
  for (let offset = 0; offset < 20000; offset += PAGE_SIZE) {
    const { data, error } = await supabase.from('external_reservation_financials')
      .select(REGISTRY_FIELDS)
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(error.message || 'Lecture du registre financier impossible.');
    if (!Array.isArray(data)) throw new Error('Réponse inattendue du registre financier.');
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
  throw new Error('Registre financier trop volumineux pour être affiché intégralement : consultation interrompue.');
}
