// Build/serve _site; PLAYWRIGHT_MODULE=/path/to/playwright node scripts/test-desktop-g33k.cjs
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.SITE_URL || 'http://127.0.0.1:4000';
const videos=require('../_data/g33k-videos.json').videos;
(async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});let passed=0;
  async function test(name,fn,options={}){
    const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce',...options});
    const page=await context.newPage(),errors=[],youtube=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',r=>{
      const url=new URL(r.request().url());
      if(url.hostname==='www.youtube-nocookie.com'){
        youtube.push(url.href);return r.fulfill({contentType:'text/html',body:'<!doctype html><html><body>Mock playlist player</body></html>'});
      }
      return url.origin===new URL(base).origin?r.continue():r.abort();
    });
    try{await page.goto(base+'/#about');await fn(page,youtube);assert.deepEqual(errors,[]);console.log('PASS '+name);passed++;}
    finally{await context.close();}
  }
  try{
    await test('Desktop app opens locally and loads YouTube only on demand',async(page,youtube)=>{
      await page.locator('.desktop-g33k').click();
      const app=page.locator('.g33k-window');
      assert.equal(await app.getAttribute('aria-label'),'G33K TEAM · Vídeos');
      assert.equal(await app.locator('iframe').count(),0);assert.equal(youtube.length,0);
      assert.equal(await app.locator('.g33k-player').isVisible(),false);
      assert.equal(await app.locator('.g33k-feed').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),3);
      assert.equal(await app.locator('.g33k-heading img').evaluate(el=>el.complete&&el.naturalWidth>0),true);
      assert.ok((await app.locator('.g33k-heading img').getAttribute('src')).endsWith('/assets/images/g33k-team-app.jpg'));
      if(process.env.SCREENSHOT_DIR)await page.screenshot({path:process.env.SCREENSHOT_DIR+'/g33k-desktop.png'});
      await app.locator('.g33k-video').first().click();
      const frame=app.locator('iframe');await frame.waitFor();
      const url=new URL(await frame.getAttribute('src'));
      assert.equal(url.hostname,'www.youtube-nocookie.com');assert.equal(url.pathname,'/embed/'+videos[0].id);
      assert.equal(url.searchParams.get('autoplay'),null);
      assert.equal(await frame.getAttribute('title'),videos[0].title);
      assert.equal(await frame.getAttribute('referrerpolicy'),'strict-origin-when-cross-origin');
      assert.equal(await frame.getAttribute('allowfullscreen'),'');
      assert.equal(await app.locator('[data-g33k-player]').isVisible(),true);
      assert.equal(await app.locator('.g33k-video').count(),videos.length);
      assert.deepEqual(await app.locator('.g33k-video strong').allTextContents(),videos.map(v=>v.title));
      await app.locator('.g33k-video').nth(1).click();
      assert.equal(await app.locator('iframe').count(),1);
      assert.equal(new URL(await app.locator('iframe').getAttribute('src')).pathname,'/embed/'+videos[1].id);
      assert.equal(await app.locator('[data-g33k-title]').textContent(),videos[1].title);
      assert.equal(await app.locator('[data-g33k-external]').getAttribute('href'),videos[1].url);
      assert.equal(await app.locator('.g33k-video').nth(1).getAttribute('aria-pressed'),'true');
      assert.equal(await app.locator('.g33k-feed-heading a').getAttribute('href'),'https://www.youtube.com/@G33KTEAM/videos');
      await app.locator('[data-g33k-stop]').click();
      assert.equal(await app.locator('iframe').count(),0);
      assert.equal(await app.locator('.g33k-video').nth(1).evaluate(el=>el===document.activeElement),true);
      if(process.env.SCREENSHOT_DIR){
        await app.locator('.g33k-feed-heading').scrollIntoViewIfNeeded();
        await page.screenshot({path:process.env.SCREENSHOT_DIR+'/g33k-feed.png'});
      }

    });
    await test('Minimizing, hidden tabs and closing unload the player',async page=>{
      await page.goto(base+'/#g33k');
      const app=page.locator('.g33k-window');
      await app.locator('.g33k-video').first().click();
      await app.locator('[data-act=min]').click();
      assert.equal(await app.locator('iframe').count(),0);
      await page.locator('.dock-apps [data-open=g33k]').click();
      assert.equal(await app.locator('.g33k-video').first().isVisible(),true);
      await app.locator('.g33k-video').first().click();
      await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
      assert.equal(await app.locator('iframe').count(),0);
      await app.locator('[data-act=close]').click();
      assert.equal(await page.locator('.g33k-window').count(),0);
    });
    await test('App search, keyboard and terminal can open G33K TEAM',async page=>{
      await page.locator('[data-apps-toggle]').click();
      await page.locator('[data-apps-search]').fill('videos');
      assert.equal(await page.locator('.app-grid .icon:not([hidden])').count(),1);
      await page.locator('[data-apps-search]').press('Enter');
      assert.equal(await page.locator('.g33k-window').isVisible(),true);
      await page.locator('.g33k-window [data-act=close]').click();
      await page.locator('.dock-apps [data-open=terminal]').click();
      await page.locator('.term input').fill('cat g33k');await page.locator('.term input').press('Enter');
      assert.equal(await page.locator('.win.focused').getAttribute('aria-label'),'G33K TEAM · Vídeos');
    });
    await test('Mobile app and player stay within the desktop',async page=>{
      await page.goto(base+'/#g33k');
      const app=page.locator('.g33k-window');
      assert.equal(await app.isVisible(),true);
      assert.equal(await app.evaluate(el=>el.scrollWidth<=el.clientWidth),true);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      assert.equal(await app.locator('.g33k-player').isVisible(),false);
      await app.locator('.g33k-video').first().click();assert.equal(await app.locator('iframe').count(),1);
      const player=await app.locator('.g33k-player').boundingBox();assert.ok(player.width>=200&&player.height>=200);
      if(process.env.SCREENSHOT_DIR)await page.screenshot({path:process.env.SCREENSHOT_DIR+'/g33k-mobile.png'});
    },{viewport:{width:320,height:700},isMobile:true,hasTouch:true});
    console.log(passed+' G33K TEAM checks passed');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
