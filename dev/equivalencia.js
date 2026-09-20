#!/usr/bin/env node
'use strict';
/* dev/equivalencia.js — criterio de F2 para dos salidas de sim.js:
   medias dentro de 2 errores estandar, proporciones dentro de 2 pp.
   Imprime tambien el ruido de muestreo de cada proporcion, porque una
   tolerancia plana puede ser mas estrecha que la propia medicion.
     node dev/equivalencia.js antes.json despues.json                        */
const A = require(require('node:path').resolve(process.argv[2]));
const B = require(require('node:path').resolve(process.argv[3]));
const a = A.carreras, b = B.carreras;

const num = (cs, f) => cs.map(f).filter(Number.isFinite);
const media = v => v.reduce((p, q) => p + q, 0) / v.length;
const sd = v => { const m = media(v); return Math.sqrt(v.reduce((p, q) => p + (q - m) ** 2, 0) / (v.length - 1)); };
const suma = (cs, f) => cs.reduce((p, c) => p + (Number(f(c)) || 0), 0);
const peleas = cs => suma(cs, c => c.rec.w + c.rec.l + c.rec.d);
const metodos = cs => suma(cs, c => c.ko + c.kol + c.sub + c.subl + c.dec + c.decl);

console.log(`n = ${a.length} vs ${b.length}\n`);
let fuera = 0;

console.log('MEDIAS                 antes      despues       delta        2*EE   veredicto');
for(const [n, f] of [
  ['peleas por carrera', c => c.rec.w + c.rec.l + c.rec.d],
  ['edad final',         c => c.edadFinal],
  ['popularidad',        c => Number(c.pop)],
  ['titulos',            c => Number(c.titulos)],
  ['cash',               c => Number(c.cash)],
  ['careerEarn',         c => Number(c.careerEarn)],
]){
  const va = num(a, f), vb = num(b, f);
  const ma = media(va), mb = media(vb);
  const ee = Math.sqrt(sd(va) ** 2 / va.length + sd(vb) ** 2 / vb.length);
  const d = mb - ma, ok = Math.abs(d) <= 2 * ee;
  if(!ok) fuera++;
  console.log(n.padEnd(20), ma.toFixed(1).padStart(10), mb.toFixed(1).padStart(12),
    d.toFixed(1).padStart(11), (2 * ee).toFixed(1).padStart(11), '  ' + (ok ? 'equivalente' : 'FUERA'));
}

console.log('\nPROPORCIONES           antes      despues    delta(pp)   ruido(2EE)  veredicto');
for(const [n, f, base] of [
  ['win rate',    cs => suma(cs, c => c.rec.w) / (peleas(cs) || 1) * 100, peleas],
  ['% KO',        cs => (suma(cs, c => c.ko) + suma(cs, c => c.kol)) / (metodos(cs) || 1) * 100, metodos],
  ['% sumision',  cs => (suma(cs, c => c.sub) + suma(cs, c => c.subl)) / (metodos(cs) || 1) * 100, metodos],
  ['% decision',  cs => (suma(cs, c => c.dec) + suma(cs, c => c.decl)) / (metodos(cs) || 1) * 100, metodos],
  ['% campeones', cs => cs.filter(c => Number(c.titulos) > 0).length / cs.length * 100, cs => cs.length],
]){
  const pa = f(a), pb = f(b), d = pb - pa;
  const nBase = Math.min(base(a), base(b));
  const ruido = 2 * Math.sqrt((pa / 100) * (1 - pa / 100) / nBase) * 100;
  const ok = Math.abs(d) <= 2;
  if(!ok) fuera++;
  const nota = (!ok && Math.abs(d) <= ruido) ? '  FUERA (pero dentro del ruido de muestreo)' : (ok ? '  equivalente' : '  FUERA');
  console.log(n.padEnd(20), pa.toFixed(2).padStart(10), pb.toFixed(2).padStart(12),
    d.toFixed(2).padStart(11), ruido.toFixed(2).padStart(12), nota);
}

console.log('\nfallos de invariante:', A.resumen.fallosInvariantes, '->', B.resumen.fallosInvariantes);
let iguales = 0;
for(let i = 0; i < Math.min(a.length, b.length); i++) if(a[i].fp === b[i].fp) iguales++;
console.log('carreras con huella identica:', iguales, 'de', Math.min(a.length, b.length));
console.log('\n' + (fuera === 0 ? 'EQUIVALENCIA ACEPTADA' : fuera + ' metrica(s) fuera de tolerancia'));
