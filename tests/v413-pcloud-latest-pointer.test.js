import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const script = fs.readFileSync("scripts/backup/publish-latest-backup.sh", "utf8");

test("V4.13 pCloud latest pointer resolves the final encrypted folder through rclone stat", () => {
  assert.match(script, /rclone lsjson --stat/);
  assert.match(script, /payload\?\.IsDir/);
  assert.ok(script.includes("!/^d[1-9]\\d*$/.test(id)"));
  assert.doesNotMatch(script, /cryptdecode/);
  assert.doesNotMatch(script, /eapi\.pcloud\.com\/listfolder/);
  assert.doesNotMatch(script, /PCLOUD_AUTH_TOKEN/);
});

test("V4.13 pCloud latest pointer keeps publishing a numeric folder_id", () => {
  assert.match(script, /folder_id: folderId/);
  assert.match(script, /id\.slice\(1\)/);
  assert.match(script, /latest\.json\.tmp/);
  assert.match(script, /latest\.json/);
});
