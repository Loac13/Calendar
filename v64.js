/* V64: optional services; legacy calendar remains the source of racing events. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = n => new Intl.NumberFormat('en-IE', {style:'currency',currency:'EUR'}).format(n);
  const cents = n => Math.round((Number(n) + Number.EPSILON) * 100);
  const series = ['ELMS','WEC','IMSA','OTHER','ADDITIONAL'];
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  let data = {invoices:{}, annualLimit:0};
  function validAmount(n) { return Number.isFinite(Number(n)) && Number(n)>=0 && Number(n)<=1e12; }
  function validate(s) {
    const date = d => typeof d==='string' && /^20\d\d-\d\d-\d\d$/.test(d) && !isNaN(Date.parse(d)) && new Date(d).toISOString().slice(0,10)===d;
    const selections = obj => obj && series.every(k=>Array.isArray(obj[k]) && obj[k].every(date));
    if (!s || !Number.isInteger(Number(s.year)) || s.year<2027 || s.year>2036 || !selections(s.selected)) throw new Error('Invalid calendar year or dates');
    if(s.years && Object.entries(s.years).some(([y,v])=>!/^20\d\d$/.test(y)||!selections(v))) throw new Error('Invalid saved year');
    if(s.v64) {
      if(!validAmount(s.v64.annualLimit ?? 0)) throw new Error('Invalid annual limit');
      for(const [year,values] of Object.entries(s.v64.invoices || {})) if(!/^20\d\d$/.test(year)||!Array.isArray(values)||values.length!==12||!values.every(validAmount)) throw new Error('Invalid monthly invoices');
    }
  }
  function totals(values, projected, limit) {
    const invoicedCents=values.reduce((sum,n)=>sum+cents(n),0);
    return {invoiced:invoicedCents/100, projected:Math.round(projected*100)/100, remaining:limit>0?(cents(limit)-invoicedCents)/100:null};
  }
  function projection() {
    const monthly=Array(12).fill(0);let home=0;
    for(const s of series) {
      const row=document.querySelector(`[data-rate-series="${s}"]`);
      const val=c=>Number(row.querySelector('.'+c).value)||0;
      const coef=val('clientRateCoef');
      home+=val('clientHomeDays')*val('clientHomeRate')*coef;
      for(const e of window.calendarApp.runs().filter(e=>e.s===s)) {
        for(let d=e.a;d<=e.b;) {
          monthly[Number(d.slice(5,7))-1]+=(d===e.a||d===e.b?val('clientTravelRate'):val('clientWorkRate'))*coef;
          const next=new Date(d+'T00:00:00Z');next.setUTCDate(next.getUTCDate()+1);d=next.toISOString().slice(0,10);
        }
      }
    }
    return {monthly,home,total:monthly.reduce((a,b)=>a+b,0)+home};
  }
  function render(tab) {
    if(tab==='tariffs') {
      $('ios-tariffs').innerHTML='<h2>Tariffs</h2><p>Rates apply across all years. Home days contribute to the annual projection only.</p>'+series.map(s=>{
        const row=document.querySelector(`[data-rate-series="${s}"]`);
        return `<div class="ios-settings-card"><h3>${s}</h3><div class="v64-fields">`+[['clientWorkRate','Work €/day'],['clientTravelRate','Travel €/day'],['clientHomeDays','Home days/year'],['clientHomeRate','Home €/day'],['clientRateCoef','Coefficient']].map(([c,label])=>`<label>${label}<input type="number" min="0" max="1000000000" step="0.01" data-rate="${s}" data-field="${c}" value="${esc(row.querySelector('.'+c).value)}"></label>`).join('')+'</div></div>';
      }).join('')+`<label>Tax (%)<input id="v64-tax" type="number" min="0" max="100" step="0.1" value="${esc($('taxRatePercent').value)}"></label>`;
    }
    if(tab==='invoicing') renderInvoices();
    if(tab==='settings'&&!$('sync-form')) renderSync();
  }
  function renderInvoices() {
    const year=$('ios-year').value;
    const values=data.invoices[year] || Array(12).fill(0);
    $('ios-invoicing').innerHTML=`<h2>Invoicing · ${year}</h2><p>Enter gross amounts actually invoiced each month. Projections use scheduled work/travel and tariffs; they are not added to actual invoices.</p><label>Annual invoicing limit (€; 0 = no limit)<input id="v64-limit" type="number" min="0" step="0.01" value="${data.annualLimit}"></label><div id="v64-totals" aria-live="polite"></div><div class="v64-invoice-grid">${months.map((m,i)=>`<label>${m}<input aria-label="${m} invoiced euros" data-invoice="${i}" type="number" min="0" step="0.01" value="${values[i]}"><small id="projection-${i}"></small></label>`).join('')}</div><p>Home-day projection is included in the annual total, without an assumed billing month. The limit is a planning aid, not tax advice.</p>`;
    updateTotals();
  }
  function updateTotals() {
    const p=projection(),t=totals(data.invoices[$('ios-year').value]||Array(12).fill(0),p.total,data.annualLimit);
    $('v64-totals').innerHTML=`<div class="ios-settings-card"><p>Annual invoiced <strong>${money(t.invoiced)}</strong></p><p>Projected annual revenue <strong>${money(t.projected)}</strong></p><p>Projected after tax <strong>${money(t.projected*(1-Number($('taxRatePercent').value)/100))}</strong></p><p>Unallocated home-day projection <strong>${money(p.home)}</strong></p><p>${t.remaining===null?'No annual limit':t.remaining<0?'Over limit: '+money(-t.remaining):'Remaining before limit: '+money(t.remaining)}</p></div>`;
    p.monthly.forEach((v,i)=>$('projection-'+i).textContent='Scheduled: '+money(v));
  }
  document.addEventListener('input',e=>{
    const x=e.target;
    if(!x.closest('#ios-tariffs,#ios-invoicing')||!x.checkValidity()||!validAmount(x.value))return;
    if(x.dataset.rate) { const original=document.querySelector(`[data-rate-series="${x.dataset.rate}"] .${x.dataset.field}`); original.value=x.value;original.dispatchEvent(new Event('input')); }
    if(x.id==='v64-tax') { $('taxRatePercent').value=x.value;$('taxRatePercent').dispatchEvent(new Event('input')); }
    if(x.id==='v64-limit') data.annualLimit=Number(x.value);
    if(x.dataset.invoice!==undefined) {const year=$('ios-year').value;data.invoices[year] ||= Array(12).fill(0);data.invoices[year][Number(x.dataset.invoice)]=cents(x.value)/100;}
    if(x.closest('#ios-invoicing'))updateTotals();
    window.calendarApp.saveSoon();
  });

  // Synchronize snapshots using optimistic revision checks. Never silently resolve conflicts.
  let client=null, user=null, busy=false, conflict=null, enabled=false, generation=0;
  const configKey='racing-v64-supabase-config';
  let config={};try{config=JSON.parse(localStorage.getItem(configKey)||'{}')}catch(_){}
  function status(s) { if($('sync-status'))$('sync-status').textContent=s; }
  function renderSync() {
    $('v64-sync').innerHTML=`<h3>Private device synchronization</h3><p>Configure your Supabase project using supabase/setup.sql, then sign in with the same account on iPhone and Lenovo. Only use a public publishable / anon key. Never enter a service-role key.</p><form id="sync-form"><label>Supabase project URL<input id="sync-url" type="url" required placeholder="https://your-project.supabase.co" value="${esc(config.url||'')}"></label><label>Publishable / anon key<input id="sync-key" required value="${esc(config.key||'')}" autocomplete="off"></label><button class="ios-btn" type="submit">Save configuration</button></form><form id="sync-login"><label>Email<input id="sync-email" type="email" autocomplete="username" required></label><label>Password<input id="sync-password" type="password" autocomplete="current-password" required></label><button class="ios-btn" type="submit">Sign in</button><button class="ios-btn secondary" id="sync-signup" type="button">Create account</button></form><button class="ios-btn secondary" id="sync-start">Enable automatic sync</button><button class="ios-btn secondary" id="sync-out">Sign out / stop sync</button><p id="sync-status" role="status">Local only. Configuration and sign-in are required.</p><div id="sync-conflict" hidden><p>Both devices have changes. Export a backup before choosing a version. A local recovery copy is also retained.</p><button class="ios-btn" id="sync-remote">Use cloud version</button><button class="ios-btn secondary" id="sync-local">Use this device version</button></div>`;
    $('sync-form').onsubmit=async e=>{e.preventDefault();try{
      const url=new URL($('sync-url').value),key=$('sync-key').value.trim();
      if(url.protocol!=='https:'||!/^[-a-z0-9]+\.supabase\.co$/.test(url.hostname)||url.pathname!=='/'||url.search||url.hash||url.username||url.port)throw new Error('Use the HTTPS project URL from Supabase.');
      let role='';if(key.startsWith('eyJ')){try{role=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role}catch(_){}}
      if(!key.startsWith('sb_publishable_')&&role!=='anon')throw new Error('Only publishable or anon keys are allowed.');
      enabled=false;generation++;if(client)await client.auth.signOut({scope:'local'});client=null;user=null;
      config={url:url.origin,key};localStorage.setItem(configKey,JSON.stringify(config));status('Configuration saved. Sign in to continue.');
    }catch(err){status(err.message)}};
    $('sync-login').onsubmit=e=>{e.preventDefault();login(false)};
    $('sync-signup').onclick=()=>{if($('sync-login').reportValidity())login(true)};
    $('sync-start').onclick=async()=>{try{await connect();const {data,error}=await client.auth.getUser();if(error||!data.user)throw new Error('Sign in first.');user=data.user;enabled=true;config.enabled=true;localStorage.setItem(configKey,JSON.stringify(config));await sync();}catch(e){status(e.message)}};
    $('sync-out').onclick=async()=>{enabled=false;config.enabled=false;localStorage.setItem(configKey,JSON.stringify(config));generation++;user=null;conflict=null;$('sync-conflict').hidden=true;if(client)await client.auth.signOut({scope:'local'});status('Signed out. Local data retained.');};
    $('sync-remote').onclick=()=>resolve('remote');$('sync-local').onclick=()=>resolve('local');
  }
  async function connect(){if(!config.url||!config.key)throw new Error('Save your Supabase configuration first.');client ||= supabase.createClient(config.url,config.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});}
  async function login(signup) {try{enabled=false;generation++;config.enabled=false;localStorage.setItem(configKey,JSON.stringify(config));await connect();const credentials={email:$('sync-email').value,password:$('sync-password').value};const result=signup?await client.auth.signUp(credentials):await client.auth.signInWithPassword(credentials);$('sync-password').value='';if(result.error)throw result.error;user=result.data.user;enabled=false;status(signup?'Check your email if confirmation is required, then sign in.':'Signed in. Enable automatic sync when ready.');}catch(e){status(e.message)}}
  function metaKey(){return 'racing-v64-sync:'+config.url+':'+user.id;}
  function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));return value;}
  function payload(){return JSON.stringify(canonical(window.calendarApp.snapshot()));}
  function saveMeta(version,text){localStorage.setItem(metaKey(),JSON.stringify({version,text}));}
  function recovery(){localStorage.setItem('racing-v64-before-sync',payload());}
  function showConflict(row){conflict=row;$('sync-conflict').hidden=false;status('Sync paused: choose which version to keep.');}
  async function sync() {
    if(!enabled||!user||busy||conflict||window.calendarStorageBlocked||document.visibilityState==='hidden')return;
    busy=true;const gen=generation;
    try{
      const current=payload(),meta=JSON.parse(localStorage.getItem(metaKey())||'null');
      const {data:row,error}=await client.from('calendar_snapshots').select('version,payload').eq('user_id',user.id).maybeSingle();if(error)throw error;
      if(gen!==generation||!enabled)return;
      if(current!==payload())return; // An edit happened during the request. Retry next cycle.
      if(row){
        validate(row.payload);
        if(JSON.stringify(canonical(row.payload))===current){saveMeta(row.version,current);status('Devices synchronized');return;}
        if(!meta || (row.version!==meta.version && current!==meta.text)){showConflict(row);return;}
        if(row.version!==meta.version){recovery();window.calendarApp.restore(row.payload);window.calendarApp.persist();saveMeta(row.version,payload());status('Cloud changes saved locally');return;}
        if(current===meta.text){status('Devices synchronized');return;}
      }
      const result=row?await client.from('calendar_snapshots').update({payload:JSON.parse(current),version:row.version+1}).eq('user_id',user.id).eq('version',row.version).select('version').maybeSingle():await client.from('calendar_snapshots').insert({user_id:user.id,payload:JSON.parse(current),version:1}).select('version').single();
      if(gen!==generation)return;
      if(result.error)throw result.error;
      if(!result.data){status('Another device saved; checking again next cycle.');return;}
      saveMeta(result.data.version,current);status('Devices synchronized');
    }catch(e){status('Sync paused / offline: '+e.message+'. Local data retained.');}finally{busy=false;}
  }
  async function resolve(choice){
    if(!conflict||busy)return;
    try{recovery();const row=conflict;
      if(choice==='remote'){validate(row.payload);window.calendarApp.restore(row.payload);window.calendarApp.persist();saveMeta(row.version,payload());}
      else { // Base the next compare-and-swap on the reviewed cloud version.
        saveMeta(row.version,'explicit-local-choice');
      }
      conflict=null;$('sync-conflict').hidden=true;await sync();
    }catch(e){status(e.message)}
  }
  async function init(){renderSync();if(config.enabled){try{await connect();const result=await client.auth.getUser();if(result.error)throw result.error;user=result.data.user;enabled=!!user;if(enabled)await sync();}catch(e){status('Sign in to resume synchronization.');}}}
  setInterval(sync,15000);
  window.addEventListener('online',sync);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')sync()});
  let timer;window.addEventListener('calendar-saved',()=>{clearTimeout(timer);timer=setTimeout(sync,700)});
  window.calendarV64={init,getData:()=>structuredClone(data),restoreData:v=>{data=v?structuredClone(v):{invoices:{},annualLimit:0};data.invoices ||= {};data.annualLimit ??= 0;},validate,render,totals,projection};
})();
