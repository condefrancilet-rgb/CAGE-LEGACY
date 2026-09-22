#!/usr/bin/env node
'use strict';
/* dev/e5-largas.js — E5 · CARRERAS LARGAS CON INVARIANTES **CADA SEMANA**
   ---------------------------------------------------------------------------
   dev/sim.js ya corre 200 carreras variando metaSeed, pero comprueba las
   invariantes UNA VEZ, al final de cada carrera. Eso deja pasar cualquier
   estado invalido que se repare solo antes del final — y el encargo pide
   comprobarlas cada semana.
   Esto corre N carreras de 300 semanas, con metaSeed distinto en cada una, y
   pasa las invariantes DESPUES DE CADA SEMANA. Al primer fallo dice semilla,
   semana y sistema, y sigue con la carrera siguiente para dar el censo entero.
     node dev/e5-largas.js [--n 50] [--weeks 300] [--file otra.html]         */
const H = require('./harness.js');
const A = require('./autopilot.js');
const INV = require('./invariants.js');
const arg = (k,d) => { const i = process.argv.indexOf('--'+k); return i>=0 ? process.argv[i+1] : d; };
const N = parseInt(arg('n','50'),10), WEEKS = parseInt(arg('weeks','300'),10);
const ARCHIVO = arg('file', null) || undefined;

const t0 = Date.now();
const fallos = [];
let semanasTotales = 0, carrerasOk = 0;
const metas = [];

for(let i = 0; i < N; i++){
  const seed = 2000 + i * 13;
  const metaSeed = 700000 + i * 7919;      /* distinto en cada carrera */
  metas.push(metaSeed);
  const h = H.boot({ seed, file: ARCHIVO });
  H.startCareer(h, { metaSeed, style:'mma', div:'LW', age:22 });
  const c = h.ctx;
  let rotaEnEsta = false;
  for(let s = 0; s < WEEKS; s++){
    try {
      if(c.G.pending && c.G.pending.length) c.resolveEvent(0);
      else c.advanceWeek();
    } catch(e){
      fallos.push({ seed, metaSeed, semana: s, sistema: 'excepcion', causa: String(e.message).slice(0,90) });
      rotaEnEsta = true; break;
    }
    semanasTotales++;
    if(c.G.player && c.G.player.retired) break;
    const malas = INV.checkInvariants(c.G, c.UI, {}) || [];
    if(malas.length){
      for(const m of malas.slice(0,2))
        fallos.push({ seed, metaSeed, semana: s,
                      sistema: (m.sistema || m.id || '?'), causa: String(m.causa || m).slice(0,90) });
      rotaEnEsta = true; break;                 /* una carrera rota no sigue */
    }
  }
  if(!rotaEnEsta) carrerasOk++;
  if((i+1) % 10 === 0) process.stdout.write('  ' + (i+1) + '/' + N + ' carreras · ' + fallos.length + ' fallos\n');
}

console.log('');
console.log('CARRERAS LARGAS · ' + N + ' x ' + WEEKS + ' semanas · metaSeed distinto en cada una');
console.log('  metaSeed: ' + metas[0] + ' … ' + metas[metas.length-1] + ' (' + new Set(metas).size + ' distintos)');
console.log('  semanas simuladas: ' + semanasTotales.toLocaleString('es'));
console.log('  invariantes comprobadas: DESPUES DE CADA SEMANA (' + Object.keys(INV.SISTEMAS).length + ' sistemas)');
console.log('  carreras sin un solo fallo: ' + carrerasOk + '/' + N);
console.log('  ' + (Date.now()-t0)/1000 + ' s');
if(fallos.length){
  console.log('\n  FALLOS:');
  for(const f of fallos.slice(0,12))
    console.log('   semilla ' + f.seed + ' meta ' + f.metaSeed + ' semana ' + f.semana + ' · ' + f.sistema + ': ' + f.causa);
} else {
  console.log('\n  sin fallos de invariante');
}
process.exit(fallos.length ? 1 : 0);
