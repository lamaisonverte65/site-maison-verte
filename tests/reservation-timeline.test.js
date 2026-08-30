import test from "node:test";
import assert from "node:assert/strict";
import { buildReservationTimeline } from "../src/hooks/useReservationTimeline.js";

test("reservation timeline never presents historical owner_message as a sent decision", () => {
  const secretHistoricalValue = "Texte historique dont la provenance est inconnue";
  const timeline = buildReservationTimeline({
    reservation: {
      id: "booking-1",
      accepted_at: "2026-08-28T10:00:00.000Z",
      owner_message: secretHistoricalValue,
    },
  });

  assert.equal(timeline.length, 1);
  assert.equal(timeline[0].title, "Demande acceptée");
  assert.equal(timeline[0].description, "La demande a été acceptée.");
  assert.doesNotMatch(JSON.stringify(timeline), new RegExp(secretHistoricalValue));
});

test("reservation timeline keeps refused decisions provenance-neutral", () => {
  const timeline = buildReservationTimeline({
    reservation: {
      id: "booking-2",
      refused_at: "2026-08-28T11:00:00.000Z",
      owner_message: "Ne pas classifier comme message envoyé",
    },
  });

  assert.equal(timeline[0].description, "La demande a été refusée.");
});
