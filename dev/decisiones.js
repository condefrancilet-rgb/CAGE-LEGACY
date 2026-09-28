#!/usr/bin/env node
'use strict';
/* dev/decisiones.js — ¿LAS DECISIONES DECIDEN ALGO? (fase 15)
   ---------------------------------------------------------------------------
   Toma cada decisión donde el jugador realmente la encuentra: corre carreras
   y, cada vez que aparece un evento, guarda la partida. Desde esa misma
   partida resuelve CADA opción con el mismo azar (números aleatorios comunes:
   G.rs se fija antes de resolver y otra vez después), y mide:
     · inmediato: qué cambió en el estado guardado, clasificado por tipo
       (recurso, relación, memoria, oportunidad, identidad, texto);
     · a 8 semanas: los mismos recursos después de jugar 8 semanas con la
       misma política, para ver si la consecuencia sigue ahí.
   Con eso clasifica, por evento:
     · FALSA — dos opciones que dejan exactamente el mismo estado (salvo
       textos) en todas las muestras;
     · DOMINADA — una opción que queda igual o peor en todos los recursos con
       dirección clara (caja, popularidad, reputación, stats, desgaste…) y no
       tiene ninguna consecuencia propia de otro tipo, en todas las muestras;
     · con contexto — ninguna de las dos.
   No decide qué es «mejor»: sólo si una opción puede tener razón de existir.
     node dev/decisiones.js eventos [--carreras 4] [--semanas 400] [--muestras 2] [--json salida.json]
     node dev/decisiones.js eventos --shard 0/4 ...     (una de cuatro carreras)          */
const fs = require('node:fs');
const H = require('./harness.js');
const A = require('./autopilot.js');

const ARCHIVO = process.env.CAGE_FILE || undefined;

/* ---------- estado aplanado y clasificación de cada cambio ---------- */
function aplanar(o, p, out){
  out = out || new Map();
  if(o && typeof o === 'object'){
    const ks = Object.keys(o);
    if(!ks.length) out.set(p, Array.isArray(o) ? '[]' : '{}');
    for(const k of ks) aplanar(o[k], p + '.' + k, out);
  } else out.set(p, o);
  return out;
}
function persistible(c){
  const o = JSON.parse(JSON.stringify(c.STATE.persistable(c.G))); delete o.saveId; delete o.savedAt; delete o.rs;
  /* el jugador está dos veces (G.player y G.fighters[su id]): se mira una */
  if(o.player && o.fighters) delete o.fighters[o.player.id];
  return o;
}
/* ruta → tipo de consecuencia. El orden importa: la primera que calza. */
const TIPOS = [
  ['texto',       /^G\.(lastEventOut|news|weekLog|engineLog|errLog|_autoTag|cl\.evLog)\b|^G\.story\.(feed|eventHistory|recentCats|lastEventAt)\b|\.log\.\d+$|\.log$/],
  ['memoria',     /\.mem(\.|$)|^G\.story\.memories\b|\.arc(\.|$)|\.memories(\.|$)|^G\.cl\.npc\.[^.]+\.(beats|w|since)$/],
  ['equipo',      /^G\.(mgId|gyms|coaches\.\d+\.(?!rel|mem)|mgrs\.\d+\.(?!rel|mem))|^G\.player\.(gym|coach|org)\b|^G\.contract\b/],
  ['relación',    /\.rel\.|\.rel2\.|^G\.socCD\b|\.trust$|\.respect$|\.fear$|\.friend$|\.heat$|^G\.cl\.coach\b/],
  ['oportunidad', /^G\.(offers|nextFight|pending|flags|tmp[A-Z]\w*|story\.chains|askedFight|promo)\b/],
  ['identidad',   /^G\.player\.(pers|pers2|traits|identity|philosophy|style|secondaryStyle)\b|^G\.rpg\b/],
  ['recurso',     /^G\.(cash|debt|careerEarn)\b|^G\.player\.(pop|popPeak|rep|hype|fatigue|dmg|inj|injWeeks|weightNow|st|pot|lr|earn|rec|streak)\b|^G\.camp\b/],
];
function tipo(ruta){ for(const [t, re] of TIPOS) if(re.test(ruta)) return t; return 'otro'; }
/* recursos con dirección clara: +1 más es mejor, −1 menos es mejor */
function recursos(c){
  const G = c.G, p = G.player, st = p.st || {}, cp = G.camp;
  const suma = (o) => Object.values(o || {}).reduce((a, v) => a + (+v || 0), 0);
  const co = c.coachById ? c.coachById(p.coach) : null;
  const porStat = {}; for(const k in st) porStat['st.' + k] = +st[k] || 0;
  return Object.assign(porStat, {
    caja: +G.cash || 0, popularidad: +p.pop || 0, reputacion: +p.rep || 0, hype: +p.hype || 0,
    stats: suma(st), potencial: suma(p.pot),
    desgaste: +p.fatigue || 0, dano: +p.dmg || 0, lesion: +p.injWeeks || 0,
    filo: cp ? +cp.sharp || 0 : 0, desgasteCamp: cp ? +cp.fatigue || 0 : 0,
    confianzaCoach: co && co.rel ? +co.rel.trust || 0 : 0,
    /* la relación con TU equipo tiene dirección; la de rivales y terceros, no */
    equipo: [co, c.mgrById ? c.mgrById(G.mgId) : null].reduce((a, x) => a + (x && x.rel ? (+x.rel.trust || 0) + (+x.rel.respect || 0) + (+x.rel.friend || 0) : 0), 0),
    victorias: (p.rec && +p.rec.w) || 0, deuda: +G.debt || 0,
  });
}
const DIRECCION = { caja: 1, popularidad: 1, reputacion: 1, hype: 1, stats: 1, potencial: 1, desgaste: -1, dano: -1, lesion: -1,
  filo: 1, desgasteCamp: -1, confianzaCoach: 1, equipo: 1, victorias: 1, deuda: -1 };
/* relación de TU entrenador / TU mánager: ya está en el vector con dirección */
function relPropia(k, pre){ const m = /^G\.(coaches|mgrs)\.(\d+)\.rel\.(trust|respect|friend)$/.exec(k); if(!m) return false;
  const lista = pre && pre[m[1]]; const x = lista && lista[+m[2]]; if(!x) return false;
  return m[1] === 'coaches' ? x.id === pre.coachId : x.id === pre.mgId; }
/* lo que NO cuenta como consecuencia propia al buscar dominancia: textos, la
   narrativa de la memoria, los recursos con dirección y la relación con tu equipo */
function neutra(k, pre){ const t = tipo(k); return t === 'texto' || t === 'memoria' || t === 'recurso' || (t === 'relación' && relPropia(k, pre)); }
const TOL = 1e-6;

/* ---------- abrir una instantánea y resolver una opción ---------- */
function abrir(snap){
  const h = H.boot({ seed: snap.seed, file: ARCHIVO, storage: new Map(snap.disco) });
  if(!h.ctx.loadGame(snap.sid)) throw new Error('no se pudo abrir la instantánea');
  return h;
}
function rama(snap, i, r, semanas){
  const h = abrir(snap), c = h.ctx;
  const antes = aplanar(persistible(c), 'G'), r0 = recursos(c);
  snap.pre = snap.pre || { coaches: c.G.coaches.map(x => ({ id: x.id })), mgrs: (c.G.mgrs || []).map(x => ({ id: x.id })), coachId: c.G.player.coach, mgId: c.G.mgId };
  c.G.rs = (snap.rs + 7919 * (r + 1)) | 0;                  /* mismo azar para todas las opciones */
  let error = null;
  try{ c.resolveEvent(i); } catch(e){ error = String(e && e.message || e); }
  const abrioMinijuego = !!(c.G.mg && !c.G.mg.done); c.G.mg = null;
  const despues = aplanar(persistible(c), 'G'), r1 = recursos(c);
  const cambios = {};
  for(const [k, v] of despues) if(!antes.has(k) || antes.get(k) !== v) cambios[k] = v;
  for(const [k] of antes) if(!despues.has(k)) cambios[k] = undefined;
  const porTipo = {};
  for(const k in cambios){ const t = tipo(k); (porTipo[t] = porTipo[t] || []).push(k); }
  let r8 = null;
  if(semanas){
    c.G.rs = (snap.rs + 104729) | 0;
    try{ A.correrCarrera(h, { maxWeeks: semanas, politica: 'basica', seedPolitica: 4242 }); r8 = recursos(c); }
    catch(e){ r8 = null; }
  }
  const delta = (x) => { const d = {}; for(const k in r0) d[k] = x ? x[k] - r0[k] : null; return d; };
  return { cambios, porTipo, inmediato: delta(r1), semanas: r8 ? delta(r8) : null, abrioMinijuego, error, texto: String(c.G.lastEventOut || '').slice(0, 90) };
}

/* ---------- comparar dos opciones sobre todas las muestras ---------- */
function sinTexto(x){ const o = {}; for(const k in x.cambios) if(tipo(k) !== 'texto') o[k] = x.cambios[k]; return o; }
function iguales(a, b){ return JSON.stringify(sinTexto(a)) === JSON.stringify(sinTexto(b)); }
function tiposPropios(a, b, pre){
  /* consecuencias de `a` que no tienen dirección clara y que `b` no tiene igual */
  const out = new Set(), sb = sinTexto(b);
  for(const [k, v] of Object.entries(sinTexto(a))){
    if(neutra(k, pre)) continue;
    if(!(k in sb) || sb[k] !== v) out.add(tipo(k));
  }
  return out;
}
/* cada stat es su propia dimensión (disciplina no compra confianza); 'stats' es
   sólo el resumen y no entra en la comparación */
function dir(k){ return k.startsWith('st.') ? 1 : (k === 'stats' ? 0 : (DIRECCION[k] || 0)); }
function domina(a, b, campo){                                /* a ≥ b en todo, > en algo */
  const da = a[campo], db = b[campo]; if(!da || !db) return false;
  let mejor = false;
  for(const k of new Set([...Object.keys(da), ...Object.keys(db)])){ const d = dir(k); if(!d) continue; const x = ((da[k] || 0) - (db[k] || 0)) * d; if(x < -TOL) return false; if(x > TOL) mejor = true; }
  return mejor;
}
function clasificar(ev){
  /* ev.muestras: [ [rama por opción] por muestra ] */
  const n = ev.opciones.length, pares = [];
  for(let i = 0; i < n; i++) for(let j = i + 1; j < n; j++){
    const ms = ev.muestras.filter(m => m[i] && m[j]);
    if(!ms.length) continue;
    const falsa = ms.every(m => iguales(m[i], m[j]) && JSON.stringify(m[i].semanas) === JSON.stringify(m[j].semanas));
    let dom = null;
    for(const [x, y] of [[i, j], [j, i]]){
      const ok = ms.every(m => tiposPropios(m[y], m[x], ev.pre).size === 0 && domina(m[x], m[y], 'inmediato') && (m[x].semanas == null || !domina(m[y], m[x], 'semanas')));
      if(ok) dom = { gana: x, pierde: y };
    }
    pares.push({ i, j, falsa, dom, muestras: ms.length });
  }
  /* sin efecto propio: todo lo que cambia (fuera de textos y narrativa) lo cambia CUALQUIER respuesta */
  const sinEfecto = ev.opciones.map((_, i) => ev.muestras.every(m => {
    if(!m[i]) return true;
    return Object.entries(sinTexto(m[i])).every(([k, v]) => tipo(k) === 'memoria' || m.every(o => o && JSON.stringify(o.cambios[k]) === JSON.stringify(v)));
  }));
  return { pares, sinEfecto };
}

/* ---------- recolectar decisiones reales y ramificar ---------- */
function clave(c){ const e = c.G.pending[0]; return e ? (e.id === 'cl_dyn' ? 'cl:' + e.h : e.id) : null; }
function recolectar(o){
  const res = {};
  for(const semilla of o.semillas){
    const h = H.boot({ seed: semilla, file: ARCHIVO });
    H.startCareer(h, { metaSeed: 150000 + semilla, style: o.estilo || 'mma', div: 'LW', age: 22 });
    const c = h.ctx, vistos = {};
    let semanas = 0, guarda = 0;
    while(semanas < o.semanas && !c.G.player.retired && guarda++ < o.semanas * 4){
      /* avanzar hasta el próximo evento pendiente (o una semana) */
      if(!c.G.pending.length){ const w0 = c.G.year * 52 + c.G.week; A.correrCarrera(h, { maxWeeks: 1, politica: 'basica', seedPolitica: 900 + semanas }); semanas += (c.G.year * 52 + c.G.week) - w0 || 0; if(!c.G.pending.length) continue; }
      const k = clave(c), e = c.G.pending[0];
      const nOps = (e.opts || []).length;
      if(k && nOps >= 2 && (vistos[k] || 0) < o.muestras){
        vistos[k] = (vistos[k] || 0) + 1;
        /* sólo el primero de la cola es la decisión en pantalla: se guarda con él */
        c.saveGame(true);
        const snap = { seed: semilla, sid: c.listSaves()[0].id, disco: new Map(c.localStorage.__map), rs: c.G.rs | 0 };
        const opciones = (e.opts || []).map(x => String(x.t || x).slice(0, 70));
        const muestra = [];
        for(let r = 0; r < o.azar; r++) muestra.push(opciones.map((_, i) => rama(snap, i, r, o.horizonte)));
        const ev = res[k] = res[k] || { id: k, opciones, muestras: [], contextos: [], pre: snap.pre };
        ev.muestras.push(...muestra);
        ev.contextos.push(c.G.year + 's' + c.G.week + (c.G.camp ? ' camp' : '') + (c.G.player.org ? ' ' + c.G.player.org : ' sin org'));
        if(o.alPaso) o.alPaso(k);
      }
      /* seguir la carrera: el autopiloto resuelve como siempre */
      c.resolveEvent(0);
    }
  }
  return res;
}

function resumenEvento(ev){
  const cl = clasificar(ev);
  const fx = ev.opciones.map((t, i) => {
    const tipos = new Set(); let minijuego = false, err = null;
    for(const m of ev.muestras){ const x = m[i]; if(!x) continue; Object.keys(x.porTipo).forEach(t => tipos.add(t)); if(x.abrioMinijuego) minijuego = true; if(x.error) err = x.error; }
    tipos.delete('texto');
    const med = (campo) => { const acc = {}; let n = 0; for(const m of ev.muestras){ const x = m[i]; if(!x || !x[campo]) continue; n++; for(const k in x[campo]) acc[k] = (acc[k] || 0) + x[campo][k]; } const o = {}; for(const k in acc){ const v = acc[k] / n; if(Math.abs(v) > 0.01) o[k] = +v.toFixed(2); } return o; };
    return { opcion: t, tipos: [...tipos], minijuego, error: err, inmediato: med('inmediato'), semanas: med('semanas') };
  });
  return { id: ev.id, n: ev.muestras.length, contextos: ev.contextos, opciones: fx, falsas: cl.pares.filter(p => p.falsa).map(p => [p.i, p.j]),
    dominadas: cl.pares.filter(p => !p.falsa && p.dom).map(p => p.dom), sinEfecto: cl.sinEfecto.map((v, i) => v ? i : -1).filter(i => i >= 0) };
}

/* ==========================================================================
   EL TRABAJO DE LA SEMANA
   Cada opción desde la misma partida y con el mismo azar; varias muestras de
   azar para el riesgo de lesión. Los minijuegos se juegan bien (+) y mal (−)
   con una regla fija, porque su resultado depende de cómo se juegan.
   ========================================================================== */
const SEMANA = {};
for(const k of ['box', 'kick', 'muay', 'wrest', 'grap', 'cardio', 'str', 'mind', 'rest']) SEMANA[k] = (c) => c.doWeek(k);
SEMANA.tranquila = (c) => c.skipWeek();
SEMANA['spar+'] = (c) => { c.sparStart(); for(let g = 0; g < 20 && !c.G.mg.done; g++){ const s = c.G.mg.sits[c.G.mg.step]; c.sparPick(s.good[0]); } c.mgClose(true); };
SEMANA['spar-'] = (c) => { c.sparStart(); for(let g = 0; g < 20 && !c.G.mg.done; g++){ const s = c.G.mg.sits[c.G.mg.step]; c.sparPick([0, 1, 2, 3].find(i => s.good.indexOf(i) < 0)); } c.mgClose(true); };
/* cardio, fuerza y drills son juegos arcade (canvas) que terminan en tgResolve(mg, {quality}):
   se resuelven por ese mismo camino con una calidad fija */
function arcade(pool, q){ return (c) => {
  const key = c.tgPick(pool), info = c.TG_INFO[key];
  const mg = { type: 'train', game: key, pool, cat: info.cat, tk: info.tk, name: info.n, live: true, done: false, log: [], weekApplied: false };
  c.G.mg = mg; c.tgResolve(mg, { quality: q, flawless: q >= 0.95, perfects: 0, hits: 0, misses: 0 }); c.mgClose(true);
}; }
SEMANA['cardio+'] = arcade('cardio', 0.95); SEMANA['cardio-'] = arcade('cardio', 0.2);
SEMANA['str+'] = arcade('str', 0.95);       SEMANA['str-'] = arcade('str', 0.2);
SEMANA['drill+'] = arcade('drill', 0.95);   SEMANA['drill-'] = arcade('drill', 0.2);

function medirSemana(snap, k, r){
  const h = abrir(snap), c = h.ctx, p0 = JSON.parse(JSON.stringify(c.G.player)), cp0 = c.G.camp ? { ...c.G.camp } : null;
  c.G.rs = (snap.rs + 7919 * (r + 1)) | 0;
  let error = null;
  try{ SEMANA[k](c); } catch(e){ error = String(e && e.message || e); }
  const p = c.G.player, st = {};
  for(const s in p.st){ const d = (p.st[s] || 0) - (p0.st[s] || 0); if(Math.abs(d) > 1e-9) st[s] = d; }
  const lesion = !!(p.inj && !p0.inj);
  return { st, stats: Object.values(st).reduce((a, v) => a + v, 0), desgaste: p.fatigue - p0.fatigue, lesion, semanasLesion: lesion ? p.injWeeks : 0,
    filo: cp0 && c.G.camp ? c.G.camp.sharp - cp0.sharp : 0, desgasteCamp: cp0 && c.G.camp ? c.G.camp.fatigue - cp0.fatigue : 0,
    peso: p.weightNow - p0.weightNow, semana: (c.G.year * 52 + c.G.week) - (snapAt(snap)), error };
}
function snapAt(snap){ return snap.at; }
function contextosSemana(o){
  /* partidas reales: la primera semana libre y fresca después de la 15, la misma cansada, y una semana de campamento */
  const out = [];
  for(const semilla of o.semillas){
    const h = H.boot({ seed: semilla, file: ARCHIVO });
    H.startCareer(h, { metaSeed: 160000 + semilla, style: o.estilo || 'mma', div: 'LW', age: 22 });
    const c = h.ctx; let libre = null, camp = null;
    for(let w = 0; w < 160 && !(libre && camp); w++){
      A.correrCarrera(h, { maxWeeks: 1, politica: 'basica', seedPolitica: 700 + w });
      while(c.G.pending.length) c.resolveEvent(0);
      c.G.mg = null;
      const wk = c.G.year * 52 + c.G.week - (c.G.startYear * 52 + 1);
      const guardar = (nombre, ajuste) => { const cp = c.G.player.fatigue; if(ajuste) ajuste(c); c.saveGame(true); const sn = { nombre: nombre + ' · semilla ' + semilla, seed: semilla, sid: c.listSaves()[0].id, disco: new Map(c.localStorage.__map), rs: c.G.rs | 0, at: c.G.year * 52 + c.G.week }; c.G.player.fatigue = cp; return sn; };
      if(!libre && wk > 15 && !c.G.camp && !c.G.nextFight && !c.G.player.inj && c.G.player.fatigue < 40){
        libre = guardar('libre y fresco'); out.push(libre);
        out.push(guardar('libre y cansado (desgaste 70)', (x) => { x.G.player.fatigue = 70; }));
      }
      if(!camp && c.G.camp && c.G.camp.i >= 1 && c.G.camp.i < c.G.camp.weeks - 1 && !c.G.player.inj){ camp = guardar('campamento'); out.push(camp); }
    }
  }
  return out;
}
function semana(o){
  const ctxs = contextosSemana(o), res = [];
  for(const sn of ctxs){
    const filas = {};
    for(const k of Object.keys(SEMANA)){
      const ms = []; for(let r = 0; r < o.azar; r++) ms.push(medirSemana(sn, k, r));
      const media = (f) => ms.reduce((a, x) => a + f(x), 0) / ms.length;
      const st = {}; for(const x of ms) for(const s in x.st) st[s] = (st[s] || 0) + x.st[s] / ms.length;
      filas[k] = { st, stats: media(x => x.stats), desgaste: media(x => x.desgaste), lesion: media(x => x.lesion ? 1 : 0), semanasLesion: media(x => x.semanasLesion),
        filo: media(x => x.filo), desgasteCamp: media(x => x.desgasteCamp), peso: media(x => x.peso), errores: ms.filter(x => x.error).map(x => x.error).slice(0, 1) };
    }
    /* dominancia: cada stat (+), desgaste (−), lesión (−), filo (+), desgaste del camp (−) */
    const dims = (f) => { const d = { desgaste: -f.desgaste, lesion: -f.lesion * 100, filo: f.filo, desgasteCamp: -f.desgasteCamp }; for(const s in f.st) d['st.' + s] = f.st[s]; return d; };
    const dom = [];
    const ks = Object.keys(filas);
    for(const a of ks) for(const b of ks){
      if(a === b) continue;
      const da = dims(filas[a]), db = dims(filas[b]); let mejor = false, peor = false;
      for(const k of new Set([...Object.keys(da), ...Object.keys(db)])){ const x = (da[k] || 0) - (db[k] || 0); if(x < -0.05) peor = true; if(x > 0.05) mejor = true; }
      if(mejor && !peor) dom.push(a + '>' + b);
    }
    res.push({ contexto: sn.nombre, filas, dominadas: dom });
  }
  return res;
}

/* ==========================================================================
   EL PLAN DEL CAMPAMENTO CONTRA EL RIVAL
   Misma partida al final del campamento; el rival se ajusta a dos perfiles de
   nivel parecido y opuestos. Cada plan se confirma por gpConfirm (que puntúa
   contra el rival) y se pelea con un jugador que lo respeta. Mismo azar entre
   celdas. La pregunta: ¿el plan que más gana cambia según el rival?
   ========================================================================== */
/* perfiles relativos al jugador: el lado fuerte del rival a +12 de su promedio, el débil a −12 */
const DE_PIE = ['boxing', 'kicks', 'accuracy', 'defense', 'power', 'timing'], DE_LUCHA = ['takedowns', 'tdd', 'wrestling', 'grappling', 'ground', 'submission', 'clinch'];
const PERFILES = { fajador: { style: 'boxer', fuerte: DE_PIE, debil: DE_LUCHA }, luchador: { style: 'wrest', fuerte: DE_LUCHA, debil: DE_PIE } };
function aplicarPerfil(c, o, P){
  const p = c.G.player, todos = DE_PIE.concat(DE_LUCHA), base = todos.reduce((a, k) => a + p.st[k], 0) / todos.length;
  o.style = P.style;
  for(const k of P.fuerte) o.st[k] = Math.round(Math.min(99, base + 12));
  for(const k of P.debil) o.st[k] = Math.round(Math.max(20, base - 12));
  for(const k of ['cardio', 'toughness', 'composure', 'fightiq', 'speed', 'footwork']) o.st[k] = Math.round(p.st[k]);
}
const PLANES = {
  striking:  { gp: { prio: 'striking', dist: 'larga', pace: 'medio', def: 'cabeza' },  pie: ['combo', 'jab'], clinch: ['break'], arriba: ['gnp'], abajo: ['getup', 'sweep'] },
  counter:   { gp: { prio: 'counter', dist: 'larga', pace: 'medio', def: 'cabeza' },   pie: ['counter', 'jab'], clinch: ['break'], arriba: ['gnp'], abajo: ['getup', 'sweep'] },
  wrestling: { gp: { prio: 'wrestling', dist: 'corta', pace: 'medio', def: 'derribo' }, pie: ['td', 'clinch'], clinch: ['ctd', 'grind'], arriba: ['gnp', 'pass'], abajo: ['sweep', 'getup'] },
  grappling: { gp: { prio: 'grappling', dist: 'corta', pace: 'medio', def: 'derribo' }, pie: ['td', 'clinch'], clinch: ['ctd'], arriba: ['pass', 'sub'], abajo: ['bsub', 'sweep'] },
  clinch:    { gp: { prio: 'clinch', dist: 'corta', pace: 'medio', def: 'reja' },       pie: ['clinch', 'jab'], clinch: ['knees', 'grind'], arriba: ['gnp'], abajo: ['getup', 'sweep'] },
};
function politicaPlan(plan){
  return (c) => {
    const f = c.G.fight, ops = c.fightOptions(); if(!ops.length) return null;
    const pos = f.pos, has = (k) => ops.some(o => o.k === k);
    if(f.p.stam < 22){ for(const k of ['move', 'hold', 'break', 'guard']) if(has(k)) return k; }
    const lista = pos === 'stand' ? plan.pie : pos === 'clinch' ? plan.clinch : pos === 'gtop' ? plan.arriba : plan.abajo;
    for(const k of lista) if(has(k)) return k;
    return ops[0].k;
  };
}
function baseCamp(semilla){
  const h = H.boot({ seed: semilla, file: ARCHIVO });
  H.startCareer(h, { metaSeed: 170000 + semilla, style: 'mma', div: 'LW', age: 24 });
  const c = h.ctx;
  for(let w = 0; w < 200 && !(c.G.camp && c.G.nextFight && c.G.camp.i >= c.G.camp.weeks - 1 && c.G.player.rec.w + c.G.player.rec.l >= 3); w++){
    A.correrCarrera(h, { maxWeeks: 1, politica: 'basica', seedPolitica: 500 + w });
    while(c.G.pending.length) c.resolveEvent(0);
    c.G.mg = null;
  }
  if(!(c.G.camp && c.G.nextFight)) throw new Error('no se llegó al final de un campamento');
  c.G.player.inj = null; c.G.player.injWeeks = 0;
  c.saveGame(true);
  return { seed: semilla, sid: c.listSaves()[0].id, disco: new Map(c.localStorage.__map), rs: c.G.rs | 0 };
}
function pelearPlan(snap, perfil, planKey, r, opt){
  const h = abrir(snap), c = h.ctx, o = c.F(c.G.nextFight.oppId), P = PERFILES[perfil], plan = PLANES[planKey];
  aplicarPerfil(c, o, P);
  c.G.rs = (snap.rs + 7919 * (r + 1)) | 0;
  let score = null;
  if(!(opt && opt.sinPlan)){
    c.gpStart(); for(const k in plan.gp) c.gpSet(k, plan.gp[k]); c.gpConfirm(); score = c.G.camp.gameplan ? c.G.camp.gameplan.score : null;
    if(opt && opt.score != null && c.G.camp.gameplan) c.G.camp.gameplan.score = opt.score;
    c.G.mg = null;
  }
  c.G.rs = (snap.rs + 104729 * (r + 1)) | 0;
  c.goFight();
  const pol = politicaPlan(opt && opt.juega ? PLANES[opt.juega] : plan);
  for(let g = 0; g < 800 && c.G.fight && !c.G.fight.over; g++){ const k = pol(c); if(!k){ c.finishFight('dec', null); break; } c.fightAct(k); }
  const f = c.G.fight, res = (f && f.result) || {};
  return { gana: res.winner === 'p', empate: res.winner === 'd', metodo: res.method, round: f ? f.round : 0, hpJ: f ? f.p.hp : 0, hpR: f ? f.o.hp : 0, score };
}
function camp(o){
  const snap = baseCamp(o.semilla || 1601), filas = [];
  for(const perfil of Object.keys(PERFILES)){
    for(const planKey of Object.keys(PLANES)){
      const ms = []; for(let r = 0; r < o.peleas; r++) ms.push(pelearPlan(snap, perfil, planKey, r));
      const m = (f) => ms.reduce((a, x) => a + f(x), 0) / ms.length;
      filas.push({ perfil, plan: planKey, gana: m(x => x.gana ? 1 : 0), finaliza: m(x => x.gana && x.metodo !== 'dec' ? 1 : 0), hpJ: m(x => x.hpJ), hpR: m(x => x.hpR), score: ms[0].score });
    }
  }
  /* control: mismo plan escrito, otro juego (el plan no sirve si no lo peleás) y sin plan */
  const control = [];
  for(const perfil of Object.keys(PERFILES)){
    for(const [nom, opt] of [['plan wrestling, pelea de striking', { juega: 'striking' }], ['sin plan, pelea de striking', { sinPlan: true, juega: 'striking' }], ['sin plan, pelea de wrestling', { sinPlan: true, juega: 'wrestling' }]]){
      const planKey = nom.startsWith('plan wrestling') ? 'wrestling' : 'striking';
      const ms = []; for(let r = 0; r < o.peleas; r++) ms.push(pelearPlan(snap, perfil, planKey, r, opt));
      control.push({ perfil, caso: nom, gana: ms.filter(x => x.gana).length / ms.length });
    }
  }
  return { filas, control };
}

/* ==========================================================================
   IDENTIDAD, EQUIPO Y MÁNAGER: la misma carrera cambiando sólo una cosa
   Misma semilla, misma política (autopiloto y sus elecciones), 208 semanas.
   Lo que difiere al final es lo que esa elección cambió de la carrera.
   ========================================================================== */
function carreraCon(cfg, semanas, ajuste){
  const h = H.boot({ seed: cfg.seed || 1801, file: ARCHIVO });
  H.startCareer(h, Object.assign({ metaSeed: 180100, style: 'mma', div: 'LW', age: 22 }, cfg.career || {}));
  const c = h.ctx, ev = {}, ofertas = { total: 0, show: 0, titulo: 0, bolsa: 0 }, rivCaracter = { n: 0 };
  if(ajuste) ajuste(c);
  const rq = c.resolveEvent;
  c.resolveEvent = function(i){ const e = c.G.pending[0]; if(e){ const k = e.id === 'cl_dyn' ? 'cl:' + e.h : e.id; ev[k] = (ev[k] || 0) + 1; } return rq.apply(this, arguments); };
  c.hookOn('offers:made', 'medirOfertas', () => { for(const o of c.G.offers || []) if(o.type === 'fight'){ ofertas.total++; if(o.clTag === 'show') ofertas.show++; if(o.title) ofertas.titulo++; ofertas.bolsa += +o.purse || 0; } }, 99);
  const tr = c.CL.track; c.CL.track = function(f, why){ if(why === 'rivalidad por carácter') rivCaracter.n++; return tr.apply(this, arguments); };
  A.correrCarrera(h, { maxWeeks: semanas, politica: 'basica', seedPolitica: 31 });
  const p = c.G.player, co = c.coachById(p.coach), mg = c.mgrById(c.G.mgId), cs = c.CL.coachState ? c.CL.coachState(co) : null;
  return { h, c, ev, ofertas, rivCaracter: rivCaracter.n, fin: {
    record: p.rec.w + '-' + p.rec.l, pop: +p.pop.toFixed(1), rep: +p.rep.toFixed(1), hype: +(p.hype || 0).toFixed(1), caja: Math.round(c.G.cash), ovr: c.ovr(p),
    pacienciaCoach: cs && cs.patience != null ? +(+cs.patience).toFixed(1) : null, confianzaCoach: co && co.rel ? Math.round(co.rel.trust) : null,
    confianzaMgr: mg && mg.rel ? Math.round(mg.rel.trust) : null, pers: p.pers, rasgos: Object.keys((c.RPG && c.RPG.R && c.RPG.R().traits) || {}).join(','), identidad: (() => { try{ const x = c.RPG.officialIdentity(); return x && (x.k || x.id || x.n || String(x)); } catch(e){ return null; } })(),
    socCap: c.socCap ? c.socCap() : null, rivalesSeguidos: c.CL.tracked().length } };
}
function comparar(variantes, semanas){
  const out = [];
  for(const [nombre, cfg, ajuste] of variantes){ const r = carreraCon(cfg, semanas, ajuste); delete r.h; delete r.c; out.push({ nombre, ...r }); }
  /* eventos que sólo le tocaron a algunas variantes */
  const ids = new Set(); out.forEach(r => Object.keys(r.ev).forEach(k => ids.add(k)));
  const propios = {}; for(const r of out) propios[r.nombre] = [...ids].filter(k => r.ev[k] && out.filter(x => x.ev[k]).length <= Math.max(1, Math.floor(out.length / 3)));
  return { out, propios, eventosDistintos: ids.size };
}

/* ==========================================================================
   BUILDS: cinco carreras que eligen distinto
   Cada perfil fija cómo entrena, cómo pelea, qué compra, qué hace fuera del
   gimnasio y qué contesta en los eventos (por palabras de la opción; si
   ninguna calza, una fija). No se busca cuál es mejor: qué decisiones le
   aparecen, qué recursos usa, qué riesgos corre y cuánto se repiten sus semanas.
   ========================================================================== */
const PERFIL = {
  golpeador: { ramas: ['str', 'iq'], estilo: 'counter', pers: 'pro', semana: ['drill+', 'box', 'spar+', 'kick', 'drill+', 'rest'], pie: ['counter', 'jab', 'combo'], clinch: ['break'], arriba: ['gnp'], abajo: ['getup'],
    gp: { prio: 'counter', dist: 'larga', pace: 'medio', def: 'cabeza' }, tono: 'pro', palabras: ['plan', 'enfoc', 'imponer', 'estudi', 'análisis', 'entren', 'escuchar'], compras: ['analyst', 'lightboard', 'recoverylab'], social: 0.05 },
  presion: { ramas: ['wrs', 'str'], estilo: 'press', pers: 'aggro', semana: ['wrest', 'str+', 'cardio+', 'grap', 'spar+', 'wrest'], pie: ['td', 'clinch', 'combo'], clinch: ['ctd', 'grind', 'knees'], arriba: ['gnp', 'pass'], abajo: ['sweep', 'getup'],
    gp: { prio: 'wrestling', dist: 'corta', pace: 'alto', def: 'derribo' }, tono: 'aggro', palabras: ['presion', 'confront', 'acusar', 'dureza', 'insistir', 'aceptar', 'doblar', 'intervenir'], compras: ['nutri', 'masseur', 'cutman'], social: 0.03 },
  defensivo: { ramas: ['iq', 'grp'], estilo: 'out', pers: 'quiet', semana: ['mind', 'cardio', 'rest', 'drill+', 'tranquila', 'cardio'], pie: ['jab', 'move', 'counter'], clinch: ['break', 'grind'], arriba: ['hold', 'pass'], abajo: ['guard', 'getup'],
    gp: { prio: 'counter', dist: 'larga', pace: 'bajo', def: 'derribo' }, tono: 'quiet', palabras: ['ignor', 'esperar', 'no cambiar', 'margen', 'descans', 'rechaz', 'no meterte'], compras: ['nutri', 'recoverylab', 'masseur'], social: 0.02 },
  medios: { ramas: ['str', 'iq'], estilo: 'mma', pers: 'charisma', semana: ['box', 'spar+', 'str', 'drill+', 'rest', 'box'], pie: ['combo', 'jab', 'lowkick'], clinch: ['knees'], arriba: ['gnp'], abajo: ['getup'],
    gp: { prio: 'striking', dist: 'media', pace: 'alto', def: 'cabeza' }, tono: 'charisma', palabras: ['públic', 'redes', 'prensa', 'video', 'filmar', 'legado', 'hablar', 'titular', 'grabar', 'publicar'], compras: ['camera', 'stylist', 'pr', 'mediahouse', 'documentary'], social: 0.12 },
  equipo: { ramas: ['grp', 'wrs'], estilo: 'mma', pers: 'humble', semana: ['spar+', 'grap', 'box', 'mind', 'wrest', 'rest'], pie: ['jab', 'td', 'combo'], clinch: ['grind', 'ctd'], arriba: ['pass', 'gnp'], abajo: ['sweep', 'getup'],
    gp: { prio: 'grappling', dist: 'corta', pace: 'medio', def: 'derribo' }, tono: 'humble', palabras: ['escuchar', 'mediar', 'ayud', 'entrenarlo', 'acompañ', 'invitar', 'consult', 'manager', 'bancar', 'coach', 'equipo', 'compañero'], compras: ['cutman', 'masseur', 'analyst'], social: 0.35 },
};
function elegirOpcion(c, perfil, rnd){
  const e = c.G.pending[0], ops = (e && e.opts) || [];
  if(!ops.length) return 0;
  let mejor = -1, pts = 0;
  ops.forEach((o, i) => { const t = String(o.t || o).toLowerCase(); const n = perfil.palabras.filter(w => t.indexOf(w) >= 0).length; if(n > pts){ pts = n; mejor = i; } });
  return mejor >= 0 ? mejor : Math.floor(rnd() * ops.length);
}
function carreraPerfil(nombre, semanas, semilla){
  const P = PERFIL[nombre], seed = semilla || 1901;
  const h = H.boot({ seed, file: ARCHIVO });
  H.startCareer(h, { metaSeed: 190100, style: P.estilo, pers: P.pers, div: 'LW', age: 22 });
  const c = h.ctx;
  let s0 = 777 >>> 0; const rnd = () => { s0 = (s0 * 1664525 + 1013904223) >>> 0; return s0 / 4294967296; };
  const K = { sonda: {}, eventos: {}, semanas: [], hitos: {}, lesiones: 0, gasto: 0, compras: [], social: 0, prensa: 0, tonos: {}, peleas: 0, porKO: 0, derrotasKO: 0, desgaste: 0 };
  const hito = (k, causa) => { const x = (K.hitos[k] = K.hitos[k] || {}); x[causa] = (x[causa] || 0) + 1; };
  /* quién causa cada hito: si pasa dentro de una acción del jugador, fue él; si pasa al avanzar la semana, el mundo */
  let enAccion = null;
  const envolver = (nombreFn, k) => { const f = c[nombreFn]; if(typeof f !== 'function') return; c[nombreFn] = function(){ const r = f.apply(this, arguments); hito(k, enAccion || 'mundo'); return r; }; };
  const pre = { org: null, div: null, gym: null, coach: null, mg: null, tit: 0, inj: false, trackN: 0, tq: 0 };
  const fotoHitos = (causa) => {
    const p = c.G.player, tit = Object.values(c.G.champs).reduce((a, o) => a + Object.values(o).filter(x => x === p.id).length, 0);
    if(pre.org !== null && p.org !== pre.org) hito('cambio de organización', causa);
    if(pre.div !== null && p.div !== pre.div) hito('cambio de división', causa);
    if(pre.gym !== null && p.gym !== pre.gym) hito('cambio de gimnasio', causa);
    if(pre.coach !== null && p.coach !== pre.coach) hito('cambio de entrenador', causa);
    if(pre.mg !== null && c.G.mgId !== pre.mg) hito('cambio de mánager', causa);
    if(tit > pre.tit) hito('título ganado', causa); if(tit < pre.tit) hito('título perdido', causa);
    if(p.inj && !pre.inj){ hito('lesión', causa); K.lesiones++; }
    const tn = c.CL.tracked().length; if(tn > pre.trackN) hito('rival o vínculo nuevo', causa);
    const tq = Object.keys((c.G.rpg && c.G.rpg.tq) || {}).length;
    Object.assign(pre, { org: p.org, div: p.div, gym: p.gym, coach: p.coach, mg: c.G.mgId, tit, inj: !!p.inj, trackN: tn, tq });
  };
  fotoHitos('mundo');
  const t0 = c.G.year * 52 + c.G.week; let guarda = 0, sem = 0, firmaSemana = [];
  while(!c.G.player.retired && (c.G.year * 52 + c.G.week) - t0 < semanas && guarda++ < semanas * 40){
    const firma = firmaSemana;
    if(c.G.pending.length){ const e = c.G.pending[0], k = e.id === 'cl_dyn' ? 'cl:' + e.h : e.id; K.eventos[k] = (K.eventos[k] || 0) + 1; firma.push('ev:' + k);
      enAccion = 'jugador (evento)'; c.resolveEvent(elegirOpcion(c, P, rnd)); fotoHitos('jugador (evento)'); enAccion = null; continue; }
    if(c.G.fight && !c.G.fight.over){
      /* como el conductor RPG: a veces una técnica propia (o su Ultimate) con su minijuego, y anticipar cuando la lectura lo permite */
      if(!c.G.mg && c.UI.sub !== 'corner' && rnd() < 0.3){
        const ult = Object.keys((c.G.rpg && c.G.rpg.ult) || {}).find(id => c.CMB.ultState(id).ok), lista = c.TQ.available().filter(e => e.s.ok);
        if(ult || lista.length){ if(ult) c.CMB.ultUse(ult); else c.TQ.use(lista[0].t.id); if(c.FX.S){ c.fxEnd(c.FX.S, 0.35 + rnd() * 0.65); c.fxFinish(); } K.tecnicasUsadas = (K.tecnicasUsadas || 0) + 1; if(!c.G.fight || c.G.fight.over) continue; }
      }
      const ops = c.fightOptions(), g = ops.find(o => o.k === 'iq_x') && c.CMB.guess();
      if(g && g.p >= 0.30 && rnd() < 0.5){ c.fightAct('iq_x'); K.anticipos = (K.anticipos || 0) + 1; continue; }
      const pol = politicaPlan(P); const k = pol(c); if(!k) c.finishFight('dec', null); else c.fightAct(k); continue; }
    if(c.G.fight && c.G.fight.over){ const r = c.G.fight.result || {}; K.peleas++; if(r.winner === 'p' && r.method !== 'dec') K.porKO++; if(r.winner === 'o' && (r.method === 'ko' || r.method === 'tko')) K.derrotasKO++;
      if(!c.G.paid) c.confirmFight(); c.go('hub'); fotoHitos('pelea'); continue; }
    if(c.G.camp && c.G.nextFight && c.G.nextFight.weeks <= 0){
      if(!c.G.camp.weighDone && c.weighStart){ try{ c.weighStart(); for(let g = 0; g < 8 && c.G.mg && !c.G.mg.done; g++) c.weighAct(0); } catch(e){} c.G.mg = null; c.G.camp.weighDone = true; }
      c.G.camp.pressDone = true; c.goFight(); continue; }
    if(!c.G.player.org && c.G.offers.length){ const co = c.G.offers.find(o => o.type === 'contract' && c.G.orgs[o.org]); if(co){ enAccion = 'jugador'; c.negoStart(co); c.negoClose(); c.G.mg = null; c.UI.screen = 'hub'; fotoHitos('jugador'); enAccion = null; continue; } }
    if(!c.G.nextFight && c.G.offers.length){ const i = c.G.offers.findIndex(o => o.type === 'fight' && o.oppId && c.F(o.oppId)); if(i >= 0){ enAccion = 'jugador'; const ok = c.acceptFight(i); enAccion = null; if(ok){ hito('pelea firmada', 'jugador'); firma.push('firma'); continue; } } }
    /* progresión del perfil: técnicas de sus ramas (la más barata disponible) y la lección de la derrota */
    for(let k = 0; k < 3; k++){ const t = c.TQ.T.filter(x => P.ramas.indexOf(x.br) >= 0 && c.TQ.canUnlock(x.id).ok).sort((a, b) => a.cost - b.cost || a.lv - b.lv)[0]; if(!t) break; c.TQ.unlock(t.id); K.tq = (K.tq || 0) + 1; }
    if(c.G.rpg && c.G.rpg.lastLoss){ c.CMB.takeLesson(); K.lecciones = (K.lecciones || 0) + 1; }
    c.UI.screen = 'hub'; if(c.UI.tmp) c.UI.tmp.tqNew = null;
    /* gameplan del perfil en la primera semana de campamento */
    if(c.G.camp && !c.G.camp.gameplan && c.G.camp.i >= 1){ c.gpStart(); for(const k in P.gp) c.gpSet(k, P.gp[k]); c.gpConfirm(); c.mgClose(true); firma.push('gameplan'); fotoHitos('jugador'); continue; }
    /* prensa del campamento con el tono del perfil */
    if(c.G.camp && !c.G.camp.pressDone && c.G.camp.i >= 2 && !c.G.mg){ c.pressStart(); for(let g = 0; g < 6 && c.G.mg && !c.G.mg.done; g++){ const q = c.G.mg.qs[c.G.mg.step]; let i = q.o.findIndex(o => o[1] === P.tono); if(i < 0) i = 0; K.tonos[q.o[i][1]] = (K.tonos[q.o[i][1]] || 0) + 1; c.pressPick(i); } K.prensa++; if(c.G.mg) c.mgClose(false); firma.push('prensa'); }
    /* compras del perfil */
    for(const w of P.compras){ const it = c.SHOP.find(x => x.id === w); if(!it || c.shopOwned(w) || c.shopCan(it) || c.G.cash < 3 * it.p) continue; const a = c.G.cash; c.buyItem(w); K.gasto += a - c.G.cash; K.compras.push(w); c.G.socOut = null; firma.push('compra'); break; }
    /* vida social */
    if(!c.G.camp && rnd() < P.social){ const f = Object.values(c.G.fighters).find(y => y && !y.isPlayer && y.active && !y.retired && !y.inj && y.div === c.G.player.div && !c.socWhyBlocked('train:' + y.id, { weight: c.SOC_W.MAYOR, actor: y.id, cat: 'gym' })); if(f){ enAccion = 'jugador'; c.socInvite(f.id); enAccion = null; K.social++; firma.push('social'); } c.G.socOut = null; c.UI.screen = 'hub'; }
    /* el trabajo de la semana */
    const w = c.G.player.inj ? 'rest' : P.semana[sem % P.semana.length]; sem++;
    const antes = c.G.year * 52 + c.G.week;
    enAccion = 'jugador (semana)'; try{ SEMANA[w](c); } catch(e){ c.doWeek('rest'); } enAccion = null;
    if(c.G.year * 52 + c.G.week === antes && !c.G.pending.length) c.advanceWeek();
    fotoHitos(c.G.player.inj && !pre.inj ? 'azar (entrenamiento)' : 'mundo');
    K.desgaste += c.G.player.fatigue;
    /* sonda: qué eventos del banco estaban habilitados esta semana (contexto, drama y condición) */
    if(K.sonda){ for(const e of c.EVENTS){ if(e.id === 'cl_dyn') continue; let ok = false; try{ ok = c.eventContextAllows(e.id) && !(e.drama && c.CL.dramaOk && !c.CL.dramaOk()) && (!e.c || !!e.c()); } catch(err){ ok = false; } if(ok) K.sonda[e.id] = (K.sonda[e.id] || 0) + 1; } }
    firma.unshift(w + (c.G.camp ? '@camp' : ''));
    K.semanas.push(firma.join('|')); firmaSemana = [];
    if(!c.G.nextFight && !c.G.offers.length && !c.G.player.inj) c.makeOffers();
  }
  const p = c.G.player, R = c.G.rpg || {};
  const firmas = new Set(K.semanas), soloEntreno = K.semanas.filter(x => x.indexOf('|') < 0).length;
  return { perfil: nombre, semanas: K.semanas.length, record: p.rec.w + '-' + p.rec.l + '-' + p.rec.d, finalizaciones: K.porKO, derrotasKO: K.derrotasKO, peleas: K.peleas,
    titulos: p.titles || 0, pop: Math.round(p.pop), rep: Math.round(p.rep), ovr: c.ovr(p), caja: Math.round(c.G.cash), gasto: Math.round(K.gasto), compras: K.compras,
    lesiones: K.lesiones, desgasteMedio: +(K.desgaste / Math.max(1, K.semanas.length)).toFixed(1), social: K.social, prensa: K.prensa, tonos: K.tonos,
    eventosDistintos: Object.keys(K.eventos).length, eventos: K.eventos, rasgos: Object.keys(R.traits || {}), tecnicas: K.tq || 0, ramas: c.TQ.T.filter(t => c.TQ.has && c.TQ.has(t.id)).reduce((m, t) => (m[t.br] = (m[t.br] || 0) + 1, m), {}), lecciones: K.lecciones || 0, tecnicasUsadas: K.tecnicasUsadas || 0, anticipos: K.anticipos || 0,
    identidad: (() => { try{ const x = c.RPG.officialIdentity(); return x && (x.k || x.n || JSON.stringify(x).slice(0, 40)); } catch(e){ return null; } })(),
    firmasDistintas: firmas.size, semanasSoloEntreno: soloEntreno, hitos: K.hitos, habilitados: K.sonda };
}

module.exports = { carreraPerfil, PERFIL, camp, pelearPlan, baseCamp, PLANES, PERFILES, carreraCon, comparar, recolectar, resumenEvento, clasificar, rama, abrir, recursos, aplanar, persistible, tipo, DIRECCION, SEMANA, semana, contextosSemana, medirSemana };

if(require.main === module){
  const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
  const modo = process.argv[2] || 'eventos';
  if(modo === 'camp'){
    const r = camp({ semilla: +arg('semilla', 1601), peleas: +arg('peleas', 40) });
    if(arg('json')) fs.writeFileSync(arg('json'), JSON.stringify(r, null, 1));
    for(const perfil of Object.keys(PERFILES)){
      console.log('\n== rival ' + perfil + '\nplan        puntaje  gana   finaliza   vida jugador   vida rival');
      for(const f of r.filas.filter(x => x.perfil === perfil)) console.log(f.plan.padEnd(12) + String(f.score).padStart(6) + (f.gana * 100).toFixed(0).padStart(6) + '%' + (f.finaliza * 100).toFixed(0).padStart(9) + '%' + f.hpJ.toFixed(0).padStart(13) + f.hpR.toFixed(0).padStart(13));
    }
    console.log('\ncontroles:'); for(const x of r.control) console.log('  ' + x.perfil.padEnd(9) + x.caso.padEnd(36) + (x.gana * 100).toFixed(0) + '%');
  }
  if(modo === 'identidad' || modo === 'equipo' || modo === 'manager'){
    const sem = +arg('semanas', 208);
    let variantes = [];
    if(modo === 'identidad') variantes = ['humble', 'arrogant', 'quiet', 'charisma', 'aggro', 'funny', 'pro', 'chaos'].map(k => [k, { career: { pers: k } }]);
    if(modo === 'equipo'){
      const h0 = H.boot({ seed: 1801, file: ARCHIVO }); H.startCareer(h0, { metaSeed: 180100, style: 'mma', div: 'LW', age: 22 });
      const cs = h0.ctx.G.coaches.slice(0, 8);
      variantes = cs.map(co => [co.id + ' ' + co.spec + ' q' + co.q, {}, (c) => { c.G.player.coach = co.id; }]);
    }
    if(modo === 'manager'){
      const h0 = H.boot({ seed: 1801, file: ARCHIVO }); H.startCareer(h0, { metaSeed: 180100, style: 'mma', div: 'LW', age: 22 });
      const ms = (h0.ctx.G.mgrs || []).slice(0, 8);
      variantes = ms.map(m => [m.id + ' ' + (m.name || '') + ' net' + (m.a && m.a.net) + ' neg' + (m.a && m.a.neg) + ' cut' + m.cut, {}, (c) => { c.G.mgId = m.id; }]);
    }
    const r = comparar(variantes, sem);
    if(arg('json')) fs.writeFileSync(arg('json'), JSON.stringify(r, null, 1));
    console.log(modo + ' · ' + sem + ' semanas · ' + r.eventosDistintos + ' decisiones distintas en total');
    for(const x of r.out) console.log(x.nombre.padEnd(34) + ' ' + JSON.stringify(x.fin) + ' · ofertas ' + x.ofertas.total + ' (show ' + x.ofertas.show + ', título ' + x.ofertas.titulo + ', bolsa media ' + Math.round(x.ofertas.bolsa / Math.max(1, x.ofertas.total)) + ') · rivalidades por carácter ' + x.rivCaracter + ' · eventos propios: ' + (r.propios[x.nombre].join(' ') || '—'));
  }
  if(modo === 'builds'){
    const sem = +arg('semanas', 520), solo = arg('perfil', null), out = [];
    for(const k of Object.keys(PERFIL)){ if(solo && k !== solo) continue; const t0 = Date.now(); const r = carreraPerfil(k, sem, +arg('semilla', 1901)); out.push(r);
      console.log('\n== ' + k + ' (' + ((Date.now() - t0) / 1000).toFixed(0) + ' s) · ' + r.semanas + ' semanas · récord ' + r.record + ' (' + r.finalizaciones + ' finalizaciones, ' + r.derrotasKO + ' derrotas por KO) · títulos ' + r.titulos + ' · OVR ' + r.ovr + ' · pop ' + r.pop + ' · rep ' + r.rep);
      console.log('   recursos: caja ' + r.caja + ' · gastado en compras ' + r.gasto + ' (' + r.compras.join(',') + ') · lesiones ' + r.lesiones + ' · desgaste medio ' + r.desgasteMedio + ' · vida social ' + r.social + ' · conferencias ' + r.prensa + ' ' + JSON.stringify(r.tonos));
      console.log('   decisiones: eventos distintos ' + r.eventosDistintos + ' · rasgos ' + (r.rasgos.join(',') || '—') + ' · técnicas ' + r.tecnicas + ' ' + JSON.stringify(r.ramas) + ' · lecciones ' + r.lecciones + ' · técnicas usadas ' + r.tecnicasUsadas + ' · anticipos ' + r.anticipos + ' · identidad ' + r.identidad + ' · semanas distintas ' + r.firmasDistintas + ' de ' + r.semanas + ' · semanas con sólo entrenar ' + r.semanasSoloEntreno);
      console.log('   hitos: ' + Object.entries(r.hitos).map(([k, v]) => k + ' ' + Object.entries(v).map(([a, b]) => a + ':' + b).join('/')).join(' · ')); }
    if(arg('json')) fs.writeFileSync(arg('json'), JSON.stringify(out, null, 1));
  }
  if(modo === 'semana'){
    const res = semana({ semillas: [1601, 1637], azar: +arg('azar', 24) });
    if(arg('json')) fs.writeFileSync(arg('json'), JSON.stringify(res, null, 1));
    for(const r of res){
      console.log('\n== ' + r.contexto);
      console.log('opción'.padEnd(11) + 'stats  desgaste  lesión  filo  camp  peso   mejor stat');
      for(const [k, f] of Object.entries(r.filas)){
        const top = Object.entries(f.st).sort((a, b) => b[1] - a[1])[0];
        console.log(k.padEnd(11) + f.stats.toFixed(2).padStart(5) + f.desgaste.toFixed(1).padStart(9) + (f.lesion * 100).toFixed(0).padStart(6) + '%' + f.filo.toFixed(1).padStart(6) + f.desgasteCamp.toFixed(1).padStart(6) + f.peso.toFixed(1).padStart(6) + '   ' + (top ? top[0] + ' +' + top[1].toFixed(2) : '—') + (f.errores.length ? '  ERROR ' + f.errores[0] : ''));
      }
      console.log('dominadas: ' + (r.dominadas.join(' ') || 'ninguna'));
    }
  }
  if(modo === 'eventos'){
    const n = +arg('carreras', 4), sh = arg('shard', null);
    let semillas = Array.from({ length: n }, (_, i) => 1501 + i * 37);
    if(sh){ const [a, b] = sh.split('/').map(Number); semillas = semillas.filter((_, i) => i % b === a); }
    const t0 = Date.now();
    const res = recolectar({ semillas, semanas: +arg('semanas', 400), muestras: +arg('muestras', 1), azar: +arg('azar', 2), horizonte: +arg('horizonte', 8),
      alPaso: (k) => process.stderr.write('.' ) });
    const out = Object.values(res).map(resumenEvento);
    if(arg('json')) fs.writeFileSync(arg('json'), JSON.stringify({ semillas, eventos: out, crudo: arg('crudo') ? res : undefined }, null, 1));
    console.log('\n' + out.length + ' decisiones medidas en ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
    for(const e of out){
      const marcas = [];
      if(e.falsas.length) marcas.push('FALSAS ' + e.falsas.map(p => p.join('=')).join(' '));
      if(e.dominadas.length) marcas.push('DOMINADAS ' + e.dominadas.map(d => d.gana + '>' + d.pierde).join(' '));
      if(e.sinEfecto.length) marcas.push('sin efecto ' + e.sinEfecto.join(','));
      console.log(e.id.padEnd(26) + ' n' + e.n + ' ' + (marcas.join(' · ') || 'con contexto'));
    }
  }
}
