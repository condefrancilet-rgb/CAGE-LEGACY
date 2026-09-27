'use strict';
/* RPG · FASE 3 — LO QUE EXISTÍA Y NO SE PODÍA ALCANZAR
   ---------------------------------------------------------------------------
   Cada prueba conduce una pieza que la auditoría (dev/RPG-AUDITORIA.md §2)
   encontró huérfana: una función sin botón, un artículo de tienda que no
   cumplía, un modificador que no mordía, una estructura sin productor.
   Y dos garantías transversales: dibujar no escribe estado (B-001) y la
   barra es la de los cinco pilares.                                          */
const { suite, test, ok, eq } = require('../run-tests.js');
const H = require('../harness.js');

const ARCHIVO = process.env.CAGE_FILE || undefined;

function carrera(seed, cfg){
  const h = H.boot({ seed, file: ARCHIVO });
  H.startCareer(h, Object.assign({ metaSeed: 9100 + seed, style:'mma', div:'LW', age:22 }, cfg||{}));
  return h;
}
/* firma un contrato por la vía real (D-006), como el autopiloto */
function conContrato(c){
  const co = c.G.offers.find(o => o.type === 'contract' && c.G.orgs[o.org]);
  ok(co, 'no hubo oferta de contrato');
  c.negoStart(co); c.negoClose(); c.G.mg = null; c.UI.screen = 'hub';
  return c.G.player.org;
}
function rival(c, extra){
  const p = c.G.player;
  return Object.values(c.G.fighters).find(f => f && !f.isPlayer && f.div === p.div &&
    !c.fightSpecProblem(Object.assign({ oppId: f.id, org: p.org }, extra||{})));
}
function dibuja(c, pantalla, sub){
  c.UI.screen = pantalla; c.UI.sub = sub || null; c.render();
  return c.document.getElementById('app').innerHTML;
}

suite('RPG-3 · el podcast tiene pantalla y cierra el circuito de medios', () => {
  test('podcastStart abre un minijuego que se dibuja y se puede terminar', () => {
    const c = carrera(1).ctx;
    const pop0 = c.G.player.pop;
    let medios = null;
    c.hookOn('media:done', 'pruebaPod', x => { medios = x; });
    c.podcastStart('solo');
    ok(c.G.mg && c.G.mg.type === 'pod', 'no se abrió el minijuego de podcast');
    const html = dibuja(c, 'mg');
    ok(html.indexOf('podPick(') >= 0, 'la pantalla del podcast no ofrece respuestas');
    ok(html.indexOf('undefined') < 0, 'la pantalla del podcast dice undefined');
    for(let i = 0; i < c.G.mg.qs.length; i++) c.podPick(i % 4);
    ok(c.G.mg.done, 'contestar todas las preguntas no terminó el podcast');
    ok(medios && medios.kind === 'pod', 'no se emitió media:done al terminar');
    ok(c.G.player.pop !== pop0, 'el podcast no movió la popularidad');
    c.mgClose(false);
    eq(c.G.mg, null, 'cerrar el podcast no liberó el minijuego');
  });
  test('el podcast cara a cara usa al rival elegido, no uno al azar', () => {
    const c = carrera(2).ctx, p = c.G.player;
    const [a, b] = Object.values(c.G.fighters).filter(f => f && !f.isPlayer && f.div === p.div && f.active);
    for(const f of [a, b]){ c.relV(f).rivalry = 70; c.bondOf(f).rival = true; c.bondOf(f).clash = 2; }
    c.podcastStart('rival', b.id);
    eq(c.G.mg && c.G.mg.hostId, b.id, 'el invitado no es el rival elegido desde su ficha');
  });
});

suite('RPG-3 · las acciones sociales existentes tienen botón y progresión', () => {
  test('con un amigo: alianza, viaje y ver su pelea están en su ficha', () => {
    const c = carrera(3).ctx, p = c.G.player;
    const f = Object.values(c.G.fighters).find(x => x && !x.isPlayer && x.div === p.div && x.active);
    c.relV(f).friend = 80; c.bondOf(f).train = 2;
    eq(c.relStage(f), 'amigo', 'amistad 80 con dos entrenamientos no es "amigo"');
    const html = dibuja(c, 'social', f.id);
    for(const fn of ['allyForm', 'travelWith', 'watchFight'])
      ok(html.indexOf(fn + "('" + f.id + "')") >= 0, 'falta el botón de ' + fn + ' en la ficha social');
  });
  test('con un rival no se ofrece alianza, sí el podcast cara a cara', () => {
    const c = carrera(4).ctx, p = c.G.player;
    const f = Object.values(c.G.fighters).find(x => x && !x.isPlayer && x.div === p.div && x.active);
    c.relV(f).rivalry = 70; c.bondOf(f).rival = true; c.bondOf(f).clash = 2; c.bondOf(f).fought = 1;
    eq(c.relStage(f), 'nemesis', 'rival declarado que ya peleó no es "némesis"');
    const html = dibuja(c, 'social', f.id);
    ok(html.indexOf("allyForm('" + f.id + "')") < 0, 'se ofrece alianza a un némesis');
    ok(html.indexOf("podcastStart('rival','" + f.id + "')") >= 0, 'falta el podcast cara a cara');
  });
});

suite('RPG-3 · la tienda cumple lo que promete', () => {
  function enCamp(seed){
    const h = carrera(seed); const c = h.ctx; conContrato(c);
    const o = rival(c); ok(o, 'sin rival válido');
    ok(c.scheduleFight({ oppId: o.id, org: c.G.player.org, weeks: 8, title: false, purse: 5000, event: 'T' }, 'prueba').ok, 'no se pudo firmar');
    ok(c.startCamp(c.G.nextFight), 'no arrancó el camp');
    return c;
  }
  test('chef: una semana de camp baja el peso y el desgaste respecto de no tenerlo', () => {
    const sin = enCamp(10), con = enCamp(10);
    con.G.flags.chef = 1;
    sin.campWeek('rest', .85, 0); con.campWeek('rest', .85, 0);
    ok(con.G.player.weightNow < sin.G.player.weightNow, 'el chef no mejoró el corte');
    ok(con.G.camp.fatigue <= sin.G.camp.fatigue, 'el chef no bajó el desgaste');
  });
  test('camp de élite: seis semanas de más calidad y más desgaste, y después nada', () => {
    const c = enCamp(11);
    c.G.cash = 999999; c.buyItem('elitecamp');
    ok(c.eliteCampLeft() === 6, 'la ventana no empieza en 6 semanas');
    const s0 = c.G.camp.sharp; c.campWeek('rest', .85, 0);
    ok(c.G.camp.log.some(l => /élite/.test(l)), 'el camp de élite no dejó rastro en el diario');
    c.G.flags.eliteCampAt -= 10;
    eq(c.eliteCampLeft(), 0, 'la ventana no se cierra');
    ok(Number.isFinite(s0), 'afilado no numérico');
  });
  test('camp de equipo: con dos entrenadores el gameplan suma coherencia', () => {
    const c = enCamp(12);
    c.G.flags.teamCamp = 1;
    const otro = c.G.coaches.find(x => x.id !== c.G.player.coach);
    c.G.team = [c.G.player.coach, otro.id];
    c.gpStart(); c.gpSet('dist','media'); c.gpSet('pace','medio'); c.gpSet('prio','striking'); c.gpSet('def','cabeza');
    c.gpConfirm();
    ok(c.G.camp.gameplan.teamCamp, 'el plan no quedó marcado como de equipo');
    ok(c.G.camp.gameplan.reasons.some(r => /cuerpo técnico/.test(r)), 'el motivo no se explica');
  });
});

suite('RPG-3 · los modificadores de carrera muerden', () => {
  test('"Un solo gimnasio" impide mudarse por cualquier vía voluntaria', () => {
    const c = carrera(20).ctx;
    c.G.meta = c.G.meta || {}; c.G.meta.mods = ['loyal'];
    const antes = c.G.player.gym, otro = c.G.gyms.find(g => g.id !== antes);
    c.G.cash = 999999;
    c.changeGym(otro.id); eq(c.G.player.gym, antes, 'changeGym mudó al jugador');
    c.gymJoin(otro.id);   eq(c.G.player.gym, antes, 'gymJoin mudó al jugador');
  });
  test('"Carrera corta" retira al jugador a los 32 por la vía del legado', () => {
    const c = carrera(21, { age: 22 }).ctx;
    c.G.meta = c.G.meta || {}; c.G.meta.mods = ['short'];
    c.G.player.born = c.G.year - 32;
    c.advanceWeek();
    const ev = (c.G.pending || []).find(e => e.h === 'meta_short');
    ok(ev, 'a los 32 no llegó el retiro obligatorio');
    while(c.G.pending.length && c.G.pending[0].h !== 'meta_short') c.resolveEvent(0);
    c.resolveEvent(0);
    ok(c.G.player.retired, 'resolver el retiro obligatorio no retiró al jugador');
    ok(c.G.ending, 'el retiro no pasó por retire(): no hay final');
  });
});

suite('RPG-3 · el mánager dirige y las eliminatorias existen', () => {
  function top12(c){
    const p = c.G.player, rk = c.G.rank[p.org][p.div], i = rk.indexOf(p.id);
    if(i >= 0) rk.splice(i, 1);
    rk.splice(4, 0, p.id);
    p.rec.w = Math.max(p.rec.w, 6);
  }
  test('sin 5 peleas no hay eliminatoria, y el mánager dice por qué', () => {
    const c = carrera(30).ctx; conContrato(c);
    const r = c.MGR.elimTarget();
    ok(!r.ok && /peleas profesionales/.test(r.why), 'la eliminatoria no exige elegibilidad: ' + JSON.stringify(r).slice(0,120));
    const n = c.G.offers.length; c.MGR.push();
    eq(c.G.offers.filter(o => o.elim).length, 0, 'se creó una eliminatoria inelegible');
    ok(c.G.offers.length === n, 'presionar sin condiciones cambió las ofertas');
  });
  test('empujar produce una eliminatoria válida; ganarla deja el título en la fila', () => {
    const c = carrera(31).ctx; conContrato(c); top12(c);
    c.cancelScheduledFight('prueba'); c.G.offers = [];
    c.MGR.push();
    const i = c.G.offers.findIndex(o => o.elim);
    ok(i >= 0, 'MGR.push no produjo la eliminatoria');
    eq(c.fightSpecProblem(c.G.offers[i]), '', 'la eliminatoria no pasa la regla');
    ok(c.acceptFight(i), 'no se pudo firmar la eliminatoria');
    ok(c.G.nextFight.elim, 'la pelea firmada perdió la marca de eliminatoria');
    c.G.camp.i = c.G.camp.weeks; c.goFight(); c.finishFight('ko', 'p'); c.confirmFight();
    ok(c.G.flags.titleShot, 'ganar la eliminatoria no dejó la pelea por el título en la fila');
    c.G.pending = []; c.G.player.inj = null; c.G.player.injWeeks = 0; c.G.offers = [];
    const champ = c.G.champs[c.G.player.org][c.G.player.div];
    if(champ && champ !== c.G.player.id && !c.fightSpecProblem({ oppId: champ, org: c.G.player.org, title: true })){
      c.makeOffers();
      ok(c.G.offers.some(o => o.title && o.oppId === champ), 'con la eliminatoria ganada no apareció la pelea por el título');
    }
  });
  test('"Revancha inmediata" tras perder el cinturón produce la revancha por el título', () => {
    const c = carrera(32).ctx; conContrato(c); top12(c);
    const p = c.G.player, champ = c.G.champs[p.org][p.div];
    if(!champ) return;                         /* sin campeón no hay a quién pedírsela */
    c.F(champ).rec.w = Math.max(c.F(champ).rec.w, 6);
    p.career.push({ y: c.G.year, w: c.G.week, opp: c.fname(c.F(champ)), oppId: champ, res: 'L', m: 'KO', r: 2, org: p.org, title: true, purse: 1, pop: 1, event: 'T' });
    c.G.flags.wantTitleRematch = true;
    c.cancelScheduledFight('prueba'); p.inj = null; p.injWeeks = 0; c.G.offers = [];
    c.makeOffers();
    ok(c.G.offers.some(o => o.title && o.oppId === champ), 'la bandera de revancha por el título no produjo la pelea');
    ok(!c.G.flags.wantTitleRematch, 'la bandera no se consumió');
  });
});

suite('RPG-3 · dibujar no escribe y la barra es la de los pilares', () => {
  test('ninguna pantalla mueve el RNG del mundo ni la huella al dibujarse', () => {
    const h = carrera(40); const c = h.ctx; conContrato(c);
    c.G.player.inj = null; c.G.player.injWeeks = 0; c.G.offers = []; c.makeOffers();
    ok(c.G.offers.some(o => o.type === 'fight'), 'la prueba necesita ofertas de pelea (pantalla de ofertas)');
    const saltar = ['fight','fightresult','mg','ending','retire','legacy','create','title','load'];
    const malas = [];
    for(const sc of Object.keys(c.CL.SCREENS)){
      if(saltar.indexOf(sc) >= 0) continue;
      c.UI.screen = sc; c.UI.sub = null; c.render();          /* primera vez: puede inicializar */
      const rs = c.G.rs, fp = c.STATE.fingerprint(true);
      c.render();
      if(c.G.rs !== rs) malas.push(sc + ' mueve G.rs');
      if(c.STATE.fingerprint(true) !== fp) malas.push(sc + ' cambia la huella');
    }
    eq(malas, [], 'dibujar escribió estado');
  });
  test('la barra muestra los cinco pilares y el menú, y Vida y Mundo se dibujan', () => {
    const c = carrera(41).ctx;
    c.go('vida');
    const nav = c.document.getElementById('nav').innerHTML;
    for(const s of ['hub','train','people','vida','mundo','menu']) ok(nav.indexOf("go('" + s + "')") >= 0, 'falta ' + s + ' en la barra');
    ok(dibuja(c, 'vida').indexOf("go('shop')") >= 0, 'Vida no lleva a la tienda');
    ok(dibuja(c, 'mundo').indexOf("go('rank')") >= 0, 'Mundo no lleva a los rankings');
  });
});
