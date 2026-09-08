const CACHE='jeebli-customer-v9';
const CORE=[
  './','./index.html','./styles.css','./brand.css','./customer-v2.css','./customer-v3.css','./customer-services.css',
  './config.js','./app.js','./tracking.js','./brand.js','./customer-areas.js','./customer-v2.js','./customer-v3.js','./customer-v3-bridge.js','./customer-services.js','./customer-launch.js',
  './manifest.webmanifest','./assets/brand/mark.svg','./assets/brand/hero.svg',
  './assets/services/taxi.svg','./assets/services/private.svg','./assets/services/delivery.svg','./assets/services/cargo.svg','./assets/services/intercity.svg'
];
self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)));
});
self.addEventListener('activate',event=>{
  event.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
  ]));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).then(response=>{
      const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response;
    }).catch(async()=>await caches.match(event.request)||await caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>{
    const network=fetch(event.request).then(response=>{
      if(response&&response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy))}
      return response;
    }).catch(()=>cached||new Response('Offline',{status:503,statusText:'Offline'}));
    return cached||network;
  }));
});
