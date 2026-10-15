import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
test('pricing preserves rule identifiers for admin deletion without private configuration',async()=>{
 const rows={pricing_settings:{default_night_price:80,cleaning_fee:50,keybox_code:'PRIVATE'},season_prices:[{id:'season-1',label:'été',night_price:90,start_date:'2027-07-01',end_date:'2027-08-31',minimum_nights:7,internal_note:'PRIVATE'}],price_overrides:[{id:'override-1',label:'weekend',night_price:100,start_date:'2027-07-01',end_date:'2027-07-03',internal_note:'PRIVATE'}]};
 const db={from(table){let fields=[];const query={select(value){fields=value.split(',');return query},eq(){return query},order(){return query},maybeSingle(){return query},then(resolve,reject){const pick=row=>Object.fromEntries(fields.filter(k=>k in row).map(k=>[k,row[k]]));return Promise.resolve({data:Array.isArray(rows[table])?rows[table].map(pick):pick(rows[table])}).then(resolve,reject)}};return query}};
 const source=fs.readFileSync('netlify/functions/get-pricing.js','utf8').replace(/import[^;]+;/,'').replace('export async function handler','async function handler');
 const handler=vm.runInNewContext(source+'; handler',{createClient:()=>db,process:{env:{}},console});
 const result=await handler();assert.equal(result.statusCode,200);const body=JSON.parse(result.body);
 assert.equal(body.seasonPrices[0].id,'season-1');assert.equal(body.priceOverrides[0].id,'override-1');assert.equal(body.cleaningFee,50);assert.doesNotMatch(result.body,/PRIVATE|keybox_code|internal_note/);
});
