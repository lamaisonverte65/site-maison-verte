import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import vm from "node:vm";
import React from "react";
import * as forms from "../src/utils/adminUserForm.js";

test("generated housekeeping passwords use secure randomness and are practical to transmit", () => {
  assert.equal(typeof forms.generateHousekeepingPassword, "function");
  const passwords = new Set();
  for (let i = 0; i < 50; i++) {
    const password = forms.generateHousekeepingPassword();
    assert.match(password, /^[A-Za-z0-9!-]{16}$/);
    for (const pattern of [/[a-z]/, /[A-Z]/, /[0-9]/, /[!-]/]) assert.match(password, pattern);
    passwords.add(password);
  }
  assert.equal(passwords.size, 50);
});

test("missing secure randomness fails closed instead of suggesting a fallback password", () => {
  assert.equal(typeof forms.generateHousekeepingPassword, "function");
  assert.throws(() => forms.generateHousekeepingPassword(null), /sécurisée/i);
});

// Exercise the real JSX handlers without a DOM or any remote API.
async function componentHarness(file, props) {
  const { outputFiles } = await build({ entryPoints: [file], bundle: true, write: false, platform: "node", format: "cjs", external: ["react"], logLevel: "silent" });
  const state = [];
  let cursor = 0;
  const alerts = [];
  const context = { React, module: { exports: {} }, exports: {}, crypto: globalThis.crypto,
    alert: (message) => alerts.push(message),
    window: { prompt: (_message, value) => value },
    require: (name) => {
      assert.equal(name, "react");
      return { ...React, useState(initial) {
        const index = cursor++;
        if (!(index in state)) state[index] = typeof initial === "function" ? initial() : initial;
        return [state[index], (value) => { state[index] = typeof value === "function" ? value(state[index]) : value; }];
      } };
    },
  };
  vm.runInNewContext(outputFiles[0].text, context);
  const render = () => { cursor = 0; return context.module.exports.default(props); };
  return { render, alerts };
}

function nodes(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...nodes(node.props?.children)];
}
const button = (tree, text) => nodes(tree).find((node) => node.type === "button" && node.props.children === text);
const passwordField = (tree) => nodes(tree).find((node) => node.type === "input" && node.props.readOnly);

test("creation generates a visible read-only password and submits exactly that password", async () => {
  let submitted;
  const ui = await componentHarness("src/components/admin/users/UserCreatePanel.jsx", { onCreateHousekeeping: async (payload) => { submitted = payload; } });
  let tree = ui.render();
  const generate = button(tree, "Générer");
  assert.ok(generate, "creation must offer secure generation");
  generate.props.onClick();
  tree = ui.render();
  const field = passwordField(tree);
  assert.ok(field, "generated password must be visible and not manually weakened");
  assert.equal(field.props.type, "text");
  assert.equal(field.props.value.length, 16);
  const password = field.props.value;
  nodes(tree).find((node) => node.type === "input" && !node.props.readOnly && node.props.type !== "email").props.onChange({ target: { value: "Équipe" } });
  tree = ui.render();
  nodes(tree).find((node) => node.props?.type === "email").props.onChange({ target: { value: "team@example.test" } });
  tree = ui.render();
  await nodes(tree).find((node) => node.type === "form").props.onSubmit({ preventDefault() {} });
  assert.equal(submitted.temporaryPassword, password);
});

test("reset shows a fresh password without writing until confirmation; cancellation does not reset", async () => {
  const calls = [];
  const ui = await componentHarness("src/components/admin/users/UsersPanel.jsx", {
    permissions: { isOwner: true },
    data: { users: [{ id: "team", email: "team@example.test", role: "housekeeping", is_active: true }], resetHousekeepingPassword: async (...args) => calls.push(args) },
  });
  await button(ui.render(), "Réinitialiser MDP").props.onClick();
  assert.equal(calls.length, 0, "opening reset must not change the password");
  const first = passwordField(ui.render()).props.value;
  button(ui.render(), "Annuler").props.onClick();
  assert.equal(calls.length, 0);
  await button(ui.render(), "Réinitialiser MDP").props.onClick();
  const field = passwordField(ui.render());
  assert.equal(field.props.type, "text");
  assert.equal(field.props.value.length, 16);
  assert.notEqual(field.props.value, first);
  await button(ui.render(), "Confirmer le reset").props.onClick();
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "team");
  assert.equal(calls[0][1], field.props.value);
});
