(()=>{
  if(/(?:admin|driver)\.html$/i.test(location.pathname))return;
  const ready=fn=>document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn,{once:true}):fn();
  ready(init);

  async function init(){
    if(!window.supabase||!window.JEEBLI_CONFIG)return;
    const db=window.supabase.createClient(window.JEEBLI_CONFIG.SUPABASE_URL,window.JEEBLI_CONFIG.SUPABASE_KEY);
    const state={areas:[],services:{}};
    const notify=m=>window.notify?window.notify(m):console.log(m);
    const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
    const fmt=iso=>{try{return new Intl.DateTimeFormat('ar-IQ',{dateStyle:'medium',timeStyle:'short'}).format(new Date(iso))}catch{return'—'}};
    const statusLabels={draft:'مسودة',requested:'تم إرسال الطلب',searching:'جاري البحث',offers_received:'وصلت عروض',negotiating:'جاري التفاوض',driver_selected:'تم اختيار السائق',driver_on_way:'السائق بالطريق',driver_arrived:'السائق وصل',in_progress:'الرحلة جارية',completed:'مكتملة',cancelled:'ملغاة'};

    await Promise.all([loadAreas(),loadServices()]);
    injectScheduledFilter();
    wrapLocation();
    addAreaStatus();
    new MutationObserver(()=>{injectScheduledFilter();addAreaStatus()}).observe(document.body,{childList:true,subtree:true});

    async function loadAreas(){const {data}=await db.from('service_areas').select('id,name_ar,area_type,parent_id').eq('is_active',true);state.areas=data||[]}
    async function loadServices(){const {data}=await db.from('services').select('code,name_ar');(data||[]).forEach(s=>state.services[s.code]=s.name_ar)}

    function injectScheduledFilter(){
      const row=document.querySelector('#page-requests .filter-row');if(!row||row.querySelector('[data-filter="scheduled"]'))return;
      const b=document.createElement('button');b.className='filter-chip';b.dataset.filter='scheduled';b.textContent='المجدولة';
      const active=row.querySelector('[data-filter="active"]');active?.insertAdjacentElement('afterend',b)||row.appendChild(b);
      b.addEventListener('click',async e=>{e.preventDefault();e.stopImmediatePropagation();row.querySelectorAll('.filter-chip').forEach(x=>x.classList.toggle('active',x===b));await loadScheduled()});
    }
    async function loadScheduled(){
      const user=(await db.auth.getUser()).data.user;if(!user)return;
      const list=document.getElementById('requestsList');if(!list)return;list.innerHTML='<div class="empty-state">جاري تحميل الطلبات المجدولة...</div>';
      const {data,error}=await db.from('ride_requests').select('id,service_type,status,pickup_address,destination_address,scheduled_at,agreed_fare,created_at').eq('customer_id',user.id).not('scheduled_at','is',null).gt('scheduled_at',new Date().toISOString()).not('status','in','("completed","cancelled")').order('scheduled_at',{ascending:true}).limit(50);
      if(error){list.innerHTML='<div class="empty-state">تعذر تحميل الرحلات المجدولة.</div>';return}
      if(!data?.length){list.innerHTML='<div class="empty-state"><div class="empty-icon">🗓️</div><strong>ما عندك رحلات مجدولة</strong><p>من الحجز اختر «جدولة لوقت لاحق» حتى تظهر هنا.</p></div>';return}
      list.innerHTML=data.map(r=>`<article class="request-card jl-scheduled-card"><div class="request-card-top"><div><p class="kicker">${esc(state.services[r.service_type]||r.service_type)}</p><h3>${esc(statusLabels[r.status]||r.status)}</h3></div><span class="status-pill">🗓️ ${esc(fmt(r.scheduled_at))}</span></div><div class="request-route"><div><i class="from"></i><span>${esc(r.pickup_address||'—')}</span></div><div><i class="to"></i><span>${esc(r.destination_address||'—')}</span></div></div><div class="request-card-foot"><small>موعد الرحلة: ${esc(fmt(r.scheduled_at))}</small><button data-open-scheduled="${r.id}">التفاصيل</button></div></article>`).join('');
      list.querySelectorAll('[data-open-scheduled]').forEach(b=>b.onclick=()=>window.openRequestSheet?.(b.dataset.openScheduled));
    }

    function wrapLocation(){
      const tryWrap=()=>{
        const mobile=window.JEEBLI_MOBILE;if(!mobile?.retryLocation||mobile.__areaWrapped)return false;
        const original=mobile.retryLocation.bind(mobile);mobile.__areaWrapped=true;
        mobile.retryLocation=async opts=>{const pos=await original(opts);detectArea(pos.lat,pos.lng,!!opts?.forBooking).catch(()=>{});return pos};return true;
      };
      if(tryWrap())return;let n=0;const t=setInterval(()=>{if(tryWrap()||++n>25)clearInterval(t)},200);
    }
    async function detectArea(lat,lng,forBooking){
      try{
        const res=await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&accept-language=ar&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`);if(!res.ok)return;
        const j=await res.json(),display=String(j.display_name||''),a=j.address||{};
        const candidates=[a.village,a.hamlet,a.town,a.city,a.suburb,a.neighbourhood,a.city_district,a.county,a.state_district,display].filter(Boolean);
        const matched=matchArea(candidates);if(!matched){setAreaStatus('تم تحديد GPS، لكن ما قدرنا نطابق اسم القرية تلقائياً. اختر منطقة الطلب يدوياً.','warn');return}
        if(forBooking){const sel=document.getElementById('v2PickupArea');if(sel){sel.value=matched.id;sel.dispatchEvent(new Event('change',{bubbles:true}))}}
        const header=document.getElementById('headerLocationText');if(header)header.textContent=matched.name_ar;
        document.querySelector('.jl-map-location span')?.replaceChildren(document.createTextNode(matched.name_ar));
        setAreaStatus(`تم التعرف على منطقة الخدمة: ${matched.name_ar}`,'ok');
      }catch{}
    }
    function normalize(v){return String(v||'').normalize('NFKD').replace(/[ًٌٍَُِّْـ]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[^\p{L}\p{N}]+/gu,'').replace(/^ال/,'').toLowerCase()}
    function matchArea(candidates){
      const hay=candidates.map(normalize).filter(Boolean);const rows=state.areas.filter(x=>['village','neighborhood','subdistrict'].includes(x.area_type));
      const scored=rows.map(x=>{const n=normalize(x.name_ar);let score=0;for(const h of hay){if(h===n)score=Math.max(score,100);else if(n.length>=4&&h.includes(n))score=Math.max(score,80);else if(h.length>=4&&n.includes(h))score=Math.max(score,65)}if(x.area_type==='village'||x.area_type==='neighborhood')score+=5;return{x,score}}).filter(v=>v.score>0).sort((a,b)=>b.score-a.score);return scored[0]?.x||null;
    }
    function addAreaStatus(){
      const map=document.querySelector('#page-home .home-map-card');if(!map||document.getElementById('jlAreaStatus'))return;
      const box=document.createElement('div');box.id='jlAreaStatus';box.className='jl-area-status';box.hidden=true;map.insertAdjacentElement('afterend',box);
    }
    function setAreaStatus(text,type){addAreaStatus();const box=document.getElementById('jlAreaStatus');if(!box)return;box.hidden=false;box.className=`jl-area-status ${type||''}`;box.textContent=text;clearTimeout(window.__jlAreaStatusTimer);window.__jlAreaStatusTimer=setTimeout(()=>box.hidden=true,7000)}

    window.JEEBLI_COMPLETION={loadScheduled,detectArea};
  }
})();
