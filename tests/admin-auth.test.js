import test from "node:test";
import assert from "node:assert/strict";
import { authorizeAdminRequest } from "../netlify/functions/_lib/admin-auth.js";
import { bearerEvent, createAuthSupabase } from "./helpers/fakeSupabase.js";

const authUser = { id: "auth-1", email: "staff@example.test" };
const owner = {
  id: "owner-profile", auth_user_id: "auth-1", email: "owner-old-email@example.test",
  role: "owner", is_owner: true, is_active: true,
};

test("authorization rejects a request without a session before reading profiles", async () => {
  const { client, state } = createAuthSupabase();
  const result = await authorizeAdminRequest(bearerEvent(""), client);
  assert.equal(result.statusCode, 401);
  assert.equal(state.profileReads, 0);
});

test("authorization binds an active profile by Auth ID even when profile email is stale", async () => {
  const { client, state } = createAuthSupabase({ authUser, profiles: [owner] });
  const result = await authorizeAdminRequest(bearerEvent(), client, { ownerOnly: true });
  assert.equal(result.ok, true);
  assert.equal(result.profile, owner);
  assert.equal(result.authBinding, "auth_user_id");
  assert.deepEqual(state.profileQueries, [{ field: "auth_user_id", value: "auth-1" }]);
});

test("authorization does not accept an email match when a different Auth ID is stored", async () => {
  const conflicting = { ...owner, auth_user_id: "auth-other", email: authUser.email };
  const { client } = createAuthSupabase({ authUser, profiles: [conflicting] });
  const result = await authorizeAdminRequest(bearerEvent(), client);
  assert.equal(result.ok, false);
  assert.equal(result.statusCode, 403);
});

test("the unique strict owner with a null Auth ID may use the explicit transition fallback", async () => {
  const transitionalOwner = { ...owner, auth_user_id: null, email: authUser.email };
  const { client, state } = createAuthSupabase({ authUser, profiles: [transitionalOwner] });
  const result = await authorizeAdminRequest(bearerEvent(), client, { ownerOnly: true });
  assert.equal(result.ok, true);
  assert.equal(result.authBinding, "transitional_owner_email");
  assert.equal(result.authLinkRequired, true);
  assert.deepEqual(state.profileQueries, [
    { field: "auth_user_id", value: "auth-1" },
    { field: "role", value: "owner" },
    { field: "is_owner", value: true },
    { field: "is_active", value: true },
  ]);
});

test("the transition fallback refuses an ambiguous strict-owner state", async () => {
  const profiles = [
    { ...owner, id: "owner-a", auth_user_id: null, email: authUser.email },
    { ...owner, id: "owner-b", auth_user_id: null, email: "other-owner@example.test" },
  ];
  const { client } = createAuthSupabase({ authUser, profiles });
  const result = await authorizeAdminRequest(bearerEvent(), client, { ownerOnly: true });
  assert.equal(result.ok, false);
  assert.equal(result.statusCode, 403);
});

test("a null Auth ID housekeeping or legacy profile cannot use the owner transition fallback", async () => {
  for (const role of ["housekeeping", "read_only"]) {
    const profile = {
      id: `${role}-profile`, auth_user_id: null, email: authUser.email,
      role, is_owner: false, is_active: true,
    };
    const { client } = createAuthSupabase({ authUser, profiles: [profile] });
    const result = await authorizeAdminRequest(bearerEvent(), client);
    assert.equal(result.ok, false);
    assert.equal(result.statusCode, 403);
  }
});

test("disabled and unknown-role profiles bound by Auth ID fail closed", async () => {
  for (const profile of [
    { ...owner, is_active: false },
    { ...owner, role: "read_only", is_owner: false },
  ]) {
    const { client } = createAuthSupabase({ authUser, profiles: [profile] });
    const result = await authorizeAdminRequest(bearerEvent(), client);
    assert.equal(result.ok, false);
    assert.equal(result.statusCode, 403);
  }
});

test("housekeeping passes its fixed calendar capability but cannot manage users", async () => {
  const profile = {
    id: "housekeeping-profile", auth_user_id: authUser.id, email: authUser.email,
    role: "housekeeping", is_owner: false, is_active: true,
  };
  const { client } = createAuthSupabase({ authUser, profiles: [profile] });
  const calendar = await authorizeAdminRequest(bearerEvent(), client, { anyOf: ["view:calendar"] });
  const users = await authorizeAdminRequest(bearerEvent(), client, { anyOf: ["manage:users"] });
  assert.equal(calendar.ok, true);
  assert.equal(users.statusCode, 403);
});
