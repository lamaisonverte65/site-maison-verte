import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const migrations=JSON.parse(fs.readFileSync('docs/asset-migration-v412.json','utf8'));
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?files(path.join(dir,x.name)):[path.join(dir,x.name)]);}
test('migrated assets exist, names are portable and obsolete originals are gone',()=>{
 for(const item of migrations){
  assert.match(item.new,/^[a-z0-9./-]+$/);
  if(item.removedAsUnused){
   assert.equal(fs.existsSync('public/'+item.new),false,item.new);
  }else{
   assert.ok(fs.existsSync('public/'+item.new),item.new);
  }
  assert.equal(fs.existsSync('public/'+item.old),Boolean(item.keepOriginalForEmail),item.old);
 }
});
test('source, CSS, documentation and server functions contain no stale asset references',()=>{
 for(const file of ['src','netlify','shared','scripts','docs'].flatMap(files).filter(f=>/\.(jsx?|css|md|html|json|toml|sh|ps1)$/.test(f)&&!f.endsWith('asset-migration-v412.json'))){
  const source=fs.readFileSync(file,'utf8');
  for(const item of migrations){
   if(item.keepOriginalForEmail&&file.startsWith('netlify'))continue;
   assert.ok(!source.includes(item.old)&&!source.includes(encodeURI(item.old)),file+': '+item.old);
  }
 }
});
test('all literal public image paths in React/CSS resolve locally',()=>{
 for(const file of files('src').filter(f=>/\.(jsx?|css)$/.test(f))){
  const source=fs.readFileSync(file,'utf8');
  for(const match of source.matchAll(/["'(](\/[^"'()\n]*?\.(?:png|jpe?g|webp|svg|ico))["')]/g)){
   assert.ok(fs.existsSync('public'+decodeURI(match[1])),file+': '+match[1]);
  }
 }
});
test('email keybox procedure retains its PNG compatibility copy',()=>{
 for(const name of ['send-arrival-reminder','stripe-webhook'])assert.ok(fs.readFileSync('netlify/functions/'+name+'.js','utf8').includes('livret/procedure-boite-a-cles.png'));
});
