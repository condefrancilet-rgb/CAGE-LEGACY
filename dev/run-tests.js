#!/usr/bin/env node
'use strict';
/* dev/run-tests.js — punto de entrada unico de la suite.
     node dev/run-tests.js              todo
     node dev/run-tests.js --solo boot  filtra por nombre
   Sale con codigo != 0 si algo falla. Imprime la semilla de cada fallo.      */
const fs = require('node:fs');
const path = require('node:path');

const DIR = __dirname;
const solo = (() => { const i = process.argv.indexOf('--solo'); return i >= 0 ? process.argv[i+1] : null; })();

const pruebas = [];
let actual = null;
function suite(nombre, fn){ actual = nombre; fn(); actual = null; }
function test(nombre, fn, meta){ pruebas.push({ suite: actual || '-', nombre, fn, meta: meta || {} }); }

/* --- aserciones --- */
function ok(c, msg){ if(!c) throw new Error(msg || 'se esperaba verdadero'); }
function eq(a, b, msg){
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if(A !== B) throw new Error((msg || 'distinto') + '\n    esperado: ' + B + '\n    obtenido: ' + A);
}
function cerca(a, b, tol, msg){ if(Math.abs(a-b) > tol) throw new Error((msg||'fuera de tolerancia')+': '+a+' vs '+b+' (tol '+tol+')'); }
function lanza(fn, msg){ let l = false; try { fn(); } catch(e){ l = true; } if(!l) throw new Error(msg || 'se esperaba una excepcion'); }

module.exports = { suite, test, ok, eq, cerca, lanza };

/* --- carga de los ficheros de prueba --- */
const dirTests = path.join(DIR, 'tests');
if(fs.existsSync(dirTests))
  for(const f of fs.readdirSync(dirTests).filter(f => f.endsWith('.js')).sort())
    require(path.join(dirTests, f));

/* --- ejecucion --- */
const t0 = Date.now();
let pasados = 0; const fallos = [];
for(const p of pruebas){
  const etiqueta = p.suite + ' › ' + p.nombre;
  if(solo && !etiqueta.toLowerCase().includes(solo.toLowerCase())) continue;
  const ti = Date.now();
  try { p.fn(); pasados++; process.stdout.write('  ok   ' + etiqueta + '  (' + (Date.now()-ti) + 'ms)\n'); }
  catch(e){
    fallos.push({ etiqueta, error: e && e.message || String(e), meta: p.meta, stack: e && e.stack });
    process.stdout.write('  FALLA ' + etiqueta + '  (' + (Date.now()-ti) + 'ms)\n');
  }
}

const ms = Date.now() - t0;
console.log('\n' + '─'.repeat(60));
console.log(`pasados ${pasados} · fallados ${fallos.length} · ${ms} ms`);
if(fallos.length){
  console.log('\nFALLOS:');
  for(const f of fallos){
    console.log('\n• ' + f.etiqueta);
    console.log('  ' + f.error.split('\n').join('\n  '));
    if(f.meta && f.meta.seed !== undefined) console.log('  semilla: ' + f.meta.seed);
    if(f.meta && f.meta.repro) console.log('  repro:   ' + f.meta.repro);
  }
  process.exit(1);
}
console.log('todo verde');
