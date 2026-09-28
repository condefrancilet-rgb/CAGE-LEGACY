#!/usr/bin/env node
'use strict';
/* dev/rpg-neutralidad.js — ¿el cambio altera lo que el jugador VE?
   ------------------------------------------------------------------------
   El golden master (dev/tests/04-golden.js) compara dos cosas a la vez: la
   traza observable (semana a semana y pelea a pelea) y la huella de TODO el
   estado persistible. Cuando un cambio agrega estado nuevo —una bandera que
   antes nadie escribía, el registro de ecos de decisión— la huella cambia
   aunque el juego sea exactamente el mismo, y el golden sale rojo sin decir
   por qué.
   Esto separa las dos preguntas:
     1. TRAZA: ¿el autopiloto vive la misma carrera? (5 semillas del golden)
     2. ESTADO: si se pasa --ref <otro.html>, qué claves persistibles
        difieren al final entre esa versión y la actual, y en qué.
   Uso:
     node dev/rpg-neutralidad.js                      traza vs dev/baseline
     node dev/rpg-neutralidad.js --ref viejo.html     + diff de estado
     node dev/rpg-neutralidad.js --file copia.html    otra copia del juego
   Sale con 1 si alguna traza difiere.                                      */
const fs = require('node:fs');
const path = require('node:path');
const H = require('./harness.js');
const A = require('./autopilot.js');

const arg = (n) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : null; };
const FILE = arg('file') ? path.resolve(arg('file')) : undefined;
const REF = arg('ref') ? path.resolve(arg('ref')) : null;
const TRACES = path.join(__dirname, 'baseline', 'traces');

function correr(file, g){
  const h = H.boot({ seed: g.config.seed, file });
  H.startCareer(h, g.config);
  const r = A.correrCarrera(h, { maxWeeks: g.semanas, politica: 'basica', seedPolitica: g.config.seed, traza: true });
  return { h, traza: r.traza, fp: h.call('STATE.fingerprint', true),
           estado: JSON.parse(JSON.stringify(h.ctx.STATE.persistable(h.ctx.G))) };
}
function diffEstado(a, b){
  const out = [];
  (function cmp(x, y, ruta, prof){
    if(JSON.stringify(x) === JSON.stringify(y)) return;
    if(prof < 7 && x && y && typeof x === 'object' && typeof y === 'object'){
      for(const k of new Set([...Object.keys(x), ...Object.keys(y)])) cmp(x[k], y[k], ruta + '.' + k, prof + 1);
    } else out.push(ruta + ': ' + JSON.stringify(x === undefined ? null : x).slice(0, 90) +
                    ' -> ' + JSON.stringify(y === undefined ? null : y).slice(0, 90));
  })(a, b, 'G', 0);
  /* saveId es un sello de tiempo del guardado: no es estado de juego */
  return out.filter(l => !/^G\.saveId:/.test(l));
}

let rojo = 0;
for(const f of fs.readdirSync(TRACES).filter(x => /^trace-\d+\.json$/.test(x)).sort()){
  const g = JSON.parse(fs.readFileSync(path.join(TRACES, f), 'utf8'));
  const act = correr(FILE, g);
  let primera = -1;
  const n = Math.max(g.traza.length, act.traza.length);
  for(let i = 0; i < n; i++) if(JSON.stringify(g.traza[i]) !== JSON.stringify(act.traza[i])){ primera = i; break; }
  if(primera >= 0) rojo++;
  console.log(g.config.seed + '  traza ' + (primera < 0 ? 'IDÉNTICA' : 'DIFIERE en la entrada ' + primera) +
              '  · huella ' + g.fingerprint + (g.fingerprint === act.fp ? ' = ' : ' → ') + act.fp);
  if(primera >= 0){
    console.log('     antes: ' + JSON.stringify(g.traza[primera]));
    console.log('     ahora: ' + JSON.stringify(act.traza[primera]));
  }
  if(REF){
    const ref = correr(REF, g);
    const d = diffEstado(ref.estado, act.estado);
    console.log('     estado final vs ' + path.basename(REF) + ': ' + (d.length ? d.length + ' diferencia(s)' : 'idéntico'));
    d.slice(0, 12).forEach(l => console.log('       ' + l));
    if(d.length > 12) console.log('       ... y ' + (d.length - 12) + ' más');
  }
}
process.exit(rojo ? 1 : 0);
