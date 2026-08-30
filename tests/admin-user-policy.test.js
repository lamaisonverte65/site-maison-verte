import test from "node:test";
import assert from "node:assert/strict";
import {
  canAdministerHousekeeping,
  canResetHousekeepingPassword,
  isActiveAdminUsersAction,
  validateCreateHousekeeping,
  validateHousekeepingUpdate,
} from "../netlify/functions/_lib/admin-user-policy.js";

const owner = {
  id: "owner-profile", auth_user_id: "auth-owner", email: "owner@example.test",
  role: "owner", is_owner: true, is_active: true,
};
const housekeeping = {
  id: "housekeeping-profile", auth_user_id: "auth-housekeeping", email: "housekeeping@example.test",
  display_name: "Ménage 1", role: "housekeeping", is_owner: false, is_active: true,
};
const validCreate = {
  email: "second@example.test",
  display_name: "Ménage 2",
  temporaryPassword: "StrongPass123!",
};

test("owner can create multiple fixed housekeeping profiles", () => {
  const first = validateCreateHousekeeping(owner, validCreate);
  const second = validateCreateHousekeeping(owner, { ...validCreate, email: "third@example.test" });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.deepEqual(first.value, { ...validCreate, role: "housekeeping" });
});

test("housekeeping cannot create an internal user", () => {
  const result = validateCreateHousekeeping(housekeeping, validCreate);
  assert.equal(result.ok, false);
  assert.equal(result.statusCode, 403);
});

test("creation rejects role, permission, owner, mode, and arbitrary payload fields", () => {
  for (const forbidden of [
    { role: "admin" },
    { role: "manager" },
    { role: "read_only" },
    { role: "housekeeping" },
    { role: "super_admin" },
    { permission_mode: "role" },
    { permissions: [] },
    { is_owner: false },
    { is_active: true },
    { created_by: "chosen-by-client" },
  ]) {
    const result = validateCreateHousekeeping(owner, { ...validCreate, ...forbidden });
    assert.equal(result.ok, false, JSON.stringify(forbidden));
    assert.equal(result.statusCode, 400);
  }
});

test("owner may update only a housekeeping display name or active state", () => {
  assert.deepEqual(
    validateHousekeepingUpdate(owner, housekeeping, { display_name: "Équipe accueil" }),
    { ok: true, value: { display_name: "Équipe accueil" } },
  );
  assert.deepEqual(
    validateHousekeepingUpdate(owner, housekeeping, { is_active: false }),
    { ok: true, value: { is_active: false } },
  );
});

test("housekeeping cannot modify or deactivate any user", () => {
  const result = validateHousekeepingUpdate(housekeeping, housekeeping, { is_active: false });
  assert.equal(result.ok, false);
  assert.equal(result.statusCode, 403);
});

test("generic administration can never target owner or a legacy role", () => {
  for (const target of [owner, { ...housekeeping, role: "read_only" }]) {
    assert.equal(canAdministerHousekeeping(owner, target).ok, false);
    assert.equal(validateHousekeepingUpdate(owner, target, { display_name: "Changed" }).ok, false);
  }
});

test("housekeeping update rejects role and permission configuration", () => {
  for (const updates of [
    { role: "owner" },
    { role: "housekeeping" },
    { permissions: ["manage:users"] },
    { permission_mode: "custom" },
    { is_owner: true },
    { email: "changed@example.test" },
  ]) {
    const result = validateHousekeepingUpdate(owner, housekeeping, updates);
    assert.equal(result.ok, false, JSON.stringify(updates));
    assert.equal(result.statusCode, 400);
  }
});

test("owner can reset only a different housekeeping account", () => {
  assert.equal(canResetHousekeepingPassword(owner, housekeeping).ok, true);
  assert.equal(canResetHousekeepingPassword(owner, owner).ok, false);
  assert.equal(canResetHousekeepingPassword(housekeeping, housekeeping).ok, false);
  assert.equal(canResetHousekeepingPassword(owner, { ...housekeeping, role: "read_only" }).ok, false);
});

test("the active admin users API excludes generic existing-Auth linking", () => {
  for (const action of [
    "me", "list", "create_housekeeping", "update_housekeeping",
    "reset_housekeeping_password", "delete_housekeeping",
  ]) {
    assert.equal(isActiveAdminUsersAction(action), true, action);
  }
  assert.equal(isActiveAdminUsersAction("link_existing_auth"), false);
  assert.equal(isActiveAdminUsersAction("transfer_ownership"), false);
});
