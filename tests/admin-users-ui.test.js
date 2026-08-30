import test from "node:test";
import assert from "node:assert/strict";
import {
  buildHousekeepingCreationPayload,
  buildHousekeepingUpdatePayload,
} from "../src/utils/adminUserForm.js";

test("housekeeping creation payload contains identity fields only", () => {
  const payload = buildHousekeepingCreationPayload({
    email: "  TEAM@example.test ",
    display_name: "  Équipe matin  ",
    temporaryPassword: "StrongPass123!",
    role: "owner",
    permission_mode: "custom",
    permissions: ["manage:users"],
    is_owner: true,
  });
  assert.deepEqual(payload, {
    email: "team@example.test",
    display_name: "Équipe matin",
    temporaryPassword: "StrongPass123!",
  });
});

test("housekeeping update payload can contain only display name or active state", () => {
  assert.deepEqual(buildHousekeepingUpdatePayload({
    display_name: "  Équipe soir ", role: "owner", permissions: ["manage:users"],
  }), { display_name: "Équipe soir" });
  assert.deepEqual(buildHousekeepingUpdatePayload({
    is_active: false, permission_mode: "none", is_owner: true,
  }), { is_active: false });
});

test("empty and non-boolean update fields are not emitted", () => {
  assert.deepEqual(buildHousekeepingUpdatePayload({ role: "housekeeping" }), {});
  assert.deepEqual(buildHousekeepingUpdatePayload({ is_active: "false" }), {});
});
