#!/usr/bin/env node
'use strict';
/* dev/estado-mapa.js — MAPA GLOBAL DE ESTADO (fase 13)
   ---------------------------------------------------------------------------
   Dos mitades que se cruzan:
     1. el CÓDIGO: un análisis sintáctico real (acorn) del <script> del juego
        registra cada acceso a una propiedad —quién escribe, quién lee— con la
        función que lo contiene. No cuenta apariciones de un nombre en el texto:
        distingue `a.x = 1` (escribe), `a.x += 1` (lee y escribe), `{x: 1}`
        (inicializa), `a.x` (lee) y 'x' (clave usada por cadena, a[k]).
     2. el ESTADO: una carrera real, de la que se recorre STATE.persistable(G)
        —lo que va al disco— con las claves que son ids (f551, gym3, 2018|RFL|LW,
        stand:l) plegadas a '*'.
   Una hoja del estado cuyo nombre nadie lee en el código (ni por punto ni por
   cadena) es una candidata a huérfana. dev/estado-inventario.js declara cuáles
   se conocen y por qué siguen ahí; la prueba 25 exige que la lista y el juego
   coincidan en las dos direcciones.

     node dev/estado-mapa.js [--file otra.html] [--semanas 160] [--claves]     */
const fs = require('node:fs');
const path = require('node:path');

/* acorn: el del proyecto si lo hubiera; si no, el que trae eslint instalado con
   node. Si no hay ninguno, se dice: una prueba que no puede analizar no pasa. */
function cargarAcorn(){
  const intentos = [
    () => require('acorn'),
    () => require(path.join(path.dirname(process.execPath), '..', 'lib', 'node_modules', 'eslint', 'node_modules', 'acorn')),
    () => require(path.join(path.dirname(process.execPath), '..', 'lib', 'node_modules', 'acorn')),
  ];
  for(const f of intentos){ try { return f(); } catch(e){} }
  throw new Error('estado-mapa: no se encontró acorn (npm i -g acorn, o eslint global). Sin analizador no hay mapa.');
}

const GAME = path.join(__dirname, '..', 'index-4-blindado.html');

/* ---------- 1. el código ---------- */
function analizar(archivo){
  const acorn = cargarAcorn();
  const html = fs.readFileSync(archivo || GAME, 'utf8');
  const nl = []; for(let i = 0; i < html.length; i++) if(html.charCodeAt(i) === 10) nl.push(i);
  const linea = (off) => { let lo = 0, hi = nl.length; while(lo < hi){ const m = (lo + hi) >> 1; if(nl[m] < off) lo = m + 1; else hi = m; } return lo + 1; };
  const acc = [];
  const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/g; let m;
  while((m = re.exec(html))){
    if(m[1] && /src=/.test(m[1])) continue;
    const off = m.index + m[0].indexOf('>') + 1;
    const ast = acorn.parse(m[2], { ecmaVersion: 2022, allowReturnOutsideFunction: true });
    const pila = [];
    const cadena = (n) => {
      const partes = [];
      while(n && n.type === 'MemberExpression'){
        partes.unshift(n.computed ? (n.property.type === 'Literal' ? String(n.property.value) : '*') : n.property.name);
        n = n.object;
      }
      if(n && n.type === 'Identifier'){ partes.unshift(n.name); return partes; }
      if(n && n.type === 'ThisExpression'){ partes.unshift('this'); return partes; }
      if(n && n.type === 'CallExpression'){ const c = cadena(n.callee); if(c){ partes.unshift(c.join('.') + '()'); return partes; } }
      return null;
    };
    const visitar = (n, padre) => {
      if(!n || typeof n.type !== 'string') return;
      let empujo = false;
      if(/Function/.test(n.type)){
        let nom = n.id && n.id.name;
        if(!nom && padre){
          if(padre.type === 'VariableDeclarator' && padre.id.name) nom = padre.id.name;
          else if(padre.type === 'AssignmentExpression'){ const c = cadena(padre.left); if(c) nom = c.join('.'); }
          else if(padre.type === 'Property' && padre.key) nom = padre.key.name || padre.key.value;
          else if(padre.type === 'CallExpression' && padre.callee){
            const c = cadena(padre.callee), a0 = padre.arguments[0];
            nom = (c ? c.join('.') : 'call') + '(' + (a0 && a0.type === 'Literal' ? JSON.stringify(a0.value) : '') + ')';
          }
        }
        pila.push(nom || ('anon@' + linea(off + n.start))); empujo = true;
      }
      const f = pila[pila.length - 1] || '(top)';
      if(n.type === 'MemberExpression'){
        const c = cadena(n);
        if(c){
          let k = 'r';
          if(padre){
            if(padre.type === 'AssignmentExpression' && padre.left === n) k = padre.operator === '=' ? 'w' : 'rw';
            else if(padre.type === 'UpdateExpression') k = 'rw';
            else if(padre.type === 'UnaryExpression' && padre.operator === 'delete') k = 'd';
            else if(padre.type === 'CallExpression' && padre.callee === n) k = 'call';
            else if(padre.type === 'MemberExpression' && padre.object === n) k = 'base';
          }
          if(k !== 'base') acc.push({ p: c.join('.'), k, f, l: linea(off + n.start) });
        }
      }
      /* recorrer un contenedor por sus claves (for-in, Object.keys/values/entries)
         lo lee entero: sus hijos son datos, no campos con nombre */
      if(n.type === 'ForInStatement'){ const c = cadena(n.right); if(c) acc.push({ p: c.join('.') + '.*', k: 'r', f, l: linea(off + n.start) }); }
      if(n.type === 'CallExpression' && n.callee && n.callee.type === 'MemberExpression' && n.callee.object && n.callee.object.name === 'Object' &&
         /^(keys|values|entries)$/.test(n.callee.property && n.callee.property.name) && n.arguments[0]){
        const c = cadena(n.arguments[0]); if(c) acc.push({ p: c.join('.') + '.*', k: 'r', f, l: linea(off + n.start) });
      }
      if(n.type === 'Property' && padre && padre.type === 'ObjectExpression' && n.key){
        const kn = n.key.type === 'Identifier' ? n.key.name : (n.key.type === 'Literal' ? String(n.key.value) : null);
        if(kn) acc.push({ p: '{}.' + kn, k: 'init', f, l: linea(off + n.start) });
      }
      if(n.type === 'Literal' && typeof n.value === 'string' && /^[A-Za-z_]\w{1,}$/.test(n.value) && !(padre && padre.type === 'MemberExpression'))
        acc.push({ p: '"' + n.value + '"', k: 'str', f, l: linea(off + n.start) });
      for(const key in n){
        if(key === 'type' || key === 'start' || key === 'end') continue;
        const v = n[key];
        if(Array.isArray(v)) v.forEach(x => x && typeof x.type === 'string' && visitar(x, n));
        else if(v && typeof v.type === 'string') visitar(v, n);
      }
      if(empujo) pila.pop();
    };
    visitar(ast, null);
  }
  return acc;
}

/* Índice por NOMBRE de hoja: los alias (var c=G.camp; c.x) se resuelven así. */
function indice(acc){
  const I = Object.create(null);
  const add = (n, a) => { (I[n] = I[n] || []).push(a); };
  for(const a of acc){
    if(a.p.startsWith('"')){ add(a.p.slice(1, -1), a); continue; }
    if(a.p.startsWith('{}.')){ add(a.p.slice(3), a); continue; }
    const s = a.p.split('.');
    add(s[s.length - 1], a);
    /* leer a.b.c también lee b: el tramo intermedio cuenta como lectura */
    for(let i = 1; i < s.length - 1; i++) add(s[i], { p: a.p, k: 'r', f: a.f, l: a.l, sub: true });
  }
  return I;
}
/* De quién es cada lectura: el juego, la interfaz, un registro, una prueba o
   el saneo. Sólo las dos primeras son consumidores; las otras tres son
   observabilidad y mantenimiento (fase 13 §3-§4). */
function claseDeLector(f){
  if(/saveValidate|^inv\(|^t\(|TESTS|^scn\(|audit|selfTest/i.test(f)) return 'prueba';
  if(/normalize|repair|migrate|sanitize|prune|saveGame|loadGame|saveExpand|saveSerialize/i.test(f)) return 'saneo';
  if(/pushNews|careerLog|flog|Log$|^errLog|journal|diary/i.test(f)) return 'registro';
  if(/^scr|Card|HTML|hub|render|panel|draw|modal|Txt|html|view|badge|summary|toast|label|chip/i.test(f)) return 'interfaz';
  return 'juego';
}
function lectores(I, nombre){
  const out = { juego: new Set(), interfaz: new Set(), registro: new Set(), prueba: new Set(), saneo: new Set(), escritores: new Set() };
  for(const a of (I[nombre] || [])){
    /* una tabla literal a nivel de archivo ({castigo:1, minimizar:.5}) es un
       dato que otro lee por clave, no alguien que escribe el estado */
    if(a.k === 'init' && a.f === '(top)'){ out[claseDeLector(a.f)].add('(tabla)'); continue; }
    if(a.k === 'w' || a.k === 'd' || a.k === 'init'){ out.escritores.add(a.f); continue; }
    if(a.k === 'rw') out.escritores.add(a.f);
    out[claseDeLector(a.f)].add(a.f);
  }
  return out;
}

/* ---------- 2. el estado ---------- */
const ES_ID = (k) => /^[a-z]{1,4}\d+$/.test(k) || /^\d+$/.test(k) || /[|:]/.test(k) || /^S\d{4}/.test(k) || /^npc/.test(k);
function rutas(G, persistable){
  const out = new Map();
  const visita = (v, p, d) => {
    if(d > 5 || v === null || typeof v !== 'object') return;
    if(Array.isArray(v)){ v.slice(0, 6).forEach(x => visita(x, p + '[]', d + 1)); return; }
    for(const k of Object.keys(v)){
      const kk = ES_ID(k) ? '*' : k;
      const r = p + '.' + kk;
      if(!out.has(r)) out.set(r, kk);
      visita(v[k], r, d + 1);
    }
  };
  visita(persistable, 'G', 0);
  return out;
}

/* ---------- 3. la carrera de muestra ---------- */
function carreraDeMuestra(opts, alPaso){
  const H = require('./harness.js'), A = require('./autopilot.js');
  const h = H.boot({ seed: opts.seed || 7777, file: opts.file });
  H.startCareer(h, { metaSeed: opts.metaSeed || 777001, style: 'mma', div: 'LW', age: 22 });
  const c = h.ctx;
  for(let w = 0; w < (opts.semanas || 160); w += 4){
    A.correrCarrera(h, { maxWeeks: 4, politica: 'basica', seedPolitica: w });
    if(w === 20 && c.clSetSpend) c.clSetSpend('pro');
    const t = c.TQ && c.TQ.T.filter(x => c.TQ.canUnlock(x.id).ok)[0]; if(t) c.TQ.unlock(t.id);
    if(alPaso) alPaso(c);
  }
  return h;
}

function mapa(opts){
  opts = opts || {};
  const acc = analizar(opts.file);
  const I = indice(acc);
  /* las rutas se juntan a lo largo de la carrera: el campamento, la pelea
     firmada o un evento pendiente existen sólo algunas semanas */
  const R = new Map();
  const junta = (c) => { const st = JSON.parse(JSON.stringify(c.STATE.persistable(c.G))); for(const [r, k] of rutas(c.G, st)) if(!R.has(r)) R.set(r, k); return st; };
  const h = opts.h || carreraDeMuestra(opts, junta);
  const c = h.ctx;
  const st = junta(c);
  /* registros de claves dinámicas: contenedores que el código recorre o indexa
     con una clave calculada (x[k], for-in, Object.keys). Sus hijos son datos. */
  const DIN = new Set();
  for(const a of acc){ const s = a.p.split('.'); for(let i = 2; i < s.length; i++) if(s[i] === '*' && s[i - 1] && s[i - 1] !== '*' && !/\(\)$/.test(s[i - 1])) DIN.add(s[i - 1]); }
  const sinLector = [];
  for(const [r, hoja] of R){
    if(hoja === '*' || hoja === '[]') continue;
    const seg = r.split('.'); const padre = (seg[seg.length - 2] || '').replace(/\[\]$/, '');
    const L = lectores(I, hoja);
    if(L.juego.size || L.interfaz.size) continue;
    /* hijo de un registro dinámico: se lee con una clave calculada, así que
       sólo es huérfano si su nombre no aparece en NINGÚN otro sitio del código
       (ni como cadena ni como clave de una tabla) fuera de quien lo escribe */
    if(padre !== '*' && DIN.has(padre) && (!(I[hoja] || []).length || (I[hoja] || []).some(a => !L.escritores.has(a.f)))) continue;
    sinLector.push({ ruta: r, hoja, escritores: [...L.escritores].slice(0, 4), registro: [...L.registro], prueba: [...L.prueba], saneo: [...L.saneo] });
  }
  return { acc, I, h, rutas: R, sinLector, dinamicos: DIN, top: Object.keys(st) };
}

module.exports = { analizar, indice, lectores, claseDeLector, rutas, mapa, carreraDeMuestra, ES_ID };

if(require.main === module){
  const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
  const M = mapa({ file: arg('file', undefined), semanas: +arg('semanas', 160) });
  const INV = require('./estado-inventario.js');
  console.log('accesos analizados: ' + M.acc.length + ' · rutas persistidas: ' + M.rutas.size + ' · claves de G: ' + M.top.length);
  if(process.argv.includes('--claves')){
    for(const k of M.top.concat(INV.sesion())){
      const d = INV.ESTADO[k];
      const L = lectores(M.I, k);
      console.log((k).padEnd(22) + ' ' + (d ? d.clase.padEnd(11) : 'SIN DECLARAR') + ' juego ' + L.juego.size + ' · interfaz ' + L.interfaz.size + ' · ' + (d ? d.sistema + ' — ' + d.por : ''));
    }
  }
  console.log('\nhojas sin lector de juego ni de interfaz:');
  for(const x of M.sinLector){
    const dec = INV.huerfana(x.ruta);
    console.log('  ' + x.ruta.padEnd(46) + (dec ? '[' + dec.clase + ' · ' + dec.decision + '] ' : '[NUEVA] ') + 'escribe: ' + x.escritores.join(', '));
  }
}
