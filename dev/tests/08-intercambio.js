'use strict';
/* CARACTERIZACION de los tres cierres de intercambio, antes de consolidarlos.
   Describen lo que el archivo hace HOY, no lo que deberia hacer.

   El autopiloto NO pisa dos de los tres caminos: resuelve las peleas llamando
   a fightAct y nunca abre el minijuego de finalizacion ni el arbol de
   tecnicas. Medido: 5 carreras x 200 semanas -> 1433 cierres por fightAct, 0
   por fightFinishResolve y 0 por TQ.apply. Por eso el golden master no puede
   validar ese refactor y hace falta esta red, que los conduce a mano.        */
const { suite, test, ok, eq } = require('../run-tests.js');
const H = require('../harness.js');

suite('cierres de intercambio (caracterizacion)', () => {

  /* Deja una pelea viva en el primer round, sin resolverla. */
  function peleaViva(seed){
    const h = H.boot({ seed });
    H.startCareer(h, { metaSeed: 5150, style: 'mma', div: 'LW', age: 22 });
    const c = h.ctx, p = c.G.player;
    const opp = Object.values(c.G.fighters)
      .find(f => f && f.div === p.div && f.id !== p.id && !f.retired);
    c.G.nextFight = { oppId: opp.id, weeks: 0, org: p.org, title: false, purse: 8000, event: 'Test' };
    c.startCamp(c.G.nextFight);
    c.G.camp.i = c.G.camp.weeks;
    c.goFight();
    ok(c.G.fight && !c.G.fight.over, 'no se pudo dejar una pelea viva');
    return { h, c, f: c.G.fight };
  }

  /* Cuenta cuantas veces se emite cada hook de intercambio. */
  function contarHooks(c){
    const n = { pre: 0, post: 0 };
    c.hookOn('exchange:pre',  'medicion', function(){ n.pre++;  }, 99);
    c.hookOn('exchange:post', 'medicion', function(){ n.post++; }, 99);
    return n;
  }

  test('fightAct emite exchange:pre y exchange:post', () => {
    const { c } = peleaViva(801);
    const n = contarHooks(c);
    const o = c.fightOptions();
    ok(o.length, 'la pelea no ofrecio ninguna accion');
    c.fightAct(o[0].k);
    eq(n.pre, 1, 'fightAct no emitio exchange:pre');
    eq(n.post, 1, 'fightAct no emitio exchange:post');
  });

  test('fightAct gasta reloj y suma un intercambio', () => {
    const { c, f } = peleaViva(802);
    const relojAntes = f.clock, exAntes = f.ex;
    c.fightAct(c.fightOptions()[0].k);
    const gasto = relojAntes - c.G.fight.clock;
    eq(c.G.fight.ex, exAntes + 1, 'fightAct no sumo el intercambio');
    /* ri(38,62), mas lo que cualquier suscriptor anada */
    ok(gasto >= 38 && gasto <= 62, 'fightAct gasto ' + gasto + ' de reloj, fuera de [38,62]');
  });

  test('TQ.apply cierra el intercambio SIN emitir los hooks', () => {
    const { c, f } = peleaViva(803);
    const n = contarHooks(c);
    const nodos = Object.keys(c.TQ.MAP || {});
    ok(nodos.length, 'el arbol de tecnicas esta vacio');
    /* una tecnica sin finalizacion, para que el cierre sea observable */
    const t = nodos.map(id => c.TQ.node(id))
      .find(x => x && x.fx && !x.fx.finish && !x.fx.sub) || c.TQ.node(nodos[0]);
    ok(t, 'no se pudo resolver ningun nodo del arbol');
    const exAntes = f.ex, relojAntes = f.clock;
    c.TQ.apply(t, 'good', 0.8);
    ok(c.G.fight.ex > exAntes || c.G.fight.over,
       'TQ.apply no sumo el intercambio ni termino la pelea');
    if(!c.G.fight.over){
      const gasto = relojAntes - c.G.fight.clock;
      ok(gasto >= 30 && gasto <= 52, 'TQ.apply gasto ' + gasto + ' de reloj, fuera de [30,52]');
    }
    eq(n.pre, 0, 'TQ.apply emitio exchange:pre, y hoy no lo hace');
    eq(n.post, 0, 'TQ.apply emitio exchange:post, y hoy no lo hace');
  });

  test('el reloj de TQ.apply se queda dentro de [30,52]', () => {
    /* Una sola tirada no distingue ri(30,52) de ri(38,62): los rangos se
       solapan y 44 cae en los dos. Verificado por mutacion: la primera version
       de esta prueba sorteaba 25 peleas nuevas y le salia 44 las 25 veces,
       porque con metaSeed fijo el flujo del RNG es identico al empezar la
       pelea — eran 25 copias de una sola muestra, y el mutante pasaba.
       Aqui se sortea DENTRO de una misma pelea, que es donde el RNG avanza de
       verdad. Se repone la vida de los dos para que la pelea no termine, y se
       descartan los intercambios que cierran el round, porque endRound
       reinicia el reloj y la resta no mediria el coste. */
    const { c } = peleaViva(901);
    const t = Object.keys(c.TQ.MAP).map(id => c.TQ.node(id))
      .find(x => x && x.fx && !x.fx.finish && !x.fx.sub);
    ok(t, 'no hay ninguna tecnica sin finalizacion en el arbol');
    const gastos = [];
    for(let i = 0; i < 60 && c.G.fight && !c.G.fight.over; i++){
      const f = c.G.fight, antes = f.clock, rondaAntes = f.round;
      f.o.hp = 100; f.p.hp = 100;
      c.TQ.apply(t, 'good', 0.8);
      if(!c.G.fight || c.G.fight.over) break;
      if(c.G.fight.round !== rondaAntes) continue;
      gastos.push(antes - c.G.fight.clock);
    }
    ok(gastos.length >= 8, 'muy pocas muestras de reloj: ' + gastos.length);
    const min = Math.min(...gastos), max = Math.max(...gastos);
    ok(min >= 30, 'TQ.apply gasto ' + min + ', por debajo de 30: ' + gastos.join(' '));
    ok(max <= 52, 'TQ.apply gasto ' + max + ', por encima de 52 — reloj de fightAct? ' +
       gastos.join(' '));
  });

  test('fightFinishResolve cierra el intercambio SIN emitir los hooks', () => {
    const { c, f } = peleaViva(804);
    const n = contarHooks(c);
    /* calidad 0 y rival intacto: la finalizacion casi seguro falla y se ve el
       camino de cierre, que es lo que se caracteriza. Si entra, la pelea
       termina y eso tambien queda afirmado. */
    f.o.hp = 100; f.o.stam = 100;
    const exAntes = f.ex, relojAntes = f.clock;
    c.fightFinishResolve({ kind: 'ko', quality: 0 });
    if(c.G.fight && !c.G.fight.over){
      eq(c.G.fight.ex, exAntes + 1, 'fightFinishResolve no sumo el intercambio');
      const gasto = relojAntes - c.G.fight.clock;
      ok(gasto >= 24 && gasto <= 46,
         'fightFinishResolve gasto ' + gasto + ' de reloj, fuera de [24,46]');
    }
    eq(n.pre, 0, 'fightFinishResolve emitio exchange:pre, y hoy no lo hace');
    eq(n.post, 0, 'fightFinishResolve emitio exchange:post, y hoy no lo hace');
  });

  test('los tres relojes son distintos entre si', () => {
    /* Esta prueba fija la DIVERGENCIA, que es el hallazgo: tres sitios que
       cierran lo mismo con tres constantes. Se mide sobre el texto del juego,
       no sobre las funciones en runtime, porque GATE envuelve algunas y
       String(fn) devolveria la envoltura. Si algun dia se unifican sera una
       decision de balance (F14) y esta prueba tiene que caer con ella, no
       antes. */
    const fs = require('node:fs'), path = require('node:path');
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'index-4-blindado.html'), 'utf8');
    const relojes = (src.match(/f\.clock\s*-=\s*ri\((\d+),\s*(\d+)\)/g) || []);
    eq(relojes.length, 3, 'ya no hay exactamente tres cierres de intercambio: ' +
       JSON.stringify(relojes));
    const unicos = new Set(relojes);
    eq(unicos.size, 3, 'los tres relojes ya no son distintos: ' + JSON.stringify([...unicos]));
  });

});
