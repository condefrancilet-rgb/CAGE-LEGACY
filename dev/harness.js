'use strict';
/* dev/harness.js — carga el juego en node:vm con un stub tolerante de DOM.
   El juego NO conoce al harness: todo lo que falta se resuelve con stubs (I2).
   Solo modulos nativos de Node.                                              */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const GAME = path.join(__dirname, '..', 'index-4-blindado.html');

/* ---------- RNG con semilla (mulberry32) ---------- */
function mulberry32(a){
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- stub de DOM ---------- */
function makeStub(opts){
  const counters = { listeners: 0, timers: 0, raf: 0, nodes: 0 };

  function makeStyle(){
    const s = { cssText: '' };
    return new Proxy(s, {
      get:(t,k)=> (k in t ? t[k] : ''),
      set:(t,k,v)=>{ t[k]=v; return true; },
    });
  }

  function makeCtx(){
    /* contexto 2D inerte: cuenta llamadas para poder detectar render vivo */
    const calls = { n: 0 };
    const noop = () => { calls.n++; };
    const ctx = { __calls: calls, canvas: null,
      measureText: () => { calls.n++; return { width: 10 }; },
      createLinearGradient: () => ({ addColorStop: noop }),
      createRadialGradient: () => ({ addColorStop: noop }),
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    };
    for(const m of ['clearRect','fillRect','strokeRect','beginPath','closePath','moveTo','lineTo',
      'arc','arcTo','ellipse','rect','fill','stroke','save','restore','translate','rotate','scale',
      'setTransform','drawImage','fillText','strokeText','clip','quadraticCurveTo','bezierCurveTo',
      'setLineDash','putImageData','createPattern','roundRect'])
      ctx[m] = noop;
    for(const p of ['fillStyle','strokeStyle','lineWidth','font','textAlign','textBaseline',
      'globalAlpha','lineCap','lineJoin','shadowBlur','shadowColor','globalCompositeOperation','filter'])
      ctx[p] = '';
    return ctx;
  }

  function makeEl(tag){
    counters.nodes++;
    const el = {
      tagName: String(tag || 'div').toUpperCase(),
      id: '', className: '', innerHTML: '', textContent: '', value: '',
      style: makeStyle(),
      children: [], childNodes: [], parentNode: null,
      dataset: {}, attributes: {},
      width: 300, height: 300,
      __listeners: {},
      classList: {
        _s: new Set(),
        add(...c){ c.forEach(x=>this._s.add(x)); }, remove(...c){ c.forEach(x=>this._s.delete(x)); },
        toggle(c){ this._s.has(c) ? this._s.delete(c) : this._s.add(c); },
        contains(c){ return this._s.has(c); },
      },
      setAttribute(k,v){ this.attributes[k]=String(v); if(k==='id') this.id=String(v); },
      getAttribute(k){ return k in this.attributes ? this.attributes[k] : null; },
      removeAttribute(k){ delete this.attributes[k]; },
      hasAttribute(k){ return k in this.attributes; },
      appendChild(c){ c.parentNode = this; this.children.push(c); this.childNodes.push(c); return c; },
      insertBefore(c){ return this.appendChild(c); },
      removeChild(c){ const i=this.children.indexOf(c); if(i>=0){ this.children.splice(i,1); this.childNodes.splice(i,1); c.parentNode=null; } return c; },
      remove(){ if(this.parentNode) this.parentNode.removeChild(this); },
      querySelector(){ return makeEl('div'); },
      querySelectorAll(){ return []; },
      getElementsByTagName(){ return []; },
      addEventListener(t){ counters.listeners++; (this.__listeners[t] = this.__listeners[t] || []).push(1); },
      removeEventListener(t){ counters.listeners--; if(this.__listeners[t]) this.__listeners[t].pop(); },
      dispatchEvent(){ return true; },
      getBoundingClientRect(){ return { top:0, left:0, right:this.width, bottom:this.height, width:this.width, height:this.height, x:0, y:0 }; },
      getContext(){ if(!this.__ctx){ this.__ctx = makeCtx(); this.__ctx.canvas = this; } return this.__ctx; },
      focus(){}, blur(){}, click(){}, scrollIntoView(){},
      insertAdjacentHTML(){}, cloneNode(){ return makeEl(this.tagName); },
      contains(){ return false; },
    };
    return el;
  }

  const byId = new Map();
  function getById(id){
    if(!byId.has(id)){ const el = makeEl('div'); el.id = id; byId.set(id, el); }
    return byId.get(id);
  }
  /* El juego consulta getElementById para elementos que puede no haber creado.
     Devolver un elemento estable por id (no uno nuevo cada vez) evita el falso
     positivo de "fugas de listeners" descrito en las trampas del proyecto. */

  const body = makeEl('body');
  /* Los ids que el HTML declara existen de verdad en el navegador: se
     pre-crean para que getElementById los encuentre igual que en produccion.
     Devolver null aqui producia fallos que el juego real no tiene. */
  (opts.idsDelDocumento || []).forEach(id => body.appendChild(getById(id)));

  const document = {
    body, head: makeEl('head'), documentElement: makeEl('html'),
    hidden: false, readyState: 'complete',
    getElementById: (id) => byId.has(id) ? byId.get(id) : null,
    createElement: (t) => makeEl(t),
    createElementNS: (ns,t) => makeEl(t),
    createTextNode: (t) => ({ nodeValue: t, textContent: t }),
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementsByTagName: () => [],
    addEventListener(){ counters.listeners++; }, removeEventListener(){ counters.listeners--; },
    execCommand(){ return true; },
    __byId: byId, __getById: getById, __counters: counters, __makeEl: makeEl,
  };

  /* getElementById debe poder devolver nodos que el juego creo y metio en body */
  const origCreate = document.createElement;
  document.createElement = (t) => {
    const el = origCreate(t);
    const origSet = el.setAttribute.bind(el);
    el.setAttribute = (k,v) => { origSet(k,v); if(k==='id') byId.set(String(v), el); };
    Object.defineProperty(el, 'id', {
      get(){ return el.__id || ''; },
      set(v){ el.__id = String(v); byId.set(String(v), el); },
    });
    return el;
  };

  /* localStorage real en memoria, con cuota opcional */
  const storeMap = new Map();
  const localStorage = {
    get length(){ return storeMap.size; },
    key(i){ return [...storeMap.keys()][i] ?? null; },
    getItem(k){ return storeMap.has(String(k)) ? storeMap.get(String(k)) : null; },
    setItem(k,v){
      const s = String(v);
      if(opts.quota){
        let total = s.length; for(const [kk,vv] of storeMap) if(kk!==String(k)) total += vv.length;
        if(total > opts.quota){ const e = new Error('QuotaExceededError'); e.name='QuotaExceededError'; throw e; }
      }
      storeMap.set(String(k), s);
    },
    removeItem(k){ storeMap.delete(String(k)); },
    clear(){ storeMap.clear(); },
    __map: storeMap,
  };

  /* timers controlables: no se ejecutan solos, se drenan a peticion */
  const pending = new Map(); let timerId = 1;
  const setTimeoutStub = (fn, ms) => { const id = timerId++; pending.set(id, { fn, ms }); counters.timers++; return id; };
  const clearTimeoutStub = (id) => { if(pending.delete(id)) counters.timers--; };
  let rafId = 1; const rafPending = new Map();
  const rafStub = (fn) => { const id = rafId++; rafPending.set(id, fn); counters.raf++; return id; };
  const cafStub = (id) => { if(rafPending.delete(id)) counters.raf--; };

  return { document, localStorage, counters, makeEl, getById,
           timers: { pending, setTimeoutStub, clearTimeoutStub, rafPending, rafStub, cafStub } };
}

/* ---------- carga del juego ---------- */
/** ids declarados en el HTML: el stub los crea para imitar al navegador. */
let _idsCache = null;
function idsDelDocumento(archivo){
  if(!archivo && _idsCache) return _idsCache;
  const src = fs.readFileSync(archivo || GAME, 'utf8');
  const html = src.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  const ids = new Set();
  for(const m of html.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)) ids.add(m[1]);
  const lista = [...ids];
  if(!archivo) _idsCache = lista;
  return lista;
}

/** Permite cargar OTRA version del archivo (p. ej. la de un commit anterior)
    para comparar antes/despues sin tocar el arbol de trabajo. */
function extractJS(archivo){
  const src = fs.readFileSync(archivo || GAME, 'utf8');
  const blocks = [...src.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  if(!blocks.length) throw new Error('el archivo no tiene bloques <script>');
  return blocks.join('\n;\n');
}

/**
 * boot({ seed, quota, url }) -> { G, UI, ctx, api, stub, rng }
 * Carga el juego con Math.random sembrado. No arranca carrera.
 */
function boot(o){
  o = o || {};
  const seed = (o.seed === undefined) ? 1 : o.seed;
  const stub = makeStub({ quota: o.quota, idsDelDocumento: idsDelDocumento(o.file) });
  const rng = mulberry32(seed);
  const errores = [];

  const sandbox = {
    console: o.verbose ? console : { log(){}, warn(){}, error(){}, info(){}, debug(){} },
    document: stub.document,
    localStorage: stub.localStorage,
    sessionStorage: stub.localStorage,
    navigator: { userAgent: 'node-harness', language: 'es', maxTouchPoints: 1, vibrate(){} },
    location: { href: o.url || 'file:///index.html', search: o.search || '', hash: o.hash || '', protocol: 'file:' },
    history: { pushState(){}, replaceState(){}, back(){} },
    screen: { width: 390, height: 844, orientation: { type: 'portrait-primary' } },
    devicePixelRatio: 2,
    innerWidth: 390, innerHeight: 844,
    scrollX: 0, scrollY: 0,
    scrollTo(x, y){ sandbox.scrollX = (typeof x === 'object' ? (x.left|0) : (x|0)); sandbox.scrollY = (typeof x === 'object' ? (x.top|0) : (y|0)); sandbox.__scrollCalls.push([sandbox.scrollX, sandbox.scrollY]); },
    __scrollCalls: [],
    addEventListener(){ stub.counters.listeners++; }, removeEventListener(){ stub.counters.listeners--; },
    setTimeout: stub.timers.setTimeoutStub, clearTimeout: stub.timers.clearTimeoutStub,
    setInterval: stub.timers.setTimeoutStub, clearInterval: stub.timers.clearTimeoutStub,
    requestAnimationFrame: stub.timers.rafStub, cancelAnimationFrame: stub.timers.cafStub,
    confirm: () => (o.confirm === undefined ? true : o.confirm),
    alert(){}, prompt: () => null,
    performance: { now: () => Number(process.hrtime.bigint() / 1000n) / 1000 },
    AudioContext: function(){ return { createOscillator: () => ({ connect(){}, start(){}, stop(){}, frequency:{ setValueAtTime(){}, value:0 }, type:'' }), createGain: () => ({ connect(){}, gain:{ setValueAtTime(){}, exponentialRampToValueAtTime(){}, linearRampToValueAtTime(){}, value:0 } }), destination:{}, currentTime:0, close(){}, state:'running', resume(){} }; },
    Math: Object.create(Math),
    __errores: errores,
  };
  sandbox.webkitAudioContext = sandbox.AudioContext;
  sandbox.Math.random = rng;
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  stub.document.defaultView = sandbox;

  const context = vm.createContext(sandbox);
  const code = extractJS(o.file);
  try {
    new vm.Script(code, { filename: 'cage-legacy.js' }).runInContext(context);
  } catch(e){
    e.message = 'fallo al cargar el juego en el harness: ' + e.message;
    throw e;
  }

  return {
    ctx: context, stub, rng, errores,
    get G(){ return context.G; },
    get UI(){ return context.UI; },
    /** ejecuta codigo arbitrario dentro del contexto del juego */
    run(fn){ return fn(context); },
    /** llama a una funcion global del juego por nombre */
    call(name, ...args){
      const f = name.split('.').reduce((o,k)=> (o ? o[k] : undefined), context);
      if(typeof f !== 'function') throw new Error('no es funcion: ' + name);
      return f(...args);
    },
    scrollCalls(){ return context.__scrollCalls; },
    clearScroll(){ context.__scrollCalls.length = 0; },
    counters(){ return { ...stub.counters }; },
    /** ejecuta los setTimeout pendientes una vez (orden de insercion) */
    drainTimers(max){
      let n = 0;
      for(const [id, t] of [...stub.timers.pending]){
        stub.timers.pending.delete(id); stub.counters.timers--;
        try { t.fn(); } catch(e){ errores.push(String(e)); }
        if(++n >= (max || 500)) break;
      }
      return n;
    },
  };
}

/**
 * Crea una carrera con parametros deterministas.
 * Evita la trampa de syncCreateInputs (lee inputs del DOM, vacios sin navegador):
 * se neutraliza SOLO aqui y el borrador se fija en UI.tmp.c.
 */
function startCareer(h, cfg){
  cfg = cfg || {};
  const c = h.ctx;
  c.syncCreateInputs = function(){ return c.UI.tmp.c; };
  c.UI.tmp = c.UI.tmp || {};
  const draft = c.createDefaults();
  draft.metaSeed = cfg.metaSeed === undefined ? 987654321 : cfg.metaSeed;
  draft.first = cfg.first || 'Mateo';
  draft.last  = cfg.last  || 'Ferrari';
  if(cfg.year)   draft.year  = cfg.year;
  if(cfg.div)    draft.div   = cfg.div;
  if(cfg.style)  draft.style = cfg.style;
  if(cfg.style2) draft.style2 = cfg.style2;
  if(cfg.age)    draft.age   = cfg.age;
  if(cfg.pers)   draft.pers  = cfg.pers;
  c.UI.tmp.c = draft;
  c.startCareer();
  return h.G;
}

module.exports = { boot, startCareer, mulberry32, extractJS, idsDelDocumento, GAME };
