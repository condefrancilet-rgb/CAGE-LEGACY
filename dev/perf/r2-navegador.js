#!/usr/bin/env node
'use strict';
/* dev/perf/r2-navegador.js — rendimiento medido en CHROMIUM REAL, no en node:vm.
   ---------------------------------------------------------------------------
   POR QUE EXISTE. El harness de node corre el juego dentro de node:vm, y ahi
   CADA LECTURA DE UNA VARIABLE GLOBAL pasa por un interceptor del contexto.
   Medido: el mismo hash FNV sobre 131.060 caracteres tarda 0,35 ms en node
   plano y 17-25 ms dentro de vm (x50). El juego lee globales en todos sus
   bucles calientes (Math.imul, safeNum, clamp, STKEY...), asi que los perfiles
   de node sobrerrepresentan justo ese codigo. Las decisiones de rendimiento
   salen de aca.

   Que hace: abre el juego por file://, siembra Math.random con el mismo
   mulberry32 que el harness, inyecta dev/autopilot.js tal cual y juega
   carreras enteras, cronometrando por envoltura de las globales:
     semana    doWeek() entero (lo que espera el jugador al tocar avanzar),
               con render real del DOM
     aw        advanceWeek()          save  saveGame()      load  loadGame()
     fp        STATE.fingerprint()    ser   saveSerialize() norm  normalizeFull()
   y la HUELLA final (STATE.fingerprint(true)) de cada carrera. Con la misma
   semilla tiene que coincidir con la de node: si no, los dos instrumentos no
   estan midiendo la misma partida.
   Varias copias se miden INTERCALADAS en la misma corrida (--files a,b).
   --perfil N: perfil de CPU (CDP) de N semanas jugadas, por funcion.

     node dev/perf/r2-navegador.js --files a.html,b.html [--semillas 3]
          [--semanas 300] [--perfil 120] [--out x.json]                      */
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PW     = '/opt/node22/lib/node_modules/playwright';
const RAIZ = path.join(__dirname, '..', '..');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i+1] : d; };
const FILES = arg('files', path.join(RAIZ, 'index-4-blindado.html')).split(',').map(f => path.resolve(f));
const NSEM = parseInt(arg('semillas', '3'), 10);
const SEMANAS = parseInt(arg('semanas', '300'), 10);
const PERFIL = parseInt(arg('perfil', '0'), 10);
const OUT = arg('out', null);
const AUTOPILOT = fs.readFileSync(path.join(__dirname, '..', 'autopilot.js'), 'utf8');

function sembrar(seed){
  /* el mismo mulberry32 que dev/harness.js */
  return '(function(){ var a = ' + (seed|0) + ';' +
    ' Math.random = function(){ a |= 0; a = (a + 0x6D2B79F5) | 0;' +
    ' var t = Math.imul(a ^ (a >>> 15), 1 | a);' +
    ' t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;' +
    ' return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();';
}

/* DENTRO de la pagina */
function jugar({ semanas, meta, seed, cronometrar }){
  const now = () => performance.now();
  const T = { semana: [], aw: [], save: [], load: [], fp: [], ser: [], norm: [] };
  const envolver = (host, k, dest) => {
    const orig = host[k];
    let prof = 0;
    host[k] = function(){ prof++; const t = now(); try { return orig.apply(this, arguments); } finally { prof--; if(!prof) dest.push(now() - t); } };
    return () => { host[k] = orig; };
  };
  /* carrera como la arma dev/harness.js startCareer */
  syncCreateInputs = function(){ return UI.tmp.c; };
  UI.tmp = UI.tmp || {};
  const d = createDefaults(); d.metaSeed = meta; d.first = 'Mateo'; d.last = 'Ferrari'; d.style = 'mma'; d.div = 'LW'; d.age = 22;
  UI.tmp.c = d; startCareer();
  const quitar = [];
  if(cronometrar){
    quitar.push(envolver(window, 'doWeek', T.semana), envolver(window, 'advanceWeek', T.aw), envolver(window, 'saveGame', T.save),
                envolver(window, 'saveSerialize', T.ser), envolver(window, 'normalizeWorldState', T.norm), envolver(STATE, 'fingerprint', T.fp));
  }
  const r = window.__AP.correrCarrera({ ctx: window }, { maxWeeks: semanas, politica: 'basica', seedPolitica: seed });
  quitar.forEach(f => f());
  const huella = STATE.fingerprint(true);
  if(cronometrar){
    for(let i = 0; i < 5; i++){ let t = now(); saveGame(true); T.save.push(now() - t); t = now(); loadGame(G.saveId); T.load.push(now() - t); }
  }
  return { T, huella, semanas: r.semanas, peleas: r.peleas, rec: recStr(G.player), kb: saveSerialize(G).length / 1024,
           heap: performance.memory ? performance.memory.usedJSHeapSize : null };
}

async function abrir(browser, file, seed){
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', e => errores.push(String(e).slice(0, 160)));
  await page.addInitScript(sembrar(seed));
  await page.goto('file://' + file); await page.waitForTimeout(250);
  await page.evaluate(src => { const module = { exports: {} }; (new Function('module', 'exports', 'require', src))(module, module.exports, null); window.__AP = module.exports; }, AUTOPILOT);
  return { ctx, page, errores };
}

const pct = (v, p) => { const s = v.slice().sort((a,b)=>a-b); return s.length ? s[Math.min(s.length-1, Math.floor(s.length*p))] : NaN; };
const med = v => v.length ? v.reduce((a,b)=>a+b,0)/v.length : NaN;
const r2 = v => Math.round(v*100)/100;
const st = v => ({ n: v.length, media: r2(med(v)), p50: r2(pct(v,.5)), p95: r2(pct(v,.95)), max: r2(v.length ? Math.max(...v) : NaN), total: r2(v.reduce((a,b)=>a+b,0)) });

(async () => {
  const { chromium } = require(PW);
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--enable-precise-memory-info', '--js-flags=--expose-gc'] });
  const R = { cuando: new Date().toISOString(), semanas: SEMANAS, copias: [] };
  const acc = FILES.map(f => ({ file: path.relative(RAIZ, f), md5: crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex'),
    bytes: fs.statSync(f).size, T: { semana: [], aw: [], save: [], load: [], fp: [], ser: [], norm: [] }, huellas: [], recs: [], kb: [], heapMB: [], errores: [] }));
  for(let i = 0; i < NSEM; i++){
    const seed = 700 + i*29, meta = 8000 + i*173;
    const orden = acc.map((_, k) => k); if(i % 2) orden.reverse();
    for(const k of orden){
      const a = acc[k];
      const { ctx, page, errores } = await abrir(browser, FILES[k], seed);
      const r = await page.evaluate(jugar, { semanas: SEMANAS, meta, seed, cronometrar: true });
      /* memoria viva tras 300 semanas: gc forzado y heap usado */
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('HeapProfiler.collectGarbage'); await cdp.send('HeapProfiler.collectGarbage');
      const heap = await cdp.send('Runtime.getHeapUsage');
      for(const kk in a.T) a.T[kk].push(...r.T[kk]);
      a.huellas.push(r.huella); a.recs.push(r.rec); a.kb.push(r2(r.kb)); a.heapMB.push(r2(heap.usedSize / 1048576));
      a.errores.push(...errores);
      process.stderr.write(`  semilla ${seed} · ${a.file} · ${r.semanas} sem · ${r.rec} · huella ${r.huella} · semana ${r2(med(r.T.semana))} ms\n`);
      await ctx.close();
    }
  }
  for(const a of acc){
    const o = { file: a.file, md5: a.md5, bytes: a.bytes, huellas: a.huellas, recs: a.recs, kbFinal: a.kb, heapMB: a.heapMB, errores: a.errores };
    for(const kk in a.T) o[kk] = st(a.T[kk]);
    R.copias.push(o);
  }
  if(R.copias.length > 1) R.huellasIguales = R.copias.map(c => JSON.stringify(c.huellas) === JSON.stringify(R.copias[0].huellas));

  if(PERFIL){
    R.perfil = [];
    for(const [k, f] of FILES.entries()){
      const { ctx, page } = await abrir(browser, f, 705);
      await page.evaluate(jugar, { semanas: 120, meta: 8105, seed: 705, cronometrar: false });
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
      await cdp.send('Profiler.start');
      const t0 = Date.now();
      await page.evaluate(n => window.__AP.correrCarrera({ ctx: window }, { maxWeeks: n, politica: 'basica', seedPolitica: 706 }), PERFIL);
      const ms = Date.now() - t0;
      const { profile } = await cdp.send('Profiler.stop');
      const porId = new Map(profile.nodes.map(n => [n.id, n]));
      const padre = new Map(); for(const n of profile.nodes) for(const ch of (n.children || [])) padre.set(ch, n.id);
      const clave = n => (n.callFrame.functionName || '(anon)') + (n.callFrame.url && n.callFrame.url.startsWith('file:') && n.callFrame.url.endsWith('.html') ? ':' + (n.callFrame.lineNumber + 1) : '');
      const self = new Map(), incl = new Map();
      for(const id of profile.samples){
        const n = porId.get(id); self.set(clave(n), (self.get(clave(n)) || 0) + 1);
        const vistos = new Set(); let cur = id;
        while(cur !== undefined){ const kk = clave(porId.get(cur)); if(!vistos.has(kk)){ vistos.add(kk); incl.set(kk, (incl.get(kk) || 0) + 1); } cur = padre.get(cur); }
      }
      const N = profile.samples.length;
      const top = (m, n) => [...m].sort((a,b)=>b[1]-a[1]).slice(0, n).map(([kk, v]) => ({ f: kk, pc: +(v*100/N).toFixed(1) }));
      R.perfil.push({ file: path.relative(RAIZ, f), semanas: PERFIL, ms, msSemana: r2(ms / PERFIL), inclusivo: top(incl, 40), propio: top(self, 25) });
      await ctx.close();
    }
  }
  await browser.close();
  if(OUT) fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
  for(const c of R.copias){
    console.log('\n### ' + c.file + '  (md5 ' + c.md5.slice(0, 8) + ', ' + c.bytes + ' bytes)');
    for(const kk of ['semana','aw','save','ser','fp','norm','load']) console.log('  ' + kk.padEnd(7) + JSON.stringify(c[kk]));
    console.log('  huellas ' + c.huellas.join(' ') + ' · records ' + c.recs.join(' ') + ' · kb ' + c.kbFinal.join(' ') + ' · heapMB ' + c.heapMB.join(' ') + ' · errores ' + c.errores.length);
  }
  if(R.huellasIguales) console.log('\nhuellas iguales a la primera copia: ' + JSON.stringify(R.huellasIguales));
  for(const p of (R.perfil || [])){
    console.log('\n=== perfil ' + p.file + ': ' + p.msSemana + ' ms/semana jugada ===');
    console.log('  inclusivo: ' + p.inclusivo.slice(0, 30).map(x => x.pc + '% ' + x.f).join(' | '));
    console.log('  propio:    ' + p.propio.slice(0, 18).map(x => x.pc + '% ' + x.f).join(' | '));
  }
})().catch(e => { console.error(e); process.exit(1); });
