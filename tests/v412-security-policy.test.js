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
 assert.match(s,/href = link\.origin/);
 assert.match(s,/referrer: referrerDomain/);
});
