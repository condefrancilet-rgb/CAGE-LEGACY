'use strict';
/* CARACTERIZACION de la navegacion, antes de darle dueño unico (E2).
   Describe lo que el archivo hace HOY.

   Mapa medido:
     51 escrituras de UI.screen en total
       12 dentro de cadenas HTML (botones "Volver al inicio")
       36 en codigo real, de las cuales 18 son UI.screen='mg'
     go(s,sub) ya existe y es la funcion canonica: emite 'nav', descarta una
     pelea terminada, escribe UI.screen y UI.sub, hace scroll y redibuja.     */
const { suite, test, ok, eq } = require('../run-tests.js');
const H = require('../harness.js');
const fs = require('node:fs');
const path = require('node:path');

function mundo(seed, cfg){
  const h = H.boot({ seed });
  H.startCareer(h, Object.assign({ metaSeed: 5150, style:'mma', div:'LW', age:22 }, cfg||{}));
  return { h, c: h.ctx };
}
const FUENTE = () => fs.readFileSync(path.join(__dirname, '..', '..', 'index-4-blindado.html'), 'utf8');

suite('E2 · navegacion: lo que hace hoy', () => {

  test('go() es el unico que descarta una pelea terminada', () => {
    const { c } = mundo(5001);
    const p = c.G.player;
    const opp = Object.values(c.G.fighters)
      .find(f => f && f.div === p.div && f.id !== p.id && !f.retired);
    c.G.nextFight = { oppId: opp.id, weeks:0, org:p.org, title:false, purse:8000, event:'T' };
    c.startCamp(c.G.nextFight); c.G.camp.i = c.G.camp.weeks; c.goFight();
    c.finishFight('ko','p');
    ok(c.G.fight && c.G.fight.over, 'no quedo una pelea terminada');
    /* escribir UI.screen a mano NO la descarta */
    c.UI.screen = 'hub'; c.render();
    ok(c.G.fight, 'escribir UI.screen a mano descarto la pelea: ya no es exclusivo de go()');
    /* go() si */
    c.go('hub');
    eq(c.G.fight, null, 'go() dejo viva una pelea terminada');
  });

  test('go() a una pantalla de minijuego NO descarta la pelea', () => {
    const { c } = mundo(5002);
    const p = c.G.player;
    const opp = Object.values(c.G.fighters)
      .find(f => f && f.div === p.div && f.id !== p.id && !f.retired);
    c.G.nextFight = { oppId: opp.id, weeks:0, org:p.org, title:false, purse:8000, event:'T' };
    c.startCamp(c.G.nextFight); c.G.camp.i = c.G.camp.weeks; c.goFight();
    c.finishFight('ko','p');
    c.go('mg');
    ok(c.G.fight, 'go("mg") descarto la pelea terminada: mg esta en la lista de excepciones');
  });

  test('go() emite el hook nav y se puede cancelar', () => {
    const { c } = mundo(5003);
    let visto = 0;
    c.hookOn('nav', 'medicion', function(ctx){ visto++; }, 99);
    c.go('rank');
    eq(visto, 1, 'go() no emitio el hook nav');
    eq(c.UI.screen, 'rank', 'go() no cambio de pantalla');
  });

  test('escribir UI.screen a mano NO emite el hook nav', () => {
    const { c } = mundo(5004);
    let visto = 0;
    c.hookOn('nav', 'medicion', function(){ visto++; }, 99);
    c.UI.screen = 'rank'; c.render();
    eq(visto, 0, 'escribir a mano emitio nav: la diferencia con go() no es la que se cree');
  });

  test('abrir un minijuego deja G.mg y la pantalla mg', () => {
    const { c } = mundo(5005);
    c.G.mg = null;
    c.cardioStart();
    ok(c.G.mg, 'cardioStart no dejo minijuego abierto');
    eq(c.UI.screen, 'mg', 'cardioStart no llevo a la pantalla mg');
  });

  test('cerrar un minijuego sin consumir semana vuelve al hub', () => {
    const { c } = mundo(5006);
    c.cardioStart();
    ok(c.G.mg, 'no hay minijuego que cerrar');
    c.mgClose(false);
    eq(c.G.mg, null, 'mgClose dejo el minijuego vivo');
    eq(c.UI.screen, 'hub', 'mgClose(false) no volvio al hub');
  });

  /* ---- trinquete: estas dos fijan el mapa para que no empeore ---- */

  /* ---- trinquetes: el mapa solo puede mejorar ----
     Linea base al empezar E2: 51 escrituras de UI.screen y 30 de G.mg.
     Tras dar dueño a la navegacion de minijuegos (mgOpen): 32 y 31.
     G.mg sube en uno a proposito, porque el dueño es el mismo un escritor;
     lo que importa es que no crezcan los de FUERA. */

  test('trinquete: las escrituras de UI.screen no vuelven a subir', () => {
    const src = FUENTE();
    const todas = (src.match(/UI\.screen\s*=[^=]/g) || []).length;
    ok(todas <= 8, 'las escrituras de UI.screen subieron a ' + todas + ' (tope 8, base 51)');
  });

  test('las 8 escrituras que quedan tienen dueño o motivo', () => {
    /* No son escrituras sueltas: son los cuatro dueños, el router de
       emergencia de render, el manejador de error de cargar una partida y un
       autotest que barre pantallas. Cada una esta contada. */
    const src = FUENTE();
    const cuenta = (re) => (src.match(re) || []).length;
    eq(cuenta(/function go\(/), 1, 'go() dejo de ser unico');
    eq(cuenta(/function mgOpen\(/), 1, 'mgOpen dejo de ser unico');
    eq(cuenta(/function mgExit\(/), 1, 'mgExit dejo de ser unico');
    eq(cuenta(/function fightScreen\(/), 1, 'fightScreen dejo de ser unico');
    /* ninguna navegacion suelta con render() pegado detras */
    const sueltas = cuenta(/UI\.screen\s*=\s*'[a-z]+';\s*render\(\)/g);
    eq(sueltas, 0, 'quedan ' + sueltas + " escrituras del tipo UI.screen='x'; render()");
  });

  test('los botones de volver navegan por go(), no a mano', () => {
    const src = FUENTE();
    const aMano = (src.match(/onclick="UI\.screen/g) || []).length;
    eq(aMano, 0, 'quedan ' + aMano + ' botones que escriben UI.screen desde el HTML');
  });

  test('fightScreen no emite nav: la excepcion es deliberada', () => {
    /* Hace falta una pelea VIVA: sin ella, la tabla de pantallas devuelve null
       para 'fight' y render rebota al hub. Eso es correcto, y mi primera
       version de esta prueba lo tomaba por un fallo de fightScreen. */
    const { c } = mundo(5009);
    const p = c.G.player;
    const opp = Object.values(c.G.fighters)
      .find(f => f && f.div === p.div && f.id !== p.id && !f.retired);
    c.G.nextFight = { oppId: opp.id, weeks:0, org:p.org, title:false, purse:8000, event:'T' };
    c.startCamp(c.G.nextFight); c.G.camp.i = c.G.camp.weeks; c.goFight();
    ok(c.G.fight && !c.G.fight.over, 'no hay pelea viva');
    let nav = 0;
    c.hookOn('nav', 'medicion', function(){ nav++; }, 99);
    c.UI.screen = 'hub';
    c.fightScreen('fight');
    eq(c.UI.screen, 'fight', 'fightScreen no cambio de pantalla');
    eq(nav, 0, 'fightScreen emitio nav: eso cerraria el minijuego de finalizacion');
  });

  test('trinquete: los escritores de G.mg no vuelven a subir', () => {
    const src = FUENTE();
    const todos = (src.match(/G\.mg\s*=[^=]/g) || []).length;
    ok(todos <= 26, 'los escritores de G.mg subieron a ' + todos + ' (tope 26, base 30)');
  });

  test('mgExit es el unico que cierra un minijuego decidiendo pantalla', () => {
    const src = FUENTE();
    ok(/function mgExit\(/.test(src), 'no existe mgExit');
    /* El par "cerrar y elegir pantalla" no debe quedar suelto. Se excluye el
       router de emergencia de render (17953): ese no cierra un minijuego, sino
       que recupera de un fallo de dibujo reseteando a un lugar seguro. Es otro
       dueño y otro problema. */
    const sueltos = (src.match(/G\.mg\s*=\s*null;\s*UI\.screen/g) || [])
      .filter(x => !/\n\s{6}UI\.screen/.test(x)).length;
    eq(sueltos, 0, 'quedan ' + sueltos + ' cierres que eligen pantalla por su cuenta');
  });

  test('mgExit conserva los tres destinos, no los unifica', () => {
    const { c } = mundo(5007);
    /* 'train' */
    c.cardioStart(); ok(c.G.mg, 'no abrio');
    c.mgExit('train', false);
    eq(c.UI.screen, 'train', "mgExit('train') no llevo a train");
    /* 'hub' incondicional */
    c.cardioStart(); c.mgExit('hub', false);
    eq(c.UI.screen, 'hub', "mgExit('hub') no llevo al hub");
    /* 'auto' sin pelea viva -> hub */
    c.G.fight = null;
    c.cardioStart(); c.mgExit('auto', false);
    eq(c.UI.screen, 'hub', "mgExit('auto') sin pelea deberia ir al hub");
    eq(c.G.mg, null, 'mgExit no cerro el minijuego');
  });

  test("mgExit('auto') va a la pelea si hay una viva", () => {
    const { c } = mundo(5008);
    const p = c.G.player;
    const opp = Object.values(c.G.fighters)
      .find(f => f && f.div === p.div && f.id !== p.id && !f.retired);
    c.G.nextFight = { oppId: opp.id, weeks:0, org:p.org, title:false, purse:8000, event:'T' };
    c.startCamp(c.G.nextFight); c.G.camp.i = c.G.camp.weeks; c.goFight();
    ok(c.G.fight && !c.G.fight.over, 'no hay pelea viva');
    c.G.mg = { type:'cardio' };
    c.mgExit('auto', false);
    eq(c.UI.screen, 'fight', "mgExit('auto') con pelea viva deberia volver a la pelea");
  });

  test('mgOpen existe y es quien lleva a la pantalla de minijuego', () => {
    const src = FUENTE();
    ok(/function mgOpen\(/.test(src), 'no existe mgOpen');
    /* fuera de mgOpen no debe quedar ningun UI.screen='mg' */
    const sueltas = (src.match(/UI\.screen\s*=\s*'mg'/g) || []).length;
    eq(sueltas, 1, 'quedan ' + sueltas + " sitios con UI.screen='mg'; solo debe estar el de mgOpen");
  });

});
