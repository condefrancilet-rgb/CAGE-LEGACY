#!/usr/bin/env node
'use strict';
/* dev/perf/hub-dom.js — lo que el jugador ve DE VERDAD en el inicio: altura en
   pantallas, nodos y objetivos tactiles, en las tres resoluciones. Es la linea
   base de E3 y no se puede sacar del harness: el hub se arma con hooks que
   necesitan el DOM real. */
const path = require('node:path');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PW     = '/opt/node22/lib/node_modules/playwright';
const JUEGO  = 'file://' + path.join(__dirname, '..', '..', 'index-4-blindado.html');
const VIEWPORTS = [
  { n:'360x640', width:360, height:640 },
  { n:'390x844', width:390, height:844 },
  { n:'412x915', width:412, height:915 },
];
(async () => {
  const { chromium } = require(PW);
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const filas = [];
  for(const v of VIEWPORTS){
    const page = await browser.newPage({ viewport: { width: v.width, height: v.height } });
    await page.goto(JUEGO);
    await page.waitForTimeout(400);
    await page.evaluate(() => { if(typeof startCareer === 'function') startCareer(); });
    await page.waitForTimeout(300);
    /* OJO: si hay un evento pendiente el hub SE COLAPSA a mostrar solo el
       evento (14 nodos, 1 pantalla). Medir en ese estado da una linea base
       falsa — me paso, y lo vi al contrastar con una captura. Se mide el hub
       NORMAL: se avanzan semanas y se vacia la cola antes de medir. */
    await page.evaluate(() => {
      for(let i=0;i<12;i++){ try{ advanceWeek(); }catch(e){} }
      if(typeof G!=='undefined' && G) G.pending = [];
      if(typeof UI!=='undefined') UI.screen = 'hub';
      if(typeof render==='function') render();
    });
    await page.waitForTimeout(300);
    const m = await page.evaluate(() => {
      const app = document.getElementById('app');
      const nav = document.getElementById('nav');
      const alto = document.documentElement.scrollHeight;
      const btns = [...document.querySelectorAll('button')];
      const chicos = btns.filter(b => { const r = b.getBoundingClientRect(); return r.height > 0 && r.height < 44; }).length;
      return { pantalla: (typeof UI!=='undefined')? UI.screen : '?',
               pendientes: (typeof G!=='undefined'&&G&&G.pending)? G.pending.length : -1,
               altoDoc: alto, nodos: app ? app.querySelectorAll('*').length : 0,
               bytes: app ? app.innerHTML.length : 0,
               botones: btns.length, botonesChicos: chicos,
               navAlto: nav ? nav.getBoundingClientRect().height : 0,
               desborde: document.documentElement.scrollWidth > window.innerWidth };
    });
    m.viewport = v.n;
    m.pantallas = +(m.altoDoc / v.height).toFixed(2);
    filas.push(m);
    await page.close();
  }
  await browser.close();
  console.log('resolucion   pantallas  altoDoc  nodos  bytes  botones  <44px  navAlto  desborde');
  for(const f of filas){
    console.log(f.viewport.padEnd(12), String(f.pantallas).padStart(7),
      String(f.altoDoc).padStart(9), String(f.nodos).padStart(6), String(f.bytes).padStart(7),
      String(f.botones).padStart(8), String(f.botonesChicos).padStart(6),
      String(Math.round(f.navAlto)).padStart(8), String(f.desborde).padStart(10));
  }
  require('node:fs').writeFileSync(path.join(__dirname,'hub-dom.json'), JSON.stringify(filas, null, 1));
})();
