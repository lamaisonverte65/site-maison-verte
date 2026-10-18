import { useMemo, useState } from 'react';
import { styles } from './adminStyles';
import { buildAccountingImportHistory } from '../../utils/accountingImportHistory.js';

const euro = (value) => value === null || value === undefined || value === ''
  ? '— (inconnu)'
  : new Intl.NumberFormat('fr-FR', {style:'currency',currency:'EUR'}).format(Number(value));
const labelSource = source => ({booking:'Booking',airbnb:'Airbnb'})[source] || source || '—';
const localeDate = date => date ? new Date(`${String(date).slice(0,10)}T12:00:00`).toLocaleDateString('fr-FR') : '—';
const statusLabel = status => ({validated:'Validé',replaced:'Remplacé',cancelled:'Annulé',draft:'Brouillon'})[status] || status || '—';
const sourceTags = provenance => [...new Set(Object.values(provenance || {}).map(value => String(value).split(':')[0]).filter(tag => /^(booking_statement|booking_overview|airbnb_statement|airbnb_reservations|derived)$/.test(tag)))];
const small = {fontSize:12,opacity:.85};
const tableBox = { ...styles.tableWrapper, maxWidth:'100%', width:'100%', minWidth:0, overflowX:'auto', maxHeight:440 };

export default function AccountingImportHistory({year, entries = [], batches = [], financialRows = [], registryLoading = false, registryError = '', accountingLoading = false, accountingError = '', onRefresh}) {
  const [source,setSource] = useState('all');
  const [search,setSearch] = useState('');
  const view = useMemo(() => buildAccountingImportHistory({year,entries,batches,financialRows:registryError || registryLoading ? [] : financialRows,source,search}), [year,entries,batches,financialRows,source,search,registryError,registryLoading]);
  const ledgerAvailable = !accountingError && !accountingLoading;
  const registryAvailable = !registryError && !registryLoading;
  return <section style={{display:'grid',gap:16,minWidth:0,maxWidth:'100%'}} aria-label="Historique des imports">
    <div style={styles.panelHeader}>
      <div>
        <h3 style={{margin:0}}>Historique et traçabilité des imports — {year}</h3>
        <p style={styles.muted}>Consultation uniquement : le journal comptable et le registre financier des plateformes sont deux ensembles distincts. Importer des réservations ne crée pas de recette comptable.</p>
      </div>
      <button type="button" style={styles.smallButton} onClick={onRefresh}>Actualiser l'historique</button>
    </div>
    <div style={{...styles.accountingFormGrid,minWidth:0}}>
      <label style={styles.label}>Plateforme
        <select style={styles.input} value={source} onChange={event=>setSource(event.target.value)}>
          <option value="all">Booking et Airbnb</option><option value="booking">Booking</option><option value="airbnb">Airbnb</option>
        </select>
      </label>
      <label style={styles.label}>Chercher une référence ou un fichier
        <input style={styles.input} type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Réservation, fichier, source…" />
      </label>
    </div>
    {accountingLoading && <p style={styles.info}>Chargement du journal comptable…</p>}
    {ledgerAvailable && <>
      <div style={styles.homeFinanceGrid}>
        <div style={styles.accountingStat}><span>Écritures comptables de l'exercice</span><strong>{view.summary.entries}</strong></div>
        <div style={styles.accountingStat}><span>Dont issues d'un lot suivi</span><strong>{view.summary.importedEntries}</strong></div>
        <div style={styles.accountingStat}><span>Recettes plateforme sans fiche financière</span><strong>{view.summary.unmatchedIncome}</strong></div>
      </div>
      <div>
        <h4>Lots d'import comptable</h4>
        <p style={styles.muted}>Année du lot comptable. Les lots remplacés sont conservés dans l'historique, mais leurs écritures ne sont plus actives.</p>
        <div style={tableBox}><table style={{...styles.table,minWidth:820}}><thead><tr>
          <th style={styles.th}>Source</th><th style={styles.th}>Fichier enregistré</th><th style={styles.th}>Importé / validé le</th><th style={styles.th}>État</th><th style={styles.th}>Lignes source</th><th style={styles.th}>Écritures actives</th><th style={styles.th}>Brut indiqué</th><th style={styles.th}>Net indiqué</th>
        </tr></thead><tbody>
          {view.batches.map(batch=><tr key={batch.id}><td style={styles.td}>{labelSource(batch.source)}</td><td style={styles.td}>{batch.original_filename || 'Nom non conservé'}
            {batch.activeJournalRows.length > 0 && <details style={{marginTop:6}}>
              <summary>Voir {batch.activeJournalRows.length} écriture(s) actuelle(s)</summary>
              <div style={{maxHeight:220,overflowY:'auto',minWidth:260}}>{batch.activeJournalRows.map(entry=><div key={entry.id} style={{padding:'5px 0',borderBottom:'1px solid #ddd',fontSize:12}}>{entry.entry_date} · {entry.entry_kind === 'income' ? 'Recette' : 'Dépense'} · {entry.external_reference || entry.label} · {euro(entry.amount_ttc)}</div>)}</div>
            </details>}
            {batch.status === 'replaced' && <div style={small}>Ancien instantané remplacé ; lignes sources non conservées ici.</div>}
          </td><td style={styles.td}>{localeDate(batch.validated_at || batch.created_at)}</td><td style={styles.td}>{statusLabel(batch.status)}</td><td style={styles.td}>{batch.imported_rows ?? '—'}</td><td style={styles.td}>{batch.activeEntries}</td><td style={styles.td}>{euro(batch.gross_total)}</td><td style={styles.td}>{euro(batch.net_total)}</td></tr>)}
          {!view.batches.length && <tr><td style={styles.td} colSpan="8">Aucun lot comptable enregistré pour cet exercice et ces filtres. Cela ne signifie pas qu'aucune réservation n'a été importée au registre financier.</td></tr>}
        </tbody></table></div>
      </div>
    </>}
    {accountingError && <p style={styles.error}>Journal comptable indisponible : {accountingError}. Le contrôle des correspondances ne peut pas être effectué.</p>}
    <div>
      <h4>Registre financier des réservations</h4>
      <p style={styles.muted}>Une réservation figure dans l'exercice uniquement si sa <strong>date de paiement</strong> appartient à {year}. Si elle n'a pas de date de paiement, elle apparaît à titre indicatif sous son année de séjour, <strong>sans être considérée comme encaissée cette année-là</strong>. Les dates et sources de fichiers d'origine ne sont pas inventées.</p>
      {registryLoading && <p style={styles.info}>Chargement du registre financier…</p>}
      {registryError && <p style={styles.error}>{registryError}. Les résultats ci-dessous ne sont pas considérés comme nuls.</p>}
      {registryAvailable && <>
        <div style={styles.homeFinanceGrid}>
          <div style={styles.accountingStat}><span>Fiches affichées</span><strong>{view.summary.registryRows}</strong></div>
          <div style={styles.accountingStat}><span>Dont paiement non daté</span><strong>{view.summary.withoutPaymentDate}</strong></div>
          <div style={styles.accountingStat}><span>Sans date ni séjour (hors exercice)</span><strong>{view.undatedRegistryRows.length}</strong></div>
        </div>
        <div style={tableBox}><table style={{...styles.table,minWidth:1180}}><thead><tr>
          <th style={styles.th}>Plateforme / référence</th><th style={styles.th}>Séjour</th><th style={styles.th}>Date paiement</th><th style={styles.th}>Montant voyageur</th><th style={styles.th}>Taxe indiquée</th><th style={styles.th}>Net plateforme</th><th style={styles.th}>Lien journal</th><th style={styles.th}>Provenance enregistrée</th><th style={styles.th}>Mise à jour fiche</th>
        </tr></thead><tbody>
          {view.registryRows.map(row=><tr key={row.id || `${row.source}:${row.external_reference}`}>
            <td style={styles.td}><strong>{labelSource(row.source)}</strong><div>{row.external_reference}</div></td>
            <td style={styles.td}>{row.start_date || '—'}{row.end_date ? ` → ${row.end_date}` : ''}</td>
            <td style={styles.td}>{row.payment_date || <strong>Inconnue — séjour uniquement</strong>}</td>
            <td style={styles.td}>{euro(row.traveler_total)}</td>
            <td style={styles.td}>{euro(row.tourist_tax_amount)}</td>
            <td style={styles.td}>{euro(row.net_payout)}</td>
            <td style={styles.td}>{!ledgerAvailable ? 'Contrôle indisponible' : row.journalLinks.length === 0 ? 'Aucune recette liée' : row.hasIncomeThisYear ? `${row.journalLinks.length} recette(s) — ${year}` : `Recette(s) d'un autre exercice : ${row.journalYears.join(', ')}`}</td>
            <td style={styles.td}>{sourceTags(row.provenance).join(' + ') || 'Source non précisée'}<div style={small}>Nom du fichier non suivi par le registre</div></td>
            <td style={styles.td}>{localeDate(row.updated_at || row.created_at)}</td>
          </tr>)}
          {!view.registryRows.length && <tr><td style={styles.td} colSpan="9">Aucune fiche associée à cet exercice avec ces filtres. Vérifie aussi les fiches sans date plus bas.</td></tr>}
        </tbody></table></div>
        {view.undatedRegistryRows.length > 0 && <details><summary><strong>{view.undatedRegistryRows.length} fiche(s) sans date de paiement ni date de séjour</strong> — exercice indéterminé</summary><p style={styles.muted}>{view.undatedRegistryRows.map(item=>`${labelSource(item.source)} ${item.external_reference}`).join(' · ')}</p></details>}
      </>}
    </div>
    {ledgerAvailable && registryAvailable && <div>
      <h4>Recettes du journal sans fiche au registre financier ({view.unmatchedIncomeRows.length})</h4>
      <p style={styles.muted}>Correspondance par plateforme et référence exacte, sans déduction de montant ni affectation de date. Une ligne affichée ici ne doit pas être réimportée automatiquement.</p>
      <div style={tableBox}><table style={{...styles.table,minWidth:650}}><thead><tr>
        <th style={styles.th}>Date écriture</th><th style={styles.th}>Plateforme</th><th style={styles.th}>Référence</th><th style={styles.th}>Montant comptable</th><th style={styles.th}>Fichier / lot associé</th>
      </tr></thead><tbody>
        {view.unmatchedIncomeRows.map(entry=><tr key={entry.id}><td style={styles.td}>{entry.entry_date}</td><td style={styles.td}>{labelSource(entry.source)}</td><td style={styles.td}>{entry.external_reference}</td><td style={styles.td}>{euro(entry.amount_ttc)}</td><td style={styles.td}>{batches.find(batch=>batch.id===entry.import_batch_id)?.original_filename || 'Non renseigné'}</td></tr>)}
        {!view.unmatchedIncomeRows.length && <tr><td style={styles.td} colSpan="5">Aucune recette plateforme sans fiche financière dans la sélection.</td></tr>}
      </tbody></table></div>
    </div>}
    <p style={styles.muted}>Ce tableau consulte les enregistrements existants ; il ne conserve pas rétroactivement le nom des CSV qui ont seulement alimenté le registre financier, ne crée pas d'écritures et ne constitue pas une validation fiscale.</p>
  </section>;
}
