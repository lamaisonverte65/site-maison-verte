// La taille est inferieure au plafond PostgREST habituel (1000 lignes),
// mais la verification d'un compte exact reste obligatoire : un plafond
// configure plus bas ne doit jamais tronquer silencieusement un tableau.
export const ADMIN_PAGE_SIZE = 500;
const MAX_ROWS_PER_SOURCE = 100000;

export async function readAllAdminRows(supabase, {
  table,
  orderBy,
  uniqueBy = "id",
  ascending = false,
  since,
}) {
  const rows = [];
  const seen = new Set();
  let expectedTotal = null;

  while (true) {
    const offset = rows.length;
    let query = supabase.from(table).select("*", { count: "exact" });
    if (since) query = query.gte("created_at", since);
    query = query.order(orderBy, { ascending });
    if (orderBy !== uniqueBy) query = query.order(uniqueBy, { ascending });
    const response = await query.range(offset, offset + ADMIN_PAGE_SIZE - 1);
    if (response.error) throw response.error;
    if (!Array.isArray(response.data)) {
      throw new Error(`Lecture incomplète de ${table} : sans liste de résultats.`);
    }

    const count = response.count;
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new Error(`Lecture incomplète de ${table} : total exact indisponible.`);
    }
    if (expectedTotal === null) expectedTotal = count;
    if (count !== expectedTotal) {
      throw new Error(`Lecture incomplète de ${table} : total modifié pendant la pagination.`);
    }
    if (expectedTotal > MAX_ROWS_PER_SOURCE) {
      throw new Error(`Lecture de ${table} trop volumineuse pour l'administration (${expectedTotal} lignes).`);
    }

    const expectedPageLength = Math.min(ADMIN_PAGE_SIZE, expectedTotal - offset);
    if (response.data.length !== expectedPageLength) {
      throw new Error(`Lecture incomplète de ${table} : ${response.data.length} lignes reçues sur ${expectedPageLength} attendues.`);
    }
    for (const row of response.data) {
      const key = row?.[uniqueBy];
      if (key === undefined || key === null || key === "" || seen.has(String(key))) {
        throw new Error(`Lecture incomplète de ${table} : identifiant manquant ou doublon (${uniqueBy}).`);
      }
      seen.add(String(key));
      rows.push(row);
    }

    if (rows.length === expectedTotal) return rows;
  }
}
