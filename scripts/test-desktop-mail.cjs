/* Run after jekyll build and serving _site:
   PLAYWRIGHT_MODULE=/path/to/playwright node scripts/test-desktop-mail.cjs
   Optional: SITE_URL=http://127.0.0.1:4000 SCREENSHOT_DIR=/tmp/mail-preview */
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_URL || 'http://127.0.0.1:4000';

(async () => {
  const browser = await chromium.launch({headless: true, args: ['--no-sandbox']});
  let passed = 0;
  async function test(name, fn, options = {}) {
    const context = await browser.newContext({viewport:{width:1280,height:900}, reducedMotion:'reduce', ...options});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
    await page.clock.install();
    try {
      await fn(page, context);
      assert.deepEqual(errors, [], 'No JavaScript errors');
      console.log('PASS '+name); passed++;
    } finally { await context.close(); }
  }
  try {
    await test('Delayed welcome is optional and does not steal focus', async page => {
      await page.goto(base);
      await page.clock.fastForward(100);
      const focused = await page.evaluate(() => document.activeElement.outerHTML);
      assert.equal(await page.locator('.mail-notice').isVisible(), false);
      assert.equal(await page.locator('[data-mail-unread]').isVisible(), false);
      assert.equal(await page.locator('.mail-shortcut').evaluate(el=>el.classList.contains('mail-pending')), false);
      await page.clock.fastForward(12000);
      assert.equal(await page.locator('.mail-notice').isVisible(), true);
      assert.equal(await page.locator('[data-mail-unread]').isVisible(), true);
      assert.equal(await page.locator('.mail-shortcut').evaluate(el=>el.classList.contains('mail-pending')), true);
      assert.equal(await page.locator('.mail-window').count(), 0);
      assert.equal(await page.evaluate(() => document.activeElement.outerHTML), focused);
      assert.equal(await page.locator('audio').count(), 0);
      await page.locator('[data-mail-dismiss]').click();
      assert.equal(await page.locator('.mail-notice').isVisible(), false);
      await page.goto(base);
      await page.clock.fastForward(20000);
      assert.equal(await page.locator('.mail-notice').isVisible(), false);
      assert.equal(await page.locator('[data-mail-unread]').isVisible(), true);
    });
    await test('All three journeys, destinations, read badge and reopening', async page => {
      await page.goto(base);
      await page.clock.fastForward(13000);
      await page.locator('.mail-notice-open').click();
      await page.clock.fastForward(50);
      const mail = page.locator('.mail-window');
      assert.equal(await mail.isVisible(), true);
      assert.equal(await page.locator('[data-mail-unread]').isVisible(), false);
      for (const route of ['proyecto','experiencia','explorar']) {
        await mail.locator(`[data-mail-route="${route}"]`).click();
        assert.equal(await mail.locator(`[data-mail-route="${route}"]`).getAttribute('aria-pressed'), 'true');
        assert.equal(await mail.locator(`[data-mail-response="${route}"]`).isVisible(), true);
        assert.equal(await mail.locator('[data-mail-response]:not([hidden])').count(), 1);
        assert.equal(await mail.locator(`[data-mail-response="${route}"] h3`).evaluate(el => el === document.activeElement), true);
      }
      assert.equal(await mail.locator('[data-mail-response="experiencia"] a').getAttribute('href'), '/curriculum/');
      assert.ok((await mail.locator('[data-mail-response="proyecto"] a').getAttribute('href')).startsWith('mailto:'));
      await mail.locator('[data-mail-response="explorar"] [data-open="repos"]').click();
      assert.equal(await page.locator('.win.focused').getAttribute('aria-label'), 'Repositorios');
      await page.locator('.panel-contact').click();
      await mail.locator('[data-mail-response="explorar"] [data-open="terminal"]').click();
      await page.clock.fastForward(50);
      await page.locator('.term input').fill('cat correo');
      await page.locator('.term input').press('Enter');
      assert.equal(await mail.evaluate(el => el.classList.contains('focused')), true);
      await mail.locator('[data-act="close"]').click();
      await page.locator('.panel-contact').click();
      assert.equal(await page.locator('.mail-window [data-mail-response="explorar"]').isVisible(), true);
      if(process.env.SCREENSHOT_DIR) await page.screenshot({path:process.env.SCREENSHOT_DIR+'/desktop.png'});
      await page.reload();
      await page.clock.fastForward(15000);
      assert.equal(await page.locator('[data-mail-unread]').isVisible(), false);
      assert.equal(await page.locator('.mail-notice').isVisible(), false);
    });
    await test('Escape dismisses invitation without closing the current window', async page => {
      await page.goto(base);
      await page.clock.fastForward(13000);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.mail-notice').isVisible(), false);
      assert.equal(await page.locator('.win').count(), 1);
    });
    await test('Deep links do not trigger a welcome interruption', async page => {
      await page.goto(base+'/#experiencia');
      await page.clock.fastForward(20000);
      assert.equal(await page.locator('.mail-notice').isVisible(), false);
      assert.equal(await page.locator('.win.focused').getAttribute('aria-label'), 'Experiencia');
    });
    await test('Opening Correo before the delay cancels the invitation', async page => {
      await page.goto(base);
      await page.locator('.panel-contact').click();
      await page.clock.fastForward(20000);
      assert.equal(await page.locator('.mail-notice').isVisible(), false);
    });
    await test('Questionnaire before delivery does not create an unread message on reload', async page => {
      await page.goto(base);
      await page.locator('.desktop-contact').click();
      await page.clock.fastForward(20000);
      assert.equal(await page.locator('[data-mail-unread]').isVisible(), false);
      await page.goto(base+'/?mail-test=questionnaire');
      await page.clock.fastForward(20000);
      assert.equal(await page.locator('.mail-notice').isVisible(), false);
      assert.equal(await page.locator('[data-mail-unread]').isVisible(), false);
    });
    await test('Denied session storage does not break the app', async page => {
      await page.addInitScript(() => {Storage.prototype.getItem = Storage.prototype.setItem = function(){throw new Error('Storage denied');};});
      await page.goto(base);
      await page.clock.fastForward(13000);
      await page.locator('.mail-notice-open').click();
      assert.equal(await page.locator('.mail-window').isVisible(), true);
      await page.clock.fastForward(20000);
      assert.equal(await page.locator('.mail-notice').isVisible(), false);
    });
    await test('Mobile layout, accessible contact and routes', async page => {
      await page.goto(base+'/#correo');
      await page.clock.fastForward(100);
      const mail = page.locator('.mail-window');
      assert.equal(await page.locator('.panel-contact').isVisible(), true);
      assert.equal(await mail.isVisible(), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.equal(await mail.evaluate(el => el.scrollWidth <= el.clientWidth), true);
      await mail.locator('[data-mail-route="proyecto"]').click();
      assert.equal(await mail.locator('[data-mail-response="proyecto"]').isVisible(), true);
      if(process.env.SCREENSHOT_DIR) await page.screenshot({path:process.env.SCREENSHOT_DIR+'/mobile.png'});
    }, {viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    await test('Hidden tabs defer the welcome until the visitor returns', async page => {
      await page.goto(base);
      await page.clock.fastForward(1000);
      await page.evaluate(() => {Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
      await page.clock.fastForward(20000);
      assert.equal(await page.locator('.mail-notice').isVisible(), false);
      await page.evaluate(() => {Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});
      await page.clock.fastForward(12000);
      assert.equal(await page.locator('.mail-notice').isVisible(), true);
    });
    await test('Questionnaire remains an explicit option and initializes once', async page => {
      await page.route('https://cdn.jsdelivr.net/npm/@typebot.io/js@0/dist/web.js',route => route.fulfill({contentType:'text/javascript',body:'export default { initStandard(options) { window.typebotCalls=(window.typebotCalls||[]).concat([options]); } };'}));
      await page.goto(base+'/#correo');
      await page.locator('.mail-window [data-mail-route="proyecto"]').click();
      await page.locator('.mail-window [data-mail-response="proyecto"] [data-open="contacto"]').click();
      await page.waitForFunction(() => window.typebotCalls && window.typebotCalls.length === 1);
      assert.equal(await page.locator('.contact-window typebot-standard').count(), 1);
      assert.deepEqual(await page.evaluate(() => window.typebotCalls[0]), {typebot:'cuestionario-evaluacion-preparacion-ia',apiHost:'https://n1mbot.cloud'});
      await page.clock.fastForward(15000);
      assert.equal(await page.locator('.mail-notice').isVisible(), false);
    });
    await test('Narrow dark viewport keeps contact and mail within the screen', async page => {
      await page.goto(base+'/#correo');
      await page.clock.fastForward(100);
      assert.equal(await page.locator('.panel-contact').isVisible(), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      const box = await page.locator('.panel-contact').boundingBox();
      assert.ok(box.x >= 0 && box.x+box.width <= 320);
      if(process.env.SCREENSHOT_DIR) await page.screenshot({path:process.env.SCREENSHOT_DIR+'/dark-narrow.png'});
    },{viewport:{width:320,height:700},colorScheme:'dark'});
    await test('Welcome is available before the delayed reminder and reduced-motion skips nudges', async page => {
      await page.goto(base);
      assert.equal(await page.locator('.mail-notice').isVisible(),false);
      assert.equal(await page.locator('.mail-shortcut').evaluate(el=>el.classList.contains('mail-pending')),false);
      assert.equal(await page.locator('[data-mail-unread]').isVisible(),false);
      assert.equal(await page.locator('.mail-shortcut svg').evaluate(el=>getComputedStyle(el).animationName),'none');
      await page.locator('.panel-contact').click();
      assert.equal(await page.locator('.mail-window .mail-letter>h2').textContent(),'Hola, soy Aitor 👋');
      assert.ok((await page.locator('.mail-window .mail-letter').innerText()).includes('desarrollo'));
      assert.ok((await page.locator('.mail-window .mail-letter').innerText()).trim().split(/\s+/).length<100);
      assert.equal(await page.locator('.mail-shortcut').evaluate(el=>el.classList.contains('mail-pending')),false);
      await page.clock.fastForward(15000);
      assert.equal(await page.locator('.mail-notice').isVisible(),false);
    });
    await test('Mail client exposes three panes and real compose/reply actions',async page=>{
      await page.goto(base+'/#correo');
      const app=page.locator('.mail-window .mail-app');
      assert.equal(await app.evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),3);
      assert.equal(await app.locator('.mail-list').isVisible(),true);
      assert.equal(await app.locator('.mail-reader').isVisible(),true);
      assert.equal(await app.locator('[data-mail-message]').count(),1);
      assert.equal(await app.locator('.mail-compose').getAttribute('href'),'mailto:aitor@nimbox360.com');
      assert.ok((await app.locator('.mail-toolbar a').getAttribute('href')).startsWith('mailto:aitor@nimbox360.com?subject='));
      assert.equal(await app.locator('.mail-letter .mail-disclosure').textContent(),'Bienvenida automática. No es un chat en directo.');
      await app.locator('.mail-folder').click();
      await app.locator('[data-mail-message]').click();
      assert.equal(await app.locator('.mail-letter>h2').evaluate(el=>el===document.activeElement),true);
      if(process.env.SCREENSHOT_DIR)await page.screenshot({path:process.env.SCREENSHOT_DIR+'/mail-client.png'});
    });
    await test('Mobile mail switches between inbox and message without losing the journey',async page=>{
      await page.goto(base+'/#correo');
      const app=page.locator('.mail-window .mail-app');
      await app.locator('[data-mail-route="proyecto"]').click();
      await app.locator('.mail-back').click();
      assert.equal(await app.locator('.mail-list').isVisible(),true);
      assert.equal(await app.locator('.mail-reader').isVisible(),false);
      assert.equal(await app.locator('[data-mail-message]').evaluate(el=>el===document.activeElement),true);
      if(process.env.SCREENSHOT_DIR)await page.screenshot({path:process.env.SCREENSHOT_DIR+'/mail-inbox-mobile.png'});
      await app.locator('[data-mail-message]').click();
      assert.equal(await app.locator('.mail-list').isVisible(),false);
      assert.equal(await app.locator('.mail-reader').isVisible(),true);
      assert.equal(await app.locator('[data-mail-response="proyecto"]').isVisible(),true);
      assert.equal(await app.locator('.mail-letter>h2').evaluate(el=>el===document.activeElement),true);
      assert.equal(await app.evaluate(el=>el.scrollWidth<=el.clientWidth),true);
    },{viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    await test('Short presentation foregrounds development and direct contact',async page=>{
      await page.goto(base+'/#about');
      const hero=page.locator('.win.focused .profile-hero');
      const lede=await hero.locator('.lede').textContent();
      assert.ok(lede.trim().split(/\s+/).length<=20);
      assert.ok(lede.includes('Desarrollo aplicaciones'));
      assert.ok(lede.includes('infraestructura'));
      assert.ok(lede.includes('automatizo'));
      assert.equal(await hero.locator('.btn.primary').getAttribute('data-open'),'correo');
      assert.equal(await hero.locator('.profile-cv a').getAttribute('href'),'/curriculum/');
      assert.equal(await hero.locator('[data-open="servicios"]').count(),1);
      if(process.env.SCREENSHOT_DIR) await page.screenshot({path:process.env.SCREENSHOT_DIR+'/short-hero.png'});
      await hero.locator('[data-open="correo"]').click();
      if(process.env.SCREENSHOT_DIR) await page.screenshot({path:process.env.SCREENSHOT_DIR+'/short-mail.png'});
    });
    await test('Unread icon nudges once per ten seconds and stops after reading',async page=>{
      await page.addInitScript(()=>sessionStorage.setItem('aitoros-booted','1'));
      await page.goto(base);
      const icon=page.locator('.mail-shortcut svg');
      assert.equal(await icon.evaluate(el=>getComputedStyle(el).animationName),'none');
      await page.clock.fastForward(13000);
      assert.equal(await icon.evaluate(el=>getComputedStyle(el).animationName),'mail-nudge');
      assert.equal(await icon.evaluate(el=>getComputedStyle(el).animationDuration),'10s');
      await page.locator('.panel-contact').click();
      assert.equal(await icon.evaluate(el=>getComputedStyle(el).animationName),'none');
      await page.goto(base+'/#about');
      assert.equal(await page.locator('.mail-shortcut').evaluate(el=>el.classList.contains('mail-pending')),false);
    },{reducedMotion:'no-preference'});
    await test('Normal boot finishes before notification', async page => {
      await page.goto(base);
      assert.equal(await page.locator('#boot').isVisible(), true);
      await page.clock.fastForward(10000);
      await page.clock.fastForward(600); // endBoot schedules a 500ms fade-out
      assert.equal(await page.locator('#boot').isVisible(), false);
      assert.equal(await page.locator('.mail-notice').isVisible(), false);
      await page.clock.fastForward(13000);
      assert.equal(await page.locator('.mail-notice').isVisible(), true);
    }, {reducedMotion:'no-preference'});
    console.log(`${passed} checks passed`);
  } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
