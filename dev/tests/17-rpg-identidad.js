'use strict';
/* RPG · FASE 4 — QUIÉN SOS SALE DE LO QUE HACÉS
   ---------------------------------------------------------------------------
   El módulo RPG del juego no inventa nada: lee decisiones que ya ocurrían
   (firmar, hablar, tomar partido, dar el peso, cómo peleás) y las convierte en
   temperamento, identidad, rasgos y filosofía. Estas pruebas conducen cada
   entrada real y comprueban la consecuencia observable, no un número interno.  */
const { suite, test, ok, eq } = require('../run-tests.js');
const H = require('../harness.js');

const ARCHIVO = process.env.CAGE_FILE || undefined;

function carrera(seed, cfg){
  const h = H.boot({ seed, file: ARCHIVO });
  H.startCareer(h, Object.assign({ metaSeed: 9300 + seed, style:'mma', div:'LW', age:22 }, cfg||{}));
  return h;
}
function conContrato(c){
  const co = c.G.offers.find(o => o.type === 'contract' && c.G.orgs[o.org]);
  c.negoStart(co); c.negoClose(); c.G.mg = null; c.UI.screen = 'hub';
}
function rival(c, extra){
  const p = c.G.player;
  return Object.values(c.G.fighters).find(f => f && !f.isPlayer && f.div === p.div &&
    !c.fightSpecProblem(Object.assign({ oppId: f.id, org: p.org }, extra||{})));
}
/* una pelea completa por el camino real, con el ganador que pide la prueba */
function pelear(c, gana, conAcciones){
  const o = rival(c); ok(o, 'sin rival válido');
  ok(c.scheduleFight({ oppId: o.id, org: c.G.player.org, weeks: 8, title: false, purse: 5000, event: 'T' }, 'prueba').ok, 'no se firmó');
  ok(c.startCamp(c.G.nextFight), 'no arrancó el camp');
  c.G.camp.i = c.G.camp.weeks; c.goFight();
  (conAcciones || []).forEach(k => { if(c.G.fight && !c.G.fight.over) c.fightAct(k); });
  if(c.G.fight && !c.G.fight.over) c.finishFight(gana ? 'ko' : 'ko', gana ? 'p' : 'o');
  c.confirmFight(); c.G.pending = [];
  return o;
}

suite('RPG-4 · los ecos salen de decisiones reales', () => {
  test('firmar una pelea por el título deja el eco y lo recuerda la memoria narrativa', () => {
    const c = carrera(1).ctx; conContrato(c);
    const n0 = c.RPG.echoCount('title_chase');
    c.hookEmit('fight:scheduled', { spec: { oppId: rival(c).id, title: true, weeks: 10 }, source: 'prueba' });
    eq(c.RPG.echoCount('title_chase'), n0 + 1, 'no se registró el eco de ir por el cinturón');
    ok(c.G.story.memories.some(m => m.type === 'echo' && m.k === 'title_chase'), 'el eco no quedó en G.story.memories');
    ok(c.RPG.axes().ambicion > 0, 'ir por el cinturón no movió la ambición');
  });
  test('una pelea con poco aviso, firmada por la vía real, es un eco de riesgo', () => {
    const c = carrera(2).ctx; conContrato(c);
    const o = rival(c);
    ok(c.scheduleFight({ oppId: o.id, org: c.G.player.org, weeks: 2, shortNotice: true, purse: 5000, event: 'T' }, 'prueba').ok, 'no se firmó');
    eq(c.RPG.echoCount('short_notice'), 1, 'aceptar con dos semanas no dejó eco');
    ok(c.RPG.axes().riesgo > 0, 'no subió el riesgo');
  });
  test('lo que decís en un podcast mueve el temperamento', () => {
    const c = carrera(3).ctx;
    c.podcastStart('solo');
    const n = c.G.mg.qs.length;                                     /* 2 a 4 preguntas */
    for(let i = 0; i < n; i++) c.podPick(2);                        /* 'aggro' */
    eq(c.RPG.echoCount('media_aggro'), n, 'cada respuesta agresiva tenía que dejar su eco');
    ok(c.RPG.axes().confrontacion > 0, 'la confrontación no subió');
  });
  test('una decisión de evento del banco deja su eco (ayudar a un compañero)', () => {
    const c = carrera(4).ctx;
    const def = c.EVENTS.find(e => e.id === 'story_training_partner');
    ok(def, 'no existe story_training_partner');
    c.G.story.trainingStories = 0; c.G.nextFight = null;
    const txt = def.x(); c.G.pending = [{ id: def.id, txt, opts: def.o, important: false }];
    c.resolveEvent(0);                                              /* "Darlo todo" */
    eq(c.RPG.echoCount('helped_mate'), 1, 'ayudar a un compañero no dejó eco');
    ok(c.RPG.axes().lealtad > 0, 'no subió la lealtad');
  });
});

suite('RPG-4 · el temperamento emerge y el juego te lo pregunta', () => {
  test('con suficientes decisiones, el temperamento se nombra y propone un rasgo de PERS', () => {
    const c = carrera(10, { pers: 'humble' }).ctx;
    for(let i = 0; i < 16; i++) c.RPG.echo('media_aggro');
    for(let i = 0; i < 6; i++) c.RPG.echo('callout');
    const t = c.RPG.temper().map(x => x.n);
    ok(t.indexOf('Confrontativo') >= 0, 'no aparece "Confrontativo": ' + t.join(', '));
    const k = c.RPG.persFromAxes();
    ok(k === 'aggro' || k === 'arrogant', 'el rasgo propuesto no describe la conducta: ' + k);
  });
  test('asumirlo cambia la personalidad secundaria; negarlo no', () => {
    const c = carrera(11, { pers: 'pro' }).ctx;
    for(let i = 0; i < 18; i++) c.RPG.echo('media_funny');
    c.G.pending = []; c.G.camp = null;
    c.RPG.weekCheck();
    const ev = c.G.pending.find(e => e.h === 'rpg_temper');
    ok(ev, 'no llegó la pregunta del temperamento');
    const propuesto = ev.data.k;
    c.resolveEvent(0);
    eq(c.G.player.pers2, propuesto, 'asumir el temperamento no cambió pers2');
    const c2 = carrera(12, { pers: 'pro' }).ctx;
    for(let i = 0; i < 18; i++) c2.RPG.echo('media_funny');
    c2.G.pending = []; c2.G.camp = null; c2.RPG.weekCheck();
    const antes = c2.G.player.pers2;
    c2.resolveEvent(1);
    eq(c2.G.player.pers2, antes, 'negarlo cambió la personalidad igual');
    eq(c2.RPG.echoCount('temper_denied'), 1, 'negarlo no quedó registrado');
  });
});

suite('RPG-4 · la filosofía se muestra peleando y se asume en público', () => {
  test('tres peleas contragolpeando dan una filosofía de "castigar errores" que se puede asumir', () => {
    const c = carrera(20).ctx; conContrato(c);
    ok(!c.RPG.canAdopt('fight').ok, 'se puede asumir una filosofía sin peleas');
    for(let i = 0; i < 3; i++){ pelear(c, true, ['counter','counter','counter','counter','counter','jab']); c.G.player.inj = null; c.G.player.injWeeks = 0; }
    const l = c.RPG.fightLean();
    eq(l && l.k, 'castigo', 'la filosofía que muestran las peleas no es castigar errores: ' + JSON.stringify(l));
    const a = c.RPG.canAdopt('fight');
    ok(a.ok, 'no se puede asumir: ' + a.why);
    c.RPG.adopt('fight');
    eq(c.G.rpg.philo.fight, 'castigo', 'asumirla no quedó guardado');
    ok(c.G.news.some(n => /Cada error suyo es mío/.test(n.t)), 'asumirla no salió en las noticias');
  });
  test('la filosofía de carrera asumida cambia lo que recomienda el mánager', () => {
    const c = carrera(21).ctx; conContrato(c);
    c.G.player.inj = null; c.G.offers = []; c.makeOffers();
    const fights = c.G.offers.filter(o => o.type === 'fight');
    ok(fights.length >= 2, 'la prueba necesita dos ofertas');
    /* la oferta peor pagada pasa a ser una eliminatoria: con "gloria" debe ganar */
    const pobre = fights.slice().sort((a, b) => a.purse - b.purse)[0];
    pobre.elim = true;
    c.G.rpg.philo.career = null;
    const antes = c.MGR.read().reco.o;
    c.G.rpg.philo.career = 'gloria';
    const despues = c.MGR.read().reco.o;
    ok(despues === pobre, 'con filosofía "gloria" el mánager no priorizó la eliminatoria');
    ok(antes !== despues || antes === pobre, 'la filosofía no cambió nada');
  });
});

suite('RPG-4 · los rasgos se ganan con hechos y abren opciones', () => {
  test('dos remontadas dan el rasgo, y en el último round, yendo abajo, aparece "Cambio de marcha"', () => {
    const c = carrera(30).ctx; conContrato(c);
    c.G.rpg.cnt.comeback = 2;
    c.RPG.checkTraits('prueba');
    ok(c.RPG.hasTrait('remontada'), 'no se ganó el rasgo con dos remontadas');
    const o = rival(c);
    c.scheduleFight({ oppId: o.id, org: c.G.player.org, weeks: 8, title: false, purse: 5000, event: 'T' }, 'prueba');
    c.startCamp(c.G.nextFight); c.G.camp.i = c.G.camp.weeks; c.goFight();
    c.G.fight.round = c.G.fight.rounds; c.G.fight.cards = [{ p: 9, o: 10 }, { p: 9, o: 10 }];
    const ops = c.fightOptions().map(x => x.k);
    ok(ops.indexOf('rpg_surge') >= 0, 'no aparece la opción del rasgo: ' + ops.join(','));
    const hp0 = c.G.fight.o.hp; c.fightAct('rpg_surge');
    ok(c.G.fight.rpgSurge === 1, 'usar la opción no quedó registrado');
    ok(Number.isFinite(c.G.fight.o.hp) && c.G.fight.o.hp <= hp0, 'el intercambio no se resolvió');
  });
  test('sin el rasgo la opción no existe, aunque vayas perdiendo', () => {
    const c = carrera(31).ctx; conContrato(c);
    const o = rival(c);
    c.scheduleFight({ oppId: o.id, org: c.G.player.org, weeks: 8, title: false, purse: 5000, event: 'T' }, 'prueba');
    c.startCamp(c.G.nextFight); c.G.camp.i = c.G.camp.weeks; c.goFight();
    c.G.fight.round = c.G.fight.rounds; c.G.fight.cards = [{ p: 9, o: 10 }, { p: 9, o: 10 }];
    ok(c.fightOptions().every(x => x.k !== 'rpg_surge'), 'la opción aparece sin el rasgo');
  });
  test('Estratega: entre rounds se puede cambiar el plan, una sola vez', () => {
    const c = carrera(32).ctx; conContrato(c);
    c.G.rpg.cnt.gpW = 4; c.RPG.checkTraits('prueba');
    ok(c.RPG.hasTrait('estratega'), 'no se ganó Estratega');
    const o = rival(c);
    c.scheduleFight({ oppId: o.id, org: c.G.player.org, weeks: 8, title: false, purse: 5000, event: 'T' }, 'prueba');
    c.startCamp(c.G.nextFight); c.G.camp.i = c.G.camp.weeks; c.goFight();
    c.UI.sub = 'corner';
    c.RPG.replan('wrestling');
    eq(c.G.fight.gp.prio, 'wrestling', 'el plan no cambió');
    c.RPG.replan('counter');
    eq(c.G.fight.gp.prio, 'wrestling', 'se pudo cambiar dos veces');
  });
  test('Profesional impecable: los reemplazos de último momento pagan un 30 % más', () => {
    const c = carrera(33).ctx; conContrato(c);
    c.G.rpg.cnt.weighStreak = 6; c.RPG.checkTraits('prueba');
    ok(c.RPG.hasTrait('profesional'), 'no se ganó Profesional');
    const o = rival(c);
    /* el resto del embudo también toca la bolsa (piso, calor mediático): se
       compara la MISMA oferta con y sin el rasgo, no contra un número fijo */
    const bolsa = (conRasgo) => {
      if(!conRasgo){ delete c.G.rpg.traits.profesional; } else c.G.rpg.traits.profesional = { y: 2020, w: 1 };
      c.G.offers = [{ type: 'fight', oppId: o.id, org: c.G.player.org, weeks: 2, shortNotice: true, purse: 10000, event: 'T', txt: 'T' }];
      c.hookEmit('offers:made', {});
      const of = c.G.offers.find(x => x.oppId === o.id);
      return of ? of.purse : 0;
    };
    const sin = bolsa(false), con = bolsa(true);
    ok(sin > 0 && Math.abs(con / sin - 1.3) < 0.01, 'el reemplazo no paga un 30 % más: ' + sin + ' -> ' + con);
  });
  test('Alta presión: "Cortar el ring" deja de depender del estilo', () => {
    const c = carrera(34, { style: 'counter' }).ctx;
    const mv = c.CL.MOVES.cutring, A = { press: 0.3 }, ctx = { dist: 1.2 };
    ok(!mv.when(c.G.player, A, ctx), 'un contragolpeador ya podía cortar el ring');
    c.G.rpg.traits.alta_presion = { y: 2020, w: 1 };
    ok(mv.when(c.G.player, A, ctx), 'con el rasgo sigue sin poder');
  });
});

suite('RPG-4 · identidad, diario y legado', () => {
  test('la identidad sólo cambia si la nueva supera claramente a la vigente', () => {
    /* puntajes controlados: con los de una carrera real la brecha casi nunca
       cae cerca de 10 y la prueba no distinguía un umbral de 10 de uno de 0
       (lo mostró un mutante) */
    const c = carrera(40).ctx;
    c.G.player.rec.w = 8; c.G.pending = [];
    const base = c.RPG.identityScores();
    const con = (tec, pre) => () => Object.assign({}, base, { tecnico: tec, presion: pre,
      contra: 0, showman: 0, capitan: 0, veterano: 0, estratega: 0, errante: 0, constructor: 0, finalizador: 0 });
    c.G.rpg.ident.k = 'tecnico';
    c.RPG.identityScores = con(30, 36);           /* la nueva gana por 6 */
    c.RPG.weekCheck();
    eq(c.G.rpg.ident.k, 'tecnico', 'cambió de identidad por 6 puntos');
    ok(c.RPG.officialIdentity().trend === 'El Presionador', 'la tendencia no se muestra aunque la identidad no cambie');
    c.RPG.identityScores = con(30, 41);           /* la nueva gana por 11 */
    c.RPG.weekCheck();
    eq(c.G.rpg.ident.k, 'presion', 'no cambió aunque la nueva la supera por 11');
    eq(c.G.rpg.ident.hist[0].from, 'tecnico', 'el historial no registra de dónde venía');
  });
  test('el diario se arma con las secciones y sin texto roto', () => {
    const h = carrera(41); const c = h.ctx; conContrato(c);
    pelear(c, true, ['jab','combo']);
    c.UI.screen = 'diario'; c.render();
    const html = c.document.getElementById('app').innerHTML;
    for(const s of ['Carrera','Identidad','Personas','Rivalidades','Momentos','Legado'])
      ok(html.indexOf('<summary>' + s + '</summary>') >= 0, 'falta la sección ' + s);
    ok(!/undefined|NaN/.test(html.replace(/onclick="[^"]*"/g, '')), 'el diario dice undefined/NaN');
  });
  test('el final de carrera dice qué perfil fue', () => {
    const c = carrera(42).ctx; conContrato(c);
    pelear(c, true);
    c.retire();
    c.UI.screen = 'ending'; c.render();
    const html = c.document.getElementById('app').innerHTML;
    ok(html.indexOf('PERFIL DE CARRERA') >= 0, 'el final no muestra el perfil de carrera');
  });
  test('G.rpg sobrevive a guardar y cargar, y un save viejo lo completa', () => {
    const c = carrera(43).ctx; conContrato(c);
    c.RPG.echo('title_chase'); c.G.rpg.traits.guerra = { y: 2020, w: 3 };
    /* contadores distintos de cero: el replacer del guardado compacta toda
       clave llamada st/pot/lr, y un contador que vuelve como otro valor
       cambia rasgos e identidad sin que nada falle a la vista */
    Object.keys(c.G.rpg.cnt).forEach((k, i) => { c.G.rpg.cnt[k] = i + 1; });
    const antes = JSON.stringify(c.G.rpg);
    c.saveGame(true); const id = c.listSaves()[0].id;
    ok(c.loadGame(id), 'no cargó');
    eq(JSON.stringify(c.G.rpg), antes, 'G.rpg no vuelve idéntico del guardado');
    eq(c.RPG.echoCount('title_chase'), 1, 'se perdieron los ecos');
    ok(c.RPG.hasTrait('guerra'), 'se perdió un rasgo');
    delete c.G.rpg; c.RPG.S();
    ok(c.G.rpg && c.G.rpg.cnt && typeof c.G.rpg.cnt.fights === 'number', 'RPG.S() no completa una partida sin G.rpg');
  });
});
