(()=>{
  const SERVICE_LABELS={taxi:'تكسي',private:'خصوصي',delivery:'دليفري / توصيل',cargo:'حمل',starex:'ستاركس',intercity:'بين المحافظات'};
  const ready=fn=>document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn,{once:true}):fn();

  ready(async()=>{
    const form=document.getElementById('driverForm');
    if(!form||!window.supabase||!window.JEEBLI_CONFIG)return;
    const db=window.supabase.createClient(window.JEEBLI_CONFIG.SUPABASE_URL,window.JEEBLI_CONFIG.SUPABASE_KEY);

    const modal=document.getElementById('driverModal');
    const hint=modal?.querySelector('.modal-card > .muted');
    if(hint)hint.textContent='السائق يستخدم نفس حساب العميل ونفس البريد وكلمة المرور. يجب أن يكون المستخدم مسجلاً أولاً في تطبيق جيبلي، ثم تمنحه الإدارة صلاحية سائق وتحدد قسمه ومنطقة عمله.';

    const inviteList=document.getElementById('driverInvitesList');
    if(inviteList?.closest('.panel'))inviteList.closest('.panel').style.display='none';

    const vehicleType=document.getElementById('driverVehicleType');
    const vehicleLabel=vehicleType?.closest('label');

    let serviceSelect=document.getElementById('driverServiceType');
    if(!serviceSelect){
      const label=document.createElement('label');
      label.innerHTML='<span>قسم السائق</span><select id="driverServiceType" required><option value="taxi">تكسي</option><option value="private">خصوصي</option><option value="delivery">دليفري / توصيل</option><option value="cargo">حمل</option><option value="starex">ستاركس</option><option value="intercity">بين المحافظات</option></select>';
      form.insertBefore(label,vehicleLabel||form.firstChild);
      serviceSelect=label.querySelector('select');
    }

    let areaSelect=document.getElementById('driverServiceArea');
    if(!areaSelect){
      const label=document.createElement('label');
      label.innerHTML='<span>منطقة العمل</span><select id="driverServiceArea" required><option value="">جاري تحميل المناطق...</option></select>';
      form.insertBefore(label,vehicleLabel||form.firstChild);
      areaSelect=label.querySelector('select');
    }

    let areas=[];
    async function loadAreas(){
      const {data,error}=await db.from('service_areas').select('id,code,name_ar,area_type,parent_id,sort_order').eq('is_active',true).order('sort_order');
      if(error){areaSelect.innerHTML='<option value="">تعذر تحميل المناطق</option>';return}
      areas=data||[];
      const byId=Object.fromEntries(areas.map(a=>[a.id,a]));
      const depth=a=>{let d=0,p=a.parent_id,guard=0;while(p&&byId[p]&&guard++<10){d++;p=byId[p].parent_id}return d};
      areaSelect.innerHTML=areas.map(a=>`<option value="${a.id}">${'— '.repeat(depth(a))}${a.name_ar}</option>`).join('');
      const root=areas.find(a=>a.code==='sharqat');
      if(root&&!areaSelect.value)areaSelect.value=root.id;
    }
    await loadAreas();

    const originalSave=window.saveDriver;
    if(originalSave)form.removeEventListener('submit',originalSave);

    async function patchedSaveDriver(e){
      e.preventDefault();
      const submit=e.currentTarget.querySelector('[type="submit"]');
      if(submit){submit.disabled=true;submit.style.opacity='.6'}
      const done=()=>{if(submit){submit.disabled=false;submit.style.opacity='1'}};
      const email=document.getElementById('driverEmail').value.trim().toLowerCase();
      const service_type=serviceSelect.value;
      const service_area_id=areaSelect.value||null;
      if(!service_type||!service_area_id){done();window.notify?.('حدد قسم السائق ومنطقة العمل');return}

      const {data:profile,error:pFindErr}=await db.from('profiles').select('id,email,full_name,phone,role').ilike('email',email).maybeSingle();
      if(pFindErr){done();window.notify?.(`تعذر البحث عن الحساب: ${pFindErr.message}`);return}
      if(!profile){done();window.notify?.('هذا البريد غير مسجل كمستخدم. خلي الشخص يسجل أولاً في تطبيق جيبلي، وبعدها فعّله كسائق من هنا.');return}
      if(profile.role==='admin'){done();window.notify?.('حساب الإدارة لا يمكن تحويله إلى سائق');return}

      const {data:existingDriver}=await db.from('drivers').select('status').eq('id',profile.id).maybeSingle();
      const payload={
        id:profile.id,
        status:existingDriver?.status||'offline',
        display_name:document.getElementById('driverName').value.trim(),
        service_type,
        service_area_id,
        vehicle_type:vehicleType.value,
        vehicle_make:document.getElementById('driverVehicleMake').value.trim()||null,
        vehicle_model:document.getElementById('driverVehicleModel').value.trim()||null,
        vehicle_color:document.getElementById('driverVehicleColor').value.trim()||null,
        plate_number:document.getElementById('driverPlate').value.trim()||null,
        is_verified:document.getElementById('driverVerified').checked
      };
      const {error:dErr}=await db.from('drivers').upsert(payload,{onConflict:'id'});
      if(dErr){done();window.notify?.(`تعذر حفظ السائق: ${dErr.message}`);return}

      const {error:pErr}=await db.from('profiles').update({
        role:'driver',
        full_name:payload.display_name,
        phone:document.getElementById('driverPhone').value.trim()||null,
        updated_at:new Date().toISOString()
      }).eq('id',profile.id);
      done();
      if(pErr){window.notify?.(`تم حفظ بيانات السائق لكن تعذر منح الصلاحية: ${pErr.message}`);return}
      window.notify?.(`تم تفعيل السائق ضمن قسم ${SERVICE_LABELS[service_type]||service_type}`);
      window.closeDriverModal?.();
      await Promise.all([window.loadDrivers?.(),window.loadUsers?.(),window.loadStats?.()]);
    }

    window.saveDriver=patchedSaveDriver;
    form.addEventListener('submit',patchedSaveDriver);

    const originalEdit=window.editDriver;
    window.editDriver=async function(id){
      originalEdit?.(id);
      const {data}=await db.from('drivers').select('service_type,service_area_id').eq('id',id).maybeSingle();
      if(data){serviceSelect.value=data.service_type||'taxi';if(data.service_area_id)areaSelect.value=data.service_area_id}
    };

    const openBtn=document.getElementById('openDriverModalBtn');
    openBtn?.addEventListener('click',()=>{
      setTimeout(()=>{
        serviceSelect.value='taxi';
        const root=areas.find(a=>a.code==='sharqat');
        if(root)areaSelect.value=root.id;
      },0);
    });

    const serviceBadgeText=async()=>{
      const list=document.getElementById('driversList');
      if(!list)return;
      const {data:drivers}=await db.from('drivers').select('id,service_type,service_area_id');
      const areaMap=Object.fromEntries(areas.map(a=>[a.id,a.name_ar]));
      for(const d of drivers||[]){
        const btn=list.querySelector(`[data-edit-driver="${d.id}"]`);
        const actions=btn?.closest('.row-actions');
        if(!actions||actions.querySelector(`[data-driver-meta="${d.id}"]`))continue;
        const meta=document.createElement('span');
        meta.className='badge';
        meta.dataset.driverMeta=d.id;
        meta.textContent=`${SERVICE_LABELS[d.service_type]||d.service_type||'—'} · ${areaMap[d.service_area_id]||'قضاء الشرقاط'}`;
        actions.prepend(meta);
      }
    };
    const list=document.getElementById('driversList');
    if(list){
      let timer;
      new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(serviceBadgeText,80)}).observe(list,{childList:true,subtree:true});
      serviceBadgeText();
    }
  });
})();