'use strict';
/* RPG · FASES 6 y 7 — EL CAMPAMENTO PREGUNTA, EL MUNDO RECUERDA
   ---------------------------------------------------------------------------
   Cada momento del campamento tiene que nacer de su estado real (una semana
   de sparring, el desgaste, un plan distinto del que pide el entrenador) y su
   costo tiene que llegar a la pelea. Las eras salen de los cinturones que
   cambian de mano; las decisiones que vuelven, de ecos que ya existían.     */
const { suite, test, ok, eq } = require('../run-tests.js');
const H = require('../harness.js');

const ARCHIVO = process.env.CAGE_FILE || undefined;

function carrera(seed, cfg){
  const h = H.boot({ seed, file: ARCHIVO });
  H.startCareer(h, Object.assign({ metaSeed: 9700 + seed, style:'mma', div:'LW', age:22 }, cfg||{}));
  return h;
}
function conContrato(c){
  const co = c.G.offers.find(o => o.type === 'contract' && c.G.orgs[o.org]);
  c.negoStart(co); c.negoClose(); c.G.mg = null; c.UI.screen = 'hub';
}
function rival(c){
  const p = c.G.player;
  return Object.values(c.G.fighters).find(f => f && !f.isPlayer && f.div === p.div &&
    !c.fightSpecProblem({ oppId: f.id, org: p.org }));
}
function enCamp(c, semanas){
  const o = rival(c); ok(o, 'sin rival válido');
  ok(c.scheduleFight({ oppId: o.id, org: c.G.player.org, weeks: semanas || 8, title: false, purse: 5000, event: 'T' }, 'prueba').ok, 'no se firmó');
  ok(c.startCamp(c.G.nextFight), 'no arrancó el camp');
  c.G.pending = [];
  return o;
}
const pendiente = (c, h) => c.G.pending.find(e => e.h === h);
function resolver(c, h, idx){
  const i = c.G.pending.findIndex(e => e.h === h); ok(i >= 0, 'no hay evento ' + h);
  const e = c.G.pending.splice(i, 1)[0]; c.G.pending.unshift(e);
  c.resolveEvent(idx);
}

suite('RPG-6 · el campamento pregunta, con costos reales', () => {
  test('una semana de sparring muestra la tendencia REAL del rival, y trabajarla llega a la pelea', () => {
    const c = carrera(1).ctx; conContrato(c); const o = enCamp(c);
    /* la tendencia se calcula acá, con los pesos del motor, sin pasar por la
       capa de información: la situación donde es más perceptible con la
       confianza del sparring (media: sólo marcada o clara) */
    ok(!(c.G.story && c.G.story.npcSeeds && c.G.story.npcSeeds[o.id]), 'la prueba supone un rival sin arquetipo sembrado');
    const LEG = { stand: 7, gbot: 5 }, RANGO = { marcada: 3, clara: 2 };
    const B = c.CL.styleAt(o); let t = null;
    for(const [lab, b, x] of [['de pie, cómodo', 'stand', { pos: 'stand', gap: 0 }], ['de pie y sin aire', 'stand:c', { pos: 'stand', gap: 0, tired: true }],
                              ['más cerca de lo que quiere', 'stand:e', { pos: 'stand', gap: 0.6 }], ['arriba tuyo', 'gbot', { pos: 'gbot', gap: 0 }]]){
      const w = c.CL.oppWeightsFor(o, Object.assign({ B, hurt: false, winning: false, tired: false, pHp: 100, pStam: 100, last: false }, x));
      const tot = w.reduce((a, e) => a + e[1], 0), r = w.slice().sort((a, e) => e[1] - a[1]);
      const ratio = r[0][1] / tot * LEG[x.pos], marg = r[0][1] / r[1][1];
      const band = (ratio >= 2.2 && marg >= 1.5) ? 'marcada' : (ratio >= 1.6 && marg >= 1.2) ? 'clara' : null;
      if(band && (!t || RANGO[band] > RANGO[t.band])) t = { lab, b, a: r[0][0], band };
    }
    ok(t, 'este rival no tiene ninguna tendencia perceptible en el sparring (la prueba necesita una)');
    c.campWeek('spar', .9, 0);
    const e = pendiente(c, 'camp_spar'); ok(e, 'la semana de sparring no dejó el momento');
    ok(e.txt.indexOf(t.lab + ', ') > 0 && e.txt.indexOf(c.CMB.n(t.a)) > 0, 'lo que muestra no es la tendencia del motor (' + t.lab + ' / ' + t.a + '): ' + e.txt);
    ok(!/\d/.test(e.txt.replace(c.fname(o), '')), 'el sparring muestra números internos: ' + e.txt);
    const s0 = c.G.camp.sharp, f0 = c.G.camp.fatigue;
    resolver(c, 'camp_spar', 0);
    eq(c.G.camp.sharp, Math.min(100, s0 + 4), 'trabajarlo no afila'); eq(c.G.camp.fatigue, Math.min(100, f0 + 6), 'trabajarlo no cansa');
    ok(c.scoutReport(o).some(l => l.indexOf('Sparring:') === 0 && l.indexOf('trabajado') > 0), 'el informe no lo registra');
    c.G.camp.i = c.G.camp.weeks; c.goFight(); c.UI.sub = null;
    const f = c.G.fight; ok(f.iq.camp && f.iq.camp.b === t.b && f.iq.camp.drill, 'la pelea no trae lo trabajado');
    /* en esa situación se lee 10 puntos mejor que sin haberlo trabajado */
    c.CMB.bucket = () => t.b;
    const L1 = c.CMB.level().L; f.iq.camp = null;
    ok(Math.abs(L1 - c.CMB.level().L - 10) < 1e-9, 'lo trabajado no suma lectura en esa situación');
  });
  test('el desgaste alto obliga a decidir: descargar o apretar cambian lo que llega a la pelea', () => {
    for(const [idx, dFat, dSharp] of [[0, -15, -3], [1, 8, 5]]){
      const c = carrera(2).ctx; conContrato(c); enCamp(c);
      c.G.camp.fatigue = 70;
      c.campWeek('box', .85, 0);
      ok(pendiente(c, 'camp_load'), 'con desgaste alto no aparece la decisión');
      const f0 = c.G.camp.fatigue, s0 = c.G.camp.sharp, pf0 = c.G.player.fatigue;
      resolver(c, 'camp_load', idx);
      eq(Math.round(c.G.camp.fatigue - f0), dFat, 'desgaste mal aplicado (opción ' + idx + ')');
      eq(Math.round(c.G.camp.sharp - s0), dSharp, 'afilado mal aplicado (opción ' + idx + ')');
      if(idx === 1) ok(c.G.player.fatigue > pf0, 'apretar no sube la fatiga que lee el riesgo de lesión');
    }
  });
  test('"lo que diga el coach" hace lo que dice SU filosofía', () => {
    for(const [ph, apreta] of [['grind', true], ['technique', false]]){
      const c = carrera(3).ctx; conContrato(c); enCamp(c);
      const coach = c.coachById(c.G.player.coach);
      c.CL.coachState(coach).ph = ph;
      const pat0 = c.CL.coachState(coach).patience;
      c.G.camp.fatigue = 70; c.campWeek('box', .85, 0);
      const f0 = c.G.camp.fatigue; resolver(c, 'camp_load', 2);
      ok(apreta ? c.G.camp.fatigue > f0 : c.G.camp.fatigue < f0, ph + ': no hizo lo que su filosofía pide');
      ok(c.CL.coachState(coach).patience > pat0, 'hacerle caso no sube su paciencia');
    }
  });
  test('tu plan contra el de tu entrenador: lo que elijas es el plan que entra a la jaula', () => {
    for(const idx of [0, 1]){
      const c = carrera(4).ctx; conContrato(c); enCamp(c, 8);
      const coach = c.coachById(c.G.player.coach), ph = c.COACH_PHIL[coach.spec] || c.COACH_PHIL.mma;
      const otro = ['striking','counter','wrestling','clinch','grappling'].find(x => x !== ph.prio);
      c.G.camp.gameplan = { prio: otro, dist: 'media', pace: 'medio', score: 5 };
      c.G.camp.i = 4; c.campWeek('box', .85, 0);
      ok(pendiente(c, 'camp_split'), 'no aparece el desacuerdo con el plan');
      const pat0 = c.CL.coachState(coach).patience;
      resolver(c, 'camp_split', idx);
      c.G.pending = []; c.G.camp.i = c.G.camp.weeks; c.goFight();
      eq(c.G.fight.gp.prio, idx === 0 ? ph.prio : otro, 'el plan de la pelea no es el elegido');
      ok(idx === 0 ? c.CL.coachState(coach).patience > pat0 : c.CL.coachState(coach).patience < pat0, 'la paciencia del coach no refleja la decisión');
      if(idx === 1) eq(c.RPG.echoCount('plan_own'), 1, 'mantener tu plan no dejó eco');
    }
  });
  test('con el camp de equipo aparece la tercera vía y el plan unificado es el que pelea', () => {
    const c = carrera(5).ctx; conContrato(c); enCamp(c, 8);
    c.G.flags.teamCamp = 1;
    if(c.team().filter(Boolean).length < 2) c.G.team = [c.G.player.coach, c.G.coaches.find(x => x.id !== c.G.player.coach).id];
    const coach = c.coachById(c.G.player.coach), ph = c.COACH_PHIL[coach.spec] || c.COACH_PHIL.mma;
    const otro = ['striking','counter','wrestling','clinch','grappling'].find(x => x !== ph.prio);
    c.G.camp.gameplan = { prio: otro, dist: 'larga', pace: 'bajo', score: 5 };
    c.G.camp.i = 4; c.campWeek('box', .85, 0);
    const e = pendiente(c, 'camp_split'); ok(e, 'no aparece el desacuerdo');
    if(c.team().filter(Boolean).length >= 2){
      eq(e.opts.length, 3, 'con el camp de equipo falta la tercera vía');
      resolver(c, 'camp_split', 2);
      c.G.pending = []; c.G.camp.i = c.G.camp.weeks; c.goFight();
      eq([c.G.fight.gp.prio, c.G.fight.gp.dist], [ph.prio, 'larga'], 'la pelea no usa el plan unificado');
    }
  });
  test('a lo sumo un momento por semana, y cada uno una vez por campamento', () => {
    const c = carrera(6).ctx; conContrato(c); enCamp(c, 10);
    c.G.camp.fatigue = 70;
    c.campWeek('spar', .9, 0);
    eq(c.G.pending.filter(e => /^camp_/.test(e.h)).length, 1, 'dos momentos en la misma semana');
    c.G.pending = []; c.campWeek('spar', .9, 0);
    ok(!pendiente(c, 'camp_spar'), 'el sparring pregunta dos veces en el mismo campamento');
  });
});

suite('RPG-6 · un momento rechazado no se pierde', () => {
  test('si la cola de eventos no lo admite, el momento queda para otra semana', () => {
    const c = carrera(7).ctx; conContrato(c); enCamp(c, 10);
    const orig = c.eventContextAllows;
    c.eventContextAllows = () => false;
    c.campWeek('spar', .9, 0);
    c.eventContextAllows = orig;
    ok(!pendiente(c, 'camp_spar'), 'la prueba no logró que la cola lo rechace');
    ok(!(c.G.camp.beats && c.G.camp.beats.spar), 'el momento se dio por usado sin haberse preguntado');
    c.G.pending = []; c.campWeek('spar', .9, 0);
    ok(pendiente(c, 'camp_spar'), 'la semana siguiente no volvió a aparecer');
  });
});

suite('RPG-7 · el mundo recuerda', () => {
  test('terminar un reinado de 3+ defensas es terminar una era, y el mundo lo cuenta', () => {
    const c = carrera(10).ctx; conContrato(c);
    const p = c.G.player, org = p.org, div = p.div;
    const o = rival(c);
    c.G.champs[org][div] = o.id; o.defenses = 0; o.titles = 1;
    c.ERA.tick();
    o.defenses = 4; c.G.week += 30;
    c.ERA.tick();
    const now = c.ERA.now(org, div); ok(now && now.def === 4, 'la era vigente no cuenta sus defensas');
    c.UI.screen = 'mundo';
    ok(c.scrMundo().indexOf('es una era') >= 0, 'Mundo no muestra la era vigente');
    c.G.champs[org][div] = p.id; c.G.week += 1;
    c.ERA.tick();
    const h = c.G.rpg.era.hist[org + '|' + div];
    ok(h && h[0].id === o.id && h[0].def === 4 && h[0].by === p.id, 'no quedó registrada la era ni quién la terminó');
    ok(c.G.news.some(n => n.t.indexOf('le puso fin a la era de') >= 0), 'no es noticia');
    eq(c.G.rpg.eraEnds, 1, 'no cuenta para el legado');
    c.UI.screen = 'diario'; c.render();
    ok(c.document.getElementById('app').innerHTML.indexOf('👑 Terminaste la era de') >= 0, 'el diario no lo cuenta');
  });
  test('un reinado corto no es una era', () => {
    const c = carrera(11).ctx; conContrato(c);
    const p = c.G.player, org = p.org, div = p.div, o = rival(c);
    c.G.champs[org][div] = o.id; o.titles = 1; o.defenses = 0; c.ERA.tick();
    o.defenses = 1; c.G.week += 5; c.G.champs[org][div] = p.id; c.ERA.tick();
    eq((c.G.rpg.era.hist[org + '|' + div] || []).length, 0, 'un reinado de una defensa quedó como era');
    eq(c.G.rpg.eraEnds, 0, 'contó como fin de era');
  });
  test('el gimnasio que dejaste vuelve: alguien de ahí te cruza, y lo que hagas queda en la relación', () => {
    const c = carrera(12).ctx; conContrato(c);
    const p = c.G.player, viejo = p.gym;
    const nuevo = c.G.gyms.find(g => g.id !== viejo).id;
    c.RPG.S().gym = viejo; p.gym = nuevo; c.G.pending = [];
    c.hookEmit('week', {});
    ok(c.G.rpg.prevGyms.some(g => g.id === viejo), 'dejar el gimnasio no quedó anotado');
    const mate = Object.values(c.G.fighters).find(f => f && !f.isPlayer && f.gym === viejo && !f.retired && f.active);
    ok(mate, 'no hay nadie en el viejo gimnasio para la prueba');
    c.G.rpg.prevGyms[0].at = c.RPG.stamp() - 25; c.G.pending = []; c.G.camp = null;
    c.hookEmit('week', {});
    const e = pendiente(c, 'eco_exgym'); ok(e, 'el gimnasio que dejaste no volvió');
    const f = c.F(e.data.id); ok(f && f.gym === viejo, 'quien aparece no es de tu viejo gimnasio');
    const riv0 = (f.rel && f.rel.rivalry) || 0;
    resolver(c, 'eco_exgym', 1);
    ok(f.rel.rivalry > riv0, 'darle la espalda no sube la rivalidad');
    ok(f.mem.some(m => m.t.indexOf('sin saludarte') >= 0), 'no queda en su memoria');
  });
  test('el entrenador que dejaste, en la esquina de enfrente, te lee antes', () => {
    const pelea = (dejado) => {
      const c = carrera(13).ctx; conContrato(c); const o = enCamp(c);
      const ex = c.G.coaches.find(x => x.id !== c.G.player.coach);
      o.coach = ex.id;
      if(dejado) c.G.rpg.prevCoaches = [{ id: ex.id, at: 1 }];
      const scout = c.scoutReport(o);
      c.G.camp.i = c.G.camp.weeks; c.goFight();
      ok(c.G.fight && c.G.fight.opp === o.id, 'no arrancó la pelea');
      return { c, ex, scout, f: c.G.fight };
    };
    const sin = pelea(false), con = pelea(true);
    ok(!sin.f.exCoach && sin.scout.every(l => l.indexOf('que te entrenó') < 0), 'sin haberlo dejado ya cuenta como ex entrenador');
    eq(con.f.exCoach, con.ex.id, 'la pelea no sabe que tu ex entrenador está enfrente');
    eq(con.f.identity.adaptation, Math.min(95, sin.f.identity.adaptation + 12), 'no te lee antes');
    ok(con.f.log.some(l => l.indexOf('Te entrenó') >= 0), 'la pelea no lo cuenta');
    ok(con.scout.some(l => l.indexOf(con.ex.name + ', que te entrenó') >= 0), 'el scouting no lo advierte');
  });
  test('la ficha de un rival muestra en qué punto del ciclo está la rivalidad', () => {
    const c = carrera(14).ctx; conContrato(c);
    const o = rival(c);
    c.G.player.career.push({ oppId: o.id, res: 'W', m: 'KO', y: 2016 }, { oppId: o.id, res: 'L', m: 'dec', y: 2017 });
    c.UI.screen = 'fighter'; c.UI.sub = o.id;
    const h = c.scrFighter();
    ok(h.indexOf('⚔️ Rivalidad') >= 0 && h.indexOf('1-1') >= 0 && h.indexOf('trilogía') >= 0, 'la ficha no muestra el ciclo');
  });
  test('Mundo y la ficha de un rival se dibujan sin escribir', () => {
    const c = carrera(15).ctx; conContrato(c);
    const o = rival(c);
    c.ERA.tick();
    c.UI.screen = 'mundo'; c.scrMundo(); c.UI.sub = o.id; c.scrFighter();
    const rs = c.G.rs, antes = JSON.stringify(c.G);
    c.scrMundo(); c.scrFighter();
    eq(c.G.rs, rs, 'dibujar movió el RNG'); eq(JSON.stringify(c.G), antes, 'dibujar cambió el estado');
  });
});
