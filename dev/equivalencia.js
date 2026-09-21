#!/usr/bin/env node
'use strict';
/* dev/equivalencia.js — compara dos salidas de sim.js.
   node dev/equivalencia.js antes.json despues.json [--margen-medias 2]

   ============================================================================
   CORRECCION DEL 2026-09-21. La version anterior calculaba MAL el ruido y por
   eso emitia veredictos que no se sostienen. Tres errores, los tres reales:

   1. RUIDO DE UN BRAZO, NO DE LA DIFERENCIA. Calculaba
      2*sqrt(p*(1-p)/n) sobre el brazo "antes". Eso es el error de UNA
      proporcion. El de la DIFERENCIA entre dos brazos independientes es
      sqrt(pa*qa/na + pb*qb/nb), que para n iguales es ~sqrt(2) veces mayor.
      El "4,98 pp" que reporte para % campeones era exactamente
      2*sqrt(0,855*0,145/200): el ruido real rondaba los 7 pp.

   2. PROPORCIONES POR PELEA SIN AGRUPAR. win rate, % KO, % sumision y
      % decision se calculan sobre PELEAS, pero las peleas estan anidadas en
      carreras: dos peleas de la misma carrera no son independientes. Tratar
      n = numero de peleas infla la precision. Ahora se usa el estimador
      linealizado de una razon con la CARRERA como conglomerado:
          Var(R) = n/((n-1)*(Sm)^2) * S (y_i - R*m_i)^2
      que no supone nada sobre la correlacion intra-carrera: la mide.

   3. "DENTRO DEL RUIDO" NO ES "EQUIVALENTE". Que un intervalo contenga al
      cero solo dice que no se detecto diferencia; con muestras chicas eso pasa
      casi siempre. Para AFIRMAR equivalencia hace falta un margen fijado de
      antemano y que el intervalo ENTERO caiga dentro (dos pruebas de un lado,
      TOST). Ahora hay tres veredictos y "NO CONCLUYENTE" es un resultado
      legitimo, no un aprobado.
   ============================================================================ */
const path = require('node:path');
const A = require(path.resolve(process.argv[2]));
const B = require(path.resolve(process.argv[3]));
const a = A.carreras, b = B.carreras;
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? Number(process.argv[i+1]) : d; };

/* ---------- MARGENES, FIJADOS DE ANTEMANO ----------
   Sin margen no hay equivalencia posible. Se declaran aqui y no se tocan
   despues de ver los datos, que seria justamente hacer trampa. */
const MARGEN = {
  medias_rel: arg('margen-medias', 5) / 100,  /* 5 % del valor de referencia */
  prop_carrera: 5,                            /* pp, para proporciones por CARRERA */
  prop_pelea: 2,                              /* pp, para proporciones por PELEA */
};

const num = (cs, f) => cs.map(f).filter(Number.isFinite);
const media = v => v.reduce((p, q) => p + q, 0) / v.length;
const varianza = v => { const m = media(v); return v.reduce((p, q) => p + (q - m) ** 2, 0) / (v.length - 1); };

/* Error estandar de una RAZON con conglomerados (carreras).
   y: numerador por carrera · m: denominador por carrera. */
function eeRazon(cs, fy, fm){
  const y = cs.map(fy), m = cs.map(fm);
  const Sy = y.reduce((p,q)=>p+q,0), Sm = m.reduce((p,q)=>p+q,0);
  if(!Sm) return { R: 0, ee: 0 };
  const R = Sy / Sm, n = cs.length;
  let s = 0;
  for(let i = 0; i < n; i++){ const r = y[i] - R * m[i]; s += r * r; }
  const v = (n / ((n - 1) * Sm * Sm)) * s;
  return { R, ee: Math.sqrt(Math.max(0, v)) };
}
/* Error estandar de una PROPORCION por carrera (la carrera es la unidad). */
function eeProp(cs, f){
  const n = cs.length, k = cs.filter(f).length, p = k / n;
  return { R: p, ee: Math.sqrt(p * (1 - p) / n) };
}

function veredicto(delta, ee, margen){
  const lo = delta - 2 * ee, hi = delta + 2 * ee;
  if(lo >= -margen && hi <= margen) return ['EQUIVALENTE', lo, hi];
  if(lo > margen || hi < -margen)   return ['DIFERENTE',   lo, hi];
  return ['NO CONCLUYENTE', lo, hi];
}

console.log('n = ' + a.length + ' vs ' + b.length +
  '   ·   margenes: medias ' + (MARGEN.medias_rel*100) + ' % · prop/carrera ' +
  MARGEN.prop_carrera + ' pp · prop/pelea ' + MARGEN.prop_pelea + ' pp\n');

let noEquiv = 0, distintos = 0;

console.log('MEDIAS                antes     despues       delta    IC95 de la diferencia   veredicto');
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
  const ee = Math.sqrt(varianza(va)/va.length + varianza(vb)/vb.length);
  const margen = Math.abs(ma) * MARGEN.medias_rel;
  const [v, lo, hi] = veredicto(mb - ma, ee, margen);
  if(v !== 'EQUIVALENTE') noEquiv++;
  if(v === 'DIFERENTE') distintos++;
  console.log(n.padEnd(19), ma.toFixed(1).padStart(10), mb.toFixed(1).padStart(11),
    (mb-ma).toFixed(1).padStart(11),
    ('[' + lo.toFixed(1) + ', ' + hi.toFixed(1) + ']').padStart(24), '  ' + v);
}

console.log('\nPROPORCIONES          antes     despues   delta(pp)   IC95 de la diferencia   veredicto');
const PROPS = [
  ['win rate',    'pelea',  c => c.rec.w,            c => c.rec.w + c.rec.l + c.rec.d],
  ['% KO',        'pelea',  c => c.ko + c.kol,       c => c.ko+c.kol+c.sub+c.subl+c.dec+c.decl],
  ['% sumision',  'pelea',  c => c.sub + c.subl,     c => c.ko+c.kol+c.sub+c.subl+c.dec+c.decl],
  ['% decision',  'pelea',  c => c.dec + c.decl,     c => c.ko+c.kol+c.sub+c.subl+c.dec+c.decl],
];
for(const [n, tipo, fy, fm] of PROPS){
  const ra = eeRazon(a, fy, fm), rb = eeRazon(b, fy, fm);
  const d = (rb.R - ra.R) * 100;
  const ee = Math.sqrt(ra.ee*ra.ee + rb.ee*rb.ee) * 100;
  const [v, lo, hi] = veredicto(d, ee, MARGEN.prop_pelea);
  if(v !== 'EQUIVALENTE') noEquiv++;
  if(v === 'DIFERENTE') distintos++;
  console.log(n.padEnd(19), (ra.R*100).toFixed(2).padStart(9), (rb.R*100).toFixed(2).padStart(11),
    d.toFixed(2).padStart(11), ('[' + lo.toFixed(2) + ', ' + hi.toFixed(2) + ']').padStart(24), '  ' + v);
}
{
  const ra = eeProp(a, c => Number(c.titulos) > 0), rb = eeProp(b, c => Number(c.titulos) > 0);
  const d = (rb.R - ra.R) * 100;
  const ee = Math.sqrt(ra.ee*ra.ee + rb.ee*rb.ee) * 100;
  const [v, lo, hi] = veredicto(d, ee, MARGEN.prop_carrera);
  if(v !== 'EQUIVALENTE') noEquiv++;
  if(v === 'DIFERENTE') distintos++;
  console.log('% campeones'.padEnd(19), (ra.R*100).toFixed(2).padStart(9), (rb.R*100).toFixed(2).padStart(11),
    d.toFixed(2).padStart(11), ('[' + lo.toFixed(2) + ', ' + hi.toFixed(2) + ']').padStart(24), '  ' + v);
}

console.log('\nfallos de invariante:', A.resumen.fallosInvariantes, '->', B.resumen.fallosInvariantes);
let iguales = 0;
for(let i = 0; i < Math.min(a.length, b.length); i++) if(a[i].fp === b[i].fp) iguales++;
console.log('carreras con huella identica:', iguales, 'de', Math.min(a.length, b.length));

console.log('');
if(iguales === Math.min(a.length, b.length)){
  console.log('IDENTICO: las ' + iguales + ' huellas coinciden. No hace falta inferencia.');
} else if(distintos > 0){
  console.log('HAY AL MENOS UNA DIFERENCIA REAL (' + distintos + ' metrica/s con el IC entero fuera del margen).');
} else if(noEquiv > 0){
  console.log('NO CONCLUYENTE en ' + noEquiv + ' metrica/s: el IC no cabe entero dentro del margen.');
  console.log('Con esta n no se puede AFIRMAR equivalencia; tampoco se detecto diferencia.');
} else {
  console.log('EQUIVALENCIA ACEPTADA: todos los IC caben dentro de su margen.');
}
