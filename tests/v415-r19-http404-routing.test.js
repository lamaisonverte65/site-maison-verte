import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const rules = read("public/_redirects")
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"))
  .map((line) => {
    const [from, to, status, ...extra] = line.split(/\s+/);
    assert.deepEqual(extra, [], `Regle inattendue : ${line}`);
    assert.ok(from?.startsWith("/"), `Chemin source invalide : ${line}`);
    assert.ok(to?.startsWith("/"), `Destination invalide : ${line}`);
    assert.ok(["200", "404"].includes(status), `Statut invalide : ${line}`);
    return { from, to, status };
  });

function responseFor(pathname) {
  // Aucune regle wildcard hors des URL explicitement autorisees en R19.
  // Les fichiers physiques sont servis par Netlify avant son handler 404.
  return rules.find((rule) => rule.from === pathname) || null;
}

const publicPaths = [
  "guide-vallees-aure-louron",
  "ski-vallees-aure-louron",
  "livret", "livret-accueil",
  "mentions-legales", "politique-confidentialite",
];

const known = [
  "/en", "/en/", "/es", "/es/",
  "/admin", "/success", "/cancel", "/arrival", "/avis-validation",
  "/contact", "/appeler",
  ...["", "en/", "es/"].flatMap((prefix) =>
    publicPaths.flatMap((page) => [`/${prefix}${page}`, `/${prefix}${page}/`])),
];

test("R19 : les routes React existantes restent servies en HTTP 200", () => {
  assert.equal(new Set(known).size, known.length, "Route dupliquee dans la liste attendue");
  for (const pathname of known) {
    assert.deepEqual(responseFor(pathname), {
      from: pathname, to: "/index.html", status: "200",
    }, pathname);
  }
});

test("R19 : les URL client historiques conservent le chemin exact", () => {
  for (const pathname of ["/admin", "/success", "/cancel", "/arrival", "/avis-validation", "/contact", "/appeler"]) {
    assert.equal(responseFor(pathname)?.status, "200", pathname);
  }
  assert.deepEqual(responseFor("/calendar.ics"), {
    from: "/calendar.ics", to: "/.netlify/functions/export-ical", status: "200",
  });
});

test("R19 : aucune route inventee ne beneficie du fallback HTTP 200", () => {
  assert.equal(new Set(rules.map((rule) => rule.from)).size, rules.length, "Doublon de regle Netlify");
  for (const pathname of [
    "/nexiste-pas", "/en/nexiste-pas", "/es/nexiste-pas",
    "/guide-vallees-aure-louron-supprime", "/en/guide-vallees-aure-louron-invalide",
    "/admin/mauvaise-route", "/success/invalide", "/livret/inconnu",
    "/assets/inconnu.js", "/documents/inconnu.pdf",
  ]) {
    assert.equal(responseFor(pathname), null, pathname);
  }
  assert.doesNotMatch(read("netlify.toml"), /\[\[redirects\]\]/);
  assert.ok(!rules.some((rule) => rule.from.includes("*")), "Routage wildcard interdit en R19");
});

test("R19 : le serveur Netlify dispose d'une page 404 statique non indexable", () => {
  const html = read("public/404.html");
  assert.match(html, /<meta name="robots" content="noindex,follow">/);
  assert.match(html, /<html lang="fr">/);
  for (const lang of ["fr", "en", "es"]) {
    assert.match(html, new RegExp(`<article id="${lang}"`));
  }
  assert.match(html, /window\.location\.pathname/);
  assert.match(html, /Page not found/);
  assert.match(html, /P[aá]gina no encontrada/);
  assert.match(html, /href="\/en\/"/);
  assert.match(html, /href="\/es\/"/);
});

test("R19 : la liste des rewrites ne contient pas de chemin de fichier statique", () => {
  for (const path of ["/robots.txt", "/sitemap.xml", "/favicon.ico", "/index.html", "/404.html"]) {
    assert.equal(responseFor(path), null);
  }
  assert.ok(rules.every((rule) => rule.from === "/calendar.ics" || rule.to === "/index.html"));
});
