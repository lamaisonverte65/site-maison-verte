// Vue d'audit uniquement : aucune règle fiscale et aucune modification des imports.
const yearFromDate = (date) => /^\d{4}-\d{2}-\d{2}/.test(String(date || '')) ? Number(String(date).slice(0,4)) : null;
const sourceRef = (source, reference) => `${String(source || '').trim().toLowerCase()}\u0000${String(reference || '').trim()}`;
const knownPlatform = (source) => source === 'booking' || source === 'airbnb';

export function buildAccountingImportHistory({ year, entries = [], batches = [], financialRows = [], source = 'all', search = '' }) {
  const exercise = Number(year);
  if (!Number.isInteger(exercise) || exercise < 2000 || exercise > 2100) throw new Error('Exercice invalide.');
  const keyword = String(search || '').trim().toLocaleLowerCase('fr');
  const visibleSource = (value) => source === 'all' || value === source;
  const passesSearch = (values) => !keyword || values.some(value => String(value ?? '').toLocaleLowerCase('fr').includes(keyword));
  const yearEntries = entries.filter(entry => yearFromDate(entry.entry_date) === exercise);
  const ledgerByRef = new Map();
  for (const entry of entries) {
    if (!knownPlatform(entry.source) || entry.entry_kind !== 'income' || !entry.external_reference) continue;
    const key = sourceRef(entry.source, entry.external_reference);
    const existing = ledgerByRef.get(key) || [];
    existing.push(entry);
    ledgerByRef.set(key, existing);
  }
  const financialKeys = new Set(financialRows.filter(item => knownPlatform(item.source)).map(item => sourceRef(item.source,item.external_reference)));
  const allFilteredEntries = yearEntries.filter(entry => visibleSource(entry.source));
  const visibleEntries = allFilteredEntries.filter(entry => passesSearch([entry.external_reference,entry.label,entry.source]));
  const auditRow = item => {
    const yearBasis = yearFromDate(item.payment_date) === exercise ? 'payment'
      : !item.payment_date && yearFromDate(item.start_date) === exercise ? 'stay_without_payment_date'
        : null;
    if (!yearBasis || !visibleSource(item.source) || !passesSearch([item.external_reference,item.source,item.payment_reference])) return null;
    const journalLinks = ledgerByRef.get(sourceRef(item.source,item.external_reference)) || [];
    return { ...item, yearBasis, journalLinks, journalYears: [...new Set(journalLinks.map(entry => yearFromDate(entry.entry_date)).filter(Boolean))].sort(),
      hasIncomeThisYear: journalLinks.some(entry => yearFromDate(entry.entry_date) === exercise) };
  };
  const registryRows = financialRows.map(auditRow).filter(Boolean)
    .sort((a,b) => String(b.payment_date || b.start_date || '').localeCompare(String(a.payment_date || a.start_date || '')) || String(a.external_reference).localeCompare(String(b.external_reference)));
  const undatedRegistryRows = financialRows.filter(item => knownPlatform(item.source) && !item.payment_date && !item.start_date && visibleSource(item.source) && passesSearch([item.source,item.external_reference]));
  const unmatchedIncomeRows = visibleEntries.filter(entry => knownPlatform(entry.source) && entry.entry_kind === 'income' && entry.external_reference && !financialKeys.has(sourceRef(entry.source,entry.external_reference)))
    .sort((a,b) => String(b.entry_date).localeCompare(String(a.entry_date)));
  const batchEntries = new Map();
  for (const entry of entries) if (entry.import_batch_id) {
    const list = batchEntries.get(entry.import_batch_id) || [];
    list.push(entry);
    batchEntries.set(entry.import_batch_id, list);
  }
  const shownBatches = batches.filter(batch => {
    if (!visibleSource(batch.source)) return false;
    if (Number(batch.exercise_year) !== exercise && !(batch.exercise_year == null && yearEntries.some(entry => entry.import_batch_id === batch.id))) return false;
    return passesSearch([batch.original_filename, batch.source, batch.status]);
  }).map(batch => ({...batch, activeEntries:(batchEntries.get(batch.id)||[]).length, activeJournalRows:batchEntries.get(batch.id)||[]}));
  return {
    batches: shownBatches,
    registryRows,
    undatedRegistryRows,
    unmatchedIncomeRows,
    summary: {
      entries: allFilteredEntries.length,
      importedEntries: allFilteredEntries.filter(entry => entry.import_batch_id).length,
      registryRows: registryRows.length,
      withoutPaymentDate: registryRows.filter(item => item.yearBasis === 'stay_without_payment_date').length,
      unmatchedIncome: yearEntries.filter(entry => visibleSource(entry.source) && knownPlatform(entry.source) && entry.entry_kind === 'income' && entry.external_reference && !financialKeys.has(sourceRef(entry.source,entry.external_reference))).length,
    },
  };
}
