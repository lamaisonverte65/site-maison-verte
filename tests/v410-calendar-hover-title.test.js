import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("src/components/CalendarAdmin.jsx", "utf8");

test("calendar exposes the complete reservation label on mouse hover", () => {
  assert.match(source, /function mountCalendarEvent\(info\)/);
  assert.match(source, /calendar_display_title \|\| info\.event\.title/);
  assert.match(source, /setAttribute\("title", fullTitle\)/);
  assert.match(source, /setAttribute\("aria-label", fullTitle\)/);
  assert.match(source, /eventDidMount=\{mountCalendarEvent\}/);
});

test("hover support preserves the half-day edge adjustment", () => {
  assert.match(source, /mountCalendarEvent[\s\S]*updateHalfDayEdge\(info\)/);
});
