#!/usr/bin/env node
'use strict';
/* dev/perf/pantallas-todas.js — alto de TODAS las pantallas del juego a
   360x640, partiendo del save congelado. Sirve para E3: antes de mover un
   bloque del inicio a otra pantalla hay que saber si esa pantalla tiene sitio.
   Se recorre la tabla unica de pantallas (CL.SCREENS); las que devuelven null
   (no dibujables en este estado) se marcan y no se cuentan.

   RUIDO CONOCIDO en la salida: `bytes` de la pantalla `load` cambia entre
   corridas (992 vs 977) porque lista las partidas guardadas, cuyos nombres y
   fechas salen de la corrida. Un diff en ESE campo no es una regresion. El
   alto, los nodos y los botones si son estables. */
const path = require('node:path');
const fs   = require('node:fs');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PW     = '/opt/node22/lib/node_modules/playwright';
const RAIZ   = path.join(__dirname, '..', '..');
const JUEGO  = 'file://' + path.join(RAIZ, 'index-4-blindado.html');
const SAVE   = path.join(__dirname, 'congelado', 'save-referencia.json');
const ALTO   = 640;

(async () => {
  const { chromium } = require(PW);
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx  = await browser.newContext({ viewport: { width:360, height:ALTO } });
  const page = await ctx.newPage();
  await page.goto(JUEGO);
  await page.waitForTimeout(400);
  const crudo = fs.readFileSync(SAVE, 'utf8');
  const cargo = await page.evaluate(({crudo}) => {
    const id = 's1789970254602';
    localStorage.setItem(SAVE_ONE + id, crudo);
    const idx = saveIndex();
    idx[id] = { name:'referencia', rec:'7-4', div:'', org:'', when:'congelado',
                cash:0, v:SAVE_VERSION, at:Date.now(), kb:Math.round(crudo.length/1024) };
    saveIndexWrite(idx);
    if(!loadGame(id)) return false;
    G.pending = [];
    return !!(G && G.player);
  }, {crudo});
  if(!cargo) throw new Error('el save congelado no cargo');

  const nombres = await page.evaluate(() => Object.keys(CL.SCREENS || {}).sort());
  const filas = [];
  for(const n of nombres){
    const r = await page.evaluate((n) => {
      try{
        UI.screen = n; UI.sub = null;
        render();
      }catch(e){ return { err: e.message }; }
      const app = document.getElementById('app');
      const btns = [...app.querySelectorAll('button')];
      const chicos = btns.filter(b => { const r=b.getBoundingClientRect(); return r.height>0 && r.height<44; }).length;
      return { real: UI.screen, alto: document.documentElement.scrollHeight,
               nodos: app.querySelectorAll('*').length, bytes: app.innerHTML.length,
               botones: btns.length, chicos: chicos };
    }, n);
    r.nombre = n;
    filas.push(r);
    await page.waitForTimeout(20);
  }
  await ctx.close(); await browser.close();

  filas.sort((a,b) => (b.alto||0)-(a.alto||0));
  console.log('pantalla        dibuja     pantallas  alto  nodos  bytes  botones  <44px');
  for(const f of filas){
    if(f.err){ console.log(f.nombre.padEnd(15), 'ERROR '+f.err); continue; }
    const redirigio = f.real !== f.nombre ? ('->'+f.real) : '';
    console.log(f.nombre.padEnd(15), (redirigio||'si').padEnd(10),
      String((f.alto/ALTO).toFixed(2)).padStart(7), String(f.alto).padStart(6),
      String(f.nodos).padStart(6), String(f.bytes).padStart(7),
      String(f.botones).padStart(8), String(f.chicos).padStart(6));
  }
  fs.writeFileSync(path.join(__dirname,'pantallas-todas.json'), JSON.stringify(filas, null, 1));
})();
