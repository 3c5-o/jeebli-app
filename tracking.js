// Live driver tracking is intentionally isolated from the public driver profile.
// Customers can read a driver's precise location only after that driver is selected for their active request.
renderDriverOnHomeMap = async function(){
  if(!currentRequest?.selected_driver_id)return;
  const {data}=await db.from('driver_locations').select('driver_id,lat,lng,updated_at').eq('driver_id',currentRequest.selected_driver_id).maybeSingle();
  if(!data||data.lat==null||data.lng==null)return;
  initHomeMap();
  clearDriverMarker();
  driverMarker=L.marker([data.lat,data.lng]).addTo(homeMap).bindTooltip('سائق جيبلي');
};

renderSelectedDriver = async function(){
  const r=currentRequest;if(!r?.selected_driver_id)return;
  const {data:d}=await db.from('drivers').select('id,display_name,rating,total_rides,vehicle_make,vehicle_model,vehicle_color,plate_number').eq('id',r.selected_driver_id).maybeSingle();
  const name=d?.display_name||'سائق جيبلي';
  $('selectedDriverSection').innerHTML=`<article class="selected-driver-card"><div class="offer-head"><div class="driver-avatar">${escapeHtml(initial(name))}</div><div><h3>${escapeHtml(name)}</h3><p>⭐ ${Number(d?.rating||5).toFixed(1)} · ${Number(d?.total_rides||0).toLocaleString('ar-IQ')} رحلة</p></div><div class="offer-price"><strong>${money(r.agreed_fare)}</strong><small>السعر المثبت</small></div></div><div class="selected-driver-grid"><div><small>السيارة</small><strong>${escapeHtml([d?.vehicle_make,d?.vehicle_model].filter(Boolean).join(' ')||'—')}</strong></div><div><small>اللون</small><strong>${escapeHtml(d?.vehicle_color||'—')}</strong></div><div><small>اللوحة</small><strong>${escapeHtml(d?.plate_number||'—')}</strong></div><div><small>الدفع</small><strong>نقداً عند الوصول</strong></div></div></article>`;
  icons();
  await renderDriverOnHomeMap();
};

subscribeRealtime = function(){
  unsubscribeRealtime();
  if(!currentUser)return;
  const reqCh=db.channel(`customer-requests-${currentUser.id}`).on('postgres_changes',{event:'*',schema:'public',table:'ride_requests',filter:`customer_id=eq.${currentUser.id}`},async()=>{await loadCurrentRequest();if(!$('requestSheet').classList.contains('hidden')&&currentRequest){renderRequestSheet();if(currentRequest.accepted_offer_id)await renderSelectedDriver();}loadRequests();}).subscribe();
  const offerCh=db.channel(`customer-offers-${currentUser.id}`).on('postgres_changes',{event:'*',schema:'public',table:'driver_offers'},async payload=>{if(!currentRequest)return;const rid=payload.new?.ride_request_id||payload.old?.ride_request_id;if(rid!==currentRequest.id)return;await loadCurrentRequest();await loadOffers(currentRequest.id);notify('وصلك تحديث جديد على عروض السائقين');}).subscribe();
  const notifCh=db.channel(`customer-notifs-${currentUser.id}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications',filter:`user_id=eq.${currentUser.id}`},payload=>{loadNotificationBadge();if(payload.new?.title)notify(payload.new.title);if(currentPage==='notifications')loadNotifications();}).subscribe();
  const driverCh=db.channel(`customer-driver-${currentUser.id}`).on('postgres_changes',{event:'*',schema:'public',table:'driver_locations'},async payload=>{const driverId=payload.new?.driver_id||payload.old?.driver_id;if(currentRequest?.selected_driver_id&&driverId===currentRequest.selected_driver_id)await renderDriverOnHomeMap();}).subscribe();
  channels.push(reqCh,offerCh,notifCh,driverCh);
};

// If the session initialized unusually fast, replace any earlier subscription immediately.
if(typeof currentUser!=='undefined'&&currentUser){subscribeRealtime();renderDriverOnHomeMap();}
