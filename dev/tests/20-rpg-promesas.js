'use strict';
/* RPG · FASE 8 — LO QUE EL JUEGO PROMETÍA, AHORA PASA
   ---------------------------------------------------------------------------
   Seis respuestas de eventos anunciaban una consecuencia y sólo escribían una
   bandera que nadie leía (auditoría RPG, 2.3). Cada prueba parte de la bandera
   que el evento real escribe y comprueba la consecuencia por la vía que el
   juego ya tenía.                                                           */
const { suite, test, ok, eq } = require('../run-tests.js');
const H = require('../harness.js');

const ARCHIVO = process.env.CAGE_FILE || undefined;

function carrera(seed){
  const h = H.boot({ seed, file: ARCHIVO });
  H.startCareer(h, { metaSeed: 9900 + seed, style:'mma', div:'LW', age:22 });
  const c = h.ctx;
  const co = c.G.offers.find(o => o.type === 'contract' && c.G.orgs[o.org]);
  c.negoStart(co); c.negoClose(); c.G.mg = null; c.UI.screen = 'hub'; c.G.pending = [];
  return c;
}
function aLaJaula(c){
  const p = c.G.player;
  const o = Object.values(c.G.fighters).find(f => f && !f.isPlayer && f.div === p.div && !c.fightSpecProblem({ oppId: f.id, org: p.org }));
  ok(c.scheduleFight({ oppId: o.id, org: p.org, weeks: 8, title: false, purse: 5000, event: 'T' }, 'prueba').ok, 'no se firmó');
  ok(c.startCamp(c.G.nextFight), 'no arrancó el camp');
  c.G.camp.i = c.G.camp.weeks; c.goFight(); c.UI.sub = null;
  return o;
}
const pendiente = (c, h) => c.G.pending.find(e => e.h === h);
function resolver(c, h, idx){
  const i = c.G.pending.findIndex(e => e.h === h); ok(i >= 0, 'no hay evento ' + h);
  const e = c.G.pending.splice(i, 1)[0]; c.G.pending.unshift(e); c.resolveEvent(idx);
}

suite('RPG-8 · lo que el juego prometía, ahora pasa', () => {
  test('«Va a llegar algo mejor»: la próxima oferta de contrato llega 20 % mejor', () => {
    /* la misma oferta, con y sin la promesa: otros módulos también la ajustan */
    const oferta = (flag) => {
      const c = carrera(1);
      c.G.flags.betterDeal = flag;
      c.G.offers = [{ type: 'contract', org: c.G.player.org, purse: 10000, bonus: 5000, fights: 4, txt: 'Renovación.' }];
      c.hookEmit('offers:made', {});
      return { o: c.G.offers[0], c };
    };
    const sin = oferta(false), con = oferta(true);
    ok(Math.abs(con.o.purse / sin.o.purse - 1.2) < 0.01, 'la oferta no mejoró un 20 %: ' + sin.o.purse + ' → ' + con.o.purse);
    ok(!con.c.G.flags.betterDeal, 'la promesa se cobra dos veces');
  });
  test('«Todo el mundo sabe que estás disponible»: otra organización se adelanta', () => {
    const c = carrera(2);
    c.G.flags.freeAgent = true; c.G.contract.left = 1; c.G.offers = [];
    c.hookEmit('offers:made', {});
    const o = c.G.offers.find(x => x.type === 'contract' && x.org !== c.G.player.org);
    ok(o && c.G.orgs[o.org], 'nadie se adelantó');
  });
  test('«Tu equipo empieza a evaluar la idea»: si tu cuerpo es de otra categoría, el cambio se ofrece', () => {
    const c = carrera(3), p = c.G.player;
    const nat = c.naturalDiv(p);
    const otra = c.DIVKEYS.find(d => d !== nat && c.DIVS[d].f === c.DIVS[p.div].f);
    p.div = otra; c.G.flags.divTalk = true;
    c.hookEmit('week', {});
    eq(c.G.flags.planDivUp, 1, 'la evaluación no abrió el cambio de categoría');
    ok(!c.G.flags.divTalk, 'la bandera no se consumió');
    const ev = c.EVENTS.find(e => e.id === 'body_divup');
    ok(ev && ev.c(), 'el evento de cambio de categoría que ya existía no queda disponible');
  });
  test('«Empezás a buscar alternativas»: dos representantes llaman, y firmar cambia de mánager', () => {
    const c = carrera(4);
    const antes = c.G.mgId;
    c.G.flags.wantMgr = true; c.G.pending = [];
    c.hookEmit('week', {});
    const e = pendiente(c, 'prom_mgr'); ok(e, 'nadie devolvió el llamado');
    resolver(c, 'prom_mgr', 0);
    ok(c.G.mgId !== antes && c.G.mgId === e.data.ids[0], 'firmar no cambió de mánager');
  });
  test('«Dos periodistas empiezan a investigarte»: doce semanas después, sale la nota', () => {
    const c = carrera(5);
    c.G.flags.dirtyMoney = true; c.G.pending = [];
    c.hookEmit('week', {});
    ok(typeof c.G.flags.dirtyMoney === 'object', 'no empezó a correr el plazo');
    ok(!pendiente(c, 'prom_invest'), 'la nota sale de inmediato');
    c.G.flags.dirtyMoney.at -= 12; c.G.pending = [];
    c.hookEmit('week', {});
    ok(pendiente(c, 'prom_invest'), 'la investigación nunca sale');
    const rep = c.G.player.rep; resolver(c, 'prom_invest', 0);
    ok(c.G.player.rep < rep, 'negarlo no cuesta reputación');
  });
  test('«Vas a tener que perder a propósito»: en el segundo round aparece la opción, y cumplirlo es perder', () => {
    const c = carrera(6);
    c.G.flags.fixed = 100000;
    aLaJaula(c);
    ok(c.fightOptions().every(o => o.k !== 'prom_dive'), 'aparece en el primer round');
    c.G.fight.round = 2;
    ok(c.fightOptions().some(o => o.k === 'prom_dive'), 'no aparece en el segundo round');
    c.fightAct('prom_dive');
    ok(c.G.fight.over && c.G.fight.result.winner === 'o', 'irse a la lona no termina la pelea con derrota');
    c.confirmFight();
    eq(c.G.flags.fixed, 'done', 'el arreglo sigue pendiente');
    eq(c.RPG.echoCount('took_dive'), 1, 'vender la pelea no deja huella');
  });
  test('ganar la pelea vendida tiene consecuencias', () => {
    const c = carrera(7);
    c.G.flags.fixed = 100000;
    aLaJaula(c);
    c.finishFight('ko', 'p'); c.confirmFight();
    ok(pendiente(c, 'prom_fix'), 'nadie viene a cobrar');
    const cash = c.G.cash; resolver(c, 'prom_fix', 0);
    eq(cash - c.G.cash, 130000, 'devolver no cuesta la plata con intereses');
  });
  test('«Campamentos allá sin romper con tu equipo»: el gimnasio de afuera pesa en el camp, y sólo en el camp', () => {
    const c = carrera(8), p = c.G.player;
    const g1 = c.gymById(p.gym);
    const g2 = c.G.gyms.slice().sort((a, b) => b.a.wrest - a.a.wrest)[0];
    ok(g2.id !== g1.id && g2.a.wrest > g1.a.wrest, 'la prueba necesita un gimnasio mejor en wrestling que el propio');
    c.G.flags.dualGym = g2.id;
    const bono = () => { const mm = { act: 'wrest', intensity: 1, bonus: 0 }; c.hookEmit('train:adjust', mm); return mm.bonus; };
    const fuera = bono();
    aLaJaula(c); c.G.fight = null; c.G.camp = c.G.camp || null;
    c.startCamp(c.G.nextFight || { oppId: c.G.camp && c.G.camp.oppId });
    ok(c.G.camp, 'no hay campamento para la prueba');
    const dentro = bono();
    ok(dentro > fuera, 'en el camp el gimnasio de afuera no suma: ' + fuera + ' → ' + dentro);
  });
});
