(()=>{
  if(/(?:admin|driver)\.html$/i.test(location.pathname))return;
  const ready=fn=>document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn,{once:true}):fn();
  ready(()=>{
    const $=id=>document.getElementById(id);
    const notify=msg=>window.notify?window.notify(msg):console.log(msg);
    const currentCode=()=>document.querySelector('.booking-service.selected')?.dataset.bookingService||window.selectedService||'taxi';
    const oldRender=window.renderServiceExtraFields;
    const oldCollect=window.collectServiceDetails;
    const oldValidate=window.validateBookingStep;

    window.renderServiceExtraFields=function(){
      if(currentCode()!=='starex')return oldRender?.();
      const box=$('serviceExtraFields');if(!box)return;
      box.innerHTML=`<div class="j-service-card"><div class="j-service-card-head"><img src="https://f.top4top.io/p_3903d2ibm1.jpg" referrerpolicy="no-referrer" alt="ستاركس"><div><h4>تفاصيل رحلة ستاركس</h4><p>مناسبة للعوائل والمجموعات مع مساحة أوسع وراحة أكثر.</p></div></div><div class="j-service-grid"><label>عدد الركاب <span class="j-required">*</span><div class="j-counter"><button type="button" data-count="starexPassengers" data-delta="-1">−</button><input id="starexPassengers" type="number" min="1" max="10" value="4"><button type="button" data-count="starexPassengers" data-delta="1">+</button></div></label><label>عدد الحقائب<div class="j-counter"><button type="button" data-count="starexBags" data-delta="-1">−</button><input id="starexBags" type="number" min="0" max="20" value="0"><button type="button" data-count="starexBags" data-delta="1">+</button></div></label><label>نوع المجموعة<select id="starexGroup"><option value="family">عائلة</option><option value="friends">مجموعة أصدقاء</option><option value="business">فريق / عمل</option><option value="other">أخرى</option></select></label><label>احتياج مساحة<select id="starexSpace"><option value="normal">عادية</option><option value="luggage">مساحة إضافية للحقائب</option><option value="cargo_light">أغراض خفيفة مع الركاب</option></select></label><label class="full">ملاحظة للسائق<textarea id="starexNote" rows="2" maxlength="300" placeholder="مثال: معنا أطفال أو حقائب كبيرة"></textarea></label></div><div class="j-service-note">أرسل طلبك وستصلك عروض من سواق الستاركس المخصصين لمنطقتك. السعر يبقى حسب الاتفاق داخل جيبلي.</div><div id="jServiceWarning" class="j-service-warning"></div></div>`;
      document.querySelectorAll('[data-count]').forEach(b=>b.onclick=()=>{const input=$(b.dataset.count);if(!input)return;const next=Math.min(Number(input.max||999),Math.max(Number(input.min||0),Number(input.value||0)+Number(b.dataset.delta||0)));input.value=next});
    };

    window.collectServiceDetails=function(){
      if(currentCode()!=='starex')return oldCollect?.()||{};
      return{passengers:Math.max(1,Number($('starexPassengers')?.value||1)),bags:Math.max(0,Number($('starexBags')?.value||0)),passenger_group:$('starexGroup')?.value||'family',space_need:$('starexSpace')?.value||'normal',starex_note:$('starexNote')?.value.trim()||null};
    };

    window.validateBookingStep=function(){
      if(oldValidate&&!oldValidate())return false;
      if(currentCode()!=='starex'||document.querySelector('.booking-step.active')?.id!=='bookingStep3')return true;
      const passengers=Number($('starexPassengers')?.value||0);if(passengers<1||passengers>10){notify('حدد عدد ركاب ستاركس من 1 إلى 10');return false}return true;
    };
  });
})();
