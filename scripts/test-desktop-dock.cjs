// Build/serve _site, then run with PLAYWRIGHT_MODULE=/path/to/playwright.
const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.SITE_URL || 'http://127.0.0.1:4000';
(async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  let passed=0;
  async function test(name,fn,options={}){
    const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce',...options});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
    try{await page.goto(base+'/#about');await fn(page);assert.deepEqual(errors,[]);console.log('PASS '+name);passed++;}
    finally{await context.close();}
  }
  try{
    await test('Dock indicates open, focused and minimized windows',async page=>{
      const about=page.locator('.dock-apps [data-open="about"]'),mail=page.locator('.dock-apps [data-open="correo"]');
      assert.equal(await about.getAttribute('aria-pressed'),'true');
      await about.click();
      assert.equal(await about.getAttribute('aria-pressed'),'false');
      assert.equal(await about.evaluate(el=>el.classList.contains('running')),true);
      assert.equal(await page.locator('.win').isVisible(),false);
      await about.click();assert.equal(await about.getAttribute('aria-pressed'),'true');
      await mail.click();assert.equal(await mail.getAttribute('aria-pressed'),'true');
      assert.equal(await about.getAttribute('aria-pressed'),'false');
      await page.locator('.mail-window [data-act="close"]').click();
      assert.equal(await mail.evaluate(el=>el.classList.contains('running')),false);
      assert.equal(await about.getAttribute('aria-pressed'),'true');
    });
    await test('App overview has all apps, keyboard trap and focus restoration',async page=>{
      const toggle=page.locator('[data-apps-toggle]');
      await toggle.click();
      assert.equal(await toggle.getAttribute('aria-expanded'),'true');
      assert.equal(await page.locator('#windows').evaluate(el=>el.inert),true);
      assert.equal(await page.locator('.app-grid .icon').count(),12);
      await page.keyboard.press('Shift+Tab');
      assert.equal(await page.locator('.app-grid .icon').last().evaluate(el=>el===document.activeElement),true);
      await page.keyboard.press('Tab');
      assert.equal(await page.locator('[data-apps-search]').evaluate(el=>el===document.activeElement),true);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.apps-overlay').isVisible(),false);
      assert.equal(await page.locator('#windows').evaluate(el=>el.inert),false);
      assert.equal(await toggle.evaluate(el=>el===document.activeElement),true);
      assert.equal(await page.locator('.win').count(),1);
      await toggle.click();await page.locator('.app-grid [data-open="experiencia"]').click();
      assert.equal(await page.locator('.win.focused').getAttribute('aria-label'),'Experiencia');
      assert.equal(await page.locator('.apps-overlay').isVisible(),false);
    });
    await test('Full-screen frosted overview filters accents, aliases and multiple terms',async page=>{
      await page.locator('[data-apps-toggle]').click();
      const search=page.locator('[data-apps-search]');
      assert.equal(await search.evaluate(el=>el===document.activeElement),true);
      const dialog=await page.locator('.apps-dialog').boundingBox();
      assert.equal(dialog.width,1280);assert.equal(dialog.height,900);
      assert.equal(await page.locator('.apps-overlay').evaluate(el=>getComputedStyle(el).backdropFilter.includes('blur')),true);
      await search.fill('CÓDIGO');
      assert.equal(await page.locator('.app-grid .icon:not([hidden])').count(),1);
      assert.equal(await page.locator('.app-grid [data-open="repos"]').isVisible(),true);
      await search.fill('open source');
      assert.equal(await page.locator('.app-grid .icon:not([hidden])').count(),1);
      await search.fill('contacto');
      assert.equal(await page.locator('.app-grid [data-open="correo"]').isVisible(),true);
      await search.fill('no existe esta app');
      assert.equal(await page.locator('.apps-empty').isVisible(),true);
      assert.equal(await page.locator('.app-grid .icon:not([hidden])').count(),0);
      await page.keyboard.press('Tab');
      assert.equal(await page.locator('[data-apps-close]').evaluate(el=>el===document.activeElement),true);
      await page.keyboard.press('Tab');
      assert.equal(await search.evaluate(el=>el===document.activeElement),true);
      await page.keyboard.press('Escape');
      await page.locator('[data-apps-toggle]').click();
      assert.equal(await search.inputValue(),'');
      assert.equal(await page.locator('.app-grid .icon:not([hidden])').count(),12);
      await search.fill('proyectos');await search.press('Enter');
      assert.equal(await page.locator('.apps-overlay').isVisible(),false);
      assert.equal(await page.locator('.win.focused').getAttribute('aria-label'),'Proyectos');
    });
    await test('Full-screen overview scrolls on mobile without horizontal overflow',async page=>{
      await page.locator('[data-apps-toggle]').click();
      assert.equal(await page.locator('[data-apps-search]').evaluate(el=>el===document.activeElement),false);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      assert.equal(await page.locator('.apps-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
      assert.equal(await page.locator('.apps-scroll').evaluate(el=>el.scrollHeight>el.clientHeight),true);
      await page.locator('[data-apps-search]').fill('ia');
      assert.equal(await page.locator('.app-grid [data-open="contacto"]').isVisible(),true);
      await page.locator('[data-apps-search]').fill('');
      if(process.env.SCREENSHOT_DIR) await page.screenshot({path:process.env.SCREENSHOT_DIR+'/overview-mobile.png'});
    },{viewport:{width:390,height:650},isMobile:true,hasTouch:true});
    await test('Maximized window respects the desktop dock',async page=>{
      await page.locator('.win.focused [data-act="max"]').click();
      const box=await page.locator('.win.focused').boundingBox();
      assert.equal(box.x,76);assert.equal(Math.round(box.width),1280-76);
      await page.locator('[data-apps-toggle]').click();
      if(process.env.SCREENSHOT_DIR) await page.screenshot({path:process.env.SCREENSHOT_DIR+'/dock-apps.png'});
    });
    await test('Small-height dock scrolls and keeps launcher reachable',async page=>{
      assert.equal(await page.locator('[data-apps-toggle]').isVisible(),true);
      const box=await page.locator('[data-apps-toggle]').boundingBox();assert.ok(box.y+box.height<=480);
      assert.equal(await page.locator('.dock-apps').evaluate(el=>el.scrollHeight>el.clientHeight),true);
      await page.locator('.dock-apps [data-open="terminal"]').click();
      assert.equal(await page.locator('.win.focused').getAttribute('aria-label'),'aitor@aitoros: ~');
    },{viewport:{width:1024,height:480}});
    await test('Mobile bottom dock stays available and reserves content space',async page=>{
      const window=await page.locator('.win.focused').boundingBox(),dock=await page.locator('.icons').boundingBox();
      assert.ok(window.y+window.height<=dock.y+1);
      const toggle=page.locator('[data-apps-toggle]');assert.equal(await toggle.isVisible(),true);
      await toggle.click();
      const box=await page.locator('.apps-dialog').boundingBox();assert.ok(box.x>=0 && box.x+box.width<=320);
      await page.locator('.app-grid [data-open="repos"]').click();
      assert.equal(await page.locator('.win.focused').getAttribute('aria-label'),'Repositorios');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      if(process.env.SCREENSHOT_DIR) await page.screenshot({path:process.env.SCREENSHOT_DIR+'/dock-mobile.png'});
    },{viewport:{width:320,height:700},isMobile:true,hasTouch:true,colorScheme:'dark'});
    await test('External shortcut keeps correct URL and new-tab behavior',async page=>{
      const link=page.locator('.dock-apps a');
      assert.equal(await link.getAttribute('href'),'https://nimboxsre.com');
      assert.equal(await link.getAttribute('target'),'_blank');
      assert.equal(await page.locator('.desktop-contact span').textContent(),'Cuestionario IA');
      assert.equal(await page.locator('.desktop-contact').getAttribute('data-open'),'contacto');
      assert.equal(await page.locator('.panel-contact').getAttribute('data-open'),'correo');
      await page.locator('[data-apps-toggle]').click();
      assert.equal(await page.locator('.app-grid a').getAttribute('href'),'https://nimboxsre.com');
      if(process.env.SCREENSHOT_DIR){await page.locator('[data-apps-close]').click();await page.screenshot({path:process.env.SCREENSHOT_DIR+'/dock-desktop.png'});}
    });
    console.log(passed+' dock checks passed');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
