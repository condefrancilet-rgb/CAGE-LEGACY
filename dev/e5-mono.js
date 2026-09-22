#!/usr/bin/env node
'use strict';
/* dev/e5-mono.js — E5 · PRUEBA DE MONO
   ---------------------------------------------------------------------------
   Aprieta botones AL AZAR en el navegador real y vigila tres cosas:
     · errores de JavaScript,
     · invariantes del estado (dev/invariants.js, el mismo juez que el sim),
     · que la partida siga siendo jugable al final (se puede guardar y cargar).
   No es un test de que algo funcione: es un test de que NADA revienta por un
   camino que a nadie se le ocurrio recorrer.
     node dev/e5-mono.js [--toques 400] [--semilla 7] [--vp 360x640]        */
const path = require('node:path');
const fs = require('node:fs');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PW     = '/opt/node22/lib/node_modules/playwright';
const arg = (k,d) => { const i = process.argv.indexOf('--'+k); return i>=0 ? process.argv[i+1] : d; };
const ARCH = path.resolve(arg('file', path.join(__dirname, '..', 'index-4-blindado.html')));
const TOQUES = parseInt(arg('toques','400'),10);
const SEMILLA = parseInt(arg('semilla','7'),10);
const VP = (arg('vp','390x844')).split('x').map(Number);

function sembrar(seed){
  return '(function(){ var a = ' + (seed|0) + ' | 0;' +
         ' Math.random = function(){ a |= 0; a = (a + 0x6D2B79F5) | 0;' +
         ' var t = Math.imul(a ^ (a >>> 15), 1 | a);' +
         ' t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;' +
         ' return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();';
}

(async () => {
  if(!fs.existsSync(CHROME) || !fs.existsSync(PW)){
    console.log('NO VERIFICADO EN NAVEGADOR: falta Chromium o Playwright.'); process.exit(0);
  }
  const { chromium } = require(PW);
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ viewport:{ width:VP[0], height:VP[1] }, isMobile:true, hasTouch:true });
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', e => errores.push(String(e).slice(0,140)));
  await page.addInitScript(sembrar(SEMILLA));
  await page.goto('file://' + ARCH);
  await page.waitForTimeout(400);

  const r = await page.evaluate(async ({ toques }) => {
    const esperar = ms => new Promise(r => setTimeout(r, ms));
    /* carrera lista, sin pasar por el formulario */
    syncCreateInputs = function(){ return UI.tmp.c; };
    UI.tmp = UI.tmp || {};
    const d = createDefaults();
    d.metaSeed = 55501; d.div='LW'; d.style='mma'; d.age=22;
    UI.tmp.c = d;
    startCareer();
    for(let i=0;i<8;i++){ try{ advanceWeek(); }catch(e){} }

    const visitadas = {}, pulsados = {}, rotos = [];
    let confirmados = 0;
    /* el mono no debe borrar la partida ni salir del juego */
    const PROHIBIDO = /deleteSave|location|reload|close\(|CAS\.|retire|confirmRetire/;
    window.confirm = function(){ confirmados++; return false; };   /* nunca confirma destrucciones */
    window.alert = function(){};

    for(let t = 0; t < toques; t++){
      const bs = [...document.querySelectorAll('#app button, #nav button')]
        .filter(b => { const r = b.getBoundingClientRect(); return r.width>0 && r.height>0; })
        .filter(b => !PROHIBIDO.test(b.getAttribute('onclick') || ''));
      if(!bs.length) break;
      const b = bs[Math.floor(Math.random()*bs.length)];
      const oc = (b.getAttribute('onclick')||'').slice(0,40);
      pulsados[oc] = (pulsados[oc]||0)+1;
      try { b.click(); } catch(e){ rotos.push('click ' + oc + ': ' + e.message.slice(0,60)); }
      await esperar(6);
      visitadas[UI.screen] = (visitadas[UI.screen]||0)+1;
      /* invariantes baratas, cada 20 toques */
      if(t % 20 === 0 && G && G.player){
        if(!Number.isFinite(G.cash)) rotos.push('G.cash no finito en ' + UI.screen);
        if(!Number.isFinite(G.player.pop)) rotos.push('pop no finita en ' + UI.screen);
        if(G.week < 1 || G.week > 52) rotos.push('semana fuera de rango: ' + G.week);
        if(G.player.id && G.fighters[G.player.id] !== G.player)
          rotos.push('G.player desconectado del plantel en ' + UI.screen);
      }
    }
    /* sigue siendo jugable: guardar y cargar */
    let sobrevive = false;
    try {
      saveGame(true);
      const id = listSaves()[0] && listSaves()[0].id;
      sobrevive = !!(id && loadGame(id) && G && G.player);
    } catch(e){ rotos.push('guardar/cargar tras el mono: ' + e.message.slice(0,60)); }
    return { visitadas, rotos, sobrevive, confirmados,
             distintos: Object.keys(pulsados).length,
             semana: G ? (G.year + '/' + G.week) : '?' };
  }, { toques: TOQUES });

  await browser.close();
  console.log('MONO · ' + VP[0] + 'x' + VP[1] + ' · ' + TOQUES + ' toques · semilla ' + SEMILLA + ' · ' + r.distintos + ' acciones distintas');
  console.log('pantallas visitadas: ' + Object.entries(r.visitadas).sort((a,b)=>b[1]-a[1]).map(x=>x[0]+':'+x[1]).join(' '));
  console.log('llego a ' + r.semana + ' · sigue guardando y cargando: ' + (r.sobrevive ? 'SI' : 'NO'));
  console.log('errores de JavaScript: ' + errores.length);
  for(const e of errores.slice(0,5)) console.log('   ' + e);
  console.log('invariantes rotas: ' + r.rotos.length);
  for(const x of [...new Set(r.rotos)].slice(0,8)) console.log('   ' + x);
  const mal = errores.length + r.rotos.length + (r.sobrevive ? 0 : 1);
  console.log(mal ? '\nHAY HALLAZGOS' : '\nsin hallazgos');
  process.exit(mal ? 1 : 0);
})();
