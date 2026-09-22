#!/usr/bin/env node
'use strict';
/* dev/perf/baseline.js — linea base de rendimiento, ANTES de optimizar.
   Mide lo que E4 tiene que mejorar, con las mismas semillas siempre para que
   dos corridas sean comparables.
     node dev/perf/baseline.js [--out dev/perf/baseline.json]                */
const fs = require('node:fs');
const path = require('node:path');
const H = require('../harness.js');
const A = require('../autopilot.js');

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i+1] : d; };
const OUT = arg('out', path.join(__dirname, 'baseline.json'));
/* --file mide OTRA copia del juego. Sin esto no hay comparacion honesta: los
   ms dependen de la carga de la maquina, asi que las dos versiones tienen que
   medirse en la misma corrida, una detras de otra. */
const ARCHIVO = arg('file', null);
const pct = (v, p) => { const s = v.slice().sort((a,b)=>a-b); return s[Math.min(s.length-1, Math.floor(s.length*p))]; };
const med = v => v.reduce((a,b)=>a+b,0)/v.length;

const R = { cuando: new Date().toISOString(), archivo: null, semillas: [] };
R.archivo = require('node:crypto').createHash('md5')
  .update(fs.readFileSync(ARCHIVO || path.join(__dirname,'..','..','index-4-blindado.html'))).digest('hex');

/* ---------- 1. advanceWeek: media y p95 en 300 semanas ---------- */
const msSemana = [];
const tamSave = {};
const msSave = [], msLoad = [];
for(let i = 0; i < 3; i++){
  const seed = 700 + i*29, meta = 8000 + i*173;
  const h = H.boot({ seed, file: ARCHIVO });
  H.startCareer(h, { metaSeed: meta, style:'mma', div:'LW', age:22 });
  const c = h.ctx;
  for(let s = 1; s <= 300; s++){
    const t0 = process.hrtime.bigint();
    c.advanceWeek();
    msSemana.push(Number(process.hrtime.bigint() - t0) / 1e6);
    if(s === 50 || s === 150 || s === 300){
      const t1 = process.hrtime.bigint();
      const cad = c.saveSerialize(c.G);
      msSave.push(Number(process.hrtime.bigint() - t1) / 1e6);
      (tamSave[s] = tamSave[s] || []).push(cad.length);
    }
  }
  /* save/load completo */
  const t2 = process.hrtime.bigint(); c.saveGame(true);
  msSave.push(Number(process.hrtime.bigint() - t2) / 1e6);
  const id = c.listSaves()[0].id;
  const t3 = process.hrtime.bigint(); c.loadGame(id);
  msLoad.push(Number(process.hrtime.bigint() - t3) / 1e6);
  R.semillas.push({ seed, meta });
}
R.advanceWeek = { n: msSemana.length, media: +med(msSemana).toFixed(2), p95: +pct(msSemana, .95).toFixed(2),
                  max: +Math.max(...msSemana).toFixed(2) };
R.save = { ms_media: +med(msSave).toFixed(2), load_ms_media: +med(msLoad).toFixed(2),
           kb_s50: +(med(tamSave[50])/1024).toFixed(1),
           kb_s150: +(med(tamSave[150])/1024).toFixed(1),
           kb_s300: +(med(tamSave[300])/1024).toFixed(1) };

/* ---------- 2. render del inicio: ms y tamano del html ---------- */
{
  const h = H.boot({ seed: 777, file: ARCHIVO });
  H.startCareer(h, { metaSeed: 8888, style:'mma', div:'LW', age:22 });
  const c = h.ctx;
  A.correrCarrera(h, { maxWeeks: 60, politica:'basica', seedPolitica: 777 });
  /* sin esto se mide el hub COLAPSADO por un evento pendiente (14 nodos), que
     es el caso facil y no dice nada. Me paso ya una vez con hub-dom.js. */
  c.G.pending = [];
  const ms = [], largos = [];
  for(let i = 0; i < 40; i++){
    const t0 = process.hrtime.bigint();
    const html = c.scrHub();
    ms.push(Number(process.hrtime.bigint() - t0) / 1e6);
    largos.push(String(html).length);
  }
  R.hub = { render_ms_media: +med(ms).toFixed(3), render_ms_p95: +pct(ms, .95).toFixed(3),
            html_bytes: Math.round(med(largos)),
            etiquetas: (String(c.scrHub()).match(/<[a-z]/gi) || []).length,
            botones: (String(c.scrHub()).match(/<button/gi) || []).length };
}

fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
console.log(JSON.stringify(R, null, 1));
