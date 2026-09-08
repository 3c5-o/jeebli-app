(()=>{
  if(/(?:admin|driver)\.html$/i.test(location.pathname))return;
  const ready=fn=>document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn,{once:true}):fn();
  ready(init);

  async function init(){
    if(!window.supabase||!window.JEEBLI_CONFIG)return;
    loadCss();
    const db=window.supabase.createClient(window.JEEBLI_CONFIG.SUPABASE_URL,window.JEEBLI_CONFIG.SUPABASE_KEY);
    const state={requestFiles:[],supportFiles:[],uploading:false};
    const notify=m=>window.notify?window.notify(m):console.log(m);

    injectRequestMedia();injectSupportMedia();
    const serviceBox=document.getElementById('serviceExtraFields');if(serviceBox)new MutationObserver(()=>queueMicrotask(injectRequestMedia)).observe(serviceBox,{childList:true,subtree:true});
    const support=document.getElementById('supportForm');if(support)new MutationObserver(()=>queueMicrotask(injectSupportMedia)).observe(support,{childList:true,subtree:true});

    document.getElementById('bookingNextBtn')?.addEventListener('click',()=>{
      if(!document.getElementById('bookingStep4')?.classList.contains('active')||!state.requestFiles.length||state.uploading)return;
      const started=Date.now();setTimeout(()=>waitForRideAndUpload(started),100);
    },true);
    document.getElementById('supportForm')?.addEventListener('submit',()=>{
      if(!state.supportFiles.length||state.uploading)return;
      const started=Date.now();setTimeout(()=>waitForSupportAndUpload(started),100);
    },true);

    function loadCss(){if(document.querySelector('link[href="./customer-media.css"]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href='./customer-media.css';document.head.appendChild(l)}
    function serviceCode(){return document.querySelector('.booking-service.selected')?.dataset.bookingService||window.selectedService||''}
    function injectRequestMedia(){
      const code=serviceCode();if(!['delivery','cargo'].includes(code))return;
      const card=document.querySelector('#serviceExtraFields .j-service-card');if(!card||card.querySelector('.j-request-media'))return;
      const title=code==='delivery'?'صور الطلب / الطرد':'صور الحمولة';
      const hint=code==='delivery'?'اختياري — أضف صوراً تساعد السائق يعرف حجم أو شكل الطلب.':'اختياري — الصور تساعد سائق الحمل يرسل عرض أدق.';
      card.insertAdjacentHTML('beforeend',mediaHtml('request',title,hint));
      bindPicker('request',state.requestFiles,()=>renderFiles('request',state.requestFiles));renderFiles('request',state.requestFiles);window.lucide?.createIcons();
    }
    function injectSupportMedia(){
      const form=document.getElementById('supportForm');if(!form||form.querySelector('.j-support-media'))return;
      const submit=form.querySelector('[type="submit"]');const wrap=document.createElement('div');wrap.className='j-support-media';wrap.innerHTML=mediaHtml('support','صور توضيحية','اختياري — يمكنك إرفاق حتى 3 صور للمشكلة.');
      if(submit)form.insertBefore(wrap,submit);else form.appendChild(wrap);
      bindPicker('support',state.supportFiles,()=>renderFiles('support',state.supportFiles));renderFiles('support',state.supportFiles);window.lucide?.createIcons();
    }
    function mediaHtml(type,title,hint){return `<div class="j-media-box ${type==='request'?'j-request-media':''}"><strong>${title}</strong><small>${hint}</small><label class="j-media-pick"><i data-lucide="image-plus"></i><span>اختيار صور</span><input id="jMedia-${type}" type="file" accept="image/jpeg,image/png,image/webp" multiple></label><div id="jMediaList-${type}" class="j-media-list"></div><div id="jMediaProgress-${type}" class="j-media-progress hidden">جاري رفع الصور...</div></div>`}
    function bindPicker(type,files,render){
      const input=document.getElementById(`jMedia-${type}`);if(!input||input.dataset.bound==='1')return;input.dataset.bound='1';
      input.addEventListener('change',()=>{
        const picked=[...input.files].filter(f=>/^image\/(jpeg|png|webp)$/i.test(f.type));
        const tooBig=picked.find(f=>f.size>5*1024*1024);if(tooBig){notify('حجم الصورة يجب ألا يتجاوز 5MB');input.value='';return}
        for(const f of picked){if(files.length>=3)break;if(!files.some(x=>x.name===f.name&&x.size===f.size))files.push(f)}
        if(picked.length+files.length>3)notify('الحد الأقصى 3 صور');input.value='';render();
      });
    }
    function renderFiles(type,files){
      const box=document.getElementById(`jMediaList-${type}`);if(!box)return;box.innerHTML=files.map((f,i)=>`<span class="j-media-chip"><span>${esc(f.name)}</span><button type="button" data-remove-media="${type}:${i}" aria-label="حذف">×</button></span>`).join('');
      box.querySelectorAll('[data-remove-media]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.removeMedia.split(':')[1]);files.splice(i,1);renderFiles(type,files)});
    }
    async function waitForRideAndUpload(started){
      state.uploading=true;showProgress('request',true);
      try{
        const user=(await db.auth.getUser()).data.user;if(!user)return;
        const ride=await poll(async()=>{const {data}=await db.from('ride_requests').select('id,service_type,created_at').eq('customer_id',user.id).gte('created_at',new Date(started-2500).toISOString()).order('created_at',{ascending:false}).limit(1).maybeSingle();return data},12000);
        if(!ride)return;
        const files=[...state.requestFiles];if(!files.length)return;
        let ok=0;for(const file of files){if(await uploadOne({file,userId:user.id,rideId:ride.id,kind:ride.service_type==='cargo'?'cargo':'delivery'}))ok++}
        if(ok){state.requestFiles.splice(0);renderFiles('request',state.requestFiles);notify(ok===files.length?'تم رفع صور الطلب بنجاح':`تم رفع ${ok} من ${files.length} صور`)}
      }catch(e){console.warn('request media upload',e);notify('تم إرسال الطلب، لكن تعذر رفع بعض الصور. تقدر تكمل الطلب بدونها.')}
      finally{state.uploading=false;showProgress('request',false)}
    }
    async function waitForSupportAndUpload(started){
      state.uploading=true;showProgress('support',true);
      try{
        const user=(await db.auth.getUser()).data.user;if(!user)return;
        const ticket=await poll(async()=>{const {data}=await db.from('support_tickets').select('id,created_at').eq('user_id',user.id).gte('created_at',new Date(started-2500).toISOString()).order('created_at',{ascending:false}).limit(1).maybeSingle();return data},12000);
        if(!ticket)return;
        const files=[...state.supportFiles];let ok=0;for(const file of files){if(await uploadOne({file,userId:user.id,supportId:ticket.id,kind:'support'}))ok++}
        if(ok){state.supportFiles.splice(0);renderFiles('support',state.supportFiles);notify(ok===files.length?'تم رفع مرفقات الدعم':'تم رفع بعض مرفقات الدعم')}
      }catch(e){console.warn('support media upload',e)}
      finally{state.uploading=false;showProgress('support',false)}
    }
    async function uploadOne({file,userId,rideId=null,supportId=null,kind}){
      const blob=await compress(file);const ext=blob.type==='image/webp'?'webp':blob.type==='image/png'?'png':'jpg';const parent=rideId||supportId;const path=`${userId}/${parent}/${crypto.randomUUID()}.${ext}`;
      const {error:upErr}=await db.storage.from('request-media').upload(path,blob,{contentType:blob.type,cacheControl:'3600',upsert:false});if(upErr){console.warn(upErr);return false}
      const {error:rowErr}=await db.from('customer_media').insert({user_id:userId,ride_request_id:rideId,support_ticket_id:supportId,storage_path:path,media_kind:kind});
      if(rowErr){await db.storage.from('request-media').remove([path]);console.warn(rowErr);return false}return true;
    }
    async function compress(file){
      try{
        const bmp=await createImageBitmap(file);const max=1600,scale=Math.min(1,max/Math.max(bmp.width,bmp.height));const w=Math.max(1,Math.round(bmp.width*scale)),h=Math.max(1,Math.round(bmp.height*scale));const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d',{alpha:false});ctx.drawImage(bmp,0,0,w,h);bmp.close?.();const blob=await new Promise(r=>c.toBlob(r,'image/webp',.82));return blob||file;
      }catch{return file}
    }
    async function poll(fn,timeout){const until=Date.now()+timeout;while(Date.now()<until){const v=await fn();if(v)return v;await new Promise(r=>setTimeout(r,550))}return null}
    function showProgress(type,on){document.getElementById(`jMediaProgress-${type}`)?.classList.toggle('hidden',!on)}
    function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
    window.JEEBLI_MEDIA={refresh:()=>{injectRequestMedia();injectSupportMedia()},pending:state};
  }
})();
