import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
const module = await import('../scripts/backup/restore-storage.mjs').catch(()=>({}));
const env={SOURCE_PROJECT_REF:'source',RESTORE_PROJECT_REF:'target',RESTORE_SUPABASE_URL:'https://target.supabase.co',RESTORE_SECRET_KEY:'test-key',CONFIRM_TEST_RESTORE:'YES'};
async function fixture(t, mutate=()=>{}) {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'lmv-storage-'));
  t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const buckets=[{id:'invoices',name:'invoices',public:false,type:'STANDARD',file_size_limit:5242880,allowed_mime_types:['application/pdf'],versioning_status:'DISABLED'}];
  const objects=[{bucket_id:'invoices',name:'2026/a b.pdf',metadata:{size:3,mimetype:'application/pdf',cacheControl:'max-age=3600'}}];
  mutate(buckets,objects);
  const files={'inventory/storage_buckets.json':JSON.stringify(buckets),'inventory/storage_objects.json':JSON.stringify(objects),'storage/invoices/2026/a b.pdf':'PDF'};
  let sums='';
  for(const [name,body] of Object.entries(files)){await fs.mkdir(path.dirname(path.join(dir,name)),{recursive:true});await fs.writeFile(path.join(dir,name),body);sums+=`${createHash('sha256').update(body).digest('hex')}  ./${name}\n`;}
  await fs.writeFile(path.join(dir,'SHA256SUMS'),sums);
  return dir;
}
function api({existing=false,uploadFail=false,download='PDF'}={}) {
  const calls=[];
  return {calls,fetch:async(url,options={})=>{
    calls.push({url, ...options});
    if(options.method==='GET' && url.endsWith('/bucket')) return new Response(JSON.stringify(existing?[{id:'existing'}]:[]));
    if(options.method==='GET')return new Response(download);
    if(uploadFail && url.includes('/object/'))return new Response('failure',{status:500});
    return new Response('{}');
  }};
}
test('dry run validates files without making any network request',async t=>{assert.equal(typeof module.restoreStorage,'function');const dir=await fixture(t);const a=api();await module.restoreStorage(dir,{env,fetchImpl:a.fetch});assert.equal(a.calls.length,0);});
test('creates private bucket, uploads original name and bytes, then verifies downloaded hash',async t=>{
  assert.equal(typeof module.restoreStorage,'function');const dir=await fixture(t);const a=api();await module.restoreStorage(dir,{env,apply:true,fetchImpl:a.fetch});
  assert.equal(a.calls.length,4);assert.deepEqual(JSON.parse(a.calls[1].body),{id:'invoices',name:'invoices',public:false,file_size_limit:5242880,allowed_mime_types:['application/pdf']});
  assert.match(a.calls[2].url,/\/object\/invoices\/2026\/a%20b.pdf$/);assert.equal(a.calls[2].headers['x-upsert'],'false');assert.equal(a.calls[2].headers['content-type'],'application/pdf');assert.equal(a.calls[2].headers['cache-control'],'max-age=3600');assert.equal(Buffer.from(a.calls[2].body).toString(),'PDF');
});
for(const [name,patch] of [['source',{RESTORE_PROJECT_REF:'source',RESTORE_SUPABASE_URL:'https://source.supabase.co'}],['wrong URL',{RESTORE_SUPABASE_URL:'https://wrong.supabase.co'}],['no confirmation',{CONFIRM_TEST_RESTORE:''}],['no target key',{RESTORE_SECRET_KEY:''}]])test(`rejects ${name} before network`,async t=>{assert.equal(typeof module.restoreStorage,'function');const dir=await fixture(t);const a=api();await assert.rejects(module.restoreStorage(dir,{env:{...env,...patch},apply:true,fetchImpl:a.fetch}));assert.equal(a.calls.length,0);});
for(const [name,mutate] of [['path traversal',(_,o)=>o[0].name='../escape'],['versioned bucket',b=>b[0].versioning_status='ENABLED'],['size mismatch',(_,o)=>o[0].metadata.size=8],['duplicate object',(_,o)=>o.push({...o[0]})]])test(`rejects ${name} before network`,async t=>{assert.equal(typeof module.restoreStorage,'function');const dir=await fixture(t,mutate);const a=api();await assert.rejects(module.restoreStorage(dir,{env,apply:true,fetchImpl:a.fetch}));assert.equal(a.calls.length,0);});
test('checksum corruption blocks before network',async t=>{assert.equal(typeof module.restoreStorage,'function');const dir=await fixture(t);await fs.writeFile(path.join(dir,'storage/invoices/2026/a b.pdf'),'BAD');const a=api();await assert.rejects(module.restoreStorage(dir,{env,apply:true,fetchImpl:a.fetch}));assert.equal(a.calls.length,0);});
for(const [name,opts,maxCalls] of [['nonempty target',{existing:true},1],['upload failure',{uploadFail:true},3],['readback mismatch',{download:'BAD'},4]])test(`stops on ${name}`,async t=>{assert.equal(typeof module.restoreStorage,'function');const dir=await fixture(t);const a=api(opts);await assert.rejects(module.restoreStorage(dir,{env,apply:true,fetchImpl:a.fetch}));assert.equal(a.calls.length,maxCalls);});
