import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getUnavailableAdminSources } from "../src/services/adminLoadState.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("R18 : le tracker envoie uniquement la page vue, sans heartbeat ni événements inutiles", () => {
  const source = read("src/components/SiteAnalyticsTracker.jsx");
  assert.match(source, /event_type: "page_view"/);
  for (const forbidden of ["setInterval(", "trackPageEngagement(", 'trackEvent("scroll_depth"', 'trackEvent("link_click"', 'trackEvent("section_view"', 'trackEvent("form_start"']) {
    assert.equal(source.includes(forbidden), false, `aucun appel ${forbidden}`);
  }
});

test("R18 : la lecture des visites ne télécharge plus de lignes", () => {
  const source = read("src/services/adminDataService.js");
  assert.match(source, /supabase\.rpc\("get_admin_visit_summary", \{ p_days: 30 \}\)/);
  assert.doesNotMatch(source, /readAllAdminRows\(supabase, \{\s*table: "site_visits"/);
  assert.doesNotMatch(source, /siteVisitsTotalCount/);
});

test("R18 : les panneaux financiers restent accessibles en cas de panne de statistiques", () => {
  const errors = { site_visits_summary: "Statistiques indisponibles" };
  assert.deepEqual(getUnavailableAdminSources("visits", errors), ["site_visits_summary"]);
  assert.deepEqual(getUnavailableAdminSources("home", errors), []);
  assert.deepEqual(getUnavailableAdminSources("summary", errors), []);
});

test("R18 : le panneau ne présente plus de métriques de visiteurs uniques ou de surveillance détaillée", () => {
  const ui = read("src/components/admin/VisitsPanel.jsx");
  for (const forbidden of ["Visiteurs uniques", "Temps moyen", "Clics enregistrés", "Sessions récentes", "Événements récents", "Tailles écran", "Sections vues"]) {
    assert.equal(ui.includes(forbidden), false, forbidden);
  }
  assert.match(ui, /Pages vues 30 jours/);
  assert.match(ui, /Demandes enregistrées 30 jours/);
});

test("R18 : la fonction SQL ne modifie pas les événements existants et exige le propriétaire", () => {
  const sql = read("supabase/migrations/202610280002_v415_r18_site_visits_summary.sql");
  assert.match(sql, /SECURITY INVOKER/);
  assert.match(sql, /public\.is_v4_owner\(\)/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.get_admin_visit_summary\(integer\) TO authenticated/);
  assert.doesNotMatch(sql, /\bDELETE FROM public\.site_visits\b/i);
  assert.doesNotMatch(sql, /\bUPDATE public\.site_visits\b/i);
  assert.doesNotMatch(sql, /\bTRUNCATE TABLE public\.site_visits\b/i);
});
