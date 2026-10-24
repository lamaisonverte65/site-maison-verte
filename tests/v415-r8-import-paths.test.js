import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

for (const endpoint of ["request-arrival-link.js", "check-expired-bookings.js"]) {
  test(`R8 ${endpoint} resolves every relative static import`, () => {
    const file = fileURLToPath(new URL(`../netlify/functions/${endpoint}`, import.meta.url));
    const source = readFileSync(file, "utf8");
    const importPaths = [...source.matchAll(/\bfrom\s+["'](\.[^"']+)["']/g)].map((match) => match[1]);
    assert.ok(importPaths.length > 0, "The endpoint should have imports to verify");
    for (const importPath of importPaths) {
      assert.ok(existsSync(resolve(dirname(file), importPath)), `${endpoint}: missing import ${importPath}`);
    }
  });
}
