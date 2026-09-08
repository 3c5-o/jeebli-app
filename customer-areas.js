(()=>{
  const ready=fn=>document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn,{once:true}):fn();
  ready(async()=>{
    if(!/\/(?:index\.html)?$/i.test(location.pathname)||!window.supabase||!window.JEEBLI_CONFIG)return;
    const form=document.getElementById('signupForm');if(!form)return;
    const dbArea=window.supabase.createClient(window.JEEBLI_CONFIG.SUPABASE_URL,window.JEEBLI_CONFIG.SUPABASE_KEY);
    const phone=document.getElementById('signupPhone');
    const wrap=document.createElement('div');wrap.className='signup-area-box';wrap.innerHTML=`<div class="signup-area-head"><span>منطقة السكن</span><small>حدد القضاء ثم الناحية ثم القرية</small></div><label>القضاء<select id="signupDistrict" required><option value="">جاري تحميل المناطق...</option></select></label><label>الناحية / المركز<select id="signupSubdistrict" required><option value="">اختر القضاء أولاً</option></select></label><label>القرية / المنطقة<select id="signupVillage" required><option value="">اختر الناحية أولاً</option></select></label>`;
    const phoneLabel=phone?.closest('label');if(phoneLabel)phoneLabel.insertAdjacentElement('afterend',wrap);else form.prepend(wrap);
    const district=document.getElementById('signupDistrict'),sub=document.getElementById('signupSubdistrict'),village=document.getElementById('signupVillage');
    let areas=[];
    const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
    const options=(rows,placeholder)=>`<option value="">${placeholder}</option>`+rows.map(a=>`<option value="${a.id}">${esc(a.name_ar)}</option>`).join('');
    function fillDistricts(){const rows=areas.filter(a=>a.area_type==='district'&&!a.parent_id);district.innerHTML=options(rows,'اختر القضاء');const sharqat=rows.find(a=>a.code==='sharqat');if(sharqat){district.value=sharqat.id;fillSubdistricts()}}
    function fillSubdistricts(){const rows=areas.filter(a=>a.parent_id===district.value&&a.area_type==='subdistrict');sub.innerHTML=options(rows,'اختر الناحية / المركز');village.innerHTML='<option value="">اختر الناحية أولاً</option>';if(rows.length===1){sub.value=rows[0].id;fillVillages()}}
    function fillVillages(){const rows=areas.filter(a=>a.parent_id===sub.value&&['village','neighborhood'].includes(a.area_type));village.innerHTML=options(rows,'اختر القرية / المنطقة')}
    const {data,error}=await dbArea.from('service_areas').select('id,code,name_ar,area_type,parent_id,sort_order').eq('is_active',true).order('sort_order').order('name_ar');
    if(error){district.innerHTML='<option value="">تعذر تحميل المناطق</option>';return}
    areas=data||[];fillDistricts();district.onchange=fillSubdistricts;sub.onchange=fillVillages;

    form.addEventListener('submit',async e=>{
      e.preventDefault();e.stopImmediatePropagation();
      const areaId=village.value;if(!district.value||!sub.value||!areaId){window.notify?.('حدد القضاء والناحية والقرية قبل إنشاء الحساب');return}
      const btn=form.querySelector('[type="submit"]');if(btn){btn.disabled=true;btn.style.opacity='.65'}
      const area=areas.find(a=>a.id===areaId),full_name=document.getElementById('signupName').value.trim(),phoneValue=document.getElementById('signupPhone').value.trim();
      const {data:authData,error:authError}=await dbArea.auth.signUp({email:document.getElementById('signupEmail').value.trim(),password:document.getElementById('signupPassword').value,options:{data:{full_name,phone:phoneValue,area_id:areaId,area_name:area?.name_ar||''}}});
      if(btn){btn.disabled=false;btn.style.opacity='1'}
      if(authError){window.notify?.(authError.message);return}
      if(authData.session){window.notify?.('تم إنشاء حسابك وربط منطقتك');if(typeof window.showApp==='function')await window.showApp(authData.user)}else window.notify?.('تم إنشاء الحساب. افتح بريدك لتأكيده ثم سجل الدخول.');
    },true);

    const loadScript=(src,onload)=>{
      const existing=document.querySelector(`script[src="${src}"]`);
      if(existing){if(onload)existing.addEventListener('load',onload,{once:true});return existing}
      const s=document.createElement('script');s.src=src;s.async=false;if(onload)s.addEventListener('load',onload,{once:true});document.body.appendChild(s);return s;
    };
    const loadLux=()=>loadScript('./customer-lux.js');
    const loadPush=()=>loadScript('./customer-push.js',loadLux);
    const loadUX=()=>loadScript('./customer-ux.js',loadPush);
    const loadPolish=()=>loadScript('./customer-polish.js',loadUX);
    const loadLaunch=()=>loadScript('./customer-launch.js',loadPolish);
    const loadAddresses=()=>loadScript('./customer-addresses.js',loadLaunch);
    const loadAvatar=()=>loadScript('./customer-avatar.js',loadAddresses);
    const loadStarex=()=>loadScript('./customer-starex.js',loadAvatar);
    const loadServices=()=>loadScript('./customer-services.js',loadStarex);
    const loadBridge=()=>loadScript('./customer-v3-bridge.js',loadServices);
    const loadV3=()=>loadScript('./customer-v3.js',loadBridge);
    loadScript('./customer-v2.js',loadV3);
    setTimeout(()=>{
      if(!document.querySelector('script[src="./customer-v3.js"]'))loadV3();
      if(!document.querySelector('script[src="./customer-v3-bridge.js"]'))loadBridge();
      if(!document.querySelector('script[src="./customer-services.js"]'))loadServices();
      if(!document.querySelector('script[src="./customer-starex.js"]'))loadStarex();
      if(!document.querySelector('script[src="./customer-avatar.js"]'))loadAvatar();
      if(!document.querySelector('script[src="./customer-addresses.js"]'))loadAddresses();
      if(!document.querySelector('script[src="./customer-launch.js"]'))loadLaunch();
      if(!document.querySelector('script[src="./customer-polish.js"]'))loadPolish();
      if(!document.querySelector('script[src="./customer-ux.js"]'))loadUX();
      if(!document.querySelector('script[src="./customer-push.js"]'))loadPush();
      if(!document.querySelector('script[src="./customer-lux.js"]'))loadLux();
    },1800);
  });
})();