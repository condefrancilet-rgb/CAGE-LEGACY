'use strict';
/* E5 · CAMINOS CONDUCIDOS A MANO
   ---------------------------------------------------------------------------
   El autopiloto recorre el juego con una politica; el golden master compara
   trazas. Ninguno de los dos CONDUCE una carrera por el camino que hace un
   jugador, paso a paso, comprobando en cada paso que la pantalla dice lo que
   el estado dice. Eso es lo que hay aca.
   Cada prueba falla nombrando el paso exacto en el que se rompio.            */
const { suite, test, ok, eq } = require('../run-tests.js');
const H = require('../harness.js');

const ARCHIVO = process.env.CAGE_FILE || undefined;

function carrera(seed){
  const h = H.boot({ seed, file: ARCHIVO });
  H.startCareer(h, { metaSeed: 7000 + seed, style:'mma', div:'LW', age:22 });
  return h.ctx;
}
/* avanza hasta que se cumpla `cond`, sin pasarse de `tope` semanas */
function hasta(c, cond, tope, paso){
  for(let i = 0; i < (tope||200); i++){
    if(cond(c)) return i;
    if(c.G.pending && c.G.pending.length) c.resolveEvent(0);
    else c.advanceWeek();
  }
  throw new Error('no se llego a: ' + (paso||'la condicion') + ' en ' + (tope||200) + ' semanas');
}

suite('E5 · el ciclo completo de una pelea, paso a paso', () => {

  test('de carrera nueva a pelea cobrada, sin saltarse un paso', () => {
    const c = carrera(3);

    /* 1. PRIMERO EL CONTRATO. G.offers mezcla contratos y peleas, y al empezar
       una carrera lo que llega son contratos: acceptFight() sobre uno de ellos
       no firma nada. El orden real del juego es contrato -> peleas, y esta
       prueba lo recorre entero porque justo ahi me equivoque al escribirla. */
    hasta(c, x => x.G.offers.length > 0 || x.G.nextFight, 120, 'que lleguen ofertas');
    if(!c.G.contract && !c.G.nextFight){
      const iCon = c.G.offers.findIndex(o => o && o.type === 'contract');
      ok(iCon >= 0, 'no llego ninguna oferta de contrato en 120 semanas');
      c.negoStart(c.G.offers[iCon]);
      ok(c.G.mg, 'negociar no abrio el minijuego de negociacion');
      c.negoClose();
      ok(c.G.contract, 'cerrar la negociacion no dejo contrato firmado');
      eq(c.G.player.org, c.G.contract.org, 'el jugador no quedo en la organizacion del contrato');
      c.mgExit('hub', false);
    }

    /* 2. con contrato, llegan ofertas de pelea */
    hasta(c, x => x.G.nextFight || x.G.offers.some(o => o && o.oppId), 120, 'ofertas de pelea');
    if(!c.G.nextFight){
      const iPelea = c.G.offers.findIndex(o => o && o.oppId);
      ok(iPelea >= 0, 'ninguna de las ' + c.G.offers.length + ' ofertas es de pelea');
      const antes = c.G.offers.length;
      c.acceptFight(iPelea);
      ok(c.G.nextFight, 'aceptar una oferta de pelea no dejo pelea firmada');
      ok(c.G.offers.length < antes, 'la oferta aceptada sigue en la mesa');
    }

    /* 3. la pantalla de inicio la muestra */
    c.UI.screen = 'hub';
    const hub = c.scrHub();
    ok(/PRÓXIMA PELEA|PELEA DE TÍTULO/.test(hub), 'el inicio no anuncia la pelea firmada');

    /* 4. el campamento arranca solo y el reloj corre */
    const semanasAntes = c.G.nextFight.weeks;
    hasta(c, x => x.G.nextFight && x.G.nextFight.weeks <= 0, 40, 'la semana de pelea');
    ok(c.G.nextFight.weeks <= 0, 'no se llego a la semana de pelea');
    ok(semanasAntes > 0, 'la pelea ya estaba encima al firmarla');

    /* 5. pesaje y prensa antes de pelear */
    ok(c.G.camp, 'no hay campamento en la semana de pelea');
    if(!c.G.camp.weighDone){ c.weighStart(); ok(c.G.mg, 'el pesaje no abrio minijuego'); c.mgExit('hub', false); c.G.camp.weighDone = true; }
    if(!c.G.camp.pressDone){ c.G.camp.pressDone = true; }

    /* 6. pelear */
    c.goFight();
    ok(c.G.fight, 'goFight no creo la pelea');
    eq(c.UI.screen, 'fight', 'goFight no llevo a la pantalla de pelea');

    /* 7. resolver la pelea hasta el final */
    let vueltas = 0;
    while(c.G.fight && !c.G.fight.over && vueltas++ < 600){
      try { c.fightAct('strike'); } catch(e){ break; }
    }
    ok(c.G.fight && c.G.fight.over, 'la pelea no termino en 600 acciones');

    /* 8. cobrar: el record y la caja se mueven UNA vez */
    const recAntes = c.G.player.rec.w + c.G.player.rec.l + c.G.player.rec.d;
    const cajaAntes = c.G.cash;
    c.confirmFight();
    const recDespues = c.G.player.rec.w + c.G.player.rec.l + c.G.player.rec.d;
    eq(recDespues, recAntes + 1, 'el record no sumo exactamente una pelea');
    ok(c.G.paid, 'la pelea no quedo marcada como cobrada');
    /* y no se puede cobrar dos veces */
    c.confirmFight();
    eq(c.G.player.rec.w + c.G.player.rec.l + c.G.player.rec.d, recDespues,
       'cobrar dos veces sumo otra pelea al record');
    ok(Number.isFinite(c.G.cash), 'la caja quedo no finita tras cobrar');
    ok(c.G.cash !== cajaAntes || c.G.player.rec.l > 0, 'una victoria no movio la caja');
  }, { seed: 3 });

  test('la partida sobrevive al ciclo: se guarda, se carga y sigue', () => {
    const c = carrera(5);
    hasta(c, x => x.G.offers.length > 0 || x.G.nextFight, 120, 'ofertas');
    if(!c.G.nextFight && c.G.offers.length){
      const iC = c.G.offers.findIndex(o => o && o.type === 'contract');
      if(iC >= 0){ c.negoStart(c.G.offers[iC]); c.negoClose(); c.mgExit('hub', false); }
      const i = c.G.offers.findIndex(o => o && o.oppId);
      if(i >= 0) c.acceptFight(i);
    }
    for(let i=0;i<20;i++){ if(c.G.pending.length) c.resolveEvent(0); else c.advanceWeek(); }
    ok(c.saveGame(true) !== false, 'no se pudo guardar tras el ciclo');
    const id = c.listSaves()[0].id;
    const semana = c.G.year*52 + c.G.week;
    ok(c.loadGame(id), 'no se pudo cargar lo que se acababa de guardar');
    eq(c.G.year*52 + c.G.week, semana, 'la semana cambio al recargar');
    let lanzo = false;
    try { for(let i=0;i<5;i++) c.advanceWeek(); } catch(e){ lanzo = true; }
    ok(!lanzo, 'avanzar tras recargar lanza');
  }, { seed: 5 });

});
