import test from "node:test";
import assert from "node:assert/strict";
import {
  provisionHousekeepingUser,
} from "../netlify/functions/_lib/admin-user-service.js";

const profile = {
  email: "new@example.test",
  display_name: "Ménage 2",
  role: "housekeeping",
  temporaryPassword: "StrongPass123!",
};

function createProvisioningContext({ existingProfile = null, existingAuthUser = null, insertError = null, insertCommitsBeforeError = false, deleteError = null } = {}) {
  const state = { authCreates: [], authDeletes: [], inserts: [], storedProfile: existingProfile };
  const repository = {
    async findProfileByEmail() { return state.storedProfile; },
    async insertProfile(value) {
      state.inserts.push(value);
      if (!insertError || insertCommitsBeforeError) state.storedProfile = { ...value, id: "profile-new" };
      if (insertError) throw insertError;
      return state.storedProfile;
    },
  };
  const auth = {
    async findUserByEmail() { return existingAuthUser; },
    async createUser(attributes) {
      state.authCreates.push(attributes);
      return { id: "auth-created", email: attributes.email };
    },
    async deleteUser(id) {
      state.authDeletes.push(id);
      if (deleteError) throw deleteError;
    },
  };
  return { repository, auth, state };
}

test("provisioning rejects an existing profile before touching Auth", async () => {
  const context = createProvisioningContext({ existingProfile: { id: "existing", email: profile.email } });
  const result = await provisionHousekeepingUser({ ...context, profile, createdBy: "auth-owner" });
  assert.equal(result.statusCode, 409);
  assert.deepEqual(context.state.authCreates, []);
  assert.deepEqual(context.state.inserts, []);
});

test("provisioning refuses an existing Auth identity without mutating it", async () => {
  const existingAuthUser = { id: "auth-existing", email: profile.email, app_metadata: { provider: "email" } };
  const context = createProvisioningContext({ existingAuthUser });
  const result = await provisionHousekeepingUser({ ...context, profile, createdBy: "auth-owner" });
  assert.equal(result.statusCode, 409);
  assert.equal(result.identityConflict, true);
  assert.deepEqual(context.state.authCreates, []);
  assert.deepEqual(context.state.authDeletes, []);
  assert.deepEqual(existingAuthUser.app_metadata, { provider: "email" });
});

test("provisioning always inserts a fixed housekeeping profile without permission fields", async () => {
  const context = createProvisioningContext();
  const result = await provisionHousekeepingUser({ ...context, profile, createdBy: "auth-owner" });
  assert.equal(result.ok, true);
  assert.equal(context.state.authCreates[0].app_metadata.admin_role, "housekeeping");
  assert.deepEqual(context.state.inserts[0], {
    email: "new@example.test",
    display_name: "Ménage 2",
    role: "housekeeping",
    is_owner: false,
    is_active: true,
    auth_user_id: "auth-created",
    password_initialized: false,
    temporary_password_set_at: context.state.inserts[0].temporary_password_set_at,
    created_by: "auth-owner",
    updated_at: context.state.inserts[0].updated_at,
  });
  assert.equal(Object.hasOwn(context.state.inserts[0], "permissions"), false);
  assert.equal(Object.hasOwn(context.state.inserts[0], "permission_mode"), false);
});

test("insert failure compensates only the Auth identity created by this request", async () => {
  const context = createProvisioningContext({ insertError: new Error("database unavailable") });
  const result = await provisionHousekeepingUser({ ...context, profile, createdBy: "auth-owner" });
  assert.equal(result.compensated, true);
  assert.deepEqual(context.state.authDeletes, ["auth-created"]);
});

test("ambiguous insert never deletes Auth when the linked profile committed", async () => {
  const context = createProvisioningContext({ insertError: new Error("response lost"), insertCommitsBeforeError: true });
  const result = await provisionHousekeepingUser({ ...context, profile, createdBy: "auth-owner" });
  assert.equal(result.ok, true);
  assert.equal(result.recoveredAfterAmbiguousInsert, true);
  assert.deepEqual(context.state.authDeletes, []);
});

test("failed Auth compensation reports manual cleanup without touching another identity", async () => {
  const context = createProvisioningContext({ insertError: new Error("db"), deleteError: new Error("auth") });
  const result = await provisionHousekeepingUser({ ...context, profile, createdBy: "auth-owner" });
  assert.equal(result.authCleanupRequired, true);
  assert.equal(result.createdAuthUserId, "auth-created");
  assert.deepEqual(context.state.authDeletes, ["auth-created"]);
});
