(()=>{
  if(/(?:admin|driver)\.html$/i.test(location.pathname))return;
  const ready=fn=>document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn,{once:true}):fn();
  ready(init);

  async function init(){
    if(!window.supabase||!window.JEEBLI_CONFIG)return;
    if(!document.querySelector('link[href="./customer-polish.css"]')){const l=document.createElement('link');l.rel='stylesheet';l.href='./customer-polish.css';document.head.appendChild(l)}
    const db=window.supabase.createClient(window.JEEBLI_CONFIG.SUPABASE_URL,window.JEEBLI_CONFIG.SUPABASE_KEY);
    const $=id=>document.getElementById(id), $$=(s,r=document)=>[...r.querySelectorAll(s)];
    const notify=msg=>window.notify?window.notify(msg):console.log(msg);
    let user=null,cancelRide=null;

    const {data:{session}}=await db.auth.getSession();if(session?.user){user=session.user;await injectPreferences();enhanceHistory();injectSavedShortcuts()}
    db.auth.onAuthStateChange(async(_e,s)=>{user=s?.user||null;if(user){await injectPreferences();enhanceHistory();injectSavedShortcuts()}});
    injectCancelSheet();watchHistory();watchBooking();watchUpdates();interceptCancel();

    async function injectPreferences(){
      const profileForm=$('profileForm');if(!profileForm||$('jNotifPrefs'))return;
      const card=document.createElement('section');card.id='jNotifPrefs';card.className='j-polish-card';
      card.innerHTML=`<h3>إشعارات جيبلي</h3><p>اختر شنو تريد يصلك داخل التطبيق. إشعارات Push أثناء إغلاق التطبيق راح تتفعل مع نسخة APK.</p>
      ${prefRow('ride_updates','تحديثات الطلب','وصول السائق وتغيّر حالة الرحلة')}
      ${prefRow('driver_offers','عروض السائقين','عرض جديد أو رد على التفاوض')}
      ${prefRow('chat_messages','رسائل الرحلة','رسالة جديدة من السائق')}
      ${prefRow('support_updates','الدعم','تحديثات تذاكر الدعم')}
      ${prefRow('promotions','العروض','بنرات وخصومات جيبلي')}
      <div id="jNotifStatus" class="j-notif-status">جاري تحميل الإعدادات...</div>`;
      profileForm.insertAdjacentElement('afterend',card);
      const {data}=await db.from('notification_preferences').select('*').eq('user_id',user.id).maybeSingle();
      const prefs=data||{ride_updates:true,driver_offers:true,chat_messages:true,support_updates:true,promotions:true};
      Object.keys(prefs).forEach(k=>{const input=card.querySelector(`[data-pref="${k}"]`);if(input)input.checked=!!prefs[k]});
      $$('[data-pref]',card).forEach(i=>i.onchange=savePrefs);
      renderNotifPermission();
    }
    function prefRow(key,title,sub){return `<div class="j-pref-row"><div class="j-pref-copy"><strong>${title}</strong><small>${sub}</small></div><label class="j-switch"><input type="checkbox" data-pref="${key}" checked><span></span></label></div>`}
    async function savePrefs(){
      if(!user)return;const card=$('jNotifPrefs');const payload={user_id:user.id};$$('[data-pref]',card).forEach(i=>payload[i.dataset.pref]=i.checked);payload.updated_at=new Date().toISOString();
      const {error}=await db.from('notification_preferences').upsert(payload,{onConflict:'user_id'});if(error)return notify('تعذر حفظ تفضيلات الإشعارات');renderNotifPermission();notify('تم حفظ إعدادات الإشعارات')
    }
    function renderNotifPermission(){
      const el=$('jNotifStatus');if(!el)return;
      if(!('Notification'in window)){el.textContent='هذا المتصفح لا يدعم إشعارات النظام.';el.className='j-notif-status warn';return}
      if(Notification.permission==='granted'){el.textContent='إشعارات المتصفح مسموحة على هذا الجهاز.';el.className='j-notif-status ok'}
      else if(Notification.permission==='denied'){el.textContent='إشعارات المتصفح محظورة من إعدادات الجهاز/المتصفح.';el.className='j-notif-status warn'}
      else{el.textContent='تقدر تسمح بالإشعارات من زر الإشعارات الموجود بالتطبيق.';el.className='j-notif-status'}
    }

    function watchHistory(){const list=$('requestsList');if(!list)return;new MutationObserver(enhanceHistory).observe(list,{childList:true,subtree:true});}
    function enhanceHistory(){
      const list=$('requestsList');if(!list||!user)return;
      $$('[data-open-request]',list).forEach(open=>{const foot=open.closest('.request-card-foot');if(!foot||foot.querySelector('.j-rebook-btn'))return;const b=document.createElement('button');b.type='button';b.className='j-rebook-btn';b.textContent='إعادة الطلب';b.onclick=e=>{e.stopPropagation();rebook(open.dataset.openRequest)};foot.appendChild(b)});
    }
    async function rebook(id){
      if(!user)return;const {data:r,error}=await db.from('ride_requests').select('*').eq('id',id).eq('customer_id',user.id).maybeSingle();if(error||!r)return notify('تعذر تحميل الطلب السابق');
      if(typeof window.openBooking!=='function')return notify('الحجز غير جاهز حالياً');window.openBooking(r.service_type||'taxi');
      setTimeout(()=>{
        const set=(id,v)=>{const e=$(id);if(e&&v!==null&&v!==undefined)e.value=v};
        if(Number.isFinite(Number(r.pickup_lat))&&Number.isFinite(Number(r.pickup_lng)))window.setBookingPoint?.('pickup',Number(r.pickup_lat),Number(r.pickup_lng));
        if(Number.isFinite(Number(r.destination_lat))&&Number.isFinite(Number(r.destination_lng)))window.setBookingPoint?.('destination',Number(r.destination_lat),Number(r.destination_lng));
        set('pickupAddress',r.pickup_address||'');set('destinationAddress',r.destination_address||'');set('v2PickupArea',r.pickup_area_id||'');set('v2DestinationArea',r.destination_area_id||'');set('rideNotes',r.notes||'');
        notify('تم تجهيز نفس الرحلة. راجع التفاصيل ثم أرسل الطلب.');
      },350);
    }

    function watchBooking(){const step=$('bookingStep2');if(!step)return;new MutationObserver(injectSavedShortcuts).observe(step,{childList:true,subtree:true});}
    async function injectSavedShortcuts(){
      const step=$('bookingStep2');if(!step||!user||$('jSavedShortcuts'))return;
      const host=document.createElement('div');host.id='jSavedShortcuts';host.className='j-polish-card';host.innerHTML='<h3>أماكني المحفوظة</h3><p>اختصار سريع للبيت والعمل والأماكن التي حفظتها.</p><div class="j-saved-shortcuts"><span>جاري التحميل...</span></div>';
      const target=step.querySelector('.location-inputs')||step.firstElementChild;target?.insertAdjacentElement('afterend',host);
      const {data}=await db.from('saved_addresses').select('id,label,address,lat,lng,area_id').eq('user_id',user.id).order('created_at',{ascending:false}).limit(8);const row=host.querySelector('.j-saved-shortcuts');
      if(!data?.length){row.innerHTML='<span style="color:#8190a5;font-size:12px">احفظ البيت أو العمل من حسابي حتى يظهر هنا.</span>';return}
      row.innerHTML=data.map(a=>`<button class="j-saved-chip" type="button" data-saved-id="${a.id}">${escapeHtml(a.label)}</button>`).join('');
      $$('[data-saved-id]',row).forEach(b=>b.onclick=()=>{const a=data.find(x=>x.id===b.dataset.savedId);if(!a)return;const mode=confirm('استخدام هذا المكان كوجهة؟ اضغط إلغاء لاستخدامه كنقطة انطلاق.')?'destination':'pickup';window.setBookingPoint?.(mode,Number(a.lat),Number(a.lng));setVal(mode==='pickup'?'pickupAddress':'destinationAddress',a.address);setVal(mode==='pickup'?'v2PickupArea':'v2DestinationArea',a.area_id||'');notify(`تم اختيار ${a.label}`)});
    }
    function setVal(id,v){const e=$(id);if(e)e.value=v||''}
    function escapeHtml(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}

    function injectCancelSheet(){
      if($('jCancelSheet'))return;document.body.insertAdjacentHTML('beforeend',`<section id="jCancelSheet" class="j-cancel-sheet hidden"><div class="j-cancel-panel"><h3>إلغاء الطلب</h3><p>اختر السبب حتى نقدر نحسن تجربة جيبلي.</p><div class="j-cancel-options">${['غيّرت رأيي','انتظرت فترة طويلة','الموقع غير صحيح','أريد تعديل الطلب','سبب آخر'].map(x=>`<button type="button" data-cancel-reason="${x}">${x}</button>`).join('')}</div><div class="j-cancel-actions"><button id="jCancelBack" class="j-cancel-back" type="button">رجوع</button><button id="jCancelConfirm" class="j-cancel-confirm" type="button" disabled>تأكيد الإلغاء</button></div></div></section>`);
      let reason='';$$('[data-cancel-reason]',$('jCancelSheet')).forEach(b=>b.onclick=()=>{reason=b.dataset.cancelReason;$$('[data-cancel-reason]',$('jCancelSheet')).forEach(x=>x.style.borderColor=x===b?'#c93f4d':'#e5eaf0');$('jCancelConfirm').disabled=false;$('jCancelConfirm').dataset.reason=reason});$('jCancelBack').onclick=closeCancel;$('jCancelConfirm').onclick=confirmCancel;
    }
    function interceptCancel(){document.addEventListener('click',async e=>{const b=e.target.closest?.('#cancelRequestBtn');if(!b||b.classList.contains('hidden'))return;e.preventDefault();e.stopImmediatePropagation();if(!user)return;const {data}=await db.from('ride_requests').select('id,status').eq('customer_id',user.id).in('status',['draft','requested','searching','offers_received','negotiating']).order('created_at',{ascending:false}).limit(1).maybeSingle();if(!data)return notify('لا يوجد طلب قابل للإلغاء');cancelRide=data;$('jCancelSheet').classList.remove('hidden')},true)}
    function closeCancel(){$('jCancelSheet')?.classList.add('hidden');cancelRide=null}
    async function confirmCancel(){if(!cancelRide||!user)return;const reason=$('jCancelConfirm').dataset.reason||'سبب آخر';const btn=$('jCancelConfirm');btn.disabled=true;const {error}=await db.from('ride_requests').update({status:'cancelled',cancel_reason:reason}).eq('id',cancelRide.id).eq('customer_id',user.id);btn.disabled=false;if(error)return notify(`تعذر إلغاء الطلب: ${error.message}`);closeCancel();window.closeSheet?.('requestSheet');notify('تم إلغاء الطلب');await window.refreshCustomerData?.()}

    function watchUpdates(){
      if(!('serviceWorker'in navigator))return;
      window.addEventListener('load',async()=>{try{const reg=await navigator.serviceWorker.getRegistration();if(!reg)return;reg.addEventListener('updatefound',()=>{const worker=reg.installing;if(!worker)return;worker.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)showUpdate(reg)})})}catch{}});
    }
    function showUpdate(reg){if($('jUpdateBanner'))return;const b=document.createElement('div');b.id='jUpdateBanner';b.className='j-update-banner';b.innerHTML='<div><strong>تحديث جديد لجيبلي</strong><small>حدّث التطبيق حتى تحصل على آخر التحسينات.</small></div><button type="button">تحديث</button>';document.body.appendChild(b);b.querySelector('button').onclick=()=>{reg.waiting?.postMessage({type:'SKIP_WAITING'});location.reload()}}
  }
})();