import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('public reviews serialize only display fields even if the database row includes PII',async()=>{
 const module=await import('../netlify/functions/public-reviews.js').catch(()=>({}));
 assert.equal(typeof module.handler,'function');
 const query={select(){return this},eq(key,value){assert.equal(key,'status');assert.equal(value,'published');return this},order(){return this},limit(n){assert.equal(n,6);return Promise.resolve({data:[{id:'r1',rating:5,comment:'Super',display_name:'Alice',guest_first_name:'Alice',guest_last_name:'PRIVATE',guest_email:'PRIVATE',guest_phone:'PRIVATE',stay_period:'été'}]})}};
 const result=await module.handler({httpMethod:'GET'},{},{createClient:()=>({from:()=>query})});
 assert.equal(result.statusCode,200);
 assert.deepEqual(JSON.parse(result.body),{reviews:[{id:'r1',rating:5,comment:'Super',display_name:'Alice',stay_period:'été'}]});
});
test('migration removes direct anonymous review access while keeping server publication',()=>{
 const p='supabase/migrations/202610140001_v412_public_review_boundary.sql';assert.ok(fs.existsSync(p));
 const sql=fs.readFileSync(p,'utf8');
 assert.match(sql,/REVOKE ALL ON TABLE public\.guest_reviews FROM PUBLIC, anon/);
 assert.match(sql,/AS RESTRICTIVE FOR ALL TO anon USING \(false\) WITH CHECK \(false\)/);
 assert.match(sql,/GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public\.guest_reviews TO service_role/);
});
