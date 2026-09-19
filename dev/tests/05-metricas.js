'use strict';
/* Metrica de control (seccion "antipatrones"): redefiniciones, wrappers y
   overrides bajan en F2 y NO vuelven a subir. Este test es el trinquete.
   Los topes se bajan a mano al cerrar cada consolidacion; subirlos exige
   justificarlo en dev/CHANGES.md.                                           */
const { suite, test, ok, eq } = require('../run-tests.js');
const M = require('../metrics.js');
const H = require('../harness.js');
const fs = require('node:fs');
const path = require('node:path');

/* Topes vigentes. Bajar al consolidar; nunca subir sin justificacion. */
const TOPE = {
  definidosMasDeUnaVez: 43,
  wrappers: 42,
  escriturasScroll: 3,
  escriturasUIScreen: 37,
  evalFuncional: 0,
  dependenciasExternas: 0,
};

suite('metricas de control', () => {
  const m = M.analyze();

  test('las redefiniciones no suben', () => {
    ok(m.funciones.definidosMasDeUnaVez <= TOPE.definidosMasDeUnaVez,
      'nombres definidos mas de una vez subio a ' + m.funciones.definidosMasDeUnaVez +
      ' (tope ' + TOPE.definidosMasDeUnaVez + ')');
  });

  test('los wrappers no suben', () => {
    ok(m.funciones.wrappers <= TOPE.wrappers,
      'wrappers subio a ' + m.funciones.wrappers + ' (tope ' + TOPE.wrappers + ')');
  });

  test('las escrituras de scroll no suben (I1)', () => {
    ok(m.scroll.sitios <= TOPE.escriturasScroll,
      'escrituras de scroll subio a ' + m.scroll.sitios + ': ' +
      JSON.stringify(m.scroll.detalle.map(d => d.texto)));
  });

  test('las escrituras directas de UI.screen no suben (preparacion de F3)', () => {
    ok(m.render.uiScreenEscrituras <= TOPE.escriturasUIScreen,
      'escrituras de UI.screen subio a ' + m.render.uiScreenEscrituras +
      ' (tope ' + TOPE.escriturasUIScreen + ')');
  });

  test('sigue sin eval funcional', () => {
    eq(m.evalFuncional, TOPE.evalFuncional, 'aparecio eval() funcional');
  });

  test('sigue sin dependencias externas (I2)', () => {
    const d = m.dependenciasExternas;
    eq(d.script_src + d.link_href + d.fetch + d.XMLHttpRequest + d.urlsHttp,
       TOPE.dependenciasExternas, 'aparecio una dependencia externa: ' + JSON.stringify(d));
  });

  test('el juego sigue siendo un unico bloque de script', () => {
    eq(m.bloquesScript, 1, 'el numero de bloques <script> cambio');
  });

  test('no hay caracteres de control sueltos en el archivo', () => {
    /* Una insercion mal escapada puede dejar un 0x08 dentro de un regex y
       romper algo en silencio. Se barre el archivo entero.                  */
    const src = fs.readFileSync(H.GAME, 'utf8');
    const malos = [];
    for(let i = 0; i < src.length; i++){
      const c = src.charCodeAt(i);
      if(c < 32 && c !== 10 && c !== 9 && c !== 13) malos.push({ pos: i, code: c });
      if(malos.length > 5) break;
    }
    eq(malos, [], 'hay caracteres de control sueltos');
  });
});
