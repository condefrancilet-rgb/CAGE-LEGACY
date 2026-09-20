'use strict';
/* Bugs que quedaron abiertos tras F2. Cada bloque describe el defecto, la
   medicion de cuanto ocurre en juego real, y lo que la correccion garantiza. */
const { suite, test, ok, eq } = require('../run-tests.js');
const H = require('../harness.js');

function mundo(seed, cfg){
  const h = H.boot({ seed });
  H.startCareer(h, Object.assign({ metaSeed: 5150, style:'mma', div:'LW', age:22 }, cfg||{}));
  return { h, c: h.ctx };
}

suite('G-004 · el sorteo no tiene efectos si la cola lo va a rechazar', () => {

  /* fireEvent() era `queueEvent(rollEvent())`: JS evalua rollEvent() ANTES de
     que queueEvent mire si hay sitio. Sortear no es gratis — escribe la veda de
     26 semanas en eventHistory y sel.x() muta los temporales compartidos
     (G.tmpOpp, G.tmpSpon...) que el evento YA en pantalla va a leer cuando el
     jugador elija. Resultado: una veda quemada por un evento que nadie vio, y
     el pendiente resolviendose contra el peleador equivocado.

     Medido: en 4 carreras x 300 semanas, 378 llamadas a fireEvent y 0 con la
     cola ocupada. El defecto es LATENTE: los dos llamadores de hoy comprueban
     la cola por su cuenta. Lo que se arregla es que la regla viva dentro de
     fireEvent, para que un tercer llamador no pueda equivocarse. */

  test('con la cola ocupada, fireEvent no sortea nada', () => {
    const { c } = mundo(4001);
    /* se ocupa la cola con un evento cualquiera del banco */
    const def = c.EVENTS.filter(e => e && e.id)[0];
    c.G.pending = [{ id: def.id, txt: 'ocupado', opts: def.o }];
    const vedasAntes = c.G.story.eventHistory.length;
    const tmpAntes = { opp: c.G.tmpOpp, spon: c.G.tmpSpon, amt: c.G.tmpAmt };
    for(let i = 0; i < 25; i++) c.fireEvent();
    eq(c.G.story.eventHistory.length, vedasAntes,
       'fireEvent sorteo con la cola ocupada y quemo ' +
       (c.G.story.eventHistory.length - vedasAntes) + ' vedas');
    eq(c.G.tmpOpp,  tmpAntes.opp,  'el sorteo piso G.tmpOpp con la cola ocupada');
    eq(c.G.tmpSpon, tmpAntes.spon, 'el sorteo piso G.tmpSpon con la cola ocupada');
    eq(c.G.tmpAmt,  tmpAntes.amt,  'el sorteo piso G.tmpAmt con la cola ocupada');
  });

  test('con la cola ocupada, fireEvent no toca la cola', () => {
    const { c } = mundo(4002);
    const def = c.EVENTS.filter(e => e && e.id)[0];
    const puesto = { id: def.id, txt: 'ocupado', opts: def.o };
    c.G.pending = [puesto];
    c.fireEvent();
    eq(c.G.pending.length, 1, 'fireEvent apilo un segundo evento en la cola');
    eq(c.G.pending[0], puesto, 'fireEvent reemplazo el evento que ya estaba en pantalla');
  });

  test('con la cola libre sigue encolando, como siempre', () => {
    const { c } = mundo(4003);
    c.G.pending = [];
    let encolo = 0;
    for(let i = 0; i < 30 && !encolo; i++){ c.fireEvent(); if(c.G.pending.length) encolo = 1; }
    eq(encolo, 1, 'fireEvent dejo de encolar con la cola libre: la guarda es demasiado estricta');
  });

  test('sin partida no lanza', () => {
    const h = H.boot({ seed: 4004 });
    let lanzo = false;
    try { h.ctx.fireEvent(); } catch(e){ lanzo = true; }
    ok(!lanzo, 'fireEvent lanzo sin partida empezada');
  });

});

suite('D-007 · terminar una pelea ya terminada no hace nada', () => {

  /* finishFight() no comprobaba f.over, la guarda que si tienen fightAct,
     tkoCheck y tqPasivas. Una segunda llamada sobrescribia f.result, volvia a
     consumir RNG -chance(.5) para KO/TKO, o tres rnd() para la decision- y
     redibujaba. Hoy lo tapan los llamadores, pero es el mismo agujero que
     D-001 y D-002 ya costaron en la via de cobro. */

  function peleaTerminada(seed){
    const { h, c } = mundo(seed);
    const p = c.G.player;
    const opp = Object.values(c.G.fighters)
      .find(f => f && f.div === p.div && f.id !== p.id && !f.retired);
    c.G.nextFight = { oppId: opp.id, weeks: 0, org: p.org, title: false, purse: 8000, event: 'T' };
    c.startCamp(c.G.nextFight);
    c.G.camp.i = c.G.camp.weeks;
    c.goFight();
    c.finishFight('ko', 'p');
    ok(c.G.fight && c.G.fight.over, 'la pelea no quedo terminada');
    return { h, c };
  }

  test('una segunda llamada no reescribe el resultado', () => {
    const { c } = peleaTerminada(4101);
    const antes = JSON.stringify(c.G.fight.result);
    c.finishFight('sub', 'o');
    eq(JSON.stringify(c.G.fight.result), antes,
       'la segunda llamada reescribio el resultado de la pelea');
  });

  test('una segunda llamada no consume RNG ni mueve el estado', () => {
    const { c } = peleaTerminada(4102);
    const huella = c.STATE.fingerprint(true);
    for(let i = 0; i < 5; i++) c.finishFight('ko', 'o');
    eq(c.STATE.fingerprint(true), huella,
       'terminar una pelea ya terminada movio el estado');
  });

  test('tambien por la via de la decision', () => {
    const { c } = peleaTerminada(4103);
    const antes = JSON.stringify(c.G.fight.result);
    const huella = c.STATE.fingerprint(true);
    c.finishFight('dec', null);
    eq(JSON.stringify(c.G.fight.result), antes,
       'la via de decision reescribio el resultado');
    eq(c.STATE.fingerprint(true), huella,
       'la via de decision movio el estado de una pelea ya terminada');
  });

  test('la primera llamada sigue funcionando', () => {
    /* Se termina por KO, no por sumision: una sumision NO es un final
       garantizado. El hook 'sumision' abre una batalla de posiciones y el
       defensor puede escapar o aguantar, en cuyo caso finishFight devuelve
       false y la pelea sigue. Es una regla del juego, no un fallo — lo
       comprobe al depurar, porque la primera version de esta prueba usaba
       'sub' y fallaba por eso. */
    const { c } = mundo(4104);
    const p = c.G.player;
    const opp = Object.values(c.G.fighters)
      .find(f => f && f.div === p.div && f.id !== p.id && !f.retired);
    c.G.nextFight = { oppId: opp.id, weeks: 0, org: p.org, title: false, purse: 8000, event: 'T' };
    c.startCamp(c.G.nextFight); c.G.camp.i = c.G.camp.weeks; c.goFight();
    c.finishFight('ko', 'p');
    ok(c.G.fight.over, 'la pelea no se marco como terminada');
    ok(c.G.fight.result, 'la pelea no produjo resultado');
    eq(c.G.fight.result.winner, 'p', 'el ganador no es el que se paso');
    eq(c.G.fight.result.method, 'ko', 'el metodo no es el que se paso');
  });

  test('una sumision puede no terminar la pelea, y eso no es el bug', () => {
    /* Fija la regla que me hizo tropezar, para que quede dicha: con el rival
       de pie, RES.subLock puede devolver escape o trabada, finishFight
       devuelve false y la pelea continua. */
    const { c } = mundo(4105);
    const p = c.G.player;
    const opp = Object.values(c.G.fighters)
      .find(f => f && f.div === p.div && f.id !== p.id && !f.retired);
    c.G.nextFight = { oppId: opp.id, weeks: 0, org: p.org, title: false, purse: 8000, event: 'T' };
    c.startCamp(c.G.nextFight); c.G.camp.i = c.G.camp.weeks; c.goFight();
    const r = c.finishFight('sub', 'p');
    if(!r){
      eq(c.G.fight.over, false, 'finishFight devolvio false pero dejo la pelea terminada');
      eq(c.G.fight.result, null, 'finishFight devolvio false pero dejo resultado');
    } else {
      ok(c.G.fight.over, 'finishFight devolvio algo distinto de false sin terminar la pelea');
    }
  });

});

suite('D-010 · la pantalla de resultado no llama derrota a un empate', () => {

  /* scrFightResult calculaba `won = res.winner==='p'`, sin tercer estado, asi
     que un empate (winner==='d') caia en la rama de derrota y pintaba
     "DERROTA" y "PERDISTE" — ademas de atribuirle la pelea al rival, "<rival>
     por empate unanime". La capa de arriba antepone una tarjeta "EMPATE"
     correcta, asi que el jugador veia los dos mensajes contradictorios en la
     misma pantalla.

     Medido en 200 carreras x 300 semanas: 108 empates de 4779 peleas (2,26%),
     y 85 de las 200 carreras tienen al menos uno. No es un caso raro. */

  function pantallaConEmpate(seed){
    const { c } = mundo(seed);
    const p = c.G.player;
    const opp = Object.values(c.G.fighters)
      .find(f => f && f.div === p.div && f.id !== p.id && !f.retired);
    c.G.nextFight = { oppId: opp.id, weeks: 0, org: p.org, title: false, purse: 8000, event: 'T' };
    c.startCamp(c.G.nextFight); c.G.camp.i = c.G.camp.weeks; c.goFight();
    c.G.fight.over = true;
    c.G.fight.result = { winner: 'd', method: 'dec', methodEs: 'empate unánime',
                         round: c.G.fight.rounds, cards: ['d','d','d'] };
    return { c, html: c.scrFightResult(), opp };
  }

  test('no dice DERROTA ni PERDISTE en un empate', () => {
    const { html } = pantallaConEmpate(4201);
    ok(html.indexOf('DERROTA') < 0, 'la pantalla dice DERROTA en un empate');
    ok(html.indexOf('PERDISTE') < 0, 'la pantalla dice PERDISTE en un empate');
  });

  test('dice EMPATE', () => {
    const { html } = pantallaConEmpate(4202);
    ok(html.indexOf('EMPATE') >= 0, 'la pantalla no dice EMPATE en un empate');
  });

  test('no le atribuye la pelea al rival', () => {
    const { c, html, opp } = pantallaConEmpate(4203);
    const nombre = c.fname(opp);
    ok(html.indexOf(nombre + ' por ') < 0,
       'la pantalla dice "' + nombre + ' por empate...": le da la pelea al rival');
  });

  test('la victoria y la derrota siguen diciendo lo suyo', () => {
    const { c } = mundo(4204);
    const p = c.G.player;
    const opp = Object.values(c.G.fighters)
      .find(f => f && f.div === p.div && f.id !== p.id && !f.retired);
    c.G.nextFight = { oppId: opp.id, weeks: 0, org: p.org, title: false, purse: 8000, event: 'T' };
    c.startCamp(c.G.nextFight); c.G.camp.i = c.G.camp.weeks; c.goFight();
    c.G.fight.over = true;

    c.G.fight.result = { winner: 'p', method: 'ko', methodEs: 'KO', round: 1 };
    let h = c.scrFightResult();
    ok(h.indexOf('VICTORIA') >= 0, 'una victoria ya no dice VICTORIA');
    ok(h.indexOf('GANASTE') >= 0, 'una victoria ya no dice GANASTE');
    ok(h.indexOf('EMPATE') < 0, 'una victoria dice EMPATE');

    c.G.fight.result = { winner: 'o', method: 'ko', methodEs: 'KO', round: 1 };
    h = c.scrFightResult();
    ok(h.indexOf('DERROTA') >= 0, 'una derrota ya no dice DERROTA');
    ok(h.indexOf('PERDISTE') >= 0, 'una derrota ya no dice PERDISTE');
    ok(h.indexOf('EMPATE') < 0, 'una derrota dice EMPATE');
  });

});

suite('C-006 · el descanso de skipWeek sobrevive al guardado', () => {

  /* skipWeek era: finishWeek(...) y DESPUES restar 12 de fatiga. finishWeek
     cierra la semana, y cerrar guarda. Asi que el save se escribia con la
     fatiga vieja y recargar evaporaba los 12 puntos de descanso, que son el
     unico efecto de la accion.

     El arreglo NO puede ser restar antes de finishWeek: advanceWeek aplica su
     propia recuperacion, y adelantar la resta cambia el resultado cuando esa
     recuperacion no es una constante. La resta tiene que ir DESPUES de avanzar
     la semana y ANTES de guardar. */

  test('recargar conserva el descanso', () => {
    const { c } = mundo(4301);
    c.G.player.fatigue = 60;
    c.skipWeek();
    const enMemoria = c.G.player.fatigue;
    const slots = c.listSaves();
    ok(slots.length, 'skipWeek no dejo ningun guardado');
    ok(c.loadGame(slots[0].id), 'no se pudo recargar el guardado de skipWeek');
    eq(c.G.player.fatigue, enMemoria,
       'recargar devolvio fatiga ' + c.G.player.fatigue + ' y en memoria era ' + enMemoria +
       ': el descanso se evaporo al guardar');
  });

  test('el descanso se aplica de verdad', () => {
    const { c } = mundo(4302);
    c.G.player.fatigue = 60;
    const antes = c.G.player.fatigue;
    c.skipWeek();
    ok(c.G.player.fatigue < antes,
       'skipWeek no bajo la fatiga: ' + antes + ' -> ' + c.G.player.fatigue);
  });

  test('la fatiga sigue acotada a 0', () => {
    const { c } = mundo(4303);
    c.G.player.fatigue = 3;
    c.skipWeek();
    ok(c.G.player.fatigue >= 0, 'la fatiga quedo negativa: ' + c.G.player.fatigue);
  });

});

suite('F-003 · el blob heredado se migra de verdad, no se sella', () => {

  /* migrateLegacyBlob hacia `saveExpand(g); savePrune(g); g.saveVersion=4;`
     sin llamar a saveMigrate, ni a SAVE_STEPS, ni a saveValidateV4. Un save v1
     quedaba ETIQUETADO v4 sin haber pasado por ningun paso: al cargarlo,
     saveShape decia "al dia" y se aplicaban CERO migraciones. socCD, trainRec,
     mgStats y sagas quedaban undefined en una partida que el juego cree
     correcta. */

  /* Un guardado v1 minimo dentro del blob viejo. */
  function blobV1(c){
    c.saveGame(true);
    const id = c.listSaves()[0].id;
    const g = JSON.parse(JSON.stringify(c.G));
    /* se le quita todo lo que introdujeron v2, v3 y v4 */
    g.saveVersion = 1;
    delete g.socCD; delete g.trainRec; delete g.mgStats; delete g.sagas; delete g.soc;
    const blob = {};
    blob['legacy1'] = { name: 'Heredada', data: JSON.stringify(g), meta: 'importada' };
    c.localStorage.setItem(c.SAVEKEY, JSON.stringify(blob));
    /* se limpia el indice para que la migracion no la crea ya migrada */
    c.localStorage.removeItem(c.SAVE_ONE + id);
    return 'legacy1';
  }

  test('una partida v1 del blob pasa por los pasos de migracion', () => {
    const { c } = mundo(4401);
    const id = blobV1(c);
    c.migrateLegacyBlob();
    const crudo = c.localStorage.getItem(c.SAVE_ONE + id);
    ok(crudo, 'la partida heredada no se escribio');
    const g = JSON.parse(crudo);
    const cuerpo = g && g.G ? g.G : g;
    ok(cuerpo.socCD && typeof cuerpo.socCD === 'object',
       'socCD quedo sin migrar: la partida se sello v4 sin aplicar v3->v4');
    ok(cuerpo.trainRec && typeof cuerpo.trainRec === 'object',
       'trainRec quedo sin migrar: no se aplico v1->v2');
    ok(cuerpo.mgStats && typeof cuerpo.mgStats === 'object',
       'mgStats quedo sin migrar: no se aplico v2->v3');
  });

  test('la partida migrada carga y queda jugable', () => {
    const { c } = mundo(4402);
    const id = blobV1(c);
    c.migrateLegacyBlob();
    ok(c.loadGame(id), 'la partida migrada desde el blob no carga');
    ok(c.G && c.G.player, 'la partida migrada carga sin jugador');
    ok(c.G.socCD && typeof c.G.socCD === 'object', 'socCD sigue ausente tras cargar');
  });

});
