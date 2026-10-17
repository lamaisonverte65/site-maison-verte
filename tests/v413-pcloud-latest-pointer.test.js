import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const script = fs.readFileSync("scripts/backup/publish-latest-backup.sh", "utf8");

test("V4.13 pCloud latest pointer lists the logical parent so rclone returns the real directory id", () => {
  assert.match(script, /LOGICAL_PARENT=/);
  assert.match(script, /rclone lsjson "LMVCRYPT:\$\{LOGICAL_PARENT\}" --dirs-only/);
  assert.match(script, /item\?\.Name === backupId/);
  assert.doesNotMatch(script, /lsjson --stat/);
  assert.doesNotMatch(script, /cryptdecode/);
  assert.doesNotMatch(script, /eapi\.pcloud\.com\/listfolder/);
  assert.doesNotMatch(script, /PCLOUD_AUTH_TOKEN/);
});

test("V4.13 pCloud latest pointer keeps publishing an exact numeric folder_id", () => {
  assert.match(script, /folder_id: folderId/);
  assert.match(script, /\^d\?\[1-9\]\\d\*\$/);
  assert.match(script, /id\.startsWith\("d"\) \? id\.slice\(1\) : id/);
  assert.match(script, /latest\.json\.tmp/);
  assert.match(script, /latest\.json/);
});
