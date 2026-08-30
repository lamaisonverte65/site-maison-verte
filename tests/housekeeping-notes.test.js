import test from "node:test";
import assert from "node:assert/strict";
import {
  canAccessHousekeepingNotes,
  createHousekeepingNote,
  listHousekeepingNotes,
} from "../netlify/functions/_lib/housekeeping-notes.js";

const housekeeping = {
  id: "admin-housekeeping-1", role: "housekeeping", is_owner: false, is_active: true,
};
const owner = {
  id: "admin-owner-1", role: "owner", is_owner: true, is_active: true,
};

function repository({ directExists = true, externalExists = true } = {}) {
  const state = { inserts: [], updates: [], deletes: [], lookups: [], outboundMessages: [] };
  return {
    state,
    async directTargetExists(id) {
      state.lookups.push({ kind: "booking", id });
      return directExists;
    },
    async findExternalTarget(source, uid) {
      state.lookups.push({ kind: "external", source, uid });
      return externalExists ? { id: "external-occupation-1", source, external_uid: uid } : null;
    },
    async insertNote(row) {
      state.inserts.push(row);
      return { id: `note-${state.inserts.length}`, created_at: "2026-08-28T12:00:00.000Z", ...row };
    },
    async listNotes(target) {
      state.lookups.push({ kind: "notes", target });
      return [{
        id: "note-existing", note: "Prévoir des serviettes supplémentaires.",
        author_admin_user_id: housekeeping.id, author_display_name: "Équipe ménage",
        created_at: "2026-08-28T11:00:00.000Z",
      }];
    },
    async sendClientMessage(message) {
      state.outboundMessages.push(message);
    },
  };
}

test("housekeeping and owner may access housekeeping notes while inactive and legacy profiles cannot", () => {
  assert.equal(canAccessHousekeepingNotes(housekeeping), true);
  assert.equal(canAccessHousekeepingNotes(owner), true);
  assert.equal(canAccessHousekeepingNotes({ ...housekeeping, is_active: false }), false);
  assert.equal(canAccessHousekeepingNotes({ id: "legacy", role: "read_only", is_active: true }), false);
});

test("a note for a direct stay requires an existing booking and binds the authenticated author", async () => {
  const repo = repository();
  const result = await createHousekeepingNote({
    repository: repo,
    author: housekeeping,
    input: { reservationId: "booking-1", note: "  Cuisine terminée.  " },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(repo.state.lookups, [{ kind: "booking", id: "booking-1" }]);
  assert.deepEqual(repo.state.inserts, [{
    booking_request_id: "booking-1",
    external_occupation_id: null,
    author_admin_user_id: housekeeping.id,
    note: "Cuisine terminée.",
  }]);
});

test("a note for a missing direct reservation is refused before insert", async () => {
  const repo = repository({ directExists: false });
  const result = await createHousekeepingNote({
    repository: repo, author: housekeeping,
    input: { reservationId: "booking-missing", note: "Note" },
  });
  assert.equal(result.ok, false);
  assert.equal(result.statusCode, 404);
  assert.equal(repo.state.inserts.length, 0);
});

test("an external note requires a locally persisted source and UID", async () => {
  const repo = repository();
  const result = await createHousekeepingNote({
    repository: repo, author: housekeeping,
    input: { reservationId: "external:booking:uid:with:colons", note: "Départ effectué." },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(repo.state.lookups, [{ kind: "external", source: "booking", uid: "uid:with:colons" }]);
  assert.deepEqual(repo.state.inserts[0], {
    booking_request_id: null,
    external_occupation_id: "external-occupation-1",
    author_admin_user_id: housekeeping.id,
    note: "Départ effectué.",
  });
});

test("an arbitrary external UID is refused without network fallback or insert", async () => {
  const repo = repository({ externalExists: false });
  const result = await createHousekeepingNote({
    repository: repo, author: housekeeping,
    input: { reservationId: "external:airbnb:invented-uid", note: "Note" },
  });
  assert.equal(result.ok, false);
  assert.equal(result.statusCode, 404);
  assert.equal(repo.state.inserts.length, 0);
  assert.deepEqual(repo.state.lookups, [{ kind: "external", source: "airbnb", uid: "invented-uid" }]);
});

test("the browser cannot choose an author or smuggle reservation/client mutations", async () => {
  for (const input of [
    { reservationId: "booking-1", note: "Note", authorAdminUserId: owner.id },
    { reservationId: "booking-1", note: "Note", arrival_time: "18:00" },
    { reservationId: "booking-1", note: "Note", customer: { phone: "+33600000000" } },
  ]) {
    const repo = repository();
    const result = await createHousekeepingNote({ repository: repo, author: housekeeping, input });
    assert.equal(result.ok, false, JSON.stringify(input));
    assert.equal(repo.state.inserts.length, 0);
  }
});

test("notes are append-only and creating a correction inserts a second row", async () => {
  const repo = repository();
  await createHousekeepingNote({ repository: repo, author: housekeeping, input: { reservationId: "booking-1", note: "Première note" } });
  await createHousekeepingNote({ repository: repo, author: housekeeping, input: { reservationId: "booking-1", note: "Correction" } });
  assert.equal(repo.state.inserts.length, 2);
  assert.deepEqual(repo.state.updates, []);
  assert.deepEqual(repo.state.deletes, []);
  assert.deepEqual(repo.state.outboundMessages, []);
});

test("owner can list notes without classifying them as client communications", async () => {
  const repo = repository();
  const result = await listHousekeepingNotes({ repository: repo, requester: owner, reservationId: "booking-1" });
  assert.equal(result.ok, true);
  assert.equal(result.notes[0].note, "Prévoir des serviettes supplémentaires.");
  assert.equal(Object.hasOwn(result.notes[0], "communications"), false);
  assert.equal(Object.hasOwn(result.notes[0], "recipient"), false);
});

test("external note listing resolves the stable local occupation UUID", async () => {
  const repo = repository();
  const result = await listHousekeepingNotes({
    repository: repo,
    requester: owner,
    reservationId: "external:airbnb:uid-airbnb",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(repo.state.lookups, [
    { kind: "external", source: "airbnb", uid: "uid-airbnb" },
    {
      kind: "notes",
      target: {
        kind: "external",
        source: "airbnb",
        uid: "uid-airbnb",
        externalOccupationId: "external-occupation-1",
      },
    },
  ]);
});
