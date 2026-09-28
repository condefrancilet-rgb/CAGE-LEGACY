#!/usr/bin/env node
'use strict';
/* dev/mundo-sim.js — EL MUNDO SIN EL JUGADOR (fase 14)
   ---------------------------------------------------------------------------
   El jugador existe pero no hace nada: no pelea, no firma, no cambia de
   división, no elige rivales, no contesta eventos (se descartan) y tiene caja
   de sobra para que la economía no genere avisos. Sólo avanza la semana.
   Se mide lo que el mundo hace solo —peleas, campeones, rankings, retiros,
   debutantes, contratos, agentes libres, divisiones— y se comprueban los
   invariantes del mundo (dev/invariants.js, sistema 'mundo') DESPUÉS DE CADA
   SEMANA, más los de cada pelea del mundo en el momento en que ocurre.
     node dev/mundo-sim.js [--semanas 600] [--semillas 3] [--file otra.html] [--json salida.json]   */
const fs = require('node:fs');
const H = require('./harness.js');
const INV = require('./invariants.js');

function simular(o){
  o = o || {};
  const h = H.boot({ seed: o.seed || 1, file: o.file });
  H.startCareer(h, { metaSeed: o.metaSeed || (41000 + (o.seed || 1)), style: 'mma', div: 'LW', age: 22 });
  const c = h.ctx, G = () => c.G;
  c.G.cash = 1e8;
  const S = { semanas: 0, peleas: 0, titulo: 0, vacantes: 0, ko: 0, sub: 0, dec: 0, empates: 0,
    cambiosCampeon: 0, defensas: 0, retiros: 0, edadesRetiro: [], debutantes: 0, cambiosDiv: 0, cambiosOrg: 0,
    agentesLibres: [], divisionesActivas: [], campeones: [], fallos: [], fallosPelea: [], titulosDobles: 0,
    peleasPorSemana: [], bloqueados: {}, fallosPorTipo: {} };
  /* cada pelea del mundo, en el momento: ¿estaba disponible cada uno? */
  const antes = {};
  c.hookOn('result:applied', 'mundoSim', (x) => {
    const a = x.a, b = x.b, res = x.res || {};
    if(!a || !b) return;
    if(a.isPlayer || b.isPlayer) return;             /* el jugador no pelea en esta simulación */
    S.peleas++; S._semana = (S._semana || 0) + 1;
    if(x.isTitle) S.titulo++;
    if(res.draw || res.winner === 'd') S.empates++; else if(res.method === 'ko' || res.method === 'tko') S.ko++; else if(res.method === 'sub') S.sub++; else S.dec++;
    const mal = [];
    for(const f of [a, b]){
      if(f.retired || !f.active) mal.push(f.id + ' retirado/inactivo');
      if(f.org !== x.orgId) mal.push(f.id + ' de otra organización (' + f.org + ' ≠ ' + x.orgId + ')');
    }
    if(a.div !== b.div) mal.push('divisiones distintas ' + a.div + '/' + b.div);
    /* lesionado al empezar la semana y todavía de baja: no puede estar en una cartelera */
    for(const f of [a, b]) if(S._lesionados && S._lesionados.has(f.id)) mal.push(f.id + ' lesionado');
    if(mal.length) S.fallosPelea.push(c.G.year + 's' + c.G.week + ': ' + mal.join('; '));
  }, 1);
  const fotoTitulos = () => { let t = 0; for(const id in c.G.fighters) t += c.G.fighters[id].titles || 0; return t; };
  let prevChamps = JSON.stringify(c.G.champs), prevF = new Map(Object.values(c.G.fighters).map(f => [f.id, { div: f.div, org: f.org, ret: !!f.retired }]));
  let prevTitulos = fotoTitulos();
  for(let w = 0; w < o.semanas; w++){
    c.G.pending.length = 0; c.G.offers = []; c.G.cash = 1e8;
    S._semana = 0;
    S._lesionados = new Set(Object.values(c.G.fighters).filter(f => !f.isPlayer && f.inj && f.injWeeks >= 2).map(f => f.id));
    c.advanceWeek();
    c.G.pending.length = 0;
    S.semanas++; S.peleasPorSemana.push(S._semana);
    /* campeones: cambios y defensas (desde el estado, no desde los textos) */
    const ch = c.G.champs; let nuevos = 0;
    const pc = JSON.parse(prevChamps);
    for(const org in ch) for(const d in ch[org]){ if(ch[org][d] && ch[org][d] !== (pc[org] || {})[d]) { S.cambiosCampeon++; nuevos++; } }
    /* títulos contados contra coronaciones: cada nuevo campeón suma UN título */
    const t = fotoTitulos();
    /* los títulos de peleadores podados o que entran al mundo cambian el total sin coronación: se descuentan */
    let fuera = 0, dentro = 0;
    for(const [id] of prevF) if(!c.G.fighters[id]) fuera += 0;   /* se recalcula abajo */
    for(const id in c.G.fighters) if(!prevF.has(id)) dentro += c.G.fighters[id].titles || 0;
    /* los podados se miden con la foto previa */
    S._t = S._t || {};
    const delta = t - prevTitulos - dentro + (S._podados || 0);
    if(delta > nuevos) S.titulosDobles += delta - nuevos;
    prevTitulos = t;
    /* peleadores: retiros, debutantes, cambios de división y de organización */
    for(const id in c.G.fighters){
      const f = c.G.fighters[id], p = prevF.get(id);
      if(!p){ if(!f.isPlayer) S.debutantes++; continue; }
      if(!p.ret && f.retired){ S.retiros++; S.edadesRetiro.push(c.ageOf(f)); }
      if(p.div !== f.div && !f.isPlayer) S.cambiosDiv++;
      if(p.org !== f.org && !f.isPlayer) S.cambiosOrg++;
    }
    /* títulos de los peleadores que desaparecieron esta semana (poda) */
    S._podados = 0;
    const nuevoF = new Map(Object.values(c.G.fighters).map(f => [f.id, { div: f.div, org: f.org, ret: !!f.retired, titles: f.titles || 0 }]));
    for(const [id, p] of prevF) if(!nuevoF.has(id)) S._podados += p.titles || 0;
    prevF = nuevoF; prevChamps = JSON.stringify(ch);
    const fallos = INV.checkInvariants(c.G, c.UI, { contexto: 'semana ' + (w + 1) }) || [];
    for(const x of fallos){
      S.fallosPorTipo[x.id] = S.fallosPorTipo[x.id] || { semanas: 0, primero: c.G.year + 's' + c.G.week + ' ' + x.causa };
      S.fallosPorTipo[x.id].semanas++;
      if(S.fallos.length < 40) S.fallos.push(c.G.year + 's' + c.G.week + ' ' + x.id + ': ' + x.causa);
    }
    if(o.alPaso) o.alPaso(c, w + 1, S);
  }
  const vivos = Object.values(c.G.fighters).filter(f => !f.isPlayer && f.active && !f.retired);
  S.activos = vivos.length;
  S.agentesLibres = vivos.filter(f => !f.org).length;
  S.divisiones = {}; vivos.forEach(f => { S.divisiones[f.div] = (S.divisiones[f.div] || 0) + 1; });
  S.campeonesHoy = []; for(const org in c.G.champs) for(const d in c.G.champs[org]) if(c.G.champs[org][d]) S.campeonesHoy.push(org + '/' + d);
  S.vacantes = []; for(const org in c.G.champs) if(c.G.orgs[org] && c.G.orgs[org].tier >= 2) for(const d of c.DIVKEYS) if(!c.G.champs[org][d]) S.vacantes.push(org + '/' + d);
  S.huella = c.STATE.fingerprint(true);
  S.h = h;
  return S;
}

function resumen(S){
  const e = S.edadesRetiro.slice().sort((a, b) => a - b), q = (p) => e.length ? e[Math.min(e.length - 1, Math.floor(p * e.length))] : '—';
  return S.semanas + ' semanas · peleas ' + S.peleas + ' (' + (S.peleas / S.semanas).toFixed(2) + '/sem; título ' + S.titulo + '; KO ' + S.ko + ' · SUB ' + S.sub + ' · DEC ' + S.dec + ' · empate ' + S.empates + ')' +
    ' · cambios de campeón ' + S.cambiosCampeon + ' · retiros ' + S.retiros + ' (edad p10/p50/p90 ' + q(.1) + '/' + q(.5) + '/' + q(.9) + ')' +
    ' · debutantes ' + S.debutantes + ' · cambios de división ' + S.cambiosDiv + ' · cambios de organización ' + S.cambiosOrg +
    ' · activos ' + S.activos + ' · agentes libres ' + S.agentesLibres + ' · campeones hoy ' + S.campeonesHoy.length + ' · vacantes (tier≥2) ' + S.vacantes.length +
    ' · títulos contados de más ' + S.titulosDobles + ' · fallos de invariante ' + S.fallos.length + ' · peleas imposibles ' + S.fallosPelea.length;
}

module.exports = { simular, resumen };

if(require.main === module){
  const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
  const semanas = +arg('semanas', 600), n = +arg('semillas', 3), file = arg('file', undefined);
  const out = [];
  let malos = 0;
  for(let i = 0; i < n; i++){
    const t0 = Date.now();
    const S = simular({ seed: 101 + i * 17, semanas, file });
    console.log('semilla ' + (101 + i * 17) + ' · ' + resumen(S) + ' · ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
    for(const id in S.fallosPorTipo) console.log('   ✗ ' + id + ' · ' + S.fallosPorTipo[id].semanas + ' semanas · primera: ' + S.fallosPorTipo[id].primero);
    S.fallosPelea.slice(0, 5).forEach(x => console.log('   ✗ pelea ' + x));
    if(S.fallos.length || S.fallosPelea.length || S.titulosDobles) malos++;
    delete S.h; out.push(S);
  }
  if(arg('json')) fs.writeFileSync(arg('json'), JSON.stringify(out, null, 1));
  process.exit(malos ? 1 : 0);
}
