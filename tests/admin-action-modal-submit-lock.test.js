import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const source = fs.readFileSync(path.join(root, "src/components/admin/AdminUi.jsx"), "utf8");

test("admin action modal locks immediately while a submission is in progress", () => {
  assert.match(source, /const \[submitting, setSubmitting\] = useState\(false\)/);
  assert.match(source, /if \(submitting\) return/);
  assert.match(source, /setSubmitting\(true\)/);
  assert.match(source, /await onSubmit\(/);
  assert.match(source, /finally \{\s*setSubmitting\(false\)/);
});

test("admin action modal disables validation and closing controls during submission", () => {
  assert.match(source, /type="submit"[^>]*disabled=\{submitting\}/);
  assert.match(source, /Traitement…/);
  assert.match(source, /type="button"[^>]*onClick=\{onClose\}[^>]*disabled=\{submitting\}/);
});
