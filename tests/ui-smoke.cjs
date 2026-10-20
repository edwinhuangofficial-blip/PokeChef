// Run with Node and Playwright installed, or with the bundled Node runtime.
let chromium;
try { ({chromium}=require('playwright')); }
catch { ({chromium}=require(require('node:path').join(require('node:path').dirname(process.execPath),'..','node_modules','playwright'))); }
const assert=require('node:assert/strict');
const fs=require('node:fs');
const cp=require('node:child_process');
const http=require('node:http');
const path=require('node:path');
(async()=>{
 const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const file=path.join(process.cwd(),pathname==='/'?'index.html':pathname);
  if(!file.startsWith(process.cwd()+path.sep)){res.writeHead(403).end();return}
  try{const content=fs.readFileSync(file);res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':file.endsWith('.svg')?'image/svg+xml':'text/html');res.end(content)}catch{res.writeHead(404).end()}
 });
 await new Promise(resolve=>server.listen(8766,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,channel:'chrome',args:['--no-proxy-server']});
 try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const screenshotDir=process.env.POKECHEF_SCREENSHOT_DIR||require('node:os').tmpdir();
 page.setDefaultTimeout(10000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8766');
 const favicon=await page.request.get('http://127.0.0.1:8766/static/favicon.svg?v=3');assert.equal(favicon.status(),200);assert.match(await favicon.text(),/stroke="#fff"/);
 await page.getByRole('button',{name:'Let’s cook',exact:true}).click();
 assert.equal((await page.locator('.welcome-card').allTextContents())[2].trim(),'Review my team');
 assert.equal(await page.locator('.sidebar-dex .external-arrow').getAttribute('stroke-width'),'4');
 await page.waitForTimeout(3000);
 const loaded=await page.locator('#pokemon-background img').evaluateAll(a=>a.filter(i=>i.complete&&i.naturalWidth).length);
 assert(loaded>0,'background images load');
 const before=cp.execFileSync('git',['show','HEAD:index.html'],{encoding:'utf8'}).match(/<label class="theme-toggle">[\s\S]*?<\/label>/)[0];
 const after=fs.readFileSync('index.html','utf8').match(/<label class="theme-toggle">[\s\S]*?<\/label>/)[0];
 assert.equal(after.replaceAll('\r\n','\n'),before.replaceAll('\r\n','\n'),'original slider markup');
 const toggle=page.getByRole('switch',{name:'Dark mode'});
 await page.locator('.theme-track').click();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
 const track=await page.locator('.theme-track').boundingBox();assert.equal(track.width,52);assert.equal(track.height,23);
 await page.locator('.theme-track').click();
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 await page.locator('#art-style').selectOption('artwork');
 await page.getByRole('button',{name:'Close settings'}).click();
 assert.equal(await page.locator('.app').getAttribute('data-art-style'),'artwork');
 await page.reload();assert.equal(await page.locator('#about-dialog').evaluate(e=>e.open),false);assert.equal(await page.locator('#art-style').inputValue(),'artwork');
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 await page.locator('#art-style').selectOption('off');assert.equal(await page.locator('#pokemon-background img').count(),0);
 await page.locator('#art-style').selectOption('pixel');await page.getByRole('button',{name:'Shuffle Pokémon'}).click();
 await page.getByRole('button',{name:'Close settings'}).click();
 await page.getByRole('button',{name:'Type matchups'}).click();assert.match(await page.locator('#message-input').inputValue(),/weaknesses/);
 await page.route('**/api/chat',r=>r.fulfill({json:{answer:'Mocked chat reply'}}));
 await page.locator('#message-input').fill('Tell me about Pikachu');await page.getByRole('button',{name:'Send message'}).click();await page.getByText('Mocked chat reply',{exact:true}).waitFor();
 await page.locator('.theme-track').click();
 assert.deepEqual(await page.locator('.message.assistant').evaluate(e=>[getComputedStyle(e).backgroundColor,getComputedStyle(e).color]),['rgb(0, 0, 0)','rgb(255, 255, 255)']);
 assert.deepEqual(await page.locator('.message.user').evaluate(e=>[getComputedStyle(e).backgroundColor,getComputedStyle(e).color]),['rgb(255, 255, 255)','rgb(0, 0, 0)']);
 await page.screenshot({path:path.join(screenshotDir,'pokechef-dark-chat.png')});
 await page.locator('.theme-track').click();
 await page.getByRole('button',{name:'Rename Tell me about Pikachu',exact:true}).click();
 assert.equal(await page.locator('#chat-name-input').inputValue(),'Tell me about Pikachu');
 await page.locator('#rename-chat-dialog').getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('button',{name:'Rename Tell me about Pikachu',exact:true}).click();
 await page.locator('#chat-name-input').fill('   ');await page.locator('#rename-chat-dialog').getByRole('button',{name:'Save',exact:true}).click();assert(await page.locator('#rename-chat-dialog').evaluate(e=>e.open));
 await page.locator('#chat-name-input').fill('Dragonite notes');await page.locator('#rename-chat-dialog').getByRole('button',{name:'Save',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'Dragonite notes',exact:true}).count(),1);
 await page.reload();await page.getByText('Mocked chat reply',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Dragonite notes',exact:true}).count(),1);
 for(const logo of ['#home-link','.sidebar-brand']) {
  await page.locator(logo).click();assert.equal(await page.locator('.chat-welcome').count(),1);
  await page.getByRole('button',{name:'Dragonite notes',exact:true}).click();await page.getByText('Mocked chat reply',{exact:true}).waitFor();
 }
 await page.unroute('**/api/chat');await page.route('**/api/chat',r=>r.fulfill({json:{answer:('Long response line.\n').repeat(200)}}));
 await page.locator('#message-input').fill('Give me a long answer');await page.locator('#send-button').click();await page.waitForFunction(()=>document.querySelector('.message.assistant:last-child')?.textContent.includes('Long response line.'));
 assert.equal(await page.locator('#messages').evaluate(e=>getComputedStyle(e).overflowY),'visible');assert(await page.locator('#chat-panel').evaluate(e=>e.getBoundingClientRect().height>innerHeight*2),'chat grows with its content');assert(await page.evaluate(()=>scrollY>innerHeight),'document scrolls to the answer');
 let previewCalls=0;await page.route('**/api/team/preview',r=>{previewCalls++;return r.abort()});
 const moveTypes={'dragon-dance':'dragon','extreme-speed':'normal','earthquake':'ground','roost':'flying','magma-storm':'fire','earth-power':'ground','stealth-rock':'rock','taunt':'dark','defog':'flying','body-press':'fighting','u-turn':'bug','aurora-veil':'ice','encore':'normal','freeze-dry':'ice','snowscape':'ice','waterfall':'water','iron-head':'steel'};
 await page.route('https://pokeapi.co/api/v2/move/**',route=>{
  const slug=route.request().url().split('/').pop();return route.fulfill({json:{type:{name:moveTypes[slug]||'normal'}}});
 });
 await page.locator('#import-shortcut').click();
 assert.equal(new URL(page.url()).hash,'#review');assert.equal(await page.locator('#chat-panel').isVisible(),false);assert.equal(await page.locator('#import-dialog').count(),0);
 assert.equal(await page.locator('.chat-row.selected').count(),0,'review view clears chat highlighting');assert.equal(await page.locator('.chat-select[aria-current="true"]').count(),0);
 await page.getByRole('button',{name:'Back to chat',exact:true}).click();assert.equal(await page.locator('#chat-panel').isVisible(),true);assert.equal(await page.locator('#review-panel').isVisible(),false);
 assert.equal(await page.locator('.chat-row.selected').count(),1,'chat selection returns in chat view');
 await page.goBack();assert.equal(await page.locator('#review-panel').isVisible(),true);
 await page.locator('#team-input').fill('Pikachu\nEVs: 999 Atk');await page.locator('#preview-button').click();assert.match(await page.locator('#import-error').textContent(),/EVs/);assert.equal(await page.locator('#import-page').isVisible(),true);
 await page.getByRole('button',{name:'Load Example'}).click();assert.match(await page.locator('#team-input').inputValue(),/Dragonite/);
 const extraSets=['Ninetales-Alola @ Light Clay\nAbility: Snow Warning\nGender: F\nTera Type: Water\nTimid Nature\nEVs: 248 HP / 8 Def / 252 Spe\nIVs: 0 Atk\n- Aurora Veil\n- Encore\n- Freeze-Dry\n- Snowscape','Gyarados @ Leftovers\nAbility: Intimidate\nGender: M\nAdamant Nature\nEVs: 252 Atk / 4 SpD / 252 Spe\n- Waterfall','Bisharp @ Eviolite\nAbility: Defiant\nGender: M\nAdamant Nature\nEVs: 252 HP / 252 Atk / 4 SpD\n- Iron Head'];
 await page.locator('#team-input').fill((await page.locator('#team-input').inputValue())+'\n\n'+extraSets.join('\n\n'));
 await page.locator('#preview-button').click();await page.getByRole('heading',{name:'Dragonite',exact:true}).waitFor();assert.equal(await page.locator('#review-button').isEnabled(),true);assert.equal(previewCalls,0);
 await page.waitForTimeout(800);assert.equal(await page.locator('#chat-panel').isVisible(),false);assert.equal(await page.locator('.member-card').count(),6);
 await page.waitForFunction(()=>document.querySelectorAll('.move-type-slot .type-badge').length===18);
 await page.waitForFunction(()=>document.querySelectorAll('.card-types .type-badge').length===12);
 assert.equal(await page.locator('.member-card[data-species="Dragonite"] .card-types .type-dragon').count(),1);
 assert.equal(await page.locator('.member-card[data-species="Dragonite"] .member-moves li').first().locator('.type-dragon').count(),1);
 assert.match(await page.locator('.member-card[data-species="Dragonite"] .member-set').textContent(),/Item: Heavy-Duty Boots/);
 assert.match(await page.locator('.member-card[data-species="Dragonite"] .member-nature').textContent(),/Nature: Adamant/);
 assert.equal(await page.locator('.member-card[data-species="Ninetales-Alola"] .set-tera .type-water').count(),1);
 assert.equal(await page.locator('.moves-label').count(),0);
 assert.equal(await page.locator('#followup-form').isVisible(),true,'team chat is available immediately after import');
 let followupTeam='';await page.route('**/api/team/followup',r=>{followupTeam=r.request().postDataJSON().team_text;return r.fulfill({json:{answer:'Team follow-up works before a review'}})});
 await page.locator('#followup-input').fill('What should I change first?');await page.locator('#followup-button').click();await page.getByText('Team follow-up works before a review',{exact:true}).waitFor();assert.match(followupTeam,/Ninetales-Alola/);
 const reviewTeam=require('../static/showdown-import.js').parse(await page.locator('#team-input').inputValue()).team;
 await page.route('**/api/team/review',r=>r.fulfill({json:{team:reviewTeam,review:'Mock review'}}));await page.locator('#review-button').click();await page.getByText('Mock review',{exact:true}).waitFor();assert.equal(await page.locator('#followup-form').isVisible(),true);assert.equal(await page.getByText('Team follow-up works before a review',{exact:true}).count(),1,'review preserves team chat');
 await page.waitForTimeout(200);
 assert(await page.locator('.member-single-line').evaluateAll(lines=>lines.every(line=>getComputedStyle(line).whiteSpace==='nowrap'&&line.scrollWidth<=line.clientWidth+1)),'full Nature and EV text fits each card');
 assert.equal(await page.locator('.member-set').first().evaluate(e=>getComputedStyle(e).fontFamily===getComputedStyle(document.body).fontFamily),true);
 const cards=await page.locator('.member-card').evaluateAll(cards=>cards.map(card=>({x:card.offsetLeft,y:card.offsetTop})));
 assert.equal(cards[0].y,cards[1].y);assert.equal(cards[1].y,cards[2].y);assert(cards[3].y>cards[0].y);assert.equal(cards[3].y,cards[5].y);
 assert.match(await page.locator('.member-card[data-species="Ninetales-Alola"]').textContent(),/Gender: F/);assert.doesNotMatch(await page.locator('#import-warnings').textContent(),/Gender/);
 await page.screenshot({path:path.join(screenshotDir,'pokechef-team-import.png')});
 await page.getByRole('button',{name:'Edit import'}).click();await page.locator('#team-input').fill('Pikachu');await page.getByRole('button',{name:'Cancel edit',exact:true}).click();assert.equal(await page.locator('.member-card').count(),6,'cancel preserves existing team');
 await page.getByRole('button',{name:'Delete Dragonite notes',exact:true}).click();assert.match(await page.locator('#delete-chat-description').textContent(),/Dragonite notes/);await page.locator('#delete-chat-dialog').getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Dragonite notes',exact:true}).count(),1);
 await page.getByRole('button',{name:'Delete Dragonite notes',exact:true}).click();await page.locator('#delete-chat-dialog').getByRole('button',{name:'Delete chat',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Dragonite notes',exact:true}).count(),0);
 await page.getByRole('button',{name:'New chat',exact:false}).first().click();
 await page.waitForTimeout(1500);
 const welcome=await page.locator('.chat-welcome').boundingBox();const composer=await page.locator('#chat-form').boundingBox();assert(welcome.y+welcome.height<=composer.y,'welcome must not overlap composer');
 await page.screenshot({path:path.join(screenshotDir,'pokechef-desktop.png')});
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'mobile has no horizontal overflow');
 await page.getByRole('button',{name:'Toggle sidebar'}).click();await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Close settings'}).click();await page.keyboard.press('Escape');
 await page.screenshot({path:path.join(screenshotDir,'pokechef-mobile.png')});
 await page.setViewportSize({width:320,height:740});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'320px has no horizontal overflow');
 await page.locator('[data-action="review"]').click();await page.waitForTimeout(200);assert.equal(await page.locator('#followup-form').isVisible(),true);assert.equal(await page.locator('.chat-row.selected').count(),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'mobile review has no horizontal overflow');
 assert(await page.locator('.member-single-line').evaluateAll(lines=>lines.every(line=>line.scrollWidth<=line.clientWidth+1)),'Nature and EV text fits on mobile');
 await page.screenshot({path:path.join(screenshotDir,'pokechef-mobile-team.png')});
 assert.deepEqual(errors,[]);console.log('PASS: separate review page and browser navigation, CompDex type badges, move badges, app font, favicon, 3x2 cards, rename/delete dialogs, full-page chat, mobile layout and original slider. Loaded sprites: '+loaded);
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
