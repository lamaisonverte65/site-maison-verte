import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('global HTTP policy blocks embedding and plugins without breaking existing services',()=>{
 const s=fs.readFileSync('netlify.toml','utf8');
 for(const value of ['X-Content-Type-Options = "nosniff"','Referrer-Policy = "strict-origin-when-cross-origin"','X-Frame-Options = "DENY"',"object-src 'none'","base-uri 'self'","frame-ancestors 'none'",'camera=(), microphone=(), geolocation=()']) assert.ok(s.includes(value),value);
});
test('analytics does not retain persistent visitor identity, raw user agent or link text',()=>{
 const s=fs.readFileSync('src/components/SiteAnalyticsTracker.jsx','utf8');
 assert.doesNotMatch(s,/localStorage\.setItem\(VISITOR_STORAGE_KEY/);
 assert.match(s,/sessionStorage\.setItem\(VISITOR_STORAGE_KEY/);
 assert.doesNotMatch(s,/user_agent:|platform:|target\.innerText|target\.textContent/);
 // R18 ne collecte plus les clics ni leur URL : vérifier l'absence de collecte,
 // plutôt qu'exiger l'ancien code anonymisant une URL de clic.
 assert.match(s,/writePageViewOnce\(/);
 assert.match(s,/event_type:\s*[\"']page_view[\"']/);
 assert.doesNotMatch(s,/event_type:\s*[\"'](?:link_click|page_engagement|scroll_depth|section_view|form_start)[\"']/);
 assert.doesNotMatch(s,/\b(?:href|link_text|element_text):\s*/);
 // L'origine du trafic ne doit conserver que le domaine, jamais l'URL complète.
 assert.match(s,/new URL\(document\.referrer\)\.hostname/);
 assert.match(s,/referrer_domain:\s*referrerDomain\s*\|\|\s*null/);
 assert.doesNotMatch(s,/referrer:\s*document\.referrer/);
});
