'use strict';
/* RPG · FASE 5 — LA PELEA SE LEE, SE RECUERDA Y ENSEÑA
   ---------------------------------------------------------------------------
   La regla de esta fase: nada de patrones inventados. Lo que la lectura
   muestra tiene que ser lo que el motor va a hacer, y eso se comprueba
   sorteando al rival miles de veces con la misma cadena de filtros que usa la
   pelea. El bono de anticipar sólo existe si el rival hace de verdad lo
   predicho. La memoria, las lecciones, la maestría y las Ultimates se prueban
   por la vía real (fight:applied, applyTrain, TQ.use/TQ.resolve).            */
const { suite, test, ok, eq } = require('../run-tests.js');
const H = require('../harness.js');

const ARCHIVO = process.env.CAGE_FILE || undefined;

function carrera(seed, cfg){
  const h = H.boot({ seed, file: ARCHIVO });
  H.startCareer(h, Object.assign({ metaSeed: 9500 + seed, style:'mma', div:'LW', age:22 }, cfg||{}));
  return h;
}
function conContrato(c){
  const co = c.G.offers.find(o => o.type === 'contract' && c.G.orgs[o.org]);
  c.negoStart(co); c.negoClose(); c.G.mg = null; c.UI.screen = 'hub';
}
function rival(c, id){
  const p = c.G.player;
  if(id) return c.G.fighters[id];
  return Object.values(c.G.fighters).find(f => f && !f.isPlayer && f.div === p.div &&
    !c.fightSpecProblem({ oppId: f.id, org: p.org }));
}
function aLaJaula(c, oppId){
  const o = rival(c, oppId); ok(o, 'sin rival válido');
  ok(c.scheduleFight({ oppId: o.id, org: c.G.player.org, weeks: 8, title: false, purse: 5000, event: 'T' }, 'prueba').ok, 'no se firmó');
  ok(c.startCamp(c.G.nextFight), 'no arrancó el camp');
  c.G.camp.i = c.G.camp.weeks; c.goFight();
  ok(c.G.fight && c.G.fight.iq, 'la pelea no tiene estado de lectura');
  c.UI.sub = null;
  return o;
}
function terminar(c, gana){
  if(c.G.fight && !c.G.fight.over) c.finishFight('ko', gana ? 'p' : 'o');
  c.confirmFight(); c.G.pending = [];
}
/* sorteo del rival con LA MISMA cadena de filtros que usa oppAction() */
function muestrear(c, n){
  const cnt = {};
  for(let i = 0; i < n; i++){
    const a = c.hookFilter('combat:oppPick', 'jab', { base: 'jab' });
    cnt[a] = (cnt[a] || 0) + 1;
  }
  c.G.fight.iq._b = null;
  for(const k in cnt) cnt[k] /= n;
  return cnt;
}
/* especificación de la prominencia (capa de información, fase 9): la primera
   acción contra lo parejo de su posición y contra la segunda */
const LEGAL = { stand: 7, clinch: 4, gbot: 5, gtop: 4 };
function bandaSpec(d, pos){
  const r = Object.entries(d).sort((a, b) => b[1] - a[1]);
  const ratio = r[0][1] * LEGAL[pos], marg = r[1] ? r[0][1] / r[1][1] : 9;
  const band = (ratio >= 2.2 && marg >= 1.5) ? 'marcada' : (ratio >= 1.6 && marg >= 1.2) ? 'clara' : (ratio >= 1.2 && marg >= 1.05) ? 'leve' : 'ninguna';
  return { top: r[0][0], band };
}
function pesosNorm(w){ const t = w.reduce((a, e) => a + e[1], 0); const d = {}; w.forEach(e => { d[e[0]] = (d[e[0]] || 0) + e[1] / t; }); return d; }
function parecido(c, emp, dist, tol, que){
  for(const k of new Set([...Object.keys(emp), ...Object.keys(dist)])){
    const d = Math.abs((emp[k] || 0) - (dist[k] || 0));
    ok(d <= tol, que + ': ' + k + ' muestreado ' + (emp[k] || 0).toFixed(3) + ' vs mostrado ' + (dist[k] || 0).toFixed(3));
  }
}

suite('RPG-5 · la lectura muestra lo que el rival va a hacer de verdad', () => {
  test('la distribución que se muestra es la que sale de sortear al rival (de pie, fresco)', () => {
    const c = carrera(1).ctx; conContrato(c); aLaJaula(c);
    const dist = JSON.parse(JSON.stringify(c.CMB.dist()));
    parecido(c, muestrear(c, 6000), dist, 0.025, 'de pie');
  });
  test('también cuando su identidad ya te leyó (regla de adaptación armada)', () => {
    const c = carrera(2).ctx; conContrato(c); aLaJaula(c);
    const f = c.G.fight;
    f.identity.adaptation = 85; f.identity.playerPatterns.combo = 3; f._lastPlayerAction = 'combo';
    ok(c.CL.oppRules().some(r => r.k === 'adapt' && r.to[0] === 'counter'), 'la regla de adaptación no está armada');
    const dist = JSON.parse(JSON.stringify(c.CMB.dist()));
    ok(dist.counter > 0.3, 'la contra no domina la distribución con la regla armada: ' + dist.counter);
    parecido(c, muestrear(c, 6000), dist, 0.025, 'adaptado');
  });
  test('y en el suelo, con su arquetipo, sin acciones que no existan en esa posición', () => {
    for(const [pos, arq] of [['gbot','missile'], ['gtop','showman'], ['clinch','showman'], ['gbot','wall']]){
      const c = carrera(3).ctx; conContrato(c); aLaJaula(c);
      const f = c.G.fight; f.pos = pos; f.round = 1; f.identity.archetype = arq;
      const emp = muestrear(c, 3000);
      const malas = Object.keys(emp).filter(a => !c.oppCanDo(pos, a));
      eq(malas, [], 'el rival eligió acciones imposibles ' + pos + '/' + arq);
      parecido(c, emp, JSON.parse(JSON.stringify(c.CMB.dist())), 0.03, pos + '/' + arq);
    }
  });
  test('cuánto se ve depende de cuánto lo leés, y anticipar sólo existe con lectura', () => {
    const c = carrera(4).ctx; conContrato(c); aLaJaula(c);
    const f = c.G.fight; f.pos = 'stand';
    c.G.player.st.fightiq = 50; f.cl.read = 0;
    eq(c.CMB.level().tier, 0, 'sin lectura el nivel no es 0');
    c.UI.screen = 'fight';
    let html = c.scrFight();
    ok(html.indexOf('Todavía no sabés qué va a hacer') >= 0, 'sin lectura el panel no lo dice');
    ok(c.fightOptions().every(o => o.k !== 'iq_x'), 'anticipar aparece sin lectura');
    c.G.player.st.fightiq = 95; f.cl.read = 100;
    eq(c.CMB.level().tier, 3, 'con lectura máxima el nivel no es 3');
    html = c.scrFight();
    const obs = c.CMB.read('vivo');
    ok(html.indexOf(c.esc(c.CMB.sayHead(obs))) >= 0, 'el panel no dice lo que lee la capa de información');
    ok(!/\d+\s*%/.test(c.CMB.panel()), 'el panel muestra porcentajes internos');
    /* anticipar existe sólo si la lectura deja percibir una tendencia con respuesta */
    const hay = !!(obs.top && c.CMB.RESP.stand[obs.top]);
    eq(c.fightOptions().some(o => o.k === 'iq_x'), hay, 'anticipar no depende de lo que se percibe');
  });
  test('anticipar: el bono existe sólo si el rival hace lo que predijiste', () => {
    for(const acierta of [true, false]){
      const c = carrera(5).ctx; conContrato(c); aLaJaula(c);
      const f = c.G.fight; f.pos = 'stand'; c.G.player.st.fightiq = 95; f.cl.read = 100;
      const g = c.CMB.guess(); ok(g, 'no hay lectura para anticipar');
      const otra = c.OPP_ACTS.stand.find(a => a !== g.pred);
      c.hookOn('combat:oppPick', '__fuerza', () => acierta ? g.pred : otra, 99);
      let delta = null;
      c.hookOn('exchange:pre', '__espia', () => {
        const con = c.hookFilter('combat:eff', 60, { f: c.G.player, keys: ['boxing'], side: 'p' });
        const r = f.iq.res; f.iq.res = null;
        const sin = c.hookFilter('combat:eff', 60, { f: c.G.player, keys: ['boxing'], side: 'p' });
        f.iq.res = r; delta = Math.round((con - sin) * 100) / 100;
      }, 50);
      c.fightAct('iq_x');
      c.hookOff('combat:oppPick', '__fuerza'); c.hookOff('exchange:pre', '__espia');
      eq(delta, acierta ? 8 : -3, 'la lectura no ' + (acierta ? 'premió el acierto' : 'cobró el error'));
      eq(acierta ? f.iq.hits : f.iq.miss, 1, 'no se contó ' + (acierta ? 'el acierto' : 'el error'));
      ok(f.log.some(l => l.indexOf(acierta ? 'Lo leíste' : 'Esperabas') >= 0), 'el registro de la pelea no lo cuenta');
    }
  });
  test('te avisa lo que el rival ya te leyó, con la regla exacta del motor', () => {
    const c = carrera(6).ctx; conContrato(c); aLaJaula(c);
    const f = c.G.fight; f.pos = 'stand'; f.identity.adaptation = 85; f.cl.read = 60;
    f.identity.playerPatterns.combo = 2;
    c.UI.screen = 'fight';
    ok(c.scrFight().indexOf('Ya te vio la combinación 2 veces') >= 0, 'no avisa que te está leyendo');
    c.fightAct('combo');
    if(!f.over) ok(c.CL.oppRules().some(r => r.k === 'adapt' && r.to[0] === 'counter'),
                   'a la tercera la regla del rival no se armó como decía el aviso');
  });
});

suite('RPG-5 · el rival se acuerda, y vos también', () => {
  test('después de pelear queda la memoria; en la revancha leés antes y él viene preparado', () => {
    const c = carrera(10).ctx; conContrato(c);
    const o = aLaJaula(c);
    for(let i = 0; i < 5 && !c.G.fight.over; i++){ c.UI.sub = null; c.fightAct('jab'); }
    terminar(c, true);
    const m = c.G.rpg.fm[o.id];
    ok(m && m.n === 1, 'no quedó memoria del rival');
    ok(Object.keys(m.obs).length > 0, 'no quedó lo que se le vio hacer');
    ok((m.pp.jab || 0) >= 4, 'no quedó lo que él te vio hacer: ' + JSON.stringify(m.pp));
    c.G.player.injWeeks = 0; c.G.player.inj = null;
    aLaJaula(c, o.id);
    const f = c.G.fight;
    ok(f.iq.mem, 'la revancha no sabe que ya lo peleaste');
    ok(Object.keys(f.iq.prior).length > 0, 'no se trae lo que ya le viste');
    ok((f.identity.playerPatterns.jab || 0) >= 2, 'el rival no viene esperando tu jab');
    ok(f.log.some(l => l.indexOf('Ya lo peleaste') >= 0), 'la pelea no cuenta que se conocen');
    const L1 = c.CMB.level().L; f.iq.mem = false;
    eq(Math.round(c.CMB.level().L * 10) / 10, Math.round((L1 - 10) * 10) / 10, 'la memoria no suma lectura');
  });
  test('lo que le castigaste leyéndolo, en la revancha lo hace la mitad', () => {
    const c = carrera(11).ctx; conContrato(c); aLaJaula(c);
    const f = c.G.fight; f.pos = 'stand';
    const b = c.CMB.bucket();
    const top = c.CMB.ranked(c.CMB.dist())[0].a;
    const antes = muestrear(c, 5000)[top] || 0;
    f.iq.sup[b] = top;
    const dist = JSON.parse(JSON.stringify(c.CMB.dist()));
    const emp = muestrear(c, 5000);
    ok(Math.abs((emp[top] || 0) - antes / 2) < 0.03, 'no lo redujo a la mitad: ' + antes + ' → ' + emp[top]);
    parecido(c, emp, dist, 0.03, 'con memoria');
  });
  test('el informe de scouting dice lo mismo que el motor, y lo que ya sabés de él', () => {
    const c = carrera(12).ctx; conContrato(c);
    const o = rival(c);
    c.G.flags.videoWall = 1; c.G.player.st.fightiq = 60;
    /* sin arquetipo conocido todavía, el video ve el estilo: los pesos puros */
    ok(!(c.G.story && c.G.story.npcSeeds && c.G.story.npcSeeds[o.id]), 'la prueba supone un rival sin arquetipo sembrado');
    const B = c.CL.styleAt(o);
    const d = pesosNorm(c.CL.oppWeightsFor(o, { pos: 'stand', gap: 0, B, hurt: false, winning: false, tired: false, pHp: 100, pStam: 100, last: false }));
    const esp = bandaSpec(d, 'stand');
    const linea = c.scoutReport(o).find(l => l.indexOf('Video, de pie, cómodo: ') === 0);
    ok(linea, 'el scouting con sala de video no dice nada de pie');
    if(esp.band !== 'ninguna') ok(linea.indexOf(c.CMB.n(esp.top)) > 0, 'el video no nombra la tendencia real (' + esp.top + '): ' + linea);
    else ok(linea.indexOf('está abierto') > 0, 'sin preferencia real, el video inventa una: ' + linea);
    ok(c.scoutReport(o).every(l => !/\d+\s*%/.test(l)), 'el scouting muestra porcentajes internos');
    c.G.rpg.fm[o.id] = { n: 2, res: 'L', obs: { stand: { td: 5, jab: 1 } }, pp: { combo: 9 }, ex: {}, tq: {}, ult: {} };
    const s = c.scoutReport(o).join(' ');
    ok(s.indexOf('Ya lo peleaste 2 veces') >= 0 && s.indexOf('casi siempre fue al derribo (lo viste 6 veces)') >= 0 && s.indexOf('la combinación') >= 0,
       'el scouting no usa la memoria: ' + s);
  });
});

suite('RPG-5 · las derrotas enseñan (sin regalar estadísticas)', () => {
  test('una derrota por derribos se explica con sus números y se convierte en trabajo', () => {
    const c = carrera(20).ctx; conContrato(c); aLaJaula(c);
    c.G.fight.o.td = 3; c.G.fight.iq.hurt = { gnp: 9 };
    terminar(c, false);
    const L = c.G.rpg.lastLoss;
    ok(L && L.k === 'derribos', 'la lección no sale de los números: ' + JSON.stringify(L));
    ok(L.facts.some(t => t.indexOf('Te derribó 3 veces') >= 0), 'no cuenta los derribos');
    c.UI.screen = 'fightresult';
    ok(c.scrFightResult().indexOf('Lo que te ganó la pelea') >= 0, 'la pantalla de resultado no la muestra');
    const st0 = JSON.stringify(c.G.player.st);
    ok(c.CMB.takeLesson(), 'no se pudo anotar');
    eq(JSON.stringify(c.G.player.st), st0, 'anotar la lección regaló estadísticas');
    const bono = (act) => { const mm = { act, intensity: 1, bonus: 0 }; c.hookEmit('train:adjust', mm); return mm.bonus; };
    const sinL = c.G.rpg.lesson; c.G.rpg.lesson = null; const b0 = bono('wrest'); c.G.rpg.lesson = sinL;
    const b1 = bono('wrest');
    ok(Math.abs(b1 - b0 - 0.12) < 1e-9, 'el wrestling no rinde más con la lección: ' + b0 + ' → ' + b1);
    const bb = bono('box'); c.G.rpg.lesson = null; const bb0 = bono('box'); c.G.rpg.lesson = sinL;
    eq(bb, bb0, 'la lección de derribos mejora otra cosa');
    for(let i = 0; i < 5; i++) bono('wrest');
    ok(c.G.rpg.lesson.learned && c.G.rpg.lesson.fixLeft === 3, 'seis sesiones no la dejan aprendida');
    ok(c.RPG.echoCount('lesson_learned') === 1, 'aprenderla no dejó eco');
  });
  test('ganar no deja lección; y una lección aprendida se nota al leer de pie', () => {
    const c = carrera(21).ctx; conContrato(c); aLaJaula(c);
    terminar(c, true);
    eq(c.G.rpg.lastLoss, null, 'una victoria dejó lección');
    c.G.rpg.lesson = { k: 'derribos', act: 'wrest', fix: 'stand', left: 0, learned: true, fixLeft: 3 };
    aLaJaula(c); c.G.fight.pos = 'stand';
    const L1 = c.CMB.level().L; c.G.rpg.lesson.fixLeft = 0;
    ok(Math.abs(L1 - c.CMB.level().L - 8) < 1e-9, 'la lección aprendida no suma lectura');
  });
});

suite('RPG-5 · maestría y Ultimates, desde el árbol que ya existía', () => {
  function conTecnica(c, id){ c.TQ.S().un[id] = 1; }
  test('la maestría se cuenta con la nota real y la firma se disimula', () => {
    const c = carrera(30).ctx; conContrato(c); aLaJaula(c);
    conTecnica(c, 's_low');
    for(let i = 0; i < 6; i++) c.hookEmit('tq:resolved', { id: 's_low', t: c.TQ.node('s_low'), grade: i < 4 ? 'good' : 'fail', q: .6 });
    eq(c.CMB.mastTier('s_low'), 1, '6 ejecuciones con 4 buenas no la dejan dominada');
    c.hookEmit('tq:resolved', { id: 's_low', t: c.TQ.node('s_low'), grade: 'good', q: .9 });
    eq(c.G.rpg.mast.s_low.x, 1, 'una ejecución perfecta resistida por el rival no cuenta como ejecución perfecta');
    c.G.tq.use.s_low = 30;
    const t = c.TQ.node('s_low'), r1 = c.TQ.resist(t);
    Object.assign(c.G.rpg.mast.s_low, { n: 14, p: 4 });
    const r2 = c.TQ.resist(t);
    ok(Math.abs((r1 - r2) - 0.045) < 1e-9, 'la firma no reduce la parte de "la tiene fichada": ' + r1 + ' → ' + r2);
    eq(c.TQ.grade(0.86), 'perfect', 'cambió la nota PERFECTA'); eq(c.TQ.grade(0.5), 'good', 'cambió la nota BUENA');
  });
  test('una L4 usada de verdad despierta su Ultimate, con el sello de tu identidad', () => {
    const c = carrera(31).ctx; conContrato(c);
    conTecnica(c, 's_perf');
    c.G.rpg.mast.s_perf = { n: 8, p: 3, g: 3, f: 2, w: 1, x: 2 };
    eq(c.CMB.awaken(), [], 'despertó sin 3 ejecuciones perfectas');
    c.G.rpg.mast.s_perf.x = 3; c.G.rpg.ident.k = 'finalizador';
    eq(c.CMB.awaken(), ['s_perf'], 'no despertó con los requisitos');
    eq(c.G.rpg.ult.s_perf.v, 'espectaculo', 'el sello no sale de la identidad');
    ok(c.G.news.some(n => n.t.indexOf('Nace una técnica') >= 0), 'no es noticia');
    eq(c.CMB.awaken(), [], 'despierta dos veces');
    c.UI.screen = 'diario'; c.render();
    ok(c.document.getElementById('app').innerHTML.indexOf('✴ Ultimate: ⚡ TALÓN DEL VERDUGO') >= 0, 'el diario no la cuenta entre los momentos');
  });
  test('la Ultimate se ejecuta con TQ.use del mismo nodo: gasta su uso, una por pelea', () => {
    const c = carrera(32).ctx; conContrato(c); aLaJaula(c);
    conTecnica(c, 's_perf');
    const f = c.G.fight; f.pos = 'stand'; f.cl.dist = 1.5; f.p.stam = 100;
    c.UI.screen = 'fight';
    ok(c.scrFight().indexOf('ULTIMATE') < 0, 'hay botón de Ultimate sin haberla despertado');
    c.G.rpg.ult.s_perf = { v: 'pura', used: 0, landed: 0 };
    ok(c.CMB.ultState('s_perf').ok, 'con la técnica lista la Ultimate no está disponible: ' + c.CMB.ultState('s_perf').why);
    ok(c.scrFight().indexOf('ULTIMATE') >= 0, 'no aparece el botón');
    const u0 = f.tq && f.tq.u ? (f.tq.u.s_perf || 0) : 0;
    ok(c.CMB.ultUse('s_perf'), 'no se pudo usar');
    eq(f.tq.u.s_perf, u0 + 1, 'no gastó el uso de la técnica');
    /* el minijuego del motor FX se abrió: se termina por su vía real */
    ok(c.FX.S && c.FX.S.mg && c.FX.S.mg.diff === 4 && c.FX.S.key === 'tq_clutch', 'no abrió el clutch de dificultad 4');
    c.fxEnd(c.FX.S, 0.9); c.fxFinish();
    eq(c.G.rpg.ult.s_perf.used, 1, 'no se contó');
    ok(f.over || f.log.some(l => l.indexOf('TALÓN DEL VERDUGO') >= 0), 'no se resolvió como Ultimate: ' + f.log.slice(0, 3).join(' | '));
    ok(!c.CMB.ultState('s_perf').ok, 'se puede usar dos veces en la misma pelea');
    ok(!f.tq.ultReq && !f.tq.ultLive, 'quedó armada para la próxima técnica');
  });
  test('un rival que ya te la vio la resiste más', () => {
    const c = carrera(33).ctx; conContrato(c); const o = aLaJaula(c);
    const t = c.TQ.node('s_head'), r1 = c.TQ.resist(t);
    c.G.rpg.fm[o.id] = { n: 2, obs: {}, pp: {}, ex: {}, tq: { s_head: 2 }, ult: {} };
    ok(Math.abs(c.TQ.resist(t) - Math.min(0.36, r1 + 0.08)) < 1e-9, 'la memoria del rival no suma resistencia');
  });
});

suite('RPG-5 · guardar no cambia el mundo', () => {
  test('un peleador que nace a mitad de carrera es igual al que vuelve de un guardado', () => {
    const c = carrera(41).ctx;
    const f = c.makeFighter({ div: c.G.player.div });
    ok(f.cl && Array.isArray(f.cl.arc) && f.cl.rel && typeof f.cl.rel === 'object',
       'nace sin f.cl y la carga se lo agrega: guardar y cargar cambia el mundo');
  });
});

suite('RPG-5 · dibujar la pelea no escribe', () => {
  test('la lectura, los avisos y la Ultimate se dibujan sin mover el RNG ni el estado', () => {
    const c = carrera(40).ctx; conContrato(c); aLaJaula(c);
    const f = c.G.fight; f.cl.read = 100; c.G.player.st.fightiq = 95; f.identity.adaptation = 85; f.identity.playerPatterns.jab = 2;
    c.TQ.S().un.s_perf = 1; c.G.rpg.ult.s_perf = { v: 'pura' }; f.cl.dist = 1.5;
    /* sólo las inicializaciones perezosas que ya existían (estado de técnicas
       y contexto de distancia): después de eso, ni el PRIMER dibujado escribe */
    c.TQ.fs(); c.CL.fightCtx();
    c.UI.screen = 'fight';
    const rs = c.G.rs, antes = JSON.stringify(c.G);
    c.scrFight(); c.fightOptions(); c.scoutReport(c.F(f.opp)); c.scrFight();
    eq(c.G.rs, rs, 'dibujar movió el RNG');
    eq(JSON.stringify(c.G), antes, 'dibujar cambió el estado');
  });
});
