import { useEffect, useState } from 'react';
import { previewDirectStripeAccounting, commitDirectStripeAccounting } from '../../services/directStripeAccountingService';

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const money = cents => Number.isSafeInteger(cents) ? euro.format(cents / 100) : '—';
const th = { padding: '8px 10px', borderBottom: '1px solid #d1d5db', textAlign: 'left' };
const td = { padding: '8px 10px', borderBottom: '1px solid #e5e7eb', verticalAlign: 'top' };

export default function DirectStripeAccountingImport({ year, onCreated }) {
  const [preview, setPreview] = useState(null);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => { setPreview(null); setSelected([]); setError(''); setMessage(''); }, [year]);
  async function refresh() {
    setBusy(true); setError(''); setMessage('');
    try {
      const next = await previewDirectStripeAccounting(year);
      setPreview(next);
      setSelected(next.rows.filter(r => r.status === 'ready').map(r => r.id));
    } catch (e) { setPreview(null); setSelected([]); setError(e.message); }
    finally { setBusy(false); }
  }
  async function submit() {
    const chosen = (preview?.rows || []).filter(r => selected.includes(r.id) && r.status === 'ready');
    if (!chosen.length || busy) return;
    const gross = chosen.reduce((sum, r) => sum + (r.receiptAlready ? 0 : (r.amountCents || 0)), 0);
    const fees = chosen.reduce((sum, r) => sum + (r.feeAlready ? 0 : (r.feeCents || 0)), 0);
    if (!window.confirm(`Créer les écritures Stripe de ${chosen.length} paiement(s) en ${year} ?\nRecettes à inscrire : ${money(gross)}\nFrais à inscrire : ${money(fees)}\nLes recettes ne seront PAS rajoutées aux encaissements économiques du rapprochement.`)) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await commitDirectStripeAccounting(year, chosen.map(r => r.id));
      setMessage(`${result.created} écriture(s) créée(s). Les paiements déjà comptabilisés ne sont pas dupliqués.`);
      await onCreated?.();
      const next = await previewDirectStripeAccounting(year);
      setPreview(next);
      setSelected(next.rows.filter(r => r.status === 'ready').map(r => r.id));
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  const rows = preview?.rows || [];
  const readySelected = rows.filter(r => selected.includes(r.id) && r.status === 'ready');
  const selectedGross = readySelected.reduce((s, r) => s + (r.receiptAlready ? 0 : r.amountCents || 0), 0);
  const selectedFees = readySelected.reduce((s, r) => s + (r.feeAlready ? 0 : r.feeCents || 0), 0);
  return <section aria-label="Écritures directes Stripe" style={{ border: '1px solid #d1d5db', borderRadius: 10, padding: 16, marginTop: 16, minWidth: 0 }}>
    <h4 style={{ margin: '0 0 8px' }}>Paiements directs Stripe → journal comptable — {year}</h4>
    <p style={{ marginTop: 0, fontSize: 14 }}>Prévisualisation sans écriture. Les montants proviennent des paiements encaissés et des transactions Stripe de chaque paiement, jamais des totaux cumulés de la réservation. Les remboursements et suppléments nécessitent un contrôle séparé.</p>
    <button type="button" disabled={busy} onClick={refresh}>{busy ? 'Contrôle en cours…' : 'Vérifier les paiements directs'}</button>
    {error && <p role="alert" style={{ color: '#9b1c1c' }}>{error}</p>}
    {message && <p role="status">{message}</p>}
    {preview && <>
      <p><strong>{preview.readyCount}</strong> à comptabiliser · <strong>{preview.alreadyCount}</strong> déjà enregistrés · <strong>{preview.blockedCount}</strong> à examiner.</p>
      <div style={{ overflowX: 'auto' }}><table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 820 }}><thead><tr>
        <th style={th}>Choix</th><th style={th}>Date</th><th style={th}>Paiement</th><th style={th}>Brut</th><th style={th}>Frais Stripe</th><th style={th}>Net</th><th style={th}>Contrôle</th>
      </tr></thead><tbody>
        {rows.map(r => <tr key={r.id}><td style={td}><input type="checkbox" aria-label={`Comptabiliser le paiement ${r.id}`} disabled={busy || r.status !== 'ready'} checked={selected.includes(r.id) && r.status === 'ready'} onChange={e => setSelected(previous => e.target.checked ? [...previous, r.id] : previous.filter(id => id !== r.id))} /></td>
          <td style={td}>{r.date || '—'}</td><td style={td}><code>{r.id}</code><div style={{ fontSize: 12 }}>{r.paymentType || '—'}</div></td>
          <td style={td}>{money(r.amountCents)}</td><td style={td}>{money(r.feeCents)}</td><td style={td}>{money(r.netCents)}</td>
          <td style={td}>{r.status === 'ready' ? 'Prêt' : r.status === 'already_recorded' ? 'Déjà enregistré' : `Bloqué : ${r.reason}`}</td></tr>)}
        {!rows.length && <tr><td style={td} colSpan="7">Aucun paiement Stripe daté dans cet exercice.</td></tr>}
      </tbody></table></div>
      <p><strong>Sélection : {readySelected.length} paiement(s) · Recettes à ajouter au journal : {money(selectedGross)} · Frais à ajouter : {money(selectedFees)}.</strong></p>
      <p style={{ fontSize: 13 }}>Une vérification est refaite côté serveur lors de l'enregistrement. Un paiement déjà saisi ou douteux bloque son intégration. Aucun changement fiscal automatique.</p>
      <button type="button" disabled={busy || !readySelected.length} onClick={submit}>{busy ? 'Enregistrement…' : `Créer les écritures sélectionnées (${readySelected.length})`}</button>
    </>}
  </section>;
}
