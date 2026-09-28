'use strict';
/* FASE 14 — EL MUNDO EXISTE SIN EL JUGADOR
   ---------------------------------------------------------------------------
   dev/mundo-sim.js deja avanzar el mundo con un jugador que no hace nada y
   comprueba los invariantes del mundo (dev/invariants.js, sistema 'mundo')
   DESPUÉS DE CADA SEMANA y la legalidad de cada pelea del mundo en el momento.
   Además: el rival comprometido, el agente libre de punta a punta, los
   reemplazos, los retiros, los clones del plantel real, determinismo y
   guardar/cargar del mundo.                                                 */
const { suite, test, ok, eq } = require('../run-tests.js');
const H = require('../harness.js');
const A = require('../autopilot.js');
const M = require('../mundo-sim.js');
const INV = require('../invariants.js');

const ARCHIVO = process.env.CAGE_FILE || undefined;
const PISO = { 1: 5, 2: 6, 3: 6 };

/* por organización y división: activos (sin el jugador) */
function censo(c){
  const t = {};
  for(const f of Object.values(c.G.fighters)){
    if(f.isPlayer || !f.active || f.retired || !f.org) continue;
    t[f.org] = t[f.org] || {}; t[f.org][f.div] = (t[f.org][f.div] || 0) + 1;
  }
  return t;
}

suite('MUNDO-14 · el mundo avanza solo', () => {
  test('150 semanas sin jugador: peleas, campeones, retiros y debutantes, con los invariantes del mundo cada semana', () => {
    const flojas = [];
    const S = M.simular({ seed: 101, semanas: 150, file: ARCHIVO, alPaso: (c) => {
      if(c.G.week !== 1) return;                       /* recién pasado el año: la reposición ya corrió */
      const t = censo(c);
      for(const o in c.G.orgs) for(const d of c.DIVKEYS){ const n = (t[o] || {})[d] || 0; if(n < PISO[c.G.orgs[o].tier]) flojas.push(c.G.year + ' ' + o + '/' + d + ' con ' + n); }
    } });
    eq(S.fallos, [], 'invariantes del mundo rotos');
    eq(S.fallosPelea, [], 'peleas del mundo imposibles (retirados, otra organización, otra división)');
    eq(S.titulosDobles, 0, 'coronaciones que sumaron más de un título');
    ok(S.peleas >= S.semanas * 3, 'el mundo casi no pelea: ' + S.peleas + ' en ' + S.semanas + ' semanas');
    ok(S.peleasPorSemana.slice(10).every((n, i, a) => i < 3 || n + a[i - 1] + a[i - 2] + a[i - 3] > 0), 'hay cuatro semanas seguidas sin una sola pelea');
    ok(S.cambiosCampeon > 20 && S.retiros > 0 && S.debutantes > 0, 'el mundo no cambia: campeones ' + S.cambiosCampeon + ', retiros ' + S.retiros + ', debutantes ' + S.debutantes);
    eq(flojas, [], 'divisiones por debajo del tamaño con que nació el mundo después del cambio de año');
  });

  test('600 semanas sin jugador: no se congela — Vanguard sigue viva y ningún título queda vacante más de dos años', () => {
    const vac = {}, largas = [], flojasVAN = [];
    const S = M.simular({ seed: 118, semanas: 600, file: ARCHIVO, alPaso: (c) => {
      for(const o in c.G.champs) if(c.G.orgs[o].tier >= 2) for(const d of c.DIVKEYS){
        const k = o + '/' + d;
        if(!c.G.champs[o][d]){ vac[k] = (vac[k] || 0) + 1; if(vac[k] === 105) largas.push(k); } else vac[k] = 0;
      }
      if(c.G.week === 1){ const t = censo(c).VAN || {}; for(const d of c.DIVKEYS) if((t[d] || 0) < 6) flojasVAN.push(c.G.year + ' ' + d + ':' + (t[d] || 0)); }
    } });
    eq(S.fallos, [], 'invariantes del mundo rotos');
    eq(S.fallosPelea, [], 'peleas del mundo imposibles');
    eq(S.titulosDobles, 0, 'coronaciones que sumaron más de un título');
    eq(largas, [], 'títulos vacantes más de dos años');
    eq(flojasVAN, [], 'divisiones de Vanguard por debajo de 6 después del cambio de año');
    ok(S.activos >= 275, 'el mundo se vació: ' + S.activos + ' activos');
  });

  test('determinismo: misma semilla, mismo mundo; otra semilla, otro mundo igual de válido', () => {
    const a = M.simular({ seed: 135, semanas: 200, file: ARCHIVO }), b = M.simular({ seed: 135, semanas: 200, file: ARCHIVO });
    eq(a.huella, b.huella, 'la misma semilla dio dos mundos distintos');
    const d = M.simular({ seed: 136, semanas: 200, file: ARCHIVO });
    ok(d.huella !== a.huella, 'otra semilla dio el mismo mundo');
    eq(d.fallos.concat(d.fallosPelea), [], 'la otra semilla rompe invariantes');
  });

  test('guardar a mitad y seguir en un arranque nuevo da el mismo mundo que no haber guardado', () => {
    let disco = null, sid = null;
    const x = M.simular({ seed: 152, semanas: 200, file: ARCHIVO, alPaso: (c, w) => { if(w === 100){ c.saveGame(true); sid = c.G.saveId; disco = new Map(c.localStorage.__map); } } });
    const h = H.boot({ seed: 152, file: ARCHIVO, storage: disco }); const c = h.ctx;
    ok(c.loadGame(sid), 'no cargó');
    for(let w = 0; w < 100; w++){ c.G.pending.length = 0; c.G.offers = []; c.G.cash = 1e8; c.advanceWeek(); c.G.pending.length = 0; }
    eq(c.STATE.fingerprint(true), x.huella, 'el mundo cargado se separó del que siguió sin guardar');
  });
});

suite('MUNDO-14 · emparejamiento, agentes libres, reemplazos y retiros', () => {
  test('el rival comprometido con el jugador no pelea en otra cartelera durante el campamento', () => {
    const h = H.boot({ seed: 7100, file: ARCHIVO }); H.startCareer(h, { metaSeed: 21300, style: 'mma', div: 'LW', age: 22 }); const c = h.ctx;
    const casos = []; let firmas = 0;
    c.hookOn('fight:scheduled', 'p26', () => { firmas++; }, 99);
    c.hookOn('result:applied', 'p26', (x) => {
      const nf = c.G.nextFight; if(!nf || !x.a || !x.b || x.a.isPlayer || x.b.isPlayer) return;
      if(x.a.id === nf.oppId || x.b.id === nf.oppId) casos.push(c.G.year + 's' + c.G.week + ' ' + nf.oppId);
    }, 1);
    A.correrCarrera(h, { maxWeeks: 260, politica: 'basica', seedPolitica: 71 });
    ok(firmas >= 15, 'muy pocas peleas firmadas para medir: ' + firmas);
    eq(casos, [], 'el rival firmado peleó otra pelea antes');
  });

  test('agente libre → «acepto lo que sea» → pelea amateur → resultado → récord (B-3 no vuelve)', () => {
    const h = H.boot({ seed: 31, file: ARCHIVO }); H.startCareer(h, { metaSeed: 3131, style: 'mma', div: 'LW', age: 22 }); const c = h.ctx, p = c.G.player;
    eq(p.org, null, 'el caso no aplica: el jugador ya tiene organización');
    c.G.flags.clTakeAny = 1; c.makeOffers();
    const i = c.G.offers.findIndex(o => o && o.type === 'fight');
    ok(i >= 0, 'el agente libre pidió cualquier pelea y no apareció ninguna');
    const o = c.G.offers[i];
    eq(o.org, null, 'la pelea del agente libre no es amateur');
    eq(c.fightSpecProblem(o), '', 'la regla rechaza la pelea amateur');
    eq(c.G.flags.clTakeAny, 0, 'el pedido no se consumió');
    const rival = c.F(o.oppId);
    ok(rival.div === p.div && rival.active && !rival.retired && !rival.inj, 'el rival amateur no está disponible');
    ok(c.acceptFight(i), 'no se pudo firmar la pelea amateur');
    c.G.camp.i = c.G.camp.weeks; const r0 = p.rec.w + p.rec.l + p.rec.d, carrera0 = p.career.length;
    c.goFight(); ok(c.G.fight, 'la pelea amateur no empezó');
    c.finishFight('ko', 'p'); c.confirmFight(); c.go('hub');
    eq(p.rec.w + p.rec.l + p.rec.d, r0 + 1, 'el resultado no entró en el récord');
    eq(p.career.length, carrera0 + 1, 'la pelea no quedó en la carrera');
    eq(p.org, null, 'pelear amateur le dio una organización');
    ok(!c.G.nextFight && !c.G.fight, 'la pelea amateur quedó abierta');
    eq(INV.checkInvariants(c.G, c.UI, {}) || [], [], 'invariantes rotos después de la pelea amateur');
  });

  test('reemplazo: el rival se lesiona, entra otro de la misma división y organización, queda en la memoria, y el lesionado vuelve a estar disponible', () => {
    const h = H.boot({ seed: 1313, file: ARCHIVO }); H.startCareer(h, { metaSeed: 131301, style: 'mma', div: 'LW', age: 23 }); const c = h.ctx;
    for(let i = 0; i < 40 && !(c.G.player.org && c.G.player.rec.w + c.G.player.rec.l >= 6); i++) A.correrCarrera(h, { maxWeeks: 4, politica: 'basica', seedPolitica: 13 + i });
    c.G.pending.length = 0; c.cancelScheduledFight('prueba'); c.G.player.inj = null; c.G.player.injWeeks = 0;
    const p = c.G.player;
    const rival = Object.values(c.G.fighters).find(f => f && !f.isPlayer && f.org === p.org && f.div === p.div && f.active && !f.retired && !f.inj && c.proFightCount(f) >= 5 && !c.fightSpecProblem({ oppId: f.id, org: p.org }));
    ok(rival, 'no hay rival para la prueba');
    ok(c.scheduleFight({ oppId: rival.id, org: p.org, weeks: 6 }, 'prueba').ok, 'no se pudo firmar');
    c.startCamp(c.G.nextFight);
    const mem0 = (c.G.story.memories || []).length, hist0 = (c.G.replacementHistory || []).length;
    rival.inj = 'lesión'; rival.injWeeks = 8;
    const r = c.reconcileScheduledFight('prueba');
    const nf = c.G.nextFight;
    ok(r.changed && nf && nf.oppId !== rival.id, 'no hubo reemplazo: ' + JSON.stringify(r));
    const nuevo = c.F(nf.oppId);
    ok(nuevo.div === p.div && nuevo.org === p.org && nuevo.active && !nuevo.inj, 'el reemplazo no es de la misma división y organización o no está disponible');
    eq(c.fightSpecProblem(nf), '', 'la pelea con el reemplazo no pasa la regla');
    eq((c.G.replacementHistory || []).length, hist0 + 1, 'el reemplazo no quedó en el historial');
    ok((c.G.story.memories || []).length > mem0 && c.G.story.memories.some(m => m && /replacement/.test(JSON.stringify(m))), 'el reemplazo no quedó en la memoria');
    ok(c.G.camp && c.G.camp.oppId === nuevo.id, 'el campamento no se rehízo contra el reemplazo');
    rival.inj = null; rival.injWeeks = 0;
    c.cancelScheduledFight('prueba');
    eq(c.fightSpecProblem({ oppId: rival.id, org: p.org }), '', 'el reemplazado quedó bloqueado para pelear después');
  });

  test('retiro: sale de rankings, cinturones y carteleras, y los campeones retirados conservan su historia', () => {
    const retiradosConTitulo = new Set();
    const S = M.simular({ seed: 169, semanas: 300, file: ARCHIVO, alPaso: (c) => {
      for(const f of Object.values(c.G.fighters)) if(f.retired && f.titles > 0) retiradosConTitulo.add(f.id);
    } });
    const c = S.h.ctx;
    ok(S.retiros > 20, 'casi no hubo retiros: ' + S.retiros);
    eq(S.fallos.concat(S.fallosPelea), [], 'un retirado quedó en un ranking, un cinturón o una pelea');
    const perdidos = [...retiradosConTitulo].filter(id => !c.G.fighters[id] || !c.G.fighters[id].rec);
    eq(perdidos, [], 'campeones retirados cuya historia se borró');
  });
});

suite('MUNDO-14 · ascensos entre organizaciones', () => {
  test('un NPC que asciende de organización llega a la poda del año ya rankeado donde está, y fuera de donde estaba', () => {
    const h = H.boot({ seed: 1717, file: ARCHIVO }); H.startCareer(h, { metaSeed: 171701, style: 'mma', div: 'LW', age: 22 }); const c = h.ctx;
    A.correrCarrera(h, { maxWeeks: 30, politica: 'basica', seedPolitica: 17 });
    const f = Object.values(c.G.fighters).find(x => x && !x.isPlayer && x.org === 'TFC' && x.active && !x.retired);
    ok(f, 'no hay un peleador de TFC para la prueba');
    const org0 = f.org, fallos = [];
    const poda = c.pruneWorld;
    c.pruneWorld = function(){
      /* la poda decide con rankOf: el ranking tiene que estar al día al entrar */
      for(const x of (INV.checkInvariants(c.G, c.UI, {}) || [])) if(/^mundo\.(rankings|rosters|campeones)$/.test(x.id)) fallos.push(x.causa);
      return poda.apply(this, arguments);
    };
    const prepara = () => { f.streak = 5; for(const k in f.st) f.st[k] = 95; f.pop = 5; f.inj = null; f.injWeeks = 0; f.born = c.G.year - 25; f.retireAge = 60; };
    for(let i = 0; i < 40 && f.org === org0 && c.G.fighters[f.id]; i++){ prepara(); c.yearTick([]); }
    c.pruneWorld = poda;
    ok(c.G.fighters[f.id], 'el peleador desapareció');
    eq(f.org, 'VAN', 'en 40 años no ascendió: el caso no aplica');
    eq(fallos, [], 'al entrar a la poda el ranking todavía no reflejaba el ascenso');
    ok(c.rankOf(f), 'el que ascendió no quedó rankeado en su organización nueva');
  });
});

suite('MUNDO-14 · identidad', () => {
  test('ningún peleador real existe dos veces, empiece la carrera el año que empiece', () => {
    const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const malos = [];
    for(const year of [2009, 2012, 2016, 2020, 2023, 2026]){
      const h = H.boot({ seed: 3, file: ARCHIVO }); H.startCareer(h, { metaSeed: 777, style: 'mma', div: 'LW', age: 22, year }); const c = h.ctx;
      const by = {};
      for(const f of Object.values(c.G.fighters)) if(!f.isPlayer && f.org === 'VAN'){ const k = norm(f.name) + '|' + f.born; (by[k] = by[k] || []).push(f.div); }
      for(const k in by) if(by[k].length > 1) malos.push(year + ': ' + k + ' en ' + by[k].join('/'));
    }
    eq(malos, [], 'el plantel real tiene clones');
  });
  test('un nombre, una persona: ni el mundo recién creado ni los que llegan después repiten nombre', () => {
    /* antes: 25-31 nombres repetidos a las 600 semanas (400 combinaciones de nombres
       femeninos) y dos «Mei Ferrer» del mismo año activas en Vanguard */
    const repetidos = (c) => { const m = {}; for(const f of Object.values(c.G.fighters)) m[f.name] = (m[f.name] || 0) + 1; return Object.keys(m).filter(n => m[n] > 1); };
    const h = H.boot({ seed: 3, file: ARCHIVO }); H.startCareer(h, { metaSeed: 777, style: 'mma', div: 'LW', age: 22 }); const c = h.ctx;
    eq(repetidos(c), [], 'el mundo nace con nombres repetidos');
    /* las divisiones femeninas son las que agotan la lista: se llenan a mano, como lo hacen
       los prospectos, la reposición y el emparejamiento del jugador */
    const fem = c.DIVKEYS.filter(d => c.DIVS[d].f === 1);
    ok(fem.length, 'no hay divisiones femeninas');
    for(let i = 0; i < 120; i++){ const f = c.randNamedFighter(fem[i % fem.length], c.G.year, 50, 80); f.org = 'RFL'; c.G.fighters[f.id] = f; }
    eq(repetidos(c), [], 'los peleadores nuevos repiten nombres');
  });
});

/* ------------------------------------------------------------------
   Lo que la regresión de la fase encontró fuera del mundo: el mundo nuevo
   cambió el azar de las pruebas viejas y sacó a la luz dos fallas que ya
   estaban. Se fijan con el resultado forzado, no con una semilla que las
   encuentre de casualidad.
   ------------------------------------------------------------------ */
suite('MUNDO-14 · hallazgos de la regresión', () => {
  function firmado(seed){
    const h = H.boot({ seed, file: ARCHIVO });
    H.startCareer(h, { metaSeed: 2468, style: 'mma', div: 'LW', age: 22 });
    const c = h.ctx, p = c.G.player;
    const co = c.G.offers.find(o => o.type === 'contract' && c.G.orgs[o.org]);
    ok(co, 'no hubo oferta de contrato');
    c.negoStart(co); c.negoClose(); c.G.mg = null; c.UI.screen = 'hub';
    const opp = Object.values(c.G.fighters).find(f => f && f.div === p.div && f.id !== p.id && !f.retired && !c.fightSpecProblem({ oppId: f.id, org: p.org }));
    c.G.nextFight = { oppId: opp.id, weeks: 0, org: p.org, title: false, purse: 5000, event: 'T' };
    c.startCamp(c.G.nextFight); c.G.camp.i = c.G.camp.weeks;
    return c;
  }
  /* pelea real hasta el final; `veredicto` puede fijar el resultado de los jueces antes de cobrar */
  function pelear(c, veredicto){
    c.goFight();
    let g = 0;
    while(c.G.fight && !c.G.fight.over && g++ < 600){ const o = c.fightOptions(); if(!o.length){ c.finishFight('dec', null); break; } c.fightAct(o[0].k); }
    if(veredicto) veredicto(c.G.fight.result);
    c.confirmFight();
  }
  const empate = (r) => { r.winner = 'd'; r.method = 'dec'; r.draw = true; };
  const victoria = (r) => { r.winner = 'p'; r.method = 'dec'; r.draw = false; };

  test('contrato: el empate también consume una pelea; la victoria, una; fuera del contrato, ninguna', () => {
    for(const [nombre, veredicto] of [['empate', empate], ['victoria', victoria]]){
      const c = firmado(55), antes = c.G.contract.left, d0 = c.G.player.rec.d, w0 = c.G.player.rec.w;
      ok(antes >= 2, 'contrato demasiado corto: ' + antes);
      pelear(c, veredicto);
      ok(nombre === 'empate' ? c.G.player.rec.d === d0 + 1 : c.G.player.rec.w === w0 + 1, 'la pelea no terminó en ' + nombre);
      eq(c.G.contract.left, antes - 1, 'un ' + nombre + ' bajo contrato descontó ' + (antes - c.G.contract.left));
    }
    const c = firmado(56), otra = Object.keys(c.G.orgs).find(o => o !== c.G.player.org);
    c.G.contract.org = otra; const antes = c.G.contract.left;
    pelear(c, empate);
    eq(c.G.contract.left, antes, 'un empate de otra organización consumió el contrato');
  });

  test('conferencia: una respuesta de tono carismático no borra popularidad, reputación ni hype', () => {
    const c = firmado(12), p = c.G.player;
    const q = c.PRESSQ.find(x => x.o.some(o => o[1] === 'charisma'));
    ok(q, 'el banco ya no tiene respuestas carismáticas: la prueba no aplica');
    p.pop = 40; p.rep = 30; p.hype = 20;
    c.G.camp.oppId = c.G.nextFight.oppId;
    c.pressStart();
    c.G.mg.qs = [q, q, q, q];                      /* las cuatro, la respuesta carismática */
    const i = q.o.findIndex(o => o[1] === 'charisma');
    for(let k = 0; k < 4; k++) c.pressPick(i);
    ok(c.G.mg.done, 'la conferencia no terminó');
    ok(Number.isFinite(c.G.mg.pop) && Number.isFinite(c.G.mg.heat) && Number.isFinite(c.G.mg.resp), 'la conferencia quedó con NaN: ' + [c.G.mg.pop, c.G.mg.heat, c.G.mg.resp]);
    eq([p.pop, p.rep, p.hype], [40, 30, 20], 'una respuesta sin fila en las tablas movió (o borró) popularidad, reputación o hype');
    ok(!/NaN/.test(c.G.mg.result), 'el resumen dice NaN: ' + c.G.mg.result);
  });

  test('ex entrenador enfrente: el bono de lectura es +12 exacto, también con medio punto de adaptación', () => {
    /* RPG-7 falló cuando el mundo nuevo puso enfrente a un rival con adaptación 51,5:
       safeInt la redondeaba antes de sumar y el bono daba +12,5 */
    const c = firmado(13), o = c.F(c.G.nextFight.oppId);
    const ex = c.G.coaches.find(x => x.id !== c.G.player.coach);
    o.coach = ex.id; c.G.rpg.prevCoaches = [{ id: ex.id, at: 1 }];
    c.goFight();
    ok(c.G.fight && c.G.fight.exCoach === ex.id, 'la pelea no registra al ex entrenador');
    const bono = (c.HOOKS['fight:start'] || []).find(x => x.id === 'exEntrenador');
    ok(bono, 'no está el gancho del ex entrenador');
    for(const base of [51.5, 60, 82.5]){
      c.G.fight.identity.adaptation = base; bono.fn({});
      eq(c.G.fight.identity.adaptation, Math.min(95, base + 12), 'con adaptación ' + base + ' el bono no es +12');
    }
  });
});
