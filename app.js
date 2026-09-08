const SUPABASE_URL='https://fsofjhsnttsoyyvoidnd.supabase.co';
const SUPABASE_KEY='sb_publishable_LJAf00GHiG3b2Sr_q-tAgw_JZZ2Hq7s';
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

const $=id=>document.getElementById(id);
const authView=$('authView'),appView=$('appView'),logoutBtn=$('logoutBtn'),toast=$('toast');
let currentUser=null,selectedService='taxi',rideChannel=null;

function notify(message){toast.textContent=message;toast.classList.remove('hidden');setTimeout(()=>toast.classList.add('hidden'),3200)}
function setBusy(form,busy){const btn=form.querySelector('button[type="submit"]');btn.disabled=busy;btn.style.opacity=busy?'.65':'1'}
function statusLabel(status){return({requested:'تم الطلب',searching:'جاري البحث',accepted:'تم قبول الرحلة',driver_arrived:'السائق وصل',in_progress:'الرحلة جارية',completed:'مكتملة',cancelled:'ملغاة'})[status]||status}
function serviceLabel(service){return({taxi:'تكسي',private:'خصوصي',delivery:'توصيل',intercity:'بين المحافظات',cargo:'حمل'})[service]||service}

async function showApp(user){currentUser=user;authView.classList.add('hidden');appView.classList.remove('hidden');logoutBtn.classList.remove('hidden');const {data}=await db.from('profiles').select('full_name').eq('id',user.id).maybeSingle();$('userName').textContent=data?.full_name||user.user_metadata?.full_name||'مستخدم جيبلي';await loadRides();subscribeToRides()}
function showAuth(){currentUser=null;appView.classList.add('hidden');authView.classList.remove('hidden');logoutBtn.classList.add('hidden');if(rideChannel){db.removeChannel(rideChannel);rideChannel=null}}

async function loadRides(){if(!currentUser)return;const {data,error}=await db.from('rides').select('*').eq('customer_id',currentUser.id).order('requested_at',{ascending:false}).limit(20);if(error){notify('تعذر تحميل الرحلات');return}const list=$('ridesList');if(!data?.length){list.innerHTML='<div class="empty">ما عندك رحلات بعد. أول طلب راح يظهر هنا.</div>';return}list.innerHTML=data.map(r=>`<article class="ride-item"><div class="ride-top"><div><strong>${serviceLabel(r.service_type)}</strong><div class="ride-id">#${r.id.slice(0,8).toUpperCase()}</div></div><div class="ride-status">${statusLabel(r.status)}</div></div><div class="route"><div>🟢 <span>من:</span> ${escapeHtml(r.pickup_address)}</div><div>📍 <span>إلى:</span> ${escapeHtml(r.destination_address)}</div></div></article>`).join('')}
function escapeHtml(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]))}
function subscribeToRides(){if(rideChannel)db.removeChannel(rideChannel);rideChannel=db.channel(`rides-${currentUser.id}`).on('postgres_changes',{event:'*',schema:'public',table:'rides',filter:`customer_id=eq.${currentUser.id}`},()=>loadRides()).subscribe()}

document.querySelectorAll('.tab').forEach(tab=>tab.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));tab.classList.add('active');$('loginForm').classList.toggle('active-form',tab.dataset.tab==='login');$('signupForm').classList.toggle('active-form',tab.dataset.tab==='signup')}));
document.querySelectorAll('.service-card').forEach(card=>card.addEventListener('click',()=>{document.querySelectorAll('.service-card').forEach(x=>x.classList.remove('selected'));card.classList.add('selected');selectedService=card.dataset.service}));

$('signupForm').addEventListener('submit',async e=>{e.preventDefault();setBusy(e.currentTarget,true);const full_name=$('signupName').value.trim(),phone=$('signupPhone').value.trim();const {data,error}=await db.auth.signUp({email:$('signupEmail').value.trim(),password:$('signupPassword').value,options:{data:{full_name,phone}}});setBusy(e.currentTarget,false);if(error)return notify(error.message);if(data.session){notify('تم إنشاء الحساب بنجاح');showApp(data.user)}else notify('تم إنشاء الحساب. تحقق من بريدك لتأكيده ثم سجّل الدخول.')});
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();setBusy(e.currentTarget,true);const {data,error}=await db.auth.signInWithPassword({email:$('loginEmail').value.trim(),password:$('loginPassword').value});setBusy(e.currentTarget,false);if(error)return notify('بيانات الدخول غير صحيحة أو الحساب غير مؤكد');notify('تم تسجيل الدخول');showApp(data.user)});
logoutBtn.addEventListener('click',async()=>{await db.auth.signOut();showAuth();notify('تم تسجيل الخروج')});

$('useLocationBtn').addEventListener('click',()=>{if(!navigator.geolocation)return notify('المتصفح لا يدعم تحديد الموقع');navigator.geolocation.getCurrentPosition(pos=>{$('pickupLat').value=pos.coords.latitude.toFixed(6);$('pickupLng').value=pos.coords.longitude.toFixed(6);if(!$('pickupAddress').value)$('pickupAddress').value='موقعي الحالي';notify('تم تحديد موقعك')},()=>notify('تعذر الوصول إلى موقعك. فعّل إذن الموقع.'))});

$('rideForm').addEventListener('submit',async e=>{e.preventDefault();if(!currentUser)return notify('سجّل الدخول أولاً');setBusy(e.currentTarget,true);const payload={customer_id:currentUser.id,service_type:selectedService,status:'requested',pickup_address:$('pickupAddress').value.trim(),pickup_lat:Number($('pickupLat').value),pickup_lng:Number($('pickupLng').value),destination_address:$('destinationAddress').value.trim(),destination_lat:Number($('destinationLat').value),destination_lng:Number($('destinationLng').value),notes:$('rideNotes').value.trim()||null};const {error}=await db.from('rides').insert(payload);setBusy(e.currentTarget,false);if(error)return notify(`تعذر إنشاء الطلب: ${error.message}`);e.currentTarget.reset();notify('تم إرسال طلبك بنجاح');await loadRides()});
$('refreshRidesBtn').addEventListener('click',loadRides);

db.auth.onAuthStateChange((_event,session)=>{if(session?.user&&!currentUser)showApp(session.user);if(!session?.user&&currentUser)showAuth()});
(async()=>{const {data:{session}}=await db.auth.getSession();session?.user?showApp(session.user):showAuth()})();
