import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(process.cwd());
const functionsDir = path.join(root, "netlify", "functions");

function listJsFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listJsFiles(full);
    return entry.isFile() && entry.name.endsWith(".js") ? [full] : [];
  });
}

test("all Netlify JavaScript functions parse as ESM modules", () => {
  const files = listJsFiles(functionsDir);
  assert.ok(files.length > 0, "expected Netlify JavaScript functions to exist");

  const parserScript = `
    const fs = require("node:fs");
    const vm = require("node:vm");
    const files = JSON.parse(process.argv[1]);
    const failures = [];
    for (const file of files) {
      try {
        new vm.SourceTextModule(fs.readFileSync(file, "utf8"), { identifier: file });
      } catch (error) {
        failures.push(file + ": " + error.message);
      }
    }
    if (failures.length) {
      console.error(failures.join("\\n"));
      process.exit(1);
    }
  `;

  const result = spawnSync(
    process.execPath,
    ["--experimental-vm-modules", "-e", parserScript, JSON.stringify(files)],
    { encoding: "utf8" }
  );

  assert.equal(result.status, 0, result.stderr || result.stdout || "ESM syntax validation failed");
});
