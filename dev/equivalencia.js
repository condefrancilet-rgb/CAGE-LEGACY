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

   AMPLIACION DEL 2026-09-21 (misma tarde). Un cuarto error, del mismo tipo:
   comparar como INDEPENDIENTES dos brazos que corren las MISMAS semillas.
   sim.js siembra cada carrera con su seed, asi que la carrera i de un brazo y
   la del otro son la misma carrera con el codigo cambiado. Analizarlas sin
   parear tira a la basura casi toda la potencia: el IC de cash salia +-184.195
   cuando el delta pareado de cash es CERO EXACTO en las 200 carreras.
   Ahora, si las semillas coinciden, se hace ademas el analisis PAREADO, que
   ademas dice algo que la media no puede decir: EN CUANTAS carreras cambio
   cada campo, y cuales quedaron identicos bit a bit.
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
/* Error estandar de la DIFERENCIA de dos razones cuando las carreras estan
   PAREADAS (misma semilla en los dos brazos). Se linealiza cada razon,
       R = Sy/Sm   ->   R_hat - R ~ (1/Sm) * S (y_i - R*m_i)
   y se restan los residuos de la MISMA carrera antes de elevar al cuadrado.
   Si el cambio no toca esa metrica, el residuo pareado es cero en todas las
   carreras y el intervalo se cierra en cero, que es lo que de verdad pasa.  */
function eeRazonPareada(pares, fy, fm){
  const n = pares.length;
  let SyA=0, SmA=0, SyB=0, SmB=0;
  for(const [x, y] of pares){ SyA+=fy(x); SmA+=fm(x); SyB+=fy(y); SmB+=fm(y); }
  if(!SmA || !SmB) return null;
  const RA = SyA/SmA, RB = SyB/SmB;
  let s = 0;
  for(const [x, y] of pares){
    const d = (fy(y) - RB*fm(y))/SmB - (fy(x) - RA*fm(x))/SmA;
    s += d*d;
  }
  return { RA, RB, ee: Math.sqrt(Math.max(0, (n/(n-1)) * s)) };
}

/* Error estandar de una PROPORCION por carrera (la carrera es la unidad). */
function eeProp(cs, f){
  const n = cs.length, k = cs.filter(f).length, p = k / n;
  return { R: p, ee: Math.sqrt(p * (1 - p) / n) };
}

function veredicto(delta, ee, margen){
  const lo = delta - 2 * ee, hi = delta + 2 * ee;
  if(lo >= -margen && hi <= margen){
    /* Equivalente NO quiere decir "igual": quiere decir "la diferencia cabe
       dentro del margen que declare antes de mirar". Si ademas el intervalo
       excluye el cero, la diferencia es REAL y esta medida; solo es chica.
       Sin esta marca, un "EQUIVALENTE" se lee como "no cambio nada", que es
       justo el error que esta herramienta existe para no repetir. */
    const real = (lo > 0 || hi < 0);
    return [real ? 'EQUIVALENTE (efecto real, < margen)' : 'EQUIVALENTE', lo, hi];
  }
  if(lo > margen || hi < -margen)   return ['DIFERENTE',   lo, hi];
  return ['NO CONCLUYENTE', lo, hi];
}

console.log('n = ' + a.length + ' vs ' + b.length +
  '   ·   margenes: medias ' + (MARGEN.medias_rel*100) + ' % · prop/carrera ' +
  MARGEN.prop_carrera + ' pp · prop/pelea ' + MARGEN.prop_pelea + ' pp\n');

let noEquiv = 0, distintos = 0;

/* ---------- PAREO POR SEMILLA ----------
   sim.js siembra cada carrera con su seed. Si los dos brazos corrieron las
   mismas, la carrera i de uno y la del otro son LA MISMA carrera con el codigo
   cambiado: cada una es su propio control. Se paran antes de las tablas porque
   las medias tambien se benefician (el IC pareado es mucho mas estrecho). */
let porQueNoPareado = '';
const PARES = (() => {
  /* Se parea SOLO si los dos brazos corrieron EXACTAMENTE el mismo conjunto de
     semillas. Con parear "lo que se solape" pasa esto: comparando un brazo de
     200 contra uno de 500 se pareaban 200 y se tiraban 300, mientras la tabla
     de medias seguia promediando 200 contra 500. El delta pareado salia 0 y
     las medias mostradas diferian en 87.000 — dos cuentas sobre poblaciones
     distintas en la misma linea. Me paso; ahora no se parea y se dice por que. */
  if(a.length !== b.length){ porQueNoPareado = 'los brazos tienen n distinto (' + a.length + ' vs ' + b.length + ')'; return null; }
  const sa = a.map(c => c.seed), sb = b.map(c => c.seed);
  if(new Set(sa).size !== sa.length){ porQueNoPareado = 'hay semillas repetidas en el brazo "antes"'; return null; }
  const ia = new Map(a.map(c => [c.seed, c]));
  if(!sb.every(x => ia.has(x))){ porQueNoPareado = 'los brazos no corrieron las mismas semillas'; return null; }
  if(sb.length < 2){ porQueNoPareado = 'hacen falta al menos 2 carreras'; return null; }
  return b.map(c => [ia.get(c.seed), c]);
})();

console.log(PARES ? 'Los dos brazos comparten las ' + PARES.length + ' semillas: se analiza PAREADO.\n'
                  : 'Sin parear: ' + porQueNoPareado + '.\n');

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
  /* Con pareo, el error estandar sale de las DIFERENCIAS por carrera, no de
     las dos varianzas sumadas: si el cambio no toca esa metrica, la diferencia
     pareada es cero y el intervalo se cierra en cero. */
  let ee, delta;
  if(PARES){
    const d = PARES.map(([x, y]) => f(y) - f(x)).filter(Number.isFinite);
    delta = media(d);
    ee = d.length > 1 ? Math.sqrt(varianza(d) / d.length) : 0;
  } else {
    delta = mb - ma;
    ee = Math.sqrt(varianza(va)/va.length + varianza(vb)/vb.length);
  }
  const margen = Math.abs(ma) * MARGEN.medias_rel;
  const [v, lo, hi] = veredicto(delta, ee, margen);
  if(v.indexOf('EQUIVALENTE') !== 0) noEquiv++;
  if(v === 'DIFERENTE') distintos++;
  console.log(n.padEnd(19), ma.toFixed(1).padStart(10), mb.toFixed(1).padStart(11),
    delta.toFixed(1).padStart(11),
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
  const par = PARES ? eeRazonPareada(PARES, fy, fm) : null;
  const d = (rb.R - ra.R) * 100;
  const ee = par ? par.ee * 100 : Math.sqrt(ra.ee*ra.ee + rb.ee*rb.ee) * 100;
  const [v, lo, hi] = veredicto(d, ee, MARGEN.prop_pelea);
  if(v.indexOf('EQUIVALENTE') !== 0) noEquiv++;
  if(v === 'DIFERENTE') distintos++;
  console.log(n.padEnd(19), (ra.R*100).toFixed(2).padStart(9), (rb.R*100).toFixed(2).padStart(11),
    d.toFixed(2).padStart(11), ('[' + lo.toFixed(2) + ', ' + hi.toFixed(2) + ']').padStart(24), '  ' + v);
}
{
  const esCampeon = c => (Number(c.titulos) > 0 ? 1 : 0);
  const ra = eeProp(a, c => Number(c.titulos) > 0), rb = eeProp(b, c => Number(c.titulos) > 0);
  let d, ee;
  if(PARES){
    /* pareado: la unidad es la carrera, asi que la diferencia por carrera vale
       -1, 0 o +1 y su media es el delta. Si nadie cambia de estado, es cero. */
    const dif = PARES.map(([x, y]) => esCampeon(y) - esCampeon(x));
    d = media(dif) * 100;
    ee = (dif.length > 1 ? Math.sqrt(varianza(dif)/dif.length) : 0) * 100;
  } else {
    d = (rb.R - ra.R) * 100;
    ee = Math.sqrt(ra.ee*ra.ee + rb.ee*rb.ee) * 100;
  }
  const [v, lo, hi] = veredicto(d, ee, MARGEN.prop_carrera);
  if(v.indexOf('EQUIVALENTE') !== 0) noEquiv++;
  if(v === 'DIFERENTE') distintos++;
  console.log('% campeones'.padEnd(19), (ra.R*100).toFixed(2).padStart(9), (rb.R*100).toFixed(2).padStart(11),
    d.toFixed(2).padStart(11), ('[' + lo.toFixed(2) + ', ' + hi.toFixed(2) + ']').padStart(24), '  ' + v);
}

/* ---------- ANALISIS PAREADO ----------
   Solo si los dos brazos corrieron las mismas semillas. Cada carrera es su
   propio control: lo que quede distinto es del cambio, no del azar. */
let pareado = null;
{
  const pares = PARES || [];
  if(PARES){
    const campos = new Map();
    for(const [x, y] of pares){
      for(const k of Object.keys(y)){
        if(k === 'ms' || k === 'fp' || k === 'seed') continue;   /* ms es tiempo de reloj */
        if(JSON.stringify(x[k]) === JSON.stringify(y[k])) continue;
        if(!campos.has(k)) campos.set(k, []);
        campos.get(k).push(typeof x[k] === 'number' && typeof y[k] === 'number' ? y[k] - x[k] : null);
      }
    }
    const todosCampos = new Set();
    for(const [, y] of pares) for(const k of Object.keys(y)) if(k!=='ms' && k!=='fp') todosCampos.add(k);
    pareado = { n: pares.length, campos, total: todosCampos.size };
    console.log('\nPAREADO POR SEMILLA (' + pares.length + ' pares) — cada carrera es su propio control');
    if(!campos.size){
      console.log('  ningun campo cambia en ninguna carrera: los brazos son indistinguibles campo a campo.');
    } else {
      console.log('  campo             carreras que cambian     media del delta      min           max');
      for(const [k, ds] of [...campos].sort((x, y) => y[1].length - x[1].length)){
        const nums = ds.filter(Number.isFinite);
        const info = nums.length
          ? [media(nums).toFixed(1), Math.min(...nums), Math.max(...nums)]
          : ['(no numerico)', '-', '-'];
        console.log('  ' + k.padEnd(18), String(ds.length + '/' + pares.length).padStart(10),
          String(info[0]).padStart(20), String(info[1]).padStart(12), String(info[2]).padStart(12));
      }
      const tocados = [...campos.keys()];
      const todos = new Set(); for(const [,y] of pares) for(const k of Object.keys(y)) todos.add(k);
      const intactos = [...todos].filter(k => k !== 'ms' && k !== 'fp' && !campos.has(k));
      console.log('  identicos en las ' + pares.length + ' carreras (' + intactos.length + '): ' + intactos.join(' '));
      console.log('  cambian (' + tocados.length + '): ' + tocados.join(' '));
    }
  } else {
    console.log('\nPAREADO: no se puede — los dos brazos no comparten semillas.');
  }
}

console.log('\nfallos de invariante:', A.resumen.fallosInvariantes, '->', B.resumen.fallosInvariantes);
/* Por semilla, no por indice: sim.js reparte entre workers y el orden de
   llegada no es el de salida, asi que comparar a[i] con b[i] compara carreras
   distintas. Con 200 contra 500 eso daba "49 de 200" donde la verdad era 199. */
let iguales = 0, totalFp = 0;
if(PARES){
  for(const [x, y] of PARES){ totalFp++; if(x.fp === y.fp) iguales++; }
} else {
  const ia = new Map(a.map(c => [c.seed, c]));
  for(const y of b){ const x = ia.get(y.seed); if(!x) continue; totalFp++; if(x.fp === y.fp) iguales++; }
}
console.log('carreras con huella identica:', iguales, 'de', totalFp, '(pareadas por semilla)');

console.log('');
if(totalFp && iguales === totalFp){
  console.log('IDENTICO: las ' + iguales + ' huellas coinciden. No hace falta inferencia.');
} else if(distintos > 0){
  console.log('HAY AL MENOS UNA DIFERENCIA REAL (' + distintos + ' metrica/s con el IC entero fuera del margen).');
} else if(noEquiv > 0){
  console.log('NO CONCLUYENTE en ' + noEquiv + ' metrica/s: el IC no cabe entero dentro del margen.');
  console.log('Con esta n no se puede AFIRMAR equivalencia; tampoco se detecto diferencia.');
  if(pareado && !pareado.campos.size){
    console.log('PERO EL PAREADO SI CONCLUYE: ningun campo cambia en ninguna de las ' +
      pareado.n + ' carreras. Es identidad, no equivalencia estadistica.');
  } else if(pareado && pareado.campos.size <= 3){
    console.log('PERO EL PAREADO SI CONCLUYE: de ' + pareado.total + ' campos de la carrera solo cambia/n ' +
      [...pareado.campos.keys()].join(', ') + '; los otros ' + (pareado.total - pareado.campos.size) +
      ' son identicos en las ' + pareado.n + ' carreras.');
  } else if(pareado){
    const peor = Math.max(...[...pareado.campos.values()].map(v => v.length));
    console.log('Y EL PAREADO TAMPOCO RESCATA EL VEREDICTO: el cambio toca ' + pareado.campos.size +
      ' de ' + pareado.total + ' campos, hasta en ' + Math.round(peor*100/pareado.n) +
      ' % de las carreras. Hace falta mas n, no mas analisis.');
  }
} else {
  console.log('EQUIVALENCIA ACEPTADA: todos los IC caben dentro de su margen.');
}
