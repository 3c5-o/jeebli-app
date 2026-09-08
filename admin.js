const {SUPABASE_URL,SUPABASE_KEY}=window.JEEBLI_CONFIG;
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const ADMIN_EMAIL='ffkyyr@gmail.com';
const $=id=>document.getElementById(id);
const $$=(sel,root=document)=>[...root.querySelectorAll(sel)];
let currentUser=null,currentAdmin=null,cachedProfiles=[],cachedDrivers=[],cachedRequests=[];

function icons(){if(window.lucide)window.lucide.createIcons()}
function escapeHtml(v=''){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function notify(msg){const el=$('toast');el.textContent=msg;el.classList.remove('hidden');clearTimeout(window.__adminToast);window.__adminToast=setTimeout(()=>el.classList.add('hidden'),3400)}
function setBusy(target,busy){const btn=target?.tagName==='FORM'?target.querySelector('[type="submit"]'):target;if(!btn)return;btn.disabled=busy;btn.style.opacity=busy?'.6':'1'}
function money(v){return v==null?'—':Number(v).toLocaleString('ar-IQ')+' د.ع'}
function fmt(iso){if(!iso)return'—';try{return new Intl.DateTimeFormat('ar-IQ',{dateStyle:'medium',timeStyle:'short'}).format(new Date(iso))}catch{return'—'}}
function initial(v='ج'){return(v.trim()[0]||'ج').toUpperCase()}
function statusText(s){return({offline:'غير متصل',online:'متصل',busy:'مشغول',suspended:'موقوف',requested:'تم الطلب',searching:'بحث عن سائق',offers_received:'وصلت عروض',negotiating:'تفاوض',driver_selected:'تم اختيار السائق',driver_on_way:'السائق في الطريق',driver_arrived:'وصل السائق',in_progress:'جارية',completed:'مكتملة',cancelled:'ملغاة',open:'مفتوحة',in_progress_ticket:'قيد المتابعة',closed:'مغلقة'})[s]||s}
function roleText(r){return({admin:'إدارة',driver:'سائق',customer:'عميل'})[r]||r}
function showAuth(){currentUser=currentAdmin=null;$('adminApp').classList.add('hidden');$('adminAuth').classList.remove('hidden');icons()}
function showApp(){ $('adminAuth').classList.add('hidden');$('adminApp').classList.remove('hidden');$('adminName').textContent=currentAdmin.full_name||'مدير جيبلي';$('adminInitial').textContent=initial(currentAdmin.full_name||'ج');icons();loadAll() }

async function verifyAdmin(user){
  if(!user)return false;
  const {data,error}=await db.from('profiles').select('id,email,full_name,phone,role').eq('id',user.id).maybeSingle();
  if(error||!data||data.role!=='admin'||String(data.email||'').toLowerCase()!==ADMIN_EMAIL){await db.auth.signOut();showAuth();notify('هذا الحساب لا يملك صلاحية الإدارة');return false}
  currentUser=user;currentAdmin=data;showApp();return true;
}

async function loginAdmin(e){
  e.preventDefault();const email=$('adminEmail').value.trim().toLowerCase(),password=$('adminPassword').value;
  if(email!==ADMIN_EMAIL)return notify('هذا البريد غير مصرح له بدخول الإدارة');
  setBusy(e.currentTarget,true);const {data,error}=await db.auth.signInWithPassword({email,password});setBusy(e.currentTarget,false);
  if(error)return notify('تعذر الدخول. تحقق من بيانات حساب الإدارة وتأكيد البريد.');
  await verifyAdmin(data.user);
}
async function setupAdmin(){
  const email=$('adminEmail').value.trim().toLowerCase(),password=$('adminPassword').value;
  if(email!==ADMIN_EMAIL)return notify('أدخل البريد الإداري المعتمد');
  if(password.length<6)return notify('أدخل كلمة المرور المخصصة للحساب');
  setBusy($('setupAdminBtn'),true);
  const {data,error}=await db.auth.signUp({email,password,options:{data:{full_name:'مدير جيبلي'}}});
  setBusy($('setupAdminBtn'),false);
  if(error){if(String(error.message).toLowerCase().includes('already'))return notify('الحساب موجود مسبقاً. استخدم تسجيل الدخول.');return notify(`تعذر التهيئة: ${error.message}`)}
  if(data.session){notify('تم إنشاء حساب الإدارة');await verifyAdmin(data.user)}else notify('تم إنشاء الحساب. افتح البريد وأكّد الحساب ثم سجّل الدخول.')
}

function switchSection(name){
  $$('.admin-section').forEach(x=>x.classList.toggle('active',x.id===`section-${name}`));
  $$('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.section===name));
  $('sectionTitle').textContent=({overview:'نظرة عامة',drivers:'السائقون',requests:'الطلبات',users:'المستخدمون',services:'الخدمات',support:'الدعم'})[name]||name;
  if(name==='drivers')loadDrivers();if(name==='requests')loadRequests();if(name==='users')loadUsers();if(name==='services')loadServices();if(name==='support')loadTickets();icons();window.scrollTo({top:0,behavior:'smooth'});
}

async function loadProfilesCache(){const {data}=await db.from('profiles').select('id,email,full_name,phone,role,created_at').order('created_at',{ascending:false});cachedProfiles=data||[];return cachedProfiles}
async function loadDriversCache(){const {data}=await db.from('drivers').select('*').order('created_at',{ascending:false});cachedDrivers=data||[];return cachedDrivers}
async function loadAll(){await Promise.all([loadProfilesCache(),loadDriversCache()]);await Promise.all([loadStats(),loadRecentRequests(),loadDrivers(),loadRequests(),loadUsers(),loadServices(),loadTickets()]);}
async function exactCount(table,filter){let q=db.from(table).select('*',{count:'exact',head:true});if(filter)q=filter(q);const {count}=await q;return count||0}
async function loadStats(){
  const active=['requested','searching','offers_received','negotiating','driver_selected','driver_on_way','driver_arrived','in_progress'];
  const [users,drivers,activeReq,tickets]=await Promise.all([
    exactCount('profiles',q=>q.neq('role','admin')),exactCount('drivers'),exactCount('ride_requests',q=>q.in('status',active)),exactCount('support_tickets',q=>q.neq('status','closed'))
  ]);
  $('statUsers').textContent=users.toLocaleString('ar-IQ');$('statDrivers').textContent=drivers.toLocaleString('ar-IQ');$('statActiveRequests').textContent=activeReq.toLocaleString('ar-IQ');$('statTickets').textContent=tickets.toLocaleString('ar-IQ');
}
async function loadRecentRequests(){
  const {data}=await db.from('ride_requests').select('id,customer_id,service_type,status,pickup_address,destination_address,agreed_fare,created_at').order('created_at',{ascending:false}).limit(6);
  const ids=[...new Set((data||[]).map(x=>x.customer_id))],map={};if(ids.length){const {data:p}=await db.from('profiles').select('id,full_name').in('id',ids);(p||[]).forEach(x=>map[x.id]=x)}
  $('recentRequests').innerHTML=(data||[]).length?(data||[]).map(r=>`<article class="list-row"><div class="row-main"><strong>${escapeHtml(map[r.customer_id]?.full_name||'عميل جيبلي')} · ${escapeHtml(r.service_type)}</strong><p>${escapeHtml(r.pickup_address)} ← ${escapeHtml(r.destination_address||'بدون وجهة')}</p><small>${fmt(r.created_at)}</small></div><div><span class="badge">${escapeHtml(statusText(r.status))}</span><p>${r.agreed_fare?money(r.agreed_fare):'حسب الاتفاق'}</p></div></article>`).join(''):'<div class="list-row"><div class="row-main"><strong>لا توجد طلبات بعد</strong><small>ستظهر الطلبات الجديدة هنا.</small></div></div>';
}

async function loadDrivers(){
  await Promise.all([loadProfilesCache(),loadDriversCache()]);const term=$('driverSearch')?.value.trim().toLowerCase()||'';const pmap=Object.fromEntries(cachedProfiles.map(p=>[p.id,p]));
  const list=cachedDrivers.filter(d=>{const p=pmap[d.id]||{};return!term||[d.display_name,p.full_name,p.email,d.plate_number].some(v=>String(v||'').toLowerCase().includes(term))});
  $('driversList').innerHTML=list.length?list.map(d=>{const p=pmap[d.id]||{};return`<article class="admin-row"><div class="row-main"><strong>${escapeHtml(d.display_name||p.full_name||'سائق')}</strong><p>${escapeHtml(p.email||'—')} · ${escapeHtml(p.phone||'—')}</p><small>${escapeHtml([d.vehicle_make,d.vehicle_model,d.vehicle_color].filter(Boolean).join(' · ')||'بدون تفاصيل مركبة')} · لوحة ${escapeHtml(d.plate_number||'—')}</small></div><div class="row-actions"><span class="badge ${d.is_verified?'green':'yellow'}">${d.is_verified?'متحقق':'بانتظار التحقق'}</span><span class="badge ${d.status==='suspended'?'red':d.status==='online'?'green':''}">${escapeHtml(statusText(d.status))}</span><button class="mini-btn" data-edit-driver="${d.id}">تعديل</button><button class="mini-btn ok" data-verify-driver="${d.id}">${d.is_verified?'إلغاء التحقق':'تحقق'}</button><button class="mini-btn warn" data-suspend-driver="${d.id}">${d.status==='suspended'?'إلغاء الإيقاف':'إيقاف'}</button><button class="mini-btn danger" data-remove-driver="${d.id}">إزالة</button></div></article>`}).join(''):'<div class="admin-row"><div class="row-main"><strong>لا يوجد سائقون</strong><small>استخدم زر إضافة سائق.</small></div></div>';
  $$('[data-edit-driver]').forEach(b=>b.onclick=()=>editDriver(b.dataset.editDriver));
  $$('[data-verify-driver]').forEach(b=>b.onclick=()=>toggleDriverVerify(b.dataset.verifyDriver));
  $$('[data-suspend-driver]').forEach(b=>b.onclick=()=>toggleDriverSuspend(b.dataset.suspendDriver));
  $$('[data-remove-driver]').forEach(b=>b.onclick=()=>removeDriver(b.dataset.removeDriver));
  await loadDriverInvites();
}
async function loadDriverInvites(){
  const {data}=await db.from('driver_invites').select('*').order('created_at',{ascending:false}).limit(100);const rows=data||[];
  $('driverInvitesList').innerHTML=rows.length?rows.map(i=>`<article class="admin-row"><div class="row-main"><strong>${escapeHtml(i.full_name)}</strong><p>${escapeHtml(i.email)} · ${escapeHtml(i.phone||'—')}</p><small>${escapeHtml([i.vehicle_make,i.vehicle_model,i.plate_number].filter(Boolean).join(' · ')||'تفاصيل غير مكتملة')}</small></div><div class="row-actions"><span class="badge ${i.status==='claimed'?'green':i.status==='revoked'?'red':'yellow'}">${i.status==='pending'?'بانتظار التسجيل':i.status==='claimed'?'تم الربط':'ملغاة'}</span>${i.status==='pending'?`<button class="mini-btn danger" data-revoke-invite="${i.id}">إلغاء الدعوة</button>`:''}</div></article>`).join(''):'<div class="admin-row"><div class="row-main"><strong>لا توجد دعوات</strong></div></div>';
  $$('[data-revoke-invite]').forEach(b=>b.onclick=async()=>{if(!confirm('إلغاء دعوة هذا السائق؟'))return;await db.from('driver_invites').update({status:'revoked',updated_at:new Date().toISOString()}).eq('id',b.dataset.revokeInvite);notify('تم إلغاء الدعوة');loadDriverInvites()});
}
function openDriverModal(){ $('driverModal').classList.remove('hidden');document.body.style.overflow='hidden' }
function closeDriverModal(){ $('driverModal').classList.add('hidden');document.body.style.overflow='';$('driverForm').reset() }
function editDriver(id){const d=cachedDrivers.find(x=>x.id===id),p=cachedProfiles.find(x=>x.id===id);if(!d)return;$('driverEmail').value=p?.email||'';$('driverName').value=d.display_name||p?.full_name||'';$('driverPhone').value=p?.phone||'';$('driverVehicleType').value=d.vehicle_type||'sedan';$('driverVehicleMake').value=d.vehicle_make||'';$('driverVehicleModel').value=d.vehicle_model||'';$('driverVehicleColor').value=d.vehicle_color||'';$('driverPlate').value=d.plate_number||'';$('driverVerified').checked=!!d.is_verified;openDriverModal()}
async function saveDriver(e){
  e.preventDefault();setBusy(e.currentTarget,true);const email=$('driverEmail').value.trim().toLowerCase();const base={full_name:$('driverName').value.trim(),phone:$('driverPhone').value.trim()||null,vehicle_type:$('driverVehicleType').value,vehicle_make:$('driverVehicleMake').value.trim()||null,vehicle_model:$('driverVehicleModel').value.trim()||null,vehicle_color:$('driverVehicleColor').value.trim()||null,plate_number:$('driverPlate').value.trim()||null};
  const {data:profile,error:profileError}=await db.from('profiles').select('id,email,full_name,phone,role').ilike('email',email).maybeSingle();
  if(profileError){setBusy(e.currentTarget,false);return notify(`تعذر البحث عن الحساب: ${profileError.message}`)}
  if(profile){
    const {error:dErr}=await db.from('drivers').upsert({id:profile.id,status:'offline',display_name:base.full_name,vehicle_type:base.vehicle_type,vehicle_make:base.vehicle_make,vehicle_model:base.vehicle_model,vehicle_color:base.vehicle_color,plate_number:base.plate_number,is_verified:$('driverVerified').checked},{onConflict:'id'});
    if(dErr){setBusy(e.currentTarget,false);return notify(`تعذر حفظ السائق: ${dErr.message}`)}
    const {error:pErr}=await db.from('profiles').update({role:'driver',full_name:base.full_name,phone:base.phone,updated_at:new Date().toISOString()}).eq('id',profile.id);
    if(pErr){setBusy(e.currentTarget,false);return notify(`تم حفظ المركبة لكن تعذر تحديث الدور: ${pErr.message}`)}
    notify('تم تفعيل حساب السائق وربطه بالمركبة');
  }else{
    const {data:existing}=await db.from('driver_invites').select('id').ilike('email',email).eq('status','pending').maybeSingle();
    const invite={email,...base,created_by:currentUser.id,updated_at:new Date().toISOString()};
    const op=existing?db.from('driver_invites').update(invite).eq('id',existing.id):db.from('driver_invites').insert(invite);
    const {error}=await op;if(error){setBusy(e.currentTarget,false);return notify(`تعذر حفظ الدعوة: ${error.message}`)}
    notify('تم تجهيز السائق. عند التسجيل بنفس البريد سيُربط تلقائياً.');
  }
  setBusy(e.currentTarget,false);closeDriverModal();await Promise.all([loadDrivers(),loadUsers(),loadStats()]);
}
async function toggleDriverVerify(id){const d=cachedDrivers.find(x=>x.id===id);if(!d)return;const {error}=await db.from('drivers').update({is_verified:!d.is_verified,updated_at:new Date().toISOString()}).eq('id',id);if(error)return notify(error.message);notify('تم تحديث حالة التحقق');loadDrivers()}
async function toggleDriverSuspend(id){const d=cachedDrivers.find(x=>x.id===id);if(!d)return;const next=d.status==='suspended'?'offline':'suspended';const {error}=await db.from('drivers').update({status:next,updated_at:new Date().toISOString()}).eq('id',id);if(error)return notify(error.message);notify(next==='suspended'?'تم إيقاف السائق':'تم إلغاء إيقاف السائق');loadDrivers()}
async function removeDriver(id){if(!confirm('إزالة صلاحية السائق؟ الحساب نفسه لن يُحذف.'))return;const {error}=await db.from('drivers').delete().eq('id',id);if(error)return notify(error.message);await db.from('profiles').update({role:'customer',updated_at:new Date().toISOString()}).eq('id',id);notify('تمت إزالة السائق');await Promise.all([loadDrivers(),loadUsers(),loadStats()])}

async function loadRequests(){
  let q=db.from('ride_requests').select('*').order('created_at',{ascending:false}).limit(150);const f=$('requestFilter')?.value||'all';if(f==='active')q=q.in('status',['requested','searching','offers_received','negotiating','driver_selected','driver_on_way','driver_arrived','in_progress']);if(f==='completed')q=q.eq('status','completed');if(f==='cancelled')q=q.eq('status','cancelled');
  const {data,error}=await q;if(error){$('adminRequestsList').innerHTML='<div class="admin-row">تعذر تحميل الطلبات</div>';return}cachedRequests=data||[];const ids=[...new Set(cachedRequests.map(x=>x.customer_id))],pmap={};if(ids.length){const {data:p}=await db.from('profiles').select('id,full_name,email,phone').in('id',ids);(p||[]).forEach(x=>pmap[x.id]=x)}
  const statuses=['requested','searching','offers_received','negotiating','driver_selected','driver_on_way','driver_arrived','in_progress','completed','cancelled'];
  $('adminRequestsList').innerHTML=cachedRequests.length?cachedRequests.map(r=>`<article class="admin-row"><div class="row-main"><strong>${escapeHtml(pmap[r.customer_id]?.full_name||'عميل')} · ${escapeHtml(r.service_type)}</strong><p>${escapeHtml(r.pickup_address)} ← ${escapeHtml(r.destination_address||'بدون وجهة')}</p><small>${escapeHtml(pmap[r.customer_id]?.phone||'—')} · ${fmt(r.created_at)} · ${r.agreed_fare?money(r.agreed_fare):'حسب الاتفاق'}</small></div><div class="row-actions"><select class="mini-btn" data-request-status="${r.id}">${statuses.map(s=>`<option value="${s}" ${s===r.status?'selected':''}>${escapeHtml(statusText(s))}</option>`).join('')}</select><button class="mini-btn ok" data-save-request-status="${r.id}">حفظ الحالة</button></div></article>`).join(''):'<div class="admin-row"><div class="row-main"><strong>لا توجد طلبات</strong></div></div>';
  $$('[data-save-request-status]').forEach(b=>b.onclick=()=>saveRequestStatus(b.dataset.saveRequestStatus));
}
async function saveRequestStatus(id){const select=document.querySelector(`[data-request-status="${id}"]`),status=select.value,patch={status,updated_at:new Date().toISOString()};if(status==='completed')patch.completed_at=new Date().toISOString();if(status==='cancelled')patch.cancelled_at=new Date().toISOString();const {error}=await db.from('ride_requests').update(patch).eq('id',id);if(error)return notify(error.message);notify('تم تحديث حالة الطلب');await Promise.all([loadRequests(),loadRecentRequests(),loadStats()])}

async function loadUsers(){
  await loadProfilesCache();const term=$('userSearch')?.value.trim().toLowerCase()||'';const rows=cachedProfiles.filter(p=>p.role!=='admin'&&(!term||[p.full_name,p.email,p.phone].some(v=>String(v||'').toLowerCase().includes(term))));
  $('usersList').innerHTML=rows.length?rows.map(p=>`<article class="admin-row"><div class="row-main"><strong>${escapeHtml(p.full_name||'مستخدم')}</strong><p>${escapeHtml(p.email||'—')} · ${escapeHtml(p.phone||'—')}</p><small>منذ ${fmt(p.created_at)}</small></div><div class="row-actions"><span class="badge ${p.role==='driver'?'green':''}">${escapeHtml(roleText(p.role))}</span>${p.role!=='driver'?`<button class="mini-btn ok" data-make-driver="${p.id}">تحويل لسائق</button>`:''}</div></article>`).join(''):'<div class="admin-row"><div class="row-main"><strong>لا توجد نتائج</strong></div></div>';
  $$('[data-make-driver]').forEach(b=>b.onclick=()=>prefillUserAsDriver(b.dataset.makeDriver));
}
function prefillUserAsDriver(id){const p=cachedProfiles.find(x=>x.id===id);if(!p)return;$('driverEmail').value=p.email||'';$('driverName').value=p.full_name||'';$('driverPhone').value=p.phone||'';openDriverModal()}

async function loadServices(){
  const {data,error}=await db.from('services').select('*').order('sort_order');if(error)return notify('تعذر تحميل الخدمات');
  $('adminServicesGrid').innerHTML=(data||[]).map(s=>`<article class="service-admin-card"><div class="icon">${escapeHtml(s.icon||'•')}</div><h3>${escapeHtml(s.name_ar)}</h3><p>${escapeHtml(s.description_ar||'')}</p><div class="switches"><label class="switch-line"><span>مفعلة</span><input type="checkbox" data-service-active="${s.code}" ${s.is_active?'checked':''}></label><label class="switch-line"><span>قريباً</span><input type="checkbox" data-service-coming="${s.code}" ${s.is_coming_soon?'checked':''}></label></div></article>`).join('');
  $$('[data-service-active]').forEach(x=>x.onchange=()=>updateService(x.dataset.serviceActive,{is_active:x.checked}));$$('[data-service-coming]').forEach(x=>x.onchange=()=>updateService(x.dataset.serviceComing,{is_coming_soon:x.checked}));
}
async function updateService(code,patch){patch.updated_at=new Date().toISOString();const {error}=await db.from('services').update(patch).eq('code',code);if(error)return notify(error.message);notify('تم تحديث الخدمة')}

async function loadTickets(){
  let q=db.from('support_tickets').select('*').order('created_at',{ascending:false}).limit(150);const f=$('ticketFilter')?.value||'all';if(f!=='all')q=q.eq('status',f);const {data,error}=await q;if(error)return notify('تعذر تحميل الدعم');const rows=data||[],ids=[...new Set(rows.map(x=>x.user_id))],map={};if(ids.length){const {data:p}=await db.from('profiles').select('id,full_name,email,phone').in('id',ids);(p||[]).forEach(x=>map[x.id]=x)}
  $('ticketsList').innerHTML=rows.length?rows.map(t=>`<article class="admin-row"><div class="row-main"><strong>${escapeHtml(t.subject)}</strong><p>${escapeHtml(t.message)}</p><small>${escapeHtml(map[t.user_id]?.full_name||'مستخدم')} · ${escapeHtml(t.category)} · ${fmt(t.created_at)}</small></div><div class="row-actions"><select class="mini-btn" data-ticket-status="${t.id}"><option value="open" ${t.status==='open'?'selected':''}>مفتوحة</option><option value="in_progress" ${t.status==='in_progress'?'selected':''}>قيد المتابعة</option><option value="closed" ${t.status==='closed'?'selected':''}>مغلقة</option></select><button class="mini-btn ok" data-save-ticket="${t.id}">حفظ</button></div></article>`).join(''):'<div class="admin-row"><div class="row-main"><strong>لا توجد تذاكر</strong></div></div>';
  $$('[data-save-ticket]').forEach(b=>b.onclick=()=>saveTicket(b.dataset.saveTicket));
}
async function saveTicket(id){const status=document.querySelector(`[data-ticket-status="${id}"]`).value;const {error}=await db.from('support_tickets').update({status,updated_at:new Date().toISOString()}).eq('id',id);if(error)return notify(error.message);notify('تم تحديث التذكرة');loadTickets();loadStats()}

async function broadcast(e){
  e.preventDefault();setBusy(e.currentTarget,true);const audience=$('broadcastAudience').value;let q=db.from('profiles').select('id,role').neq('role','admin');if(audience==='customers')q=q.eq('role','customer');if(audience==='drivers')q=q.eq('role','driver');const {data:users,error:uErr}=await q;if(uErr){setBusy(e.currentTarget,false);return notify(uErr.message)}if(!users?.length){setBusy(e.currentTarget,false);return notify('لا يوجد مستلمون')}
  const title=$('broadcastTitle').value.trim(),body=$('broadcastBody').value.trim();const payload=users.map(u=>({user_id:u.id,type:'admin_broadcast',title,body,data:{source:'admin'}}));const {error}=await db.from('notifications').insert(payload);setBusy(e.currentTarget,false);if(error)return notify(error.message);e.currentTarget.reset();notify(`تم إرسال الإشعار إلى ${users.length.toLocaleString('ar-IQ')} حساب`)
}

function bind(){
  $('adminLoginForm').addEventListener('submit',loginAdmin);$('setupAdminBtn').onclick=setupAdmin;$('adminLogoutBtn').onclick=async()=>{await db.auth.signOut();showAuth()};
  $$('.nav-item').forEach(b=>b.onclick=()=>switchSection(b.dataset.section));$$('[data-go]').forEach(b=>b.onclick=()=>switchSection(b.dataset.go));
  $('openDriverModalBtn').onclick=openDriverModal;$('closeDriverModalBtn').onclick=closeDriverModal;$('cancelDriverBtn').onclick=closeDriverModal;$('driverForm').addEventListener('submit',saveDriver);
  $('refreshDriversBtn').onclick=loadDrivers;$('driverSearch').addEventListener('input',loadDrivers);$('requestFilter').onchange=loadRequests;$('userSearch').addEventListener('input',loadUsers);$('refreshServicesBtn').onclick=loadServices;$('ticketFilter').onchange=loadTickets;$('broadcastForm').addEventListener('submit',broadcast);
  $('driverModal').addEventListener('click',e=>{if(e.target===$('driverModal'))closeDriverModal()});
}

bind();icons();
db.auth.onAuthStateChange((_event,session)=>{if(session?.user&&!currentUser)verifyAdmin(session.user);if(!session?.user&&currentUser)showAuth()});
(async()=>{const {data:{session}}=await db.auth.getSession();if(session?.user)await verifyAdmin(session.user);else showAuth()})();