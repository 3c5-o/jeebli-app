(()=>{
  if(/(?:admin|driver)\.html$/i.test(location.pathname))return;
  const load=src=>{if(document.querySelector(`script[src="${src}"]`))return;const s=document.createElement('script');s.src=src;s.async=false;document.body.appendChild(s)};
  load('./customer-avatar.js');
  load('./customer-addresses.js');
  load('./customer-system-notify.js');
  const params=new URLSearchParams(location.search),action=params.get('action');
  if(!action)return;
  const run=()=>{
    const app=document.getElementById('appView');
    if(!app||app.classList.contains('hidden')||typeof window.switchPage!=='function'){setTimeout(run,250);return}
    if(action==='requests')window.switchPage('requests');
    if(action==='book'&&typeof window.openBooking==='function')window.openBooking('taxi');
    params.delete('action');
    const q=params.toString();history.replaceState(null,'',location.pathname+(q?'?'+q:'')+location.hash);
  };
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',run,{once:true}):run();
})();