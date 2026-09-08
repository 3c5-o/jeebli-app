(()=>{
  const SERVICE_LABELS={taxi:'تكسي',private:'خصوصي',delivery:'دليفري / توصيل',cargo:'حمل',intercity:'بين المحافظات'};
  const ready=fn=>document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn,{once:true}):fn();
  ready(()=>{
    const activateTab=document.querySelector('[data-auth-tab="activate"]');
    const activateForm=document.getElementById('driverActivateForm');
    if(activateTab)activateTab.style.display='none';
    if(activateForm)activateForm.style.display='none';
    const loginTab=document.querySelector('[data-auth-tab="login"]');
    if(loginTab){loginTab.classList.add('active');loginTab.textContent='دخول السائق بنفس حساب جيبلي'}
    const hero=document.querySelector('#driverAuth .auth-hero p:last-child');
    if(hero)hero.textContent='استخدم نفس البريد وكلمة المرور التي سجلت بها كمستخدم. بعد أن تمنحك الإدارة صلاحية سائق، يفتح لك هذا القسم تلقائياً.';

    if(!window.supabase||!window.JEEBLI_CONFIG)return;
    const db=window.supabase.createClient(window.JEEBLI_CONFIG.SUPABASE_URL,window.JEEBLI_CONFIG.SUPABASE_KEY);

    async function renderDriverScope(){
      const {data:{session}}=await db.auth.getSession();
      const user=session?.user;if(!user)return;
      const {data:d}=await db.from('drivers').select('service_type,service_area_id').eq('id',user.id).maybeSingle();
      if(!d)return;
      let areaName='قضاء الشرقاط';
      if(d.service_area_id){const {data:a}=await db.from('service_areas').select('name_ar').eq('id',d.service_area_id).maybeSingle();if(a?.name_ar)areaName=a.name_ar}
      const vehicleCard=document.querySelector('.vehicle-card');
      if(!vehicleCard||document.getElementById('driverScopeCard'))return;
      const card=document.createElement('section');
      card.id='driverScopeCard';card.className='vehicle-card';
      card.innerHTML=`<div class="section-head"><h2>صلاحية العمل</h2><i data-lucide="map-pinned"></i></div><div class="vehicle-grid"><div><small>قسم السائق</small><strong>${SERVICE_LABELS[d.service_type]||d.service_type||'—'}</strong></div><div><small>منطقة العمل</small><strong>${areaName}</strong></div></div><p class="muted">لن تظهر لك طلبات من قسم أو منطقة لا تطابق صلاحيتك.</p>`;
      vehicleCard.parentNode.insertBefore(card,vehicleCard);
      if(window.lucide)window.lucide.createIcons();
    }

    db.auth.onAuthStateChange(()=>setTimeout(renderDriverScope,250));
    setTimeout(renderDriverScope,500);
  });
})();