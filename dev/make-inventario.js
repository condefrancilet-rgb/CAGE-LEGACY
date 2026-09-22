#!/usr/bin/env node
'use strict';
/* dev/make-inventario.js — congela el INVENTARIO DEL INICIO: cada accion que
   hoy se puede disparar desde el hub, con su etiqueta y el estado en que
   aparece. Es el fixture de la prueba de "nada se pierde" de E3: despues de
   reorganizar, las mismas acciones tienen que seguir alcanzables.
   Se regenera a mano y a proposito (no en cada suite): si el fixture se
   regenerara solo, la prueba no probaria nada. */
const fs = require('node:fs');
const path = require('node:path');
const H = require('./harness.js');

const SAVE = path.join(__dirname, 'perf', 'congelado', 'save-referencia.json');
const OUT  = path.join(__dirname, 'fixtures', 'e3', 'inventario-inicio.json');

/* SOLO los ids de posts del feed (fp3, fp8...), que se generan en cada
   arranque y cambian con la semilla: pinchar storyReact('fp8',3) hacia fallar
   la red por un post que no existia en otro arranque.
   Los ids de gimnasios, entrenadores y managers NO se canonizan: salen de
   tablas fijas y son estables, y generalizarlos perderia la garantia de que
   cada opcion concreta sigue alcanzable. Mi primer regex se los comia todos. */
function canon(oc){
  return String(oc).replace(/'fp\d+'/g, "'*'");
}

/* misma extraccion que usa la prueba */
function acciones(html){
  const out = [];
  const re = /<button[^>]*onclick="([^"]*)"[^>]*>([\s\S]*?)<\/button>/g;
  let m;
  while((m = re.exec(html))){
    out.push({ onclick: canon(m[1].trim()),
               etiqueta: m[2].replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,48) });
  }
  return out;
}

function estadoSemana(){
  const c = H.boot({ seed: 7 }).ctx;
  c.startCareer();
  for(let i=0;i<12;i++){ try{ c.advanceWeek(); }catch(e){} }
  c.G.pending = [];
  return c;
}

function estadoPelea(){
  const c = H.boot({ seed: 8 }).ctx;
  const crudo = fs.readFileSync(SAVE, 'utf8');
  const id = 's1789970254602';
  c.localStorage.setItem(c.SAVE_ONE + id, crudo);
  const idx = c.saveIndex();
  idx[id] = { name:'referencia', rec:'7-4', div:'', org:'', when:'congelado',
              cash:0, v:c.SAVE_VERSION, at:Date.now(), kb:Math.round(crudo.length/1024) };
  c.saveIndexWrite(idx);
  if(!c.loadGame(id)) throw new Error('el save congelado no carga');
  c.G.pending = [];
  return c;
}

/* --pantallas story,gym  ->  fixture de OTRAS pantallas (E3b). Sin argumento,
   el inventario es el del inicio, como hasta ahora. */
const PANT = process.argv.includes('--pantallas')
  ? process.argv[process.argv.indexOf('--pantallas')+1].split(',')
  : null;
const SALIDA = PANT
  ? path.join(__dirname, 'fixtures', 'e3', 'inventario-' + PANT.join('-') + '.json')
  : OUT;
function pinta(c, nombre){
  if(nombre === 'hub') return c.scrHub();
  const e = c.CL.SCREENS[nombre];
  if(!e) throw new Error('pantalla desconocida: ' + nombre);
  c.UI.screen = nombre; c.UI.sub = null;
  const h = e.fn();
  return h == null ? '' : h;
}

const mapa = new Map();
for(const [nombre, fabrica] of [['semana', estadoSemana], ['pelea', estadoPelea]]){
  const c = fabrica();
  const html = PANT ? PANT.map(x => pinta(c, x)).join('') : c.scrHub();
  for(const a of acciones(html)){
    if(!mapa.has(a.onclick)) mapa.set(a.onclick, { onclick:a.onclick, etiqueta:a.etiqueta, estados:[] });
    const e = mapa.get(a.onclick);
    if(e.estados.indexOf(nombre) < 0) e.estados.push(nombre);
  }
}

const lista = [...mapa.values()].sort((a,b) => a.onclick.localeCompare(b.onclick));
const fixture = {
  generado: 'dev/make-inventario.js',
  nota: PANT ? ('Inventario de ' + PANT.join(' y ') + ' ANTES de E3b.')
             : 'Inventario del inicio ANTES de E3. Cada accion tiene que seguir alcanzable despues.',
  /* Pantallas donde se permite que viva una accion del inventario. Hoy el
     inicio es el unico sitio. E3 la va ampliando, y la prueba exige ademas que
     cada pantalla de esta lista este a <=2 toques del inicio. */
  alcance: PANT ? PANT.slice() : ['hub'],
  acciones: lista,
};
fs.writeFileSync(SALIDA, JSON.stringify(fixture, null, 1));
console.log('acciones congeladas:', lista.length,
            '· solo semana:', lista.filter(a=>a.estados.length===1 && a.estados[0]==='semana').length,
            '· solo pelea:',  lista.filter(a=>a.estados.length===1 && a.estados[0]==='pelea').length,
            '· en ambas:',    lista.filter(a=>a.estados.length===2).length);
console.log('->', path.relative(process.cwd(), SALIDA));
