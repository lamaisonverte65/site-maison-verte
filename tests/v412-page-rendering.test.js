import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pageFingerprint } from './helpers/pageFingerprint.js';
const baseline=JSON.parse(fs.readFileSync(new URL('./fixtures/v412-page-fingerprints.json',import.meta.url),'utf8'));
for(const page of ['MaisonVerte','LivretAccueil']) test(page+': extraction preserves the rendered DOM, classes and inline styles',async()=>{
 const result=await pageFingerprint(page); assert.equal(result.hash,baseline[page]);
});
