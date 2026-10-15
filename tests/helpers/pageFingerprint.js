import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
const require = createRequire(import.meta.url);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
export async function pageFingerprint(page) {
 const result=await build({entryPoints:[decodeURIComponent(new URL('../../src/pages/'+page+'.jsx',import.meta.url).pathname).replace(/^\/(\w:)/,'$1')],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',external:['react','react-dom','react/jsx-runtime'],loader:{'.css':'empty'},plugins:[{name:'offline',setup(b){b.onLoad({filter:/supabaseClient\.js$/},()=>({contents:'export const supabase = {};',loader:'js'}));}}]});
 const module={exports:{}};
 class FixedDate extends Date {constructor(...a){super(...(a.length?a:['2026-10-14T12:00:00Z']))}static now(){return new Date('2026-10-14T12:00:00Z').getTime()}}
 vm.runInNewContext(result.outputFiles[0].text,{global:{},require,module,exports:module.exports,console,Date:FixedDate,URL,URLSearchParams,process,setTimeout,clearTimeout});
 let html=renderToStaticMarkup(React.createElement(module.exports.default));
 const migrations=JSON.parse(fs.readFileSync(new URL('../../docs/asset-migration-v412.json',import.meta.url),'utf8'));
 for(const item of migrations) html=html.replaceAll(item.new,item.old);
 return {hash:createHash('sha256').update(html).digest('hex'),html};
}
