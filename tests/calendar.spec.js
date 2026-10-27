const {test,expect}=require('@playwright/test');
async function start(page){await page.route('https://cdnjs.cloudflare.com/**',r=>r.abort());await page.goto('/');await expect(page.locator('#ios-event-list .ios-event').first()).toBeVisible();}
test('five tabs, event names in months, mobile width and original desktop',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await start(page);
 expect(await page.locator('.ios-tabs button').count()).toBe(5);
 const original=await page.evaluate(()=>calendarApp.snapshot().selected);
 await page.click('#ios-tab-months');await expect(page.locator('#ios-month-list .ios-event').first()).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'/tmp/calendar-v64-mobile.png'});
 await page.click('#v64-full-calendar');await expect(page.locator('#calendarOnly')).toBeVisible();
 expect(await page.locator('#calendarOnly .month').count()).toBe(12);
 expect(await page.evaluate(()=>calendarApp.snapshot().selected)).toEqual(original);
 expect(errors).toEqual([]);
});
test('tariffs, taxes, invoicing, limit and all-year data survive reload and legacy restore',async({page})=>{
 await start(page);await page.click('#ios-tab-tariffs');
 await page.locator('[data-rate="ELMS"][data-field="clientWorkRate"]').fill('123.45');
 await page.locator('[data-rate="ELMS"][data-field="clientTravelRate"]').fill('67.89');
 await page.locator('[data-rate="ELMS"][data-field="clientHomeDays"]').fill('2');
 await page.locator('[data-rate="ELMS"][data-field="clientHomeRate"]').fill('50');
 await page.fill('#v64-tax','20');await page.click('#ios-tab-invoicing');
 await page.fill('[data-invoice="0"]','100.10');await page.fill('[data-invoice="1"]','200.20');await page.fill('#v64-limit','300');
 await expect(page.locator('#v64-totals')).toContainText('€300.30');await expect(page.locator('#v64-totals')).toContainText('Over limit: €0.30');
 const before=await page.evaluate(()=>{calendarApp.persist();return calendarApp.snapshot()});
 expect(before.rates.ELMS.work).toBe('123.45');expect(before.taxRatePercent).toBe(20);
 await page.reload();await expect(page.locator('#ios-event-list .ios-event').first()).toBeVisible();
 expect(await page.evaluate(()=>calendarApp.snapshot())).toEqual(before);
 await page.selectOption('#ios-year','2028');await page.click('#ios-tab-invoicing');await expect(page.locator('[data-invoice="0"]')).toHaveValue('0');
 await page.selectOption('#ios-year','2027');await page.click('#ios-tab-invoicing');await expect(page.locator('[data-invoice="0"]')).toHaveValue('100.1');
 await page.evaluate(s=>{delete s.v64;calendarApp.restore(s);calendarApp.persist()},before);
 expect(await page.evaluate(()=>calendarApp.snapshot().selected)).toEqual(before.selected);
 expect(await page.evaluate(()=>calendarV64.getData())).toEqual({invoices:{},annualLimit:0});
});
test('projection agrees with desktop annual counts and rounds actuals in cents',async({page})=>{
 await start(page);await page.evaluate(()=>{document.querySelectorAll('[data-rate-series]').forEach(r=>{r.querySelector('.clientWorkRate').value=100;r.querySelector('.clientTravelRate').value=50;r.querySelector('.clientHomeDays').value=3;r.querySelector('.clientHomeRate').value=10;r.querySelector('.clientRateCoef').value=1.2});refresh()});
 const result=await page.evaluate(()=>({projection:calendarV64.projection(),desktop:document.getElementById('moneyTOTALTotal').textContent,t:calendarV64.totals([0.1,0.2],0,1)}));
 expect(result.t.invoiced).toBe(0.3);expect(result.t.remaining).toBe(0.7);expect(result.desktop).toBe(new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(result.projection.total));
});
test('add event, switch years, reload and reject malformed backup without losing data',async({page})=>{
 await start(page);await page.selectOption('#ios-year','2028');await page.click('#ios-add');await page.fill('#ios-field-name','Synthetic endurance test');await page.fill('#ios-field-start','2028-02-28');await page.fill('#ios-field-end','2028-03-02');await page.click('#ios-form button[type=submit]');
 await expect(page.locator('#ios-event-list')).toContainText('Synthetic endurance test');
 await page.evaluate(()=>calendarApp.persist());const before=await page.evaluate(()=>calendarApp.snapshot());await page.reload();await expect(page.locator('#ios-event-list')).toContainText('Synthetic endurance test');
 expect(await page.evaluate(()=>{try{calendarApp.restore({year:2028,selected:{}});return false}catch(_){return true}})).toBe(true);
 expect(await page.evaluate(()=>calendarApp.snapshot())).toEqual(before);
});
test('desktop viewport and narrow iPhone layout',async({page})=>{
 await start(page);for(const width of [320,375,430,1440]){await page.setViewportSize({width,height:900});for(const tab of ['months','tariffs','invoicing','settings']){await page.click('#ios-tab-'+tab);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)}}
});
test('JSON and standalone HTML exports preserve V64 and omit credentials',async({page,context,browser})=>{
 await start(page);await page.click('#ios-tab-invoicing');await page.fill('[data-invoice="3"]','321.09');await page.evaluate(()=>calendarApp.persist());
 const state=await page.evaluate(()=>calendarApp.snapshot());
 await page.click('#ios-tab-settings');const jsonPromise=page.waitForEvent('download');await page.click('#ios-backup');const json=await jsonPromise;
 const fs=require('fs');expect(JSON.parse(fs.readFileSync(await json.path(),'utf8'))).toEqual(state);
 await page.click('#ios-desktop');const htmlPromise=page.waitForEvent('download');await page.click('#saveHtmlBtn');const html=await htmlPromise;const text=fs.readFileSync(await html.path(),'utf8');
 expect(text).not.toContain('script src="./');expect(text).toContain('321.09');
 const portableContext=await browser.newContext();const portable=await portableContext.newPage();const errors=[];portable.on('pageerror',e=>errors.push(e.message));
 await portable.route('**/portable.html',r=>r.fulfill({contentType:'text/html',body:text}));await portable.goto('http://127.0.0.1:8765/portable.html');await portable.waitForFunction(()=>!!window.calendarApp);
 expect(await portable.evaluate(()=>calendarApp.snapshot())).toEqual(state);expect(await portable.locator('#ios-year option').count()).toBe(10);expect(errors).toEqual([]);await portableContext.close();
 // Import the actual exported HTML into the current application.
 await page.click('#returnPhone');await page.click('#ios-tab-settings');page.once('dialog',d=>d.accept());
 await page.locator('#ios-import-file').setInputFiles({name:'saved.html',mimeType:'text/html',buffer:Buffer.from(text)});
 await expect(page.locator('#ios-status')).toContainText('Backup restored');expect(await page.evaluate(()=>calendarApp.snapshot())).toEqual(state);
});
test('installed app loads and edits offline with cached local assets',async({browser})=>{
 const context=await browser.newContext();const page=await context.newPage();await page.goto('http://127.0.0.1:8765');await page.waitForFunction(()=>!!window.calendarApp);await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await context.setOffline(true);await page.reload();await expect(page.locator('#ios-event-list .ios-event').first()).toBeVisible();await page.click('#ios-tab-invoicing');await page.fill('[data-invoice="4"]','45.67');await page.evaluate(()=>calendarApp.persist());await page.reload();await page.click('#ios-tab-invoicing');await expect(page.locator('[data-invoice="4"]')).toHaveValue('45.67');await context.close();
});
test('desktop image export, print preparation and ICS retain racing events',async({page})=>{
 test.setTimeout(60000);page.on('console',m=>{if(m.type()==='error')console.log(m.text())});await start(page);await page.click('#ios-tab-settings');await page.click('#ios-desktop');
 await page.evaluate(()=>{window.showSaveFilePicker=undefined;window.print=()=>{window.printCalled=true}});
 const downloadPromise=page.waitForEvent('download');await page.click('#copyCalendarBtn');await expect(page.locator('#copyStatus')).toHaveText('JPG downloaded',{timeout:20000});const download=await downloadPromise;
 expect(download.suggestedFilename()).toContain('.jpg');expect(require('fs').statSync(await download.path()).size).toBeGreaterThan(1000);
 await page.click('#pdfCalendarBtn');await page.waitForFunction(()=>window.printCalled);expect(await page.locator('#printSheet .month').count()).toBe(12);
 const ics=await page.evaluate(()=>buildCalendarIcs(calendarRuns()));expect(ics).toContain('BEGIN:VEVENT');expect(ics).toContain('Kyalami');
});
