(()=>{
  if(/(?:admin|driver)\.html$/i.test(location.pathname))return;
  const ready=fn=>document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn,{once:true}):fn();
  ready(init);
  async function init(){
    if(!window.supabase||!window.JEEBLI_CONFIG||!('Notification' in window))return;
    const db=window.supabase.createClient(window.JEEBLI_CONFIG.SUPABASE_URL,window.JEEBLI_CONFIG.SUPABASE_KEY);
    let user=null,ch=null;
    const {data:{session}}=await db.auth.getSession();if(session?.user)start(session.user);
    db.auth.onAuthStateChange((_e,s)=>{if(s?.user&&s.user.id!==user?.id)start(s.user);if(!s?.user)stop()});
    function start(u){user=u;if(ch)db.removeChannel(ch);ch=db.channel(`customer-system-notify-${u.id}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications',filter:`user_id=eq.${u.id}`},p=>show(p.new)).subscribe()}
    function stop(){user=null;if(ch){db.removeChannel(ch);ch=null}}
    async function show(n){
      if(!n||Notification.permission!=='granted'||!document.hidden)return;
      try{
        const reg=await navigator.serviceWorker?.ready;if(!reg)return;
        const rideId=n.data?.ride_request_id||null;
        await reg.showNotification(n.title||'جيبلي',{body:n.body||'',icon:'./assets/brand/mark.svg',badge:'./assets/brand/mark.svg',dir:'rtl',lang:'ar-IQ',tag:rideId?`jeebli-${n.type}-${rideId}`:`jeebli-${n.id}`,renotify:true,data:{url:rideId?'./?action=requests':'./?action=requests',ride_request_id:rideId,type:n.type}});
      }catch{}
    }
  }
})();