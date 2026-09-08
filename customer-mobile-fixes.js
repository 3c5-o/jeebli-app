(()=>{
  if(/(?:admin|driver)\.html$/i.test(location.pathname))return;
  const ICON='./assets/brand/app-icon.svg';
  const ready=fn=>document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn,{once:true}):fn();

  ready(()=>{
    loadCss();
    applyBrandIcon();
    injectInstallAction();
    improveGeo();
    window.addEventListener('resize',syncViewport,{passive:true});
    window.visualViewport?.addEventListener('resize',syncViewport,{passive:true});
    syncViewport();
    setTimeout(()=>{applyBrandIcon();window.JEEBLI_SERVICE_IMAGES?.refresh?.()},700);
  });

  function loadCss(){
    if(document.querySelector('link[href="./customer-mobile-fixes.css"]'))return;
    const l=document.createElement('link');l.rel='stylesheet';l.href='./customer-mobile-fixes.css';document.head.appendChild(l);
  }

  function applyBrandIcon(){
    const set=(box)=>{
      if(!box)return;
      box.textContent='';
      let img=box.querySelector('img');
      if(!img){img=document.createElement('img');box.appendChild(img)}
      img.src=ICON;img.alt='جيبلي';
    };
    set(document.querySelector('.splash-logo'));
    set(document.querySelector('.brand-logo'));
    let favicon=document.querySelector('link[rel="icon"]');
    if(!favicon){favicon=document.createElement('link');favicon.rel='icon';favicon.type='image/svg+xml';document.head.appendChild(favicon)}
    favicon.href=ICON;
    let apple=document.querySelector('link[rel="apple-touch-icon"]');
    if(!apple){apple=document.createElement('link');apple.rel='apple-touch-icon';document.head.appendChild(apple)}
    apple.href=ICON;
    const theme=document.querySelector('meta[name="theme-color"]');if(theme)theme.content='#07101f';
  }

  function injectInstallAction(){
    if(isStandalone())return;
    const map=document.querySelector('#page-home .home-map-card');
    if(!map||map.querySelector('.jl-install-fab'))return;
    const b=document.createElement('button');
    b.type='button';b.className='jl-install-fab';
    b.innerHTML=`<img src="${ICON}" alt=""><span>تثبيت جيبلي</span>`;
    b.addEventListener('click',()=>document.getElementById('installAppBtn')?.click());
    map.appendChild(b);
    window.addEventListener('appinstalled',()=>b.remove(),{once:true});
  }
  function isStandalone(){return window.matchMedia?.('(display-mode: standalone)').matches||window.navigator.standalone===true}

  function syncViewport(){
    const h=Math.round(window.visualViewport?.height||window.innerHeight||0);
    if(h)document.documentElement.style.setProperty('--jl-vvh',`${h}px`);
  }

  function improveGeo(){
    if(typeof locateUser!=='function'||window.__JEEBLI_GEO_PATCHED)return;
    window.__JEEBLI_GEO_PATCHED=true;
    const original=locateUser;
    window.__jeebliOriginalLocate=original;
    locateUser=robustLocateUser;
  }

  async function permissionState(){
    if(!navigator.permissions?.query)return 'unknown';
    try{return (await navigator.permissions.query({name:'geolocation'})).state}catch{return 'unknown'}
  }

  function geoMessage(err,state){
    if(state==='denied'||err?.code===1)return 'إذن الموقع محظور لجيبلي. من رمز إعدادات الموقع بجانب الرابط افتح الأذونات ثم اجعل «الموقع» = سماح، وبعدها أعد المحاولة.';
    if(err?.code===2)return 'تعذر الحصول على موقع الجهاز. فعّل خدمة الموقع GPS من الهاتف ثم أعد المحاولة.';
    if(err?.code===3)return 'تحديد الموقع استغرق وقتاً طويلاً. تأكد من تشغيل GPS والإنترنت ثم أعد المحاولة.';
    if(!window.isSecureContext)return 'تحديد الموقع يحتاج اتصال HTTPS آمن.';
    return 'تعذر تحديد الموقع حالياً. تأكد من إذن الموقع وGPS ثم أعد المحاولة.';
  }

  function getPosition(options){
    return new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,options));
  }

  async function robustLocateUser({forBooking=false,silent=false}={}){
    if(!window.isSecureContext){const e=new Error('insecure');if(!silent)notify?.(geoMessage(e));throw e}
    if(!navigator.geolocation){const e=new Error('unsupported');if(!silent)notify?.('هذا الجهاز أو المتصفح لا يدعم تحديد الموقع.');throw e}
    const state=await permissionState();
    if(state==='denied'){
      const e=Object.assign(new Error('denied'),{code:1});
      if(!silent)notify?.(geoMessage(e,state));
      throw e;
    }
    if(!silent)notify?.('جاري تحديد موقعك…');
    let pos;
    try{
      pos=await getPosition({enableHighAccuracy:false,timeout:9000,maximumAge:60000});
    }catch(first){
      if(first?.code===1){if(!silent)notify?.(geoMessage(first,'denied'));throw first}
      try{pos=await getPosition({enableHighAccuracy:true,timeout:18000,maximumAge:15000})}
      catch(second){if(!silent)notify?.(geoMessage(second,state));throw second}
    }
    const {latitude:lat,longitude:lng,accuracy}=pos.coords;
    try{
      initHomeMap();
      if(homeUserMarker)homeMap.removeLayer(homeUserMarker);
      homeUserMarker=L.circleMarker([lat,lng],{radius:9,weight:4,color:'#fff',fillColor:'#d6ac55',fillOpacity:1}).addTo(homeMap);
      homeMap.setView([lat,lng],16);
      const t=document.getElementById('headerLocationText');if(t)t.textContent=accuracy?`موقعي الحالي · دقة ${Math.round(accuracy)}م`:'موقعي الحالي';
      if(forBooking){
        setBookingPoint('pickup',lat,lng);
        const p=document.getElementById('pickupAddress');if(p&&!p.value.trim())p.value='موقعي الحالي';
        if(typeof bookingMap!=='undefined'&&bookingMap)bookingMap.setView([lat,lng],16);
      }
      const mapLoc=document.querySelector('.jl-map-location span');if(mapLoc)mapLoc.textContent='موقعي الحالي';
      if(!silent)notify?.('تم تحديد موقعك بنجاح');
      return {lat,lng,accuracy};
    }catch(renderErr){
      console.warn('Jeebli geo render error',renderErr);
      if(!silent)notify?.('تم الوصول إلى GPS لكن تعذر تحديث الخريطة. أعد فتح الصفحة وحاول مرة ثانية.');
      return {lat,lng,accuracy};
    }
  }

  window.JEEBLI_MOBILE={retryLocation:(opts)=>robustLocateUser(opts),icon:ICON};
})();
