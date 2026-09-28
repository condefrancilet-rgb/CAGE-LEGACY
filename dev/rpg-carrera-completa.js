#!/usr/bin/env node
'use strict';
/* dev/rpg-carrera-completa.js — UNA CARRERA ENTERA, DEL DEBUT AL RETIRO
   ---------------------------------------------------------------------------
   dev/e5-largas.js avanza semanas sin pelear (sólo advanceWeek) y dev/sim.js
   comprueba las invariantes una vez al final. Ninguno de los dos ejercita lo
   que agregó la etapa RPG: el autopiloto no usa técnicas, no anticipa, no arma
   gameplan y no anota lecciones.
   Esto corre carreras completas (de los 21 a los 37 años, ~830 semanas) con
   una política que SÍ usa todo eso por la vía del jugador —TQ.use con su
   minijuego, «Anticipar», gpStart/gpConfirm, CMB.takeLesson, TQ.unlock—, y
   comprueba las invariantes DESPUÉS DE CADA SEMANA. Al retiro revisa que el
   final, el diario y el guardado estén enteros.
     node dev/rpg-carrera-completa.js [--n 3] [--file otra.html]            */
const H = require('./harness.js');
const A = require('./autopilot.js');
const INV = require('./invariants.js');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const N = parseInt(arg('n', '3'), 10);
const ARCHIVO = arg('file', null) || undefined;

/* política: la básica, más lo que haría un jugador que usa el juego entero */
A.POLITICAS.rpg = (ops, ctx) => {
  const c = ctx.c, f = c.G.fight;
  /* 1. una técnica del árbol lista (o su Ultimate): se ejecuta con su minijuego */
  if(!c.G.mg && c.UI.sub !== 'corner' && ctx.rnd() < 0.35){
    const ult = Object.keys(c.G.rpg.ult || {}).find(id => c.CMB.ultState(id).ok);
    const lista = c.TQ.available().filter(e => e.s.ok);
    if(ult || lista.length){
      if(ult) c.CMB.ultUse(ult); else c.TQ.use(lista[0].t.id);
      if(c.FX.S){ c.fxEnd(c.FX.S, 0.35 + ctx.rnd() * 0.65); c.fxFinish(); }
      if(!c.G.fight || c.G.fight.over) return null;
      ops = c.fightOptions();
    }
  }
  /* 2. anticipar, cuando la lectura lo permite y lo más probable pesa */
  const g = ops.find(o => o.k === 'iq_x') && c.CMB.guess();
  if(g && g.p >= 0.30 && ctx.rnd() < 0.7) return 'iq_x';
  return A.POLITICAS.basica(ops, ctx);
};

function semanaDeJugador(c, rnd){
  /* gameplan en la primera semana del campamento */
  if(c.G.camp && !c.G.camp.gameplan && c.G.camp.i >= 1 && !c.G.pending.length && !c.G.mg && c.G.nextFight && c.G.nextFight.weeks > 0){
    c.gpStart();
    const mg = c.G.mg;
    if(mg && mg.type === 'gp'){
      mg.dist = ['larga','media','corta'][Math.floor(rnd() * 3)];
      mg.pace = ['bajo','medio','alto'][Math.floor(rnd() * 3)];
      mg.prio = ['striking','counter','wrestling','clinch','grappling'][Math.floor(rnd() * 5)];
      mg.def = ['cabeza','derribo','reja'][Math.floor(rnd() * 3)];
      c.gpConfirm(); c.mgClose(true);
    } else if(c.G.mg) c.mgClose(false);
  }
  /* lección de la última derrota */
  if(c.G.rpg.lastLoss && rnd() < 0.8) c.CMB.takeLesson();
  /* asumir en público la filosofía de combate que muestran sus peleas (de vez en cuando) */
  if(!c.G.rpg.philo.fight && rnd() < 0.04 && c.RPG.canAdopt('fight').ok) c.RPG.adopt('fight');
  /* puntos de técnica: la más barata disponible */
  for(let k = 0; k < 3; k++){
    const t = c.TQ.T.filter(x => c.TQ.canUnlock(x.id).ok).sort((a, b) => a.cost - b.cost || a.lv - b.lv)[0];
    if(!t) break;
    c.TQ.unlock(t.id);
  }
  c.UI.screen = 'hub'; c.UI.tmp.tqNew = null;
}

/* fase 11: comprar y usar lo comprado, por la vía del jugador. Una compra por
   semana como mucho: la primera de la lista que todavía no tiene y para la que
   le sobra el doble del precio; la lista es fija (sin azar del juego). Y de vez en cuando lo que la compra promete cambiar: la
   conferencia de prensa, visitar otro gimnasio, invitar a entrenar. */
const DESEOS = ['nutri','cutman','stylist','masseur','pr','camera','lawyer','analyst','recoverylab','lightboard',
  'eg:apt','eg:villa','restaurant','eg:jet','mediahouse','documentary','eg:fund','ownGym','vault','eg:gym_upgrade','eg:estate','eg:academy'];
const EG11 = { apt: 'props', villa: 'props', estate: 'props', jet: 'vehicles', gym_upgrade: 'projects', academy: 'projects', fund: 'projects' };
function comprasDeJugador(c, rnd, k11){
  if(c.G.fight || c.G.mg || c.G.pending.length) return;
  const cash = c.G.cash;
  for(const w of DESEOS){
    if(w.startsWith('eg:')){
      const id = w.slice(3); if(c.egOwns(id)) continue;
      const precio = { apt: 150000, villa: 500000, estate: 1500000, jet: 750000, gym_upgrade: 350000, academy: 900000, fund: 250000 }[id];
      if(cash < 2 * precio) continue;
      if(c.egBuy(EG11[id], id) !== false) k11.compras.push(id);
      break;
    }
    const it = c.SHOP.find(x => x.id === w);
    if(c.shopOwned(w)) continue;                       /* una de cada una, también las repetibles */
    if(w === 'documentary' && !c.shopOwned('camera')) continue;
    if(cash < 2 * it.p) continue;
    if(c.shopCan(it)) continue;
    c.buyItem(w); k11.compras.push(w); c.G.socOut = null;
    break;
  }
  /* la conferencia de prensa del campamento */
  if(c.G.camp && !c.G.camp.pressDone && c.G.camp.i >= 2 && !c.G.mg && rnd() < 0.3){
    c.pressStart();
    for(let k = 0; k < 6 && c.G.mg && c.G.mg.type === 'press' && !c.G.mg.done; k++) c.pressPick(Math.floor(rnd() * 4));
    if(c.G.mg) c.mgClose(false);
  }
  /* fuera del campamento: una visita a otro gimnasio o una invitación a entrenar */
  if(!c.G.camp && !c.G.nextFight && !c.G.mg && !c.G.pending.length){
    const x = rnd();
    if(x < 0.06){ const g = c.G.gyms.find(y => y.id !== c.G.player.gym && c.G.cash > 3 * c.travelCost(y).money); if(g){ c.gymVisit(g.id); k11.visitas++; if(c.egOwns('jet')) k11.jet++; } }
    else if(x < 0.18){ const f = Object.values(c.G.fighters).find(y => y && !y.isPlayer && y.active && !y.retired && !y.inj && y.div === c.G.player.div && !c.socWhyBlocked('train:' + y.id, { weight: c.SOC_W.MAYOR, actor: y.id, cat: 'gym' })); if(f){ c.socInvite(f.id); k11.invit++; if(/Vino a tu villa/.test((c.G.socOut || {}).t || '')) k11.villa++; } }
    c.G.socOut = null; c.UI.screen = 'hub';
  }
}

const t0 = Date.now();
let rotas = 0;
for(let i = 0; i < N; i++){
  const seed = 7100 + i * 31, metaSeed = 910000 + i * 7919;
  const h = H.boot({ seed, file: ARCHIVO }); const c = h.ctx;
  H.startCareer(h, { metaSeed, style: ['mma','boxer','wrest','bjj','muay'][i % 5], div: 'LW', age: 21 });
  let s = seed >>> 0; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  let semanas = 0, fallo = null;
  /* fase 10: ¿se llega a lo nuevo por la vía del jugador? (sólo cuenta) */
  const k10 = { espalda: 0, defensa: 0, heatOf: 0, heatFirmadas: 0, sparMem: 0, sparPlan: 0, heatMax: 0 };
  const k11 = { compras: [], estilista: 0, visitas: 0, jet: 0, invit: 0, villa: 0, docOf: 0, docFirm: 0, resto: 0 };
  c.hookOn('media:done', 'dev11', () => { if(c.G.mg && c.G.mg.styl) k11.estilista++; }, 99);
  c.hookOn('offers:made', 'dev11', () => { if((c.G.offers || []).some(o => o && o.docMade)) k11.docOf++; }, 101);
  c.hookOn('fight:accepted', 'dev11', (x) => { if(x && x.offer && x.offer.docMade) k11.docFirm++; }, 99);
  c.hookOn('camp:week:post', 'dev11', () => { if(c.G.camp && /restaurante/.test((c.G.camp.log || [])[0] || '')) k11.resto++; }, 99);
  c.hookOn('week', 'dev10', () => { k10.heatMax = Math.max(k10.heatMax, c.HEAT.v()); }, 99);
  c.hookOn('exchange:post', 'dev10', () => { if(c.TQ.back()) k10.espalda++; }, 1);
  c.hookOn('exchange:pre', 'dev10', (cx) => { const f = c.G.fight, X = c.GP_DEF_X; if(f && X && f.gp && f.gp.def && c.gpDefCovers(f.gp.def, X.pos, X.oa, X.pa)) k10.defensa++; }, 6);
  c.hookOn('offers:made', 'dev10', () => { (c.G.offers || []).forEach(o => { if(o && o.heatB) k10.heatOf++; }); }, 98);
  c.hookOn('fight:accepted', 'dev10', (x) => { if(x && x.offer && x.offer.heatB) k10.heatFirmadas++; }, 99);
  const _ask = c.CL.ask;
  c.CL.ask = function(h, txt, labels, data){ if(h === 'camp_spar'){ if(data && data.rem) k10.sparMem++; if(labels && labels.length > 2) k10.sparPlan++; } return _ask.apply(this, arguments); };
  const tc = Date.now();
  while(!c.G.player.retired && c.ageOf(c.G.player) < 37 && semanas < 1000){
    try {
      A.correrCarrera(h, { maxWeeks: 1, politica: 'rpg', seedPolitica: seed * 1000 + semanas });
      semanaDeJugador(c, rnd);
      comprasDeJugador(c, rnd, k11);
    } catch(e){ fallo = 'excepción en la semana ' + semanas + ': ' + e.message; break; }
    semanas++;
    const malas = INV.checkInvariants(c.G, c.UI, {}) || [];
    if(malas.length){ fallo = 'invariante en la semana ' + semanas + ': ' + JSON.stringify(malas[0]).slice(0, 160); break; }
  }
  const p = c.G.player, r = c.G.rpg;
  let fin = {};
  if(!fallo){
    if(!p.retired) c.retire();
    c.UI.screen = 'ending'; c.render();
    const endH = c.document.getElementById('app').innerHTML;
    c.UI.screen = 'diario'; c.render();
    const diaH = c.document.getElementById('app').innerHTML;
    const limpio = (x) => !/undefined|NaN/.test(x.replace(/onclick="[^"]*"/g, ''));
    const rpg0 = JSON.stringify(r);
    c.saveGame(true); const ok = c.loadGame(c.listSaves()[0].id);
    fin = {
      final: endH.indexOf('PERFIL DE CARRERA') >= 0 && limpio(endH),
      diario: ['Carrera','Identidad','Personas','Rivalidades','Momentos','Legado'].every(x => diaH.indexOf('<summary>' + x + '</summary>') >= 0) && limpio(diaH),
      guardado: ok && JSON.stringify(c.G.rpg) === rpg0,
      bytes: rpg0.length
    };
    if(!fin.final || !fin.diario || !fin.guardado) fallo = 'retiro: ' + JSON.stringify(fin);
  }
  if(fallo) rotas++;
  const mast = Object.entries(r.mast || {}).map(([k, m]) => k + ':' + m.n + '/' + m.p).join(' ');
  console.log('carrera ' + (i + 1) + ' · semilla ' + seed + ' · ' + semanas + ' semanas · ' + ((Date.now() - tc) / 1000).toFixed(0) + ' s' + (fallo ? '  ✗ ' + fallo : '  ✓'));
  console.log('   récord ' + p.rec.w + '-' + p.rec.l + '-' + p.rec.d + ' · títulos ' + p.titles + ' · defensas ' + p.defenses + ' · edad ' + c.ageOf(p) +
              ' · identidad ' + (r.ident && r.ident.k) + ' · rasgos ' + Object.keys(r.traits || {}).join(',') +
              ' · filosofía ' + JSON.stringify(r.philo && { f: r.philo.fight, c: r.philo.career }));
  console.log('   ' + Object.values(r.fm || {}).length + ' rivales en memoria · victorias leyendo ' + ((r.cnt && r.cnt.iqW) || 0) + ' · lecciones aprendidas ' + (r.lessons || []).length +
              ' · Ultimates ' + Object.keys(r.ult || {}).join(',') + ' · eras terminadas ' + (r.eraEnds || 0) + ' · técnicas ' + c.TQ.ownedAll());
  console.log('   maestría ' + (mast || '—') + (fin.bytes ? ' · G.rpg ' + (fin.bytes / 1024).toFixed(1) + ' KB' : ''));
  /* las etapas, de la historia guardada en cada relación (la memoria del mundo
     tiene tope de 100 y al retiro sólo conserva lo último) */
  const etapas = {};
  Object.values(c.G.fighters).forEach(f => ((f && f.bond && f.bond.rc && f.bond.rc.hist) || []).forEach(x => { etapas[x.k] = (etapas[x.k] || 0) + 1; }));
  const sellos = Object.keys(r.ult || {}).map(k => k + ':' + r.ult[k].v + '/' + (r.ult[k].src || '—')).join(' ');
  console.log('   fase 10 · intercambios con la espalda tomada ' + k10.espalda + ' · intercambios cubiertos por la defensa del plan ' + k10.defensa +
              ' · ruido máximo ' + k10.heatMax.toFixed(1) + ' · ofertas cobradas con ruido ' + k10.heatOf + ' (firmadas ' + k10.heatFirmadas + ') · sparring con memoria ' + k10.sparMem +
              ' · sparring que ofreció ajustar el plan ' + k10.sparPlan + ' · etapas de rivalidad ' + (JSON.stringify(etapas)) + ' · sellos ' + (sellos || '—'));
  console.log('   fase 11 · compras ' + k11.compras.length + ' (' + k11.compras.join(',') + ') · apariciones con estilista ' + k11.estilista + ' · visitas a otro gimnasio ' + k11.visitas + ' (con jet ' + k11.jet + ')' +
              ' · invitaciones a entrenar ' + k11.invit + ' (vinieron a la villa ' + k11.villa + ')' + ' · coestelares del documental ' + k11.docOf + ' (firmadas ' + k11.docFirm + ') · semanas de camp con el restaurante ' + k11.resto);
}
console.log('\n' + (N - rotas) + '/' + N + ' carreras completas sin fallos · invariantes cada semana (' + Object.keys(INV.SISTEMAS).length + ' sistemas) · ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
process.exit(rotas ? 1 : 0);
