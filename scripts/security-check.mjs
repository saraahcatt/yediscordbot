import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const dist=path.resolve('public');
const installURL='https://discord.com/oauth2/authorize?client_id=1554175767250870274&integration_type=0&scope=bot%20applications.commands&permissions=277294206032';
const privacyURLs=new Set(['https://openai.com/policies/privacy-policy/','https://www.cloudflare.com/privacypolicy/','https://discord.com/privacy']);
const hash=text=>crypto.createHash('sha256').update(text).digest('base64');
const files=fs.readdirSync(dist,{recursive:true}).filter(name=>fs.statSync(path.join(dist,name)).isFile());
const pages=files.filter(name=>name.endsWith('.html'));
let checkedLinks=0;
for(const name of pages){
  const file=path.join(dist,name);
  let html=fs.readFileSync(file,'utf8');
  const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
  const hashes=scripts.filter(([,attributes])=>!attributes.includes('src=')).map(([,attributes,text])=>{assert(attributes.includes('type="importmap"'),'Only import maps may be inline');return `'sha256-${hash(text)}'`;});
  const policy=`default-src 'none'; script-src 'self' ${hashes.join(' ')}; script-src-attr 'none'; style-src 'self'; style-src-attr 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; frame-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'; upgrade-insecure-requests`;
  const meta=html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)">/);
  assert(meta,'Missing CSP meta tag');
  if(process.argv.includes('--write-csp')){
    html=html.replace(/(<meta http-equiv="Content-Security-Policy" content=")[^"]*(">)/,(_,before,after)=>before+policy+after);
    fs.writeFileSync(file,html);
  }else assert.equal(meta[1],policy,`Unexpected CSP or import map hash in ${name}`);
  assert(html.indexOf('http-equiv="Content-Security-Policy"')<html.indexOf('<link '),'CSP must precede resource loading');
  assert.equal((html.match(/http-equiv="Content-Security-Policy"/g)||[]).length,1);
  for(const [,attributes,text] of scripts){
    if(attributes.includes('type="importmap"'))assert.deepEqual(JSON.parse(text),{imports:{three:'./vendor/three.module.js'}});
  }
  assert(!html.includes('CSP_PLACEHOLDER'));
  assert(html.includes('name="referrer" content="no-referrer"'));
  assert(!/<(?:iframe|object|embed|form|base)\b/i.test(html));
  assert(!/\son[a-z]+\s*=/i.test(html));
  assert(!/javascript:|unsafe-eval|<style\b/i.test(html));
  for(const [,tag] of html.matchAll(/<(a\s[^>]+)>/g)){
    const href=tag.match(/href="([^"]+)"/)?.[1]?.replaceAll('&amp;','&');
    if(!href)continue;
    if(href.startsWith('#')){assert(html.includes(`id="${href.slice(1)}"`),`Missing anchor ${href}`);continue;}
    if(!href.startsWith('https:')){assert(!/^[a-z]+:|^\/\//i.test(href),'Unexpected URL scheme');const [page,anchor]=href.split('#');const destination=path.resolve(dist,page);assert(destination.startsWith(dist+path.sep),'Internal link escaped dist');assert(fs.existsSync(destination),`Missing page ${href}`);if(anchor)assert(fs.readFileSync(destination,'utf8').includes(`id="${anchor}"`),`Missing anchor ${href}`);continue;}
    assert(href===installURL||privacyURLs.has(href),'Unexpected external destination');
    assert(tag.includes('rel="noopener noreferrer"'));
    assert(tag.includes('referrerpolicy="no-referrer"'));
    if(privacyURLs.has(href))continue;
    const url=new URL(href);
    assert.equal(url.hostname,'discord.com');
    assert.equal(url.searchParams.get('integration_type'),'0');
    assert.deepEqual(url.searchParams.get('scope').split(' '),['bot','applications.commands']);
    const permissions=BigInt(url.searchParams.get('permissions'));
    assert.equal(permissions&8n,0n,'Administrator must not be requested');
    assert.equal(permissions&6n,0n,'Kick and ban must not be requested');
    assert(!url.searchParams.has('redirect_uri'));
    checkedLinks++;
  }
  for(const [,url] of html.matchAll(/(?:src|href)="([^"#]+)"/g)){
    if(url.startsWith('https:')){const external=url.replaceAll('&amp;','&');assert(external===installURL||privacyURLs.has(external));continue;}
    assert(fs.existsSync(path.join(dist,url.split(/[?#]/)[0])),`Missing asset ${url}`);
  }
}
assert.equal(fs.readFileSync(path.join(dist,'.nojekyll'),'utf8'),'');
const bannedPaths=files.filter(name=>name!=='.nojekyll'&&/(^|[\\/])\.|\.env$|\.db$|\.sqlite|\.log$|\.pem$|\.key$|users\.json$/i.test(name));
assert.equal(bannedPaths.length,0,'Private files must not be deployed');
const secretPatterns=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/mfa\.[\w-]{40,}/,/\b[\w-]{24,28}\.[\w-]{6}\.[\w-]{27,}\b/,/art_v2_[a-zA-Z0-9_]{20,}/];
for(const name of files.filter(name=>/\.(?:html|js|css|txt)$/.test(name))){
  const content=fs.readFileSync(path.join(dist,name),'utf8');
  assert(!secretPatterns.some(regex=>regex.test(content)),`Potential secret in ${name}`);
}
const app=fs.readFileSync(path.join(dist,'experience.js'),'utf8');
assert(!/innerHTML|document\.write|\beval\s*\(|new Function|localStorage|sessionStorage|document\.cookie/.test(app));
assert(app.includes('chapters.length-1'));
assert.equal((fs.readFileSync(path.join(dist,'index.html'),'utf8').match(/class="chapter(?: hero)?"/g)||[]).length,7);
const report={pages:pages.length,assets:files.length,installationLinks:checkedLinks,privateFiles:0,potentialSecrets:0,inlineExecutableScripts:0,externalRuntimeDependencies:0,administratorPermission:false};
if(process.argv.includes('--online')){
  const response=await fetch('https://api.osv.dev/v1/query',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({package:{name:'three',ecosystem:'npm'},version:'0.170.0'})});
  assert(response.ok,`OSV returned ${response.status}`);
  const result=await response.json();
  report.dependencyAdvisories=(result.vulns??[]).map(v=>({id:v.id,summary:v.summary}));
}
console.log(JSON.stringify(report,null,2));
