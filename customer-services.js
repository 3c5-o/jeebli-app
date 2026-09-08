(()=>{
  if(/(?:admin|driver)\.html$/i.test(location.pathname))return;
  const ready=fn=>document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn,{once:true}):fn();
  ready(init);
  function init(){
    if(!document.querySelector('link[href="./customer-services.css"]')){const l=document.createElement('link');l.rel='stylesheet';l.href='./customer-services.css';document.head.appendChild(l)}
    const $=id=>document.getElementById(id);
    const notify=msg=>window.notify?window.notify(msg):console.log(msg);
    const serviceAsset={taxi:'taxi.svg',private:'private.svg',delivery:'delivery.svg',cargo:'cargo.svg',intercity:'intercity.svg'};
    const serviceTitle={taxi:'تفاصيل رحلة التكسي',private:'تفاصيل السيارة الخصوصي',delivery:'تفاصيل التوصيل',cargo:'تفاصيل الحمل',intercity:'تفاصيل السفر'};
    const serviceDesc={taxi:'حدد عدد الركاب وأي ملاحظة مهمة للسائق.',private:'رحلة خصوصية وراحة مع معلومات الركاب.',delivery:'بيانات المستلم والطلب والتحصيل عند التسليم.',cargo:'اشرح الحمولة حتى تصل عروض من سواق الحمل المناسبين.',intercity:'معلومات الركاب والحقائب للرحلات الطويلة.'};
    let current='taxi';

    const originalRender=window.renderServiceExtraFields;
    window.renderServiceExtraFields=function(){
      current=document.querySelector('.booking-service.selected')?.dataset.bookingService||window.selectedService||current||'taxi';
      render(current);
    };
    window.collectServiceDetails=collect;
    const originalValidate=window.validateBookingStep;
    if(originalValidate)window.validateBookingStep=function(){if(!originalValidate())return false;return validate()};

    function head(code){return `<div class="j-service-card-head"><img src="./assets/services/${serviceAsset[code]||'taxi.svg'}" alt=""/><div><h4>${serviceTitle[code]||'تفاصيل الخدمة'}</h4><p>${serviceDesc[code]||''}</p></div></div>`}
    function render(code){
      const box=$('serviceExtraFields');if(!box)return;
      if(code==='taxi'||code==='private')box.innerHTML=`<div class="j-service-card">${head(code)}<div class="j-service-grid"><label>عدد الركاب <span class="j-help">1 إلى 6</span><div class="j-counter"><button type="button" data-count="passengers" data-delta="-1">−</button><input id="passengers" type="number" min="1" max="6" value="1"/><button type="button" data-count="passengers" data-delta="1">+</button></div></label><label>الطلب <select id="ridePreference"><option value="normal">عادي</option>${code==='private'?'<option value="quiet">رحلة هادئة</option><option value="family">عائلة</option>':''}<option value="luggage">معي حقائب</option></select></label></div><div class="j-service-note">السعر لا يُحسب بالكيلومتر؛ راح توصلك عروض من السائقين وتختار السعر المناسب.</div></div>`;
      else if(code==='delivery')box.innerHTML=`<div class="j-service-card">${head(code)}<div class="j-service-grid"><label>اسم المستلم <span class="j-required">*</span><input id="recipientName" type="text" maxlength="80" placeholder="اسم الشخص المستلم"/></label><label>رقم المستلم <span class="j-required">*</span><input id="recipientPhone" type="tel" inputmode="tel" maxlength="20" placeholder="07xxxxxxxxx"/></label><label>نوع الطلب<select id="packageType"><option value="parcel">طرد / أغراض</option><option value="food">طعام</option><option value="documents">مستندات</option><option value="shopping">مشتريات</option><option value="other">أخرى</option></select></label><label>الحجم<select id="packageSize"><option value="small">صغير</option><option value="medium">متوسط</option><option value="large">كبير</option></select></label><label class="full">تعليمات التسليم<textarea id="deliveryInstructions" rows="2" maxlength="300" placeholder="مثال: اتصل بالمستلم عند الوصول"></textarea></label></div><div class="j-checks"><label class="j-check"><span>قابل للكسر / يحتاج عناية</span><input id="fragilePackage" type="checkbox"/></label><label class="j-check"><span>تحصيل مبلغ من المستلم COD</span><input id="codEnabled" type="checkbox"/></label></div><div id="codAmountWrap" class="j-cod-box hidden"><label>مبلغ التحصيل بالدينار <span class="j-required">*</span><input id="codAmount" type="number" min="0" step="250" inputmode="numeric" placeholder="مثال: 25000"/></label><div class="j-service-note">هذا مبلغ البضاعة/الطلب فقط، وأجرة التوصيل تبقى السعر المتفق عليه مع السائق بشكل منفصل.</div></div><div id="jServiceWarning" class="j-service-warning"></div></div>`;
      else if(code==='cargo')box.innerHTML=`<div class="j-service-card">${head(code)}<div class="j-service-grid"><label class="full">وصف الحمولة <span class="j-required">*</span><textarea id="cargoDescription" rows="3" maxlength="500" placeholder="مثال: كنبة + طاولة + 4 كراسي"></textarea></label><label>عدد القطع<input id="cargoPieces" type="number" min="1" max="999" inputmode="numeric" placeholder="عدد تقريبي"/></label><label>حجم الحمولة<select id="cargoSize"><option value="small">خفيفة / صغيرة</option><option value="medium">متوسطة</option><option value="large">كبيرة</option></select></label><label>المركبة المناسبة<select id="cargoVehicle"><option value="any">السائق يحدد المناسب</option><option value="pickup">بيك أب</option><option value="van">فان</option><option value="truck">شاحنة</option></select></label><label>عدد عمال التحميل<select id="loaderCount"><option value="0">لا أحتاج</option><option value="1">عامل واحد</option><option value="2">عاملان</option><option value="3">3 عمال أو أكثر</option></select></label><label class="full">ملاحظات التحميل<textarea id="cargoInstructions" rows="2" maxlength="300" placeholder="طابق، باب ضيق، أغراض حساسة..."></textarea></label></div><div class="j-service-note">السواق يشوفون وصف الحمولة قبل تقديم عروضهم، لذلك كلما كانت التفاصيل أوضح يكون العرض أدق.</div><div id="jServiceWarning" class="j-service-warning"></div></div>`;
      else if(code==='intercity')box.innerHTML=`<div class="j-service-card">${head(code)}<div class="j-service-grid"><label>عدد الأشخاص <span class="j-required">*</span><div class="j-counter"><button type="button" data-count="passengers" data-delta="-1">−</button><input id="passengers" type="number" min="1" max="12" value="1"/><button type="button" data-count="passengers" data-delta="1">+</button></div></label><label>عدد الحقائب<div class="j-counter"><button type="button" data-count="bags" data-delta="-1">−</button><input id="bags" type="number" min="0" max="30" value="0"/><button type="button" data-count="bags" data-delta="1">+</button></div></label><label>نوع الرحلة<select id="tripDirection"><option value="one_way">ذهاب فقط</option><option value="round_trip">ذهاب وعودة</option></select></label><label>نوع الركاب<select id="passengerGroup"><option value="individual">أفراد</option><option value="family">عائلة</option><option value="group">مجموعة</option></select></label></div><div class="j-service-note">حدد الموعد من خيار الجدولة بالأعلى. السعر حسب عرض السائق والاتفاق داخل جيبلي.</div></div>`;
      else box.innerHTML=originalRender?originalRender()||'':'';
      bind(code);
    }
    function bind(code){
      document.querySelectorAll('[data-count]').forEach(b=>b.onclick=()=>{const input=$(b.dataset.count);if(!input)return;const next=Math.min(Number(input.max||999),Math.max(Number(input.min||0),Number(input.value||0)+Number(b.dataset.delta||0)));input.value=next});
      $('codEnabled')?.addEventListener('change',e=>$('codAmountWrap')?.classList.toggle('hidden',!e.target.checked));
      window.lucide?.createIcons();
    }
    function collect(){
      const code=document.querySelector('.booking-service.selected')?.dataset.bookingService||current;
      if(code==='taxi'||code==='private')return{passengers:Math.max(1,Number($('passengers')?.value||1)),preference:$('ridePreference')?.value||'normal'};
      if(code==='delivery')return{recipient_name:$('recipientName')?.value.trim()||null,recipient_phone:$('recipientPhone')?.value.trim()||null,package_type:$('packageType')?.value||'parcel',package_size:$('packageSize')?.value||'small',fragile:!!$('fragilePackage')?.checked,delivery_instructions:$('deliveryInstructions')?.value.trim()||null};
      if(code==='cargo')return{cargo_description:$('cargoDescription')?.value.trim()||null,cargo_pieces:Number($('cargoPieces')?.value||0)||null,cargo_size:$('cargoSize')?.value||'small',preferred_vehicle:$('cargoVehicle')?.value||'any',loader_count:Number($('loaderCount')?.value||0),cargo_instructions:$('cargoInstructions')?.value.trim()||null};
      if(code==='intercity')return{passengers:Math.max(1,Number($('passengers')?.value||1)),bags:Math.max(0,Number($('bags')?.value||0)),trip_direction:$('tripDirection')?.value||'one_way',passenger_group:$('passengerGroup')?.value||'individual'};
      return{};
    }
    function validate(){
      const step3=document.querySelector('.booking-step.active')?.id==='bookingStep3';if(!step3)return true;
      const code=document.querySelector('.booking-service.selected')?.dataset.bookingService||current;const warn=$('jServiceWarning');const fail=msg=>{if(warn){warn.textContent=msg;warn.classList.add('show')}notify(msg);return false};if(warn)warn.classList.remove('show');
      if(code==='delivery'){
        if(!$('recipientName')?.value.trim())return fail('اكتب اسم المستلم');
        if(!$('recipientPhone')?.value.trim())return fail('اكتب رقم هاتف المستلم');
        if($('codEnabled')?.checked&&Number($('codAmount')?.value||0)<=0)return fail('اكتب مبلغ التحصيل COD');
      }
      if(code==='cargo'&&!$('cargoDescription')?.value.trim())return fail('اكتب وصف الحمولة حتى السائق يعرف المطلوب');
      return true;
    }

    const serviceBox=$('serviceExtraFields');if(serviceBox)new MutationObserver(()=>{if(!serviceBox.querySelector('.j-service-card'))render(document.querySelector('.booking-service.selected')?.dataset.bookingService||current)}).observe(serviceBox,{childList:true});
    setTimeout(()=>{if($('serviceExtraFields'))render(document.querySelector('.booking-service.selected')?.dataset.bookingService||current)},700);
  }
})();