'use strict';
/* Save/load e invariante I3: toda fixture generada por la version original
   debe cargar sin perder datos.                                              */
const { suite, test, ok, eq } = require('../run-tests.js');
const H = require('../harness.js');
const A = require('../autopilot.js');
const fs = require('node:fs');
const path = require('node:path');

const FIXTURES = path.join(__dirname, '..', 'fixtures');

suite('save/load', () => {

  /* La primera carga NORMALIZA: completa campos por defecto que el save no
     traia (p. ej. el sub-objeto `cl` de peleadores creados esa semana, o
     `bonus`/`fights` en las ofertas). Eso AÑADE datos, nunca los quita.
     La garantia real del juego, y la que exige I3, es doble:
       (a) ningun dato presente antes de guardar se pierde ni cambia;
       (b) a partir de la segunda vuelta el ciclo es punto fijo.
     Un test que exigiera punto fijo en la primera vuelta estaria midiendo una
     promesa que el juego no hace.                                           */
  test('guardar y cargar no pierde ni altera ningun dato (I3)', () => {
    const h = H.boot({ seed: 21 });
    H.startCareer(h, { metaSeed: 66001, style: 'muay', div: 'FEA', age: 23 });
    A.correrCarrera(h, { maxWeeks: 25, politica: 'basica', seedPolitica: 21 });
    const c = h.ctx;
    const clon = x => JSON.parse(JSON.stringify(x));
    const antes = clon({ fighters: c.G.fighters, offers: c.G.offers, player: c.G.player,
                         cash: c.G.cash, rank: c.G.rank, week: c.G.week, year: c.G.year });

    ok(c.saveGame(true), 'saveGame devolvio falso');
    const slots = c.listSaves();
    ok(slots.length > 0, 'no se listo ninguna partida guardada');
    ok(c.loadGame(slots[0].id), 'loadGame devolvio falso');

    const perdidas = [];
    const comparaProfundo = (a, b, ruta) => {
      if(a === null || typeof a !== 'object'){
        if(JSON.stringify(a) !== JSON.stringify(b)) perdidas.push(ruta + ': ' + JSON.stringify(a) + ' -> ' + JSON.stringify(b));
        return;
      }
      if(b === null || typeof b !== 'object'){ perdidas.push(ruta + ': desaparecio'); return; }
      for(const k of Object.keys(a)) comparaProfundo(a[k], b[k], ruta + '.' + k);
    };
    comparaProfundo(antes.fighters, c.G.fighters, 'fighters');
    comparaProfundo(antes.offers,   c.G.offers,   'offers');
    comparaProfundo(antes.player,   c.G.player,   'player');
    comparaProfundo(antes.rank,     c.G.rank,     'rank');
    eq(c.G.cash, antes.cash, 'el dinero cambio al recargar');
    eq(c.G.week, antes.week, 'la semana cambio al recargar');
    eq(c.G.year, antes.year, 'el año cambio al recargar');
    eq(perdidas.slice(0, 8), [], 'se perdieron o alteraron datos al recargar');
  }, { seed: 21 });

  test('el ciclo guardar/cargar es punto fijo desde la segunda vuelta', () => {
    const h = H.boot({ seed: 26 });
    H.startCareer(h, { metaSeed: 66004, style: 'muay', div: 'FEA', age: 23 });
    A.correrCarrera(h, { maxWeeks: 25, politica: 'basica', seedPolitica: 26 });
    const c = h.ctx;
    c.saveGame(true);
    const id = c.listSaves()[0].id;
    c.loadGame(id);
    const fp1 = c.STATE.fingerprint(true);
    c.saveGame(true); c.loadGame(id);
    const fp2 = c.STATE.fingerprint(true);
    eq(fp2, fp1, 'la segunda vuelta del ciclo no es punto fijo');
  }, { seed: 26 });

  test('guardar -> cargar -> continuar equivale a continuar', () => {
    const corre = (conCicloDeGuardado) => {
      const h = H.boot({ seed: 22 });
      H.startCareer(h, { metaSeed: 66002, style: 'wrest', div: 'LW', age: 21 });
      A.correrCarrera(h, { maxWeeks: 20, politica: 'basica', seedPolitica: 22 });
      if(conCicloDeGuardado){
        h.ctx.saveGame(true);
        h.ctx.loadGame(h.ctx.listSaves()[0].id);
      }
      A.correrCarrera(h, { maxWeeks: 20, politica: 'basica', seedPolitica: 22 });
      return h.ctx.STATE.fingerprint(true);
    };
    eq(corre(true), corre(false), 'el ciclo de guardado altera la partida');
  }, { seed: 22 });

  test('SAVE_VERSION es un entero estable y la fixture lo declara', () => {
    const h = H.boot({ seed: 23 });
    ok(Number.isInteger(h.ctx.SAVE_VERSION), 'SAVE_VERSION no es entero');
    ok(h.ctx.SAVE_VERSION >= 4, 'SAVE_VERSION bajo lo esperado: ' + h.ctx.SAVE_VERSION);
  });

  /* --- I3: todas las fixtures cargan --- */
  const archivos = fs.existsSync(FIXTURES)
    ? fs.readdirSync(FIXTURES).filter(f => f.endsWith('.json') && f !== 'INDEX.json').sort()
    : [];

  if(!archivos.length){
    test('hay fixtures de save (I3)', () => {
      ok(false, 'no hay fixtures en dev/fixtures — ejecuta node dev/make-baseline.js');
    });
  }

  for(const f of archivos){
    test('carga la fixture ' + f + ' sin perder datos (I3)', () => {
      const cuerpo = fs.readFileSync(path.join(FIXTURES, f), 'utf8');
      const h = H.boot({ seed: 24 });
      const c = h.ctx;
      /* se inyecta tal cual la escribiria el juego y se carga por su propia via */
      const id = 's-fixture-' + f.replace(/\W/g, '');
      c.localStorage.setItem(c.SAVE_ONE + id, cuerpo);
      const idx = c.saveIndex();
      idx[id] = { name: 'fixture', rec: '0-0-0', div: '—', org: '—', when: '—',
                  cash: 0, v: c.SAVE_VERSION, at: Date.now(), kb: Math.round(cuerpo.length/1024) };
      c.localStorage.setItem(c.SAVE_IDX, JSON.stringify(idx));

      ok(c.loadGame(id), 'loadGame fallo con la fixture ' + f);
      ok(c.G && c.G.player, 'la partida cargada no tiene jugador');
      ok(c.G.player.name, 'el jugador cargado no tiene nombre');
      ok(Object.keys(c.G.fighters).length > 50, 'el mundo cargado esta vacio');
      /* el estado cargado debe ser jugable: 6 semanas sin excepciones */
      A.correrCarrera(h, { maxWeeks: 6, politica: 'basica', seedPolitica: 24 });
      ok(Number.isFinite(c.G.cash), 'cash no numerico tras jugar la fixture');
    });
  }

  test('cargar es idempotente: cargar dos veces da lo mismo', () => {
    const h = H.boot({ seed: 25 });
    H.startCareer(h, { metaSeed: 66003, style: 'bjj', div: 'BAN', age: 24 });
    A.correrCarrera(h, { maxWeeks: 15, politica: 'basica', seedPolitica: 25 });
    const c = h.ctx;
    c.saveGame(true);
    const id = c.listSaves()[0].id;
    c.loadGame(id); const a = c.STATE.fingerprint(true);
    c.loadGame(id); const b = c.STATE.fingerprint(true);
    eq(a, b, 'cargar dos veces no es idempotente');
  }, { seed: 25 });

});
