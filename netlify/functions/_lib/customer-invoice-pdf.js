const money = (value) => `${Number(value || 0).toFixed(2).replace('.', ',')} €`;
const dateFr = (value) => {
  if (!value) return '-';
  const d = new Date(String(value).length <= 10 ? `${value}T12:00:00Z` : value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
};
const clean = (v) => String(v ?? '').trim();
const paymentLabel = (type) => ({ deposit: 'Acompte', balance: 'Solde', full: 'Paiement intégral', manual: 'Paiement manuel', booking_platform: 'Paiement via Booking.com' }[type] || clean(type) || 'Paiement');

function pdfEscape(text) {
  return clean(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[\r\n]+/g, ' ');
}
function latin1(text) {
  return Buffer.from(text.replace(/[–—]/g, '-').replace(/€/g, '\x80').replace(/’/g, "'"), 'latin1');
}

export function invoicePdfModel(invoice, { preview = false } = {}) {
  if (!invoice) throw new Error('invoice_required');
  if (preview) {
    if (invoice.status !== 'draft') throw new Error('draft_invoice_required');
  } else if (invoice.status !== 'issued' || !invoice.invoice_number || !invoice.issued_at) {
    throw new Error('issued_invoice_required');
  }
  const seller = invoice.seller_snapshot || {};
  const customer = invoice.customer_snapshot || {};
  const stay = invoice.stay_snapshot || {};
  const f = invoice.financial_snapshot || {};
  const payments = Array.isArray(invoice.payment_snapshot) ? invoice.payment_snapshot : [];
  const paid = payments.reduce((sum, p) => {
    if (['failed', 'cancelled', 'canceled'].includes(String(p.status || '').toLowerCase())) return sum;
    return sum + Math.max(Number(p.amount || 0) - Number(p.refunded_amount || 0), 0);
  }, 0);
  const remaining = Math.max(Number(invoice.total_amount || 0) - paid, 0);
  const lines = [];
  const add = (t, size=10, bold=false, x=50, advance=true) => lines.push({ t, size, bold, x, advance });
  const sep = () => lines.push({ separator:true });

  add(preview ? 'APERÇU - BROUILLON DE FACTURE' : `FACTURE N° ${invoice.invoice_number}`, 19, true);
  if (preview) add('', 12);
  add(preview ? 'Document non émis - sans numéro de facture' : `Date d'émission : ${dateFr(invoice.issued_at)}`, 9, preview);
  if (invoice.source === 'booking' && invoice.external_reference) add(`Référence Booking : ${invoice.external_reference}`, 9);
  add('', 7);
  sep();

  const sellerRows = [
    { t: 'ÉMETTEUR', size: 11, bold: true },
    { t: clean(seller.legal_name), size: 10 },
    ...(seller.trade_name ? [{ t: clean(seller.trade_name), size: 10 }] : []),
    { t: [clean(seller.address), [clean(seller.postal_code), clean(seller.city)].filter(Boolean).join(' ')].filter(Boolean).join(' - '), size: 10 },
    ...(seller.country ? [{ t: clean(seller.country), size: 10 }] : []),
    { t: `SIRET ${seller.siret || ''}`, size: 10 },
  ];
  const customerRows = [
    { t: 'CLIENT', size: 11, bold: true },
    { t: `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || '-', size: 10 },
    ...(customer.company_name ? [{ t: `Entreprise : ${clean(customer.company_name)}`, size: 10, bold: true }] : []),
    ...(customer.address ? [{ t: clean(customer.address), size: 10 }] : []),
    ...(customer.postal_code || customer.city ? [{ t: `${customer.postal_code || ''} ${customer.city || ''}`.trim(), size: 10 }] : []),
    ...(customer.country ? [{ t: clean(customer.country), size: 10 }] : []),
    ...(customer.email ? [{ t: `Email : ${customer.email}`, size: 9 }] : []),
    ...(customer.phone ? [{ t: `Téléphone : ${customer.phone}`, size: 9 }] : []),
  ];
  const blockRows = Math.max(sellerRows.length, customerRows.length);
  for (let i = 0; i < blockRows; i += 1) {
    const left = sellerRows[i];
    const right = customerRows[i];
    if (left) add(left.t, left.size, left.bold, 50, false);
    if (right) add(right.t, right.size, right.bold, 320, false);
    lines.push({ rowBreak: true, size: Math.max(left?.size || 0, right?.size || 0, 10) });
  }
  sep();

  add('SÉJOUR', 11, true);
  add(`${stay.accommodation_name || seller.accommodation_name || 'La Maison Verte'} - ${stay.accommodation_address || seller.accommodation_address || ''}, ${stay.accommodation_postal_code || seller.accommodation_postal_code || ''} ${stay.accommodation_city || seller.accommodation_city || ''}`, 10);
  const people=[];
  if (stay.nights != null) people.push(`${stay.nights} nuit${Number(stay.nights)>1?'s':''}`);
  if (stay.adults_count != null) people.push(`${stay.adults_count} adulte${Number(stay.adults_count)>1?'s':''}`);
  if (Number(stay.children_count || 0)>0) people.push(`${stay.children_count} enfant${Number(stay.children_count)>1?'s':''}`);
  add(`Du ${dateFr(stay.start_date)} au ${dateFr(stay.end_date)}${people.length ? ` - ${people.join(' - ')}` : ''}`, 10);
  sep();

  add('DÉTAIL DE LA FACTURE', 11, true);
  const booking = invoice.source === 'booking';
  const discount = Number(f.promotion_discount_amount || 0);
  if (!booking && f.accommodation_gross != null && discount > 0) {
    add(`Hébergement avant remise`, 10, false, 60); add(money(f.accommodation_gross), 10, false, 430);
    add(`Remise`, 10, false, 60); add(`-${money(discount)}`, 10, false, 430);
  }
  add('Hébergement', 10, false, 60); add(money(f.accommodation_net ?? f.accommodation_gross), 10, false, 430);
  if (booking || Number(f.cleaning_fee || 0) !== 0) { add('Ménage', 10, false, 60); add(money(f.cleaning_fee), 10, false, 430); }
  add('Taxe de séjour', 10, false, 60); add(money(f.tourist_tax_amount), 10, false, 430);
  sep();
  add('TOTAL', 13, true, 60); add(money(invoice.total_amount), 13, true, 430);
  sep();

  add('RÈGLEMENT', 11, true);
  if (!payments.length) add('Aucun paiement enregistré à la date d’émission.', 10);
  for (const p of payments) {
    const paidDate = p.paid_at ? ` - ${dateFr(p.paid_at)}` : '';
    add(`${paymentLabel(p.payment_type)}${paidDate}`, 10, false, 60);
    add(`${money(p.amount)}${Number(p.refunded_amount || 0) ? ` (remboursé ${money(p.refunded_amount)})` : ''}`, 10, false, 430);
  }
  add('Montant réglé', 10, true, 60); add(money(paid), 10, true, 430);
  add('Reste à régler', 10, true, 60); add(money(remaining), 10, true, 430);

  if (booking) {
    const commission=Number(f.platform_commission);
    const paymentFee=Number(f.platform_payment_fee);
    if (Number.isFinite(commission) || Number.isFinite(paymentFee)) {
      const platformFees=(Number.isFinite(commission)?commission:0)+(Number.isFinite(paymentFee)?paymentFee:0);
      sep();
      add('INFORMATION BOOKING.COM', 10, true);
      add(`Commission et frais Booking.com supportés par La Maison Verte : ${money(platformFees)}`, 9);
      add(`Ces frais ne s'ajoutent pas au montant de la facture client.`, 9);
    }
  }

  add('', 5);
  const basis = clean(seller.vat_legal_basis) || 'CGI art. 261 D, 4°';
  add(`TVA exonérée - ${basis}.`, 9);
  add('Taxe de séjour présentée séparément.', 9);
  return { lines, paid, remaining };
}
export function buildCustomerInvoicePdf(invoice, options = {}) {
  const { lines } = invoicePdfModel(invoice, options);
  let y = 800;
  const commands = ['BT'];
  let pendingLeft = false;
  for (const line of lines) {
    if (line.separator) {
      commands.push('ET');
      commands.push(`0.75 w 50 ${y - 2} m 545 ${y - 2} l S`);
      commands.push('BT');
      y -= 14;
      pendingLeft = false;
      continue;
    }
    if (line.rowBreak) {
      y -= Math.max((line.size || 10) + 5, 14);
      pendingLeft = false;
      continue;
    }
    const size = line.size || 10;
    const font = line.bold ? '/F2' : '/F1';
    const x = line.x || 50;
    commands.push(`${font} ${size} Tf`);
    commands.push(`1 0 0 1 ${x} ${y} Tm`);
    commands.push(`(${pdfEscape(line.t)}) Tj`);
    if (line.advance === false) continue;
    if (x >= 300 && pendingLeft) {
      y -= Math.max(size + 5, 14);
      pendingLeft = false;
    } else if (x < 300 && lines.some(() => false)) {
      // unreachable; retained only to keep row handling explicit
    } else if (x < 300 && (line.t === 'Hébergement avant remise' || line.t === 'Remise' || line.t === 'Hébergement' || line.t === 'Ménage' || line.t === 'Taxe de séjour' || line.t === 'TOTAL' || line.t === 'Montant réglé' || line.t === 'Reste à régler' || line.t.startsWith('Paiement via') || line.t.startsWith('Acompte') || line.t.startsWith('Solde') || line.t.startsWith('Paiement intégral') || line.t.startsWith('Paiement manuel'))) {
      pendingLeft = true;
    } else {
      y -= line.t ? Math.max(size + 5, 14) : 8;
      pendingLeft = false;
    }
  }
  commands.push('ET');
  const stream = latin1(commands.join('\n'));
  const objects = [
    latin1('<< /Type /Catalog /Pages 2 0 R >>'),
    latin1('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    latin1('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>'),
    Buffer.concat([latin1(`<< /Length ${stream.length} >>\nstream\n`), stream, latin1('\nendstream')]),
    latin1('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'),
    latin1('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'),
  ];
  const chunks = [latin1('%PDF-1.4\n%LMV\n')];
  const offsets = [0];
  let length = chunks[0].length;
  objects.forEach((obj, i) => {
    offsets.push(length);
    const part = Buffer.concat([latin1(`${i + 1} 0 obj\n`), obj, latin1('\nendobj\n')]);
    chunks.push(part); length += part.length;
  });
  const xref = length;
  let table = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) table += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  table += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  chunks.push(latin1(table));
  return Buffer.concat(chunks);
}
