'use strict';
/* T-SCROLL — invariante I1.
   El despachador de pantallas solo lleva el documento al inicio cuando la
   pantalla cambia de verdad. Una interaccion en sitio no mueve el scroll.
   Este test existe porque reabrir ese bug es la regresion mas visible.       */
const { suite, test, ok, eq } = require('../run-tests.js');
const H = require('../harness.js');
const fs = require('node:fs');

suite('T-SCROLL (I1)', () => {

  /* --- dinamico: comportamiento observable --- */
  test('interaccion SIN cambio de pantalla no sube al inicio', () => {
    const h = H.boot({ seed: 11 });
    H.startCareer(h, { metaSeed: 55001, style: 'mma', div: 'LW', age: 22 });
    const c = h.ctx;
    c.go('hub');                      // navegacion: deja la pantalla dibujada
    c.window.scrollY = 640;           // el jugador baja
    h.clearScroll();

    const antes = c.UI.screen;
    c.focusSet('a', 'wrest');         // interaccion en sitio -> render()
    eq(c.UI.screen, antes, 'la pantalla cambio: el caso de prueba no aplica');
    eq(h.scrollCalls().length, 0, 'hubo scrollTo en un redibujado en sitio');
    eq(c.window.scrollY, 640, 'el scroll se movio sin cambiar de pantalla');
  }, { seed: 11 });

  test('varias interacciones en sitio seguidas conservan el scroll', () => {
    const h = H.boot({ seed: 12 });
    H.startCareer(h, { metaSeed: 55002, style: 'boxer', div: 'WW', age: 23 });
    const c = h.ctx;
    c.go('rank');
    c.window.scrollY = 420;
    h.clearScroll();
    c.setRank('div', 'HW');
    c.setRank('div', 'LW');
    c.setRank('org', 'AXN');
    eq(h.scrollCalls().length, 0, 'alguna interaccion en sitio llamo a scrollTo');
    eq(c.window.scrollY, 420, 'el scroll se movio');
  }, { seed: 12 });

  test('cambio de pantalla por go() SI sube al inicio', () => {
    const h = H.boot({ seed: 13 });
    H.startCareer(h, { metaSeed: 55003, style: 'mma', div: 'LW', age: 22 });
    const c = h.ctx;
    c.go('hub');
    c.window.scrollY = 500;
    h.clearScroll();
    c.go('rank');
    ok(h.scrollCalls().length > 0, 'navegar no llevo el documento al inicio');
    eq(c.window.scrollY, 0, 'tras navegar el scroll deberia estar arriba');
  }, { seed: 13 });

  test('cambio de pantalla asignando UI.screen (sin go) tambien sube', () => {
    const h = H.boot({ seed: 14 });
    H.startCareer(h, { metaSeed: 55004, style: 'mma', div: 'LW', age: 22 });
    const c = h.ctx;
    c.go('hub');
    c.window.scrollY = 300;
    h.clearScroll();
    c.UI.screen = 'menu'; c.render();   // ruta que NO pasa por go()
    eq(c.window.scrollY, 0, 'una transicion directa dejo el scroll a medias');
  }, { seed: 14 });

  test('volver a la MISMA pantalla con go() no es una interaccion en sitio', () => {
    /* go() tiene su propio scroll de navegacion, anterior a la correccion y
       deliberadamente intacto: se documenta aqui para que nadie lo "arregle". */
    const h = H.boot({ seed: 15 });
    H.startCareer(h, { metaSeed: 55005, style: 'mma', div: 'LW', age: 22 });
    const c = h.ctx;
    c.go('rank'); c.window.scrollY = 200; h.clearScroll();
    c.go('rank');
    eq(c.window.scrollY, 0, 'go() a la misma pantalla deberia seguir subiendo');
  }, { seed: 15 });

  /* --- estatico: toda escritura de scroll vive en un unico punto --- */
  test('toda escritura de scroll esta acotada y sin scrollTo incondicional', () => {
    const js = H.extractJS();
    const sinComentarios = js
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');

    const sitios = [];
    sinComentarios.split('\n').forEach((l, i) => {
      if(/\bscrollTo\s*\(|\.scrollTop\s*=|scrollIntoView\s*\(/.test(l))
        sitios.push({ n: i + 1, t: l.trim() });
    });

    eq(sitios.length, 3, 'cambio el numero de escrituras de scroll: ' +
       JSON.stringify(sitios.map(s => s.t)));

    /* el del despachador debe seguir condicionado al cambio de pantalla */
    const despachador = sitios.filter(s => /CL_LAST_DRAWN|UI\.screen/.test(s.t));
    eq(despachador.length, 1, 'no hay exactamente un scroll condicionado a la pantalla');
    ok(/!==\s*UI\.screen|UI\.screen\s*!==/.test(despachador[0].t),
       'el scroll del despachador ya no esta condicionado al cambio de pantalla');

    /* ninguno de los otros dos puede ser un scroll de render incondicional */
    const otros = sitios.filter(s => !/CL_LAST_DRAWN/.test(s.t));
    for(const o of otros)
      ok(/function\s+go|window\.scrollTo\)|t\.step\s*=/.test(o.t) || /scrollTo\(0,0\)/.test(o.t),
         'escritura de scroll inesperada en la linea ' + o.n + ': ' + o.t);
  });

  test('no hay scrollIntoView ni focus automatico que reposicione', () => {
    const js = H.extractJS();
    eq((js.match(/scrollIntoView/g) || []).length, 0, 'aparecio scrollIntoView');
    eq((js.match(/\.scrollTop\s*=/g) || []).length, 0, 'aparecio una escritura de scrollTop');
  });

});
