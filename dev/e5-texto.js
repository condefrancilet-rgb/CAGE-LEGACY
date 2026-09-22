#!/usr/bin/env node
'use strict';
/* dev/e5-texto.js — E5 · TEXTO VISIBLE SIN BASURA
   ---------------------------------------------------------------------------
   Recorre TODAS las pantallas, en dos estados y tres resoluciones, y lee el
   TEXTO QUE VE EL JUGADOR (innerText, no el html: lo oculto no cuenta, y lo
   que esta dentro de una seccion plegada se mira abriendola).
   Busca lo que nunca deberia llegar a la pantalla: NaN, undefined, null,
   [object Object] e Infinity.
     node dev/e5-texto.js [--file otra.html]                                 */
const path = require('node:path');
const fs = require('node:fs');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PW     = '/opt/node22/lib/node_modules/playwright';
const arg = (k,d) => { const i = process.argv.indexOf('--'+k); return i>=0 ? process.argv[i+1] : d; };
const ARCH = path.resolve(arg('file', path.join(__dirname, '..', 'index-4-blindado.html')));
const SAVE = fs.readFileSync(path.join(__dirname, 'perf', 'congelado', 'save-referencia.json'), 'utf8');
const VIEWPORTS = [[360,640],[390,844],[412,915]];

(async () => {
  const { chromium } = require(PW);
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const hallazgos = [];
  let pantallasMiradas = 0;
  for(const [w,hgt] of VIEWPORTS){
    const ctx = await browser.newContext({ viewport:{ width:w, height:hgt } });
    const page = await ctx.newPage();
    await page.goto('file://' + ARCH);
    await page.waitForTimeout(400);
    const r = await page.evaluate(async ({ save, vp }) => {
      const esperar = ms => new Promise(r => setTimeout(r, ms));
      const MALAS = [
        ['NaN', /\bNaN\b/],
        ['undefined', /\bundefined\b/],
        ['null', /\bnull\b/],
        ['[object Object]', /\[object [A-Z]\w*\]/],
        ['Infinity', /\b-?Infinity\b/],
      ];
      const out = [], vistas = [];
      const mirar = (pant, estado) => {
        const app = document.getElementById('app');
        const txt = (app.innerText || '');
        for(const [nombre, re] of MALAS){
          const m = txt.match(re);
          if(m){
            const i = txt.indexOf(m[0]);
            out.push({ vp, pant, estado, token: nombre,
                       ctx: txt.slice(Math.max(0,i-45), i+45).replace(/\s+/g,' ') });
          }
        }
      };
      async function recorrer(estado){
        for(const n of Object.keys(CL.SCREENS).sort()){
          try { UI.screen = n; UI.sub = null; render(); } catch(e){ continue; }
          await esperar(12);
          vistas.push(n);
          mirar(n, estado);
          /* lo que esta plegado tambien se lee: se abre y se vuelve a mirar */
          const secs = document.querySelectorAll('#app details.sec').length;
          for(let i = 0; i < secs; i++){
            const s = document.querySelectorAll('#app details.sec')[i];
            if(s && !s.open){ s.querySelector('summary').click(); await esperar(30); }
          }
          if(secs){ mirar(n, estado + '+secciones'); UI.sec = {}; }
        }
      }
      /* estado 1: carrera nueva */
      syncCreateInputs = function(){ return UI.tmp.c; };
      UI.tmp = UI.tmp || {};
      const d = createDefaults(); d.metaSeed = 987654321; d.div='LW'; d.style='mma'; d.age=22;
      UI.tmp.c = d;
      startCareer();
      for(let i=0;i<12;i++){ try{ advanceWeek(); }catch(e){} }
      G.pending = [];
      await recorrer('carrera nueva');
      /* estado 2: save congelado (semana de pelea, campamento, mundo viejo) */
      const id = 's1789970254602';
      localStorage.setItem(SAVE_ONE + id, save);
      const idx = saveIndex();
      idx[id] = { name:'ref', rec:'7-4', div:'', org:'', when:'x', cash:0, v:SAVE_VERSION, at:Date.now(), kb:1 };
      saveIndexWrite(idx);
      if(loadGame(id)){ G.pending = []; await recorrer('save congelado'); }
      return { out, pantallas: new Set(vistas).size };
    }, { save: SAVE, vp: w + 'x' + hgt });
    hallazgos.push(...r.out);
    pantallasMiradas = r.pantallas;
    await ctx.close();
  }
  await browser.close();
  console.log('TEXTO VISIBLE · ' + pantallasMiradas + ' pantallas x 2 estados x ' + VIEWPORTS.length + ' resoluciones');
  console.log('buscado: NaN · undefined · null · [object Object] · Infinity');
  if(!hallazgos.length){ console.log('\n  sin hallazgos'); process.exit(0); }
  console.log('\n  ' + hallazgos.length + ' HALLAZGOS:');
  const vistos = new Set();
  for(const x of hallazgos){
    const k = x.pant + x.token + x.ctx.slice(0,30);
    if(vistos.has(k)) continue; vistos.add(k);
    console.log('   ' + x.vp + ' · ' + x.pant + ' (' + x.estado + ') · «' + x.token + '» … ' + x.ctx + ' …');
  }
  process.exit(1);
})();
