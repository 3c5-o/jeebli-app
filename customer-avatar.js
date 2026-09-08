(()=>{
  if(/(?:admin|driver)\.html$/i.test(location.pathname))return;
  const ready=fn=>document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn,{once:true}):fn();
  ready(init);
  async function init(){
    if(!window.supabase||!window.JEEBLI_CONFIG)return;
    if(!document.querySelector('link[href="./customer-avatar.css"]')){const l=document.createElement('link');l.rel='stylesheet';l.href='./customer-avatar.css';document.head.appendChild(l)}
    const db=window.supabase.createClient(window.JEEBLI_CONFIG.SUPABASE_URL,window.JEEBLI_CONFIG.SUPABASE_KEY);
    const $=id=>document.getElementById(id),notify=msg=>window.notify?window.notify(msg):console.log(msg);
    let user=null,currentUrl=null,busy=false,version=Date.now();
    inject();
    const {data:{session}}=await db.auth.getSession();if(session?.user)await load(session.user);
    db.auth.onAuthStateChange(async(_e,s)=>{if(s?.user&&s.user.id!==user?.id)await load(s.user);if(!s?.user){user=null;currentUrl=null;paint(null)}});

    function inject(){
      const hero=document.querySelector('.profile-avatar');if(hero&&!document.getElementById('jAvatarEdit')){const b=document.createElement('button');b.id='jAvatarEdit';b.type='button';b.className='j-avatar-edit';b.setAttribute('aria-label','تغيير الصورة');b.innerHTML='<i data-lucide="camera"></i>';hero.appendChild(b);b.onclick=e=>{e.stopPropagation();$('jAvatarInput')?.click()};const p=document.createElement('div');p.id='jAvatarProgress';p.className='j-avatar-progress';p.innerHTML='<span></span>';hero.parentElement?.insertAdjacentElement('afterend',p)}
      if(!$('jAvatarInput')){const input=document.createElement('input');input.id='jAvatarInput';input.type='file';input.accept='image/jpeg,image/png,image/webp';input.hidden=true;input.onchange=()=>upload(input.files?.[0]);document.body.appendChild(input)}
      window.lucide?.createIcons();
    }
    async function load(u){user=u;const {data}=await db.from('profiles').select('avatar_url').eq('id',u.id).maybeSingle();currentUrl=data?.avatar_url||null;paint(currentUrl)}
    function paint(url){
      [['avatarInitial','profileAvatarBtn'],['accountInitial',null]].forEach(([spanId])=>{const span=$(spanId);if(!span)return;span.style.display=url?'none':'';let img=span.parentElement?.querySelector('.j-avatar-img');if(url){if(!img){img=document.createElement('img');img.className='j-avatar-img';img.alt='الصورة الشخصية';span.insertAdjacentElement('afterend',img)}img.src=url+(url.includes('?')?'&':'?')+'v='+version}else img?.remove()});
    }
    async function upload(file){
      if(!file||!user||busy)return;
      const allowed=['image/jpeg','image/png','image/webp'];if(!allowed.includes(file.type))return notify('اختر صورة JPG أو PNG أو WebP');if(file.size>2*1024*1024)return notify('حجم الصورة يجب أن يكون أقل من 2MB');
      busy=true;$('jAvatarProgress')?.classList.add('on');const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';const path=`${user.id}/avatar-${Date.now()}.${ext}`;const old=currentUrl;
      const {error:upErr}=await db.storage.from('avatars').upload(path,file,{contentType:file.type,cacheControl:'31536000',upsert:false});
      if(upErr){finish();return notify(`تعذر رفع الصورة: ${upErr.message}`)}
      const {data:pub}=db.storage.from('avatars').getPublicUrl(path);const url=pub?.publicUrl;if(!url){finish();return notify('تعذر إنشاء رابط الصورة')}
      const {error:pErr}=await db.from('profiles').update({avatar_url:url}).eq('id',user.id);if(pErr){await db.storage.from('avatars').remove([path]);finish();return notify('تعذر حفظ الصورة في الحساب')}
      currentUrl=url;version=Date.now();paint(url);notify('تم تحديث صورتك الشخصية');
      const oldPath=ownAvatarPath(old,user.id);if(oldPath&&oldPath!==path)db.storage.from('avatars').remove([oldPath]).catch(()=>{});finish();
    }
    function ownAvatarPath(url,uid){if(!url)return null;try{const marker='/storage/v1/object/public/avatars/';const idx=url.indexOf(marker);if(idx<0)return null;const path=decodeURIComponent(url.slice(idx+marker.length).split('?')[0]);return path.startsWith(uid+'/')?path:null}catch{return null}}
    function finish(){busy=false;$('jAvatarProgress')?.classList.remove('on');if($('jAvatarInput'))$('jAvatarInput').value=''}
  }
})();