#!/usr/bin/env node
'use strict';
/* dev/make-baseline.js — regenera TODA la linea base de F0 con un comando:
     node dev/make-baseline.js [--sim-n 60] [--sim-weeks 150]
   Produce: dev/baseline/metrics.json, dev/baseline/traces/*.json,
            dev/fixtures/*.json, dev/baseline/sim.json                        */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const H = require('./harness.js');
const A = require('./autopilot.js');
const M = require('./metrics.js');

const DIR      = __dirname;
const BASE     = path.join(DIR, 'baseline');
const TRACES   = path.join(BASE, 'traces');
const FIXTURES = path.join(DIR, 'fixtures');
for(const d of [BASE, TRACES, FIXTURES]) fs.mkdirSync(d, { recursive: true });

function arg(n, def){ const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i+1] : def; }
const log = (...a) => process.stderr.write(a.join(' ') + '\n');

/* ---------- 1. metricas ---------- */
log('[1/4] metricas…');
fs.writeFileSync(path.join(BASE, 'metrics.json'), JSON.stringify(M.analyze(), null, 2));

/* ---------- 2. golden traces ---------- */
/* Semillas fijas. La traza guarda, por semana y por pelea, lo que el jugador
   observa: resultado, record, dinero, ranking y lesiones.                    */
const SEMILLAS = [
  { seed: 101, metaSeed: 77001, style: 'boxer',   style2: 'wrest', div: 'LW',  age: 22, pers: 'pro'      },
  { seed: 202, metaSeed: 77002, style: 'wrest',   style2: 'bjj',   div: 'WW',  age: 21, pers: 'humble'   },
  { seed: 303, metaSeed: 77003, style: 'bjj',     style2: 'muay',  div: 'FEA', age: 24, pers: 'quiet'    },
  { seed: 404, metaSeed: 77004, style: 'counter', style2: 'boxer', div: 'MW',  age: 23, pers: 'charisma' },
  { seed: 505, metaSeed: 77005, style: 'press',   style2: 'kick',  div: 'HW',  age: 25, pers: 'aggro'    },
];
const SEMANAS_TRAZA = 160;

log('[2/4] golden traces…');
const resumenTrazas = [];
for(const s of SEMILLAS){
  const h = H.boot({ seed: s.seed });
  H.startCareer(h, s);
  const r = A.correrCarrera(h, { maxWeeks: SEMANAS_TRAZA, politica: 'basica', seedPolitica: s.seed, traza: true });
  const p = h.G.player;
  const salida = {
    config: s, semanas: SEMANAS_TRAZA,
    fingerprint: h.call('STATE.fingerprint', true),
    final: { rec: p.rec, cash: h.G.cash, pop: p.pop, org: p.org, div: p.div,
             titles: p.titles, retired: !!p.retired, year: h.G.year, week: h.G.week },
    traza: r.traza,
  };
  fs.writeFileSync(path.join(TRACES, 'trace-' + s.seed + '.json'), JSON.stringify(salida, null, 1));
  resumenTrazas.push({ seed: s.seed, fp: salida.fingerprint, peleas: r.peleas, rec: p.rec });
  log('   seed ' + s.seed + ' · fp ' + salida.fingerprint + ' · ' + r.peleas + ' peleas');
}

/* ---------- 3. fixtures de save ---------- */
/* Saves reales, producidos por el propio saveSerialize del juego, en los
   momentos alcanzables de una carrera. Son la prueba de compatibilidad (I3). */
log('[3/4] fixtures…');
const fixtures = {};

function guarda(h, nombre, meta){
  const cuerpo = h.call('saveSerialize', h.G);
  fs.writeFileSync(path.join(FIXTURES, nombre + '.json'), cuerpo);
  fixtures[nombre] = { bytes: cuerpo.length, saveVersion: h.G.saveVersion, ...meta };
  log('   ' + nombre + ' · ' + Math.round(cuerpo.length / 1024) + ' KB · v' + h.G.saveVersion);
}

/* a) carrera recien creada */
{
  const h = H.boot({ seed: 900 });
  H.startCareer(h, { metaSeed: 90001, style: 'mma', div: 'LW', age: 22 });
  h.call('saveGame', true);
  guarda(h, '01-recien-creada', { semana: h.G.week, año: h.G.year });
}

/* b) antes de la primera pelea: con contrato y campamento firmado */
{
  const h = H.boot({ seed: 901 });
  H.startCareer(h, { metaSeed: 90002, style: 'boxer', div: 'WW', age: 23 });
  const c = h.ctx;
  let guard = 0;
  while(!c.G.camp && guard++ < 400){
    if(c.G.pending && c.G.pending.length){ c.resolveEvent(0); continue; }
    if(!c.G.player.org && c.G.offers.length){
      const co = c.G.offers.find(o => o.type === 'contract' && c.G.orgs[o.org]);
      if(co){ c.negoStart(co); c.negoClose(); c.G.mg = null; c.UI.screen = 'hub'; continue; }
    }
    const idx = c.G.offers.findIndex(o => o.type === 'fight' && o.oppId && c.F(o.oppId));
    if(idx >= 0 && !c.G.nextFight){ c.acceptFight(idx); continue; }
    c.doWeek('box');
    if(!c.G.nextFight && !c.G.offers.length) c.makeOffers();
  }
  c.saveGame(true);
  guarda(h, '02-antes-primera-pelea', { semana: c.G.week, campamento: !!c.G.camp, peleas: c.G.player.rec.w + c.G.player.rec.l });
}

/* c) mitad de carrera */
{
  const h = H.boot({ seed: 902 });
  H.startCareer(h, { metaSeed: 90003, style: 'wrest', style2: 'boxer', div: 'LW', age: 20 });
  const c = h.ctx;
  let hecho = false;
  for(let bloque = 0; bloque < 30 && !hecho; bloque++){
    A.correrCarrera(h, { maxWeeks: 10, politica: 'basica', seedPolitica: 902 });
    const p = c.G.player;
    if((p.rec.w + p.rec.l) >= 10){
      c.saveGame(true); guarda(h, '03-mitad-carrera', { semana: c.G.week, año: c.G.year, rec: { ...p.rec } });
      hecho = true;
    }
  }
  if(!hecho) log('   AVISO: no se alcanzo "mitad de carrera"');
}

/* d) con titulo — configuracion tomada de una carrera de sim que lo consigue */
{
  const cfg = { seed: 1029, metaSeed: 729651, style: 'sw', style2: 'kick', div: 'LW', age: 21, pers: 'charisma' };
  const h = H.boot({ seed: cfg.seed });
  H.startCareer(h, cfg);
  const c = h.ctx;
  /* UNA sola llamada: el autopiloto reinicia su RNG de politica en cada
     invocacion, asi que trocear la carrera en bloques produce otra carrera. */
  A.correrCarrera(h, { maxWeeks: 150, politica: 'basica', seedPolitica: cfg.seed });
  if(Number(c.G.player.titles) > 0){
    c.saveGame(true);
    guarda(h, '04-con-titulo', { semana: c.G.week, año: c.G.year,
      titulos: c.G.player.titles, rec: { ...c.G.player.rec } });
  } else {
    log('   AVISO: no se alcanzo "con titulo" — fixture no generada');
  }
}

/* e) retirado
   El jugador se crea con retireAge 99: NO se retira por edad, el retiro es una
   decision suya. La fixture se produce ejerciendo esa decision, como en el
   juego (boton "retirarse"), no forzando el campo.                           */
{
  const h = H.boot({ seed: 903 });
  H.startCareer(h, { metaSeed: 90004, style: 'boxer', style2: 'wrest', div: 'WW', age: 26 });
  const c = h.ctx;
  for(let bloque = 0; bloque < 25; bloque++)
    A.correrCarrera(h, { maxWeeks: 10, politica: 'basica', seedPolitica: 903 });
  const antes = { rec: { ...c.G.player.rec }, semana: c.G.week, año: c.G.year };
  c.retire();
  if(c.G.player.retired){
    c.saveGame(true);
    guarda(h, '05-retirado', { ...antes, retirado: true, edad: c.G.year - c.G.player.born });
  } else {
    log('   AVISO: retire() no dejo al jugador retirado — fixture no generada');
  }
}
fs.writeFileSync(path.join(FIXTURES, 'INDEX.json'), JSON.stringify(fixtures, null, 2));

/* ---------- 4. sim de referencia ---------- */
log('[4/4] simulacion de referencia…');
const simN = arg('sim-n', '60'), simW = arg('sim-weeks', '150');
execFileSync(process.execPath, [path.join(DIR, 'sim.js'), '--n', simN, '--weeks', simW,
  '--out', path.join(BASE, 'sim.json')], { stdio: 'inherit' });

fs.writeFileSync(path.join(BASE, 'RESUMEN.json'), JSON.stringify({
  generado: new Date().toISOString(),
  trazas: resumenTrazas, fixtures, sim: { n: +simN, weeks: +simW },
}, null, 2));
log('\nlinea base regenerada.');
