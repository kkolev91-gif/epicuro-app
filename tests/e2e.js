/* Test completo dell'app sugli emulatori Firebase. Si lancia con: bash tests/run.sh */
const { chromium } = require('playwright');
const SHOTS=process.env.SHOTS_DIR||require('os').tmpdir();
require('fs').mkdirSync(SHOTS,{recursive:true});
const BASE='http://127.0.0.1:5000/';
const FS='http://127.0.0.1:8080/v1/projects/demo-epicuro/databases/(default)/documents';
const AUTH='http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts';
const R=[];const ok=(c,m)=>{R.push((c?'PASS ':'FAIL ')+m);if(!c)console.log('FAIL',m)};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const pad=n=>String(n).padStart(2,'0');
const svc=()=>{const d=new Date(Date.now()-6*3600e3);return d};
const ymd=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const dayIdx=d=>(d.getDay()+6)%7;
async function fsReq(method,path,body,token='owner'){const r=await fetch(FS+path,{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:body?JSON.stringify(body):undefined});return {status:r.status,json:await r.json().catch(()=>null)}}
async function idToken(user,pw){const r=await fetch(AUTH+':signInWithPassword?key=demo-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:user+'@staff.epicuro.app',password:pw,returnSecureToken:true})});const j=await r.json();return j.idToken?{token:j.idToken,uid:j.localId}:null}
(async()=>{
// reset
await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-epicuro/databases/(default)/documents',{method:'DELETE'});
await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-epicuro/accounts',{method:'DELETE'});
const b=await chromium.launch();
const errs=[];
async function ctxPage(){const c=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:1});
 await c.route('https://api.open-meteo.com/**',r=>r.fulfill({json:{current:{temperature_2m:11.4,weather_code:0},daily:{temperature_2m_max:[14.2],temperature_2m_min:[5.1],weather_code:[0],precipitation_probability_max:[10]}}}));
 const p=await c.newPage();p.on('response',r=>{if(r.status()===400)errs.push('400 '+r.request().method()+' '+r.url().slice(0,160))});p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/favicon|ERR_|WebChannel|Could not reach Cloud Firestore/.test(m.text()))errs.push('console: '+m.text().slice(0,200))});return p}
const txt=async(p,s)=>(await p.locator(s).first().innerText()).replace(/\s+/g,' ');
const view=async(p,h)=>{await p.evaluate(h=>location.hash=h,h);await sleep(400)};

// 1. setup admin
const A=await ctxPage();await A.goto(BASE);await A.waitForSelector('#setup-f',{timeout:20000});
ok(true,'primo avvio: schermata creazione amministratore');
await A.fill('#su-name','Marco Bianchi');await A.fill('#su-user','Marco');await A.fill('#su-pass','segreto1');await A.click('#setup-f [type=submit]');
await A.waitForSelector('#app:not([hidden])',{timeout:20000});await sleep(800);
const home=await txt(A,'#v-oggi');
ok(/Benvenuto, Marco/.test(home),'Home: "Benvenuto, Marco"');
ok(/11°/.test(home)&&/Sereno · Varese 21100/.test(home)&&/Max 14° · min 5°/.test(home),'Home: meteo di oggi');
ok(/Nessuna prenotazione per oggi/.test(home),'Home: prenotazioni di oggi (vuote)');
ok(/MB ADMIN/i.test(await txt(A,'#role')),'chip Admin');
await A.screenshot({path:SHOTS+'/1-home-admin.png'});

// 2. users
await view(A,'#turni');await A.click('[data-act=users]');await A.waitForSelector('#uf');
async function addUser(name,user,pw,expectErr){await A.fill('#u-name',name);await A.fill('#u-user',user);await A.fill('#u-pass',pw);await A.click('#uf [type=submit]');
 if(expectErr){await sleep(1500);await A.waitForSelector('#u-err:not([hidden])',{timeout:15000});const e=await A.locator('#u-err').innerText();await A.click('#sheet button[data-close]');await A.click('[data-act=users]');await A.waitForSelector('#uf');return e}
 await A.waitForSelector('.cred',{timeout:20000});const t=await A.locator('.cred').innerText();await A.click('#sheet [data-act=users]');await A.waitForSelector('#uf');await sleep(300);return t}
const cred=await addUser('Giulia Rossi','giulia','vino123');
ok(/Nome utente: giulia/.test(cred)&&/Password: vino123/.test(cred)&&/127\.0\.0\.1:5000/.test(cred),'credenziali da inviare: '+cred.replace(/\n/g,' | '));
await addUser('Luca Verdi','luca','birra456');
const dup=await addUser('Altro','giulia','abcdef',true);ok(/già usato/.test(dup),'nome utente duplicato rifiutato: '+dup);
await A.fill('#u-name','Altro');await A.fill('#u-user','altro');await A.fill('#u-pass','abc');await A.click('#uf [type=submit]');await sleep(500);
ok(!(await A.evaluate(()=>document.getElementById('u-pass').checkValidity()))&&(await A.locator('#u-list .li').count())===3,'password corta bloccata dal modulo');
ok((await A.locator('#u-list .li').count())===3,'3 utenti in elenco');
await A.click('#sheet button[data-close]');
const G=await idToken('giulia','vino123'),L=await idToken('luca','birra456'),M=await idToken('marco','segreto1');
ok(G&&L&&M,'login via API per tutti e tre');

// token notifiche finti (scritti dal proprietario, come farebbe il telefono)
await fsReq('PATCH',`/users/${G.uid}/tokens/t1`,{fields:{token:{stringValue:'tok-giulia'}}},G.token).then(r=>ok(r.status===200,'Giulia salva il proprio token notifiche'));
await fsReq('PATCH',`/users/${L.uid}/tokens/t1`,{fields:{token:{stringValue:'tok-luca'}}},G.token).then(r=>ok(r.status===403,'Giulia NON può scrivere i token di Luca'));
await fsReq('PATCH',`/users/${L.uid}/tokens/t1`,{fields:{token:{stringValue:'tok-luca'}}},L.token);
await fsReq('PATCH',`/users/${M.uid}/tokens/t1`,{fields:{token:{stringValue:'tok-marco'}}},M.token);

// 3. turni: bozza + pubblica
await view(A,'#turni');await sleep(300);
const today=svc();const di=dayIdx(today);
async function addShift(who,day,st,en){await A.click(`[data-act=new-shift][data-day="${day}"]`);await A.waitForSelector('#sf');
 await A.evaluate(w=>{const s=document.getElementById('s-staff');s.value=[...s.options].find(o=>o.text.startsWith(w)).value;s.dispatchEvent(new Event('change'))},who);await A.selectOption('#s-start',st);await A.selectOption('#s-end',en);await A.click('#sf [type=submit]');await sleep(500)}
await addShift('Giulia Rossi',di,'18:00','02:00');await addShift('Luca Verdi',di,'10:00','15:00');
let bar=await txt(A,'.pubbar');ok(/Bozza non pubblicata/.test(bar),'bozza: '+bar);
// Giulia via API non vede la bozza
const wk=ymd((()=>{const d=new Date(today);d.setDate(d.getDate()-di);return d})());
ok((await fsReq('GET',`/drafts/${wk}`,null,G.token)).status===403,'staff non può leggere le bozze');
ok((await fsReq('GET',`/shifts/${wk}`,null,G.token)).status===404,'turni non ancora pubblicati per lo staff');
await A.click('[data-act=publish]');await A.waitForSelector('#p-go');
ok(/Turni\s*2/.test(await txt(A,'.kv'))&&/Ore totali\s*13h/.test(await txt(A,'.kv')),'riepilogo pubblicazione: '+await txt(A,'.kv'));
await A.click('#p-go');await sleep(1500);
bar=await txt(A,'.pubbar');ok(/Pubblicati/.test(bar),'pubblicato: '+bar);
await A.screenshot({path:SHOTS+'/2-turni-admin.png'});
// notifiche registrate dalla funzione (emulatore)
let notes=null;for(let i=0;i<20&&!notes;i++){const r=await fsReq('GET','/_testNotifications');if(r.json&&r.json.documents&&r.json.documents.length)notes=r.json.documents;else await sleep(500)}
ok(!!notes,'funzione notifiche eseguita alla pubblicazione');
if(notes){const msgs=notes[0].fields.messages.arrayValue.values.map(v=>v.mapValue.fields);
 const by=t=>msgs.find(m=>m.token.stringValue===t);
 const g=by('tok-giulia'),l=by('tok-luca');
 ok(g&&/Il tuo turno: \w+ 18:00–02:00/.test(g.notification.mapValue.fields.body.stringValue),'notifica Giulia: '+(g&&g.notification.mapValue.fields.body.stringValue));
 ok(l&&/10:00–15:00/.test(l.notification.mapValue.fields.body.stringValue),'notifica Luca: '+(l&&l.notification.mapValue.fields.body.stringValue));
 ok(!by('tok-marco'),'chi pubblica non riceve la notifica');
 ok(/Turni pubblicati/.test(g.notification.mapValue.fields.title.stringValue),'titolo: '+g.notification.mapValue.fields.title.stringValue);}

// 4. staff Giulia
const P=await ctxPage();await P.goto(BASE);await P.waitForSelector('#login-f',{timeout:20000});
await P.fill('#l-user','giulia');await P.fill('#l-pass','sbagliata');await P.click('#login-f [type=submit]');await P.waitForSelector('#l-err:not([hidden])');
ok(/non corretti/.test(await P.locator('#l-err').innerText()),'password sbagliata: messaggio chiaro');
await P.screenshot({path:SHOTS+'/3-login.png'});
await P.fill('#l-user','Giulia ');await P.fill('#l-pass','vino123');await P.click('#login-f [type=submit]');
await P.waitForSelector('#app:not([hidden])',{timeout:20000});await sleep(800);
ok(/Benvenuto, Giulia/.test(await txt(P,'#v-oggi')),'Giulia: "Benvenuto, Giulia" (nome utente con maiuscola/spazio accettato)');
ok(/18:00–02:00/.test(await txt(P,'#v-oggi')),'Giulia vede il suo turno in Home');
await view(P,'#turni');
const gT=await txt(P,'#v-turni');
ok(/Luca Verdi/.test(gT)&&/Giulia Rossi \(tu\)/.test(gT),'Giulia vede i turni pubblicati');
ok(!(await P.locator('[data-act=new-shift],[data-act=users],[data-act=publish],[data-act=clear-week]').count())&&!(await P.locator('button.shift').count()),'Giulia: turni in sola lettura');
// indisponibilità: oggi e domani
await P.click('[data-act=unavail]');await P.waitForSelector('#cal');
const tk=ymd(today),tm=ymd(new Date(today.getFullYear(),today.getMonth(),today.getDate()+1));
const yd=ymd(new Date(today.getFullYear(),today.getMonth(),today.getDate()-1));
if(await P.locator(`#cal [data-k="${yd}"]`).count())ok(await P.locator(`#cal [data-k="${yd}"]`).isDisabled(),'giorni passati non selezionabili');
await P.click(`#cal [data-k="${tk}"]`);
if(!(await P.locator(`#cal [data-k="${tm}"]`).count()))await P.click('#cal-next');
await P.click(`#cal [data-k="${tm}"]`);
ok(/2 giorni segnati/.test(await P.locator('#cal-n').innerText()),'2 giorni segnati');
await P.screenshot({path:SHOTS+'/4-calendario.png'});
await P.click('#cal-save');await sleep(700);
ok(/Hai segnato questo giorno/.test(await txt(P,'.day.today')),'Giulia vede il proprio giorno segnato');
// rules via API
const rq=[
 ['PATCH',`/unavail/${L.uid}`,{fields:{dates:{arrayValue:{values:[]}}}},'scrivere indisponibilità di altri'],
 ['GET',`/unavail/${L.uid}`,null,'leggere indisponibilità di altri'],
 ['PATCH',`/shifts/${wk}?updateMask.fieldPaths=items`,{fields:{items:{arrayValue:{values:[]}}}},'modificare turni pubblicati'],
 ['PATCH',`/users/${G.uid}?updateMask.fieldPaths=role`,{fields:{role:{stringValue:'admin'}}},'farsi amministratore'],
 ['PATCH',`/config/setup`,{fields:{adminUid:{stringValue:G.uid}}},'rifare il primo avvio'],
];
for(const [m,pth,body,label] of rq){const r=await fsReq(m,pth,body,G.token);ok(r.status===403,'staff NON può '+label+' ('+r.status+')')}
// admin legge indisponibilità e avviso nel turno
await A.reload();await A.waitForSelector('#app:not([hidden])');await view(A,'#turni');await sleep(500);
ok(/Non disponibili: Giulia Rossi/.test(await txt(A,'.day.today')),'admin vede "Non disponibili: Giulia Rossi" oggi');
await A.click(`[data-act=new-shift][data-day="${di}"]`);await A.waitForSelector('#sf');
await A.selectOption('#s-staff',{label:'Giulia Rossi — non disponibile'});await sleep(100);
ok(await A.isVisible('#s-unav'),'avviso nel nuovo turno: '+(await A.locator('#s-unav').innerText()));
await A.click('#sheet button[data-close]');

// 5. cancellare turni: elimina uno, svuota, ritira
await A.click('.day.today .shift:has-text("Luca")');await A.waitForSelector('#s-del');await A.click('#s-del');await A.click('#s-del');await sleep(600);
ok(/Modifiche non pubblicate/.test(await txt(A,'.pubbar')),'dopo eliminazione: modifiche non pubblicate');
await P.reload();await P.waitForSelector('#app:not([hidden])');await view(P,'#turni');await sleep(500);
ok(/Luca Verdi/.test(await txt(P,'#v-turni')),'lo staff vede ancora la versione pubblicata');
await A.click('[data-act=clear-week]');await A.click('[data-act=clear-week]');await sleep(600);
ok((await A.locator('#v-turni .shift').count())===0,'settimana svuotata');
await A.click('[data-act=unpublish]');await sleep(200);await A.click('[data-act=unpublish]');await sleep(800);
await sleep(500);
ok(/Turni non ancora pubblicati/.test(await txt(P,'#v-turni')),'ritirata: lo staff non vede più i turni (in tempo reale)');
// rifai: copia settimana precedente vuota -> messaggio; aggiungi e ripubblica
await addShift('Giulia Rossi',di,'19:00','01:00');await A.click('[data-act=publish]');await A.click('#p-notify');await A.click('#p-go');await sleep(1200);
ok(/19:00–01:00/.test(await txt(P,'#v-turni')),'turni rifatti e ripubblicati visti dallo staff');
const n2=(await fsReq('GET','/_testNotifications')).json.documents.length;ok(n2===1,'pubblicazione senza notifica: nessuna nuova notifica');

// 6. prenotazioni
await view(P,'#oggi');await P.click('[data-act=new-res]');await P.waitForSelector('#rf');
await P.fill('#r-name','Famiglia Bianchi');await P.click('#rf [type=submit]');
ok(!(await P.evaluate(()=>document.getElementById('r-phone').checkValidity()))&&(await P.isVisible('#rf')),'prenotazione senza telefono bloccata');
await P.fill('#r-phone','333 123 4567');await P.selectOption('#r-time','20:30');await P.click('#r-plus');await P.click('#r-plus');
await P.fill('#r-note','compleanno');await P.click('#rf [type=submit]');await sleep(800);
let ph=await txt(P,'#v-oggi');ok(/20:30 Famiglia Bianchi 333 123 4567 · compleanno 4 persone/i.test(ph),'Home Giulia: prenotazione di oggi');
await P.click('[data-act=new-res]');await P.waitForSelector('#rf');await P.fill('#r-name','Rossi');await P.fill('#r-phone','+39 0332 242908');await P.selectOption('#r-time','19:15');await P.click('#rf [type=submit]');await sleep(800);
ph=await txt(P,'#v-oggi');ok(/2 prenotazioni 6 persone/i.test(ph)&&ph.indexOf('19:15')<ph.indexOf('20:30'),'ordinate per orario, totale 6 persone');
await P.screenshot({path:SHOTS+'/5-home-staff.png'});
// prenotazione per dopodomani
await view(P,'#pren');await P.click('#v-pren [data-act=new-res]');await P.waitForSelector('#rf');
const d2=ymd(new Date(today.getFullYear(),today.getMonth(),today.getDate()+2));
await P.fill('#r-date',d2);await P.fill('#r-name','Gruppo calcetto');await P.fill('#r-phone','3471112223');
for(let i=0;i<8;i++)await P.click('#r-plus');await P.click('#rf [type=submit]');await sleep(900);
ok((await P.locator('.daybtn[aria-pressed=true]').getAttribute('data-date'))===d2,'dopo il salvataggio si apre il giorno della prenotazione');
ok(/Gruppo calcetto/.test(await txt(P,'#v-pren .card'))&&/10 p\./.test(await txt(P,`.daybtn[data-date="${d2}"]`)),'striscia giorni: 10 persone dopodomani');
await P.click(`.daybtn[data-date="${tk}"]`);await sleep(200);
ok(/6 p\./.test(await txt(P,`.daybtn[data-date="${tk}"]`))&&/Famiglia Bianchi/.test(await txt(P,'#v-pren .card')),'oggi: 6 persone nella striscia');
await P.screenshot({path:SHOTS+'/6-prenotazioni.png'});
// admin modifica e cancella
await view(A,'#oggi');await sleep(400);
ok(/Famiglia Bianchi/.test(await txt(A,'#v-oggi')),'admin vede la prenotazione in Home');
await A.click('.res:has-text("Famiglia Bianchi")');await A.waitForSelector('#rf');
ok(/Inserita da Giulia Rossi/.test(await A.locator('.sheet .sub').innerText()),'mostra chi l\'ha inserita');
await A.click('#r-plus');await A.click('#rf [type=submit]');await sleep(700);
ok(/Famiglia Bianchi.*5 persone/i.test(await txt(A,'#v-oggi')),'modificata a 5 persone');
await A.click('.res:has-text("Rossi") >> nth=-1');await A.waitForSelector('#r-del');await A.click('#r-del');await A.click('#r-del');await sleep(700);
await view(P,'#oggi');ok(/1 prenotazione 5 persone/i.test(await txt(P,'#v-oggi'))&&!/19:15/.test(await txt(P,'#v-oggi')),'cancellata, Giulia aggiornata in tempo reale');
// rules: prenotazione con by falso
const fake=await fsReq('POST','/reservations',{fields:{date:{stringValue:tk},time:{stringValue:'20:00'},name:{stringValue:'x'},phone:{stringValue:'123456'},people:{integerValue:'2'},by:{stringValue:L.uid}}},G.token);
ok(fake.status===403,'prenotazione a nome di un altro utente rifiutata');

// 7. cantina
await view(A,'#cantina');await A.click('[data-act=import] >> nth=0');await A.fill('#im-text',"Barbera d'Asti ; Cascina A ; Rosso ; Piemonte ; 12\nLugana ; Cantina B ; Bianco ; Lombardia ; 6\nFranciacorta Brut ; ; ; ; 2");
await A.click('#im-go');await sleep(1200);ok((await A.locator('.wine').count())===3,'3 vini importati');
await view(P,'#cantina');await sleep(400);
await P.click('.wine:has-text("Barbera") [data-act=sell]');await P.click('#q-plus');await P.click('#q-ok');await sleep(900);
ok(/\b10\b/.test(await txt(A,'.wine:has-text("Barbera") .qty')),'vendita di Giulia scalata anche per l\'admin: 12→10');
ok(!(await P.locator('[data-act=edit-wine],[data-act=import]').count()),'Giulia non modifica la cantina');
const wid=(await fsReq('GET','/wines')).json.documents.find(d=>d.fields.name.stringValue==='Lugana').name.split('/').pop();
ok((await fsReq('PATCH',`/wines/${wid}?updateMask.fieldPaths=stock`,{fields:{stock:{integerValue:'99'}}},G.token)).status===403,'staff NON può cambiare la giacenza');
ok((await fsReq('PATCH',`/wines/${wid}?updateMask.fieldPaths=sold`,{fields:{sold:{integerValue:'500'}}},G.token)).status===403,'staff NON può scalare 500 bottiglie in un colpo');
await view(P,'#oggi');await sleep(300);
await P.click('[data-act=undo-sale]');await P.click('[data-act=undo-sale]');await sleep(900);
ok(/\b12\b/.test(await txt(A,'.wine:has-text("Barbera") .qty')),'vendita annullata: torna a 12');
await A.click('.wine:has-text("Lugana") [data-act=edit-wine]');await A.fill('#w-stock','30');await A.click('#wf [type=submit]');await sleep(700);
ok(/\b30\b/.test(await txt(A,'.wine:has-text("Lugana") .qty')),'admin aggiorna giacenza a 30');

// 8. password e rimozione utenti
await view(A,'#turni');await A.click('[data-act=users]');await A.waitForSelector('#u-list');
await A.click('.li:has-text("Luca") [data-u-pass]');await A.waitForSelector('#pf');await A.fill('#p-pass','nuova789');await A.click('#pf [type=submit]');await A.waitForSelector('.cred',{timeout:15000});
ok(/Password: nuova789/.test(await A.locator('.cred').innerText()),'nuova password per Luca');
ok(!(await idToken('luca','birra456'))&&!!(await idToken('luca','nuova789')),'vecchia password non funziona, nuova sì');
await A.click('#sheet [data-act=users]');await A.waitForSelector('#u-list');
await A.click('.li:has-text("Luca") [data-u-del]');await A.click('.li:has-text("Luca") [data-u-del]');await sleep(2500);
ok(!/Luca/.test(await txt(A,'#u-list')),'Luca rimosso dall\'elenco');
ok(!(await idToken('luca','nuova789')),'Luca non può più entrare');
ok(!(await A.locator('.li:has-text("Marco") [data-u-del]').count()),'l\'admin non può rimuovere se stesso');
await A.click('#sheet button[data-close]');
// 9. Giulia cambia la propria password
await P.click('#role');await P.waitForSelector('#mf');
await P.fill('#m-old','vino123');await P.fill('#m-new','rosso2026');await P.click('#mf [type=submit]');await sleep(1200);
ok(!!(await idToken('giulia','rosso2026')),'Giulia ha cambiato la propria password');
await P.click('#role');await P.waitForSelector('#logout');await P.click('#logout');await P.waitForSelector('#login-f',{timeout:10000});
ok(true,'uscita: torna al login');
// overflow
for(const [p,n] of [[A,'admin']]){for(const h of ['#oggi','#pren','#turni','#cantina']){await view(p,h);const w=await p.evaluate(()=>document.documentElement.scrollWidth);if(w>390)ok(false,`overflow ${h} ${w}`)}}
ok(true,'nessuno scroll orizzontale nelle 4 sezioni');
await view(A,'#pren');await A.screenshot({path:SHOTS+'/7-pren-admin.png'});
console.log(R.join('\n'));console.log('PASS',R.filter(x=>x.startsWith('PASS')).length,'FAIL',R.filter(x=>x.startsWith('FAIL')).length);
console.log('ERRORI JS:',errs.length?[...new Set(errs)].join('\n'):'nessuno');
await b.close();})().catch(e=>{console.log(R.join('\n'));console.log('CRASH',e.message);process.exit(1)});
process.on('exit',()=>{if(R.some(x=>x.startsWith('FAIL')))process.exitCode=1});
