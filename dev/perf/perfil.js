#!/usr/bin/env node
'use strict';
/* dev/perf/perfil.js — E4: DONDE se va el tiempo, no cuanto.
   baseline.js dice que advanceWeek tarda 24 ms; esto dice en que funciones.
   Usa el perfilador de V8 por node:inspector (modulo nativo, I2) y mapea las
   lineas del script extraido a las lineas del HTML, que es donde se edita.
     node dev/perf/perfil.js [--que advanceWeek|save|load|hub|todo] [--n 200]
   OJO: los ms absolutos dependen de la carga de la maquina. Lo que se compara
   entre corridas es el REPARTO (% de tiempo propio), que es estable.        */
const fs = require('node:fs');
const path = require('node:path');
const inspector = require('node:inspector');
const H = require('../harness.js');
const A = require('../autopilot.js');

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i+1] : d; };
const QUE = arg('que', 'todo');
const N   = parseInt(arg('n', '200'), 10);
const JUEGO = path.join(__dirname, '..', '..', 'index-4-blindado.html');

/* linea del <script> en el HTML: el perfil trae lineas del JS extraido */
const OFFSET = (() => {
  const src = fs.readFileSync(JUEGO, 'utf8');
  const i = src.search(/<script\b[^>]*>/i);
  return i < 0 ? 0 : src.slice(0, i).split('\n').length;   /* 1-based */
})();

function perfilar(fn){
  const s = new inspector.Session();
  s.connect();
  const post = (m, p) => new Promise((res, rej) =>
    s.post(m, p || {}, (e, r) => e ? rej(e) : res(r)));
  return (async () => {
    await post('Profiler.enable');
    await post('Profiler.setSamplingInterval', { interval: 100 });  /* 100 us */
    await post('Profiler.start');
    const t0 = process.hrtime.bigint();
    fn();
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    const { profile } = await post('Profiler.stop');
    s.disconnect();
    return { profile, ms };
  })();
}

/* self time por nodo, a partir de las muestras */
function agregar(profile, msTotal){
  const porId = new Map();
  for(const n of profile.nodes) porId.set(n.id, n);
  const cuenta = new Map();
  for(const id of profile.samples) cuenta.set(id, (cuenta.get(id) || 0) + 1);
  const total = profile.samples.length || 1;
  const filas = [];
  for(const [id, c] of cuenta){
    const n = porId.get(id); if(!n) continue;
    const f = n.callFrame;
    const propio = f.url === 'cage-legacy.js';
    filas.push({
      nombre: f.functionName || '(anonima)',
      donde: propio ? ('index-4-blindado.html:' + (f.lineNumber + OFFSET)) : (f.url || '(motor)'),
      juego: propio,
      muestras: c, pc: +(c*100/total).toFixed(2), ms: +(msTotal*c/total).toFixed(2),
    });
  }
  filas.sort((a,b) => b.muestras - a.muestras);
  return filas;
}

function tabla(titulo, filas, msTotal, n){
  console.log('\n=== ' + titulo + ' ===');
  console.log('total ' + msTotal.toFixed(1) + ' ms en ' + n + ' llamadas · ' +
              (msTotal/n).toFixed(2) + ' ms por llamada');
  console.log('   %   ms      funcion                              donde');
  for(const f of filas.slice(0, 22)){
    console.log(String(f.pc).padStart(6), String(f.ms).padStart(7), ' ',
      (f.nombre || '').slice(0,36).padEnd(36), f.donde);
  }
  const juego = filas.filter(f=>f.juego).reduce((a,b)=>a+b.pc,0);
  console.log('  reparto: juego ' + juego.toFixed(1) + '% · motor/GC ' + (100-juego).toFixed(1) + '%');
}

(async () => {
  const salida = { cuando: new Date().toISOString(), offsetScript: OFFSET, bloques: [] };

  const nuevo = (seed, meta, semanas) => {
    const h = H.boot({ seed });
    H.startCareer(h, { metaSeed: meta, style:'mma', div:'LW', age:22 });
    if(semanas) A.correrCarrera(h, { maxWeeks: semanas, politica:'basica', seedPolitica: seed });
    return h;
  };

  if(QUE === 'advanceWeek' || QUE === 'todo'){
    const h = nuevo(701, 8101, 40);            /* estado ya caliente */
    const { profile, ms } = await perfilar(() => { for(let i=0;i<N;i++) h.ctx.advanceWeek(); });
    const filas = agregar(profile, ms);
    tabla('advanceWeek × ' + N, filas, ms, N);
    salida.bloques.push({ que:'advanceWeek', n:N, ms, filas: filas.slice(0,40) });
  }

  if(QUE === 'save' || QUE === 'todo'){
    const h = nuevo(702, 8102, 300);
    const { profile, ms } = await perfilar(() => { for(let i=0;i<N;i++) h.ctx.saveSerialize(h.ctx.G); });
    const filas = agregar(profile, ms);
    tabla('saveSerialize × ' + N + ' (carrera de 300 semanas)', filas, ms, N);
    salida.bloques.push({ que:'saveSerialize', n:N, ms, filas: filas.slice(0,40) });
  }

  if(QUE === 'load' || QUE === 'todo'){
    const h = nuevo(703, 8103, 300);
    h.ctx.saveGame(true);
    const id = h.ctx.listSaves()[0].id;
    const M = Math.max(10, Math.round(N/8));   /* loadGame es caro */
    const { profile, ms } = await perfilar(() => { for(let i=0;i<M;i++) h.ctx.loadGame(id); });
    const filas = agregar(profile, ms);
    tabla('loadGame × ' + M + ' (save de 300 semanas)', filas, ms, M);
    salida.bloques.push({ que:'loadGame', n:M, ms, filas: filas.slice(0,40) });
  }

  if(QUE === 'hub' || QUE === 'todo'){
    const h = nuevo(704, 8104, 60);
    h.ctx.G.pending = [];
    const { profile, ms } = await perfilar(() => { for(let i=0;i<N*5;i++) h.ctx.scrHub(); });
    const filas = agregar(profile, ms);
    tabla('scrHub × ' + (N*5), filas, ms, N*5);
    salida.bloques.push({ que:'scrHub', n:N*5, ms, filas: filas.slice(0,40) });
  }

  fs.writeFileSync(path.join(__dirname, 'perfil.json'), JSON.stringify(salida, null, 1));
  console.log('\n-> dev/perf/perfil.json');
})();
