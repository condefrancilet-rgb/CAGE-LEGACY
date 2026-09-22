#!/usr/bin/env node
'use strict';
/* dev/sim.js — simulacion masiva de carreras, sin UI, determinista por semilla.
   Paraleliza con worker_threads (modulo nativo; I2).
     node dev/sim.js --n 200 --weeks 200 --out dev/baseline/sim.json
   Opciones: --n carreras · --weeks semanas · --politica basica|fija|aleatoria
             --workers N · --out archivo · --io (incluye serializacion del save) */

const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads');

/* ---------- una carrera ---------- */
function unaCarrera(cfg){
  const H = require(path.join(__dirname, 'harness.js'));
  const A = require(path.join(__dirname, 'autopilot.js'));
  const h = H.boot({ seed: cfg.seed, file: cfg.file });
  /* saveSerialize solo produce la cadena que va a localStorage: no toca el
     mundo (savePrune y normalizeWorldState, que si lo tocan, siguen corriendo).
     Verificado: la huella del estado es identica con y sin esta sustitucion.  */
  if(!cfg.io) h.ctx.saveSerialize = function(){ return '{}'; };

  H.startCareer(h, { metaSeed: cfg.metaSeed, year: cfg.year, div: cfg.div,
                     style: cfg.style, style2: cfg.style2, age: cfg.age, pers: cfg.pers });
  const estiloInicial = h.G.player.style;
  const edadDebut = h.G.year - h.G.player.born;
  const t0 = Date.now();
  let err = null, r = { semanas: 0, peleas: 0, eventos: 0 };
  try { r = A.correrCarrera(h, { maxWeeks: cfg.weeks, politica: cfg.politica, seedPolitica: cfg.seed }); }
  catch(e){ err = String(e && e.message || e); }
  const ms = Date.now() - t0;

  const G = h.G, p = G.player;
  const car = Array.isArray(p.career) ? p.career : [];
  const metodos = { ko:0, sub:0, dec:0, otro:0 };
  let victorias = 0, derrotas = 0;
  for(const f of car){
    const m = String(f.method || f.m || '').toLowerCase();
    if(m.includes('ko') || m === 'tko') metodos.ko++;
    else if(m.includes('sub')) metodos.sub++;
    else if(m.includes('dec')) metodos.dec++;
    else metodos.otro++;
    if(f.res === 'W') victorias++; else if(f.res === 'L') derrotas++;
  }
  return {
    seed: cfg.seed, ms, err,
    semanas: r.semanas, peleasJugadas: r.peleas, eventos: r.eventos,
    estilo: estiloInicial, edadDebut, edadFinal: G.year - p.born,
    retirado: !!p.retired,
    rec: { w: p.rec.w, l: p.rec.l, d: p.rec.d },
    ko: p.rec.ko, sub: p.rec.sub, dec: p.rec.dec,
    kol: p.rec.kol, subl: p.rec.subl, decl: p.rec.decl,
    victorias, derrotas, nPeleasCarrera: car.length, metodos,
    cash: num(G.cash), careerEarn: num(G.careerEarn),
    pop: num(p.pop), rep: num(p.rep),
    titulos: num(p.titles), defensas: num(p.defenses),
    bestRank: p.bestRank === undefined ? null : p.bestRank,
    org: p.org || null, div: p.div,
    lesionado: !!p.inj, weeksIdle: num(p.weeksIdle),
    /* tamanos de estructuras que podrian crecer sin limite */
    tam: { fighters: Object.keys(G.fighters || {}).length, news: len(G.news), feed: len(G.feed),
           hist: len(G.hist), career: car.length, retiredList: len(G.retiredList),
           pending: len(G.pending), memPlayer: len(p.mem) },
    fp: safe(() => h.call('STATE.fingerprint', true)),
    invariantes: chequeaInvariantes(h),
  };
}
const num = v => (typeof v === 'number' && isFinite(v)) ? Math.round(v * 100) / 100 : (v === undefined ? null : String(v));
const len = a => Array.isArray(a) ? a.length : 0;
const safe = f => { try { return f(); } catch(e){ return null; } };

/* Invariantes baratos, evaluados al final de la carrera (F20 los ampliara). */
function chequeaInvariantes(h){
  const G = h.G, p = G.player, fallos = [];
  const numMal = (v, n) => { if(typeof v !== 'number' || !isFinite(v)) fallos.push(n + ' no numerico: ' + v); };
  numMal(G.cash, 'cash'); numMal(p.pop, 'pop'); numMal(p.rep, 'rep'); numMal(p.fatigue, 'fatigue');
  if(p.rec.w < 0 || p.rec.l < 0 || p.rec.d < 0) fallos.push('record negativo');
  if(G.week < 1 || G.week > 52) fallos.push('semana fuera de rango: ' + G.week);
  for(const k in (p.st || {})) numMal(p.st[k], 'st.' + k);
  /* rankings: sin NaN, sin posiciones duplicadas, sin referencias rotas */
  for(const org in (G.rank || {})) for(const div in G.rank[org]){
    const r = G.rank[org][div];
    if(!Array.isArray(r)) { fallos.push('rank ' + org + '/' + div + ' no es array'); continue; }
    if(new Set(r).size !== r.length) fallos.push('rank ' + org + '/' + div + ' con duplicados');
    for(const id of r) if(id && !G.fighters[id]) { fallos.push('rank ' + org + '/' + div + ' referencia rota: ' + id); break; }
  }
  if(G.nextFight && !G.fighters[G.nextFight.oppId]) fallos.push('nextFight apunta a rival inexistente');
  if(p.retired && (G.nextFight || G.camp)) fallos.push('retirado con pelea o campamento activos');
  return fallos;
}

/* ---------- worker ---------- */
if(!isMainThread){
  const res = workerData.trabajos.map(unaCarrera);
  parentPort.postMessage(res);
}

/* ---------- main ---------- */
function arg(n, def){ const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i+1] : def; }
function flag(n){ return process.argv.includes('--' + n); }

async function main(){
  const n        = parseInt(arg('n', '100'), 10);
  const weeks    = parseInt(arg('weeks', '200'), 10);
  const politica = arg('politica', 'basica');
  const workers  = Math.max(1, Math.min(parseInt(arg('workers', String(os.cpus().length)), 10), n));
  const out      = arg('out', null);
  const io       = flag('io');
  /* --file permite medir OTRA version del archivo (p. ej. una copia congelada
     de antes de un arreglo) sin tocar el arbol de trabajo. */
  const file     = arg('file', null);

  /* Se varia estilo, division, edad y personalidad para que las metricas por
     estilo y por division sean representativas. La eleccion es determinista:
     depende solo del indice de la carrera.                                   */
  const ESTILOS = ['boxer','kick','muay','wrest','bjj','mma','counter','press','out','sw'];
  const DIVS    = ['FLY','BAN','FEA','LW','WW','MW','LHW','HW'];
  const PERSONAS= ['humble','arrogant','quiet','charisma','aggro','funny','pro','chaos'];
  const trabajos = [];
  for(let i = 0; i < n; i++){
    const estilo = ESTILOS[i % ESTILOS.length];
    let segundo = ESTILOS[(i * 3 + 1) % ESTILOS.length];
    if(segundo === estilo) segundo = ESTILOS[(i * 3 + 2) % ESTILOS.length];
    trabajos.push({ seed: 1000 + i, metaSeed: 500000 + i * 7919, weeks, politica, io, file,
      style: estilo, style2: segundo,
      div: DIVS[Math.floor(i / ESTILOS.length) % DIVS.length],
      age: 20 + (i % 7),
      pers: PERSONAS[i % PERSONAS.length] });
  }

  const lotes = Array.from({ length: workers }, () => []);
  trabajos.forEach((t, i) => lotes[i % workers].push(t));

  const t0 = Date.now();
  process.stderr.write(`sim: ${n} carreras · ${weeks} semanas · politica ${politica} · ${workers} workers\n`);
  const resultados = (await Promise.all(lotes.map(lote => new Promise((res, rej) => {
    const w = new Worker(__filename, { workerData: { trabajos: lote } });
    w.on('message', res); w.on('error', rej);
    w.on('exit', c => { if(c !== 0) rej(new Error('worker salio con ' + c)); });
  })))).flat();
  const ms = Date.now() - t0;

  const informe = resumen(resultados, { n, weeks, politica, io, ms });
  if(out){
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify({ config: informe.config, resumen: informe.resumen, carreras: resultados }, null, 1));
    process.stderr.write('escrito ' + out + '\n');
  }
  console.log(informe.tabla);
}

/* ---------- agregacion ---------- */
function resumen(rs, cfg){
  const ok = rs.filter(r => !r.err);
  const errs = rs.filter(r => r.err);
  const media = (f) => { const v = ok.map(f).filter(x => typeof x === 'number' && isFinite(x)); return v.length ? v.reduce((a,b)=>a+b,0)/v.length : null; };
  const suma  = (f) => ok.reduce((a,r) => a + (Number(f(r)) || 0), 0);
  const pct   = (a, b) => b ? +(a / b * 100).toFixed(1) : 0;

  const vict = suma(r => r.rec.w), der = suma(r => r.rec.l), emp = suma(r => r.rec.d);
  const totalPeleas = vict + der + emp;
  const ko = suma(r => r.ko) + suma(r => r.kol);
  const sub = suma(r => r.sub) + suma(r => r.subl);
  const dec = suma(r => r.dec) + suma(r => r.decl);
  const clasificadas = ko + sub + dec;

  const porEstilo = {};
  for(const r of ok){
    const e = r.estilo || '?';
    porEstilo[e] = porEstilo[e] || { n:0, w:0, l:0, titulos:0 };
    porEstilo[e].n++; porEstilo[e].w += r.rec.w; porEstilo[e].l += r.rec.l; porEstilo[e].titulos += Number(r.titulos)||0;
  }

  const fallos = [];
  for(const r of ok) for(const f of (r.invariantes||[])) fallos.push({ seed: r.seed, fallo: f });

  const res = {
    carreras: rs.length, ok: ok.length, conError: errs.length,
    msTotal: cfg.ms, msPorCarrera: Math.round(cfg.ms / Math.max(1, rs.length)),
    msPorSemana: +(cfg.ms / Math.max(1, suma(r => r.semanas))).toFixed(2),
    peleasTotales: totalPeleas,
    peleasPorCarrera: +(totalPeleas / Math.max(1, ok.length)).toFixed(2),
    winRate: pct(vict, totalPeleas),
    finalizaciones: pct(ko + sub, clasificadas),
    pctKO: pct(ko, clasificadas), pctSub: pct(sub, clasificadas), pctDec: pct(dec, clasificadas),
    edadDebut: r2(media(r => r.edadDebut)), edadFinal: r2(media(r => r.edadFinal)),
    retirados: pct(ok.filter(r => r.retirado).length, ok.length),
    campeones: pct(ok.filter(r => Number(r.titulos) > 0).length, ok.length),
    titulosMedia: r2(media(r => Number(r.titulos))), defensasMedia: r2(media(r => Number(r.defensas))),
    cashMedia: r2(media(r => Number(r.cash))), cashMax: Math.max(...ok.map(r => Number(r.cash) || 0)),
    earnMedia: r2(media(r => Number(r.careerEarn))),
    popMedia: r2(media(r => Number(r.pop))),
    tamMedio: { news: r2(media(r => r.tam.news)), feed: r2(media(r => r.tam.feed)),
                hist: r2(media(r => r.tam.hist)), career: r2(media(r => r.tam.career)),
                fighters: r2(media(r => r.tam.fighters)), retiredList: r2(media(r => r.tam.retiredList)) },
    porEstilo, fallosInvariantes: fallos.length, detalleFallos: fallos.slice(0, 40),
    errores: errs.slice(0, 10).map(e => ({ seed: e.seed, err: e.err })),
  };

  const L = [];
  L.push(`carreras            ${res.ok}/${res.carreras}  (errores: ${res.conError})`);
  L.push(`tiempo              ${res.msTotal} ms · ${res.msPorCarrera} ms/carrera · ${res.msPorSemana} ms/semana`);
  L.push(`peleas              ${res.peleasTotales}  (${res.peleasPorCarrera}/carrera)`);
  L.push(`win rate            ${res.winRate}%`);
  L.push(`finalizaciones      ${res.finalizaciones}%   (KO ${res.pctKO}% · SUB ${res.pctSub}% · DEC ${res.pctDec}%)`);
  L.push(`edad debut/final    ${res.edadDebut} / ${res.edadFinal}`);
  L.push(`retirados           ${res.retirados}%    campeones ${res.campeones}%`);
  L.push(`dinero medio/max    ${res.cashMedia} / ${res.cashMax}   ganado ${res.earnMedia}`);
  L.push(`popularidad media   ${res.popMedia}`);
  L.push(`tam. medio news/feed/hist/career  ${res.tamMedio.news}/${res.tamMedio.feed}/${res.tamMedio.hist}/${res.tamMedio.career}`);
  L.push(`fallos de invariante ${res.fallosInvariantes}`);
  if(res.detalleFallos.length){ L.push('  primeros:'); res.detalleFallos.slice(0,8).forEach(f => L.push(`   seed ${f.seed}: ${f.fallo}`)); }
  if(res.errores.length){ L.push('  errores:'); res.errores.forEach(e => L.push(`   seed ${e.seed}: ${e.err}`)); }
  L.push('');
  L.push('por estilo inicial:');
  for(const [e, v] of Object.entries(porEstilo).sort())
    L.push(`  ${e.padEnd(10)} n=${String(v.n).padStart(3)}  W-L ${v.w}-${v.l}  winrate ${pct(v.w, v.w+v.l)}%  titulos ${v.titulos}`);

  return { config: cfg, resumen: res, tabla: L.join('\n') };
}
const r2 = v => v === null ? null : Math.round(v * 100) / 100;

if(isMainThread && require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = { unaCarrera, chequeaInvariantes };
