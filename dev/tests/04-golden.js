'use strict';
/* Golden master (I4): las trazas de dev/baseline/traces/ deben reproducirse
   exactamente. Es la prueba de que un refactor no cambio el juego.
   Si una traza cambia a proposito, se regenera con make-baseline.js y el
   cambio se justifica en dev/CHANGES.md.                                     */
const { suite, test, ok, eq } = require('../run-tests.js');
const H = require('../harness.js');
const A = require('../autopilot.js');
const fs = require('node:fs');
const path = require('node:path');

const TRACES = path.join(__dirname, '..', 'baseline', 'traces');

suite('golden master (I4)', () => {

  const archivos = fs.existsSync(TRACES)
    ? fs.readdirSync(TRACES).filter(f => f.startsWith('trace-') && f.endsWith('.json')).sort()
    : [];

  if(!archivos.length){
    test('hay golden traces', () => {
      ok(false, 'no hay trazas en dev/baseline/traces — ejecuta node dev/make-baseline.js');
    });
  }

  for(const f of archivos){
    const g = JSON.parse(fs.readFileSync(path.join(TRACES, f), 'utf8'));
    test('la traza ' + f + ' se reproduce identica', () => {
      const h = H.boot({ seed: g.config.seed });
      H.startCareer(h, g.config);
      const r = A.correrCarrera(h, {
        maxWeeks: g.semanas, politica: 'basica',
        seedPolitica: g.config.seed, traza: true,
      });
      const p = h.G.player;

      /* 1. la huella completa del estado persistible */
      eq(h.call('STATE.fingerprint', true), g.fingerprint, 'la huella final difiere');

      /* 2. lo observable al final */
      eq({ rec: p.rec, cash: h.G.cash, pop: p.pop, org: p.org, div: p.div,
           titles: p.titles, retired: !!p.retired, year: h.G.year, week: h.G.week },
         g.final, 'el estado final observable difiere');

      /* 3. la secuencia completa semana a semana y pelea a pelea */
      eq(r.traza.length, g.traza.length, 'la traza tiene otra longitud');
      for(let i = 0; i < g.traza.length; i++)
        eq(r.traza[i], g.traza[i], 'la traza difiere en la entrada ' + i);
    }, { seed: g.config.seed, repro: 'node dev/make-baseline.js (regenera trazas)' });
  }

});
