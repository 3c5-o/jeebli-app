(()=>{
  if(/(?:admin|driver)\.html$/i.test(location.pathname))return;
  const ready=fn=>document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn,{once:true}):fn();
  ready(init);
  async function init(){
    if(!window.supabase||!window.JEEBLI_CONFIG)return;
    if(!document.querySelector('link[href="./customer-contrast.css"]')){const l=document.createElement('link');l.rel='stylesheet';l.href='./customer-contrast.css';document.head.appendChild(l)}
    const db=window.supabase.createClient(window.JEEBLI_CONFIG.SUPABASE_URL,window.JEEBLI_CONFIG.SUPABASE_KEY);
    const $=id=>document.getElementById(id),notify=m=>window.notify?window.notify(m):console.log(m);
    let user=null,pendingAddress=null;
    const {data:{session}}=await db.auth.getSession();user=session?.user||null;
    db.auth.onAuthStateChange((_e,s)=>user=s?.user||null);
    injectChooser();
    document.addEventListener('click',interceptSaved,true);

    function injectChooser(){
      if($('jAddressChoice'))return;
      document.body.insertAdjacentHTML('beforeend',`<section id="jAddressChoice" class="j-cancel-sheet hidden" aria-hidden="true"><div class="j-cancel-panel"><h3>استخدام العنوان</h3><p id="jAddressChoiceText">اختر شلون تريد تستخدم هذا المكان في الطلب.</p><div class="j-cancel-options"><button id="jUsePickup" type="button">استخدامه كنقطة انطلاق</button><button id="jUseDestination" type="button">استخدامه كوجهة</button></div><div class="j-cancel-actions"><button id="jAddressBack" class="j-cancel-back" type="button">رجوع</button></div></div></section>`);
      $('jAddressBack').onclick=closeChooser;$('jUsePickup').onclick=()=>applyAddress('pickup');$('jUseDestination').onclick=()=>applyAddress('destination');
    }
    async function interceptSaved(e){
      const b=e.target.closest?.('.j-saved-chip');if(!b||!user)return;
      e.preventDefault();e.stopImmediatePropagation();
      const id=b.dataset.savedId;if(!id)return;
      const {data,error}=await db.from('saved_addresses').select('id,label,address,lat,lng,area_id').eq('id',id).eq('user_id',user.id).maybeSingle();
      if(error||!data)return notify('تعذر فتح العنوان المحفوظ');
      pendingAddress=data;$('jAddressChoiceText').textContent=`${data.label||'العنوان'} — اختر هل هو نقطة الانطلاق أو الوجهة.`;$('jAddressChoice').classList.remove('hidden');$('jAddressChoice').setAttribute('aria-hidden','false');
    }
    function closeChooser(){pendingAddress=null;$('jAddressChoice')?.classList.add('hidden');$('jAddressChoice')?.setAttribute('aria-hidden','true')}
    function applyAddress(mode){
      const a=pendingAddress;if(!a)return;
      const lat=Number(a.lat),lng=Number(a.lng);if(!Number.isFinite(lat)||!Number.isFinite(lng))return notify('هذا العنوان يحتاج إحداثيات صحيحة');
      window.setBookingPoint?.(mode,lat,lng);
      const input=$(mode==='pickup'?'pickupAddress':'destinationAddress');if(input)input.value=a.address||a.label||'';
      const area=$(mode==='pickup'?'v2PickupArea':'v2DestinationArea');if(area&&a.area_id)area.value=a.area_id;
      closeChooser();notify(mode==='pickup'?'تم اختيار العنوان كنقطة انطلاق':'تم اختيار العنوان كوجهة');
    }
  }
})();