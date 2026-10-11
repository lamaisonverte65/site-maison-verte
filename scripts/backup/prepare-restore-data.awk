# Strict reader for Supabase --use-copy data dumps, not a general SQL parser.
# COPY payloads must be handled before SQL matching: user text is never parsed.
function fail(message) { print "Unsupported data dump at line " NR ": " message > "/dev/stderr"; failed=1; exit 1 }
{ sub(/\r$/, "") }
in_copy {
  if (!skip) print
  if ($0 == "\\.") { in_copy=0; skip=0 }
  next
}
/^COPY "[a-zA-Z_][a-zA-Z0-9_]*"[.]"[a-zA-Z_][a-zA-Z0-9_]*" \(.*\) FROM stdin;$/ {
  in_copy=1
  skip=($0 ~ /^COPY "storage"[.]/)
  if ($0 ~ /^COPY "auth"[.]"users" /) auth_users++
  if (!skip) print
  next
}
/^SELECT pg_catalog[.]setval\('/ {
  if ($0 !~ /^SELECT pg_catalog[.]setval\('"[a-zA-Z_][a-zA-Z0-9_]*"[.]"[a-zA-Z_][a-zA-Z0-9_]*"', [0-9]+, (true|false)\);$/) fail("unrecognized sequence statement")
  if ($0 !~ /setval\('"storage"[.]/) print
  next
}
/^[[:space:]]*$/ || /^--/ { print; next }
/^RESET ALL;$/ { print; next }
/^SET [a-z_]+ = (0|'UTF8'|on|off|false|warning|content|replica);$/ { print; next }
/^SELECT pg_catalog[.]set_config\('search_path', '', false\);$/ { print; next }
{ fail("expected COPY dump syntax") }
END {
  if (failed) exit 1
  if (in_copy) fail("unterminated COPY block")
  if (auth_users != 1) fail("exactly one auth.users block is required; legacy auth-only fallback is not supported")
}
