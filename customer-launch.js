(()=>{
  if(/(?:admin|driver)\.html$/i.test(location.pathname))return;
  if(!document.querySelector('script[src="./customer-avatar.js"]')){
    const avatar=document.createElement('script');avatar.src='./customer-avatar.js';avatar.async=false;document.body.appendChild(avatar);
  }
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