#!/usr/bin/env node
'use strict';
/* dev/perf/hub-inventario.js — inventario MEDIDO del inicio: que bloques hay,
   cuanto ocupa cada uno, cuantos botones trae y adonde llevan. Es el insumo de
   E3 (reorganizar el inicio) y el fixture de la prueba de "nada se pierde":
   despues de reorganizar, ninguna accion de esta lista puede desaparecer.
   Tambien deja la captura del inicio a 360x640. */
const path = require('node:path');
const fs   = require('node:fs');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PW     = '/opt/node22/lib/node_modules/playwright';
const RAIZ   = path.join(__dirname, '..', '..');
const JUEGO  = 'file://' + path.join(RAIZ, 'index-4-blindado.html');
const SALIDA = __dirname;
const SEM = process.argv.includes('--semanas')
  ? parseInt(process.argv[process.argv.indexOf('--semanas')+1],10) : 12;
const CAPTURA = !process.argv.includes('--sin-captura');
const SAVE = process.argv.includes('--save')
  ? path.resolve(process.argv[process.argv.indexOf('--save')+1]) : null;
const ETIQ = process.argv.includes('--etiqueta')
  ? process.argv[process.argv.indexOf('--etiqueta')+1] : (SAVE ? 'save' : 's'+SEM);

(async () => {
  const { chromium } = require(PW);
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx  = await browser.newContext({ viewport: { width:360, height:640 } });
  const page = await ctx.newPage();
  await page.goto(JUEGO);
  await page.waitForTimeout(400);
  if(SAVE){
    /* el estado tardio de verdad no se alcanza con advanceWeek a secas: sin
       aceptar peleas el jugador se queda 0-0 y media docena de tarjetas nunca
       aparecen. Se carga el save congelado por el camino real. */
    const crudo = fs.readFileSync(SAVE, 'utf8');
    const okCarga = await page.evaluate(({crudo}) => {
      const id = 's1789970254602';
      localStorage.setItem(SAVE_ONE + id, crudo);
      const idx = saveIndex();
      idx[id] = { name:'referencia', rec:'7-4', div:'', org:'', when:'congelado',
                  cash:0, v:SAVE_VERSION, at:Date.now(), kb:Math.round(crudo.length/1024) };
      saveIndexWrite(idx);
      if(!loadGame(id)) return false;
      G.pending = [];
      UI.screen='hub'; render();
      return !!(G && G.player);
    }, {crudo});
    if(!okCarga) throw new Error('el save congelado no cargo en el navegador');
  } else {
    await page.evaluate((sem) => {
      startCareer();
      for(let i=0;i<sem;i++){ try{ advanceWeek(); }catch(e){} }
      G.pending = [];           /* un evento pendiente colapsa el hub */
      UI.screen='hub'; render();
    }, SEM);
  }
  await page.waitForTimeout(400);

  const inv = await page.evaluate(() => {
    const app = document.getElementById('app');
    const acciones = new Set();
    const bloques = [...app.children].map((el, i) => {
      const r = el.getBoundingClientRect();
      const h = el.querySelector('h1,h2,h3,.b,.hdr');
      const btns = [...el.querySelectorAll('button')].map(b => {
        const oc = b.getAttribute('onclick') || '';
        acciones.add(oc.trim());
        return { txt: (b.textContent||'').replace(/\s+/g,' ').trim().slice(0,46), onclick: oc.trim().slice(0,90),
                 alto: Math.round(b.getBoundingClientRect().height) };
      });
      return { i, tag: el.tagName.toLowerCase(), clase: el.className || '',
               titulo: h ? (h.textContent||'').replace(/\s+/g,' ').trim().slice(0,46) : '',
               altoPx: Math.round(r.height), nodos: el.querySelectorAll('*').length,
               bytes: el.innerHTML.length, botones: btns };
    });
    /* que tarjeta registrada dibuja y cual se calla en este estado */
    const tarjetas = (typeof CL!=='undefined' && CL.hubCards ? CL.hubCards : []).map(c => {
      let out = ''; try{ out = c.fn() || ''; }catch(e){ out = '!!error: '+e.message; }
      return { id: c.id, orden: c.o, bytes: out.length, dibuja: out.trim().length > 0 };
    });
    return { bloques, tarjetas, total: Math.round(document.documentElement.scrollHeight),
             semanaJuego: (typeof G!=='undefined'&&G)? (G.year+'/'+G.week) : '?',
             record: (typeof G!=='undefined'&&G&&G.player&&G.player.rec)? (G.player.rec.w+'-'+G.player.rec.l) : '?',
             accionesUnicas: [...acciones].sort() };
  });

  if(CAPTURA) await page.screenshot({ path: path.join(SALIDA, 'hub-360x640.png'), fullPage: true });
  await ctx.close(); await browser.close();

  let acum = 0;
  console.log('estado:', ETIQ, '· juego', inv.semanaJuego, '· record', inv.record);
  console.log('#   alto  %alto  acum%  nodos  botones  bloque');
  for(const b of inv.bloques){
    acum += b.altoPx;
    const pc = (b.altoPx*100/inv.total);
    console.log(String(b.i).padStart(2), String(b.altoPx).padStart(5),
      (pc.toFixed(1)+'%').padStart(6), ((acum*100/inv.total).toFixed(1)+'%').padStart(6),
      String(b.nodos).padStart(6), String(b.botones.length).padStart(8), ' ',
      (b.titulo || b.clase || b.tag));
  }
  console.log('\ntotal', inv.total, 'px ·', inv.bloques.length, 'bloques ·',
              inv.accionesUnicas.length, 'acciones unicas (onclick distintos)');
  const dib = inv.tarjetas.filter(t=>t.dibuja), mudas = inv.tarjetas.filter(t=>!t.dibuja);
  console.log('tarjetas registradas', inv.tarjetas.length, '· dibujan', dib.length, '· mudas', mudas.length);
  console.log('  dibujan:', dib.map(t=>t.id).join(' '));
  console.log('  mudas  :', mudas.map(t=>t.id).join(' '));
  inv.semanas = SEM; inv.etiqueta = ETIQ;
  fs.writeFileSync(path.join(SALIDA,'hub-inventario-'+ETIQ+'.json'), JSON.stringify(inv, null, 1));
})();
