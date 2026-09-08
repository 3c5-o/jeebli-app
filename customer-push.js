(()=>{
  if(/(?:admin|driver)\.html$/i.test(location.pathname))return;
  const ready=fn=>document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn,{once:true}):fn();
  ready(init);

  async function init(){
    if(!window.supabase||!window.JEEBLI_CONFIG)return;
    const db=window.supabase.createClient(window.JEEBLI_CONFIG.SUPABASE_URL,window.JEEBLI_CONFIG.SUPABASE_KEY);
    const $=id=>document.getElementById(id);
    const notify=msg=>window.notify?window.notify(msg):console.log(msg);
    let user=null,currentDeviceKey=null,busy=false;

    const supported=()=>location.protocol==='https:'&&'serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window;

    document.addEventListener('click',async e=>{
      const btn=e.target.closest?.('#notifPermissionBtn');
      if(btn){e.preventDefault();e.stopImmediatePropagation();await enablePush(true);return}
      const logout=e.target.closest?.('#logoutBtn');
      if(logout&&user){await deactivateCurrentDevice().catch(()=>{})}
    },true);

    const {data:{session}}=await db.auth.getSession();
    if(session?.user)await start(session.user);
    db.auth.onAuthStateChange(async(event,s)=>{
      if(event==='SIGNED_OUT'){user=null;currentDeviceKey=null;paint();return}
      if(s?.user&&s.user.id!==user?.id)await start(s.user);
    });

    async function start(u){
      user=u;
      const intro=document.querySelector('#jNotifPrefs>p');
      if(intro)intro.textContent='اختر شنو تريد يصلك. Push الحقيقي يوصلك على هذا الجهاز حتى إذا جيبلي مو مفتوح.';
      paint();
      if(supported()&&Notification.permission==='granted')await enablePush(false);
    }

    async function enablePush(showFeedback){
      if(busy)return;
      if(!user){if(showFeedback)notify('سجل الدخول أولاً');return}
      if(!supported()){if(showFeedback)notify('هذا الجهاز أو المتصفح لا يدعم Push Notifications');paint('unsupported');return}
      busy=true;paint('working');
      try{
        let permission=Notification.permission;
        if(permission!=='granted')permission=await Notification.requestPermission();
        if(permission!=='granted'){
          if(showFeedback)notify(permission==='denied'?'الإشعارات محظورة من إعدادات الجهاز/المتصفح':'لم يتم السماح بالإشعارات');
          paint(permission);return;
        }

        const reg=await navigator.serviceWorker.ready;
        const {data:vapidKey,error:keyError}=await db.rpc('get_push_public_key');
        if(keyError||!vapidKey)throw new Error('تعذر تحميل مفتاح الإشعارات');

        let sub=await reg.pushManager.getSubscription();
        if(!sub){
          sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(vapidKey)});
        }
        const json=sub.toJSON();
        if(!json?.keys?.p256dh||!json?.keys?.auth)throw new Error('اشتراك الإشعارات غير مكتمل');
        currentDeviceKey=sub.endpoint;
        const token=JSON.stringify({endpoint:sub.endpoint,expirationTime:json.expirationTime||null,keys:json.keys});
        const {error:registerError}=await db.rpc('register_push_device',{
          p_device_key:sub.endpoint,
          p_token:token,
          p_platform:'web',
          p_provider:'webpush',
          p_device_name:deviceName()
        });
        if(registerError)throw registerError;
        paint('ready');
        if(showFeedback){
          notify('تم تفعيل الإشعارات الفعلية على هذا الجهاز');
          const {data:sent}=await db.rpc('send_push_test');
          if(sent)notify('راح يوصلك إشعار اختبار من جيبلي الآن');
        }
      }catch(err){
        console.error('Jeebli push setup failed',err);
        paint('error');
        if(showFeedback)notify(`تعذر تفعيل الإشعارات: ${err?.message||'خطأ غير معروف'}`);
      }finally{busy=false}
    }

    async function deactivateCurrentDevice(){
      if(!user||!supported())return;
      try{
        const reg=await navigator.serviceWorker.ready;
        const sub=await reg.pushManager.getSubscription();
        const key=currentDeviceKey||sub?.endpoint;
        if(key)await db.rpc('deactivate_push_device',{p_device_key:key});
      }catch{}
    }

    function paint(state){
      const btn=$('notifPermissionBtn'),label=btn?.querySelector('span'),status=$('jNotifStatus');
      const permission=supported()?Notification.permission:'unsupported';
      const effective=state||(permission==='granted'?'ready':permission);
      if(label){
        if(effective==='ready')label.textContent='الإشعارات الفعلية مفعلة ✓';
        else if(effective==='working')label.textContent='جاري تفعيل الإشعارات...';
        else label.textContent='تفعيل الإشعارات';
      }
      if(!status)return;
      if(effective==='ready'){
        status.textContent='Push Notifications مفعلة على هذا الجهاز، وتقدر توصلك حتى إذا جيبلي مو مفتوح.';
        status.className='j-notif-status ok';
      }else if(effective==='denied'){
        status.textContent='الإشعارات محظورة. فعّلها من إعدادات الموقع/التطبيق في جهازك.';
        status.className='j-notif-status warn';
      }else if(effective==='unsupported'){
        status.textContent='هذا الجهاز أو المتصفح لا يدعم Push Notifications بهذه النسخة.';
        status.className='j-notif-status warn';
      }else if(effective==='error'){
        status.textContent='صار خطأ بربط Push على هذا الجهاز. جرّب التفعيل مرة ثانية.';
        status.className='j-notif-status warn';
      }else{
        status.textContent='فعّل Push حتى توصلك عروض السائقين وتحديثات الرحلة حتى إذا جيبلي مو مفتوح.';
        status.className='j-notif-status';
      }
    }

    function urlBase64ToUint8Array(base64String){
      const padding='='.repeat((4-base64String.length%4)%4);
      const base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/');
      const raw=atob(base64);
      return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
    }
    function deviceName(){
      const ua=navigator.userAgent||'';
      if(/Android/i.test(ua))return 'Android Web/PWA';
      if(/iPhone|iPad|iPod/i.test(ua))return 'iPhone/iPad Web/PWA';
      if(/Windows/i.test(ua))return 'Windows Browser';
      return navigator.platform||'Web Browser';
    }

    window.JEEBLI_PUSH={enable:()=>enablePush(true),refresh:()=>enablePush(false),deactivate:deactivateCurrentDevice};
  }
})();