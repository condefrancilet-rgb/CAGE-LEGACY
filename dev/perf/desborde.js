#!/usr/bin/env node
'use strict';
/* dev/perf/desborde.js — barrido de desborde horizontal: TODAS las pantallas
   en las tres resoluciones. El navegador ya medía esto, pero solo en las
   pantallas que recorre su guión; al empezar a medir `menu` aparecio un
   desborde de 15 px que venia de antes. Esto lo mide en todas, y dice QUE
   elemento desborda, no solo que hay desborde.
     node dev/perf/desborde.js [--file otra-copia.html] [--seed 7]
   SIEMBRA Math.random ANTES de cargar el juego. Sin eso cada corrida juega
   una carrera distinta (division, rivales, nombres) y la comparacion
   antes/despues no vale: en la primera version de este script aparecio un
   desborde en `rank` que era solo una division con nombre mas largo.        */
const path = require('node:path');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PW     = '/opt/node22/lib/node_modules/playwright';
const ARCH = process.argv.includes('--file')
  ? path.resolve(process.argv[process.argv.indexOf('--file')+1])
  : path.join(__dirname, '..', '..', 'index-4-blindado.html');
const VIEWPORTS = [[360,640],[390,844],[412,915]];
const SEED = process.argv.includes('--seed')
  ? parseInt(process.argv[process.argv.indexOf('--seed')+1],10) : 7;
/* mismo mulberry32 que dev/harness.js, para que las dos midan el mismo mundo */
function sembrar(seed){
  return '(function(){ var a = ' + (seed|0) + ' | 0;' +
         ' Math.random = function(){ a |= 0; a = (a + 0x6D2B79F5) | 0;' +
         ' var t = Math.imul(a ^ (a >>> 15), 1 | a);' +
         ' t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;' +
         ' return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();';
}

(async () => {
  const { chromium } = require(PW);
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  let malos = 0, total = 0;
  for(const [w,hgt] of VIEWPORTS){
    const ctx = await browser.newContext({ viewport:{ width:w, height:hgt } });
    const page = await ctx.newPage();
    await page.addInitScript(sembrar(SEED));
    await page.goto('file://' + ARCH);
    await page.waitForTimeout(400);
    const filas = await page.evaluate(() => {
      /* Sembrar Math.random NO alcanza: la creacion de carrera lee el DOM y
         algunos valores salen de Date.now(). Sin fijar tambien el borrador, la
         misma corrida sobre el MISMO archivo daba desborde en `rank` una vez
         de cada tres — por una division con nombre mas largo, no por el
         codigo. Una herramienta que no repite no sirve para comparar. */
      syncCreateInputs = function(){ return UI.tmp.c; };
      UI.tmp = UI.tmp || {};
      var d = createDefaults();
      d.metaSeed = 987654321; d.first='Mateo'; d.last='Ferrari';
      d.div='LW'; d.style='mma'; d.age=22;
      UI.tmp.c = d;
      startCareer();
      for(let i=0;i<12;i++){ try{ advanceWeek(); }catch(e){} }
      G.pending = [];
      const out = [];
      for(const n of Object.keys(CL.SCREENS).sort()){
        try { UI.screen = n; UI.sub = null; render(); } catch(e){ continue; }
        const W = window.innerWidth, sw = document.documentElement.scrollWidth;
        if(sw <= W){ out.push({ n, ok:true }); continue; }
        const culpable = [...document.querySelectorAll('#app *')]
          .filter(e => e.getBoundingClientRect().right > W + 0.5)
          .map(e => e.tagName.toLowerCase() + '.' + String(e.className||'').slice(0,24) +
                    ' «' + (e.textContent||'').replace(/\s+/g,' ').trim().slice(0,22) + '»')[0] || '?';
        out.push({ n, ok:false, sw, W, culpable });
      }
      return out;
    });
    for(const f of filas){
      total++;
      if(!f.ok){ malos++; console.log((w+'x'+hgt).padEnd(9), f.n.padEnd(14), 'DESBORDA', f.sw+'>'+f.W, '·', f.culpable); }
    }
    await ctx.close();
  }
  await browser.close();
  console.log((malos? malos : 'ninguna') + ' pantalla/resolucion con desborde, de ' + total + ' medidas');
  process.exit(malos ? 1 : 0);
})();
