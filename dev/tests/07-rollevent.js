'use strict';
/* CARACTERIZACION de rollEvent antes de consolidar sus 4 capas.
   Estas pruebas NO describen lo que deberia hacer: describen lo que hace HOY,
   para que la consolidacion tenga una referencia. La escalera de relajacion
   medida es:
     nivel 1  veda de 26 semanas + contexto + categoria + drama + c()
     nivel 2  veda de  8 semanas + contexto +             drama + c()
     nivel 3  sin veda           + contexto +             drama + c()
   El nivel 3 NO se dispara nunca en juego real: medido, 328 de 328 sorteos en
   8 carreras x 150 semanas salieron por los niveles 1 y 2. Hay que forzar el
   pool agotado para ejercitarlo.
   Escritas contra las 4 capas encadenadas y siguen valiendo contra la funcion
   unica que las sustituye: lo unico que cambio es como se mide que nivel
   resolvio el sorteo (antes, si el historial crecia; ahora, CL.evNivel()).   */
const { suite, test, ok, eq } = require('../run-tests.js');
const H = require('../harness.js');

suite('rollEvent (caracterizacion)', () => {

  function mundo(seed){
    const h = H.boot({ seed });
    H.startCareer(h, { metaSeed: 4242, style: 'mma', div: 'LW', age: 23 });
    return { h, c: h.ctx };
  }
  /* Veta los 66 eventos esta misma semana: vacia los niveles 1 y 2. */
  function agotarPool(c){
    const at = c.G.year * 52 + c.G.week;
    c.G.story.eventHistory = c.EVENTS.map(e => ({ id: e.id, category: 'x', at: at, y: c.G.year, w: c.G.week }));
  }
  const def = (c, id) => c.EVENTS.filter(function(x){ return x.id === id; })[0];

  test('en juego normal el sorteo nunca baja al nivel 3', () => {
    const A = require('../autopilot.js');
    const { h, c } = mundo(601);
    const porNivel = [0, 0, 0, 0];
    let conEvento = 0;
    const orig = c.rollEvent;
    c.rollEvent = function(){
      const r = orig();
      if(r){ conEvento++; porNivel[c.CL.evNivel()]++; }
      return r;
    };
    A.correrCarrera(h, { maxWeeks: 120, politica: 'basica', seedPolitica: 601 });
    ok(conEvento > 10, 'no se sortearon suficientes eventos: ' + conEvento);
    eq(porNivel[3], 0, porNivel[3] + ' de ' + conEvento + ' sorteos bajaron al nivel 3');
    ok(porNivel[1] + porNivel[2] === conEvento,
       'algun sorteo no quedo atribuido a un nivel: ' + JSON.stringify(porNivel));
  });

  test('con el pool agotado sigue devolviendo un evento, por el nivel 3', () => {
    const { c } = mundo(602);
    agotarPool(c);
    const r = c.rollEvent();
    ok(r && r.id, 'con el pool agotado no devolvio nada');
    ok(def(c, r.id), 'devolvio un evento que no esta en el banco: ' + r.id);
    eq(c.CL.evNivel(), 3, 'el pool agotado deberia resolverse por el nivel 3');
  });

  test('con el pool agotado el objeto sigue llevando la marca important', () => {
    const { c } = mundo(603);
    let comprobados = 0;
    for(let i = 0; i < 40; i++){
      agotarPool(c);
      const r = c.rollEvent();
      if(!r) continue;
      const d = def(c, r.id);
      if(!d || !('important' in d)) continue;
      comprobados++;
      eq(r.important, d.important, 'el evento ' + r.id + ' perdio la marca en el respaldo');
    }
    ok(comprobados > 5, 'no se pudo comprobar la marca en el respaldo: ' + comprobados);
  });

  test('con el pool agotado sigue respetando la puerta de drama', () => {
    const { c } = mundo(604);
    const p = c.G.player;
    const opp = Object.values(c.G.fighters)
      .find(f => f && f.div === p.div && f.id !== p.id && !f.retired);
    c.G.nextFight = { oppId: opp.id, weeks: 8, org: p.org, title: false, purse: 4000, event: 'T' };
    c.startCamp(c.G.nextFight); c.G.camp.i = 3;
    eq(c.CL.dramaOk(), false, 'el caso de prueba no aplica: dramaOk es verdadero');

    let drama = 0, n = 0;
    for(let i = 0; i < 200; i++){
      agotarPool(c);
      const r = c.rollEvent();
      if(!r) continue;
      n++;
      const d = def(c, r.id);
      if(d && d.drama) drama++;
    }
    ok(n > 50, 'no se sortearon suficientes eventos en el respaldo: ' + n);
    eq(drama, 0, 'el respaldo dejo pasar ' + drama + ' eventos de drama con la puerta cerrada');
  });

  test('con el pool agotado sigue respetando el contexto', () => {
    const { c } = mundo(605);
    let fuera = 0, n = 0;
    for(let i = 0; i < 200; i++){
      agotarPool(c);
      const r = c.rollEvent();
      if(!r) continue;
      n++;
      if(!c.eventContextAllows(r.id)) fuera++;
    }
    ok(n > 50, 'no se sortearon suficientes eventos: ' + n);
    eq(fuera, 0, 'el respaldo devolvio ' + fuera + ' eventos fuera de contexto');
  });

  test('sin ningun candidato posible devuelve null, no lanza', () => {
    const { c } = mundo(606);
    agotarPool(c);
    const previas = c.EVENTS.map(e => e.c);
    c.EVENTS.forEach(e => { e.c = function(){ return false; }; });
    let r, lanzo = false;
    try { r = c.rollEvent(); } catch(e){ lanzo = true; }
    c.EVENTS.forEach((e, i) => { e.c = previas[i]; });
    ok(!lanzo, 'rollEvent lanzo cuando no habia ningun candidato');
    eq(r, null, 'sin candidatos deberia devolver null');
  });

  test('un evento sorteado por la via normal queda vetado', () => {
    const { c } = mundo(607);
    const r = c.rollEvent();
    ok(r && r.id, 'no se sorteo ningun evento');
    /* `recentEvent` es un cierre dentro de la IIFE, no un global: la veda se
       comprueba sobre lo unico observable desde fuera, que es el historial. */
    const corte = c.G.year * 52 + c.G.week - 26;
    ok(c.G.story.eventHistory.some(x => x.id === r.id && x.at >= corte),
       'el evento sorteado no quedo vetado en el historial');
  });

});
