'use strict';
/* RONDA 2 · el save congelado de esta ronda.
   Se hizo con dev/perf/congelado-r2/juego-base.html (00be0a4, antes de tocar
   nada) y tiene que cargar en la version actual y seguir JUGANDOSE 120
   semanas: contrato, campamentos, peleas y cobros por el camino real, sin una
   excepcion, sin un error registrado por el juego y sin una invariante rota.
   Es la prueba de que ningun cambio de la ronda altero el formato del save. */
const { suite, test, ok, eq } = require('../run-tests.js');
const H = require('../harness.js');
const A = require('../autopilot.js');
const INV = require('../invariants.js');
const fs = require('node:fs');
const path = require('node:path');

const DIR = path.join(__dirname, '..', 'perf', 'congelado-r2');

function cargar(seed){
  const crudo = fs.readFileSync(path.join(DIR, 'save-r2.json'), 'utf8');
  const h = H.boot({ seed });
  const c = h.ctx;
  const id = 's1789970254999';
  c.localStorage.setItem(c.SAVE_ONE + id, crudo);
  const idx = c.saveIndex();
  idx[id] = { name:'r2', rec:'', div:'', org:'', when:'congelado', cash:0, v:c.SAVE_VERSION, at:Date.now(), kb:1 };
  c.saveIndexWrite(idx);
  return { h, c, ok: c.loadGame(id) };
}

suite('save congelado de la ronda 2 (I3)', () => {

  const meta = JSON.parse(fs.readFileSync(path.join(DIR, 'save-r2.meta.json'), 'utf8'));

  test('carga sin perder la carrera', () => {
    const { c, ok: cargo } = cargar(11);
    ok(cargo, 'el save congelado no carga');
    eq([c.G.year, c.G.week], [meta.year, meta.week], 'se perdio la fecha');
    eq({ w: c.G.player.rec.w, l: c.G.player.rec.l, d: c.G.player.rec.d },
       { w: meta.rec.w, l: meta.rec.l, d: meta.rec.d }, 'se perdio el record');
    eq(c.G.player.titles, meta.titulos, 'se perdieron titulos');
  });

  /* OJO, medido: la huella tras cargar NO es la del momento de guardar
     (01e4cd7b -> 4dfbf46d) y no es un bug. La carga sanea: 22 peleadores
     reciben su estado `cl` por inicializacion perezosa y story.feed se recorta
     a su tope de 60 (tenia 62: el saneo semanal lo habria recortado igual).
     Lo que se exige es otra cosa, mas fuerte: que la version actual cargue
     este save EXACTAMENTE como lo cargaba la copia congelada. */
  test('carga el save exactamente como la copia congelada (huella tras cargar)', () => {
    const { h, ok: cargo } = cargar(12);
    ok(cargo, 'no carga');
    eq(h.call('STATE.fingerprint', true), meta.huellaTrasCargar, 'cargar el save congelado ya no da el estado que daba la copia congelada');
  });

  test('sigue jugandose 120 semanas sin un solo fallo', () => {
    const { h, c, ok: cargo } = cargar(13);
    ok(cargo, 'no carga');
    const registrados = [];
    const orig = c.errRecord;
    c.errRecord = function(w, e){ registrados.push(String(w) + ': ' + String((e && e.message) || e)); return orig.apply(this, arguments); };
    const inv = [];
    const aw = c.advanceWeek;
    let prof = 0;
    c.advanceWeek = function(){
      prof++; let r; try { r = aw.apply(this, arguments); } finally { prof--; }
      if(!prof) for(const m of INV.checkInvariants(c.G, c.UI, {})) inv.push(c.G.year + '/' + c.G.week + ' ' + m.id + ': ' + m.causa);
      return r;
    };
    const s0 = c.G.year * 52 + c.G.week, peleas0 = c.G.player.career.length;
    const r = A.correrCarrera(h, { maxWeeks: 120, politica: 'basica', seedPolitica: 13 });
    ok(r.semanas >= 120 || c.G.player.retired, 'no llego a 120 semanas: ' + r.semanas);
    ok(c.G.player.career.length > peleas0, 'en 120 semanas no peleo nunca: el camino de pelea no se ejercito');
    eq(inv, [], 'invariantes rotas');
    eq(registrados, [], 'el juego registro errores');
    eq(h.errores, [], 'errores en temporizadores');
    ok(c.G.year * 52 + c.G.week - s0 >= 120 || c.G.player.retired, 'el reloj no avanzo');
    /* golden master del camino de carga: la copia congelada, jugando lo mismo
       desde el mismo save, llega exactamente aqui (r2-congelar.js --huellas) */
    eq(c.recStr(c.G.player), meta.recTras120, 'el record tras 120 semanas difiere del de la copia congelada');
    eq(h.call('STATE.fingerprint', true), meta.huellaTras120, 'la partida tras 120 semanas difiere de la de la copia congelada');
  });

});
