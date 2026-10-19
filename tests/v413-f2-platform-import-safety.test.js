import test from "node:test";
import assert from "node:assert/strict";
import { parseBookingStatement, bookingStatementToEntries } from "../src/utils/bookingStatementImport.js";
import { parseAirbnbStatement, airbnbStatementToEntries } from "../src/utils/accountingImport.js";

const categories = [
  { code: "rental_booking", id: "bk" },
  { code: "rental_airbnb", id: "ab" },
  { code: "platform_fees", id: "fee" },
  { code: "payment_fees", id: "card" },
  { code: "other_income", id: "other" },
];
const bookingHeader = "Type,Numéro de réservation,Arrivée,Checkout,Nom du client,Prestataire de paiement,Statut de la réservation,Devise,Statut du paiement,Montant,Commission,Frais de service de paiement,Net,Date du paiement,Identifiant du paiement";
const bookingRow = ({type="Réservation",ref="123",gross="100.00",commission="-15.00",fee="-2.00",net="83.00",paymentId="PAY1"}={})=>
  [type,ref,"1 janv. 2025","3 janv. 2025","Test","Booking", "ok","EUR","by_booking",gross,commission,fee,net,"7 janv. 2025",paymentId].join(",");
const airbnbHeader = "Date,Arrivée au plus tard le,Type,Code de confirmation,Date de réservation,Date de début,Date de fin,Nuits,Voyageur,Logement,Détails,Code de référence,Devise,Montant,Versé,Frais de service,Frais de Versement sur carte bancaire,Frais de ménage,Revenus bruts,Taxes reversées par Airbnb,Année des revenus";
const airbnbRow = ({type="Réservation",ref="HM1",gross="100.00",fee="5.00",net="95.00",payout=""}={})=>
  ["01/07/2025","",type,ref,"01/01/2025","01/01/2025","01/03/2025","2","Test","LMV","","", "EUR", net,payout,fee,"","0.00",gross,"0.00","2025"].join(",");

test("F2: ordinary Booking reservation retains its 3 accounting entries and original stable keys", () => {
  const entries = bookingStatementToEntries(parseBookingStatement([bookingHeader,bookingRow()].join("\n")), categories);
  assert.equal(entries.length,3);
  assert.deepEqual(entries.map(e=>e.entry_kind),["income","expense","expense"]);
  assert.equal(entries[0].source_record_key,"statement:reservation:123:PAY1:gross");
});

test("F2: negative Booking reservation cannot become a positive rental receipt", () => {
  const parsed = parseBookingStatement([bookingHeader,bookingRow({gross:"-100",commission:"15",fee:"2",net:"-83"})].join("\n"));
  assert.throws(()=>bookingStatementToEntries(parsed,categories),/vérifier|négatif|non classé/i);
});

test("F2: negative Booking adjustment cannot silently become platform expense", () => {
  const parsed = parseBookingStatement([bookingHeader,bookingRow({type:"Ajustement",gross:"0",commission:"0",fee:"0",net:"-100"})].join("\n"));
  assert.throws(()=>bookingStatementToEntries(parsed,categories),/Ajustement|non classé|vérifier/i);
});

test("F2: repeated Booking transaction key cannot enter snapshot twice", () => {
  const parsed = parseBookingStatement([bookingHeader,bookingRow(),bookingRow()].join("\n"));
  assert.throws(()=>bookingStatementToEntries(parsed,categories),/doublon|identifiant/i);
});

test("F2: Booking distinct payment ids for the same reservation remain permitted", () => {
  const parsed = parseBookingStatement([bookingHeader,bookingRow(),bookingRow({paymentId:"PAY2"})].join("\n"));
  const result = bookingStatementToEntries(parsed,categories);
  assert.equal(result.length,6);
  assert.equal(new Set(result.map(x=>x.source_record_key)).size,6);
});

test("F2: ordinary Airbnb reservation with payout remains unchanged", () => {
  const csv=[airbnbHeader,airbnbRow(),["01/07/2025","","Payout","","","","","","","","","G-1","EUR","","95.00","","","","","", ""].join(",")].join("\n");
  const statement=parseAirbnbStatement(csv);
  assert.equal(statement.payouts.length,1);
  const entries=airbnbStatementToEntries(statement,categories);
  assert.deepEqual(entries.map(x=>x.entry_kind),["income","expense"]);
  assert.equal(entries[0].source_record_key,"airbnb:reservation:HM1:gross");
});

test("F2: Airbnb negative gross cannot become positive income", () => {
  const parsed=parseAirbnbStatement([airbnbHeader,airbnbRow({gross:"-100",fee:"-5",net:"-95"})].join("\n"));
  assert.throws(()=>airbnbStatementToEntries(parsed,categories),/vérifier|négatif|non classé/i);
});

test("F2: Airbnb multiple movements sharing one confirmation code cannot collide", () => {
  const parsed=parseAirbnbStatement([airbnbHeader,airbnbRow(),airbnbRow({net:"80.00",gross:"85.00"})].join("\n"));
  assert.throws(()=>airbnbStatementToEntries(parsed,categories),/doublon|plusieurs|identifiant/i);
});

test("F2: Airbnb unclassified financial adjustment is not silently discarded", () => {
  const parsed=parseAirbnbStatement([airbnbHeader,airbnbRow(),airbnbRow({type:"Ajustement",ref:"",gross:"-30",fee:"0",net:"-30"})].join("\n"));
  assert.throws(()=>airbnbStatementToEntries(parsed,categories),/Ajustement|vérifier|non classé/i);
});
