// Build/serve _site; PLAYWRIGHT_MODULE=/path/to/playwright node scripts/test-mobile-panel.cjs
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.SITE_URL || 'http://127.0.0.1:4000';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});let passed=0;
 async function test(name,fn,options={}){
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',...options});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
  try{await page.goto(base+'/#about');await fn(page);assert.deepEqual(errors,[]);console.log('PASS '+name);passed++;}
  finally{await context.close();}
 }
 try{
  await test('Mobile panel remains unclipped with 44px controls at narrow widths',async page=>{
   for(const width of [320,360,390,430,720]){
    await page.setViewportSize({width,height:844});
    assert.equal(await page.locator('.panel .tasks').isVisible(),false);
    assert.equal(await page.locator('.panel .simplebtn').isVisible(),false);
    assert.equal(await page.locator('.panel [data-mail-sound]').isVisible(),false);
    for(const selector of ['.panel .brand','.panel-contact','[data-panel-menu-toggle]']){
     const box=await page.locator(selector).boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width);assert.ok(box.height>=44);
    }
    assert.equal(await page.locator('.panel').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
    const panel=await page.locator('.panel').boundingBox(),win=await page.locator('.win.focused').boundingBox();assert.equal(panel.height,56);assert.equal(win.y,panel.y+panel.height);
   }
   await page.setViewportSize({width:390,height:844});
   if(process.env.SCREENSHOT_DIR)await page.screenshot({path:process.env.SCREENSHOT_DIR+'/mobile-panel.png'});
  });
  await test('Mobile options expose persistent sound and Escape restores focus',async page=>{
   const toggle=page.locator('[data-panel-menu-toggle]'),sound=page.locator('[data-mail-sound]');
   await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'true');
   assert.equal(await sound.evaluate(el=>el===document.activeElement),true);
   assert.equal(await page.locator('.panel .simplebtn').isVisible(),true);
   await sound.click();assert.equal(await sound.getAttribute('aria-pressed'),'false');
   assert.equal(await page.locator('.sound-label').textContent(),'Sonido desactivado');
   assert.equal(await page.evaluate(()=>localStorage.getItem('aitoros-mail-sound')),'off');
   if(process.env.SCREENSHOT_DIR)await page.screenshot({path:process.env.SCREENSHOT_DIR+'/mobile-panel-options.png'});
   await page.keyboard.press('Escape');assert.equal(await toggle.getAttribute('aria-expanded'),'false');
   assert.equal(await toggle.evaluate(el=>el===document.activeElement),true);
   assert.equal(await page.locator('.win').count(),1);
   await toggle.click();await page.locator('.panel-contact').click();
   assert.equal(await toggle.getAttribute('aria-expanded'),'false');assert.equal(await page.locator('.mail-window').isVisible(),true);
  });
  await test('Vista simple remains reachable from mobile options',async page=>{
   await page.route(base+'/simple/',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><body>Simple view destination</body></html>'}));
   await page.locator('[data-panel-menu-toggle]').click();await page.locator('.panel .simplebtn').click();
   await page.waitForURL(base+'/simple/');assert.equal(new URL(page.url()).pathname,'/simple/');
  });
  await test('Desktop keeps direct controls and resizing closes mobile options',async page=>{
   await page.locator('[data-panel-menu-toggle]').click();await page.setViewportSize({width:1280,height:900});
   assert.equal(await page.locator('[data-panel-menu-toggle]').isVisible(),false);
   assert.equal(await page.locator('.panel .tasks').isVisible(),true);
   assert.equal(await page.locator('.panel .simplebtn').isVisible(),true);
   assert.equal(await page.locator('[data-mail-sound]').isVisible(),true);
   assert.equal(await page.locator('.panel').evaluate(el=>el.getBoundingClientRect().height),38);
   await page.setViewportSize({width:390,height:844});
   assert.equal(await page.locator('[data-panel-menu-toggle]').getAttribute('aria-expanded'),'false');
   assert.equal(await page.locator('.panel .simplebtn').isVisible(),false);
  });
  console.log(passed+' mobile panel checks passed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
