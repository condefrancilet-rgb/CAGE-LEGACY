'use strict';
/* El save de referencia se hizo con dev/perf/congelado/juego-base.html y tiene
   que seguir cargando en TODAS las etapas. Es la prueba de que no se rompe la
   compatibilidad hacia atras (I3) mientras se refactoriza. */
const { suite, test, ok, eq } = require('../run-tests.js');
const H = require('../harness.js');
const fs = require('node:fs');
const path = require('node:path');

suite('save congelado (I3)', () => {

  const RUTA = path.join(__dirname, '..', 'perf', 'congelado', 'save-referencia.json');

  test('el save de referencia existe', () => {
    ok(fs.existsSync(RUTA), 'falta dev/perf/congelado/save-referencia.json');
  });

  test('carga en la version actual sin perder la carrera', () => {
    const crudo = fs.readFileSync(RUTA, 'utf8');
    const h = H.boot({ seed: 1 });
    const c = h.ctx;
    /* se mete el save crudo en el almacenamiento y se carga por el camino real */
    const id = 's1789970254602';
    c.localStorage.setItem(c.SAVE_ONE + id, crudo);
    const idx = c.saveIndex();
    idx[id] = { name:'referencia', rec:'7-4', div:'', org:'', when:'congelado',
                cash:0, v:c.SAVE_VERSION, at:Date.now(), kb:Math.round(crudo.length/1024) };
    c.saveIndexWrite(idx);
    ok(c.loadGame(id), 'el save congelado no carga');
    ok(c.G && c.G.player, 'carga sin jugador');
    eq(c.G.player.rec.w, 7, 'se perdieron victorias al cargar');
    eq(c.G.player.rec.l, 4, 'se perdieron derrotas al cargar');
    eq(c.G.year, 2018, 'se perdio el año');
    eq(c.G.week, 47, 'se perdio la semana');
  });

  test('tras cargarlo, el juego sigue avanzando', () => {
    const crudo = fs.readFileSync(RUTA, 'utf8');
    const h = H.boot({ seed: 2 });
    const c = h.ctx;
    const id = 's1789970254602';
    c.localStorage.setItem(c.SAVE_ONE + id, crudo);
    const idx = c.saveIndex();
    idx[id] = { name:'referencia', rec:'7-4', div:'', org:'', when:'congelado',
                cash:0, v:c.SAVE_VERSION, at:Date.now(), kb:1 };
    c.saveIndexWrite(idx);
    ok(c.loadGame(id), 'el save congelado no carga');
    const sem = c.G.week, anio = c.G.year;
    let lanzo = false;
    try { for(let i = 0; i < 5; i++) c.advanceWeek(); } catch(e){ lanzo = true; }
    ok(!lanzo, 'avanzar tras cargar el save congelado lanza');
    ok(c.G.year*52 + c.G.week > anio*52 + sem, 'no avanzo el tiempo');
  });

});
