const CACHE="osu-now-v43";

self.addEventListener("install",e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(["./","./index.html","./app.js?v=1.0.20","./style.css?v=1.0.20","./performers.html","./performers.js","./manifest.webmanifest"])));
});

self.addEventListener("activate",e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

self.addEventListener("fetch",e=>e.respondWith(
  fetch(e.request).then(r=>{
    if(r && r.ok){
      const copy=r.clone();
      caches.open(CACHE).then(c=>c.put(e.request,copy));
    }
    return r;
  }).catch(()=>caches.match(e.request))
));
