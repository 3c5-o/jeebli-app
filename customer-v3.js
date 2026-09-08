(()=>{
  if(/(?:admin|driver)\.html$/i.test(location.pathname))return;
  const ready=fn=>document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn,{once:true}):fn();
  ready(init);

  async function init(){
    if(!window.supabase||!window.JEEBLI_CONFIG)return;
    if(!document.querySelector('link[href="./customer-v3.css"]')){const l=document.createElement('link');l.rel='stylesheet';l.href='./customer-v3.css';document.head.appendChild(l)}
    const db=window.supabase.createClient(window.JEEBLI_CONFIG.SUPABASE_URL,window.JEEBLI_CONFIG.SUPABASE_KEY);
    const $=id=>document.getElementById(id), $$=(sel,root=document)=>[...root.querySelectorAll(sel)];
    const activeStatuses=['requested','searching','offers_received','negotiating','driver_selected','driver_on_way','driver_arrived','in_progress'];
    const liveStatuses=['driver_selected','driver_on_way','driver_arrived','in_progress'];
    const statusText={driver_selected:['تم اختيار السائق','السعر والسائق مثبتان داخل جيبلي.'],driver_on_way:['السائق في الطريق','السائق متجه الآن إلى موقع الانطلاق.'],driver_arrived:['السائق وصل','السائق بانتظارك عند موقع الانطلاق.'],in_progress:['الرحلة جارية','أنت الآن في الطريق إلى وجهتك.'],completed:['وصلت إلى وجهتك','اكتملت الرحلة ويمكنك تقييم السائق.'],cancelled:['تم إلغاء الطلب','هذا الطلب ملغى.']};
    const state={user:null,ride:null,driver:null,offer:null,location:null,map:null,driverMarker:null,pickupMarker:null,destMarker:null,routeLine:null,userRideChannel:null,liveChannels:[],refreshTimer:null,savedMode:'destination',rating:5,ratingTags:new Set(),ratingExists:false};
    const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
    const money=v=>Number(v||0).toLocaleString('ar-IQ')+' د.ع';
    const fmt=iso=>{if(!iso)return'—';try{return new Intl.DateTimeFormat('ar-IQ',{dateStyle:'medium',timeStyle:'short'}).format(new Date(iso))}catch{return'—'}};
    const notify=msg=>window.notify?window.notify(msg):console.log(msg);
    const initial=name=>(String(name||'ج').trim()[0]||'ج').toUpperCase();

    injectLiveUI();
    observeExistingUI();
    bindStatic();

    const {data:{session}}=await db.auth.getSession();
    if(session?.user)await startForUser(session.user);
    db.auth.onAuthStateChange(async(_event,s)=>{if(s?.user){if(state.user?.id!==s.user.id)await startForUser(s.user)}else stopForUser()});

    async function startForUser(user){
      state.user=user;
      await syncActiveRide();
      subscribeUserRide();
      await loadSavedPlaces();
      enhanceHistory();
    }
    function stopForUser(){
      state.user=null;state.ride=null;hideLauncher();closeLive();
      if(state.userRideChannel){db.removeChannel(state.userRideChannel);state.userRideChannel=null}
    }

    function injectLiveUI(){
      if($('v3LiveRide'))return;
      document.body.insertAdjacentHTML('beforeend',`
        <button id="v3LiveLauncher" class="v3-live-launcher hidden" type="button">
          <span class="v3-live-launcher-copy"><span class="v3-live-pulse"></span><span><strong id="v3LauncherTitle">تابع سائقك مباشرة</strong><small id="v3LauncherSub">افتح شاشة الرحلة الحية</small></span></span>
          <span class="v3-live-open">فتح</span>
        </button>
        <section id="v3LiveRide" class="v3-live hidden" aria-hidden="true">
          <header class="v3-live-top">
            <button id="v3CloseLive" class="v3-icon-btn" type="button" aria-label="إغلاق"><i data-lucide="chevron-down"></i></button>
            <div class="v3-live-title"><small>رحلة جيبلي المباشرة</small><h2 id="v3LiveTitle">متابعة الرحلة</h2></div>
            <button id="v3RefreshLive" class="v3-icon-btn" type="button" aria-label="تحديث"><i data-lucide="refresh-cw"></i></button>
          </header>
          <div class="v3-map-wrap">
            <div id="v3LiveMap" class="v3-live-map"></div>
            <div class="v3-map-badges"><span id="v3MapState" class="v3-map-badge">جاري تحديد السائق...</span><span id="v3MapFresh" class="v3-map-badge">Live</span></div>
          </div>
          <main class="v3-live-body">
            <div class="v3-grabber"></div>
            <section id="v3StatusCard" class="v3-status-card"></section>
            <section id="v3DriverCard" class="v3-driver-card"></section>
            <section id="v3LiveActions" class="v3-actions"></section>
            <section id="v3RouteCard" class="v3-route-card"></section>
            <section id="v3ChatCard" class="v3-chat-card"></section>
            <section id="v3CompleteCard"></section>
          </main>
        </section>`);
      window.lucide?.createIcons();
    }

    function bindStatic(){
      $('v3LiveLauncher').onclick=()=>state.ride&&openLive(state.ride.id);
      $('v3CloseLive').onclick=closeLive;
      $('v3RefreshLive').onclick=()=>refreshLive(true);
    }

    function subscribeUserRide(){
      if(!state.user)return;
      if(state.userRideChannel)db.removeChannel(state.userRideChannel);
      state.userRideChannel=db.channel(`customer-v3-rides-${state.user.id}`)
        .on('postgres_changes',{event:'*',schema:'public',table:'ride_requests',filter:`customer_id=eq.${state.user.id}`},async payload=>{
          const id=payload.new?.id||payload.old?.id;
          await syncActiveRide();
          if(!$('v3LiveRide').classList.contains('hidden')&&id===state.ride?.id)await refreshLive();
          enhanceHistory();
        }).subscribe();
    }

    async function syncActiveRide(){
      if(!state.user)return;
      const {data}=await db.from('ride_requests').select('*').eq('customer_id',state.user.id).in('status',activeStatuses).order('created_at',{ascending:false}).limit(1).maybeSingle();
      state.ride=data||null;
      if(state.ride&&liveStatuses.includes(state.ride.status)&&state.ride.selected_driver_id)showLauncher();else hideLauncher();
      enhanceSelectedDriver();
    }
    function showLauncher(){
      const el=$('v3LiveLauncher');if(!el||!state.ride)return;
      const tx=statusText[state.ride.status]||['تابع طلبك','افتح شاشة الرحلة الحية'];$('v3LauncherTitle').textContent=tx[0];$('v3LauncherSub').textContent=state.ride.agreed_fare?`${money(state.ride.agreed_fare)} · ${tx[1]}`:tx[1];el.classList.remove('hidden');
    }
    function hideLauncher(){$('v3LiveLauncher')?.classList.add('hidden')}

    function observeExistingUI(){
      const watch=(id,fn)=>{const el=$(id);if(!el)return;new MutationObserver(()=>fn()).observe(el,{childList:true,subtree:true});fn()};
      watch('selectedDriverSection',enhanceSelectedDriver);
      watch('requestsList',()=>{enhanceHistory();});
      const booking=$('bookingStep2');if(booking)new MutationObserver(()=>injectSavedPlaces()).observe(booking,{childList:true,subtree:true});
      injectSavedPlaces();
    }
    function enhanceSelectedDriver(){
      const host=$('selectedDriverSection');if(!host||!state.ride||!liveStatuses.includes(state.ride.status)||!state.ride.selected_driver_id)return;
      if(host.querySelector('.v3-inline-live-btn'))return;
      const b=document.createElement('button');b.type='button';b.className='v3-inline-live-btn';b.innerHTML='فتح التتبع المباشر للسائق';b.onclick=()=>openLive(state.ride.id);host.appendChild(b);
    }

    async function openLive(rideId){
      if(!state.user)return;
      const {data,error}=await db.from('ride_requests').select('*').eq('id',rideId).eq('customer_id',state.user.id).maybeSingle();
      if(error||!data)return notify('تعذر فتح الرحلة');
      state.ride=data;$('v3LiveRide').classList.remove('hidden');$('v3LiveRide').setAttribute('aria-hidden','false');document.body.style.overflow='hidden';
      initMap();await refreshLive(true);subscribeLive();state.refreshTimer=setInterval(()=>refreshLive(false),25000);
    }
    function closeLive(){
      $('v3LiveRide')?.classList.add('hidden');$('v3LiveRide')?.setAttribute('aria-hidden','true');document.body.style.overflow='';
      state.liveChannels.forEach(ch=>db.removeChannel(ch));state.liveChannels=[];if(state.refreshTimer){clearInterval(state.refreshTimer);state.refreshTimer=null}
    }

    async function refreshLive(userInitiated=false){
      if(!state.user||!state.ride?.id)return;
      if(userInitiated){const btn=$('v3RefreshLive');if(btn)btn.style.opacity='.5'}
      const {data:r}=await db.from('ride_requests').select('*').eq('id',state.ride.id).eq('customer_id',state.user.id).maybeSingle();
      if(r)state.ride=r;
      await Promise.all([loadDriver(),loadOffer(),loadDriverLocation(),loadMessages(),loadRatingState()]);
      renderAll();
      if(userInitiated){const btn=$('v3RefreshLive');if(btn)btn.style.opacity='1';notify('تم تحديث الرحلة')}
    }
    async function loadDriver(){
      if(!state.ride?.selected_driver_id){state.driver=null;return}
      const {data}=await db.from('drivers').select('id,display_name,avatar_url,rating,total_rides,vehicle_make,vehicle_model,vehicle_color,plate_number,last_lat,last_lng,last_location_at').eq('id',state.ride.selected_driver_id).maybeSingle();state.driver=data||null;
    }
    async function loadOffer(){
      if(!state.ride?.accepted_offer_id){state.offer=null;return}
      const {data}=await db.from('driver_offers').select('id,offered_fare,eta_minutes,note').eq('id',state.ride.accepted_offer_id).maybeSingle();state.offer=data||null;
    }
    async function loadDriverLocation(){
      if(!state.ride?.selected_driver_id||state.ride.status==='completed'){state.location=null;return}
      const {data}=await db.from('driver_locations').select('driver_id,lat,lng,heading,speed_kmh,updated_at').eq('driver_id',state.ride.selected_driver_id).maybeSingle();state.location=data||null;
    }
    async function loadRatingState(){
      if(!state.user||!state.ride?.id){state.ratingExists=false;return}
      const {data}=await db.from('ratings').select('id,stars').eq('ride_request_id',state.ride.id).eq('rater_id',state.user.id).maybeSingle();state.ratingExists=!!data;
    }

    function subscribeLive(){
      state.liveChannels.forEach(ch=>db.removeChannel(ch));state.liveChannels=[];if(!state.ride)return;
      const rid=state.ride.id;
      const rideCh=db.channel(`v3-live-ride-${rid}`).on('postgres_changes',{event:'UPDATE',schema:'public',table:'ride_requests',filter:`id=eq.${rid}`},async()=>refreshLive(false)).subscribe();state.liveChannels.push(rideCh);
      if(state.ride.selected_driver_id){const did=state.ride.selected_driver_id;const locCh=db.channel(`v3-live-loc-${did}`).on('postgres_changes',{event:'*',schema:'public',table:'driver_locations',filter:`driver_id=eq.${did}`},async payload=>{if(payload.new){state.location=payload.new;renderMap();renderStatus()}else await loadDriverLocation()}).subscribe();state.liveChannels.push(locCh)}
      const msgCh=db.channel(`v3-live-msg-${rid}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'ride_messages',filter:`ride_request_id=eq.${rid}`},async()=>{await loadMessages();renderChat()}).subscribe();state.liveChannels.push(msgCh);
    }

    function renderAll(){
      if(!state.ride)return;
      const tx=statusText[state.ride.status]||[state.ride.status,'تابع حالة طلبك'];$('v3LiveTitle').textContent=tx[0];
      renderStatus();renderDriver();renderActions();renderRoute();renderChat();renderComplete();renderMap();window.lucide?.createIcons();
    }
    function renderStatus(){
      if(!state.ride)return;const r=state.ride,tx=statusText[r.status]||[r.status,'تابع حالة طلبك'];const eta=etaInfo();
      const phase={driver_selected:1,driver_on_way:1,driver_arrived:2,in_progress:3,completed:4}[r.status]||0;
      $('v3StatusCard').innerHTML=`<div class="v3-status-head"><div><h3>${esc(tx[0])}</h3><p>${esc(tx[1])}</p></div><div class="v3-eta"><strong>${esc(eta.main)}</strong><small>${esc(eta.sub)}</small></div></div><div class="v3-progress">${[1,2,3,4].map(n=>`<span class="${n<=phase?'on':''}"></span>`).join('')}</div>`;
      const fresh=freshness();$('v3MapFresh').textContent=fresh.text;$('v3MapFresh').classList.toggle('stale',fresh.stale);$('v3MapState').textContent=mapStateText();
    }
    function etaInfo(){
      const r=state.ride;if(!r)return{main:'—',sub:''};if(r.status==='driver_arrived')return{main:'وصل',sub:'بانتظارك'};if(r.status==='completed')return{main:'تم',sub:'الرحلة مكتملة'};
      const loc=state.location;if(loc&&Number.isFinite(Number(loc.lat))&&Number.isFinite(Number(loc.lng))){const target=r.status==='in_progress'?[r.destination_lat,r.destination_lng]:[r.pickup_lat,r.pickup_lng];const km=haversine(Number(loc.lat),Number(loc.lng),Number(target[0]),Number(target[1]));if(Number.isFinite(km)){const rawSpeed=Number(loc.speed_kmh),speed=rawSpeed>=8&&rawSpeed<=90?rawSpeed:28;const min=Math.max(1,Math.ceil((km/speed)*60*1.2));return{main:`≈ ${min} د`,sub:'وقت تقريبي'}}}
      if(r.status!=='in_progress'&&state.offer?.eta_minutes)return{main:`≈ ${state.offer.eta_minutes} د`,sub:'حسب عرض السائق'};return{main:'Live',sub:'جاري التحديث'};
    }
    function freshness(){
      const t=state.location?.updated_at||state.driver?.last_location_at;if(!t)return{text:'لا يوجد GPS',stale:true};const sec=(Date.now()-new Date(t).getTime())/1000;if(sec>180)return{text:'موقع قديم',stale:true};if(sec>75)return{text:'آخر تحديث '+Math.round(sec/60)+' د',stale:false};return{text:'مباشر الآن',stale:false};
    }
    function mapStateText(){const r=state.ride;if(!r)return'';if(r.status==='in_progress')return'إلى الوجهة';if(r.status==='driver_arrived')return'السائق عندك';if(['driver_selected','driver_on_way'].includes(r.status))return'السائق متجه إليك';if(r.status==='completed')return'تم الوصول';return'متابعة الرحلة'}

    function renderDriver(){
      const d=state.driver,r=state.ride;if(!r)return;const name=d?.display_name||'سائق جيبلي';
      $('v3DriverCard').innerHTML=`<div class="v3-driver-main"><div class="v3-avatar">${esc(initial(name))}</div><div class="v3-driver-copy"><h3>${esc(name)}</h3><p>⭐ ${Number(d?.rating||5).toFixed(1)} · ${Number(d?.total_rides||0).toLocaleString('ar-IQ')} رحلة</p></div><div class="v3-fare"><strong>${r.agreed_fare?money(r.agreed_fare):'حسب الاتفاق'}</strong><small>السعر المثبت</small></div></div><div class="v3-driver-meta"><div><small>السيارة</small><strong>${esc([d?.vehicle_make,d?.vehicle_model].filter(Boolean).join(' ')||'—')}</strong></div><div><small>اللون</small><strong>${esc(d?.vehicle_color||'—')}</strong></div><div><small>اللوحة</small><strong>${esc(d?.plate_number||'—')}</strong></div></div>`;
    }
    function renderActions(){
      const disabled=!state.ride?.selected_driver_id;$('v3LiveActions').innerHTML=`<button id="v3FocusDriver" class="v3-action dark" type="button"><i data-lucide="locate-fixed"></i><span>موقع السائق</span></button><button id="v3Share" class="v3-action gold" type="button"><i data-lucide="share-2"></i><span>مشاركة</span></button><button id="v3Safety" class="v3-action" type="button"><i data-lucide="shield-check"></i><span>الأمان</span></button>`;
      $('v3FocusDriver').disabled=disabled;$('v3FocusDriver').onclick=focusDriver;$('v3Share').onclick=shareRide;$('v3Safety').onclick=openSafety;
    }
    function renderRoute(){
      const r=state.ride;if(!r)return;const target=r.status==='in_progress'?'الوجهة':'موقع الانطلاق';let km=null;if(state.location)km=haversine(Number(state.location.lat),Number(state.location.lng),Number(r.status==='in_progress'?r.destination_lat:r.pickup_lat),Number(r.status==='in_progress'?r.destination_lng:r.pickup_lng));
      $('v3RouteCard').innerHTML=`<div class="v3-route-row"><span class="v3-route-dot"></span><div><small>من</small><strong>${esc(r.pickup_address||'—')}</strong></div></div><div class="v3-route-row to"><span class="v3-route-dot"></span><div><small>إلى</small><strong>${esc(r.destination_address||'—')}</strong></div></div><div class="v3-distance-line"><span>الهدف الحالي: ${target}</span><strong>${Number.isFinite(km)?`${km.toLocaleString('ar-IQ',{maximumFractionDigits:1})} كم تقريباً`:r.route_distance_km?`${Number(r.route_distance_km).toLocaleString('ar-IQ',{maximumFractionDigits:1})} كم`:'—'}</strong></div>`;
    }

    let liveMessages=[];
    async function loadMessages(){
      if(!state.ride)return;const {data}=await db.from('ride_messages').select('id,sender_id,body,created_at').eq('ride_request_id',state.ride.id).order('created_at',{ascending:false}).limit(20);liveMessages=(data||[]).reverse();
    }
    function renderChat(){
      const canChat=!!state.ride?.selected_driver_id&&state.ride?.status!=='completed';
      $('v3ChatCard').innerHTML=`<div class="v3-section-title"><h4>محادثة السائق</h4><small>${canChat?'داخل جيبلي فقط':'الرحلة منتهية'}</small></div>${canChat?`<div class="v3-quick">${['أنا بالموقع','وين وصلت؟','اتصل عند الوصول'].map(t=>`<button type="button" data-v3-quick="${esc(t)}">${esc(t)}</button>`).join('')}</div>`:''}<div id="v3ChatPreview" class="v3-chat-preview">${liveMessages.length?liveMessages.slice(-6).map(m=>`<div class="v3-mini-msg ${m.sender_id===state.user?.id?'mine':''}">${esc(m.body)}<time>${fmtShort(m.created_at)}</time></div>`).join(''):'<div class="v3-empty-chat">ماكو رسائل بعد.</div>'}</div>${canChat?'<form id="v3ChatCompose" class="v3-chat-compose"><input id="v3ChatInput" maxlength="500" placeholder="اكتب رسالة" required /><button>إرسال</button></form>':''}`;
      $$('[data-v3-quick]',$('v3ChatCard')).forEach(b=>b.onclick=()=>sendMessage(b.dataset.v3Quick));const f=$('v3ChatCompose');if(f)f.onsubmit=e=>{e.preventDefault();const input=$('v3ChatInput'),body=input.value.trim();if(body){sendMessage(body);input.value=''}};
      const list=$('v3ChatPreview');if(list)list.scrollTop=list.scrollHeight;
    }
    async function sendMessage(body){
      if(!state.user||!state.ride||!body)return;const {error}=await db.from('ride_messages').insert({ride_request_id:state.ride.id,sender_id:state.user.id,body:String(body).slice(0,500)});if(error)return notify('تعذر إرسال الرسالة');await loadMessages();renderChat();
    }
    function fmtShort(iso){try{return new Intl.DateTimeFormat('ar-IQ',{hour:'2-digit',minute:'2-digit'}).format(new Date(iso))}catch{return''}}

    function renderComplete(){
      const box=$('v3CompleteCard');if(!state.ride||state.ride.status!=='completed'){box.innerHTML='';return}
      box.innerHTML=`<section class="v3-complete"><h3>اكتملت الرحلة 🎉</h3><p>السعر المتفق عليه داخل جيبلي هو ${state.ride.agreed_fare?money(state.ride.agreed_fare):'حسب الاتفاق'}. الدفع المسجل: ${state.ride.payment_method==='cash'?'نقداً':'حسب الطلب'}.</p><div class="v3-actions"><button id="v3ToggleReceipt" class="v3-action">الإيصال</button>${state.ratingExists?'<button class="v3-action" disabled>تم التقييم ✓</button>':'<button id="v3ShowRating" class="v3-action">تقييم السائق</button>'}</div><div id="v3ReceiptArea"></div><div id="v3RatingArea"></div></section>`;
      $('v3ToggleReceipt').onclick=toggleReceipt;if($('v3ShowRating'))$('v3ShowRating').onclick=showRatingBox;
    }
    function toggleReceipt(){const host=$('v3ReceiptArea');if(!host)return;if(host.innerHTML){host.innerHTML='';return}const r=state.ride,d=state.driver;host.innerHTML=`<div class="v3-receipt-box"><div class="v3-receipt-row"><span>رقم الطلب</span><strong>#${r.id.slice(0,8).toUpperCase()}</strong></div><div class="v3-receipt-row"><span>السائق</span><strong>${esc(d?.display_name||'سائق جيبلي')}</strong></div><div class="v3-receipt-row"><span>من</span><strong>${esc(r.pickup_address||'—')}</strong></div><div class="v3-receipt-row"><span>إلى</span><strong>${esc(r.destination_address||'—')}</strong></div><div class="v3-receipt-row"><span>السعر</span><strong>${r.agreed_fare?money(r.agreed_fare):'حسب الاتفاق'}</strong></div>${r.cod_enabled?`<div class="v3-receipt-row"><span>تحصيل COD</span><strong>${money(r.cod_amount)}</strong></div>`:''}<div class="v3-receipt-row"><span>التاريخ</span><strong>${fmt(r.completed_at||r.updated_at)}</strong></div></div>`}
    function showRatingBox(){
      state.rating=5;state.ratingTags.clear();const host=$('v3RatingArea');host.innerHTML=`<div class="v3-rating-box"><div class="v3-stars">${[1,2,3,4,5].map(n=>`<button type="button" class="on" data-v3-star="${n}">★</button>`).join('')}</div><div class="v3-rating-tags">${['تعامل ممتاز','قيادة جيدة','وصل بسرعة','سيارة نظيفة'].map(t=>`<button type="button" data-v3-tag="${t}">${t}</button>`).join('')}</div><textarea id="v3RatingComment" rows="3" placeholder="ملاحظة اختيارية"></textarea><button id="v3SubmitRating" class="v3-submit-rating" type="button">إرسال التقييم</button></div>`;$$('[data-v3-star]',host).forEach(b=>b.onclick=()=>setStars(Number(b.dataset.v3Star)));$$('[data-v3-tag]',host).forEach(b=>b.onclick=()=>{const t=b.dataset.v3Tag;state.ratingTags.has(t)?state.ratingTags.delete(t):state.ratingTags.add(t);b.classList.toggle('on',state.ratingTags.has(t))});$('v3SubmitRating').onclick=submitRating;
    }
    function setStars(n){state.rating=n;$$('[data-v3-star]',$('v3RatingArea')).forEach(b=>b.classList.toggle('on',Number(b.dataset.v3Star)<=n))}
    async function submitRating(){
      if(!state.user||!state.ride?.selected_driver_id)return;const {error}=await db.from('ratings').insert({ride_request_id:state.ride.id,rater_id:state.user.id,rated_user_id:state.ride.selected_driver_id,stars:state.rating,tags:[...state.ratingTags],comment:$('v3RatingComment')?.value.trim()||null});if(error)return notify(error.code==='23505'?'تم تقييم هذه الرحلة مسبقاً':'تعذر إرسال التقييم');state.ratingExists=true;notify('شكراً على تقييمك');renderComplete();
    }

    function initMap(){
      if(state.map||!window.L)return;state.map=L.map('v3LiveMap',{zoomControl:false,attributionControl:true}).setView([35.47,43.25],13);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(state.map);setTimeout(()=>state.map.invalidateSize(),100);
    }
    function renderMap(){
      if(!state.map||!state.ride)return;const r=state.ride;clearMapObjects();const points=[];
      if(validLatLng(r.pickup_lat,r.pickup_lng)){state.pickupMarker=L.circleMarker([r.pickup_lat,r.pickup_lng],{radius:7,weight:3,color:'#fff',fillColor:'#2485f2',fillOpacity:1}).addTo(state.map).bindTooltip('الانطلاق',{permanent:false,className:'v3-marker-label'});points.push([r.pickup_lat,r.pickup_lng])}
      if(validLatLng(r.destination_lat,r.destination_lng)){state.destMarker=L.circleMarker([r.destination_lat,r.destination_lng],{radius:7,weight:3,color:'#fff',fillColor:'#11a778',fillOpacity:1}).addTo(state.map).bindTooltip('الوجهة',{permanent:false,className:'v3-marker-label'});points.push([r.destination_lat,r.destination_lng])}
      if(validLatLng(r.pickup_lat,r.pickup_lng)&&validLatLng(r.destination_lat,r.destination_lng))state.routeLine=L.polyline([[r.pickup_lat,r.pickup_lng],[r.destination_lat,r.destination_lng]],{color:'#317fce',weight:5,opacity:.42,dashArray:'8 8'}).addTo(state.map);
      const loc=state.location||((state.driver?.last_lat!=null&&state.driver?.last_lng!=null)?{lat:state.driver.last_lat,lng:state.driver.last_lng,heading:0}:null);if(loc&&validLatLng(loc.lat,loc.lng)){const heading=Number(loc.heading)||0;const icon=L.divIcon({className:'',iconSize:[42,42],iconAnchor:[21,21],html:`<div class="v3-car-pin" style="transform:rotate(${heading}deg)"><svg viewBox="0 0 24 24"><path d="M5 17h14l-1.2-7.2A2 2 0 0 0 15.8 8H8.2a2 2 0 0 0-2 1.8L5 17Z"/><path d="M7 17v2M17 17v2M7 13h10M8 11h.01M16 11h.01"/></svg></div>`});state.driverMarker=L.marker([Number(loc.lat),Number(loc.lng)],{icon}).addTo(state.map).bindTooltip('سائق جيبلي',{className:'v3-marker-label'});points.push([Number(loc.lat),Number(loc.lng)])}
      if(points.length>1)state.map.fitBounds(L.latLngBounds(points).pad(.24),{animate:true,maxZoom:16});else if(points.length===1)state.map.setView(points[0],15,{animate:true});
    }
    function clearMapObjects(){[state.driverMarker,state.pickupMarker,state.destMarker,state.routeLine].forEach(o=>{if(o&&state.map)state.map.removeLayer(o)});state.driverMarker=state.pickupMarker=state.destMarker=state.routeLine=null}
    function focusDriver(){if(!state.map)return;const loc=state.location;if(loc&&validLatLng(loc.lat,loc.lng))state.map.setView([Number(loc.lat),Number(loc.lng)],16,{animate:true});else notify('موقع السائق غير متاح حالياً')}
    function validLatLng(a,b){return Number.isFinite(Number(a))&&Number.isFinite(Number(b))}
    function haversine(lat1,lng1,lat2,lng2){if(![lat1,lng1,lat2,lng2].every(Number.isFinite))return null;const r=6371,toRad=d=>d*Math.PI/180,dLat=toRad(lat2-lat1),dLng=toRad(lng2-lng1),a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2;return r*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))}

    async function shareRide(){
      if(!state.ride)return;const r=state.ride,d=state.driver;const text=`رحلة جيبلي #${r.id.slice(0,8).toUpperCase()}\nالسائق: ${d?.display_name||'سائق جيبلي'}\nالسيارة: ${[d?.vehicle_make,d?.vehicle_model,d?.vehicle_color].filter(Boolean).join(' ')||'—'}\nاللوحة: ${d?.plate_number||'—'}\nمن: ${r.pickup_address||'—'}\nإلى: ${r.destination_address||'—'}\nالسعر المتفق: ${r.agreed_fare?money(r.agreed_fare):'حسب الاتفاق'}`;try{if(navigator.share)await navigator.share({title:'رحلتي عبر جيبلي',text});else{await navigator.clipboard.writeText(text);notify('تم نسخ تفاصيل الرحلة')}}catch{}
    }
    async function openSafety(){
      if(!state.user)return;const {data}=await db.from('trusted_contacts').select('name,phone').eq('user_id',state.user.id).order('created_at');const contacts=(data||[]).map(c=>`${c.name}: ${c.phone}`).join('\n');const msg=`مركز أمان جيبلي\n${contacts?`جهاتك الموثوقة:\n${contacts}`:'ما أضفت جهة اتصال موثوقة بعد.'}\n\nيمكنك مشاركة تفاصيل الرحلة من زر المشاركة.`;notify(msg);const old=$('v2SafetySheet');if(old){old.classList.remove('hidden');document.body.style.overflow='hidden'}}

    function injectSavedPlaces(){
      const step=$('bookingStep2');if(!step||$('v3SavedPlaces'))return;const anchor=step.querySelector('.customer-v2-card')||step.querySelector('.location-inputs');if(!anchor)return;const box=document.createElement('div');box.id='v3SavedPlaces';box.className='v3-saved-card';box.innerHTML=`<div class="v3-saved-head"><strong>عناويني المحفوظة</strong><div class="v3-saved-mode"><button type="button" class="on" data-v3-saved-mode="destination">للوجهة</button><button type="button" data-v3-saved-mode="pickup">للانطلاق</button></div></div><div id="v3SavedList" class="v3-saved-list"><div class="v3-empty-chat">جاري تحميل العناوين...</div></div>`;anchor.insertAdjacentElement('afterend',box);$$('[data-v3-saved-mode]',box).forEach(b=>b.onclick=()=>{state.savedMode=b.dataset.v3SavedMode;$$('[data-v3-saved-mode]',box).forEach(x=>x.classList.toggle('on',x===b))});loadSavedPlaces();
    }
    async function loadSavedPlaces(){
      if(!state.user){return}const list=$('v3SavedList');if(!list)return;const {data}=await db.from('saved_addresses').select('id,label,address,lat,lng,area_id').eq('user_id',state.user.id).order('created_at',{ascending:false}).limit(12);list.innerHTML=data?.length?data.map(a=>`<button type="button" class="v3-saved-place" data-v3-saved='${encodeURIComponent(JSON.stringify(a))}'><strong>${esc(a.label||'عنوان')}</strong><small>${esc(a.address||'')}</small></button>`).join(''):'<div class="v3-empty-chat">احفظ البيت أو العمل من حسابك حتى يظهر هنا.</div>';$$('[data-v3-saved]',list).forEach(b=>b.onclick=()=>useSaved(JSON.parse(decodeURIComponent(b.dataset.v3Saved))))
    }
    function useSaved(a){const mode=state.savedMode;if(!validLatLng(a.lat,a.lng))return notify('هذا العنوان يحتاج إحداثيات صحيحة');window.setBookingPoint?.(mode,Number(a.lat),Number(a.lng));const address=$(mode==='pickup'?'pickupAddress':'destinationAddress');if(address)address.value=a.address||a.label||'عنوان محفوظ';const area=$(mode==='pickup'?'v2PickupArea':'v2DestinationArea');if(area&&a.area_id)area.value=a.area_id;notify(mode==='pickup'?'تم اختيار موقع الانطلاق':'تم اختيار الوجهة')}

    let histTimer;
    function enhanceHistory(){clearTimeout(histTimer);histTimer=setTimeout(()=>{const list=$('requestsList');if(!list)return;$$('[data-open-request]',list).forEach(btn=>{const card=btn.closest('.request-card');if(!card||card.querySelector('.v3-repeat-btn'))return;const text=card.textContent||'';if(!/مكتملة|ملغاة/.test(text))return;const r=document.createElement('button');r.type='button';r.className='v3-repeat-btn';r.textContent='إعادة الطلب';r.onclick=e=>{e.stopPropagation();repeatRide(btn.dataset.openRequest)};btn.insertAdjacentElement('afterend',r)})},120)}
    async function repeatRide(id){
      const {data:r}=await db.from('ride_requests').select('*').eq('id',id).eq('customer_id',state.user.id).maybeSingle();if(!r)return notify('تعذر تحميل الطلب السابق');if(typeof window.openBooking!=='function')return notify('تعذر فتح الحجز حالياً');window.openBooking(r.service_type);setTimeout(()=>{if(validLatLng(r.pickup_lat,r.pickup_lng)){window.setBookingPoint?.('pickup',Number(r.pickup_lat),Number(r.pickup_lng));$('pickupAddress')&&($('pickupAddress').value=r.pickup_address||'موقع الانطلاق')}if(validLatLng(r.destination_lat,r.destination_lng)){window.setBookingPoint?.('destination',Number(r.destination_lat),Number(r.destination_lng));$('destinationAddress')&&($('destinationAddress').value=r.destination_address||'الوجهة')}if($('v2PickupArea')&&r.pickup_area_id)$('v2PickupArea').value=r.pickup_area_id;if($('v2DestinationArea')&&r.destination_area_id)$('v2DestinationArea').value=r.destination_area_id;if($('rideNotes'))$('rideNotes').value=r.notes||'';notify('تم تجهيز نفس الرحلة، راجع التفاصيل ثم أرسل الطلب')},220)}
  }
})();