const {SUPABASE_URL,SUPABASE_KEY}=window.JEEBLI_CONFIG;
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];

let currentUser=null;
let currentProfile=null;
let currentDriver=null;
let currentPage='home';
let openRequests=[];
let myOffers=[];
let activeRide=null;
let activeCustomer=null;
let homeMap=null;
let homeMarker=null;
let activeMap=null;
let activeDriverMarker=null;
let locationWatchId=null;
let realtimeChannels=[];
let currentOfferRide=null;
let editingOffer=null;
let latestDriverLocation=null;

const openStatuses=['requested','searching','offers_received','negotiating'];
const activeStatuses=['driver_selected','driver_on_way','driver_arrived','in_progress'];
const serviceNames={taxi:'تكسي',private:'خصوصي',delivery:'توصيل',cargo:'حمل',intercity:'بين المحافظات'};
const serviceIcons={taxi:'🚕',private:'🚘',delivery:'📦',cargo:'🚚',intercity:'🛣️'};
const statusNames={requested:'جديد',searching:'جاري البحث',offers_received:'وصلت عروض',negotiating:'تفاوض',driver_selected:'تم اختيارك',driver_on_way:'في الطريق',driver_arrived:'وصلت',in_progress:'الرحلة جارية',completed:'مكتملة',cancelled:'ملغاة'};
const offerStatusNames={pending:'بانتظار العميل',accepted:'مقبول',rejected:'اختار سائقاً آخر',withdrawn:'مسحوب',expired:'منتهي'};

function icons(){if(window.lucide)window.lucide.createIcons()}
function escapeHtml(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function money(v){return Number(v||0).toLocaleString('ar-IQ')+' د.ع'}
function initial(v='ج'){return (String(v).trim()[0]||'ج').toUpperCase()}
function formatDate(iso){if(!iso)return '—';try{return new Intl.DateTimeFormat('ar-IQ',{dateStyle:'medium',timeStyle:'short'}).format(new Date(iso))}catch{return '—'}}
function notify(message){const t=$('driverToast');t.textContent=message;t.classList.remove('hidden');clearTimeout(window.__driverToast);window.__driverToast=setTimeout(()=>t.classList.add('hidden'),3400)}
function setBusy(form,busy){const b=form.querySelector('[type="submit"]');if(b){b.disabled=busy;b.style.opacity=busy?'.6':'1'}}
function hideSplash(){setTimeout(()=>$('driverSplash').classList.add('hide'),260)}
function openSheet(id){$(id).classList.remove('hidden');document.body.style.overflow='hidden';icons()}
function closeSheet(id){$(id).classList.add('hidden');document.body.style.overflow=''}
function hasActiveRide(){return activeRide&&activeStatuses.includes(activeRide.status)}

function switchPage(page){
  currentPage=page;
  $$('.driver-page').forEach(p=>p.classList.toggle('active',p.id===`driver-page-${page}`));
  $$('.driver-nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.driverPage===page));
  if(page==='home'){loadHome();setTimeout(()=>homeMap?.invalidateSize(),80)}
  if(page==='offers')loadMyOffers();
  if(page==='active')renderActiveRide();
  if(page==='earnings')loadEarnings();
  if(page==='account')renderAccount();
  window.scrollTo({top:0,behavior:'smooth'});icons();
}

function initHomeMap(){
  if(homeMap)return;
  homeMap=L.map('driverMap',{zoomControl:false}).setView([35.47,43.25],11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(homeMap);
}
function updateHomePosition(lat,lng){
  initHomeMap();
  latestDriverLocation={lat,lng};
  if(homeMarker)homeMap.removeLayer(homeMarker);
  homeMarker=L.circleMarker([lat,lng],{radius:9,weight:4,color:'#fff',fillColor:'#2878e8',fillOpacity:1}).addTo(homeMap);
  homeMap.setView([lat,lng],15);
  $('gpsState').innerHTML='<i data-lucide="navigation"></i> الموقع مباشر';icons();
}
async function pushLocation(position){
  if(!currentUser||!currentDriver||!['online','busy'].includes(currentDriver.status))return;
  const c=position.coords;
  updateHomePosition(c.latitude,c.longitude);
  const payload={driver_id:currentUser.id,lat:c.latitude,lng:c.longitude,heading:Number.isFinite(c.heading)?c.heading:null,speed_kmh:Number.isFinite(c.speed)?Math.max(0,c.speed*3.6):null,updated_at:new Date().toISOString()};
  const {error}=await db.from('driver_locations').upsert(payload,{onConflict:'driver_id'});
  if(error)console.warn('location update failed',error.message);
  if(activeMap)updateActiveDriverMarker(c.latitude,c.longitude);
}
function startLocationWatch(){
  if(locationWatchId!==null)return;
  if(!navigator.geolocation){notify('هذا الجهاز لا يدعم تحديد الموقع');return;}
  $('gpsState').textContent='جاري تشغيل GPS...';
  locationWatchId=navigator.geolocation.watchPosition(pushLocation,()=>{$('gpsState').textContent='تعذر الوصول للموقع';notify('فعّل إذن الموقع حتى تستقبل الرحلات وتشارك موقعك أثناء الرحلة')},{enableHighAccuracy:true,maximumAge:4000,timeout:12000});
}
function stopLocationWatch(){if(locationWatchId!==null){navigator.geolocation.clearWatch(locationWatchId);locationWatchId=null}$('gpsState').innerHTML='<i data-lucide="navigation"></i> الموقع متوقف';icons()}
function locateOnce(){if(!navigator.geolocation)return notify('تحديد الموقع غير مدعوم');navigator.geolocation.getCurrentPosition(pushLocation,()=>notify('فعّل إذن الموقع'),{enableHighAccuracy:true,timeout:10000})}

async function loadDriverIdentity(user){
  const {data:profile,error:pErr}=await db.from('profiles').select('id,full_name,phone,avatar_url,role,email').eq('id',user.id).maybeSingle();
  if(pErr||!profile)return {ok:false,reason:'تعذر قراءة الحساب'};
  if(profile.role==='admin'){location.href='./admin.html';return {ok:false,reason:'redirect'}}
  if(profile.role!=='driver')return {ok:false,reason:'هذا الحساب ليس مفعّلاً كسائق. يجب أن تضيفه الإدارة أولاً.'};
  const {data:driver,error:dErr}=await db.from('drivers').select('*').eq('id',user.id).maybeSingle();
  if(dErr||!driver)return {ok:false,reason:'ملف السائق غير موجود. راجع الإدارة.'};
  currentProfile=profile;currentDriver=driver;return {ok:true};
}
function applyDriverIdentity(){
  const name=currentDriver?.display_name||currentProfile?.full_name||'سائق جيبلي';
  $('driverName').textContent=name;$('driverAvatar').textContent=initial(name);$('accountDriverAvatar').textContent=initial(name);$('accountDriverName').textContent=name;$('accountDriverPhone').textContent=currentProfile?.phone||'—';
  $('driverRating').textContent=Number(currentDriver?.rating||5).toFixed(1);
  $('verifiedBadge').textContent=currentDriver?.is_verified?'سائق موثّق':'بانتظار التحقق';$('verifiedBadge').classList.toggle('ok',!!currentDriver?.is_verified);
  $('vehicleType').textContent=serviceNames[currentDriver?.vehicle_type]||currentDriver?.vehicle_type||'—';
  $('vehicleName').textContent=[currentDriver?.vehicle_make,currentDriver?.vehicle_model].filter(Boolean).join(' ')||'—';
  $('vehicleColor').textContent=currentDriver?.vehicle_color||'—';$('vehiclePlate').textContent=currentDriver?.plate_number||'—';
  syncAvailabilityUI();
}
function syncAvailabilityUI(){
  if(!currentDriver)return;
  const busy=currentDriver.status==='busy',suspended=currentDriver.status==='suspended',online=currentDriver.status==='online'||busy;
  $('availabilityToggle').checked=online;$('availabilityToggle').disabled=busy||suspended||!currentDriver.is_verified;
  $('availabilityLabel').textContent=suspended?'موقوف':busy?'في رحلة':online?'متصل':'غير متصل';
  $('driverSuspended').classList.toggle('hidden',!suspended);
  $('driverPages').classList.toggle('hidden',suspended);
  document.querySelector('.driver-nav')?.classList.toggle('hidden',suspended);
  if(online&&!suspended)startLocationWatch();else stopLocationWatch();
}
async function changeAvailability(online){
  if(!currentDriver?.is_verified){notify('الإدارة لازم توثّق حسابك أولاً');syncAvailabilityUI();return}
  if(currentDriver.status==='busy'){notify('ما تقدر تطلع أوفلاين أثناء رحلة فعالة');syncAvailabilityUI();return}
  const status=online?'online':'offline';
  const {data,error}=await db.from('drivers').update({status}).eq('id',currentUser.id).select('*').single();
  if(error){notify(`تعذر تغيير الحالة: ${error.message}`);syncAvailabilityUI();return}
  currentDriver=data;syncAvailabilityUI();notify(online?'أنت متصل الآن وتستقبل الطلبات':'تم إيقاف استقبال الطلبات');await loadOpenRequests();
}

async function loadActiveRide(){
  if(!currentUser)return null;
  const {data}=await db.from('ride_requests').select('*').eq('selected_driver_id',currentUser.id).in('status',activeStatuses).order('updated_at',{ascending:false}).limit(1).maybeSingle();
  activeRide=data||null;$('activeNavDot').classList.toggle('hidden',!activeRide);renderActiveBanner();return activeRide;
}
function renderActiveBanner(){
  const box=$('activeRideBanner');
  if(!activeRide){box.classList.add('hidden');return}
  box.classList.remove('hidden');
  box.innerHTML=`<div class="banner-row"><div><strong>${escapeHtml(statusNames[activeRide.status]||activeRide.status)}</strong><p>${escapeHtml(activeRide.pickup_address)} ← ${escapeHtml(activeRide.destination_address||'بدون وجهة')}</p></div><button id="openActiveFromHome">فتح الرحلة</button></div>`;
  $('openActiveFromHome').onclick=()=>switchPage('active');
}

async function loadOpenRequests(){
  const list=$('openRequestsList');
  if(!currentDriver?.is_verified){list.innerHTML='<div class="empty-state"><i data-lucide="badge-alert"></i><p>حسابك يحتاج توثيق من الإدارة قبل استقبال الطلبات.</p></div>';icons();return}
  if(currentDriver.status==='offline'){list.innerHTML='<div class="empty-state"><i data-lucide="power"></i><p>حوّل حالتك إلى متصل حتى تظهر الطلبات المتاحة.</p></div>';icons();return}
  if(hasActiveRide()){list.innerHTML='<div class="empty-state"><i data-lucide="car-front"></i><p>عندك رحلة فعالة. أكملها قبل استقبال طلب جديد.</p></div>';icons();return}
  const [{data:reqs,error},{data:offers}]=await Promise.all([
    db.from('ride_requests').select('id,service_type,status,pickup_address,destination_address,route_distance_km,scheduled_at,notes,service_details,cod_enabled,cod_amount,created_at').in('status',openStatuses).is('accepted_offer_id',null).order('created_at',{ascending:false}).limit(40),
    db.from('driver_offers').select('id,ride_request_id,status,offered_fare,eta_minutes').eq('driver_id',currentUser.id).in('status',['pending','accepted']).order('created_at',{ascending:false})
  ]);
  if(error){list.innerHTML='<div class="empty-state">تعذر تحميل الطلبات.</div>';return}
  openRequests=reqs||[];const offerMap=new Map((offers||[]).map(o=>[o.ride_request_id,o]));
  if(!openRequests.length){list.innerHTML='<div class="empty-state"><i data-lucide="radar"></i><p>ماكو طلبات متاحة حالياً. راح تظهر هنا فور وصولها.</p></div>';icons();return}
  list.innerHTML=openRequests.map(r=>{
    const existing=offerMap.get(r.id);const cod=r.cod_enabled?`<span class="meta-chip">تحصيل ${money(r.cod_amount)}</span>`:'';
    return `<article class="request-card"><div class="card-top"><div><span class="service-pill">${serviceIcons[r.service_type]||'•'} ${escapeHtml(serviceNames[r.service_type]||r.service_type)}</span><h3>${escapeHtml(r.destination_address||'طلب بدون وجهة')}</h3><p>${formatDate(r.created_at)}</p></div><span class="status-pill">${escapeHtml(statusNames[r.status]||r.status)}</span></div><div class="route-box"><div class="route-line"><i class="route-dot from"></i><span>${escapeHtml(r.pickup_address)}</span></div><div class="route-line"><i class="route-dot to"></i><span>${escapeHtml(r.destination_address||'غير محددة')}</span></div></div><div class="request-meta">${r.route_distance_km?`<span class="meta-chip">${Number(r.route_distance_km).toLocaleString('ar-IQ',{maximumFractionDigits:1})} كم تقريباً</span>`:''}${r.scheduled_at?`<span class="meta-chip">موعد: ${formatDate(r.scheduled_at)}</span>`:''}${cod}</div>${r.notes?`<p>ملاحظة: ${escapeHtml(r.notes)}</p>`:''}<div class="card-actions one">${existing?`<button class="small-btn soft" data-edit-existing="${existing.id}">عرضك ${money(existing.offered_fare)}</button>`:`<button class="small-btn primary" data-offer-request="${r.id}">إرسال عرض سعر</button>`}</div></article>`
  }).join('');
  $$('[data-offer-request]',list).forEach(b=>b.onclick=()=>openOfferForRequest(openRequests.find(r=>r.id===b.dataset.offerRequest)));
  $$('[data-edit-existing]',list).forEach(b=>b.onclick=()=>{const o=(offers||[]).find(x=>x.id===b.dataset.editExisting);openEditOffer(o)});icons();
}
function openOfferForRequest(r){editingOffer=null;currentOfferRide=r;$('offerRideId').value=r.id;$('offerFare').value='';$('offerEta').value='';$('offerNote').value='';$('offerRideSummary').innerHTML=`<strong>${serviceIcons[r.service_type]||''} ${escapeHtml(serviceNames[r.service_type]||r.service_type)}</strong><br>من: ${escapeHtml(r.pickup_address)}<br>إلى: ${escapeHtml(r.destination_address||'غير محددة')}`;openSheet('offerSheet')}
async function openEditOffer(o){
  editingOffer=o;currentOfferRide=openRequests.find(r=>r.id===o.ride_request_id)||null;$('offerRideId').value=o.ride_request_id;$('offerFare').value=o.offered_fare;$('offerEta').value=o.eta_minutes||5;$('offerNote').value=o.note||'';$('offerRideSummary').innerHTML=`<strong>تعديل عرضك الحالي</strong><br>السعر الحالي: ${money(o.offered_fare)}`;openSheet('offerSheet')
}
async function submitOffer(e){
  e.preventDefault();const fare=Number($('offerFare').value),eta=Number($('offerEta').value),note=$('offerNote').value.trim()||null;if(!fare||fare<=0||!eta)return notify('أدخل سعراً ووقت وصول صحيحين');setBusy(e.currentTarget,true);
  let error;
  if(editingOffer){({error}=await db.from('driver_offers').update({offered_fare:fare,eta_minutes:eta,note}).eq('id',editingOffer.id).eq('driver_id',currentUser.id));}
  else{({error}=await db.from('driver_offers').insert({ride_request_id:$('offerRideId').value,driver_id:currentUser.id,offered_fare:fare,eta_minutes:eta,note}));}
  setBusy(e.currentTarget,false);if(error)return notify(`تعذر إرسال العرض: ${error.message}`);closeSheet('offerSheet');notify(editingOffer?'تم تحديث عرضك':'تم إرسال عرضك للعميل');editingOffer=null;await Promise.all([loadOpenRequests(),loadMyOffers()]);
}

async function loadMyOffers(){
  const list=$('myOffersList');
  const {data,error}=await db.from('driver_offers').select('*').eq('driver_id',currentUser.id).order('created_at',{ascending:false}).limit(50);
  if(error){list.innerHTML='<div class="empty-state">تعذر تحميل العروض.</div>';return}
  myOffers=data||[];if(!myOffers.length){list.innerHTML='<div class="empty-state"><i data-lucide="badge-dollar-sign"></i><p>ما قدمت أي عرض بعد.</p></div>';icons();return}
  const pendingIds=myOffers.filter(o=>o.status==='pending').map(o=>o.id);let negotiations=[];
  if(pendingIds.length){const {data:n}=await db.from('offer_negotiations').select('*').in('offer_id',pendingIds).order('created_at',{ascending:false});negotiations=n||[]}
  const latestCounter=new Map();for(const n of negotiations){if(!latestCounter.has(n.offer_id))latestCounter.set(n.offer_id,n)}
  list.innerHTML=myOffers.map(o=>{const counter=latestCounter.get(o.id);const customerCounter=counter&&counter.sender_id!==currentUser.id;return `<article class="offer-card"><div class="card-top"><div><span class="service-pill">عرض سعر</span><h3>${money(o.offered_fare)}</h3><p>${o.eta_minutes?`وصول خلال ${o.eta_minutes} دقيقة · `:''}${formatDate(o.created_at)}</p></div><span class="status-pill">${escapeHtml(offerStatusNames[o.status]||o.status)}</span></div>${o.note?`<div class="route-box">${escapeHtml(o.note)}</div>`:''}${customerCounter?`<div class="counter-box"><small>العميل اقترح</small><br><strong>${money(counter.amount)}</strong>${counter.message?`<p>${escapeHtml(counter.message)}</p>`:''}<div class="card-actions"><button class="small-btn green" data-accept-counter="${o.id}" data-counter-amount="${counter.amount}" data-request-id="${o.ride_request_id}">اعتماد السعر</button><button class="small-btn soft" data-edit-offer="${o.id}">عرض آخر</button></div></div>`:o.status==='pending'?`<div class="card-actions one"><button class="small-btn soft" data-edit-offer="${o.id}">تعديل العرض</button></div>`:''}</article>`}).join('');
  $$('[data-edit-offer]',list).forEach(b=>b.onclick=()=>openEditOffer(myOffers.find(o=>o.id===b.dataset.editOffer)));
  $$('[data-accept-counter]',list).forEach(b=>b.onclick=()=>acceptCustomerCounter(b.dataset.acceptCounter,Number(b.dataset.counterAmount),b.dataset.requestId));icons();
}
async function acceptCustomerCounter(offerId,amount,requestId){
  if(!confirm(`اعتماد سعر ${money(amount)}؟ سيظهر للعميل كسعرك الجديد.`))return;
  const {error}=await db.from('driver_offers').update({offered_fare:amount}).eq('id',offerId).eq('driver_id',currentUser.id);
  if(error)return notify(`تعذر اعتماد السعر: ${error.message}`);
  await db.from('offer_negotiations').insert({offer_id:offerId,ride_request_id:requestId,sender_id:currentUser.id,amount,message:'وافق السائق على السعر المقترح'});
  notify('تم اعتماد سعر العميل ويمكنه الآن قبول عرضك');loadMyOffers();
}

function activeActionFor(status){
  return {driver_selected:['ابدأ التوجه للعميل','driver_on_way'],driver_on_way:['وصلت لموقع العميل','driver_arrived'],driver_arrived:['ابدأ الرحلة','in_progress'],in_progress:['تم الوصول واستلام الأجرة','completed']}[status]||null;
}
async function loadActiveCustomer(){
  activeCustomer=null;if(!activeRide)return;
  const {data}=await db.from('profiles').select('id,full_name,phone,avatar_url').eq('id',activeRide.customer_id).maybeSingle();activeCustomer=data||null;
}
async function renderActiveRide(){
  const box=$('activeRideView');await loadActiveRide();if(!activeRide){if(activeMap){activeMap.remove();activeMap=null}box.innerHTML='<div class="empty-state"><i data-lucide="navigation-off"></i><p>ما عندك رحلة فعالة حالياً.</p></div>';icons();return}
  await loadActiveCustomer();const action=activeActionFor(activeRide.status);const canCancel=['driver_selected','driver_on_way'].includes(activeRide.status);const name=activeCustomer?.full_name||'عميل جيبلي';
  box.innerHTML=`<div id="activeRideMap" class="active-map"></div><section class="active-status-card"><small>حالة الرحلة</small><h2>${escapeHtml(statusNames[activeRide.status]||activeRide.status)}</h2><p>${activeRide.status==='driver_selected'?'العميل اختار عرضك والسعر صار مثبت.':activeRide.status==='driver_on_way'?'توجه إلى موقع الانطلاق وشارك موقعك مباشرة.':activeRide.status==='driver_arrived'?'أخبر العميل أنك وصلت وانتظر بدء الرحلة.':activeRide.status==='in_progress'?'اتجه إلى الوجهة، والسعر يبقى ثابتاً حسب الاتفاق.':''}</p></section><section class="active-card"><div class="customer-card"><div class="avatar">${escapeHtml(initial(name))}</div><div><h3>${escapeHtml(name)}</h3><p>${escapeHtml(activeCustomer?.phone||'رقم الهاتف غير متاح')}</p></div></div><div class="route-box"><div class="route-line"><i class="route-dot from"></i><span>${escapeHtml(activeRide.pickup_address)}</span></div><div class="route-line"><i class="route-dot to"></i><span>${escapeHtml(activeRide.destination_address||'غير محددة')}</span></div></div><div class="fare-lock"><div><small>السعر المتفق عليه</small><br><span>نقداً عند الوصول</span></div><strong>${money(activeRide.agreed_fare)}</strong></div>${activeRide.cod_enabled?`<div class="counter-box"><small>تحصيل عند التسليم منفصل عن أجرة التوصيل</small><br><strong>${money(activeRide.cod_amount)}</strong></div>`:''}<div class="trip-actions"><button id="navigateRideBtn" class="small-btn soft">فتح الملاحة</button>${activeCustomer?.phone?`<a class="small-btn green" style="text-align:center;text-decoration:none" href="tel:${escapeHtml(activeCustomer.phone)}">اتصال بالعميل</a>`:'<button class="small-btn green" disabled>اتصال</button>'}${action?`<button id="advanceRideBtn" class="small-btn primary full">${action[0]}</button>`:''}${canCancel?'<button id="driverCancelRideBtn" class="small-btn danger full">إلغاء من جهة السائق</button>':''}</div></section><section class="chat-card"><div class="section-head"><h2>محادثة الرحلة</h2><i data-lucide="messages-square"></i></div><div id="rideMessages" class="messages-list"></div><form id="rideChatForm" class="chat-form"><input id="rideChatInput" maxlength="500" required placeholder="اكتب رسالة للعميل" /><button type="submit"><i data-lucide="send"></i></button></form></section>`;
  initActiveMap();await loadRideMessages();
  $('navigateRideBtn').onclick=openNavigation;
  if(action)$('advanceRideBtn').onclick=()=>advanceRide(action[1]);
  if(canCancel)$('driverCancelRideBtn').onclick=cancelRideByDriver;
  $('rideChatForm').onsubmit=sendRideMessage;icons();
}
function initActiveMap(){
  if(activeMap){activeMap.remove();activeMap=null}
  activeMap=L.map('activeRideMap',{zoomControl:false}).setView([activeRide.pickup_lat,activeRide.pickup_lng],14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(activeMap);
  const pts=[];if(activeRide.pickup_lat&&activeRide.pickup_lng){L.marker([activeRide.pickup_lat,activeRide.pickup_lng]).addTo(activeMap).bindTooltip('الانطلاق');pts.push([activeRide.pickup_lat,activeRide.pickup_lng])}if(activeRide.destination_lat&&activeRide.destination_lng){L.marker([activeRide.destination_lat,activeRide.destination_lng]).addTo(activeMap).bindTooltip('الوجهة');pts.push([activeRide.destination_lat,activeRide.destination_lng])}if(pts.length===2){L.polyline(pts,{color:'#2878e8',weight:5,dashArray:'8 8'}).addTo(activeMap);activeMap.fitBounds(L.latLngBounds(pts).pad(.25))}if(latestDriverLocation)updateActiveDriverMarker(latestDriverLocation.lat,latestDriverLocation.lng)
}
function updateActiveDriverMarker(lat,lng){if(!activeMap)return;if(activeDriverMarker)activeMap.removeLayer(activeDriverMarker);activeDriverMarker=L.circleMarker([lat,lng],{radius:8,weight:3,color:'#fff',fillColor:'#13b779',fillOpacity:1}).addTo(activeMap).bindTooltip('موقعي')}
function openNavigation(){if(!activeRide)return;const target=activeRide.status==='in_progress'?[activeRide.destination_lat,activeRide.destination_lng]:[activeRide.pickup_lat,activeRide.pickup_lng];if(!target[0]||!target[1])return notify('الموقع غير متاح');window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(target[0]+','+target[1])}`,'_blank','noopener')}
async function advanceRide(newStatus){
  const confirmText=newStatus==='completed'?'هل وصلت للوجهة واستلمت الأجرة المتفق عليها؟':'تأكيد تغيير حالة الرحلة؟';if(!confirm(confirmText))return;
  const {error}=await db.from('ride_requests').update({status:newStatus}).eq('id',activeRide.id).eq('selected_driver_id',currentUser.id);
  if(error)return notify(`تعذر تحديث الرحلة: ${error.message}`);notify(statusNames[newStatus]||'تم تحديث الرحلة');await refreshAll();if(newStatus==='completed')switchPage('earnings');else renderActiveRide();
}
async function cancelRideByDriver(){const reason=prompt('اكتب سبب الإلغاء للعميل:','')||'ألغى السائق الطلب';if(!confirm('تأكيد إلغاء الطلب؟'))return;const {error}=await db.from('ride_requests').update({status:'cancelled',cancel_reason:reason}).eq('id',activeRide.id).eq('selected_driver_id',currentUser.id);if(error)return notify(`تعذر الإلغاء: ${error.message}`);notify('تم إلغاء الطلب وإبلاغ العميل');await refreshAll();switchPage('home')}
async function loadRideMessages(){if(!activeRide)return;const {data}=await db.from('ride_messages').select('*').eq('ride_request_id',activeRide.id).order('created_at',{ascending:true}).limit(100);const list=$('rideMessages');if(!list)return;list.innerHTML=(data||[]).map(m=>`<div class="message ${m.sender_id===currentUser.id?'mine':''}">${escapeHtml(m.body)}<time>${formatDate(m.created_at)}</time></div>`).join('')||'<div class="empty-state">ابدأ المحادثة عند الحاجة.</div>';list.scrollTop=list.scrollHeight}
async function sendRideMessage(e){e.preventDefault();const input=$('rideChatInput'),body=input.value.trim();if(!body)return;const {error}=await db.from('ride_messages').insert({ride_request_id:activeRide.id,sender_id:currentUser.id,body});if(error)return notify('تعذر إرسال الرسالة');input.value='';loadRideMessages()}

async function loadEarnings(){
  const {data,error}=await db.from('ride_requests').select('id,service_type,status,pickup_address,destination_address,agreed_fare,completed_at,cancelled_at,created_at').eq('selected_driver_id',currentUser.id).in('status',['completed','cancelled']).order('updated_at',{ascending:false}).limit(100);
  if(error)return;
  const rows=data||[],completed=rows.filter(r=>r.status==='completed');const now=new Date(),dayStart=new Date(now.getFullYear(),now.getMonth(),now.getDate()),weekStart=new Date(Date.now()-7*86400000);
  const today=completed.filter(r=>new Date(r.completed_at)>=dayStart),week=completed.filter(r=>new Date(r.completed_at)>=weekStart);const sum=arr=>arr.reduce((s,r)=>s+Number(r.agreed_fare||0),0);
  $('earnToday').textContent=money(sum(today));$('earnWeek').textContent=money(sum(week));$('earnAll').textContent=money(sum(completed));$('todayTrips').textContent=today.length.toLocaleString('ar-IQ');$('todayGross').textContent=money(sum(today));
  const list=$('driverHistoryList');list.innerHTML=rows.length?rows.map(r=>`<article class="history-card"><div class="card-top"><div><span class="service-pill">${serviceIcons[r.service_type]||''} ${escapeHtml(serviceNames[r.service_type]||r.service_type)}</span><h3>${escapeHtml(r.destination_address||'طلب')}</h3><p>${formatDate(r.completed_at||r.cancelled_at||r.created_at)}</p></div><span class="status-pill">${escapeHtml(statusNames[r.status]||r.status)}</span></div><div class="route-box"><div class="route-line"><i class="route-dot from"></i><span>${escapeHtml(r.pickup_address)}</span></div><div class="route-line"><i class="route-dot to"></i><span>${escapeHtml(r.destination_address||'—')}</span></div></div>${r.status==='completed'?`<strong>${money(r.agreed_fare)}</strong>`:''}</article>`).join(''):'<div class="empty-state">لا يوجد سجل بعد.</div>';icons();
}
async function loadHome(){await Promise.all([loadActiveRide(),loadOpenRequests(),loadEarnings()]);renderActiveBanner()}
function renderAccount(){applyDriverIdentity()}

async function submitSupport(e){e.preventDefault();setBusy(e.currentTarget,true);const {error}=await db.from('support_tickets').insert({user_id:currentUser.id,ride_request_id:activeRide?.id||null,category:'driver_support',subject:$('driverSupportSubject').value.trim(),message:$('driverSupportMessage').value.trim()});setBusy(e.currentTarget,false);if(error)return notify(`تعذر إرسال الرسالة: ${error.message}`);e.currentTarget.reset();closeSheet('supportSheet');notify('تم إرسال رسالتك للدعم')}

function unsubscribeRealtime(){realtimeChannels.forEach(c=>db.removeChannel(c));realtimeChannels=[]}
function subscribeRealtime(){
  unsubscribeRealtime();if(!currentUser)return;
  const rides=db.channel(`driver-rides-${currentUser.id}`).on('postgres_changes',{event:'*',schema:'public',table:'ride_requests'},async()=>{await refreshAll();if(currentPage==='active')renderActiveRide()}).subscribe();
  const offers=db.channel(`driver-offers-${currentUser.id}`).on('postgres_changes',{event:'*',schema:'public',table:'driver_offers',filter:`driver_id=eq.${currentUser.id}`},()=>{loadMyOffers();loadOpenRequests()}).subscribe();
  const negotiations=db.channel(`driver-negotiations-${currentUser.id}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'offer_negotiations'},payload=>{if(myOffers.some(o=>o.id===payload.new?.offer_id)){notify('وصل مقترح سعر جديد من العميل');loadMyOffers()}}).subscribe();
  const messages=db.channel(`driver-messages-${currentUser.id}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'ride_messages'},payload=>{if(activeRide&&payload.new?.ride_request_id===activeRide.id){if(payload.new.sender_id!==currentUser.id)notify('رسالة جديدة من العميل');loadRideMessages()}}).subscribe();
  const driver=db.channel(`driver-profile-${currentUser.id}`).on('postgres_changes',{event:'UPDATE',schema:'public',table:'drivers',filter:`id=eq.${currentUser.id}`},async payload=>{currentDriver=payload.new;applyDriverIdentity();await refreshAll()}).subscribe();
  const notifications=db.channel(`driver-notifs-${currentUser.id}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications',filter:`user_id=eq.${currentUser.id}`},payload=>{if(payload.new?.title)notify(payload.new.title)}).subscribe();
  realtimeChannels.push(rides,offers,negotiations,messages,driver,notifications);
}
async function refreshAll(){await loadActiveRide();await Promise.all([loadOpenRequests(),loadEarnings()]);if(currentPage==='offers')await loadMyOffers();applyDriverIdentity()}

async function showDriverApp(user){
  currentUser=user;const check=await loadDriverIdentity(user);if(!check.ok){if(check.reason!=='redirect'){await db.auth.signOut();showDriverAuth();notify(check.reason)}return}
  $('driverAuth').classList.add('hidden');$('driverApp').classList.remove('hidden');applyDriverIdentity();initHomeMap();await Promise.all([loadMyOffers(),loadHome()]);subscribeRealtime();if(currentDriver.status==='online'||currentDriver.status==='busy')startLocationWatch();icons();setTimeout(()=>homeMap.invalidateSize(),100)
}
function showDriverAuth(){currentUser=currentProfile=currentDriver=activeRide=null;unsubscribeRealtime();stopLocationWatch();$('driverApp').classList.add('hidden');$('driverAuth').classList.remove('hidden');icons()}
async function logout(){if(currentDriver&&currentDriver.status==='online'){await db.from('drivers').update({status:'offline'}).eq('id',currentUser.id)}stopLocationWatch();await db.auth.signOut();showDriverAuth();notify('تم تسجيل الخروج')}

function bindEvents(){
  $$('.seg').forEach(b=>b.onclick=()=>{$$('.seg').forEach(x=>x.classList.toggle('active',x===b));$('driverLoginForm').classList.toggle('active',b.dataset.authTab==='login');$('driverActivateForm').classList.toggle('active',b.dataset.authTab==='activate')});
  $('driverLoginForm').onsubmit=async e=>{e.preventDefault();setBusy(e.currentTarget,true);const {data,error}=await db.auth.signInWithPassword({email:$('driverLoginEmail').value.trim(),password:$('driverLoginPassword').value});setBusy(e.currentTarget,false);if(error)return notify('بيانات الدخول غير صحيحة أو البريد غير مؤكد');showDriverApp(data.user)};
  $('driverActivateForm').onsubmit=async e=>{e.preventDefault();setBusy(e.currentTarget,true);const full_name=$('driverSignupName').value.trim(),phone=$('driverSignupPhone').value.trim();const {data,error}=await db.auth.signUp({email:$('driverSignupEmail').value.trim(),password:$('driverSignupPassword').value,options:{data:{full_name,phone}}});setBusy(e.currentTarget,false);if(error)return notify(error.message);if(data.session){await showDriverApp(data.user)}else notify('تم إنشاء الحساب. إذا كان تأكيد البريد مفعلاً، افتح بريدك ثم سجّل الدخول.')};
  $$('.driver-nav-btn').forEach(b=>b.onclick=()=>switchPage(b.dataset.driverPage));
  $('availabilityToggle').onchange=e=>changeAvailability(e.target.checked);$('locateDriverBtn').onclick=locateOnce;$('refreshOpenRequests').onclick=loadOpenRequests;$('offerForm').onsubmit=submitOffer;
  $$('[data-close-sheet]').forEach(b=>b.onclick=()=>closeSheet(b.dataset.closeSheet));
  $('driverSupportBtn').onclick=()=>openSheet('supportSheet');$('driverSupportForm').onsubmit=submitSupport;$('driverLogoutBtn').onclick=logout;$('blockedLogoutBtn').onclick=logout;
}

db.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT')showDriverAuth();if(event==='SIGNED_IN'&&session?.user&&!currentUser)showDriverApp(session.user)});
(async()=>{bindEvents();icons();const {data:{session}}=await db.auth.getSession();if(session?.user)await showDriverApp(session.user);else showDriverAuth();hideSplash()})();
