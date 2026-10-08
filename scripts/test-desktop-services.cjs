// Build and serve _site. PLAYWRIGHT_MODULE=/path/to/playwright node scripts/test-desktop-services.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.SITE_URL || 'http://127.0.0.1:4000';
(async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});let passed=0;
  async function test(name,fn,options={}){
    const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce',acceptDownloads:true,...options});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
    try{await page.goto(base+'/#about');await fn(page,context);assert.deepEqual(errors,[]);console.log('PASS '+name);passed++;}
    finally{await context.close();}
  }
  try{
    await test('Desktop file opens the full catalogue with a working outline',async page=>{
      await page.locator('.desktop-services').click();
      const doc=page.locator('.document-window');
      assert.equal(await doc.getAttribute('aria-label'),'Servicios.rtf · Documento');
      assert.equal(await doc.locator('.services-content li').count(),46);
      assert.equal(await doc.locator('.services-content h2').count(),11);
      assert.equal(await doc.locator('[data-document-heading]').count(),11);
      assert.equal(await doc.locator('[data-document-status]').textContent(),'46 servicios · 11 áreas · Fuente: catálogo original');
      const markdown=fs.readFileSync(path.join(__dirname,'../_includes/servicios.md'),'utf8');
      const categories=[...markdown.matchAll(/^## (.+)$/gm)].map(x=>x[1]);
      assert.deepEqual(await doc.locator('.services-content h2').allTextContents(),categories);
      const items=[...markdown.matchAll(/^- \*\*(.+?)\*\*/gm)].map(x=>x[1]);
      assert.deepEqual(await doc.locator('.services-content li').evaluateAll(items=>items.map(li=>li.querySelector('strong').textContent)),items);
      if(process.env.SCREENSHOT_DIR) await page.screenshot({path:process.env.SCREENSHOT_DIR+'/services-desktop.png'});
      await doc.locator('[data-document-heading]').last().click();
      assert.ok(await doc.locator('.document-scroll').evaluate(el=>el.scrollTop)>500);
      assert.equal(await doc.locator('.services-content h2').last().evaluate(el=>el===document.activeElement),true);
      await doc.locator('.services-contact [data-open="correo"]').click();
      assert.equal(await page.locator('.mail-window').isVisible(),true);
    });
    await test('RTF download contains the original file bytes',async page=>{
      await page.goto(base+'/#servicios');
      const [download]=await Promise.all([page.waitForEvent('download'),page.locator('.document-window .document-toolbar a[download]').click()]);
      assert.equal(download.suggestedFilename(),'servicios.rtf');
      const received=fs.readFileSync(await download.path());
      assert.deepEqual(received,fs.readFileSync(path.join(__dirname,'../assets/documents/servicios.rtf')));
    });
    await test('Services are searchable and cat SERVICIOS.rtf opens the document',async page=>{
      await page.locator('[data-apps-toggle]').click();
      await page.locator('[data-apps-search]').fill('servicios');
      assert.equal(await page.locator('.app-grid .icon:not([hidden])').count(),1);
      await page.locator('.app-grid [data-open="servicios"]').click();
      assert.equal(await page.locator('.document-window').isVisible(),true);
      await page.locator('.document-window [data-act="close"]').click();
      await page.locator('.dock-apps [data-open="terminal"]').click();
      await page.locator('.term input').fill('cat SERVICIOS.rtf');await page.locator('.term input').press('Enter');
      assert.equal(await page.locator('.win.focused').getAttribute('aria-label'),'Servicios.rtf · Documento');
    });
    await test('Mobile document is readable and reachable from the mail journey',async page=>{
      await page.goto(base+'/#correo');
      await page.locator('.mail-window [data-mail-route="proyecto"]').click();
      await page.locator('.mail-window [data-open="servicios"]').click();
      const doc=page.locator('.document-window');
      assert.equal(await doc.isVisible(),true);
      assert.equal(await doc.locator('.document-outline').isVisible(),false);
      assert.equal(await doc.locator('.document-scroll').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      const box=await doc.boundingBox(),dock=await page.locator('.icons').boundingBox();assert.ok(box.y+box.height<=dock.y+1);
      if(process.env.SCREENSHOT_DIR) await page.screenshot({path:process.env.SCREENSHOT_DIR+'/services-mobile.png'});
    },{viewport:{width:390,height:844},isMobile:true,hasTouch:true,colorScheme:'dark'});
    await test('Standalone services page exposes the same catalogue and return link',async page=>{
      // The existing shared layout loads Ko-fi; isolate this external widget in this content test.
      await page.route('https://storage.ko-fi.com/cdn/scripts/overlay-widget.js',r=>r.fulfill({contentType:'text/javascript',body:'window.kofiWidgetOverlay={draw(){}};'}));
      await page.goto(base+'/servicios/');
      assert.equal(await page.locator('.services-content li').count(),46);
      assert.equal(await page.locator('.services-content h2').count(),11);
      assert.equal(await page.locator('.services-page-links a').first().getAttribute('href'),'/#servicios');
      await page.locator('.services-page-links a').first().click();
      assert.equal(await page.locator('.document-window').isVisible(),true);
    });
    console.log(passed+' services checks passed');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
