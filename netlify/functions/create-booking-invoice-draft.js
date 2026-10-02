import { createClient } from "@supabase/supabase-js";
import { authorizationResponse, authorizeAdminRequest } from "./_lib/admin-auth.js";
import { buildBookingInvoiceDraft } from "./_lib/booking-invoice-draft.js";
const supabase=createClient(process.env.VITE_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
const json=(statusCode,body)=>({statusCode,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
export async function handler(event){
  if(event.httpMethod!=="POST")return json(405,{error:"Méthode non autorisée."});
  const auth=await authorizeAdminRequest(event,supabase,{ownerOnly:true}); if(!auth.ok)return authorizationResponse(auth);
  let body; try{body=JSON.parse(event.body||"{}");}catch{return json(400,{error:"Corps JSON invalide."});}
  const bookingRequestId=String(body.bookingRequestId||"").trim();
  const suppliedExternalReference=String(body.externalReference||"").trim();
  if(!bookingRequestId && !suppliedExternalReference)return json(400,{error:"Réservation Booking manquante."});

  let financial=null;
  if(bookingRequestId){
    const {data,error}=await supabase.from("external_reservation_financials").select("*").eq("source","booking").eq("booking_request_id",bookingRequestId).maybeSingle();
    if(error)return json(500,{error:"Impossible de résoudre les données financières Booking depuis la réservation interne.",detail:error.message});
    financial=data;
  }
  if(!financial && suppliedExternalReference){
    const {data,error}=await supabase.from("external_reservation_financials").select("*").eq("source","booking").eq("external_reference",suppliedExternalReference).maybeSingle();
    if(error)return json(500,{error:"Impossible de charger les données financières Booking.",detail:error.message});
    financial=data;
  }
  if(!financial)return json(404,{error:"Données financières Booking introuvables pour cette réservation."});

  const externalReference=String(financial.external_reference||"").trim();
  if(!externalReference)return json(409,{error:"Référence Booking absente du registre financier."});
  if(bookingRequestId && financial.booking_request_id && String(financial.booking_request_id)!==bookingRequestId)return json(409,{error:"Rapprochement Booking incohérent."});

  const {data:existing,error:ee}=await supabase.from("customer_invoices").select("*").eq("source","booking").eq("external_reference",externalReference).maybeSingle();
  if(ee)return json(500,{error:"Impossible de vérifier les factures existantes."}); if(existing)return json(200,{invoice:existing,created:false});

  const resolvedBookingId=financial.booking_request_id || bookingRequestId || null;
  let booking=null;
  if(resolvedBookingId){ const {data,error}=await supabase.from("booking_requests").select("*").eq("id",resolvedBookingId).maybeSingle(); if(error)return json(500,{error:"Impossible de charger la réservation."}); booking=data; }
  let draft; try{draft=buildBookingInvoiceDraft({booking,financial});}catch(error){return json(409,{error:"Brouillon Booking non prêt.",detail:String(error?.message||error)});}
  const {data:invoice,error:ie}=await supabase.from("customer_invoices").insert([draft]).select("*").single();
  if(ie){ if(ie.code==="23505"){const {data:raced}=await supabase.from("customer_invoices").select("*").eq("source","booking").eq("external_reference",externalReference).maybeSingle();if(raced)return json(200,{invoice:raced,created:false});} return json(500,{error:"Création du brouillon Booking impossible.",detail:ie.message}); }
  return json(201,{invoice,created:true});
}
