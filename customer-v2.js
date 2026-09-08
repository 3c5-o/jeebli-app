(()=>{
  const isCustomer=!/(?:admin|driver)\.html$/i.test(location.pathname);
  if(!isCustomer)return;
  const ready=fn=>document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn,{once:true}):fn();
  ready(init);

  async function init(){
    if(!window.supabase||!window.JEEBLI_CONFIG)return;
    if(!document.querySelector('link[href="./customer-v2.css"]')){const l=document.createElement('link');l.rel='stylesheet';l.href='./customer-v2.css';document.head.appendChild(l)}
    const db=window.supabase.createClient(window.JEEBLI_CONFIG.SUPABASE_URL,window.JEEBLI_CONFIG.SUPABASE_KEY);
    const state={areas:[],openRideId:null,placeMode:'destination',chatChannel:null,eventChannel:null,rating:5,tags:new Set()};
    const $=id=>document.getElementById(id), $$=(s,r=document)=>[...r.querySelectorAll(s)];
    const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
    const money=v=>Number(v||0).toLocaleString('ar-IQ')+' د.ع';
    const fmt=iso=>{if(!iso)return'—';try{return new Intl.DateTimeFormat('ar-IQ',{dateStyle:'medium',timeStyle:'short'}).format(new Date(iso))}catch{return'—'}};
    const notify=msg=>window.notify?window.notify(msg):alert(msg);
    const getUser=async()=>{const {data}=await db.auth.getUser();return data.user||null};

    async function loadAreas(){
      const {data}=await db.from('service_areas').select('id,code,name_ar,area_type,parent_id,latitude,longitude,sort_order').eq('is_active',true).order('sort_order').order('name_ar');
      state.areas=data||[];
    }
    await loadAreas();

    const byId=()=>Object.fromEntries(state.areas.map(a=>[a.id,a]));
    function pathName(id){const map=byId(),parts=[];let a=map[id],g=0;while(a&&g++<8){parts.unshift(a.name_ar);a=map[a.parent_id]}return parts.join(' · ')}
    function villageOptions(selected=''){
      const map=byId(),subs=state.areas.filter(a=>a.area_type==='subdistrict');
      return '<option value="">اختر المنطقة</option>'+subs.map(s=>{const rows=state.areas.filter(a=>a.parent_id===s.id&&['village','neighborhood'].includes(a.area_type));if(!rows.length)return'';return `<optgroup label="${esc(s.name_ar)}">${rows.map(a=>`<option value="${a.id}" ${a.id===selected?'selected':''}>${esc(a.name_ar)}</option>`).join('')}</optgroup>`}).join('');
    }

    injectNetwork();injectAuthSecurity();injectAccountArea();injectBookingAreas();injectSheets();patchBooking();patchRequestSheet();bindGlobal();
    await refreshProfileArea();

    function injectNetwork(){
      const el=document.createElement('div');el.id='v2Network';el.className='v2-network hidden';el.textContent='أنت حالياً بدون اتصال بالإنترنت';document.body.appendChild(el);
      const sync=()=>el.classList.toggle('hidden',navigator.onLine);window.addEventListener('online',sync);window.addEventListener('offline',sync);sync();
    }

    function injectAuthSecurity(){
      const login=$('loginForm');if(login&&!$('v2ForgotBtn')){const b=document.createElement('button');b.type='button';b.id='v2ForgotBtn';b.className='v2-forgot';b.textContent='نسيت كلمة المرور؟';login.appendChild(b);b.onclick=resetPasswordEmail}
      const menu=document.querySelector('#page-account .menu-card');if(menu&&!$('v2SecurityBtn')){const b=document.createElement('button');b.id='v2SecurityBtn';b.innerHTML='<i data-lucide="shield-keyhole"></i><span>الأمان وكلمة المرور</span><i data-lucide="chevron-left"></i>';menu.prepend(b);b.onclick=()=>openV2('v2PasswordSheet')}
      window.lucide?.createIcons();
    }

    function injectAccountArea(){
      const profileForm=$('profileForm');if(!profileForm||$('v2AccountArea'))return;
      const card=document.createElement('div');card.id='v2AccountArea';card.className='customer-v2-card';card.innerHTML=`<h3>منطقتي</h3><p>تُستخدم المنطقة لمطابقة طلباتك مع السائقين الذين يخدمون منطقتك.</p><div class="customer-v2-grid"><label class="full">القرية / المنطقة<select id="v2ProfileArea">${villageOptions()}</select></label></div><div class="v2-inline-actions"><button id="v2SaveArea" class="v2-pill-btn dark" type="button">حفظ المنطقة</button></div><div id="v2AreaPath" class="v2-area-badge">لم يتم تحديد المنطقة</div>`;
      profileForm.insertAdjacentElement('afterend',card);$('v2SaveArea').onclick=saveProfileArea;$('v2ProfileArea').onchange=()=>renderAreaPath($('v2ProfileArea').value);
    }
    function renderAreaPath(id){const el=$('v2AreaPath');if(el)el.textContent=id?pathName(id):'لم يتم تحديد المنطقة'}
    async function refreshProfileArea(){
      const u=await getUser();if(!u)return;const {data}=await db.from('profiles').select('area_id').eq('id',u.id).maybeSingle();if($('v2ProfileArea')){$('v2ProfileArea').innerHTML=villageOptions(data?.area_id||'');$('v2ProfileArea').value=data?.area_id||'';renderAreaPath(data?.area_id)}
      if($('v2PickupArea')&&!$('v2PickupArea').value&&data?.area_id)$('v2PickupArea').value=data.area_id;
    }
    async function saveProfileArea(){const u=await getUser();if(!u)return;const area_id=$('v2ProfileArea').value;if(!area_id)return notify('اختر القرية أو المنطقة');const {error}=await db.from('profiles').update({area_id}).eq('id',u.id);if(error)return notify(`تعذر حفظ المنطقة: ${error.message}`);renderAreaPath(area_id);if($('v2PickupArea'))$('v2PickupArea').value=area_id;notify('تم تحديث منطقتك')}

    function injectBookingAreas(){
      const loc=document.querySelector('#bookingStep2 .location-inputs');if(!loc||$('v2PickupArea'))return;
      const area=document.createElement('div');area.className='customer-v2-card';area.innerHTML=`<h3>منطقة الطلب</h3><p>اختر منطقة الانطلاق بدقة حتى يصل الطلب للسائقين المناسبين فقط.</p><div class="customer-v2-grid"><label>منطقة الانطلاق<select id="v2PickupArea" required>${villageOptions()}</select></label><label>منطقة الوجهة<select id="v2DestinationArea">${villageOptions()}</select></label></div><div class="v2-location-row"><button type="button" id="v2SearchPickup" class="v2-location-search"><i data-lucide="search"></i> بحث الانطلاق</button><button type="button" id="v2SearchDestination" class="v2-location-search"><i data-lucide="map-pin"></i> بحث الوجهة</button></div>`;
      loc.insertAdjacentElement('afterend',area);$('v2SearchPickup').onclick=()=>openPlaceSearch('pickup');$('v2SearchDestination').onclick=()=>openPlaceSearch('destination');window.lucide?.createIcons();
      refreshProfileArea();
    }

    function injectSheets(){
      if($('v2PlaceSheet'))return;
      document.body.insertAdjacentHTML('beforeend',`
      <section id="v2PlaceSheet" class="v2-sheet hidden"><div class="v2-sheet-panel"><div class="v2-sheet-head"><button class="v2-close" data-v2-close="v2PlaceSheet">×</button><div><h2 id="v2PlaceTitle">بحث عن مكان</h2><p>ابحث باسم المكان أو اختر من مناطق الشرقاط</p></div></div><div class="v2-search-box"><input id="v2PlaceQuery" autocomplete="off" placeholder="مثال: مستشفى، سوق، قرية..." /></div><div id="v2PlaceResults" class="v2-results"></div></div></section>
      <section id="v2ChatSheet" class="v2-sheet hidden"><div class="v2-sheet-panel"><div class="v2-sheet-head"><button class="v2-close" data-v2-close="v2ChatSheet">×</button><div><h2>محادثة الرحلة</h2><p>التواصل يبقى داخل جيبلي</p></div></div><div id="v2ChatList" class="v2-chat-list"></div><form id="v2ChatForm" class="v2-chat-form"><input id="v2ChatInput" maxlength="500" required placeholder="اكتب رسالة للسائق" /><button>إرسال</button></form></div></section>
      <section id="v2SafetySheet" class="v2-sheet hidden"><div class="v2-sheet-panel"><div class="v2-sheet-head"><button class="v2-close" data-v2-close="v2SafetySheet">×</button><div><h2>مركز أمان جيبلي</h2><p>مشاركة الرحلة وجهة الاتصال الموثوقة</p></div></div><div class="v2-safety-hero"><strong>رحلتك ومعلومات السائق بمكان واحد</strong><p>يمكنك مشاركة ملخص الرحلة مع شخص تثق به عند الحاجة.</p></div><div class="v2-inline-actions"><button id="v2ShareRide" class="v2-pill-btn dark">مشاركة الرحلة</button></div><div class="customer-v2-card"><h3>جهات الاتصال الموثوقة</h3><div id="v2Contacts"></div><div class="customer-v2-grid"><label>الاسم<input id="v2ContactName" /></label><label>الهاتف<input id="v2ContactPhone" type="tel" /></label></div><button id="v2AddContact" class="v2-pill-btn" type="button">إضافة جهة اتصال</button></div></div></section>
      <section id="v2RatingSheet" class="v2-sheet hidden"><div class="v2-sheet-panel"><div class="v2-sheet-head"><button class="v2-close" data-v2-close="v2RatingSheet">×</button><div><h2>قيّم السائق</h2><p>ساعدنا نحافظ على جودة جيبلي</p></div></div><div id="v2Stars" class="v2-stars">${[1,2,3,4,5].map(n=>`<button class="v2-star ${n<=5?'active':''}" data-star="${n}" type="button">★</button>`).join('')}</div><div id="v2Tags" class="v2-tags">${['تعامل ممتاز','قيادة جيدة','وصل بسرعة','سيارة نظيفة'].map(t=>`<button class="v2-tag" data-tag="${t}" type="button">${t}</button>`).join('')}</div><label style="margin-top:14px">ملاحظة اختيارية<textarea id="v2RatingComment" rows="3" placeholder="اكتب ملاحظتك"></textarea></label><button id="v2SubmitRating" class="v2-pill-btn dark" style="width:100%;margin-top:12px">إرسال التقييم</button></div></section>
      <section id="v2ReceiptSheet" class="v2-sheet hidden"><div class="v2-sheet-panel"><div class="v2-sheet-head"><button class="v2-close" data-v2-close="v2ReceiptSheet">×</button><div><h2>إيصال جيبلي</h2><p>ملخص الطلب والسعر المتفق عليه</p></div></div><div id="v2Receipt"></div></div></section>
      <section id="v2PasswordSheet" class="v2-sheet hidden"><div class="v2-sheet-panel"><div class="v2-sheet-head"><button class="v2-close" data-v2-close="v2PasswordSheet">×</button><div><h2>تغيير كلمة المرور</h2><p>استخدم كلمة مرور قوية لا تستعملها بمكان آخر</p></div></div><div class="customer-v2-grid"><label class="full">كلمة المرور الجديدة<input id="v2NewPassword" type="password" minlength="8" /></label><label class="full">تأكيد كلمة المرور<input id="v2ConfirmPassword" type="password" minlength="8" /></label></div><button id="v2ChangePassword" class="v2-pill-btn dark" style="width:100%;margin-top:12px">حفظ كلمة المرور</button></div></section>`);
      $$('[data-v2-close]').forEach(b=>b.onclick=()=>closeV2(b.dataset.v2Close));
      $('v2PlaceQuery').addEventListener('input',debounce(()=>searchPlaces($('v2PlaceQuery').value.trim()),450));
      $('v2ChatForm').onsubmit=sendChat;$('v2ShareRide').onclick=shareRide;$('v2AddContact').onclick=addContact;$('v2SubmitRating').onclick=submitRating;$('v2ChangePassword').onclick=changePassword;
      $$('.v2-star').forEach(b=>b.onclick=()=>setRating(Number(b.dataset.star)));$$('.v2-tag').forEach(b=>b.onclick=()=>{const t=b.dataset.tag;state.tags.has(t)?state.tags.delete(t):state.tags.add(t);b.classList.toggle('active',state.tags.has(t))});
    }
    function openV2(id){$(id)?.classList.remove('hidden');document.body.style.overflow='hidden'}function closeV2(id){$(id)?.classList.add('hidden');document.body.style.overflow=''}

    function patchBooking(){
      const originalValidate=window.validateBookingStep;
      if(originalValidate)window.validateBookingStep=function(){const ok=originalValidate();if(!ok)return false;const step=document.querySelector('#bookingStep2.booking-step.active');if(step&&!$('v2PickupArea')?.value){notify('حدد منطقة الانطلاق');return false}return true};
      const originalSet=window.setBookingPoint;
      if(originalSet)window.setBookingPoint=function(mode,lat,lng){const out=originalSet(mode,lat,lng);reverseGeocode(mode,lat,lng);return out};
      const originalSubmit=window.submitBooking;
      if(originalSubmit)window.submitBooking=submitBookingV2;
    }
    async function submitBookingV2(){
      const u=await getUser();if(!u)return notify('سجل الدخول أولاً');
      const service=document.querySelector('.booking-service.selected')?.dataset.bookingService||'taxi';const pickupLat=Number($('pickupLat').value),pickupLng=Number($('pickupLng').value),destLat=Number($('destinationLat').value),destLng=Number($('destinationLng').value);
      const dist=haversine(pickupLat,pickupLng,destLat,destLng);const cod=!!$('codEnabled')?.checked;
      const payload={customer_id:u.id,service_type:service,status:'requested',pickup_address:$('pickupAddress').value.trim(),pickup_lat:pickupLat,pickup_lng:pickupLng,pickup_area_id:$('v2PickupArea').value,destination_address:$('destinationAddress').value.trim(),destination_lat:destLat,destination_lng:destLng,destination_area_id:$('v2DestinationArea').value||null,route_distance_km:Number.isFinite(dist)?Number(dist.toFixed(2)):null,scheduled_at:$('scheduleMode').value==='later'&&$('scheduledAt').value?new Date($('scheduledAt').value).toISOString():null,notes:$('rideNotes').value.trim()||null,service_details:window.collectServiceDetails?.()||{},cod_enabled:cod,cod_amount:cod?Number($('codAmount')?.value||0):null,payment_method:'cash'};
      const btn=$('bookingNextBtn');if(btn)btn.disabled=true;const {data,error}=await db.from('ride_requests').insert(payload).select('*').single();if(btn)btn.disabled=false;if(error)return notify(`تعذر إرسال الطلب: ${error.message}`);
      rememberPlace({name:payload.pickup_address,lat:pickupLat,lng:pickupLng,areaId:payload.pickup_area_id});rememberPlace({name:payload.destination_address,lat:destLat,lng:destLng,areaId:payload.destination_area_id});
      window.closeSheet?.('bookingSheet');notify('تم إرسال طلبك للسائقين المناسبين في منطقتك');await window.refreshCustomerData?.();await window.openRequestSheet?.(data.id);
    }
    function haversine(a,b,c,d){if(![a,b,c,d].every(Number.isFinite))return null;const r=6371,t=x=>x*Math.PI/180,dl=t(c-a),dn=t(d-b),q=Math.sin(dl/2)**2+Math.cos(t(a))*Math.cos(t(c))*Math.sin(dn/2)**2;return r*2*Math.atan2(Math.sqrt(q),Math.sqrt(1-q))}

    async function reverseGeocode(mode,lat,lng){
      try{const res=await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&accept-language=ar`);if(!res.ok)return;const j=await res.json();const input=$(mode==='pickup'?'pickupAddress':'destinationAddress');if(input&&(!input.value||/موقع .*المحدد|موقعي الحالي/.test(input.value)))input.value=j.display_name?.split(',').slice(0,3).join('، ')||input.value}catch{}
    }
    function openPlaceSearch(mode){state.placeMode=mode;$('v2PlaceTitle').textContent=mode==='pickup'?'ابحث عن موقع الانطلاق':'ابحث عن الوجهة';$('v2PlaceQuery').value='';renderQuickPlaces();openV2('v2PlaceSheet');setTimeout(()=>$('v2PlaceQuery').focus(),100)}
    function renderQuickPlaces(){const rec=recentPlaces();const areas=state.areas.filter(a=>['village','neighborhood'].includes(a.area_type)).slice(0,20);$('v2PlaceResults').innerHTML=(rec.length?`<div class="v2-area-badge">آخر الأماكن</div>${rec.map(r=>resultHtml(r.name,r.name,r.lat,r.lng,r.areaId,'history')).join('')}`:'')+`<div class="v2-area-badge">مناطق الخدمة</div>${areas.map(a=>resultHtml(a.name_ar,pathName(a.id),a.latitude,a.longitude,a.id,'map-pin')).join('')}`;bindPlaceResults()}
    async function searchPlaces(q){if(q.length<2)return renderQuickPlaces();$('v2PlaceResults').innerHTML='<div class="v2-empty">جاري البحث...</div>';const local=state.areas.filter(a=>a.name_ar.includes(q)&&['village','neighborhood','subdistrict'].includes(a.area_type)).slice(0,8).map(a=>({name:a.name_ar,subtitle:pathName(a.id),lat:a.latitude,lng:a.longitude,areaId:a.id,icon:'map-pin'}));let remote=[];try{let res=await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&countrycodes=iq&accept-language=ar&q=${encodeURIComponent(q+', الشرقاط, العراق')}`);if(res.ok){const j=await res.json();remote=j.map(x=>({name:x.display_name.split(',')[0],subtitle:x.display_name,lat:Number(x.lat),lng:Number(x.lon),areaId:'',icon:'search'}))}}catch{}
      const rows=[...local,...remote];$('v2PlaceResults').innerHTML=rows.length?rows.map(r=>resultHtml(r.name,r.subtitle,r.lat,r.lng,r.areaId,r.icon)).join(''):'<div class="v2-empty">ما حصلنا نتيجة. جرّب اسم أقرب أو حدد المكان من الخريطة.</div>';bindPlaceResults()}
    function resultHtml(name,sub,lat,lng,areaId,icon){return `<button class="v2-result" data-place-name="${esc(name)}" data-place-lat="${lat??''}" data-place-lng="${lng??''}" data-place-area="${areaId||''}"><span class="v2-result-icon"><i data-lucide="${icon||'map-pin'}"></i></span><span><strong>${esc(name)}</strong><small>${esc(sub||'')}</small></span></button>`}
    function bindPlaceResults(){$$('#v2PlaceResults [data-place-name]').forEach(b=>b.onclick=()=>choosePlace(b));window.lucide?.createIcons()}
    function choosePlace(b){const mode=state.placeMode,name=b.dataset.placeName,lat=Number(b.dataset.placeLat),lng=Number(b.dataset.placeLng),areaId=b.dataset.placeArea;if(!Number.isFinite(lat)||!Number.isFinite(lng)){notify('هذه المنطقة تحتاج إحداثيات من لوحة الإدارة. حدد موقعها على الخريطة.');return}window.setBookingPoint?.(mode,lat,lng);$(mode==='pickup'?'pickupAddress':'destinationAddress').value=name;if(areaId)$(mode==='pickup'?'v2PickupArea':'v2DestinationArea').value=areaId;rememberPlace({name,lat,lng,areaId});closeV2('v2PlaceSheet')}
    function recentPlaces(){try{return JSON.parse(localStorage.getItem('jeebli_recent_places')||'[]').slice(0,5)}catch{return[]}}
    function rememberPlace(p){if(!p?.name||!Number.isFinite(Number(p.lat)))return;const list=recentPlaces().filter(x=>x.name!==p.name);list.unshift(p);localStorage.setItem('jeebli_recent_places',JSON.stringify(list.slice(0,5)))}
    function debounce(fn,ms){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms)}}

    function patchRequestSheet(){
      const originalOpen=window.openRequestSheet;if(originalOpen)window.openRequestSheet=async function(id){state.openRideId=id;const out=await originalOpen(id);await enhanceRequest(id);return out};
    }
    async function enhanceRequest(id){
      const {data:r}=await db.from('ride_requests').select('*').eq('id',id).maybeSingle();if(!r)return;state.openRideId=id;
      let host=$('requestStatusCard');if(!host)return;let panel=$('v2RequestExtras');if(!panel){panel=document.createElement('div');panel.id='v2RequestExtras';host.insertAdjacentElement('afterend',panel)}
      const {data:events}=await db.from('ride_events').select('event_type,title,created_at').eq('ride_request_id',id).order('created_at',{ascending:true});const {data:rating}=await db.from('ratings').select('id,stars').eq('ride_request_id',id).eq('rater_id',(await getUser())?.id||'').maybeSingle();
      panel.innerHTML=`<div class="v2-inline-actions">${r.selected_driver_id?'<button id="v2OpenChat" class="v2-pill-btn">محادثة السائق</button><button id="v2OpenSafety" class="v2-pill-btn dark">الأمان</button>':''}<button id="v2OpenReceipt" class="v2-pill-btn gold">الإيصال</button>${r.status==='completed'&&r.selected_driver_id&&!rating?'<button id="v2RateDriver" class="v2-pill-btn">تقييم السائق</button>':rating?`<span class="v2-area-badge">تقييمك ${rating.stars}/5 ★</span>`:''}</div>${events?.length?`<div class="v2-timeline"><h4>مسار الطلب</h4>${events.map(e=>`<div class="v2-event"><strong>${esc(e.title)}</strong><small>${fmt(e.created_at)}</small></div>`).join('')}</div>`:''}`;
      $('v2OpenChat')&&($('v2OpenChat').onclick=()=>openChat(id));$('v2OpenSafety')&&($('v2OpenSafety').onclick=()=>openSafety(id));$('v2OpenReceipt')&&($('v2OpenReceipt').onclick=()=>openReceipt(r));$('v2RateDriver')&&($('v2RateDriver').onclick=()=>openRating());subscribeRideExtras(id);
    }
    function subscribeRideExtras(id){if(state.chatChannel)db.removeChannel(state.chatChannel);if(state.eventChannel)db.removeChannel(state.eventChannel);state.chatChannel=db.channel(`customer-v2-chat-${id}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'ride_messages',filter:`ride_request_id=eq.${id}`},()=>{if(!$('v2ChatSheet').classList.contains('hidden'))loadChat(id)}).subscribe();state.eventChannel=db.channel(`customer-v2-events-${id}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'ride_events',filter:`ride_request_id=eq.${id}`},()=>enhanceRequest(id)).subscribe()}

    async function openChat(id){state.openRideId=id;await loadChat(id);openV2('v2ChatSheet')}
    async function loadChat(id){const u=await getUser();const {data}=await db.from('ride_messages').select('id,sender_id,body,created_at').eq('ride_request_id',id).order('created_at',{ascending:true}).limit(100);$('v2ChatList').innerHTML=data?.length?data.map(m=>`<div class="v2-msg ${m.sender_id===u?.id?'mine':''}">${esc(m.body)}<time>${fmt(m.created_at)}</time></div>`).join(''):'<div class="v2-empty">ابدأ المحادثة عند الحاجة.</div>';$('v2ChatList').scrollTop=$('v2ChatList').scrollHeight}
    async function sendChat(e){e.preventDefault();const u=await getUser(),body=$('v2ChatInput').value.trim();if(!u||!state.openRideId||!body)return;const {error}=await db.from('ride_messages').insert({ride_request_id:state.openRideId,sender_id:u.id,body});if(error)return notify('تعذر إرسال الرسالة');$('v2ChatInput').value='';loadChat(state.openRideId)}

    async function openSafety(id){state.openRideId=id;await loadContacts();openV2('v2SafetySheet')}
    async function loadContacts(){const u=await getUser();if(!u)return;const {data}=await db.from('trusted_contacts').select('*').eq('user_id',u.id).order('created_at');$('v2Contacts').innerHTML=data?.length?data.map(c=>`<div class="v2-contact"><div><strong>${esc(c.name)}</strong><small>${esc(c.phone)}</small></div><button class="v2-pill-btn danger" data-contact-delete="${c.id}">حذف</button></div>`).join(''):'<div class="v2-empty">ما أضفت جهة اتصال موثوقة بعد.</div>';$$('[data-contact-delete]').forEach(b=>b.onclick=async()=>{await db.from('trusted_contacts').delete().eq('id',b.dataset.contactDelete);loadContacts()})}
    async function addContact(){const u=await getUser(),name=$('v2ContactName').value.trim(),phone=$('v2ContactPhone').value.trim();if(!u||!name||!phone)return notify('أدخل الاسم ورقم الهاتف');const {error}=await db.from('trusted_contacts').insert({user_id:u.id,name,phone});if(error)return notify(`تعذر الإضافة: ${error.message}`);$('v2ContactName').value='';$('v2ContactPhone').value='';loadContacts();notify('تمت إضافة جهة الاتصال')}
    async function shareRide(){if(!state.openRideId)return;const {data:r}=await db.from('ride_requests').select('id,status,pickup_address,destination_address,agreed_fare,selected_driver_id').eq('id',state.openRideId).maybeSingle();if(!r)return;let driver='سائق جيبلي';if(r.selected_driver_id){const {data:d}=await db.from('drivers').select('display_name,vehicle_make,vehicle_model,vehicle_color,plate_number').eq('id',r.selected_driver_id).maybeSingle();if(d)driver=`${d.display_name||'سائق جيبلي'} - ${[d.vehicle_make,d.vehicle_model,d.vehicle_color].filter(Boolean).join(' ')} - لوحة ${d.plate_number||'—'}`}
      const text=`رحلة جيبلي #${r.id.slice(0,8).toUpperCase()}\nالسائق: ${driver}\nمن: ${r.pickup_address}\nإلى: ${r.destination_address||'—'}\nالسعر المتفق: ${r.agreed_fare?money(r.agreed_fare):'حسب الاتفاق'}`;try{if(navigator.share)await navigator.share({title:'رحلتي عبر جيبلي',text});else{await navigator.clipboard.writeText(text);notify('تم نسخ تفاصيل الرحلة')}}catch{}
    }

    function openRating(){state.rating=5;state.tags.clear();setRating(5);$$('.v2-tag').forEach(x=>x.classList.remove('active'));$('v2RatingComment').value='';openV2('v2RatingSheet')}
    function setRating(n){state.rating=n;$$('.v2-star').forEach(b=>b.classList.toggle('active',Number(b.dataset.star)<=n))}
    async function submitRating(){const u=await getUser();if(!u||!state.openRideId)return;const {data:r}=await db.from('ride_requests').select('selected_driver_id,status').eq('id',state.openRideId).maybeSingle();if(!r?.selected_driver_id||r.status!=='completed')return notify('التقييم متاح بعد اكتمال الرحلة');const {error}=await db.from('ratings').insert({ride_request_id:state.openRideId,rater_id:u.id,rated_user_id:r.selected_driver_id,stars:state.rating,tags:[...state.tags],comment:$('v2RatingComment').value.trim()||null});if(error)return notify(error.code==='23505'?'تم تقييم هذه الرحلة مسبقاً':`تعذر إرسال التقييم: ${error.message}`);closeV2('v2RatingSheet');notify('شكراً لتقييمك');enhanceRequest(state.openRideId)}

    async function openReceipt(r){let driver='—';if(r.selected_driver_id){const {data:d}=await db.from('drivers').select('display_name,vehicle_make,vehicle_model,plate_number').eq('id',r.selected_driver_id).maybeSingle();if(d)driver=`${d.display_name||'سائق جيبلي'} · ${[d.vehicle_make,d.vehicle_model].filter(Boolean).join(' ')} · ${d.plate_number||'—'}`}$('v2Receipt').innerHTML=`<div class="v2-receipt"><div class="v2-receipt-row"><small>رقم الطلب</small><strong>#${r.id.slice(0,8).toUpperCase()}</strong></div><div class="v2-receipt-row"><small>من</small><strong>${esc(r.pickup_address)}</strong></div><div class="v2-receipt-row"><small>إلى</small><strong>${esc(r.destination_address||'—')}</strong></div><div class="v2-receipt-row"><small>السائق</small><strong>${esc(driver)}</strong></div><div class="v2-receipt-row"><small>الدفع</small><strong>نقداً عند الوصول</strong></div><div class="v2-receipt-row"><small>السعر المتفق عليه</small><strong class="v2-receipt-total">${r.agreed_fare?money(r.agreed_fare):'حسب الاتفاق'}</strong></div>${r.cod_enabled?`<div class="v2-receipt-row"><small>مبلغ التحصيل COD</small><strong>${money(r.cod_amount)}</strong></div>`:''}<div class="v2-receipt-row"><small>الحالة</small><strong>${esc(r.status)}</strong></div></div>`;openV2('v2ReceiptSheet')}

    async function resetPasswordEmail(){const email=$('loginEmail')?.value.trim();if(!email)return notify('اكتب بريدك الإلكتروني أولاً');const redirectTo=location.origin+location.pathname+'?recovery=1';const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo});if(error)return notify(`تعذر إرسال رابط الاستعادة: ${error.message}`);notify('تم إرسال رابط استعادة كلمة المرور إلى بريدك')}
    async function changePassword(){const p=$('v2NewPassword').value,c=$('v2ConfirmPassword').value;if(p.length<8)return notify('كلمة المرور يجب أن تكون 8 أحرف أو أكثر');if(p!==c)return notify('كلمتا المرور غير متطابقتين');const {error}=await db.auth.updateUser({password:p});if(error)return notify(`تعذر تغيير كلمة المرور: ${error.message}`);$('v2NewPassword').value=$('v2ConfirmPassword').value='';closeV2('v2PasswordSheet');notify('تم تغيير كلمة المرور')}

    function bindGlobal(){
      db.auth.onAuthStateChange(async(event,session)=>{if(event==='PASSWORD_RECOVERY')setTimeout(()=>openV2('v2PasswordSheet'),50);if(session?.user){setTimeout(refreshProfileArea,150)}});
      if(new URLSearchParams(location.search).get('recovery')==='1')setTimeout(()=>openV2('v2PasswordSheet'),700);
      document.addEventListener('click',e=>{const s=e.target.closest('.v2-sheet');if(s&&e.target===s)closeV2(s.id)});
    }
  }
})();
