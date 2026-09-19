#!/usr/bin/env node
'use strict';
/* dev/redef-map.js — mapa de cadenas de redefinicion.
   No se queda en el analisis estatico: arranca el juego en el harness, toma el
   CODIGO FUENTE de la funcion viva y lo localiza en el archivo. Eso dice cual
   definicion gana de verdad en runtime, que es lo que importa al consolidar.
     node dev/redef-map.js            tabla
     node dev/redef-map.js --json f   JSON                                    */
const fs = require('node:fs');
const path = require('node:path');
const H = require('./harness.js');
const M = require('./metrics.js');

function normaliza(s){ return String(s).replace(/\s+/g, ' ').trim(); }

/* El analisis trabaja sobre el JS extraido; los grep del equipo se hacen sobre
   el HTML. Se calcula el desplazamiento para poder citar ambas numeraciones. */
function offsetHTML(){
  const src = fs.readFileSync(H.GAME, 'utf8');
  const i = src.search(/<script\b[^>]*>/i);
  if(i < 0) return 0;
  const hasta = src.slice(0, i);
  const tag = src.slice(i).match(/<script\b[^>]*>/i)[0];
  return hasta.split('\n').length - 1 + (tag.includes('\n') ? 0 : 1);
}

function mapa(){
  const m = M.analyze();
  const js = H.extractJS();
  const OFF = offsetHTML();
  const lineas = js.split('\n');
  const h = H.boot({ seed: 1 });

  const multiples = m.funciones.detalleMultiples;
  const filas = [];

  for(const def of multiples){
    const viva = h.ctx[def.nombre];
    const fila = {
      nombre: def.nombre, veces: def.veces, lineas: def.lineas,
      lineasHTML: def.lineas.map(l => l + OFF),
      tipoVivo: typeof viva, ganadora: null, comoGana: null,
      capturadaPor: [], nota: '',
    };

    if(typeof viva === 'function'){
      const fuente = normaliza(viva.toString());
      /* se busca cual de las definiciones declaradas coincide con la viva:
         se compara el inicio del cuerpo con el texto del archivo en esa linea */
      let mejor = null;
      for(const ln of def.lineas){
        /* ventana desde la linea de definicion */
        const ventana = normaliza(lineas.slice(ln - 1, ln + 40).join('\n'));
        /* firma: los primeros 120 caracteres significativos de la funcion viva */
        const firma = fuente.slice(0, 120);
        if(ventana.includes(firma.slice(0, Math.min(80, firma.length)))) { mejor = ln; }
      }
      if(mejor !== null){
        fila.ganadora = mejor;
        fila.ganadoraHTML = mejor + OFF;
        const esUltima = mejor === Math.max(...def.lineas);
        fila.comoGana = esUltima ? 'ultima definicion' : 'NO es la ultima (linea ' + mejor + ' de ' + JSON.stringify(def.lineas) + ')';
      } else {
        fila.comoGana = 'no coincide con ninguna definicion del archivo';
        fila.nota = 'probablemente envuelta en runtime (GATE, wrapper o hook)';
      }
    } else if(viva === undefined){
      fila.nota = 'no existe en el contexto global (local a un IIFE o a un ambito menor)';
    }

    /* wrappers que capturan esta funcion */
    for(const w of m.funciones.detalleWrappers)
      if(w.objetivo === def.nombre) fila.capturadaPor.push({ alias: w.alias, linea: w.linea });

    filas.push(fila);
  }

  /* wrappers cuyo objetivo NO esta en la lista de multiples */
  const huerfanos = m.funciones.detalleWrappers.filter(
    w => !multiples.some(d => d.nombre === w.objetivo));

  return { total: multiples.length, offsetHTML: OFF, filas,
           wrappers: m.funciones.detalleWrappers.map(w => ({ ...w, lineaHTML: w.linea + OFF })),
           huerfanos: huerfanos.map(w => ({ ...w, lineaHTML: w.linea + OFF })) };
}

function tabla(r){
  const L = [];
  L.push('CADENAS DE REDEFINICION — ' + r.total + ' nombres definidos mas de una vez');
  L.push('(lineas en numeracion del HTML; desplazamiento JS->HTML = +' + r.offsetHTML + ')');
  L.push('');
  L.push('nombre                     n  lineas                         gana en runtime');
  L.push('─'.repeat(100));
  for(const f of r.filas.sort((a,b) => b.veces - a.veces || a.nombre.localeCompare(b.nombre))){
    const ln = JSON.stringify(f.lineasHTML).slice(0, 30);
    const gana = f.ganadora !== null ? String(f.ganadoraHTML) + ' (' + f.comoGana + ')' : (f.comoGana || f.nota);
    L.push(f.nombre.padEnd(26) + String(f.veces).padStart(2) + '  ' + ln.padEnd(31) + gana);
    if(f.capturadaPor.length)
      L.push('   capturada por: ' + f.capturadaPor.map(c => c.alias + ' (L' + (c.linea + r.offsetHTML) + ')').join(', '));
    if(f.nota && f.ganadora !== null) L.push('   nota: ' + f.nota);
  }
  L.push('');
  L.push('WRAPPERS (captura de la implementacion previa) — ' + r.wrappers.length);
  for(const w of r.wrappers) L.push('  L' + String(w.lineaHTML).padStart(6) + '  ' + w.alias + ' = ' + w.objetivo);
  if(r.huerfanos.length){
    L.push('');
    L.push('wrappers cuyo objetivo NO se redefine despues (' + r.huerfanos.length + '):');
    for(const w of r.huerfanos) L.push('  L' + w.lineaHTML + '  ' + w.alias + ' = ' + w.objetivo);
  }
  return L.join('\n');
}

if(require.main === module){
  const r = mapa();
  const i = process.argv.indexOf('--json');
  if(i >= 0){ fs.writeFileSync(process.argv[i+1], JSON.stringify(r, null, 2)); console.log('escrito ' + process.argv[i+1]); }
  else console.log(tabla(r));
}
module.exports = { mapa, tabla };
