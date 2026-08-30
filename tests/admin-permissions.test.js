import test from "node:test";
import assert from "node:assert/strict";
import {
  ADMIN_PERMISSIONS,
  getEffectivePermissions,
  isHousekeepingProfile,
  isOwnerProfile,
} from "../shared/adminPermissions.js";

test("owner authority requires the protected active owner state", () => {
  assert.equal(isOwnerProfile({ role: "owner", is_owner: true, is_active: true }), true);
  assert.equal(isOwnerProfile({ role: "owner", is_owner: false, is_active: true }), false);
  assert.equal(isOwnerProfile({ role: "owner", is_owner: true, is_active: false }), false);
  assert.equal(isOwnerProfile({ role: "housekeeping", is_owner: true, is_active: true }), false);
});

test("housekeeping authority requires its fixed active non-owner state", () => {
  assert.equal(isHousekeepingProfile({ role: "housekeeping", is_owner: false, is_active: true }), true);
  assert.equal(isHousekeepingProfile({ role: "housekeeping", is_owner: true, is_active: true }), false);
  assert.equal(isHousekeepingProfile({ role: "housekeeping", is_owner: false, is_active: false }), false);
});

test("owner receives system capabilities independently of historical stored permissions", () => {
  const permissions = getEffectivePermissions({
    role: "owner", is_owner: true, is_active: true,
    permission_mode: "none", permissions: [],
  });
  assert.equal(permissions.has(ADMIN_PERMISSIONS.manageUsers), true);
  assert.equal(permissions.has(ADMIN_PERMISSIONS.managePayments), true);
});

test("housekeeping receives only fixed operational capabilities even with malicious stored permissions", () => {
  const permissions = getEffectivePermissions({
    role: "housekeeping", is_owner: false, is_active: true,
    permission_mode: "custom", permissions: ["manage:users", "view:payments"],
  });
  assert.deepEqual(
    [...permissions].sort(),
    ["contact:email", "contact:phone", "contact:sms", "view:calendar"].sort(),
  );
});

test("legacy, unknown, inactive, and missing profiles fail closed", () => {
  for (const profile of [
    null,
    { role: "admin", is_active: true, permissions: ["manage:users"] },
    { role: "manager", is_active: true, permissions: ["manage:users"] },
    { role: "read_only", is_active: true, permissions: ["view:calendar"] },
    { role: "super_admin", is_active: true, permissions: ["manage:users"] },
    { role: "housekeeping", is_owner: false, is_active: false },
  ]) {
    assert.deepEqual([...getEffectivePermissions(profile)], []);
  }
});
