const {test,expect}=require('@playwright/test');
test('authenticated sync, concurrent edits, explicit resolution, offline retention and automatic resume',async({browser})=>{
 test.setTimeout(60000);
 const contexts=[await browser.newContext(),await browser.newContext()];let row=null,offline=false,writes=0;
 const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'synthetic@example.test'};
 const token=['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})).toString('base64url'),'test'].join('.');
 async function prepare(context){
  await context.route('https://cdnjs.cloudflare.com/**',r=>r.abort());
  await context.route('https://synthetic.supabase.co/**',async route=>{
   const req=route.request(),url=new URL(req.url());if(offline)return route.abort();
   let body;
   if(url.pathname.endsWith('/token'))body={access_token:token,refresh_token:'synthetic-refresh',expires_in:3600,token_type:'bearer',user};
   else if(url.pathname.endsWith('/user'))body=user;
   else if(url.pathname.includes('/rest/')){
    expect(req.headers().authorization).toBe('Bearer '+token);
    if(req.method()==='GET')body=row;
    else {const incoming=req.postDataJSON();writes++;if(req.method()==='PATCH'&&url.searchParams.get('version')!=='eq.'+row.version)body=null;else{row={...row,...incoming};body={version:row.version}}}
   }else body={};
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  const page=await context.newPage();await page.goto('http://127.0.0.1:8765');await page.click('#ios-tab-settings');
  await page.fill('#sync-url','https://synthetic.supabase.co');await page.fill('#sync-key','sb_publishable_synthetic');await page.click('#sync-form button');
  await page.fill('#sync-email',user.email);await page.fill('#sync-password','synthetic-password');await page.click('#sync-login button[type=submit]');await expect(page.locator('#sync-status')).toContainText('Signed in');return page;
 }
 const a=await prepare(contexts[0]);await a.click('#sync-start');await expect(a.locator('#sync-status')).toContainText('synchronized');expect(writes).toBe(1);
 // Simulate jsonb key ordering; it must not create a false conflict.
 row.payload=Object.fromEntries(Object.entries(row.payload).reverse());
 const b=await prepare(contexts[1]);await b.click('#sync-start');await expect(b.locator('#sync-status')).toContainText('synchronized');expect(writes).toBe(1);
 await a.click('#ios-tab-invoicing');await a.fill('[data-invoice="0"]','123.45');await expect.poll(()=>row.payload.v64.invoices['2027']?.[0]).toBe(123.45);
 await b.click('#ios-tab-invoicing');await b.fill('[data-invoice="1"]','67.89');await b.click('#ios-tab-settings');await expect(b.locator('#sync-conflict')).toBeVisible();
 expect(row.payload.v64.invoices['2027'][1]).toBe(0);
 await b.click('#sync-remote');await expect(b.locator('#sync-conflict')).toBeHidden();expect(await b.evaluate(()=>calendarV64.getData().invoices['2027'][0])).toBe(123.45);
 expect(await b.evaluate(()=>!!localStorage.getItem('racing-v64-before-sync'))).toBe(true);
 offline=true;await b.click('#ios-tab-invoicing');await b.fill('[data-invoice="2"]','10');await b.click('#ios-tab-settings');await expect(b.locator('#sync-status')).toContainText('offline',{timeout:20000});expect(await b.evaluate(()=>calendarV64.getData().invoices['2027'][2])).toBe(10);
 offline=false;await b.reload();await b.click('#ios-tab-settings');await expect.poll(()=>row.payload.v64.invoices['2027'][2]).toBe(10);
 await b.click('#sync-out');await expect(b.locator('#sync-status')).toContainText('Signed out');
 for(const c of contexts)await c.close();
});
