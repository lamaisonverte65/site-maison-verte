const money=(v)=>`${Number(v||0).toFixed(2).replace('.',',')} €`;
const clean=(v)=>String(v??'').trim();
const dateFr=(value)=>{if(!value)return '-';const d=new Date(String(value).length<=10?`${value}T12:00:00Z`:value);if(Number.isNaN(d.getTime()))return String(value);return new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',day:'2-digit',month:'2-digit',year:'numeric'}).format(d);};
function pdfEscape(text){return clean(text).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)').replace(/[\r\n]+/g,' ');}
function latin1(text){return Buffer.from(text.replace(/[–—]/g,'-').replace(/€/g,'\x80').replace(/’/g,"'"),'latin1');}
export function creditNotePdfModel(note,{preview=false}={}){
 if(!note)throw new Error('credit_note_required');
 if(preview){if(note.status!=='draft')throw new Error('draft_credit_note_required');}
 else if(note.status!=='issued'||!note.credit_note_number||!note.issued_at)throw new Error('issued_credit_note_required');
 const seller=note.seller_snapshot||{},customer=note.customer_snapshot||{},stay=note.stay_snapshot||{},f=note.financial_snapshot||{},r=note.refund_snapshot||{};
 const kind=String(f.credit_note_kind||'partial')==='full'?'Avoir total':'Avoir partiel';
 const lines=[]; const add=(t,size=10,bold=false,x=50,advance=true)=>lines.push({t,size,bold,x,advance}); const sep=()=>lines.push({separator:true});
 add(preview?"APERÇU - BROUILLON D'AVOIR":`AVOIR N° ${note.credit_note_number}`,19,true);
 add(preview?'Document non émis - sans numéro d’avoir':`Date d'émission : ${dateFr(note.issued_at)}`,9,preview);
 add(`Avoir relatif à la facture ${r.invoice_number||'-'} du ${dateFr(r.invoice_issued_at)}`,10,true);
 add(kind,10,true); sep();
 const left=[['ÉMETTEUR',11,true],[clean(seller.legal_name),10,false],...[seller.trade_name?[[clean(seller.trade_name),10,false]]:[]],[ [clean(seller.address),[clean(seller.postal_code),clean(seller.city)].filter(Boolean).join(' ')].filter(Boolean).join(' - '),10,false],[`SIRET ${seller.siret||''}`,10,false]];
 const right=[['CLIENT',11,true],[`${customer.first_name||''} ${customer.last_name||''}`.trim()||'-',10,false],...[customer.company_name?[[`Entreprise : ${clean(customer.company_name)}`,10,true]]:[]],...[customer.address?[[clean(customer.address),10,false]]:[]],...[customer.postal_code||customer.city?[[`${customer.postal_code||''} ${customer.city||''}`.trim(),10,false]]:[]]];
 const n=Math.max(left.length,right.length);for(let i=0;i<n;i++){if(left[i])add(left[i][0],left[i][1],left[i][2],50,false);if(right[i])add(right[i][0],right[i][1],right[i][2],320,false);lines.push({rowBreak:true,size:10});}sep();
 add('SÉJOUR',11,true);add(`${stay.accommodation_name||seller.accommodation_name||'La Maison Verte'} - ${stay.accommodation_address||seller.accommodation_address||''}, ${stay.accommodation_postal_code||seller.accommodation_postal_code||''} ${stay.accommodation_city||seller.accommodation_city||''}`,10);add(`Du ${dateFr(stay.start_date)} au ${dateFr(stay.end_date)}`,10);sep();
 add("DÉTAIL DE L'AVOIR",11,true);
 const rows=[['Hébergement remboursé',f.accommodation_refund],['Ménage remboursé',f.cleaning_refund],['Taxe de séjour remboursée',f.tourist_tax_refund]];
 for(const [label,value] of rows){if(Number(value||0)!==0 || label==='Taxe de séjour remboursée'){add(label,10,false,60);add(money(value),10,false,430);}}
 sep();add("TOTAL DE L'AVOIR",13,true,60);add(money(note.total_amount),13,true,430);sep();
 add(`Référence remboursement : ${r.refund_operation_id||'-'}`,9);if(r.completed_at)add(`Remboursement finalisé le ${dateFr(r.completed_at)}`,9);
 return {lines};
}
export function buildCustomerCreditNotePdf(note,options={}){
 const {lines}=creditNotePdfModel(note,options);let y=800,pendingLeft=false;const commands=['BT'];
 for(const line of lines){if(line.separator){commands.push('ET',`0.75 w 50 ${y-2} m 545 ${y-2} l S`,'BT');y-=14;pendingLeft=false;continue;}if(line.rowBreak){y-=14;pendingLeft=false;continue;}const size=line.size||10,x=line.x||50,font=line.bold?'/F2':'/F1';commands.push(`${font} ${size} Tf`,`1 0 0 1 ${x} ${y} Tm`,`(${pdfEscape(line.t)}) Tj`);if(line.advance===false)continue;if(x>=300&&pendingLeft){y-=Math.max(size+5,14);pendingLeft=false;}else if(x<300&&['Hébergement remboursé','Ménage remboursé','Taxe de séjour remboursée',"TOTAL DE L'AVOIR"].includes(line.t)){pendingLeft=true;}else{y-=line.t?Math.max(size+5,14):8;pendingLeft=false;}}
 commands.push('ET');const stream=latin1(commands.join('\n'));const objects=[latin1('<< /Type /Catalog /Pages 2 0 R >>'),latin1('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),latin1('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>'),Buffer.concat([latin1(`<< /Length ${stream.length} >>\nstream\n`),stream,latin1('\nendstream')]),latin1('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'),latin1('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')];const chunks=[latin1('%PDF-1.4\n%LMV\n')],offsets=[0];let length=chunks[0].length;objects.forEach((obj,i)=>{offsets.push(length);const part=Buffer.concat([latin1(`${i+1} 0 obj\n`),obj,latin1('\nendobj\n')]);chunks.push(part);length+=part.length;});const xref=length;let table=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;for(let i=1;i<=objects.length;i++)table+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;table+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;chunks.push(latin1(table));return Buffer.concat(chunks);
}
