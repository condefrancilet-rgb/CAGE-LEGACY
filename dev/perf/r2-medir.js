#!/usr/bin/env node
'use strict';
/* dev/perf/r2-medir.js — linea base de la ronda 2 (optimizacion + auditoria).
   Mide VARIAS copias del juego en la MISMA corrida, intercaladas por semilla
   (A,B,A,B...), porque los ms dependen de la carga de la maquina: comparar
   contra un numero de otra corrida inventa mejoras (ya paso: -42 % falso en E4).

     node --expose-gc dev/perf/r2-medir.js --files base.html,index-4-blindado.html
          [--semillas 3] [--semanas 300] [--out dev/perf/r2-medir.json]

   Que mide, por copia:
     aw_crudo   advanceWeek() en bucle, sin jugador que actue (como E4)
     aw_juego   advanceWeek() DENTRO de una carrera del autopiloto (peleas,
                eventos, campamentos): se envuelve la global, asi que tambien
                cuenta las llamadas internas (doWeek -> advanceWeek)
     semana     doWeek() entero: entrenar + semana + autoguardado. Es lo que
                espera el jugador al tocar "avanzar"
     save/load  saveGame(true) y loadGame(id) en las semanas 50, 150 y 300
     kb         tamano del save serializado en esas semanas
     heap       memoria viva (tras gc) antes y despues de 300 semanas, en un
                proceso hijo por copia y semilla: medirla en el mismo proceso
                que otras carreras mezcla basura ajena
     huella     STATE.fingerprint(true) al final de cada carrera: si dos copias
                que deberian ser equivalentes dan huellas distintas, la
                medicion de tiempo no vale nada (no hacen lo mismo)          */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const H = require('../harness.js');
const A = require('../autopilot.js');

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i+1] : d; };
const RAIZ = path.join(__dirname, '..', '..');
const FILES = (arg('files', path.join(RAIZ, 'index-4-blindado.html'))).split(',').map(f => path.resolve(f));
const NSEM = parseInt(arg('semillas', '3'), 10);
const SEMANAS = parseInt(arg('semanas', '300'), 10);
const OUT = arg('out', null);
const now = () => Number(process.hrtime.bigint()) / 1e6;
const pct = (v, p) => { const s = v.slice().sort((a,b)=>a-b); return s[Math.min(s.length-1, Math.floor(s.length*p))]; };
const med = v => v.length ? v.reduce((a,b)=>a+b,0)/v.length : NaN;
const r2 = v => Math.round(v*100)/100;

/* ---------- modo hijo: memoria de UNA carrera ---------- */
if(process.argv.includes('--hijo-mem')){
  const file = arg('file'), seed = +arg('seed'), meta = +arg('meta');
  const gc = global.gc || (() => {});
  gc(); gc();
  const h0 = process.memoryUsage().heapUsed;
  const h = H.boot({ seed, file });
  H.startCareer(h, { metaSeed: meta, style:'mma', div:'LW', age:22 });
  gc(); gc();
  const h1 = process.memoryUsage().heapUsed;
  A.correrCarrera(h, { maxWeeks: SEMANAS, politica:'basica', seedPolitica: seed });
  h.errores.length = 0;
  gc(); gc();
  const h2 = process.memoryUsage().heapUsed;
  process.stdout.write(JSON.stringify({ arranque: h1 - h0, fin: h2 - h0, crecimiento: h2 - h1,
    peleadores: Object.keys(h.G.fighters).length }));
  process.exit(0);
}

/* ---------- una carrera cronometrada ---------- */
function carrera(file, seed, meta){
  const h = H.boot({ seed, file });
  H.startCareer(h, { metaSeed: meta, style:'mma', div:'LW', age:22 });
  const c = h.ctx;
  const aw = [], semana = [], save = [], load = [], kb = {};
  const origAW = c.advanceWeek;
  c.advanceWeek = function(){ const t = now(); try { return origAW.apply(this, arguments); } finally { aw.push(now() - t); } };
  const origDW = c.doWeek;
  let hitos = [50, 150, 300], base = c.G.year*52 + c.G.week;
  c.doWeek = function(){
    const t = now(); let r;
    try { r = origDW.apply(this, arguments); } finally { semana.push(now() - t); }
    const s = c.G.year*52 + c.G.week - base;
    if(hitos.length && s >= hitos[0]){
      const hito = hitos.shift();
      kb[hito] = c.saveSerialize(c.G).length / 1024;
    }
    return r;
  };
  A.correrCarrera(h, { maxWeeks: SEMANAS, politica:'basica', seedPolitica: seed });
  c.advanceWeek = origAW; c.doWeek = origDW;
  for(const hito of hitos) kb[hito] = c.saveSerialize(c.G).length / 1024;   /* la carrera acabo antes */
  const fp = h.call('STATE.fingerprint', true);
  /* save/load al final, 5 veces: el primero paga la migracion si la hubiera */
  for(let i = 0; i < 5; i++){
    let t = now(); c.saveGame(true); save.push(now() - t);
    const id = c.listSaves()[0].id;
    t = now(); c.loadGame(id); load.push(now() - t);
  }
  const errores = h.errores.length;
  return { aw, semana, save, load, kb, fp, errores, sem: c.G.year*52 + c.G.week - base };
}

function crudo(file, seed, meta){
  const h = H.boot({ seed, file });
  H.startCareer(h, { metaSeed: meta, style:'mma', div:'LW', age:22 });
  const c = h.ctx, v = [];
  for(let s = 1; s <= SEMANAS; s++){ const t = now(); c.advanceWeek(); v.push(now() - t); }
  return { v, fp: h.call('STATE.fingerprint', true) };
}

/* ---------- principal ---------- */
const R = { cuando: new Date().toISOString(), semanas: SEMANAS, semillas: NSEM, copias: [] };
const acc = FILES.map(f => ({
  file: path.relative(RAIZ, f),
  md5: crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex'),
  bytes: fs.statSync(f).size,
  aw_crudo: [], aw_juego: [], semana: [], save: [], load: [], kb: { 50:[], 150:[], 300:[] },
  heap: [], huellas: [], huellasCrudo: [], errores: 0,
}));

for(let i = 0; i < NSEM; i++){
  const seed = 700 + i*29, meta = 8000 + i*173;
  /* intercalado: en cada semilla, todas las copias, alternando el orden para
     que ninguna copia corra siempre primera (con la maquina mas fria) */
  const orden = acc.map((_, k) => k); if(i % 2) orden.reverse();
  for(const k of orden){
    const a = acc[k], f = FILES[k];
    const cr = crudo(f, seed, meta);
    a.aw_crudo.push(...cr.v); a.huellasCrudo.push(cr.fp);
    const r = carrera(f, seed, meta);
    a.aw_juego.push(...r.aw); a.semana.push(...r.semana); a.save.push(...r.save); a.load.push(...r.load);
    for(const s of [50,150,300]) if(r.kb[s] !== undefined) a.kb[s].push(r.kb[s]);
    a.huellas.push(r.fp); a.errores += r.errores;
    const mem = JSON.parse(execFileSync(process.execPath,
      ['--expose-gc', __filename, '--hijo-mem', '--file', f, '--seed', String(seed), '--meta', String(meta),
       '--semanas', String(SEMANAS)], { maxBuffer: 1 << 20 }).toString());
    a.heap.push(mem);
    process.stderr.write(`  semilla ${seed} · ${a.file} · ${r.sem} semanas · huella ${r.fp}\n`);
  }
}

for(const a of acc){
  const st = v => ({ n: v.length, media: r2(med(v)), p50: r2(pct(v,.5)), p95: r2(pct(v,.95)), max: r2(Math.max(...v)) });
  R.copias.push({
    file: a.file, md5: a.md5, bytes: a.bytes,
    aw_crudo: st(a.aw_crudo), aw_juego: st(a.aw_juego), semana: st(a.semana),
    save: st(a.save), load: st(a.load),
    kb: { s50: r2(med(a.kb[50])), s150: r2(med(a.kb[150])), s300: r2(med(a.kb[300])) },
    heapMB: { arranque: r2(med(a.heap.map(m => m.arranque))/1048576), fin: r2(med(a.heap.map(m => m.fin))/1048576),
              crecimiento: r2(med(a.heap.map(m => m.crecimiento))/1048576) },
    peleadoresFin: a.heap.map(m => m.peleadores),
    huellas: a.huellas, huellasCrudo: a.huellasCrudo, errores: a.errores,
  });
}
/* dos copias con huellas distintas NO son comparables en tiempo: se avisa */
if(R.copias.length > 1){
  const ref = R.copias[0];
  R.huellasIguales = R.copias.map(c => JSON.stringify(c.huellas) === JSON.stringify(ref.huellas) &&
                                       JSON.stringify(c.huellasCrudo) === JSON.stringify(ref.huellasCrudo));
}
const txt = JSON.stringify(R, null, 1);
if(OUT) fs.writeFileSync(OUT, txt);
console.log(txt);
