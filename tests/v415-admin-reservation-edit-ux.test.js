import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(file, "utf8");
const importEditor = read("src/components/admin/calendar/ReservationPeriodEditor.jsx");
const reservation = read("src/components/admin/ReservationPanel.jsx");
const css = read("src/components/admin/reservation/reservationSheet.css");

test("Admin: customer suggestions disappear outside first and last name inputs", () => {
  assert.match(importEditor, /focusedIdentityField/);
  assert.match(importEditor, /Boolean\(focusedIdentityField\) && !suggestionsDismissed/);
  assert.match(importEditor, /onBlur=\{\(\) => setFocusedIdentityField\(null\)\}/);
  assert.match(importEditor, /onPointerDown=\{\(event\) => \{/);
  assert.match(importEditor, /if \(event\.key === "Escape"\)/);
  assert.match(importEditor, /if \(event\.key === "Enter"\)/);
  assert.doesNotMatch(importEditor, /event\.key === "Tab"\) \{\s*event\.preventDefault/);
});

test("Admin: suggestions are in flow before phone, not overlapping it", () => {
  const field = importEditor.slice(importEditor.indexOf("function ImportReservationFields"), importEditor.indexOf("function ExternalImportPanel"));
  assert.ok(field.indexOf('gridColumn: "1 / -1"') < field.indexOf('placeholder="Téléphone"'));
  const suggestionBox = importEditor.slice(importEditor.indexOf("const suggestionStyles"), importEditor.indexOf("item: {", importEditor.indexOf("const suggestionStyles")));
  assert.doesNotMatch(suggestionBox, /position:\s*"absolute"/);
});

test("Reservation sheet: edit action is alongside header and editing is a focused view", () => {
  assert.match(reservation, /className="reservation-sheet-heading"[\s\S]*?<ReservationHeader[\s\S]*?className="reservation-sheet-edit-button"/);
  assert.match(reservation, /\{!isEditing && \([\s\S]*?<ReservationContactLinks/);
  assert.match(reservation, /className="reservation-sheet-group" aria-label="Client et séjour"/);
  assert.match(reservation, /className="reservation-sheet-group" aria-label="Paiements et facturation"/);
  assert.match(reservation, /className="reservation-sheet-group" aria-label="Messages et historique"/);
});

test("Reservation edit: save/cancel remain together after fields and financial preview", () => {
  const start = reservation.indexOf("function EditableReservationForm");
  const end = reservation.indexOf("export default function ReservationPanel", start);
  const editor = reservation.slice(start, end);
  const positions = [editor.indexOf('aria-label="Statut et dates du séjour"'), editor.indexOf('aria-label="Informations client"'), editor.indexOf('aria-label="Voyageurs et informations du séjour"'), editor.indexOf('aria-label="Messages et notes"'), editor.indexOf('className="reservation-edit-preview"'), editor.indexOf('className="reservation-edit-actionbar"')];
  assert.ok(positions.every((value) => value >= 0));
  assert.ok(positions.every((value, i) => i === 0 || value > positions[i - 1]));
  assert.match(editor, /onClick=\{onPreview\}/);
  assert.match(editor, /onClick=\{onSave\}/);
  assert.match(editor, /onClick=\{onCancel\}/);
  assert.match(css, /\.reservation-edit-actionbar\s*\{[\s\S]*?position:\s*sticky/);
  assert.match(css, /@media \(max-width: 720px\)/);
});

test("Reservation edit preserves V4.10 financial preview and read-only status", () => {
  assert.match(reservation, /isV410 \? \([\s\S]*?lecture seule/);
  assert.match(reservation, /preview \? <button[\s\S]*?onClick=\{onSave\}[\s\S]*?Confirmer les modifications/);
  assert.match(reservation, /: <button[\s\S]*?onClick=\{onPreview\}[\s\S]*?Calculer les modifications/);
  assert.match(reservation, /Aucun paiement ni remboursement n’est déclenché automatiquement/);
  assert.match(reservation, /!isEditing && editMessage/);
});
