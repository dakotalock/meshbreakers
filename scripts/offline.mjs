import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const root = "dist";
const files = [];
function walk(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p);
    else if (!["sw.js", "_headers"].includes(f.name))
      files.push("./" + path.relative(root, p).split(path.sep).join("/"));
  }
}
walk(root);
const digest = crypto.createHash("sha256");
for (const f of [...files].sort())
  digest.update(fs.readFileSync(path.join(root, f.slice(2))));
const key = "meshbreakers-" + digest.digest("hex").slice(0, 12);
fs.writeFileSync(
  "dist/sw.js",
  `const CACHE=${JSON.stringify(key)};const ASSETS=${JSON.stringify(files)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('meshbreakers-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
// Authentication responses and unrelated URLs never enter the game cache.
if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.match('./index.html')));return;}
if(!ASSETS.some(asset=>new URL(asset,self.location.href).href===url.href))return;
event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request)));
});
`,
);
console.log(`Offline cache: ${files.length} bundled files (${key}).`);
