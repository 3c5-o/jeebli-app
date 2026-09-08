const CACHE='jeebli-customer-v19';
const CORE=[
  './','./index.html','./styles.css','./brand.css','./customer-v2.css','./customer-v3.css','./customer-services.css','./customer-avatar.css','./customer-polish.css','./customer-contrast.css','./customer-lux.css','./customer-home-v2.css',
  './config.js','./app.js','./tracking.js','./brand.js','./customer-areas.js','./customer-v2.js','./customer-v3.js','./customer-v3-bridge.js','./customer-services.js','./customer-starex.js','./customer-launch.js','./customer-avatar.js','./customer-addresses.js','./customer-system-notify.js','./customer-polish.js','./customer-ux.js','./customer-push.js','./customer-lux.js','./customer-home-v2.js',
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
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});
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
self.addEventListener('push',event=>{
  let data={};
  try{data=event.data?.json()||{}}catch{data={body:event.data?.text()||'لديك تحديث جديد في جيبلي'}}
  const title=data.title||'جيبلي | JEEBLI';
  const options={
    body:data.body||'لديك تحديث جديد في جيبلي',
    icon:data.icon||'./assets/brand/mark.svg',
    badge:data.badge||'./assets/brand/mark.svg',
    tag:data.tag||`jeebli-${Date.now()}`,
    renotify:true,
    dir:'rtl',
    lang:'ar',
    vibrate:[180,80,180],
    data:{url:data.url||'./?action=notifications',notificationId:data.id||null,type:data.type||null},
    actions:[{action:'open',title:'فتح جيبلي'}]
  };
  event.waitUntil(self.registration.showNotification(title,options));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=new URL(event.notification.data?.url||'./?action=requests',self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    const existing=list.find(c=>c.url.startsWith(self.registration.scope));
    if(existing){existing.navigate(target);return existing.focus()}
    return self.clients.openWindow(target);
  }));
});