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
      await page.clock.fastForward(12000);
      assert.equal(await page.locator('.mail-notice').isVisible(), true);
      assert.equal(await page.locator('.mail-window').count(), 0);
      assert.equal(await page.evaluate(() => document.activeElement.outerHTML), focused);
      assert.equal(await page.locator('audio').count(), 0);
      await page.locator('[data-mail-dismiss]').click();
      assert.equal(await page.locator('.mail-notice').isVisible(), false);
      await page.goto(base);
      await page.clock.fastForward(20000);
      assert.equal(await page.locator('.mail-notice').isVisible(), false);
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
