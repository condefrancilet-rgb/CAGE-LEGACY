#!/usr/bin/env node
'use strict';
/* dev/perf/pantalla-dom.js — mide "lo que el jugador ve" en las pantallas que
   compiten por el nombre de INICIO. En el juego hay dos:
     · title  — la portada. Es adonde llevan los seis botones "Volver al inicio".
     · hub    — la semana en curso. Es adonde lleva el boton "Inicio" de la barra.
   Se mide la misma regla que en hub-dom.js: alto del documento en pantallas,
   nodos, bytes, botones y objetivos tactiles por debajo de 44 px.
   title se mide en sus DOS estados, porque no dibuja lo mismo:
     · virgen        — primer arranque, sin partidas guardadas ni legado.
     · con-carrera   — despues de jugar y guardar, que es el estado real en el
                       que un jugador pulsa "Volver al inicio".
   No se puede sacar del harness de node: estas pantallas se arman con hooks
   que leen del DOM y del almacenamiento real. */
const path = require('node:path');
const fs   = require('node:fs');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PW     = '/opt/node22/lib/node_modules/playwright';
const ARCHIVO = process.argv.includes('--file')
  ? path.resolve(process.argv[process.argv.indexOf('--file')+1])
  : path.join(__dirname, '..', '..', 'index-4-blindado.html');
const JUEGO  = 'file://' + ARCHIVO;
const VIEWPORTS = [
  { n:'360x640', width:360, height:640 },
  { n:'390x844', width:390, height:844 },
  { n:'412x915', width:412, height:915 },
];

/* La medicion en si, identica para toda pantalla. */
const MEDIR = () => {
  const app = document.getElementById('app');
  const nav = document.getElementById('nav');
  const btns = [...document.querySelectorAll('button')];
  const chicos = btns.filter(b => { const r = b.getBoundingClientRect(); return r.height > 0 && r.height < 44; }).length;
  return { pantalla: (typeof UI!=='undefined')? UI.screen : '?',
           altoDoc: document.documentElement.scrollHeight,
           nodos: app ? app.querySelectorAll('*').length : 0,
           bytes: app ? app.innerHTML.length : 0,
           botones: btns.length, botonesChicos: chicos,
           navAlto: nav ? nav.getBoundingClientRect().height : 0,
           desborde: document.documentElement.scrollWidth > window.innerWidth };
};

/* Cada estado: como dejar el juego antes de medir. */
const ESTADOS = [
  { id:'title-virgen', prep: () => {
      if(typeof UI!=='undefined') UI.screen='title';
      if(typeof render==='function') render();
    } },
  { id:'title-con-carrera', prep: () => {
      if(typeof startCareer === 'function') startCareer();
      for(let i=0;i<12;i++){ try{ advanceWeek(); }catch(e){} }
      if(typeof G!=='undefined' && G) G.pending = [];
      try{ saveGame(true); }catch(e){}
      if(typeof go==='function') go('title'); else { UI.screen='title'; render(); }
    } },
  /* E3 mudo el foco de entrenamiento del inicio a «Entrenar»: hay que medir
     las dos, porque lo que se saca de una aparece en la otra. */
  { id:'train', prep: () => {
      if(typeof startCareer === 'function') startCareer();
      for(let i=0;i<12;i++){ try{ advanceWeek(); }catch(e){} }
      if(typeof G!=='undefined' && G) G.pending = [];
      if(typeof go==='function') go('train'); else { UI.screen='train'; render(); }
    } },
  { id:'hub', prep: () => {
      if(typeof startCareer === 'function') startCareer();
      for(let i=0;i<12;i++){ try{ advanceWeek(); }catch(e){} }
      /* un evento pendiente COLAPSA el hub a 14 nodos: medir ahi da una linea
         base falsa. Se vacia la cola, como en hub-dom.js. */
      if(typeof G!=='undefined' && G) G.pending = [];
      if(typeof UI!=='undefined') UI.screen='hub';
      if(typeof render==='function') render();
    } },
];

(async () => {
  const { chromium } = require(PW);
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const filas = [];
  for(const est of ESTADOS){
    for(const v of VIEWPORTS){
      /* contexto nuevo por fila: title-virgen exige almacenamiento limpio. */
      const ctx  = await browser.newContext({ viewport: { width: v.width, height: v.height } });
      const page = await ctx.newPage();
      await page.goto(JUEGO);
      await page.waitForTimeout(400);
      await page.evaluate(est.prep);
      await page.waitForTimeout(350);
      const m = await page.evaluate(MEDIR);
      m.estado = est.id; m.viewport = v.n;
      m.pantallas = +(m.altoDoc / v.height).toFixed(2);
      filas.push(m);
      await ctx.close();
    }
  }
  await browser.close();
  console.log('estado                viewport   UI.screen  pantallas  altoDoc  nodos  bytes  botones  <44px  navAlto  desborde');
  for(const f of filas){
    console.log(f.estado.padEnd(21), f.viewport.padEnd(10), String(f.pantalla).padEnd(10),
      String(f.pantallas).padStart(7), String(f.altoDoc).padStart(9), String(f.nodos).padStart(6),
      String(f.bytes).padStart(7), String(f.botones).padStart(8), String(f.botonesChicos).padStart(6),
      String(Math.round(f.navAlto)).padStart(8), String(f.desborde).padStart(10));
  }
  fs.writeFileSync(path.join(__dirname,'pantalla-dom.json'), JSON.stringify(filas, null, 1));
})();
