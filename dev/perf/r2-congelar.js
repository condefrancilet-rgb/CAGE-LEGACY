#!/usr/bin/env node
'use strict';
/* dev/perf/r2-congelar.js — congela la referencia de la ronda 2.
   1. copia el juego actual a dev/perf/congelado-r2/juego-base.html (si ya
      existe NO la pisa: la referencia se congela una vez);
   2. con ESA copia juega carreras del autopiloto hasta encontrar una que a
      las 150 semanas tenga titulo y no este retirada (ejercita mas pantallas
      que una carrera sin cinturon), la guarda por saveGame y extrae el texto
      exacto que quedo en localStorage.
     node dev/perf/r2-congelar.js
     node dev/perf/r2-congelar.js --huellas   (con el save ya congelado: mide,
        CON LA COPIA CONGELADA, la huella tras cargarlo y tras jugarlo 120
        semanas mas; dev/tests/16-congelado-r2.js exige esas mismas huellas a
        la version actual: es el golden master del camino de carga)        */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const H = require('../harness.js');
const A = require('../autopilot.js');

const DIR = path.join(__dirname, 'congelado-r2');
const COPIA = path.join(DIR, 'juego-base.html');
fs.mkdirSync(DIR, { recursive: true });
if(!fs.existsSync(COPIA)) fs.copyFileSync(path.join(__dirname, '..', '..', 'index-4-blindado.html'), COPIA);
const md5 = crypto.createHash('md5').update(fs.readFileSync(COPIA)).digest('hex');

if(process.argv.includes('--huellas')){
  const meta = JSON.parse(fs.readFileSync(path.join(DIR, 'save-r2.meta.json'), 'utf8'));
  const crudo = fs.readFileSync(path.join(DIR, 'save-r2.json'), 'utf8');
  const cargar = seed => {
    const h = H.boot({ seed, file: COPIA }), c = h.ctx, id = 's1789970254999';
    c.localStorage.setItem(c.SAVE_ONE + id, crudo);
    const idx = c.saveIndex(); idx[id] = { name:'r2', v:c.SAVE_VERSION, at:1, kb:1 }; c.saveIndexWrite(idx);
    if(!c.loadGame(id)) throw new Error('no carga');
    return h;
  };
  meta.huellaTrasCargar = cargar(12).call('STATE.fingerprint', true);
  const h = cargar(13);
  A.correrCarrera(h, { maxWeeks: 120, politica: 'basica', seedPolitica: 13 });
  meta.huellaTras120 = h.call('STATE.fingerprint', true);
  meta.recTras120 = h.ctx.recStr(h.G.player);
  fs.writeFileSync(path.join(DIR, 'save-r2.meta.json'), JSON.stringify(meta, null, 1));
  console.log(JSON.stringify(meta, null, 1));
  process.exit(0);
}

for(let seed = 4100; seed < 4160; seed++){
  const h = H.boot({ seed, file: COPIA });
  H.startCareer(h, { metaSeed: 900000 + seed * 13, style: 'mma', div: 'LW', age: 22 });
  A.correrCarrera(h, { maxWeeks: 150, politica: 'basica', seedPolitica: seed });
  const p = h.G.player;
  process.stderr.write(`semilla ${seed}: ${p.rec.w}-${p.rec.l}-${p.rec.d} titulos ${p.titles} retirado ${!!p.retired}\n`);
  if(p.retired || !(p.titles > 0)) continue;
  h.G.pending = h.G.pending || [];
  if(!h.ctx.saveGame(true)) throw new Error('saveGame fallo');
  const id = h.G.saveId;
  const crudo = h.ctx.localStorage.getItem(h.ctx.SAVE_ONE + id);
  fs.writeFileSync(path.join(DIR, 'save-r2.json'), crudo);
  const meta = { juego: 'juego-base.html', md5, commit: '00be0a4', seed, metaSeed: 900000 + seed * 13,
    semanas: 150, rec: p.rec, titulos: p.titles, year: h.G.year, week: h.G.week, cash: h.G.cash,
    kb: +(crudo.length / 1024).toFixed(1), huella: h.call('STATE.fingerprint', true) };
  fs.writeFileSync(path.join(DIR, 'save-r2.meta.json'), JSON.stringify(meta, null, 1));
  console.log(JSON.stringify(meta, null, 1));
  process.exit(0);
}
throw new Error('ninguna semilla dio una carrera con titulo');
