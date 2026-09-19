#!/usr/bin/env node
/* dev/metrics.js — metricas del archivo del juego (F0) y comparacion (F21).
   Solo modulos nativos de Node (I2).
     node dev/metrics.js                  -> imprime tabla
     node dev/metrics.js --json <salida>  -> escribe JSON
     node dev/metrics.js --diff <base>    -> compara contra un JSON previo   */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const GAME = path.join(__dirname, '..', 'index-4-blindado.html');

/* ---------- utilidades ---------- */
function count(src, re){ const m = src.match(re); return m ? m.length : 0; }
function lines(src){ return src.split('\n'); }

/* Elimina comentarios y literales de cadena para que los escaneres no cuenten
   texto ni comentarios como codigo (trampa conocida del proyecto). */
function stripNonCode(src){
  let out = '', i = 0, n = src.length;
  let state = 'code';           // code | line | block | sq | dq | tpl | regex
  let prevSignificant = '';
  while(i < n){
    const c = src[i], c2 = src.substr(i,2);
    if(state === 'code'){
      if(c2 === '//'){ state='line'; i+=2; continue; }
      if(c2 === '/*'){ state='block'; i+=2; continue; }
      if(c === "'"){ state='sq'; out+=' '; i++; continue; }
      if(c === '"'){ state='dq'; out+=' '; i++; continue; }
      if(c === '`'){ state='tpl'; out+=' '; i++; continue; }
      if(c === '/' && /[=(,:[!&|?{};+\-*%~^]/.test(prevSignificant)){ state='regex'; out+=' '; i++; continue; }
      out += c;
      if(!/\s/.test(c)) prevSignificant = c;
      i++; continue;
    }
    if(state === 'line'){ if(c === '\n'){ state='code'; out+='\n'; } i++; continue; }
    if(state === 'block'){ if(c2 === '*/'){ state='code'; i+=2; continue; } if(c==='\n') out+='\n'; i++; continue; }
    if(state === 'sq'){ if(c==='\\'){ i+=2; continue; } if(c==="'"){ state='code'; } if(c==='\n') out+='\n'; i++; continue; }
    if(state === 'dq'){ if(c==='\\'){ i+=2; continue; } if(c==='"'){ state='code'; } if(c==='\n') out+='\n'; i++; continue; }
    if(state === 'tpl'){ if(c==='\\'){ i+=2; continue; } if(c==='`'){ state='code'; } if(c==='\n') out+='\n'; i++; continue; }
    if(state === 'regex'){ if(c==='\\'){ i+=2; continue; } if(c==='/'){ state='code'; } if(c==='\n'){ state='code'; out+='\n'; } i++; continue; }
  }
  return out;
}

function extractScripts(src){
  const re = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  const out = []; let m;
  while((m = re.exec(src))) out.push({ start: m.index, body: m[1] });
  return out;
}

/* ---------- analisis ---------- */
function analyze(){
  const raw = fs.readFileSync(GAME);
  const src = raw.toString('utf8');
  const scripts = extractScripts(src);
  const js = scripts.map(s => s.body).join('\n');
  const code = stripNonCode(js);               // JS sin comentarios ni cadenas
  const codeLines = lines(code);

  /* --- funciones globales: declaraciones y asignaciones --- */
  const decl = new Map();     // nombre -> [lineas]  (function f(){})
  const assign = new Map();   // nombre -> [lineas]  (f = function / window.f = ...)
  const reDecl   = /^\s*function\s+([A-Za-z_$][\w$]*)\s*\(/;
  const reAssign = /^\s*(?:window\.)?([A-Za-z_$][\w$]*)\s*=\s*function\s*[(*]/;
  const reVarFn  = /^\s*(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*function\s*[(*]/;

  codeLines.forEach((l, i) => {
    let m;
    if((m = l.match(reDecl)))   push(decl, m[1], i+1);
    if((m = l.match(reAssign))) push(assign, m[1], i+1);
    if((m = l.match(reVarFn)))  push(assign, m[1], i+1);
  });
  function push(map, k, v){ if(!map.has(k)) map.set(k, []); map.get(k).push(v); }

  /* nombres con mas de una definicion efectiva (declaracion o asignacion) */
  const allDefs = new Map();
  for(const [k, v] of decl)   push(allDefs, k, ...v);
  for(const [k, v] of assign) push(allDefs, k, ...v);
  function pushAll(map,k,...vs){ if(!map.has(k)) map.set(k,[]); map.get(k).push(...vs); }
  allDefs.clear();
  for(const [k, v] of decl)   pushAll(allDefs, k, ...v);
  for(const [k, v] of assign) pushAll(allDefs, k, ...v);

  const multi = [];
  for(const [k, v] of allDefs) if(v.length > 1) multi.push({ nombre: k, veces: v.length, lineas: v.sort((a,b)=>a-b) });
  multi.sort((a,b) => b.veces - a.veces || a.nombre.localeCompare(b.nombre));

  /* --- wrappers: captura de la implementacion previa --- */
  /* patron: var X = f;  /  var _prev = f;  seguido de reasignacion de f       */
  const wrappers = [];
  codeLines.forEach((l, i) => {
    const m = l.match(/^\s*(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)\s*;?\s*$/);
    if(!m) return;
    const [, alias, target] = m;
    if(!allDefs.has(target)) return;
    // ¿se reasigna `target` despues de esta linea?
    const later = (assign.get(target) || []).some(ln => ln > i+1);
    if(later) wrappers.push({ alias, objetivo: target, linea: i+1 });
  });

  /* --- dominios --- */
  const DOMINIOS = {
    navegacion:  /^(go|render|clDraw|renderNav|scr[A-Z]|nav|screen)/,
    tiempo:      /^(advanceWeek|advancePeriod|finishWeek|doWeek|week|autoAdvance)/,
    combate:     /^(fight|eff|oppAction|exchange|finishFight|flog|hpCol|act)/i,
    saveload:    /^(save|load|migrat|listSaves|serialize|deserial|normalizeWorld)/i,
    minijuegos:  /^(fx|mg|spar|cardio|str|drill|arcade|tg|fame)/i,
    eventos:     /^(fireEvent|event|pending|EV_)/i,
    economia:    /^(money|cash|purse|contract|debt|shop|buyItem|sponsor|cas)/i,
    rankings:    /^(rank|setRank|champ|belt|div)/i,
    social:      /^(soc|news|pushNews|press|media|toast)/i,
    relaciones:  /^(coach|rel|team|rival|gym)/i,
    progresion:  /^(train|st|pot|xp|tq|tech|skill|focus)/i,
  };
  const inventario = {}; for(const k in DOMINIOS) inventario[k] = [];
  const sinClasificar = [];
  for(const nombre of allDefs.keys()){
    let puesto = false;
    for(const k in DOMINIOS){ if(DOMINIOS[k].test(nombre)){ inventario[k].push(nombre); puesto = true; break; } }
    if(!puesto) sinClasificar.push(nombre);
  }
  for(const k in inventario) inventario[k].sort();
  sinClasificar.sort();

  /* --- escrituras de scroll (I1) --- */
  const scrollSites = [];
  const jsOffsetLine = (idx) => js.slice(0, idx).split('\n').length;
  codeLines.forEach((l, i) => {
    if(/\bscrollTo\s*\(|\.scrollTop\s*=|scrollIntoView\s*\(/.test(l))
      scrollSites.push({ linea: i+1, texto: l.trim().slice(0, 120) });
  });

  /* --- escrituras / lecturas de UI.screen --- */
  const uiScreenWrite = [], uiScreenRead = [];
  codeLines.forEach((l, i) => {
    if(/UI\.screen\s*=(?!=)/.test(l)) uiScreenWrite.push({ linea: i+1, texto: l.trim().slice(0,120) });
    else if(/UI\.screen/.test(l))     uiScreenRead.push(i+1);
  });

  return {
    generado: new Date().toISOString(),
    archivo: path.basename(GAME),
    bytes: raw.length,
    lineasHTML: src.split('\n').length,
    lineasJS: js.split('\n').length,
    md5: crypto.createHash('md5').update(raw).digest('hex'),
    sha256: crypto.createHash('sha256').update(raw).digest('hex'),
    bloquesScript: scripts.length,
    funciones: {
      declaraciones: decl.size,
      asignaciones: assign.size,
      totalNombres: allDefs.size,
      definidosMasDeUnaVez: multi.length,
      detalleMultiples: multi.slice(0, 60),
      wrappers: wrappers.length,
      detalleWrappers: wrappers,
    },
    listeners: {
      addEventListener: count(code, /\baddEventListener\s*\(/g),
      removeEventListener: count(code, /\bremoveEventListener\s*\(/g),
    },
    timers: {
      setTimeout: count(code, /\bsetTimeout\s*\(/g),
      clearTimeout: count(code, /\bclearTimeout\s*\(/g),
      setInterval: count(code, /\bsetInterval\s*\(/g),
      clearInterval: count(code, /\bclearInterval\s*\(/g),
      requestAnimationFrame: count(code, /\brequestAnimationFrame\s*\(/g),
      cancelAnimationFrame: count(code, /\bcancelAnimationFrame\s*\(/g),
    },
    render: {
      llamadas: count(code, /\brender\s*\(\s*\)/g),
      uiScreenEscrituras: uiScreenWrite.length,
      uiScreenLecturas: uiScreenRead.length,
      detalleEscriturasUIScreen: uiScreenWrite,
    },
    scroll: { sitios: scrollSites.length, detalle: scrollSites },
    onclickInline: count(src, /onclick\s*=/g),
    evalFuncional: count(code, /\beval\s*\(/g),
    dependenciasExternas: {
      script_src: count(src, /<script[^>]+src=/gi),
      link_href: count(src, /<link[^>]+href=/gi),
      fetch: count(code, /\bfetch\s*\(/g),
      XMLHttpRequest: count(code, /XMLHttpRequest/g),
      urlsHttp: count(src, /https?:\/\//g),
    },
    inventarioPorDominio: Object.fromEntries(
      Object.entries(inventario).map(([k, v]) => [k, { n: v.length, fns: v }])
    ),
    sinClasificar: { n: sinClasificar.length, fns: sinClasificar },
  };
}

/* ---------- salida ---------- */
function tabla(m){
  const L = [];
  L.push(`archivo                  ${m.archivo}`);
  L.push(`bytes                    ${m.bytes.toLocaleString('es')}`);
  L.push(`lineas HTML / JS         ${m.lineasHTML} / ${m.lineasJS}`);
  L.push(`md5                      ${m.md5}`);
  L.push(`sha256                   ${m.sha256.slice(0,32)}…`);
  L.push(`bloques <script>         ${m.bloquesScript}`);
  L.push(`nombres de funcion       ${m.funciones.totalNombres}  (decl ${m.funciones.declaraciones} · asign ${m.funciones.asignaciones})`);
  L.push(`definidos >1 vez         ${m.funciones.definidosMasDeUnaVez}`);
  L.push(`wrappers (captura previa)${String(m.funciones.wrappers).padStart(2)}`);
  L.push(`addEventListener/remove  ${m.listeners.addEventListener} / ${m.listeners.removeEventListener}`);
  L.push(`setTimeout/clear         ${m.timers.setTimeout} / ${m.timers.clearTimeout}`);
  L.push(`setInterval/clear        ${m.timers.setInterval} / ${m.timers.clearInterval}`);
  L.push(`rAF/cancel               ${m.timers.requestAnimationFrame} / ${m.timers.cancelAnimationFrame}`);
  L.push(`render()                 ${m.render.llamadas}`);
  L.push(`UI.screen escrituras     ${m.render.uiScreenEscrituras}`);
  L.push(`UI.screen lecturas       ${m.render.uiScreenLecturas}`);
  L.push(`escrituras de scroll     ${m.scroll.sitios}`);
  L.push(`onclick inline           ${m.onclickInline}`);
  L.push(`eval funcional           ${m.evalFuncional}`);
  L.push(`deps externas (src/href/fetch/XHR/urls)  ${m.dependenciasExternas.script_src}/${m.dependenciasExternas.link_href}/${m.dependenciasExternas.fetch}/${m.dependenciasExternas.XMLHttpRequest}/${m.dependenciasExternas.urlsHttp}`);
  L.push('');
  L.push('inventario por dominio:');
  for(const [k, v] of Object.entries(m.inventarioPorDominio)) L.push(`  ${k.padEnd(12)} ${v.n}`);
  L.push(`  ${'sinClasificar'.padEnd(12)} ${m.sinClasificar.n}`);
  return L.join('\n');
}

function diff(actual, base){
  const pares = [
    ['bytes', m=>m.bytes], ['lineasJS', m=>m.lineasJS],
    ['nombres', m=>m.funciones.totalNombres],
    ['definidos>1', m=>m.funciones.definidosMasDeUnaVez],
    ['wrappers', m=>m.funciones.wrappers],
    ['addEventListener', m=>m.listeners.addEventListener],
    ['removeEventListener', m=>m.listeners.removeEventListener],
    ['setTimeout', m=>m.timers.setTimeout],
    ['render()', m=>m.render.llamadas],
    ['UI.screen escrituras', m=>m.render.uiScreenEscrituras],
    ['escrituras scroll', m=>m.scroll.sitios],
    ['onclick inline', m=>m.onclickInline],
    ['eval', m=>m.evalFuncional],
  ];
  const L = ['metrica                    base      actual     delta'];
  for(const [n, f] of pares){
    const b = f(base), a = f(actual), d = a - b;
    L.push(`${n.padEnd(26)} ${String(b).padStart(6)}  ${String(a).padStart(8)}  ${(d>0?'+':'')+d}`);
  }
  return L.join('\n');
}

if(require.main === module){
  const m = analyze();
  const args = process.argv.slice(2);
  const ji = args.indexOf('--json');
  const di = args.indexOf('--diff');
  if(ji >= 0){
    const out = args[ji+1] || path.join(__dirname, 'baseline', 'metrics.json');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(m, null, 2));
    console.log('escrito ' + out);
  }
  if(di >= 0){
    const base = JSON.parse(fs.readFileSync(args[di+1], 'utf8'));
    console.log(diff(m, base));
  }
  if(ji < 0 && di < 0) console.log(tabla(m));
}
module.exports = { analyze, tabla, diff };
