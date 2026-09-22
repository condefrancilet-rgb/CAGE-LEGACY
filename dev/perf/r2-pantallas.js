#!/usr/bin/env node
'use strict';
/* dev/perf/r2-pantallas.js — todas las pantallas, en Chromium real, en tres
   resoluciones y dos estados de partida, para VARIAS copias del juego en la
   misma corrida (la comparacion antes/despues solo vale medida junta).

     node dev/perf/r2-pantallas.js --files a.html,b.html [--out x.json] [--reps 9]

   Por pantalla mide:
     alto        document.scrollHeight con las secciones como vienen (plegadas)
     altoAbierto el mismo alto con TODAS las <details> abiertas
     nodos       elementos bajo #app
     ms          render() con escritura real del DOM (mediana de --reps). Se
                 anula el atajo de dedupeDOM (__perfLast) antes de cada vuelta:
                 sin eso, redibujar la misma pantalla no toca el DOM y se mide
                 solo la construccion de la cadena
     texto       NaN/undefined/null/[object Object]/Infinity en el texto
                 VISIBLE, con las secciones abiertas
     desborde    scrollWidth > ancho, y elementos visibles que se salen
     chicos      tactiles VISIBLES (checkVisibility, no getBoundingClientRect:
                 un boton dentro de un <details> cerrado igual reporta 66x44)
                 con alto < 44 px, con las secciones abiertas
   Estados: `temprano` (carrera recien creada por la UI) y `avanzado` (el save
   congelado de la ronda, cargado con loadGame).                             */
const path = require('node:path');
const fs   = require('node:fs');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PW     = '/opt/node22/lib/node_modules/playwright';
const RAIZ   = path.join(__dirname, '..', '..');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i+1] : d; };
const FILES = arg('files', path.join(RAIZ, 'index-4-blindado.html')).split(',').map(f => path.resolve(f));
const OUT = arg('out', null);
const REPS = parseInt(arg('reps', '9'), 10);
const SAVE = arg('save', path.join(__dirname, 'congelado-r2', 'save-r2.json'));
const VPS = [ { n:'360x640', width:360, height:640 }, { n:'390x844', width:390, height:844 }, { n:'412x915', width:412, height:915 } ];

async function crearCarrera(page){
  await page.click('button:has-text("Empezar una carrera")'); await page.waitForTimeout(100);
  await page.click('button.pri:has-text("Continuar")');      await page.waitForTimeout(100);
  await page.fill('#cfirst', 'Mateo'); await page.fill('#clast', 'Ferrari');
  await page.click('button.pri:has-text("Continuar")');      await page.waitForTimeout(100);
  await page.click('button.pri:has-text("Continuar")');      await page.waitForTimeout(100);
  await page.click('button:has-text("Empezar carrera")');    await page.waitForTimeout(600);
}
async function cargarSave(page, crudo){
  const ok = await page.evaluate(({crudo}) => {
    const id = 's1789970254999';
    localStorage.setItem(SAVE_ONE + id, crudo);
    const idx = saveIndex();
    idx[id] = { name:'r2', rec:'', div:'', org:'', when:'congelado', cash:0, v:SAVE_VERSION, at:Date.now(), kb:Math.round(crudo.length/1024) };
    saveIndexWrite(idx);
    return !!loadGame(id) && !!(G && G.player);
  }, {crudo});
  if(!ok) throw new Error('el save congelado no cargo');
  await page.waitForTimeout(200);
}

/* se ejecuta DENTRO de la pagina */
function medirPantalla({ n, reps }){
  const app = document.getElementById('app');
  G.pending = G.pending || [];
  const pend = G.pending; G.pending = [];           /* el hub colapsa con un evento pendiente */
  const mide = () => {
    UI.screen = n; UI.sub = null;
    if(app) app.__perfLast = null;                   /* forzar escritura real del DOM */
    const t = performance.now(); render(); return performance.now() - t;
  };
  let err = null; const ms = [];
  try { for(let i = 0; i < reps; i++) ms.push(mide()); } catch(e){ err = e.message; }
  const real = UI.screen;
  const alto = document.documentElement.scrollHeight;
  const nodos = app.querySelectorAll('*').length;
  const bytes = app.innerHTML.length;
  /* abrir todo lo plegado */
  const dets = [...document.querySelectorAll('#app details')];
  dets.forEach(d => { d.open = true; });
  const altoAbierto = document.documentElement.scrollHeight;
  const W = window.innerWidth;
  const visibles = [...document.querySelectorAll('#app *, #nav *')].filter(e => e.checkVisibility());
  const texto = (app.innerText || '') + '\n' + (document.getElementById('nav').innerText || '');
  const malas = [];
  for(const re of [/\bNaN\b/, /\bundefined\b/, /\bnull\b/, /\[object Object\]/, /\bInfinity\b/]){
    const m = texto.match(re); if(m){ const i = m.index; malas.push(texto.slice(Math.max(0,i-30), i+30).replace(/\s+/g,' ')); }
  }
  const fuera = visibles.filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > W + 1 || r.left < -1); })
    .slice(0, 5).map(e => e.tagName + '.' + e.className + ' ' + Math.round(e.getBoundingClientRect().right));
  const tact = visibles.filter(e => e.matches('button, a[href], input, select, textarea, summary, [onclick]'));
  const chicos = tact.filter(e => { const r = e.getBoundingClientRect(); return r.height > 0 && r.height < 44; })
    .map(e => { const r = e.getBoundingClientRect(); return e.tagName + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' «' + (e.textContent||'').trim().slice(0,20) + '»'; });
  const botonesOcultos = [...app.querySelectorAll('button')].filter(b => !b.checkVisibility()).length;
  G.pending = pend;
  ms.sort((a,b) => a-b);
  return { n, real, err, alto, altoAbierto, nodos, bytes,
    ms: ms.length ? +ms[ms.length >> 1].toFixed(3) : null,
    desborde: document.documentElement.scrollWidth > W + 1 ? document.documentElement.scrollWidth : 0, fuera,
    texto: malas, tactiles: tact.length, chicos, botonesOcultos };
}

(async () => {
  const { chromium } = require(PW);
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const crudo = fs.existsSync(SAVE) ? fs.readFileSync(SAVE, 'utf8') : null;
  if(!crudo) console.error('AVISO: no hay save congelado en ' + SAVE + ' — solo estado temprano');
  const R = { cuando: new Date().toISOString(), reps: REPS, filas: [] };
  for(const vp of VPS){
    for(const estado of ['temprano', 'avanzado']){
      if(estado === 'avanzado' && !crudo) continue;
      for(const f of FILES){
        const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height },
          deviceScaleFactor: 2, isMobile: true, hasTouch: true });
        const page = await ctx.newPage();
        const errores = [];
        page.on('pageerror', e => errores.push('pageerror: ' + String(e)));
        page.on('console', m => { if(m.type() === 'error') errores.push('console: ' + m.text()); });
        await page.goto('file://' + f); await page.waitForTimeout(300);
        if(estado === 'temprano') await crearCarrera(page); else await cargarSave(page, crudo);
        const nombres = await page.evaluate(() => Object.keys(CL.SCREENS).sort());
        for(const n of nombres){
          const r = await page.evaluate(medirPantalla, { n, reps: REPS });
          r.vp = vp.n; r.estado = estado; r.file = path.relative(RAIZ, f);
          R.filas.push(r);
        }
        const errJuego = await page.evaluate(() => (typeof ERR !== 'undefined' && ERR.log) ? ERR.log.length : null).catch(() => null);
        R.filas.push({ vp: vp.n, estado, file: path.relative(RAIZ, f), resumen: true, errores, errJuego });
        await ctx.close();
      }
    }
  }
  await browser.close();
  if(OUT) fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
  /* tabla corta */
  const filas = R.filas.filter(r => !r.resumen);
  for(const f of FILES.map(x => path.relative(RAIZ, x))){
    console.log('\n### ' + f);
    console.log('vp       estado    pantalla       ->real       pant  abierto  nodos    ms   texto desb chicos');
    for(const r of filas.filter(r => r.file === f))
      console.log(r.vp.padEnd(8), r.estado.padEnd(9), r.n.padEnd(14), (r.real !== r.n ? '->'+r.real : '').padEnd(12),
        (r.alto / +r.vp.split('x')[1]).toFixed(2).padStart(5), (r.altoAbierto / +r.vp.split('x')[1]).toFixed(2).padStart(7),
        String(r.nodos).padStart(6), String(r.ms).padStart(6), String(r.texto.length).padStart(5),
        String(r.desborde || r.fuera.length).padStart(4), String(r.chicos.length).padStart(6), r.err ? 'ERR ' + r.err : '');
    for(const r of R.filas.filter(r => r.resumen && r.file === f))
      console.log('  errores ' + r.vp + ' ' + r.estado + ': ' + r.errores.length + (r.errores.length ? ' ' + r.errores.slice(0,3).join(' | ') : ''));
  }
})().catch(e => { console.error(e); process.exit(1); });
