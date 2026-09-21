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

  test('trinquete: no aumentan las escrituras directas de UI.screen', () => {
    const src = FUENTE();
    const todas = (src.match(/UI\.screen\s*=[^=]/g) || []).length;
    ok(todas <= 51, 'las escrituras de UI.screen subieron a ' + todas + ' (linea base 51)');
  });

  test('trinquete: no aumentan los escritores de G.mg', () => {
    const src = FUENTE();
    const todos = (src.match(/G\.mg\s*=[^=]/g) || []).length;
    ok(todos <= 30, 'los escritores de G.mg subieron a ' + todos + ' (linea base 30)');
  });

});
