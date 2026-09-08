const { SUPABASE_URL, SUPABASE_KEY } = window.JEEBLI_CONFIG;
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = (id) => document.getElementById(id);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

let currentUser = null;
let currentProfile = null;
let services = [];
let currentPage = 'home';
let currentRequest = null;
let currentOffers = [];
let offerSort = 'best';
let currentCounterOfferId = null;
let homeMap = null;
let homeUserMarker = null;
let driverMarker = null;
let bookingMap = null;
let pickupMarker = null;
let destinationMarker = null;
let bookingRouteLine = null;
let bookingPickMode = 'pickup';
let bookingStep = 1;
let selectedService = 'taxi';
let currentDistanceKm = null;
let channels = [];
let deferredInstallPrompt = null;

const activeStatuses = ['draft','requested','searching','offers_received','negotiating','driver_selected','driver_on_way','driver_arrived','in_progress'];
const statusLabels = {
  draft:'مسودة', requested:'تم إرسال الطلب', searching:'جاري البحث عن سائقين', offers_received:'وصلتك عروض',
  negotiating:'جاري التفاوض', driver_selected:'تم اختيار السائق', driver_on_way:'السائق في الطريق',
  driver_arrived:'السائق وصل', in_progress:'الرحلة جارية', completed:'مكتملة', cancelled:'ملغاة'
};
const statusDescriptions = {
  requested:'طلبك وصل للنظام وسننتظر عروض السائقين.', searching:'نبحث عن سائقين مناسبين قريبين منك.',
  offers_received:'وصلتك عروض. قارن السعر ووقت الوصول والتقييم.', negotiating:'أرسلت سعراً مقترحاً لأحد السائقين.',
  driver_selected:'تم تثبيت السائق والسعر المتفق عليه.', driver_on_way:'السائق متجه إلى موقع الانطلاق.',
  driver_arrived:'السائق وصل إلى موقعك.', in_progress:'رحلتك جارية الآن.', completed:'تم إكمال الطلب.', cancelled:'تم إلغاء الطلب.'
};
const serviceFallback = {
  taxi:{name_ar:'تكسي',icon:'🚕',description_ar:'رحلتك اليومية'}, private:{name_ar:'خصوصي',icon:'🚘',description_ar:'راحة وخصوصية'},
  delivery:{name_ar:'توصيل',icon:'📦',description_ar:'طلبات وطرود'}, cargo:{name_ar:'حمل',icon:'🚚',description_ar:'نقل الأغراض'},
  intercity:{name_ar:'بين المحافظات',icon:'🛣️',description_ar:'رحلات بعيدة'}
};

function icons(){ if(window.lucide) window.lucide.createIcons(); }
function escapeHtml(v=''){ return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
function money(v){ return Number(v||0).toLocaleString('ar-IQ') + ' د.ع'; }
function serviceInfo(code){ return services.find(s=>s.code===code) || {code,...(serviceFallback[code]||{name_ar:code,icon:'•',description_ar:''})}; }
function formatTime(iso){ if(!iso) return ''; try{return new Intl.DateTimeFormat('ar-IQ',{dateStyle:'medium',timeStyle:'short'}).format(new Date(iso));}catch{return '';} }
function notify(msg){ const el=$('toast'); el.textContent=msg; el.classList.remove('hidden'); clearTimeout(window.__jeebliToast); window.__jeebliToast=setTimeout(()=>el.classList.add('hidden'),3300); }
function setBusy(buttonOrForm,busy){ const btn=buttonOrForm?.tagName==='FORM'?buttonOrForm.querySelector('[type="submit"]'):buttonOrForm; if(!btn)return; btn.disabled=busy; btn.style.opacity=busy?'.65':'1'; }
function initial(name='ج'){ return (name.trim()[0]||'ج').toUpperCase(); }
function hideSplash(){ setTimeout(()=>$('splash').classList.add('hide'),300); }
function openSheet(id){ $(id).classList.remove('hidden'); document.body.style.overflow='hidden'; icons(); }
function closeSheet(id){ $(id).classList.add('hidden'); document.body.style.overflow=''; }
function closeAllSheets(){ ['bookingSheet','requestSheet','counterSheet','addressesSheet','supportSheet','infoSheet'].forEach(id=>$(id)?.classList.add('hidden')); document.body.style.overflow=''; }

function switchPage(page){
  currentPage=page;
  $$('.page').forEach(p=>p.classList.toggle('active',p.id===`page-${page}`));
  $$('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  if(page==='requests') loadRequests();
  if(page==='notifications') loadNotifications();
  if(page==='account') renderAccount();
  if(page==='home'&&homeMap) setTimeout(()=>homeMap.invalidateSize(),80);
  window.scrollTo({top:0,behavior:'smooth'});
  icons();
}

async function loadServices(){
  const {data,error}=await db.from('services').select('code,name_ar,description_ar,icon,is_active,is_coming_soon,sort_order').order('sort_order');
  if(!error&&data?.length) services=data;
  else services=Object.entries(serviceFallback).map(([code,v],i)=>({code,...v,is_active:true,is_coming_soon:false,sort_order:i}));
  renderServices();
}
function renderServices(){
  const home=$('servicesGrid'), booking=$('bookingServices');
  home.innerHTML=services.map(s=>{
    const wide=s.code==='intercity'; const disabled=!s.is_active||s.is_coming_soon;
    return `<button class="service-card ${wide?'wide':''} ${disabled?'coming':''}" data-service-code="${s.code}" ${disabled?'data-coming="1"':''}>
      <span class="service-icon">${escapeHtml(s.icon||'•')}</span><span class="service-copy"><strong>${escapeHtml(s.name_ar)}</strong><small>${escapeHtml(s.is_coming_soon?'قريباً':s.description_ar||'')}</small></span></button>`;
  }).join('');
  booking.innerHTML=services.filter(s=>s.is_active&&!s.is_coming_soon).map(s=>`<button class="booking-service ${s.code===selectedService?'selected':''}" data-booking-service="${s.code}"><span class="service-icon">${escapeHtml(s.icon||'•')}</span><span><strong>${escapeHtml(s.name_ar)}</strong><small>${escapeHtml(s.description_ar||'')}</small></span></button>`).join('');
  $$('[data-service-code]').forEach(btn=>btn.addEventListener('click',()=>{
    if(btn.dataset.coming){notify('هذه الخدمة قيد التجهيز وقريباً داخل جيبلي');return;}
    openBooking(btn.dataset.serviceCode);
  }));
  $$('[data-booking-service]').forEach(btn=>btn.addEventListener('click',()=>{
    selectedService=btn.dataset.bookingService;
    $$('[data-booking-service]').forEach(x=>x.classList.toggle('selected',x===btn));
    renderServiceExtraFields();
  }));
}

function initHomeMap(){
  if(homeMap)return;
  homeMap=L.map('homeMap',{zoomControl:false,attributionControl:true}).setView([35.47,43.25],11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(homeMap);
}
function locateUser({forBooking=false,silent=false}={}){
  return new Promise((resolve,reject)=>{
    if(!navigator.geolocation){if(!silent)notify('المتصفح لا يدعم تحديد الموقع');return reject(new Error('unsupported'));}
    navigator.geolocation.getCurrentPosition(pos=>{
      const {latitude:lat,longitude:lng}=pos.coords;
      initHomeMap();
      if(homeUserMarker) homeMap.removeLayer(homeUserMarker);
      homeUserMarker=L.circleMarker([lat,lng],{radius:9,weight:4,color:'#fff',fillColor:'#2374e8',fillOpacity:1}).addTo(homeMap);
      homeMap.setView([lat,lng],15);
      $('headerLocationText').textContent='موقعي الحالي';
      if(forBooking){setBookingPoint('pickup',lat,lng);$('pickupAddress').value='موقعي الحالي';}
      if(!silent) notify('تم تحديد موقعك الحالي');
      resolve({lat,lng});
    },err=>{if(!silent)notify('تعذر الوصول إلى موقعك. فعّل إذن الموقع.');reject(err);},{enableHighAccuracy:true,timeout:10000,maximumAge:15000});
  });
}

function initBookingMap(){
  if(bookingMap)return;
  bookingMap=L.map('bookingMap',{zoomControl:true}).setView([35.47,43.25],11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(bookingMap);
  bookingMap.on('click',e=>setBookingPoint(bookingPickMode,e.latlng.lat,e.latlng.lng));
}
function setBookingPickMode(mode){
  bookingPickMode=mode;
  $('setPickupModeBtn').classList.toggle('active',mode==='pickup');
  $('setDestinationModeBtn').classList.toggle('active',mode==='destination');
}
function setBookingPoint(mode,lat,lng){
  initBookingMap();
  const isPickup=mode==='pickup';
  const marker=L.marker([lat,lng],{draggable:true}).addTo(bookingMap);
  marker.on('dragend',ev=>{const p=ev.target.getLatLng(); updateBookingHidden(isPickup,p.lat,p.lng); updateBookingRoute();});
  if(isPickup){ if(pickupMarker)bookingMap.removeLayer(pickupMarker); pickupMarker=marker; updateBookingHidden(true,lat,lng); if(!$('pickupAddress').value.trim())$('pickupAddress').value='موقع الانطلاق المحدد'; setBookingPickMode('destination'); }
  else { if(destinationMarker)bookingMap.removeLayer(destinationMarker); destinationMarker=marker; updateBookingHidden(false,lat,lng); if(!$('destinationAddress').value.trim())$('destinationAddress').value='الوجهة المحددة'; }
  bookingMap.panTo([lat,lng]); updateBookingRoute();
}
function updateBookingHidden(isPickup,lat,lng){
  $(isPickup?'pickupLat':'destinationLat').value=Number(lat).toFixed(6);
  $(isPickup?'pickupLng':'destinationLng').value=Number(lng).toFixed(6);
}
function haversine(lat1,lng1,lat2,lng2){
  const r=6371,toRad=d=>d*Math.PI/180; const dLat=toRad(lat2-lat1),dLng=toRad(lng2-lng1);
  const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2;
  return r*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function updateBookingRoute(){
  if(bookingRouteLine){bookingMap.removeLayer(bookingRouteLine);bookingRouteLine=null;}
  if(!pickupMarker||!destinationMarker){currentDistanceKm=null;$('routeInfo').classList.add('hidden');return;}
  const a=pickupMarker.getLatLng(),b=destinationMarker.getLatLng();
  currentDistanceKm=haversine(a.lat,a.lng,b.lat,b.lng);
  bookingRouteLine=L.polyline([a,b],{color:'#2374e8',weight:5,opacity:.8,dashArray:'8 8'}).addTo(bookingMap);
  bookingMap.fitBounds(L.latLngBounds([a,b]).pad(.28));
  $('routeDistance').textContent=`${currentDistanceKm.toLocaleString('ar-IQ',{maximumFractionDigits:1})} كم تقريباً`;
  $('routeInfo').classList.remove('hidden'); icons();
}

function resetBooking(){
  bookingStep=1; selectedService=selectedService||'taxi'; currentDistanceKm=null;
  ['pickupAddress','destinationAddress','pickupLat','pickupLng','destinationLat','destinationLng','rideNotes','scheduledAt'].forEach(id=>{if($(id))$(id).value='';});
  $('scheduleMode').value='now'; $('scheduledAtWrap').classList.add('hidden');
  if(bookingMap){ if(pickupMarker)bookingMap.removeLayer(pickupMarker); if(destinationMarker)bookingMap.removeLayer(destinationMarker); if(bookingRouteLine)bookingMap.removeLayer(bookingRouteLine); pickupMarker=destinationMarker=bookingRouteLine=null; }
  setBookingPickMode('pickup'); renderServiceExtraFields(); renderBookingStep();
}
function openBooking(service='taxi'){
  if(currentRequest&&activeStatuses.includes(currentRequest.status)){notify('عندك طلب فعال حالياً. افتحه من البطاقة الموجودة بالرئيسية.');openRequestSheet(currentRequest.id);return;}
  selectedService=service; resetBooking(); renderServices(); openSheet('bookingSheet'); initBookingMap(); setTimeout(()=>bookingMap.invalidateSize(),100);
}
function renderBookingStep(){
  $$('.booking-step').forEach((el,i)=>el.classList.toggle('active',i===bookingStep-1));
  $$('.step').forEach((el,i)=>{const n=i+1;el.classList.toggle('active',n===bookingStep);el.classList.toggle('done',n<bookingStep);});
  $('bookingBackBtn').classList.toggle('hidden',bookingStep===1);
  $('bookingNextBtn').textContent=bookingStep===4?'إرسال الطلب':'التالي';
  if(bookingStep===2){initBookingMap();setTimeout(()=>bookingMap.invalidateSize(),80);}
  if(bookingStep===3)renderServiceExtraFields();
  if(bookingStep===4)renderBookingSummary();
  icons();
}
function validateBookingStep(){
  if(bookingStep===1&&!selectedService){notify('اختر الخدمة أولاً');return false;}
  if(bookingStep===2){
    if(!$('pickupLat').value||!$('pickupLng').value){notify('حدد موقع الانطلاق على الخريطة');return false;}
    if(!$('destinationLat').value||!$('destinationLng').value){notify('حدد الوجهة على الخريطة');return false;}
    if(!$('pickupAddress').value.trim()||!$('destinationAddress').value.trim()){notify('اكتب وصفاً للانطلاق والوجهة');return false;}
  }
  if(bookingStep===3&&$('scheduleMode').value==='later'&&!$('scheduledAt').value){notify('حدد موعد الرحلة');return false;}
  return true;
}
function renderServiceExtraFields(){
  const box=$('serviceExtraFields'); if(!box)return;
  if(selectedService==='delivery') box.innerHTML=`<div class="service-extra-card"><h4>تفاصيل التوصيل</h4><label>اسم المستلم<input id="recipientName" type="text" placeholder="اسم المستلم" /></label><label>رقم المستلم<input id="recipientPhone" type="tel" placeholder="07xxxxxxxxx" /></label><label>حجم الطلب<select id="packageSize"><option value="small">صغير</option><option value="medium">متوسط</option><option value="large">كبير</option></select></label><label class="switch-row"><span>تحصيل مبلغ عند التسليم</span><input id="codEnabled" type="checkbox" /></label><label id="codAmountWrap" class="hidden">مبلغ التحصيل<input id="codAmount" type="number" min="0" step="250" placeholder="مثال 25000" /></label></div>`;
  else if(selectedService==='cargo') box.innerHTML=`<div class="service-extra-card"><h4>تفاصيل الحمل</h4><label>وصف الحمولة<textarea id="cargoDescription" rows="2" placeholder="مثال: أثاث منزلي خفيف"></textarea></label><label>عدد القطع<input id="cargoPieces" type="number" min="1" placeholder="عدد تقريبي" /></label><label class="switch-row"><span>أحتاج عامل تحميل</span><input id="needsLoader" type="checkbox" /></label></div>`;
  else if(selectedService==='intercity') box.innerHTML=`<div class="service-extra-card"><h4>تفاصيل السفر</h4><div class="two-col"><label>عدد الأشخاص<input id="passengers" type="number" min="1" value="1" /></label><label>عدد الحقائب<input id="bags" type="number" min="0" value="0" /></label></div></div>`;
  else box.innerHTML='';
  $('codEnabled')?.addEventListener('change',e=>$('codAmountWrap').classList.toggle('hidden',!e.target.checked));
}
function collectServiceDetails(){
  if(selectedService==='delivery') return {recipient_name:$('recipientName')?.value.trim()||null,recipient_phone:$('recipientPhone')?.value.trim()||null,package_size:$('packageSize')?.value||'small'};
  if(selectedService==='cargo') return {cargo_description:$('cargoDescription')?.value.trim()||null,cargo_pieces:Number($('cargoPieces')?.value||0)||null,needs_loader:!!$('needsLoader')?.checked};
  if(selectedService==='intercity') return {passengers:Number($('passengers')?.value||1),bags:Number($('bags')?.value||0)};
  return {};
}
function renderBookingSummary(){
  const s=serviceInfo(selectedService), scheduled=$('scheduleMode').value==='later'&&$('scheduledAt').value?formatTime(new Date($('scheduledAt').value).toISOString()):'الآن';
  $('bookingSummary').innerHTML=`<div class="summary-service"><span class="service-icon">${escapeHtml(s.icon||'•')}</span><div><strong>${escapeHtml(s.name_ar)}</strong><small>موعد الطلب: ${escapeHtml(scheduled)}</small></div></div><div class="summary-route"><div><span class="dot pickup"></span><div><small>من</small><strong>${escapeHtml($('pickupAddress').value)}</strong></div></div><div><span class="dot destination"></span><div><small>إلى</small><strong>${escapeHtml($('destinationAddress').value)}</strong></div></div></div><div class="summary-meta"><span>المسافة للعرض فقط: <strong>${currentDistanceKm?currentDistanceKm.toLocaleString('ar-IQ',{maximumFractionDigits:1})+' كم':'—'}</strong></span><span>طريقة الدفع الحالية: <strong>نقداً عند الوصول</strong></span>${$('rideNotes').value.trim()?`<span>ملاحظة: ${escapeHtml($('rideNotes').value.trim())}</span>`:''}</div>`;
}
async function submitBooking(){
  if(!currentUser)return notify('سجل الدخول أولاً');
  if(currentRequest&&activeStatuses.includes(currentRequest.status))return notify('عندك طلب فعال حالياً');
  const btn=$('bookingNextBtn'); setBusy(btn,true);
  const codEnabled=!!$('codEnabled')?.checked;
  const payload={
    customer_id:currentUser.id,service_type:selectedService,status:'requested',pickup_address:$('pickupAddress').value.trim(),pickup_lat:Number($('pickupLat').value),pickup_lng:Number($('pickupLng').value),
    destination_address:$('destinationAddress').value.trim(),destination_lat:Number($('destinationLat').value),destination_lng:Number($('destinationLng').value),route_distance_km:currentDistanceKm?Number(currentDistanceKm.toFixed(2)):null,
    scheduled_at:$('scheduleMode').value==='later'&&$('scheduledAt').value?new Date($('scheduledAt').value).toISOString():null,notes:$('rideNotes').value.trim()||null,service_details:collectServiceDetails(),
    cod_enabled:codEnabled,cod_amount:codEnabled?Number($('codAmount')?.value||0):null,payment_method:'cash'
  };
  const {data,error}=await db.from('ride_requests').insert(payload).select('*').single();
  setBusy(btn,false);
  if(error){notify(`تعذر إرسال الطلب: ${error.message}`);return;}
  currentRequest=data; closeSheet('bookingSheet'); notify('تم إرسال طلبك. الآن ننتظر عروض السائقين.'); await refreshCustomerData(); openRequestSheet(data.id);
}

async function loadCurrentRequest(){
  if(!currentUser)return;
  const {data,error}=await db.from('ride_requests').select('*').eq('customer_id',currentUser.id).in('status',activeStatuses).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(!error)currentRequest=data||null;
  renderActiveRequestHome();
  if(currentRequest?.selected_driver_id) await renderDriverOnHomeMap(); else clearDriverMarker();
}
function renderActiveRequestHome(){
  const el=$('activeRequestHome');
  if(!currentRequest){el.classList.add('hidden');el.innerHTML='';return;}
  const s=serviceInfo(currentRequest.service_type);
  el.classList.remove('hidden');
  el.innerHTML=`<div class="active-request-head"><div><p class="kicker">طلب نشط · ${escapeHtml(s.name_ar)}</p><h3>${escapeHtml(statusLabels[currentRequest.status]||currentRequest.status)}</h3><p>${escapeHtml(statusDescriptions[currentRequest.status]||'تابع تفاصيل طلبك هنا.')}</p></div><button class="request-open-btn" data-open-request="${currentRequest.id}">فتح الطلب</button></div>`;
  el.querySelector('[data-open-request]').addEventListener('click',()=>openRequestSheet(currentRequest.id));
}
async function renderDriverOnHomeMap(){
  if(!currentRequest?.selected_driver_id)return;
  const {data}=await db.from('drivers').select('id,last_lat,last_lng').eq('id',currentRequest.selected_driver_id).maybeSingle();
  if(!data||data.last_lat==null||data.last_lng==null)return;
  initHomeMap(); clearDriverMarker(); driverMarker=L.marker([data.last_lat,data.last_lng]).addTo(homeMap).bindTooltip('سائق جيبلي');
}
function clearDriverMarker(){if(driverMarker&&homeMap){homeMap.removeLayer(driverMarker);driverMarker=null;}}

async function loadOffers(requestId){
  const {data,error}=await db.from('driver_offers').select('id,ride_request_id,driver_id,offered_fare,eta_minutes,note,status,created_at,driver:drivers(id,display_name,avatar_url,rating,total_rides,vehicle_make,vehicle_model,vehicle_color,plate_number)').eq('ride_request_id',requestId).in('status',['pending','accepted']).order('created_at',{ascending:false});
  if(error){currentOffers=[];renderOffers();return;}
  currentOffers=data||[]; renderOffers();
}
function sortedOffers(){
  const list=[...currentOffers];
  if(offerSort==='price')return list.sort((a,b)=>Number(a.offered_fare)-Number(b.offered_fare));
  if(offerSort==='eta')return list.sort((a,b)=>(a.eta_minutes||999)-(b.eta_minutes||999));
  return list.sort((a,b)=>{const ra=Number(a.driver?.rating||0),rb=Number(b.driver?.rating||0);if(rb!==ra)return rb-ra;const ea=a.eta_minutes||999,eb=b.eta_minutes||999;if(ea!==eb)return ea-eb;return Number(a.offered_fare)-Number(b.offered_fare);});
}
function renderOffers(){
  $('offersCount').textContent=currentOffers.length;
  const list=$('offersList');
  if(!currentOffers.length){list.innerHTML=`<div class="empty-state"><div class="empty-icon"><i data-lucide="radar"></i></div><strong>بانتظار العروض</strong><p>راح تظهر عروض السائقين هنا فور وصولها.</p></div>`;icons();return;}
  list.innerHTML=sortedOffers().map((o,idx)=>{
    const d=o.driver||{}; const name=d.display_name||'سائق جيبلي'; const best=offerSort==='best'&&idx===0;
    return `<article class="offer-card"><div class="offer-head"><div class="driver-avatar">${escapeHtml(initial(name))}</div><div><h4>${escapeHtml(name)}</h4><p>⭐ ${Number(d.rating||5).toFixed(1)} · ${Number(d.total_rides||0).toLocaleString('ar-IQ')} رحلة</p></div><div class="offer-price"><strong>${money(o.offered_fare)}</strong><small>${o.eta_minutes?`وصول ${o.eta_minutes} د`:'وقت الوصول غير محدد'}</small></div></div><div class="offer-tags">${best?'<span class="offer-tag">⭐ أفضل عرض</span>':''}${d.vehicle_make?`<span class="offer-tag">${escapeHtml([d.vehicle_make,d.vehicle_model].filter(Boolean).join(' '))}</span>`:''}${o.note?`<span class="offer-tag">${escapeHtml(o.note)}</span>`:''}</div><div class="offer-actions"><button class="accept-offer" data-accept-offer="${o.id}">قبول العرض</button><button class="counter-offer" data-counter-offer="${o.id}">تفاوض</button></div></article>`;
  }).join('');
  $$('[data-accept-offer]',list).forEach(b=>b.addEventListener('click',()=>acceptOffer(b.dataset.acceptOffer)));
  $$('[data-counter-offer]',list).forEach(b=>b.addEventListener('click',()=>openCounter(b.dataset.counterOffer)));
}
async function acceptOffer(offerId){
  if(!currentRequest)return;
  const offer=currentOffers.find(o=>o.id===offerId); if(!offer)return;
  if(!confirm(`تأكيد اختيار هذا السائق بسعر ${money(offer.offered_fare)}؟ بعد القبول يثبت السعر.`))return;
  const {data,error}=await db.from('ride_requests').update({status:'driver_selected',accepted_offer_id:offerId}).eq('id',currentRequest.id).eq('customer_id',currentUser.id).select('*').single();
  if(error){notify(`تعذر قبول العرض: ${error.message}`);return;}
  currentRequest=data; notify(`تم تثبيت السعر: ${money(data.agreed_fare)}`); await refreshCustomerData(); await openRequestSheet(data.id);
}
function openCounter(offerId){
  currentCounterOfferId=offerId; const offer=currentOffers.find(o=>o.id===offerId); $('counterAmount').value=offer?Math.max(500,Number(offer.offered_fare)-500):''; $('counterMessage').value=''; openSheet('counterSheet');
}
async function sendCounter(){
  const offer=currentOffers.find(o=>o.id===currentCounterOfferId); if(!offer||!currentRequest)return;
  const amount=Number($('counterAmount').value); if(!amount||amount<500)return notify('اكتب سعراً صحيحاً');
  const {error}=await db.from('offer_negotiations').insert({offer_id:offer.id,ride_request_id:currentRequest.id,sender_id:currentUser.id,amount,message:$('counterMessage').value.trim()||null});
  if(error)return notify(`تعذر إرسال التفاوض: ${error.message}`);
  closeSheet('counterSheet'); notify('تم إرسال سعرك المقترح للسائق');
}

async function openRequestSheet(requestId){
  const {data,error}=await db.from('ride_requests').select('*').eq('id',requestId).eq('customer_id',currentUser.id).single();
  if(error)return notify('تعذر فتح الطلب');
  currentRequest=data; renderRequestSheet(); openSheet('requestSheet'); await loadOffers(requestId); if(data.selected_driver_id)await renderSelectedDriver();
}
function renderRequestSheet(){
  const r=currentRequest; if(!r)return;
  $('requestSheetTitle').textContent=statusLabels[r.status]||'تفاصيل الطلب';
  $('requestStatusCard').innerHTML=`<div class="status-top"><div><h3>${escapeHtml(statusLabels[r.status]||r.status)}</h3><p>${escapeHtml(statusDescriptions[r.status]||'')}</p></div><span class="request-id">#${r.id.slice(0,8).toUpperCase()}</span></div><div class="status-route"><span>🟢 ${escapeHtml(r.pickup_address)}</span><span>🔵 ${escapeHtml(r.destination_address||'بدون وجهة')}</span>${r.agreed_fare?`<span>💰 السعر المتفق عليه: <strong>${money(r.agreed_fare)}</strong></span>`:'<span>🤝 السعر: حسب عروض السائقين</span>'}</div>`;
  const chosen=!!r.accepted_offer_id;
  $('offersSection').classList.toggle('hidden',chosen);
  $('selectedDriverSection').classList.toggle('hidden',!chosen);
  $('cancelRequestBtn').classList.toggle('hidden',chosen||!['draft','requested','searching','offers_received','negotiating'].includes(r.status));
}
async function renderSelectedDriver(){
  const r=currentRequest;if(!r?.selected_driver_id)return;
  const {data:d}=await db.from('drivers').select('id,display_name,rating,total_rides,vehicle_make,vehicle_model,vehicle_color,plate_number,last_lat,last_lng').eq('id',r.selected_driver_id).maybeSingle();
  const name=d?.display_name||'سائق جيبلي';
  $('selectedDriverSection').innerHTML=`<article class="selected-driver-card"><div class="offer-head"><div class="driver-avatar">${escapeHtml(initial(name))}</div><div><h3>${escapeHtml(name)}</h3><p>⭐ ${Number(d?.rating||5).toFixed(1)} · ${Number(d?.total_rides||0).toLocaleString('ar-IQ')} رحلة</p></div><div class="offer-price"><strong>${money(r.agreed_fare)}</strong><small>السعر المثبت</small></div></div><div class="selected-driver-grid"><div><small>السيارة</small><strong>${escapeHtml([d?.vehicle_make,d?.vehicle_model].filter(Boolean).join(' ')||'—')}</strong></div><div><small>اللون</small><strong>${escapeHtml(d?.vehicle_color||'—')}</strong></div><div><small>اللوحة</small><strong>${escapeHtml(d?.plate_number||'—')}</strong></div><div><small>الدفع</small><strong>نقداً عند الوصول</strong></div></div></article>`;
  icons(); await renderDriverOnHomeMap();
}
async function cancelCurrentRequest(){
  if(!currentRequest||!['draft','requested','searching','offers_received','negotiating'].includes(currentRequest.status))return;
  const reason=prompt('سبب الإلغاء (اختياري):','')||null;
  if(!confirm('هل تريد إلغاء الطلب؟'))return;
  const {error}=await db.from('ride_requests').update({status:'cancelled',cancel_reason:reason}).eq('id',currentRequest.id).eq('customer_id',currentUser.id);
  if(error)return notify(`تعذر إلغاء الطلب: ${error.message}`);
  closeSheet('requestSheet'); currentRequest=null; notify('تم إلغاء الطلب'); await refreshCustomerData();
}

async function loadRequests(filter='all'){
  if(!currentUser)return; let q=db.from('ride_requests').select('*').eq('customer_id',currentUser.id).order('created_at',{ascending:false}).limit(50);
  if(filter==='active')q=q.in('status',activeStatuses); if(filter==='completed')q=q.eq('status','completed'); if(filter==='cancelled')q=q.eq('status','cancelled');
  const {data,error}=await q; const list=$('requestsList');
  if(error){list.innerHTML='<div class="empty-state">تعذر تحميل الطلبات.</div>';return;}
  if(!data?.length){list.innerHTML=`<div class="empty-state"><div class="empty-icon"><i data-lucide="route-off"></i></div><strong>ما عندك طلبات هنا</strong><p>طلباتك الجديدة راح تظهر بهذا القسم.</p></div>`;icons();return;}
  list.innerHTML=data.map(r=>{const s=serviceInfo(r.service_type);return `<article class="request-card"><div class="request-card-top"><div><p class="kicker">${escapeHtml(s.name_ar)}</p><h3>${escapeHtml(statusLabels[r.status]||r.status)}</h3></div><span class="status-pill">${r.agreed_fare?money(r.agreed_fare):'حسب الاتفاق'}</span></div><div class="request-route"><div><i class="from"></i><span>${escapeHtml(r.pickup_address)}</span></div><div><i class="to"></i><span>${escapeHtml(r.destination_address||'بدون وجهة')}</span></div></div><div class="request-card-foot"><small>${formatTime(r.created_at)}</small><button data-open-request="${r.id}">التفاصيل</button></div></article>`}).join('');
  $$('[data-open-request]',list).forEach(b=>b.addEventListener('click',()=>openRequestSheet(b.dataset.openRequest)));
}

async function loadNotifications(){
  if(!currentUser)return; const {data,error}=await db.from('notifications').select('*').eq('user_id',currentUser.id).order('created_at',{ascending:false}).limit(50); const list=$('notificationsList');
  if(error||!data?.length){list.innerHTML=`<div class="empty-state"><div class="empty-icon"><i data-lucide="bell-off"></i></div><strong>لا توجد إشعارات</strong><p>العروض وتحديثات الطلب راح تظهر هنا.</p></div>`;$('notifDot').classList.add('hidden');icons();return;}
  $('notifDot').classList.toggle('hidden',!data.some(n=>!n.read_at));
  list.innerHTML=data.map(n=>`<article class="notification-card ${n.read_at?'':'unread'}" data-notification-id="${n.id}"><div class="notif-icon"><i data-lucide="${n.type==='driver_offer'?'banknote':n.type==='offer_accepted'?'badge-check':'bell'}"></i></div><div><h3>${escapeHtml(n.title)}</h3><p>${escapeHtml(n.body||'')}</p><time>${formatTime(n.created_at)}</time></div></article>`).join('');icons();
  $$('[data-notification-id]',list).forEach(card=>card.addEventListener('click',async()=>{if(!card.classList.contains('unread'))return;await db.from('notifications').update({read_at:new Date().toISOString()}).eq('id',card.dataset.notificationId).eq('user_id',currentUser.id);card.classList.remove('unread');loadNotificationBadge();}));
}
async function loadNotificationBadge(){
  if(!currentUser)return; const {data}=await db.from('notifications').select('id,read_at').eq('user_id',currentUser.id).is('read_at',null).limit(1); $('notifDot').classList.toggle('hidden',!(data?.length));
}
async function markAllNotificationsRead(){
  const {error}=await db.from('notifications').update({read_at:new Date().toISOString()}).eq('user_id',currentUser.id).is('read_at',null); if(error)return notify('تعذر تحديث الإشعارات'); notify('تم تحديد الإشعارات كمقروءة');loadNotifications();
}

function renderAccount(){
  if(!currentProfile)return;
  $('accountName').textContent=currentProfile.full_name||'مستخدم جيبلي'; $('accountPhone').textContent=currentProfile.phone||'—'; $('accountInitial').textContent=initial(currentProfile.full_name); $('profileName').value=currentProfile.full_name||''; $('profilePhone').value=currentProfile.phone||'';
}
async function saveProfile(e){
  e.preventDefault();const form=e.currentTarget;setBusy(form,true);const patch={full_name:$('profileName').value.trim(),phone:$('profilePhone').value.trim(),updated_at:new Date().toISOString()};const {data,error}=await db.from('profiles').update(patch).eq('id',currentUser.id).select('*').single();setBusy(form,false);if(error)return notify(`تعذر حفظ البيانات: ${error.message}`);currentProfile=data;applyProfile();notify('تم حفظ بياناتك');
}
function applyProfile(){
  const name=currentProfile?.full_name||currentUser?.user_metadata?.full_name||'مستخدم جيبلي'; $('avatarInitial').textContent=initial(name); $('accountInitial').textContent=initial(name); $('accountName').textContent=name; $('accountPhone').textContent=currentProfile?.phone||'—';
}

async function openAddresses(){openSheet('addressesSheet');await loadAddresses();}
async function loadAddresses(){
  const {data,error}=await db.from('saved_addresses').select('*').eq('user_id',currentUser.id).order('created_at',{ascending:false});const list=$('addressesList');
  if(error||!data?.length){list.innerHTML='<div class="empty-state"><strong>لا توجد عناوين محفوظة</strong><p>أضف البيت أو العمل حتى توصل أسرع.</p></div>';return;}
  list.innerHTML=data.map(a=>`<article class="address-card"><div><h4>${escapeHtml(a.label)}</h4><p>${escapeHtml(a.address)}</p></div><button data-delete-address="${a.id}">×</button></article>`).join('');
  $$('[data-delete-address]',list).forEach(b=>b.addEventListener('click',async()=>{if(!confirm('حذف هذا العنوان؟'))return;await db.from('saved_addresses').delete().eq('id',b.dataset.deleteAddress).eq('user_id',currentUser.id);loadAddresses();}));
}
async function saveAddress(e){
  e.preventDefault();const payload={user_id:currentUser.id,label:$('addressLabel').value.trim(),address:$('addressText').value.trim(),lat:Number($('addressLat').value),lng:Number($('addressLng').value)};
  if(!payload.label||!payload.address||!Number.isFinite(payload.lat)||!Number.isFinite(payload.lng))return notify('أكمل بيانات العنوان');
  const {error}=await db.from('saved_addresses').insert(payload);if(error)return notify(`تعذر حفظ العنوان: ${error.message}`);e.currentTarget.reset();notify('تم حفظ العنوان');loadAddresses();
}
async function useCurrentForAddress(){try{const p=await locateUser({silent:true});$('addressLat').value=p.lat.toFixed(6);$('addressLng').value=p.lng.toFixed(6);if(!$('addressText').value)$('addressText').value='موقعي الحالي';notify('تم أخذ موقعك الحالي');}catch{notify('تعذر تحديد الموقع');}}

async function submitSupport(e){
  e.preventDefault();const form=e.currentTarget;setBusy(form,true);const {error}=await db.from('support_tickets').insert({user_id:currentUser.id,ride_request_id:currentRequest?.id||null,category:$('supportCategory').value,subject:$('supportSubject').value.trim(),message:$('supportMessage').value.trim()});setBusy(form,false);if(error)return notify(`تعذر إرسال الطلب: ${error.message}`);form.reset();closeSheet('supportSheet');notify('تم إرسال رسالتك إلى الدعم');
}
function showInfo(type){
  const content={
    about:['عن جيبلي','جيبلي منصة عراقية للنقل والتوصيل تربط العميل بالسائقين ومقدمي الخدمة بطريقة أوضح. أنت تنشئ الطلب، تستلم عروضاً، تختار المناسب، وبعد القبول يثبت السعر المتفق عليه.'],
    terms:['الشروط والأحكام','باستخدام جيبلي أنت توافق على إدخال معلومات صحيحة واحترام المستخدمين والسائقين. السعر في خدمات النقل الأساسية يعتمد على العرض الذي تقبله داخل النظام، ويصبح هو السعر المتفق عليه للطلب ما لم يتم تعديل الخدمة باتفاق موثق.'],
    privacy:['سياسة الخصوصية','نستخدم بيانات الحساب والموقع والطلبات فقط لتشغيل الخدمة وتحسينها. لا ينبغي مشاركة بيانات الاتصال الحساسة خارج الحاجة التشغيلية للطلب، ويتم التحكم في الوصول للبيانات عبر صلاحيات قاعدة البيانات.']
  }[type];
  $('infoTitle').textContent=content[0];$('infoContent').innerHTML=`<p>${escapeHtml(content[1])}</p><h3>نسخة تجريبية</h3><p>هذه السياسات نصوص أولية للتجربة وتحتاج مراجعة قانونية قبل الإطلاق التجاري العام.</p>`;openSheet('infoSheet');
}

function unsubscribeRealtime(){channels.forEach(ch=>db.removeChannel(ch));channels=[];}
function subscribeRealtime(){
  unsubscribeRealtime(); if(!currentUser)return;
  const reqCh=db.channel(`customer-requests-${currentUser.id}`).on('postgres_changes',{event:'*',schema:'public',table:'ride_requests',filter:`customer_id=eq.${currentUser.id}`},async()=>{await loadCurrentRequest();if(!$('requestSheet').classList.contains('hidden')&&currentRequest){renderRequestSheet();if(currentRequest.accepted_offer_id)await renderSelectedDriver();}loadRequests();}).subscribe();
  const offerCh=db.channel(`customer-offers-${currentUser.id}`).on('postgres_changes',{event:'*',schema:'public',table:'driver_offers'},async payload=>{if(!currentRequest)return;const rid=payload.new?.ride_request_id||payload.old?.ride_request_id;if(rid!==currentRequest.id)return;await loadCurrentRequest();await loadOffers(currentRequest.id);notify('وصلك تحديث جديد على عروض السائقين');}).subscribe();
  const notifCh=db.channel(`customer-notifs-${currentUser.id}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications',filter:`user_id=eq.${currentUser.id}`},payload=>{loadNotificationBadge();if(payload.new?.title)notify(payload.new.title);if(currentPage==='notifications')loadNotifications();}).subscribe();
  const driverCh=db.channel(`customer-driver-${currentUser.id}`).on('postgres_changes',{event:'UPDATE',schema:'public',table:'drivers'},async payload=>{if(currentRequest?.selected_driver_id&&payload.new?.id===currentRequest.selected_driver_id){await renderDriverOnHomeMap();if(!$('requestSheet').classList.contains('hidden'))await renderSelectedDriver();}}).subscribe();
  channels.push(reqCh,offerCh,notifCh,driverCh);
}

async function refreshCustomerData(){await Promise.all([loadCurrentRequest(),loadNotificationBadge()]);if(currentPage==='requests')loadRequests();if(currentPage==='notifications')loadNotifications();}
async function showApp(user){
  currentUser=user;$('authView').classList.add('hidden');$('appView').classList.remove('hidden');
  const {data}=await db.from('profiles').select('id,full_name,phone,avatar_url,role').eq('id',user.id).maybeSingle();currentProfile=data||{id:user.id,full_name:user.user_metadata?.full_name||'',phone:user.user_metadata?.phone||''};applyProfile();initHomeMap();await loadServices();await refreshCustomerData();subscribeRealtime();icons();setTimeout(()=>homeMap.invalidateSize(),100);locateUser({silent:true}).catch(()=>{});
}
function showAuth(){currentUser=null;currentProfile=null;currentRequest=null;unsubscribeRealtime();closeAllSheets();$('appView').classList.add('hidden');$('authView').classList.remove('hidden');icons();}

function bindEvents(){
  $$('.seg-btn').forEach(b=>b.addEventListener('click',()=>{$$('.seg-btn').forEach(x=>x.classList.toggle('active',x===b));$('loginForm').classList.toggle('active',b.dataset.authTab==='login');$('signupForm').classList.toggle('active',b.dataset.authTab==='signup');}));
  $('loginForm').addEventListener('submit',async e=>{e.preventDefault();setBusy(e.currentTarget,true);const {data,error}=await db.auth.signInWithPassword({email:$('loginEmail').value.trim(),password:$('loginPassword').value});setBusy(e.currentTarget,false);if(error)return notify('تعذر تسجيل الدخول. تحقق من البيانات وتأكيد البريد.');notify('أهلاً بك في جيبلي');await showApp(data.user);});
  $('signupForm').addEventListener('submit',async e=>{e.preventDefault();setBusy(e.currentTarget,true);const full_name=$('signupName').value.trim(),phone=$('signupPhone').value.trim();const {data,error}=await db.auth.signUp({email:$('signupEmail').value.trim(),password:$('signupPassword').value,options:{data:{full_name,phone}}});setBusy(e.currentTarget,false);if(error)return notify(error.message);if(data.session){notify('تم إنشاء حسابك');await showApp(data.user);}else notify('تم إنشاء الحساب. افتح بريدك لتأكيده ثم سجل الدخول.');});
  $$('.nav-btn').forEach(b=>b.addEventListener('click',()=>switchPage(b.dataset.page)));
  $$('[data-page-target]').forEach(b=>b.addEventListener('click',()=>switchPage(b.dataset.pageTarget)));
  $('profileAvatarBtn').addEventListener('click',()=>switchPage('account'));$('homeLocateBtn').addEventListener('click',()=>locateUser());$('headerLocationBtn').addEventListener('click',()=>locateUser());$('homeSearchBtn').addEventListener('click',()=>openBooking('taxi'));
  $('closeBookingBtn').addEventListener('click',()=>closeSheet('bookingSheet'));$('bookingBackBtn').addEventListener('click',()=>{if(bookingStep>1){bookingStep--;renderBookingStep();}});$('bookingNextBtn').addEventListener('click',async()=>{if(!validateBookingStep())return;if(bookingStep<4){bookingStep++;renderBookingStep();}else await submitBooking();});
  $('setPickupModeBtn').addEventListener('click',()=>setBookingPickMode('pickup'));$('setDestinationModeBtn').addEventListener('click',()=>setBookingPickMode('destination'));$('bookingLocateBtn').addEventListener('click',()=>locateUser({forBooking:true}));$('scheduleMode').addEventListener('change',e=>$('scheduledAtWrap').classList.toggle('hidden',e.target.value!=='later'));
  $('closeRequestBtn').addEventListener('click',()=>closeSheet('requestSheet'));$('cancelRequestBtn').addEventListener('click',cancelCurrentRequest);
  $$('.offer-sort button').forEach(b=>b.addEventListener('click',()=>{offerSort=b.dataset.offerSort;$$('.offer-sort button').forEach(x=>x.classList.toggle('active',x===b));renderOffers();}));
  $('closeCounterBtn').addEventListener('click',()=>closeSheet('counterSheet'));$('sendCounterBtn').addEventListener('click',sendCounter);
  $$('#requestsFilters .filter-chip').forEach(b=>b.addEventListener('click',()=>{$$('#requestsFilters .filter-chip').forEach(x=>x.classList.toggle('active',x===b));loadRequests(b.dataset.filter);}));
  $('markAllReadBtn').addEventListener('click',markAllNotificationsRead);$('profileForm').addEventListener('submit',saveProfile);
  $('openSavedAddresses').addEventListener('click',openAddresses);$('accountAddressesBtn').addEventListener('click',openAddresses);$('closeAddressesBtn').addEventListener('click',()=>closeSheet('addressesSheet'));$('addressForm').addEventListener('submit',saveAddress);$('addressUseCurrentBtn').addEventListener('click',useCurrentForAddress);
  $('supportBtn').addEventListener('click',()=>openSheet('supportSheet'));$('accountSupportBtn').addEventListener('click',()=>openSheet('supportSheet'));$('closeSupportBtn').addEventListener('click',()=>closeSheet('supportSheet'));$('supportForm').addEventListener('submit',submitSupport);
  $('aboutBtn').addEventListener('click',()=>showInfo('about'));$('termsBtn').addEventListener('click',()=>showInfo('terms'));$('privacyBtn').addEventListener('click',()=>showInfo('privacy'));$('closeInfoBtn').addEventListener('click',()=>closeSheet('infoSheet'));
  $('logoutBtn').addEventListener('click',async()=>{await db.auth.signOut();showAuth();notify('تم تسجيل الخروج');});
  $('notifPermissionBtn').addEventListener('click',async()=>{if(!('Notification'in window))return notify('الإشعارات غير مدعومة هنا');const result=await Notification.requestPermission();notify(result==='granted'?'تم السماح بالإشعارات':'لم يتم السماح بالإشعارات');});
  $('installAppBtn').addEventListener('click',async()=>{if(deferredInstallPrompt){deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;}else notify('من قائمة المتصفح اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».');});
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;});
  $$('.sheet').forEach(sheet=>sheet.addEventListener('click',e=>{if(e.target===sheet&&sheet.id!=='bookingSheet')closeSheet(sheet.id);}));
}

bindEvents();icons();
db.auth.onAuthStateChange((_event,session)=>{if(session?.user&&!currentUser)showApp(session.user);if(!session?.user&&currentUser)showAuth();});
(async()=>{const {data:{session}}=await db.auth.getSession();if(session?.user)await showApp(session.user);else showAuth();hideSplash();})();
