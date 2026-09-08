window.JEEBLI_CONFIG={SUPABASE_URL:'https://fsofjhsnttsoyyvoidnd.supabase.co',SUPABASE_KEY:'sb_publishable_LJAf00GHiG3b2Sr_q-tAgw_JZZ2Hq7s'};

// إذا فُتحت بوابة السائق بنفس المتصفح الذي ما زال مسجلاً بحساب الإدارة،
// امسح جلسة الإدارة فقط حتى تظهر شاشة دخول السائق بدل تحويله للوحة الإدارة.
(()=>{
  try{
    const isDriverPage=/\/driver\.html$/i.test(location.pathname);
    if(!isDriverPage)return;
    const ref='fsofjhsnttsoyyvoidnd';
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      if(!key||!key.startsWith(`sb-${ref}-auth-token`))continue;
      const raw=localStorage.getItem(key);if(!raw)continue;
      const parsed=JSON.parse(raw);
      const email=String(parsed?.user?.email||parsed?.currentSession?.user?.email||'').toLowerCase();
      if(email==='ffkyyr@gmail.com'){localStorage.removeItem(key);break}
    }
  }catch(_e){}
})();

window.addEventListener('DOMContentLoaded',()=>{
  const load=src=>{const s=document.createElement('script');s.src=src;s.defer=true;document.body.appendChild(s)};
  load('./tracking.js');
  load('./brand.js');
  if(/\/admin\.html$/i.test(location.pathname)){
    load('./admin-driver-patch.js');
    load('./admin-areas.js');
  }
  if(/\/driver\.html$/i.test(location.pathname))load('./driver-ui-patch.js');
  if(!/\/(?:admin|driver)\.html$/i.test(location.pathname))load('./customer-areas.js');
});