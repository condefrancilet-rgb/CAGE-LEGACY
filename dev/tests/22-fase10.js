'use strict';
/* FASE 10 — LO QUE SE ESCRIBÍA Y NADIE LEÍA, AHORA LLEGA A ALGÚN LADO
   ---------------------------------------------------------------------------
   La espalda tomada, la defensa principal del plan, el ruido de los medios y
   la memoria del rival ya existían como datos. Estas pruebas exigen que cada
   uno tenga un consumidor real, que el efecto sea el que se declara (medido
   contra el motor, no contra la función que lo aplica), que no toque la IA del
   rival y que no consuma azar nuevo.                                        */
const { suite, test, ok, eq } = require('../run-tests.js');
const H = require('../harness.js');
const fs = require('node:fs');
const path = require('node:path');

const ARCHIVO = process.env.CAGE_FILE || undefined;
const SRC = fs.readFileSync(ARCHIVO || path.join(__dirname, '..', '..', 'index-4-blindado.html'), 'utf8');

function carrera(seed){
  const h = H.boot({ seed, file: ARCHIVO });
  H.startCareer(h, { metaSeed: 9990 + seed, style: 'mma', div: 'LW', age: 22 });
  const c = h.ctx;
  const co = c.G.offers.find(o => o.type === 'contract' && c.G.orgs[o.org]);
  c.negoStart(co); c.negoClose(); c.G.mg = null; c.UI.screen = 'hub'; c.G.pending = [];
  return c;
}
function rival(c, salvo){
  const p = c.G.player;
  return Object.values(c.G.fighters).find(f => f && !f.isPlayer && f.div === p.div && (!salvo || salvo.indexOf(f.id) < 0) &&
    !c.fightSpecProblem({ oppId: f.id, org: p.org }));
}
function enCamp(c, o){
  o = o || rival(c);
  ok(c.scheduleFight({ oppId: o.id, org: c.G.player.org, weeks: 8, title: false, purse: 5000, event: 'T' }, 'prueba').ok, 'no se firmó');
  ok(c.startCamp(c.G.nextFight), 'no arrancó el camp');
  c.G.pending = [];
  return o;
}
function aLaJaula(c, o){
  o = enCamp(c, o);
  c.G.camp.i = c.G.camp.weeks; c.goFight(); c.UI.sub = null;
  ok(c.G.fight && !c.G.fight.over, 'no hay pelea');
  return o;
}
function terminar(c, gana){
  if(c.G.fight && !c.G.fight.over) c.finishFight('ko', gana ? 'p' : 'o');
  c.confirmFight(); c.G.pending = [];
}
const pendiente = (c, h) => c.G.pending.find(e => e.h === h);
function resolver(c, h, idx){
  const i = c.G.pending.findIndex(e => e.h === h); ok(i >= 0, 'no hay evento ' + h);
  const e = c.G.pending.splice(i, 1)[0]; c.G.pending.unshift(e);
  c.resolveEvent(idx);
}
/* espía del dado: registra cada probabilidad que el motor tira */
function espiarDado(c, respuesta){
  const orig = c.chance, tiros = [];
  c.chance = function(p){ tiros.push(p); return typeof respuesta === 'function' ? respuesta(p) : !!respuesta; };
  return { tiros, soltar(){ c.chance = orig; } };
}
/* ¿consumió azar? El juego tira su dado con su propio estado (G.rs, rnd());
   si fn lo movió, cuenta como azar consumido */
function contarAzar(c, fn){
  const rs0 = c.G.rs; fn(); return c.G.rs === rs0 ? 0 : 1;
}
const hook = (c, evt, id) => (c.HOOKS[evt] || []).find(x => x.id === id);
const SUELO = ['grappling', 'ground', 'submission'];

suite('RPG-10 · la toma de espalda es una posición que el motor lee', () => {
  test('g_back deja la espalda tomada mientras sigas arriba en ese round; se pierde al cambiar de posición o de round', () => {
    const c = carrera(1); aLaJaula(c);
    const f = c.G.fight; f.pos = 'gtop';
    const d = espiarDado(c, false);
    try{ c.TQ.apply(c.TQ.node('g_back'), 'good', 0.7); } finally { d.soltar(); }
    const st = c.TQ.fs();
    ok(st.back && st.backR === f.round, 'no quedó marcada con su round');
    ok(c.TQ.back(), 'arriba y en el mismo round no cuenta como espalda tomada');
    f.pos = 'gbot'; ok(!c.TQ.back(), 'con él arriba sigue contando la espalda');
    f.pos = 'gtop'; f.round++; ok(!c.TQ.back(), 'la espalda pasa al round siguiente');
    f.round--; ok(c.TQ.back(), 'volver al mismo estado debería seguir contando (la marca no se borró todavía)');
    /* un intercambio donde él se levanta: se pierde, y lo dice */
    f.pos = 'stand';
    c.resolveExchange('jab', 'move', c.G.player, c.F(f.opp));
    eq(st.back, 0, 'la marca sobrevivió al cambio de posición');
    ok(f.log.some(t => /se saca los ganchos/.test(t)), 'perderla no queda en el relato');
    f.pos = 'gtop'; ok(!c.TQ.back(), 'volver arriba después no devuelve la espalda');
  });

  test('con la espalda tomada el trabajo de suelo rinde exactamente TQ.BACK.eff más; lo demás y el rival, igual', () => {
    const c = carrera(2); aLaJaula(c);
    const f = c.G.fight, p = c.G.player, o = c.F(f.opp), st = c.TQ.fs();
    f.pos = 'gtop'; st.back = 0;
    const casos = [['grappling','ground','submission'], ['submission','grappling'], ['grappling','composure'], ['boxing','accuracy','timing','power','kicks'], ['tdd','wrestling','footwork']];
    const sin = casos.map(k => c.eff(p, k, 'p')), sinO = c.eff(o, SUELO, 'o');
    st.back = 1; st.backR = f.round;
    ok(c.TQ.BACK.eff > 0, 'la espalda no tiene magnitud');
    casos.forEach((k, i) => {
      const esp = k.some(x => SUELO.indexOf(x) >= 0) ? c.TQ.BACK.eff : 0;
      ok(Math.abs(c.eff(p, k, 'p') - sin[i] - esp) < 1e-9, 'claves ' + k.join('/') + ': esperaba +' + esp + ', dio ' + (c.eff(p, k, 'p') - sin[i]));
    });
    ok(Math.abs(c.eff(o, SUELO, 'o') - sinO) < 1e-9, 'la espalda cambia el rendimiento del rival');
    /* la IA del rival no la lee */
    st.back = 0; const d0 = JSON.stringify(c.CMB.dist()); st.back = 1;
    eq(JSON.stringify(c.CMB.dist()), d0, 'la espalda tomada cambia lo que decide el rival');
  });

  test('suma control en cada intercambio que sigue arriba, y la cadena de sumisión sale más fuerte desde la espalda', () => {
    const c = carrera(3); aLaJaula(c);
    const f = c.G.fight, p = c.G.player, o = c.F(f.opp), st = c.TQ.fs();
    const ctrl = (conEspalda) => {
      f.pos = 'gtop'; st.back = conEspalda ? 1 : 0; st.backR = f.round; f.over = false;
      const c0 = f.p.ctrl; c.resolveExchange('hold', 'guard', p, o); return f.p.ctrl - c0;
    };
    const a = ctrl(false), b = ctrl(true);
    eq(b - a, c.TQ.BACK.ctrl, 'el control por intercambio con la espalda');
    /* g_chain a PERFECTA: el tiro de sumisión, con y sin espalda */
    const tiro = (conEspalda) => {
      f.pos = 'gtop'; f.over = false; f.o.stam = 80; st.back = conEspalda ? 1 : 0; st.backR = f.round;
      const d = espiarDado(c, false);
      try{ c.TQ.apply(c.TQ.node('g_chain'), 'perfect', 0.9); } finally { d.soltar(); }
      return d.tiros[0];
    };
    const t0 = tiro(false), t1 = tiro(true);
    ok(t0 > 0 && t0 < 0.8, 'la prueba necesita un tiro por debajo del techo: ' + t0);
    ok(Math.abs(t1 - Math.min(0.8, t0 * c.TQ.BACK.sub)) < 1e-9, 'la cadena desde la espalda: ' + t0 + ' → ' + t1);
  });

  test('el HUD lo muestra sólo mientras la espalda cuenta, y la distancia ya no se dice en porcentajes', () => {
    const c = carrera(4); aLaJaula(c);
    const f = c.G.fight, st = c.TQ.fs();
    f.pos = 'stand'; st.back = 0;
    const h0 = c.CL.fightHUD();
    ok(!/%/.test(h0.replace(/width:\d+%/g, '')), 'el HUD sigue mostrando porcentajes: ' + h0.replace(/<[^>]+>/g, ' ').slice(0, 200));
    ok(/vos querés (corta|media|larga) · él (corta|media|larga|también)/.test(h0), 'el HUD no dice en palabras qué distancia quiere cada uno');
    ok(!/Espalda tomada/.test(h0), 'muestra la espalda sin tenerla');
    f.pos = 'gtop'; st.back = 1; st.backR = f.round;
    ok(/Espalda tomada/.test(c.CL.fightHUD()), 'no muestra la espalda tomada');
  });
});

suite('RPG-10 · La Última Puerta es distinta de su L4 también a PERFECTA', () => {
  test('con habilidad alta, la L4 toca el techo del árbol y la Ultimate lo supera; ninguna otra técnica cambia de techo', () => {
    const c = carrera(5); aLaJaula(c);
    const f = c.G.fight, p = c.G.player;
    ['submission','grappling','ground','composure'].forEach(k => { p.st[k] = 95; });
    c.CMB.S().ult.g_def = { v: 'pura', src: 'identidad', k: null, y: c.G.year, w: c.G.week, used: 0, landed: 0 };
    const tiro = (t) => {
      f.pos = 'gtop'; f.over = false; f.o.stam = 80; c.TQ.fs().back = 0;
      const d = espiarDado(c, false);
      try{ c.TQ.apply(t, 'perfect', 0.95); } finally { d.soltar(); }
      return d.tiros[0];
    };
    const l4 = tiro(c.TQ.node('g_def')), ult = tiro(c.CMB.ultNode(c.TQ.node('g_def')));
    eq(l4, 0.8, 'la L4 a PERFECTA con habilidad alta');
    ok(ult > l4 && ult <= 0.9, 'la Ultimate no se distingue a PERFECTA: ' + l4 + ' vs ' + ult);
    eq(c.CMB.ULT.g_def.fx.subCap, 0.88, 'el techo propio de La Última Puerta');
    c.TQ.T.forEach(t => ok(!(t.fx && t.fx.subCap), t.id + ' cambió de techo sin ser Ultimate'));
    Object.keys(c.CMB.ULT).filter(k => k !== 'g_def').forEach(k => ok(!c.CMB.ULT[k].fx.subCap, k + ' trae un techo propio'));
  });
});

suite('RPG-10 · el sello de la Ultimate sale de la filosofía de combate asumida', () => {
  test('cada filosofía elige uno de los cuatro sellos existentes; sin filosofía manda la identidad', () => {
    const c = carrera(6);
    const r = c.RPG.S();
    r.philo.fight = null;
    const porIdentidad = c.CMB.ultVariant();
    eq(c.CMB.ultVariantSrc().src, 'identidad', 'sin filosofía el sello no sale de la identidad');
    const esperado = { finalizar: 'espectaculo', espectaculo: 'espectaculo', castigo: 'precision', minimizar: 'precision', control: 'desgaste', adelante: 'desgaste' };
    eq(Object.keys(c.RPG.FP).sort().join(), Object.keys(esperado).sort().join(), 'hay filosofías sin sello o sellos sin filosofía');
    for(const k in esperado){
      r.philo.fight = k;
      const v = c.CMB.ultVariantSrc();
      eq(v.v, esperado[k], 'filosofía ' + k); eq(v.src, 'filosofia', 'filosofía ' + k + ': origen');
      ok(c.CMB.ULT_V[v.v], 'sello inexistente: ' + v.v);
    }
    r.philo.fight = null;
    eq(c.CMB.ultVariant(), porIdentidad, 'quitar la filosofía no devuelve el sello de la identidad');
  });

  test('al despertar queda guardado de dónde salió, y el árbol lo explica con la filosofía que asumiste', () => {
    const c = carrera(7);
    const r = c.RPG.S(); r.philo.fight = 'castigo';
    c.TQ.S().un.i_last = 1;
    r.mast.i_last = { n: 8, x: 3, w: 1, p: 3, g: 5 };
    const got = c.CMB.awaken();
    ok(got.indexOf('i_last') >= 0, 'no despertó');
    const u = r.ult.i_last;
    eq(u.v, 'precision', 'el sello'); eq(u.src, 'filosofia', 'el origen'); eq(u.k, 'castigo', 'la filosofía');
    ok(/Castigar errores/.test(c.CMB.ultWhy(u)), 'la explicación no nombra la filosofía: ' + c.CMB.ultWhy(u));
    const html = c.hookFilter('tq:ownInfo', '', { t: c.TQ.node('i_last') });
    ok(/por tu filosofía/.test(html), 'el árbol no dice de dónde salió el sello');
    /* partidas viejas: sin origen guardado, se explica sin inventar */
    ok(c.CMB.ultWhy({ v: 'pura' }).length > 0, 'un sello viejo no se puede explicar');
    c.saveGame(true); ok(c.loadGame(c.listSaves()[0].id), 'no cargó');
    const u2 = c.G.rpg.ult.i_last;
    eq(u2.src + '|' + u2.k + '|' + u2.v, 'filosofia|castigo|precision', 'el origen del sello no sobrevive a guardar y cargar');
  });
});

suite('RPG-10 · la defensa principal del plan llega a la pelea', () => {
  /* la especificación, escrita aparte: qué acción del rival cubre cada defensa */
  const CUBRE = { cabeza: (pos, oa, pa) => pos === 'stand' && (oa === 'jab' || oa === 'combo' || (oa === 'counter' && pa === 'combo')),
                  derribo: (pos, oa) => (pos === 'stand' && oa === 'td') || (pos === 'clinch' && oa === 'ctd'),
                  reja: (pos, oa) => pos === 'stand' && oa === 'clinch' };
  const CLAVE = { cabeza: ['defense','footwork','fightiq','composure'], derribo: ['tdd','wrestling','footwork'], reja: ['tdd','wrestling','footwork'] };
  const OA = { stand: ['jab','combo','counter','lowkick','clinch','td','move'], clinch: ['knees','ctd','grind','break'] };
  test('sólo en el intercambio en que él hace aquello de lo que te preparaste, y sólo en esa defensa', () => {
    const c = carrera(8); aLaJaula(c);
    const f = c.G.fight, p = c.G.player;
    const todas = [CLAVE.cabeza, CLAVE.derribo, ['boxing','accuracy','timing','power','kicks'], ['grappling','ground','submission']];
    let cubiertos = 0;
    for(const def of ['cabeza','derribo','reja']) for(const pos of ['stand','clinch']) for(const oa of OA[pos]) for(const pa of ['combo','jab','td']){
      f.pos = pos;
      f.gp = Object.assign({}, f.gp, { def: null });
      c.hookEmit('exchange:pre', { pa, oa, p, o: c.F(f.opp) });
      const base = todas.map(k => c.eff(p, k, 'p')), baseO = todas.map(k => c.eff(c.F(f.opp), k, 'o'));
      f.gp.def = def;
      const con = todas.map(k => c.eff(p, k, 'p')), conO = todas.map(k => c.eff(c.F(f.opp), k, 'o'));
      todas.forEach((k, i) => ok(Math.abs(conO[i] - baseO[i]) < 1e-9, 'tu plan cambia el rendimiento del rival (' + def + ' · ' + oa + ')'));
      c.hookEmit('exchange:post', { pa, oa, p, o: c.F(f.opp) });
      const cubre = CUBRE[def](pos, oa, pa); if(cubre) cubiertos++;
      todas.forEach((k, i) => {
        const esp = (cubre && k === CLAVE[def]) || (cubre && def === 'reja' && k === CLAVE.derribo) ? c.GP_DEF_B : 0;
        ok(Math.abs(con[i] - base[i] - esp) < 1e-9, def + ' · ' + pos + ' · él ' + oa + ' · vos ' + pa + ' · ' + k[0] + ': esperaba +' + esp + ', dio ' + (con[i] - base[i]));
      });
    }
    ok(cubiertos > 10, 'la prueba no recorrió casos cubiertos: ' + cubiertos);
    eq(c.GP_DEF_B, 3, 'magnitud de la defensa');
    /* terminado el intercambio, deja de contar (aunque el último sí la cubriera) */
    f.pos = 'stand'; f.gp.def = 'cabeza';
    c.hookEmit('exchange:pre', { pa: 'jab', oa: 'combo', p, o: c.F(f.opp) });
    const dentro = c.eff(p, CLAVE.cabeza, 'p');
    c.hookEmit('exchange:post', { pa: 'jab', oa: 'combo', p, o: c.F(f.opp) });
    const fuera = c.eff(p, CLAVE.cabeza, 'p');
    ok(Math.abs(dentro - fuera - c.GP_DEF_B) < 1e-9, 'la defensa sigue contando después del intercambio: ' + (dentro - fuera));
  });

  test('no cambia lo que decide el rival, y la pelea usa la defensa del plan del campamento', () => {
    const c = carrera(9); const o = enCamp(c);
    c.G.camp.gameplan = { dist: 'media', pace: 'medio', prio: 'striking', def: 'derribo', score: 3 };
    c.G.camp.i = c.G.camp.weeks; c.goFight(); c.UI.sub = null;
    const f = c.G.fight;
    eq(f.gp.def, 'derribo', 'la pelea no trae la defensa del plan');
    const d0 = JSON.stringify(c.CMB.dist());
    f.gp.def = 'cabeza'; eq(JSON.stringify(c.CMB.dist()), d0, 'la defensa cambia lo que decide el rival');
    ok(o && f.opp === o.id, 'otra pelea');
  });
});

suite('RPG-10 · la memoria del rival llega al campamento de la revancha', () => {
  test('CMB.supOf es lo mismo que la pelea usa para que él no repita lo castigado', () => {
    const c = carrera(10); const o = rival(c);
    c.CMB.S().fm[o.id] = { n: 1, res: 'W', y: c.G.year, w: c.G.week, obs: { stand: { combo: 5, jab: 1 } }, pp: {},
                           ex: { stand: { a: 'combo', n: 2 }, 'stand:c': { a: 'td', n: 1 } }, tq: {}, ult: {} };
    eq(JSON.stringify(c.CMB.supOf(c.CMB.S().fm[o.id])), JSON.stringify({ stand: 'combo' }), 'supOf');
    aLaJaula(c, o);
    eq(JSON.stringify(c.G.fight.iq.sup), JSON.stringify({ stand: 'combo' }), 'la pelea no usa la misma memoria');
  });

  test('el sparring de la revancha se compara con lo que le viste: confirma, avisa que cambió o que él se acuerda', () => {
    const c = carrera(11); const o = enCamp(c);
    const t0 = c.CAMPO.tell(o); ok(t0, 'este rival no muestra nada en el sparring (la prueba necesita algo)');
    eq(t0.mem, null, 'sin pelea previa no debería haber memoria');
    const otra = ['jab','combo','counter','lowkick','clinch','td','move','gnp','pass','sub','hold','up'].find(a => a !== t0.a);
    const fm = c.CMB.S().fm;
    /* 1. lo mismo */
    fm[o.id] = { n: 1, res: 'L', obs: { [t0.b]: { [t0.a]: 6 } }, pp: {}, ex: {}, tq: {}, ult: {} };
    let t = c.CAMPO.tell(o);
    ok(t.mem && t.mem.seen && t.mem.seen.top === t0.a, 'no leyó la memoria de esa situación');
    ok(/lo mismo que le viste/.test(c.CAMPO.memLine(t)), 'no confirma: ' + c.CAMPO.memLine(t));
    /* 2. algo cambió */
    fm[o.id].obs = { [t0.b]: { [otra]: 6 } };
    t = c.CAMPO.tell(o);
    ok(/algo cambió/.test(c.CAMPO.memLine(t)) && c.CAMPO.memLine(t).indexOf(c.CMB.n(otra)) > 0, 'no avisa el cambio: ' + c.CAMPO.memLine(t));
    /* 3. se la castigaste: él se acuerda, y no se propone cambiar el plan por eso */
    fm[o.id].ex = { [t0.b]: { a: t0.a, n: 2 } };
    t = c.CAMPO.tell(o);
    ok(/se acuerda/.test(c.CAMPO.memLine(t)), 'no avisa que él se acuerda: ' + c.CAMPO.memLine(t));
    eq(c.CAMPO.defFor(t, { def: 'nada' }), null, 'propone ajustar el plan a algo que él puede no repetir');
    /* el texto sigue sin números internos */
    ok(!/\d/.test(c.CAMPO.memLine(t)), 'la memoria muestra números');
  });

  test('si el hábito pide otra defensa, el sparring ofrece ajustar el plan, y ese plan llega a la pelea', () => {
    let hecho = false;
    for(let seed = 12; seed < 40 && !hecho; seed++){
      const c = carrera(seed); const o = enCamp(c);
      const t = c.CAMPO.tell(o); if(!t || !c.CAMPO.DEF_OF[t.a]) continue;
      const otra = ['cabeza','derribo','reja'].find(d => d !== c.CAMPO.DEF_OF[t.a]);
      c.G.camp.gameplan = { dist: 'media', pace: 'medio', prio: 'striking', def: otra, score: 3 };
      c.campWeek('spar', .9, 0);
      const e = pendiente(c, 'camp_spar'); ok(e, 'la semana de sparring no dejó el momento');
      eq(e.opts.length, 3, 'no ofrece ajustar el plan');
      ok(e.opts[2].t.indexOf(c.CAMPO.DEFN[c.CAMPO.DEF_OF[t.a]]) > 0, 'la opción no nombra la defensa: ' + e.opts[2].t);
      resolver(c, 'camp_spar', 2);
      eq(c.G.camp.gameplan.def, c.CAMPO.DEF_OF[t.a], 'el plan no cambió');
      ok(c.G.camp.readPat && c.G.camp.readPat.drill, 'ajustar el plan no cuenta como trabajarlo');
      c.G.camp.i = c.G.camp.weeks; c.goFight(); c.UI.sub = null;
      eq(c.G.fight.gp.def, c.CAMPO.DEF_OF[t.a], 'la pelea no trae la defensa ajustada');
      /* con la defensa ya bien puesta, no se ofrece */
      hecho = true;
    }
    ok(hecho, 'ningún rival mostró en el sparring un hábito que pida una defensa');
  });
});

suite('RPG-10 · el ruido de los medios llega al emparejamiento', () => {
  function ofertaRival(c, o){
    const org = c.G.orgs[c.G.player.org];
    return { type: 'fight', oppId: o.id, org: c.G.player.org, weeks: 9, title: false, purse: 10000, event: org.ab + ' — prueba', txt: 'RIVALIDAD', clTag: 'rivalidad' };
  }
  test('con ruido, las peleas de rivalidad pagan más y lo dicen; sin ruido, nada cambia; sin azar', () => {
    const c = carrera(20); const o = rival(c);
    const h = hook(c, 'offers:made', 'heat'); ok(h, 'no hay consumidor del heat en el emparejamiento');
    c.G.nextFight = null;
    c.G.flags.heat = 1; c.G.offers = [ofertaRival(c, o)];
    h.fn(); eq(c.G.offers[0].purse, 10000, 'con ruido bajo cambia la bolsa');
    c.G.flags.heat = 5; c.G.offers = [ofertaRival(c, o), { type: 'fight', oppId: o.id, purse: 7000, clTag: 'otra' }];
    const n = contarAzar(c, () => h.fn());
    eq(n, 0, 'el consumidor del heat tira azar');
    eq(c.G.offers[0].purse, Math.round(10000 * 1.2), 'la bolsa con ruido 5');
    eq(c.G.offers[0].heatB, 20, 'el porcentaje declarado');
    ok(/ruido en los medios/.test(c.G.offers[0].reason), 'la oferta no dice por qué paga más');
    eq(c.G.offers[1].purse, 7000, 'una pelea que no es de rivalidad cobra el ruido');
    h.fn(); eq(c.G.offers[0].purse, 12000, 'el ruido se cobra dos veces');
    c.G.flags.heat = 50; c.G.offers = [ofertaRival(c, o)]; h.fn();
    eq(c.G.offers[0].heatB, 30, 'el tope');
  });

  test('con ruido alto y sin pelea de rivalidad, la organización arma la del rival con más rivalidad', () => {
    const c = carrera(21); const p = c.G.player, org = c.G.orgs[p.org];
    c.G.nextFight = null; c.G.offers = [];
    const pool = org.roster.map(c.F).filter(f => f && !f.isPlayer && f.div === p.div && !f.inj && !f.retired && f.active);
    ok(pool.length >= 2, 'la división no tiene rivales');
    pool.forEach(f => { f.rel = f.rel || {}; f.rel.rivalry = 10; });
    pool[0].rel.rivalry = 45; pool[1].rel.rivalry = 70;
    const h = hook(c, 'offers:made', 'heat');
    c.G.flags.heat = 3; h.fn(); eq(c.G.offers.length, 0, 'con poco ruido arma peleas');
    c.G.flags.heat = 4; const n = contarAzar(c, () => h.fn());
    eq(n, 0, 'armarla tira azar');
    const of = c.G.offers[0]; ok(of && /LA PRENSA LA PIDE/.test(of.txt), 'no armó la pelea');
    eq(of.oppId, pool[1].id, 'no eligió al de más rivalidad');
    ok(of.heatB > 0 && of.clTag === 'rivalidad', 'la pelea armada no se cobra con el ruido');
    ok(!c.fightSpecProblem({ oppId: of.oppId, org: of.org }), 'armó una pelea imposible');
    /* con pelea firmada, no se arma */
    c.G.offers = []; c.G.nextFight = { oppId: pool[0].id }; h.fn(); eq(c.G.offers.length, 0, 'arma peleas con una ya firmada');
  });

  test('firmarla gasta el ruido, el ruido se enfría solo y la bienvenida de Vanguard escribe en el mismo', () => {
    const c = carrera(22); const o = rival(c);
    c.G.nextFight = null; c.G.camp = null;
    c.G.flags.heat = 10; c.G.offers = [ofertaRival(c, o)];
    hook(c, 'offers:made', 'heat').fn();
    ok(c.acceptFight(0), 'no se pudo firmar');
    eq(c.G.flags.heat, 4, 'firmar no gastó el ruido');
    ok(o.bond && o.bond.media, 'firmar la pelea que vendió el ruido no la deja «en los medios»');
    c.G.flags.heat = 10; hook(c, 'week', 'heat').fn(); eq(c.G.flags.heat, 9.7, 'el ruido no se enfría');
    c.G.flags.heat = 0.05; hook(c, 'week', 'heat').fn(); eq(c.G.flags.heat, 0, 'el ruido residual no se apaga');
    /* «Prometer show» en la bienvenida de Vanguard: el ruido va al mismo lugar */
    c.G.flags.heat = 0; c.G.pending = [];
    const u = c.CL.ufc(), u0 = u.heat;
    c.CL.ask('ufc_welcome', 'prueba', ['a', 'b', 'c'], {});
    resolver(c, 'ufc_welcome', 1);
    eq(c.G.flags.heat, 2, 'prometer show no hace ruido');
    eq(u.heat, u0, 'sigue escribiendo un heat que nadie lee');
    ok(!/u\.heat = clamp\(u\.heat - 0\.8/.test(SRC), 'sigue enfriándose un heat que nadie lee');
  });
});

suite('RPG-10 · el ciclo de una rivalidad avanza y queda escrito', () => {
  test('leer la etapa no crea vínculos ni relaciones', () => {
    const c = carrera(30); const o = rival(c);
    delete o.bond; const rel = JSON.stringify(o.rel);
    c.RPG.rivalFacts(o); c.RPG.rivalStage(o);
    ok(!o.bond, 'leer la etapa creó un vínculo'); eq(JSON.stringify(o.rel), rel, 'leer la etapa tocó la relación');
  });

  test('cruce → tensión → en los medios → pelea firmada → ya se pelearon, una vez cada una, en la relación, la memoria y el diario', () => {
    const c = carrera(31); const o = rival(c);
    c.G.flags.heat = 0;
    const mem = () => (c.G.story.memories || []).filter(m => m.type === 'rivalidad' && m.oppId === o.id).map(m => m.k);
    eq(c.RPG.rivalFacts(o).k, 'cruce', 'etapa inicial');
    eq(c.RPG.rivalTick(o), null, 'un cruce sin nada no es una rivalidad');
    o.rel = o.rel || {}; o.rel.rivalry = 65; c.bondOf(o).clash = 2;
    eq(c.RPG.rivalTick(o), 'tension', 'no pasó a tensión');
    eq(c.RPG.rivalTick(o), null, 'la misma etapa se registró dos veces');
    c.CL.remember('rivalry_escalated', { oppId: o.id, choice: 'public' });
    eq(c.RPG.rivalTick(o), 'medios', 'responderle en público no la llevó a los medios');
    ok(o.bond.media, '«en los medios» no queda guardado');
    enCamp(c, o);
    eq(c.RPG.rivalFacts(o).k, 'campana', 'con la pelea firmada');
    c.RPG.rivalSweep();
    c.G.camp.i = c.G.camp.weeks; c.goFight(); c.UI.sub = null; terminar(c, true);
    eq(c.RPG.rivalFacts(o).k, 'pelea', 'después de pelear');
    eq(mem().slice().reverse().join(), 'tension,medios', 'a la memoria del mundo van sólo los hitos');
    eq(o.bond.rc.hist.map(x => x.k).join(), 'tension,medios,campana,pelea', 'la historia de la relación');
    ok(o.bond.hist.some(x => /Rivalidad: tensión pública/.test(x.t)), 'la relación no lo anota');
    const diario = c.RPG.journalHTML().replace(/<[^>]+>/g, ' ');
    ok(/⚔️ Rivalidad con [^.]*: en los medios/.test(diario) && !/undefined/.test(diario), 'el diario no lo cuenta');
    c.UI.sub = o.id;
    ok(/en los medios/.test(c.hookFilter('screen:fighter', '', {}).replace(/<[^>]+>/g, ' ')), 'la ficha del rival no muestra la historia');
    /* guardar y cargar no la pierde */
    const antes = JSON.stringify(o.bond.rc) + '|' + o.bond.media;
    c.saveGame(true); ok(c.loadGame(c.listSaves()[0].id), 'no cargó');
    const o2 = c.G.fighters[o.id];
    eq(JSON.stringify(o2.bond.rc) + '|' + o2.bond.media, antes, 'la historia de la rivalidad no sobrevive a guardar y cargar');
    eq(c.RPG.rivalTick(o2), null, 'después de cargar vuelve a registrar etapas ya registradas');
  });

  test('si al mirar ya se saltó una etapa que es un hecho, se anota en orden; la ficha lo muestra antes de la primera pelea', () => {
    const c = carrera(34); const o = rival(c);
    c.G.flags.heat = 0;
    enCamp(c, o);                                 /* la pelea ya está firmada… */
    o.rel = o.rel || {}; o.rel.rivalry = 70;      /* …y la tensión aparece recién ahora */
    eq(c.RPG.rivalTick(o), 'campana', 'la etapa vigente');
    eq(o.bond.rc.hist.map(x => x.k).join(), 'tension,campana', 'la tensión pública se perdió de la historia');
    c.UI.sub = o.id;
    const ficha = c.hookFilter('screen:fighter', '', {}).replace(/<[^>]+>/g, ' ');
    ok(/Rivalidad/.test(ficha) && /pelea está firmada/.test(ficha), 'la ficha no muestra la rivalidad antes de la primera pelea: ' + ficha.slice(0, 200));
  });

  test('la resolución es la misma regla del emparejamiento: 2-0 cierra, 1-1 y 0-2 siguen, tres peleas o el retiro cierran', () => {
    const c = carrera(32); const o = rival(c), p = c.G.player;
    /* y el hito dice el marcador una sola vez */
    o.rel = o.rel || {}; o.rel.rivalry = 70;
    p.career = (p.career || []).concat([1, 2].map(i => ({ y: c.G.year, w: i, opp: c.fname(o), oppId: o.id, res: 'W', m: 'KO', r: 1 })));
    c.RPG.rivalTick(o);
    const hito = (c.G.story.memories || []).find(m => m.type === 'rivalidad' && m.oppId === o.id && m.k === 'resuelta');
    ok(hito && (hito.t.match(/2-0/g) || []).length === 1, 'el marcador se repite o falta: ' + (hito && hito.t));
    p.career = p.career.filter(x => x.oppId !== o.id);
    o.rel = o.rel || {}; o.rel.rivalry = 70;
    const hist = (res) => { p.career = (p.career || []).filter(x => x.oppId !== o.id).concat(res.map((r, i) => ({ y: c.G.year, w: i + 1, opp: c.fname(o), oppId: o.id, res: r, m: 'KO', r: 1 }))); };
    for(const [res, k] of [[['W','W'], 'resuelta'], [['W','L'], 'revancha'], [['L','L'], 'revancha'], [['W','L','W'], 'resuelta']]){
      hist(res);
      const st = c.RPG.rivalFacts(o);
      eq(st.k, k, res.join('-'));
      if(res.length === 2) eq(st.k === 'resuelta', !c.canOfferRematch(p, o), res.join('-') + ': la etapa y el emparejamiento no coinciden');
    }
    hist(['L']); o.retired = true; eq(c.RPG.rivalFacts(o).k, 'resuelta', 'el retiro no la cierra'); o.retired = false;
  });

  test('un rival de una sola pelea, sin tensión, no llena la memoria del mundo', () => {
    const c = carrera(33); const o = rival(c);
    o.rel = o.rel || {}; o.rel.rivalry = 0; delete o.bond;
    const n0 = (c.G.story.memories || []).length;
    aLaJaula(c, o); terminar(c, true);
    ok(!(c.G.story.memories || []).some(m => m.type === 'rivalidad' && m.oppId === o.id), 'una pelea suelta quedó como rivalidad en la memoria');
    ok(!(o.bond && o.bond.rc && (o.bond.rc.hist || []).length), 'una pelea suelta quedó como rivalidad en la relación: ' + JSON.stringify(o.bond && o.bond.rc));
    c.RPG.rivalSweep();
    ok(!(o.bond && o.bond.rc && (o.bond.rc.hist || []).length), 'el barrido semanal la convierte en rivalidad');
    ok((c.G.story.memories || []).length >= n0);
  });
});

suite('RPG-10 · una sola definición', () => {
  test('TQ.fightPanel se define una vez', () => {
    eq((SRC.match(/TQ\.fightPanel\s*=\s*function/g) || []).length, 1, 'definiciones de TQ.fightPanel');
  });
});
