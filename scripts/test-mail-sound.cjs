// PLAYWRIGHT_MODULE=/path/to/playwright node scripts/test-mail-sound.cjs
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.SITE_URL || 'http://127.0.0.1:4000';
function installMock(){
  window.mailAudioProbe={contexts:0,resumes:0,notes:[],gains:[],stops:[]};
  class MockAudio{
    constructor(){window.mailAudioProbe.contexts++;this.state='suspended';this.currentTime=10;this.destination={};}
    resume(){window.mailAudioProbe.resumes++;this.state='running';return Promise.resolve();}
    createOscillator(){
      const note={};window.mailAudioProbe.notes.push(note);
      return {frequency:{setValueAtTime(v,t){note.frequency=v;note.frequencyTime=t;}},connect(){},disconnect(){},start(t){note.start=t;},stop(t){window.mailAudioProbe.stops.push(t);note.end=t;}};
    }
    createGain(){return {gain:{setValueAtTime(v,t){window.mailAudioProbe.gains.push([v,t]);},linearRampToValueAtTime(v,t){window.mailAudioProbe.gains.push([v,t]);},exponentialRampToValueAtTime(v,t){window.mailAudioProbe.gains.push([v,t]);},cancelScheduledValues(){}},connect(){},disconnect(){}};}
  }
  window.AudioContext=MockAudio;
}
(async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});let passed=0;
  async function test(name,fn,init=installMock){
    const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
    if(init) await page.addInitScript(init);
    await page.clock.install();
    try{await page.goto(base);await fn(page);assert.deepEqual(errors,[]);console.log('PASS '+name);passed++;}
    finally{await context.close();}
  }
  try{
    await test('No forced autoplay before visitor interaction',async page=>{
      await page.clock.fastForward(13000);
      assert.equal(await page.locator('.mail-notice').isVisible(),true);
      assert.equal(await page.evaluate(()=>window.mailAudioProbe.contexts),0);
      assert.equal(await page.evaluate(()=>window.mailAudioProbe.notes.length),0);
    });
    await test('Trusted interaction unlocks one short, low-volume chime on arrival',async page=>{
      await page.mouse.click(1100,550);
      assert.equal(await page.evaluate(()=>window.mailAudioProbe.contexts),1);
      await page.clock.fastForward(13000);
      const probe=await page.evaluate(()=>window.mailAudioProbe);
      assert.deepEqual(probe.notes.map(n=>n.frequency),[660,880]);
      assert.ok(probe.notes[1].end-probe.notes[0].start<.4);
      assert.ok(probe.gains.every(([v])=>v<=.035));
      await page.clock.fastForward(20000);
      assert.equal(await page.evaluate(()=>window.mailAudioProbe.notes.length),2);
      await page.locator('.mail-notice-open').click();
      assert.equal(await page.evaluate(()=>window.mailAudioProbe.notes.length),2);
    });
    await test('Mute preference persists and enabling it permits the next arrival',async page=>{
      await page.locator('[data-mail-sound]').click();
      assert.equal(await page.locator('[data-mail-sound]').getAttribute('aria-pressed'),'false');
      await page.goto(base+'/?sound-test=mute'); // fresh arrival, same persisted preference
      assert.equal(await page.locator('[data-mail-sound]').getAttribute('aria-label'),'Activar sonido del correo');
      await page.mouse.click(1100,550);
      assert.equal(await page.evaluate(()=>window.mailAudioProbe.contexts),0);
      await page.locator('[data-mail-sound]').click();
      assert.equal(await page.locator('[data-mail-sound]').getAttribute('aria-pressed'),'true');
      await page.clock.fastForward(13000);
      assert.equal(await page.evaluate(()=>window.mailAudioProbe.notes.length),2);
      await page.locator('[data-mail-sound]').click();
      assert.equal(await page.evaluate(()=>window.mailAudioProbe.stops.length),4);
    });
    await test('Muted notification remains visible without playing tones',async page=>{
      await page.locator('[data-mail-sound]').click();
      await page.clock.fastForward(13000);
      assert.equal(await page.locator('.mail-notice').isVisible(),true);
      assert.equal(await page.evaluate(()=>window.mailAudioProbe.notes.length),0);
    });
    await test('Unsupported audio preserves the visual notification',async page=>{
      await page.mouse.click(1100,550);await page.clock.fastForward(13000);
      assert.equal(await page.locator('.mail-notice').isVisible(),true);
    },()=>{window.AudioContext=undefined;window.webkitAudioContext=undefined;});
    await test('Native Web Audio resumes after a real click and creates both tones',async page=>{
      await page.mouse.click(1100,550);
      await page.waitForFunction(()=>window.nativeMailAudio && window.nativeMailAudio.state==='running');
      await page.clock.fastForward(13000);
      assert.equal(await page.evaluate(()=>window.nativeMailToneCount),2);
    },()=>{
      const NativeAudio=window.AudioContext;
      window.nativeMailToneCount=0;
      window.AudioContext=class extends NativeAudio{
        constructor(){super();window.nativeMailAudio=this;}
        createOscillator(){window.nativeMailToneCount++;return super.createOscillator();}
      };
    });
    console.log(passed+' mail sound checks passed');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
