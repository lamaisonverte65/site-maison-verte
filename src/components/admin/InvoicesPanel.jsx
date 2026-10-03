import { useMemo, useState } from "react";
import { styles } from "./adminStyles";
import { formatMoney } from "../../utils/adminFormatters";
import { archiveInvoicePdf, archiveCreditNotePdf, createDirectInvoiceDraft, issueInvoice, issueCreditNote, openInvoicePdf, openInvoicePreviewPdf, openCreditNotePdf, openCreditNotePreviewPdf, updateCreditNoteDraft, updateInvoiceCustomerSnapshot, updateLegacyInvoiceFinancialSnapshot } from "../../services/invoiceService";

const fmtDate = (value) => value ? new Date(value).toLocaleDateString("fr-FR") : "—";
const sourceLabel = (source) => ({ direct: "Direct", booking: "Booking", airbnb: "Airbnb" }[source] || source || "—");

function customerName(invoice) {
  const c = invoice.customer_snapshot || {};
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || c.name || "Client non renseigné";
}

function stayLabel(invoice) {
  const s = invoice.stay_snapshot || {};
  return s.start_date && s.end_date ? `${fmtDate(s.start_date)} → ${fmtDate(s.end_date)}` : "—";
}

const REQUIRED_CUSTOMER_FIELDS = [
  ["first_name", "Prénom"],
  ["last_name", "Nom"],
];

const OPTIONAL_BILLING_FIELDS = [
  ["address", "Adresse"],
  ["postal_code", "Code postal"],
  ["city", "Ville"],
  ["country", "Pays"],
];

function missingCustomerFields(invoice) {
  const customer = invoice?.customer_snapshot || {};
  return REQUIRED_CUSTOMER_FIELDS
    .filter(([key]) => !String(customer[key] ?? "").trim())
    .map(([, label]) => label);
}

function missingOptionalBillingFields(invoice) {
  const customer = invoice?.customer_snapshot || {};
  return OPTIONAL_BILLING_FIELDS
    .filter(([key]) => !String(customer[key] ?? "").trim())
    .map(([, label]) => label);
}

function BookingInvoiceSummary({ invoice }) {
  const f = invoice.financial_snapshot || {};
  const payments = Array.isArray(invoice.payment_snapshot) ? invoice.payment_snapshot : [];
  const bookingPayment = payments.find((p) => p.payment_type === "booking_platform");
  const computed = Number(f.accommodation_net || 0) + Number(f.cleaning_fee || 0) + Number(f.tourist_tax_amount || 0);
  const total = Number(invoice.total_amount || 0);
  const coherent = Math.abs(computed - total) < 0.009;
  return <div style={{marginTop:14,padding:12,border:"1px solid #16a34a",borderRadius:12}}>
    <strong>Détail de la facture Booking</strong>
    <p style={{...styles.muted,marginBottom:8}}>Référence Booking : <strong>{invoice.external_reference || "Non renseignée"}</strong></p>
    <div style={styles.detailGrid}>
      <span>Hébergement : <strong>{formatMoney(f.accommodation_net)}</strong></span>
      <span>Ménage : <strong>{formatMoney(f.cleaning_fee)}</strong></span>
      <span>Taxe de séjour : <strong>{formatMoney(f.tourist_tax_amount)}</strong></span>
      <span>Total voyageur : <strong>{formatMoney(invoice.total_amount)}</strong></span>
    </div>
    <p style={coherent ? styles.info : styles.error}>{coherent ? "Contrôle OK : les composantes correspondent au total voyageur." : "Erreur : le détail financier ne correspond pas au total voyageur."}</p>
    <p style={{...styles.muted,marginBottom:0}}>Paiement : <strong>{bookingPayment ? `via Booking.com — ${formatMoney(bookingPayment.amount)}` : "Non renseigné"}</strong></p>
    <details style={{marginTop:8}}>
      <summary style={{cursor:"pointer"}}>Informations plateforme (internes, non imprimées sur la facture)</summary>
      <div style={{...styles.detailGrid,marginTop:8}}>
        <span>Commission Booking : <strong>{f.platform_commission == null ? "Non renseignée" : formatMoney(f.platform_commission)}</strong></span>
        <span>Frais de paiement : <strong>{f.platform_payment_fee == null ? "Non renseignés" : formatMoney(f.platform_payment_fee)}</strong></span>
        <span>Net versé LMV : <strong>{f.platform_net_payout == null ? "Non renseigné" : formatMoney(f.platform_net_payout)}</strong></span>
      </div>
    </details>
  </div>;
}

function DraftEditor({ invoice, onChanged }) {
  const initial = invoice.customer_snapshot || {};
  const [form, setForm] = useState({
    first_name: initial.first_name || "", last_name: initial.last_name || "", company_name: initial.company_name || "", email: initial.email || "", phone: initial.phone || "",
    address: initial.address || "", postal_code: initial.postal_code || "", city: initial.city || "", country: initial.country || "France",
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  async function save() {
    setBusy(true); setMessage("");
    try {
      const updated = await updateInvoiceCustomerSnapshot(invoice.id, { ...initial, ...form });
      onChanged(updated); setMessage("Coordonnées enregistrées.");
    } catch (error) { setMessage(`Erreur : ${error.message}`); }
    finally { setBusy(false); }
  }
  return <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
    <div style={styles.detailGrid}>
      {[["first_name","Prénom",true],["last_name","Nom",true],["company_name","Entreprise / raison sociale",false],["address","Adresse",false],["postal_code","Code postal",false],["city","Ville",false],["country","Pays",false],["email","Email",false],["phone","Téléphone",false]].map(([key,label,required]) =>
        <label key={key} style={{ display:"grid", gap:4 }}><span style={{ fontSize:12, fontWeight:700, color:"#64748b" }}>{label}{required ? " *" : ""}</span><input style={styles.input} value={form[key]} placeholder={required ? "À compléter avant émission" : "Non renseigné"} onChange={(e)=>update(key,e.target.value)} /></label>
      )}
    </div>
    <p style={{...styles.muted,margin:0}}>* Prénom et nom sont requis. Entreprise, adresse, code postal, ville, pays, email et téléphone peuvent être complétés lorsqu’ils sont disponibles.</p>
    <div><button style={styles.smallButton} disabled={busy} onClick={save}>{busy ? "Enregistrement…" : "Enregistrer le brouillon"}</button></div>
    {message && <p style={message.startsWith("Erreur") ? styles.error : styles.info}>{message}</p>}
  </div>;
}

function ReconstructedLegacyNotice({ invoice }) {
  const f = invoice.financial_snapshot || {};
  const nightly = Array.isArray(f.reconstruction?.nightly) ? f.reconstruction.nightly : [];
  return <div style={{marginTop:14,padding:12,border:"1px solid #16a34a",borderRadius:12}}><strong>Réservation Direct historique — détail reconstruit automatiquement</strong><p style={styles.muted}>Le tarif historique conservé en base correspond exactement au total de la réservation. Aucun ménage, remise ou taxe de séjour n’est ajouté rétroactivement.</p><div style={styles.detailGrid}><span>Hébergement : <strong>{formatMoney(f.accommodation_net)}</strong></span><span>Ménage : <strong>{formatMoney(f.cleaning_fee)}</strong></span><span>Taxe facturée : <strong>{formatMoney(f.tourist_tax_amount)}</strong></span><span>Total : <strong>{formatMoney(invoice.total_amount)}</strong></span></div>{nightly.length > 0 && <p style={styles.muted}>{nightly.length} nuit(s) reconstituée(s) depuis le tarif historique.</p>}</div>;
}

function LegacyFinancialEditor({ invoice, onChanged }) {
  const f = invoice.financial_snapshot || {};
  const [form, setForm] = useState({ accommodation_gross: f.accommodation_gross ?? "", promotion_discount_amount: f.promotion_discount_amount ?? 0, accommodation_net: f.accommodation_net ?? "", cleaning_fee: f.cleaning_fee ?? "", tourist_tax_amount: f.tourist_tax_amount ?? "" });
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const update = (key,value) => setForm((x)=>({...x,[key]:value}));
  const reference = Number(f.legacy_reference_total || invoice.total_amount || 0);
  const computed = [form.accommodation_net,form.cleaning_fee,form.tourist_tax_amount].reduce((sum,v)=>sum+(v===""?0:Number(v)||0),0);
  async function save(){ setBusy(true); setMessage(""); try { const updated=await updateLegacyInvoiceFinancialSnapshot(invoice,form); onChanged(updated); setMessage("Détail financier historique enregistré."); } catch(e){ setMessage(`Erreur : ${e.message}`); } finally { setBusy(false); } }
  async function reconstruct(){ setBusy(true); setMessage(""); try { const result=await createDirectInvoiceDraft(invoice.booking_request_id); if(result.reconstructed){ await onChanged(result.invoice); setMessage("Détail financier reconstruit automatiquement depuis le tarif historique."); } else setMessage("Reconstruction automatique non démontrable : conserve la saisie manuelle à partir des justificatifs."); } catch(e){ setMessage(`Erreur : ${e.message}`); } finally { setBusy(false); } }
  return <div style={{marginTop:14,padding:12,border:"1px solid #f59e0b",borderRadius:12}}><strong>Réservation Direct historique — détail à confirmer</strong><p style={styles.muted}>Total historique connu : {formatMoney(reference)}. La reconstruction automatique n’est acceptée que si le tarif conservé en base correspond exactement au total et si la réservation est antérieure aux fonctions ménage/taxe/remise. Sinon, répartis le total à partir de tes justificatifs. Aucune valeur manquante n’est inventée.</p><div style={{marginBottom:10}}><button style={styles.smallButton} disabled={busy} onClick={reconstruct}>{busy?"Vérification…":"Tenter la reconstruction automatique"}</button></div>
    <div style={styles.detailGrid}>{[["accommodation_gross","Hébergement brut (facultatif)"],["promotion_discount_amount","Remise (facultatif)"],["accommodation_net","Hébergement net"],["cleaning_fee","Ménage (0 si aucun)"],["tourist_tax_amount","Taxe de séjour (0 si aucune)" ]].map(([key,label])=><label key={key} style={{display:"grid",gap:4}}><span style={{fontSize:12,fontWeight:700,color:"#64748b"}}>{label}</span><input type="number" step="0.01" min="0" style={styles.input} value={form[key]} onChange={(e)=>update(key,e.target.value)} /></label>)}</div>
    <p style={Math.abs(computed-reference)<0.009?styles.info:styles.error}>Total du détail : {formatMoney(computed)} / {formatMoney(reference)}</p><button style={styles.smallButton} disabled={busy} onClick={save}>{busy?"Enregistrement…":"Valider le détail financier"}</button>{message&&<p style={message.startsWith("Erreur")?styles.error:styles.info}>{message}</p>}</div>;
}

function CreditNoteDraftEditor({ note, onChanged }) {
  const f = note.financial_snapshot || {};
  const [form, setForm] = useState({ accommodationRefund: f.accommodation_refund ?? "", cleaningRefund: f.cleaning_refund ?? "" });
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const tax = Number(f.tourist_tax_refund || 0), total = Number(note.total_amount || 0);
  const computed = (Number(form.accommodationRefund)||0) + (Number(form.cleaningRefund)||0) + tax;
  async function save(){setBusy(true);setMessage("");try{const result=await updateCreditNoteDraft(note.id,form);await onChanged?.(result.creditNote);setMessage("Ventilation de l’avoir enregistrée.");}catch(e){setMessage(`Erreur : ${e.message}`);}finally{setBusy(false);}}
  return <div style={{marginTop:14,padding:12,border:"1px solid #f59e0b",borderRadius:12}}>
    <strong>Ventilation de l’avoir</strong>
    <p style={styles.muted}>Le total et la taxe remboursée proviennent du remboursement réel. Si la répartition n’est pas démontrable automatiquement, répartis uniquement hébergement et ménage.</p>
    <div style={styles.detailGrid}>
      <label style={{display:"grid",gap:4}}><span>Hébergement remboursé</span><input type="number" step="0.01" min="0" style={styles.input} value={form.accommodationRefund} onChange={(e)=>setForm((x)=>({...x,accommodationRefund:e.target.value}))}/></label>
      <label style={{display:"grid",gap:4}}><span>Ménage remboursé</span><input type="number" step="0.01" min="0" style={styles.input} value={form.cleaningRefund} onChange={(e)=>setForm((x)=>({...x,cleaningRefund:e.target.value}))}/></label>
      <span>Taxe remboursée : <strong>{formatMoney(tax)}</strong></span><span>Total de l’avoir : <strong>{formatMoney(total)}</strong></span>
    </div>
    <p style={Math.round(computed*100)===Math.round(total*100)?styles.info:styles.error}>Ventilation : {formatMoney(computed)} / {formatMoney(total)}</p>
    <button style={styles.smallButton} disabled={busy} onClick={save}>{busy?"Enregistrement…":"Valider la ventilation"}</button>{message&&<p style={message.startsWith("Erreur")?styles.error:styles.info}>{message}</p>}
  </div>;
}

export default function InvoicesPanel({ invoices = [], creditNotes = [], onRefresh, onOpenReservation }) {
  const [search, setSearch] = useState("");
  const [year, setYear] = useState("all");
  const [source, setSource] = useState("all");
  const [selectedKey, setSelectedKey] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState("");
  const invoiceById = useMemo(()=>new Map(invoices.map((invoice)=>[invoice.id,invoice])),[invoices]);
  const documents = useMemo(()=>[
    ...invoices.map((invoice)=>({...invoice,documentType:"invoice",documentKey:`invoice:${invoice.id}`})),
    ...creditNotes.map((note)=>{const linked=invoiceById.get(note.invoice_id);return {...note,source:linked?.source||"direct",external_reference:linked?.external_reference||null,invoice_number:linked?.invoice_number||note.refund_snapshot?.invoice_number||null,documentType:"credit_note",documentKey:`credit_note:${note.id}`};}),
  ],[invoices,creditNotes,invoiceById]);
  const years = useMemo(() => [...new Set(documents.map((d) => String(new Date(d.issued_at || d.created_at).getFullYear())))].sort().reverse(), [documents]);
  const rows = useMemo(() => documents.filter((doc) => {
    const number = doc.documentType === "credit_note" ? doc.credit_note_number : doc.invoice_number;
    const haystack = `${number || ""} ${doc.invoice_number || ""} ${customerName(doc)} ${doc.external_reference || ""} ${doc.refund_operation_id || ""}`.toLowerCase();
    const docYear = String(new Date(doc.issued_at || doc.created_at).getFullYear());
    return (!search || haystack.includes(search.toLowerCase())) && (year === "all" || docYear === year) && (source === "all" || doc.source === source);
  }), [documents, search, year, source]);
  const selected = documents.find((d)=>d.documentKey===selectedKey) || null;
  const selectedInvoice = selected?.documentType === "invoice" ? selected : null;
  const selectedCreditNote = selected?.documentType === "credit_note" ? selected : null;
  const linkedCreditNotes = selectedInvoice ? creditNotes.filter((note)=>note.invoice_id===selectedInvoice.id) : [];
  const issuedCreditNotes = linkedCreditNotes.filter((note)=>note.status==="issued");
  const issuedCreditTotal = issuedCreditNotes.reduce((sum,note)=>sum+Number(note.total_amount||0),0);

  async function issueAndArchive(invoice) {
    if (!window.confirm("Émettre cette facture ? Le numéro sera attribué et son contenu deviendra définitif.")) return;
    setBusyId(invoice.id); setMessage("");
    try { const issued=await issueInvoice(invoice.id); try{await archiveInvoicePdf(issued.id);}catch(pdfError){setMessage(`Facture ${issued.invoice_number} émise, mais PDF non archivé : ${pdfError.message}. Tu peux relancer l’archivage.`);await onRefresh?.();return;} setMessage(`Facture ${issued.invoice_number} émise et PDF archivé.`);await onRefresh?.(); }
    catch(error){setMessage(`Erreur : ${error.message}`);} finally{setBusyId(null);}
  }
  async function issueCreditAndArchive(note){
    if(!window.confirm("Émettre cet avoir ? Le numéro sera attribué et son contenu deviendra définitif."))return;
    setBusyId(note.id);setMessage("");try{const issued=await issueCreditNote(note.id);try{await archiveCreditNotePdf(issued.id);}catch(pdfError){setMessage(`Avoir ${issued.credit_note_number} émis, mais PDF non archivé : ${pdfError.message}. Tu peux relancer l’archivage.`);await onRefresh?.();return;}setMessage(`Avoir ${issued.credit_note_number} émis et PDF archivé.`);await onRefresh?.();}catch(error){setMessage(`Erreur : ${error.message}`);}finally{setBusyId(null);}
  }
  async function archive(invoice){setBusyId(invoice.id);setMessage("");try{await archiveInvoicePdf(invoice.id);setMessage("PDF archivé.");await onRefresh?.();}catch(error){setMessage(`Erreur : ${error.message}`);}finally{setBusyId(null);}}
  async function archiveCredit(note){setBusyId(note.id);setMessage("");try{await archiveCreditNotePdf(note.id);setMessage("PDF d’avoir archivé.");await onRefresh?.();}catch(error){setMessage(`Erreur : ${error.message}`);}finally{setBusyId(null);}}
  async function viewPdf(invoice){try{await openInvoicePdf(invoice.id);}catch(error){setMessage(`Erreur : ${error.message}`);}}
  async function previewPdf(invoice){try{await openInvoicePreviewPdf(invoice.id);}catch(error){setMessage(`Erreur : ${error.message}`);}}
  async function viewCreditPdf(note){try{await openCreditNotePdf(note.id);}catch(error){setMessage(`Erreur : ${error.message}`);}}
  async function previewCreditPdf(note){try{await openCreditNotePreviewPdf(note.id);}catch(error){setMessage(`Erreur : ${error.message}`);}}

  return <section style={styles.panel}>
    <div style={styles.panelHeader}><div><h2 style={styles.panelTitle}>Factures clients</h2><p style={styles.muted}>Factures et avoirs, brouillons ou émis. Les numéros définitifs ne sont attribués qu’à l’émission.</p></div></div>
    <div style={styles.toolbar}><input style={styles.searchInput} placeholder="N° facture/avoir, client, référence…" value={search} onChange={(e)=>setSearch(e.target.value)}/><select style={styles.select} value={year} onChange={(e)=>setYear(e.target.value)}><option value="all">Toutes les années</option>{years.map((y)=><option key={y} value={y}>{y}</option>)}</select><select style={styles.select} value={source} onChange={(e)=>setSource(e.target.value)}><option value="all">Toutes les sources</option><option value="direct">Direct</option><option value="booking">Booking</option><option value="airbnb">Airbnb</option></select></div>
    {message&&<p style={message.startsWith("Erreur")?styles.error:styles.info}>{message}</p>}
    {!rows.length?<p style={styles.muted}>Aucun document pour ces critères.</p>:<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{["Type","N°","Date","Client","Séjour","Source","Montant","Statut","PDF"].map((h)=><th key={h} style={{textAlign:"left",padding:"9px",borderBottom:"1px solid #e5e7eb"}}>{h}</th>)}</tr></thead><tbody>{rows.map((doc)=>{const isCredit=doc.documentType==="credit_note";return <tr key={doc.documentKey} onClick={()=>setSelectedKey(doc.documentKey)} style={{cursor:"pointer"}}><td style={{padding:9}}>{isCredit?"Avoir":"Facture"}</td><td style={{padding:9}}>{isCredit?(doc.credit_note_number||"Brouillon"):(doc.invoice_number||"Brouillon")}</td><td style={{padding:9}}>{fmtDate(doc.issued_at||doc.created_at)}</td><td style={{padding:9}}>{customerName(doc)}</td><td style={{padding:9}}>{stayLabel(doc)}</td><td style={{padding:9}}>{sourceLabel(doc.source)}</td><td style={{padding:9}}>{formatMoney(doc.total_amount)}</td><td style={{padding:9}}>{doc.status==="issued"?"Émis":"Brouillon"}</td><td style={{padding:9}}>{doc.pdf_storage_path?"Archivé":"—"}</td></tr>;})}</tbody></table></div>}

    {selectedInvoice&&<section style={{marginTop:18,padding:14,border:"1px solid #e5e7eb",borderRadius:16}}>
      <div style={styles.panelHeader}><div><h3 style={styles.subTitle}>{selectedInvoice.invoice_number||"Brouillon de facture"}</h3><p style={styles.muted}>{customerName(selectedInvoice)} — {stayLabel(selectedInvoice)} — {formatMoney(selectedInvoice.total_amount)}</p></div><button style={styles.smallButton} onClick={()=>setSelectedKey(null)}>Fermer</button></div>
      {selectedInvoice.booking_request_id&&<button style={styles.smallButton} onClick={()=>onOpenReservation?.(selectedInvoice.booking_request_id)}>Ouvrir la réservation</button>}
      {selectedInvoice.status==="issued"&&<div style={{marginTop:12,padding:10,border:"1px solid #cbd5e1",borderRadius:10}}><strong>Avoirs émis : {formatMoney(issuedCreditTotal)}</strong><p style={{...styles.muted,margin:"4px 0"}}>Net après avoirs : <strong>{formatMoney(Math.max(Number(selectedInvoice.total_amount||0)-issuedCreditTotal,0))}</strong></p>{linkedCreditNotes.map((note)=><button key={note.id} style={{...styles.smallButton,marginRight:6}} onClick={()=>setSelectedKey(`credit_note:${note.id}`)}>{note.credit_note_number||"Brouillon d’avoir"} — {formatMoney(note.total_amount)}</button>)}</div>}
      {selectedInvoice.status==="draft"&&<><DraftEditor invoice={selectedInvoice} onChanged={async()=>{await onRefresh?.();}}/>{selectedInvoice.source==="booking"&&<BookingInvoiceSummary invoice={selectedInvoice}/>} {selectedInvoice.financial_snapshot?.draft_origin==="legacy_direct_manual"&&(selectedInvoice.financial_snapshot?.reconstruction?.method==="historical_tariff_match"?<ReconstructedLegacyNotice invoice={selectedInvoice}/>:<LegacyFinancialEditor invoice={selectedInvoice} onChanged={async()=>{await onRefresh?.();}}/>)}{(()=>{const legacyNotReady=selectedInvoice.financial_snapshot?.draft_origin==="legacy_direct_manual"&&selectedInvoice.financial_snapshot?.invoice_ready !== true;const missing=missingCustomerFields(selectedInvoice);const optionalMissing=missingOptionalBillingFields(selectedInvoice);const customerNotReady=missing.length>0;const issueDisabled=busyId===selectedInvoice.id||legacyNotReady||customerNotReady;return <div style={{marginTop:12,display:"grid",gap:8,justifyItems:"start"}}>{legacyNotReady&&<p style={styles.muted}>Valide d’abord le détail financier pour pouvoir émettre la facture.</p>}{customerNotReady&&<p style={styles.error}>Identité client à compléter avant émission : {missing.join(", ")}. Enregistre ensuite le brouillon.</p>}{!customerNotReady&&optionalMissing.length>0&&<p style={styles.muted}>Coordonnées de facturation non renseignées : {optionalMissing.join(", ")}. Tu peux les compléter et enregistrer le brouillon, mais elles ne verrouillent pas l’émission pour ce client particulier.</p>}<div style={{display:"flex",gap:8}}><button style={styles.smallButton} onClick={()=>previewPdf(selectedInvoice)}>Aperçu PDF</button><button style={issueDisabled ? {...styles.smallButton,cursor:"not-allowed",opacity:0.75} : styles.smallButton} disabled={issueDisabled} onClick={()=>issueAndArchive(selectedInvoice)}>{busyId===selectedInvoice.id?"Traitement…":issueDisabled?"Émission verrouillée":"Émettre la facture"}</button></div></div>;})()}</>}
      {selectedInvoice.status==="issued"&&<div style={{display:"flex",gap:8,marginTop:12}}>{selectedInvoice.pdf_storage_path?<button style={styles.smallButton} onClick={()=>viewPdf(selectedInvoice)}>Voir le PDF</button>:<button style={styles.smallButton} onClick={()=>archive(selectedInvoice)}>Archiver le PDF</button>}</div>}
    </section>}

    {selectedCreditNote&&<section style={{marginTop:18,padding:14,border:"1px solid #e5e7eb",borderRadius:16}}>
      <div style={styles.panelHeader}><div><h3 style={styles.subTitle}>{selectedCreditNote.credit_note_number||"Brouillon d’avoir"}</h3><p style={styles.muted}>{customerName(selectedCreditNote)} — {formatMoney(selectedCreditNote.total_amount)} — {selectedCreditNote.financial_snapshot?.credit_note_kind==="full"?"Avoir total":"Avoir partiel"}</p></div><button style={styles.smallButton} onClick={()=>setSelectedKey(null)}>Fermer</button></div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button style={styles.smallButton} onClick={()=>setSelectedKey(`invoice:${selectedCreditNote.invoice_id}`)}>Ouvrir la facture</button>{selectedCreditNote.booking_request_id&&<button style={styles.smallButton} onClick={()=>onOpenReservation?.(selectedCreditNote.booking_request_id)}>Ouvrir la réservation</button>}</div>
      {selectedCreditNote.status==="draft"&&<><CreditNoteDraftEditor note={selectedCreditNote} onChanged={async()=>{await onRefresh?.();}}/><div style={{display:"flex",gap:8,marginTop:12}}><button style={styles.smallButton} onClick={()=>previewCreditPdf(selectedCreditNote)}>Aperçu PDF</button><button style={styles.smallButton} disabled={busyId===selectedCreditNote.id||selectedCreditNote.financial_snapshot?.manual_required===true} onClick={()=>issueCreditAndArchive(selectedCreditNote)}>{busyId===selectedCreditNote.id?"Traitement…":"Émettre l’avoir"}</button></div></>}
      {selectedCreditNote.status==="issued"&&<div style={{display:"flex",gap:8,marginTop:12}}>{selectedCreditNote.pdf_storage_path?<button style={styles.smallButton} onClick={()=>viewCreditPdf(selectedCreditNote)}>Voir le PDF</button>:<button style={styles.smallButton} onClick={()=>archiveCredit(selectedCreditNote)}>Archiver le PDF</button>}</div>}
    </section>}
  </section>;
}
