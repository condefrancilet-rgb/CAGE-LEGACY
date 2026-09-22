#!/usr/bin/env node
'use strict';
/* dev/perf/inicio.js — CRITERIO DE ACEPTACION DE E3, medido.
   No basta con "el inicio mide 1,49 pantallas en una carrera nueva": eso es el
   caso facil. Esto mide el inicio en sus DOS caras y en las TRES resoluciones,
   y ademas comprueba lo que de verdad importa al jugador:
     · «Avanzar» se ve SIN SCROLL (es la accion de la semana);
     · los avisos activos se ven SIN SCROLL (si hay que scrollear para
       enterarse de que estas pasado de peso, el aviso no avisa);
     · los objetivos tactiles se miden en TODA la pagina, barra incluida: la
       barra inferior es el menu persistente, no decoracion.
   El "peor caso realista" es pelea proxima + tres avisos activos.
     node dev/perf/inicio.js [--file otra-copia.html]                        */
const path = require('node:path');
const fs   = require('node:fs');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PW     = '/opt/node22/lib/node_modules/playwright';
const ARCH = process.argv.includes('--file')
  ? path.resolve(process.argv[process.argv.indexOf('--file')+1])
  : path.join(__dirname, '..', '..', 'index-4-blindado.html');
const VIEWPORTS = [[360,640],[390,844],[412,915]];

/* misma siembra que dev/perf/desborde.js: sin esto dos corridas no comparan */
function sembrar(seed){
  return '(function(){ var a = ' + (seed|0) + ' | 0;' +
         ' Math.random = function(){ a |= 0; a = (a + 0x6D2B79F5) | 0;' +
         ' var t = Math.imul(a ^ (a >>> 15), 1 | a);' +
         ' t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;' +
         ' return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();';
}

const ESTADOS = {
  /* carrera en marcha, sin pelea firmada: la semana de todos los dias */
  normal: () => {},
  /* pelea proxima + tres avisos encendidos a la vez */
  peor: () => {
    const p = G.player, lim = DIVS[p.div].lb;
    p.weightNow = lim + 30;                       /* aviso: peso */
    G.flags = G.flags || {}; G.flags.shop = G.flags.shop || {};
    G.flags.shop.cryoroom = 1;                    /* aviso: instalaciones */
    G.flags.shop.camera = 1;                      /* aviso: equipo de contenido */
    /* peor de verdad: PELEA DE TITULO (titulo mas largo) contra el rival de
       nombre mas largo del plantel, y un evento con nombre largo. Si el peor
       caso se elige comodo, la medicion no vale. */
    const ids = Object.keys(G.fighters).filter(k => k !== p.id && !G.fighters[k].retired);
    const rival = ids.sort((a,b) => (G.fighters[b].name||'').length - (G.fighters[a].name||'').length)[0];
    G.nextFight = { oppId: rival, weeks: 5, purse: 250000, title: true,
                    event: 'Campeonato mundial de peso ligero · cartelera estelar',
                    org: p.org || 'RFL' };
  },
};

(async () => {
  const { chromium } = require(PW);
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const filas = [];
  for(const [nombre, preparar] of Object.entries(ESTADOS)){
    for(const [w,hgt] of VIEWPORTS){
      const ctx  = await browser.newContext({ viewport:{ width:w, height:hgt } });
      const page = await ctx.newPage();
      await page.addInitScript(sembrar(7));
      await page.goto('file://' + ARCH);
      await page.waitForTimeout(400);
      const m = await page.evaluate(({ src }) => {
        syncCreateInputs = function(){ return UI.tmp.c; };
        UI.tmp = UI.tmp || {};
        const d = createDefaults();
        d.metaSeed = 987654321; d.div='LW'; d.style='mma'; d.age=22;
        UI.tmp.c = d;
        startCareer();
        for(let i=0;i<12;i++){ try{ advanceWeek(); }catch(e){} }
        G.pending = [];
        (new Function(src))();                      /* el ajuste del estado */
        UI.screen = 'hub'; render();

        const vh = window.innerHeight;
        const nav = document.getElementById('nav');
        const navAlto = nav && getComputedStyle(nav).display !== 'none' ? nav.getBoundingClientRect().height : 0;
        const fold = vh - navAlto;                  /* lo visible de verdad */
        const bloques = [...document.getElementById('app').children].map(e => {
          const r = e.getBoundingClientRect();
          const t = ((e.querySelector('h1,h2,h3,.b')||{}).textContent || e.className || '').replace(/\s+/g,' ').trim().slice(0,32);
          return { t, top: Math.round(r.top), bottom: Math.round(r.bottom), px: Math.round(r.height),
                   visible: r.bottom <= fold + 0.5 };
        });
        const AVISOS = ['⚖️ Peso','⚡ Tus instalaciones','📹 Equipo de contenido','💸 Deuda','Tu estilo real'];
        const avisos = bloques.filter(b => AVISOS.some(a => b.t.indexOf(a.slice(0,8)) === 0));
        /* la SEÑAL: la franja de chips. El detalle puede quedar mas abajo, la
           señal no. Se identifica por ser el bloque que contiene los chips. */
        const stripEl = document.querySelector('#app .avisos');
        const strip = stripEl ? (function(){ const r = stripEl.getBoundingClientRect();
          return { t:'franja de avisos', top:Math.round(r.top), bottom:Math.round(r.bottom),
                   px:Math.round(r.height), visible: r.bottom <= fold + 0.5 }; })() : null;
        const avanzar = bloques.find(b => b.t.indexOf('Avanzar') === 0) || null;

        /* tactiles en TODA la pagina, barra incluida */
        const todos = [...document.querySelectorAll('button')].map(b => {
          const r = b.getBoundingClientRect();
          return { h: Math.round(r.height), w: Math.round(r.width),
                   donde: nav && nav.contains(b) ? 'barra' : 'pantalla',
                   t: (b.textContent||'').trim().slice(0,18) };
        }).filter(x => x.h > 0);
        return { alto: document.documentElement.scrollHeight, vh, navAlto: Math.round(navAlto), fold: Math.round(fold),
                 bloques, avanzar, avisos, strip,
                 tactiles: todos.length, chicos: todos.filter(x => x.h < 44 || x.w < 44),
                 desborde: document.documentElement.scrollWidth > window.innerWidth };
      }, { src: '(' + preparar.toString() + ')()' });
      m.estado = nombre; m.vp = w + 'x' + hgt;
      m.pantallas = +(m.alto / hgt).toFixed(2);
      filas.push(m);
      await ctx.close();
    }
  }
  await browser.close();

  console.log('estado  viewport  pantallas  alto  barra  «Avanzar» sin scroll   franja de avisos  tarjetas de aviso  tactiles <44px');
  let malo = 0;
  for(const f of filas){
    const av = f.avanzar ? (f.avanzar.visible ? 'SI' : 'NO (acaba en ' + f.avanzar.bottom + ' > ' + f.fold + ')') : '—';
    const vis = f.avisos.filter(a => a.visible).length;
    const avs = f.avisos.length ? (vis + '/' + f.avisos.length) : '—';
    const fr = f.strip ? (f.strip.visible ? 'SI' : 'NO') : (f.avisos.length ? 'FALTA' : '—');
    if(f.avanzar && !f.avanzar.visible) malo++;
    if(f.avisos.length && !(f.strip && f.strip.visible)) malo++;   /* la señal, no el detalle */
    if(f.chicos.length) malo++;
    console.log(f.estado.padEnd(7), f.vp.padEnd(9), String(f.pantallas).padStart(7),
      String(f.alto).padStart(6), String(f.navAlto).padStart(6), '  ' + av.padEnd(22), fr.padEnd(17), avs.padEnd(18),
      String(f.chicos.length).padStart(3) + (f.chicos.length ? ' (' + [...new Set(f.chicos.map(c=>c.donde))].join(',') + ')' : ''));
  }
  const ej = filas[0];
  console.log('\nbloques del inicio en semana normal a 360x640 (fold = ' + ej.fold + ' px):');
  for(const b of ej.bloques) console.log('   ' + String(b.px).padStart(4) + ' px  hasta ' + String(b.bottom).padStart(4) + '  ' + (b.visible?'· ':'  ') + b.t);
  const peor = filas.find(f => f.estado === 'peor');
  console.log('\nbloques en el PEOR CASO a 360x640 (fold = ' + peor.fold + ' px):');
  for(const b of peor.bloques) console.log('   ' + String(b.px).padStart(4) + ' px  hasta ' + String(b.bottom).padStart(4) + '  ' + (b.visible?'· ':'  ') + b.t);
  if(peor.chicos.length){
    console.log('\ntactiles por debajo de 44 px:');
    for(const c of peor.chicos.slice(0,8)) console.log('   ' + c.h + 'x' + c.w + '  ' + c.donde + '  «' + c.t + '»');
  }
  fs.writeFileSync(path.join(__dirname,'inicio.json'), JSON.stringify(filas, null, 1));
  console.log('\n' + (malo ? malo + ' criterio/s sin cumplir' : 'todos los criterios cumplidos'));
  process.exit(malo ? 1 : 0);
})();
