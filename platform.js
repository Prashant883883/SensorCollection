// Student-friendly experiment layer. Readings remain in this browser until exported.
(() => {
  const $ = (id) => document.getElementById(id);
  const state = {
    participant: '', consent: false, latestAcceleration: null,
    latestOrientation: null, samples: [], activeCondition: null,
    recording: false, timer: null
  };
  const continueButton = $('continueButton');
  const consent = $('consentCheck');
  const name = $('participantName');
  const sensorButton = $('startButton');

  function updateEntry() {
    continueButton.disabled = !name.value.trim() || !consent.checked;
  }
  name.addEventListener('input', updateEntry);
  consent.addEventListener('change', updateEntry);
  continueButton.addEventListener('click', () => {
    state.participant = name.value.trim();
    state.consent = consent.checked;
    $('participantPanel').hidden = true;
    $('experimentPanel').hidden = false;
    $('recordingState').textContent = `Welcome, ${state.participant}. Enable sensor access in the control centre, then complete both activities.`;
    sensorButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  // The main Digital Twin script emits these browser events; this layer samples
  // the latest values at a steady interval during each experiment condition.
  window.addEventListener('devicemotion', (event) => {
    const a = event.accelerationIncludingGravity || event.acceleration;
    if (a && [a.x,a.y,a.z].every(Number.isFinite)) {
      state.latestAcceleration = { x:a.x, y:a.y, z:a.z };
      const magnitude = Math.sqrt(a.x*a.x + a.y*a.y + a.z*a.z);
      $('gravityHint').textContent = `${magnitude.toFixed(2)} m/s²`;
      if (!state.recording) {
        const deviation = Math.abs(magnitude - 9.81);
        $('movementLevel').textContent = deviation < 1.2 ? 'Mostly steady' : deviation < 3 ? 'Some movement' : 'Strong movement';
        $('plainExplanation').textContent = deviation < 1.2
          ? 'Your phone appears relatively steady. The accelerometer still detects gravity, which is why the combined acceleration is often near 9.8 m/s² when the device is resting.'
          : 'The acceleration magnitude is changing. This can happen when you move, tilt, or shake the phone. The sensor measures acceleration, not a simple “movement score”.';
      }
    }
  }, { passive:true });
  window.addEventListener('deviceorientation', (event) => {
    if ([event.alpha,event.beta,event.gamma].every(Number.isFinite)) {
      state.latestOrientation = { alpha:event.alpha, beta:event.beta, gamma:event.gamma };
    }
  }, { passive:true });

  function setCollectionButtons(enabled) {
    $('stationaryButton').disabled = !enabled || state.recording || state.samples.some(s=>s.condition==='stationary');
    $('movementButton').disabled = !enabled || state.recording || state.samples.some(s=>s.condition==='movement');
  }
  function startCollection(condition) {
    if (state.recording) return;
    if (!state.latestAcceleration && !state.latestOrientation) {
      $('recordingState').textContent = 'No sensor readings received yet. Check device permissions and try again.';
      return;
    }
    state.activeCondition = condition;
    state.recording = true;
    const start = performance.now();
    $('recordingState').textContent = condition === 'stationary'
      ? 'Recording baseline… Keep your phone flat and still for 10 seconds.'
      : 'Recording movement… Slowly tilt and rotate your phone for 10 seconds.';
    setCollectionButtons(false);
    state.timer = setInterval(() => {
      const a = state.latestAcceleration || {};
      const o = state.latestOrientation || {};
      state.samples.push({
        participant: state.participant, condition,
        elapsed_ms: Math.round(performance.now()-start),
        timestamp: new Date().toISOString(),
        acceleration_x_ms2: a.x ?? '', acceleration_y_ms2: a.y ?? '', acceleration_z_ms2: a.z ?? '',
        orientation_alpha_deg: o.alpha ?? '', orientation_beta_deg: o.beta ?? '', orientation_gamma_deg: o.gamma ?? ''
      });
      const elapsed = (performance.now()-start)/1000;
      $('recordingState').textContent = `Recording ${condition} condition… ${Math.min(10,Math.floor(elapsed))}/10 seconds`;
      if (elapsed >= 10) finishCollection(condition);
    }, 200);
  }
  function finishCollection(condition) {
    clearInterval(state.timer); state.timer = null; state.recording = false;
    const count = state.samples.filter(s=>s.condition===condition).length;
    const status = condition === 'stationary' ? 'stationaryStatus' : 'movementStatus';
    $(status).textContent = `Completed · ${count} samples`;
    $(status).classList.add('done');
    $('recordingState').textContent = `${condition === 'stationary' ? 'Stationary' : 'Movement'} activity complete. ${state.samples.length} total samples collected.`;
    setCollectionButtons(true);
    if (state.samples.some(s=>s.condition==='stationary') && state.samples.some(s=>s.condition==='movement')) showResults();
  }
  $('stationaryButton').addEventListener('click',()=>startCollection('stationary'));
  $('movementButton').addEventListener('click',()=>startCollection('movement'));
  // Enable activity buttons only after the original sensor connection succeeds.
  const observer = new MutationObserver(() => {
    const connected = $('statusDot').classList.contains('connected');
    setCollectionButtons(connected && !state.recording);
  });
  observer.observe($('statusDot'),{attributes:true,attributeFilter:['class']});

  function mean(values) { const v=values.filter(Number.isFinite); return v.length?v.reduce((a,b)=>a+b,0)/v.length:null; }
  function stats(condition) {
    const rows=state.samples.filter(s=>s.condition===condition);
    const mags=rows.map(r=>Math.sqrt(Number(r.acceleration_x_ms2)**2+Number(r.acceleration_y_ms2)**2+Number(r.acceleration_z_ms2)**2)).filter(Number.isFinite);
    const avg=mean(mags); const variance=avg==null?null:mean(mags.map(x=>(x-avg)**2));
    return {count:rows.length,mean:avg,variation:variance==null?null:Math.sqrt(variance)};
  }
  function showResults() {
    const still=stats('stationary'), move=stats('movement');
    const fmt=v=>v==null?'Not available':`${v.toFixed(2)} m/s²`;
    $('resultSummary').innerHTML = `<strong>Experiment completed, ${escapeHtml(state.participant)}.</strong><p>You collected ${still.count} baseline samples and ${move.count} movement samples.</p><div class="result-grid"><div><span>Stationary average acceleration magnitude</span><b>${fmt(still.mean)}</b></div><div><span>Movement average acceleration magnitude</span><b>${fmt(move.mean)}</b></div><div><span>Stationary variation</span><b>${fmt(still.variation)}</b></div><div><span>Movement variation</span><b>${fmt(move.variation)}</b></div></div><p>How to read this: variation describes how spread out the acceleration magnitude was during the activity. A larger value can indicate more changing motion, but it is not a diagnosis of device quality. Results depend on the phone, browser and how the activity was performed.</p>`;
    $('downloadButton').disabled=false;
  }
  function escapeHtml(s){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  $('downloadButton').addEventListener('click',()=>{
    const cols=['participant','condition','elapsed_ms','timestamp','acceleration_x_ms2','acceleration_y_ms2','acceleration_z_ms2','orientation_alpha_deg','orientation_beta_deg','orientation_gamma_deg'];
    const csv=[cols.join(','),...state.samples.map(r=>cols.map(c=>`"${String(r[c]??'').replaceAll('"','""')}"`).join(','))].join('\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download=`sensor-experiment-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url);
  });
})();
