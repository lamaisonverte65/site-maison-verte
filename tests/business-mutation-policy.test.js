import test from "node:test";
import assert from "node:assert/strict";
import {
  canMutateClientData,
  canMutateReservationData,
} from "../netlify/functions/_lib/business-mutation-policy.js";
import { ADMIN_PERMISSIONS } from "../shared/adminPermissions.js";

const owner = {
  profile: { id: "owner", role: "owner", is_owner: true, is_active: true },
  permissions: new Set([
    ADMIN_PERMISSIONS.manageReservations,
    ADMIN_PERMISSIONS.manageCalendar,
    ADMIN_PERMISSIONS.manageCustomers,
  ]),
};

test("only a strict owner capability may mutate reservation arrival, departure, or other fields", () => {
  assert.equal(canMutateReservationData(owner), true);
  assert.equal(canMutateReservationData({
    profile: { id: "hk", role: "housekeeping", is_owner: false, is_active: true },
    permissions: new Set([ADMIN_PERMISSIONS.manageReservations, ADMIN_PERMISSIONS.manageCalendar]),
  }), false);
  assert.equal(canMutateReservationData({
    profile: { ...owner.profile, is_owner: false }, permissions: owner.permissions,
  }), false);
});

test("housekeeping cannot mutate a client even if a malicious permission set is supplied", () => {
  assert.equal(canMutateClientData(owner), true);
  assert.equal(canMutateClientData({
    profile: { id: "hk", role: "housekeeping", is_owner: false, is_active: true },
    permissions: new Set([ADMIN_PERMISSIONS.manageCustomers]),
  }), false);
});
