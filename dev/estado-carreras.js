#!/usr/bin/env node
'use strict';
/* dev/estado-carreras.js — CARRERAS ENTERAS QUE CAMBIAN DE TODO (fase 13)
   ---------------------------------------------------------------------------
   El jugador completo de dev/rpg-carrera-completa.js (técnicas, Ultimates,
   plan, lecciones, compras, servicios, visitas, invitaciones) y además lo que
   esa carrera no hace: cambiar de mánager, cambiar de división siendo campeón,
   y —lo que busca esta fase— CERRAR LA PÁGINA Y VOLVER cada tantas semanas.
   Cada recarga es un arranque nuevo con el mismo disco: el estado que se
   carga tiene que ser el que había, y la carrera SIGUE en el contexto nuevo.
   Al retiro, el final tiene que decir la verdad sobre los cinturones, y una
   carrera nueva en la misma sesión tiene que ser la misma que en un arranque
   limpio con ese disco.
     node dev/estado-carreras.js [--n 3] [--file otra.html] [--cada 150]      */
const H = require('./harness.js');
const A = require('./autopilot.js');
const INV = require('./invariants.js');
const J = require('./rpg-carrera-completa.js');     /* define A.POLITICAS.rpg */
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const N = parseInt(arg('n', '3'), 10);
const CADA = parseInt(arg('cada', '150'), 10);
const ARCHIVO = arg('file', null) || undefined;

function estado(c){ const o = JSON.parse(JSON.stringify(c.STATE.persistable(c.G))); delete o.saveId; delete o.savedAt; return o; }
function difiere(a, b, p, out){
  out = out || []; if(out.length > 3 || JSON.stringify(a) === JSON.stringify(b)) return out;
  if(a && b && typeof a === 'object' && typeof b === 'object'){ for(const k of new Set([...Object.keys(a), ...Object.keys(b)])) difiere(a[k], b[k], p + '.' + k, out); }
  else out.push(p + ': ' + String(JSON.stringify(a)).slice(0, 40) + ' ≠ ' + String(JSON.stringify(b)).slice(0, 40));
  return out;
}
/* cerrar la página y volver: arranque nuevo con el disco tal cual */
function recargar(h, seed){
  const c = h.ctx; c.saveGame(true);
  const sid = c.G.saveId, antes = estado(c), pend = c.G.pending.length, tmp = !!c.G.tmpOpp, vivo = !!(c.G.fight && !c.G.fight.over);
  const x = H.boot({ seed, file: ARCHIVO, storage: new Map(c.localStorage.__map) });
  if(!x.ctx.loadGame(sid)) return { h: x, fallo: 'no cargó' };
  const d = difiere(antes, estado(x.ctx), 'G');
  return { h: x, fallo: d.length ? 'el estado cargado no es el guardado: ' + d.join(' | ') : null, pend, tmp, vivo };
}

const t0 = Date.now();
let rotas = 0;
for(let i = 0; i < N; i++){
  const seed = 8300 + i * 37, metaSeed = 930000 + i * 7919;
  let h = H.boot({ seed, file: ARCHIVO });
  H.startCareer(h, { metaSeed, style: ['wrest','boxer','mma','bjj','muay'][i % 5], div: ['LW','FEA','WW'][i % 3], age: 21 });
  let s = seed >>> 0; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  let semanas = 0, fallo = null;
  const k11 = { compras: [], estilista: 0, visitas: 0, jet: 0, invit: 0, villa: 0, docOf: 0, docFirm: 0, resto: 0 };
  const k12 = { plan: 0, exp: 0, deuda: 0, contenido: 0, mudanza: 0, verPelea: 0 };
  const k13 = { recargas: 0, conPendiente: 0, conRival: 0, mgr: 0, div: 0, divs: {}, mgrs: {}, proxMgr: 65 };
  const tc = Date.now();
  while(!h.ctx.G.player.retired && h.ctx.ageOf(h.ctx.G.player) < 37 && semanas < 1000){
    const c = h.ctx, p = c.G.player;
    try {
      A.correrCarrera(h, { maxWeeks: 1, politica: 'rpg', seedPolitica: seed * 1000 + semanas });
      J.semanaDeJugador(c, rnd);
      J.comprasDeJugador(c, rnd, k11);
      J.serviciosDeJugador(c, rnd, k12);
      /* fase 13: cambiar de mánager de vez en cuando, por la vía del jugador */
      if(semanas >= k13.proxMgr && !c.G.camp && !c.G.nextFight && !c.G.pending.length){
        const otros = c.G.mgrs.filter(m => m.id !== c.G.mgId);
        if(otros.length){ c.changeMgr(otros[Math.floor(rnd() * otros.length)].id); k13.mgr++; }
        k13.proxMgr = semanas + 130;
      }
      /* fase 13: el campeón cambia de categoría (la vía propia del juego) */
      if(p.org && c.rankOf(p) === 'C' && !c.G.camp && !c.G.nextFight && !c.G.pending.length && rnd() < 0.05){
        const d0 = p.div; c.changeWeightClass(rnd() < 0.7 ? 1 : -1); if(p.div !== d0) k13.div++;
      }
      k13.divs[p.div] = 1; k13.mgrs[c.G.mgId] = 1;
    } catch(e){ fallo = 'excepción en la semana ' + semanas + ': ' + e.message; break; }
    semanas++;
    const malas = INV.checkInvariants(h.ctx.G, h.ctx.UI, {}) || [];
    if(malas.length){ fallo = 'invariante en la semana ' + semanas + ': ' + JSON.stringify(malas[0]).slice(0, 160); break; }
    /* fase 13: cerrar la página y volver; la carrera sigue en el arranque nuevo */
    if(semanas % CADA === 0){
      const r = recargar(h, seed + semanas);
      if(r.fallo){ fallo = 'recarga en la semana ' + semanas + ': ' + r.fallo; break; }
      h = r.h; k13.recargas++; if(r.pend) k13.conPendiente++; if(r.tmp) k13.conRival++;
    }
  }
  const c = h.ctx, p = c.G.player;
  /* lo de ESTA carrera se anota antes de empezar la siguiente en el mismo contexto */
  const deEsta = { tec: c.TQ.ownedAll(), ult: Object.keys((c.G.rpg && c.G.rpg.ult) || {}).join(','), mem: Object.keys((c.G.rpg && c.G.rpg.fm) || {}).length };
  let fin = {};
  if(!fallo){
    if(!p.retired) c.retire();
    const e = c.careerEnding(), bd = Array.isArray(p.beltDivs) ? p.beltDivs : [];
    fin = { final: e.t, cinturones: bd.join(',') || '—' };
    if((e.t === 'CAMPEÓN EN DOS DIVISIONES') !== (p.titles >= 1 && bd.length >= 2)) fallo = 'el final no dice la verdad sobre los cinturones: ' + e.t + ' con ' + JSON.stringify(bd);
    /* la carrera siguiente: misma sesión vs arranque limpio con el mismo disco */
    if(!fallo){
      c.saveGame(true);
      const disco = new Map(c.localStorage.__map);
      const B = (hh) => { H.startCareer(hh, { metaSeed: metaSeed + 1, style: 'mma', div: 'LW', age: 22, first: 'Otra', last: 'Carrera' });
        A.correrCarrera(hh, { maxWeeks: 30, politica: 'basica', seedPolitica: 5 }); return estado(hh.ctx); };
      const d = difiere(B(h), B(H.boot({ seed, file: ARCHIVO, storage: disco })), 'G');
      fin.siguiente = d.length ? 'HEREDA: ' + d.join(' | ') : 'limpia';
      if(d.length) fallo = 'la carrera siguiente hereda estado de ésta: ' + d.join(' | ');
    }
  }
  if(fallo) rotas++;
  console.log('carrera ' + (i + 1) + ' · semilla ' + seed + ' · ' + semanas + ' semanas · ' + ((Date.now() - tc) / 1000).toFixed(0) + ' s' + (fallo ? '  ✗ ' + fallo : '  ✓'));
  console.log('   récord ' + p.rec.w + '-' + p.rec.l + '-' + p.rec.d + ' · títulos ' + p.titles + ' · defensas ' + p.defenses + ' · final «' + (fin.final || '—') + '» · cinturones en ' + (fin.cinturones || '—') +
              ' · divisiones ' + Object.keys(k13.divs).join(',') + ' (cambios de campeón ' + k13.div + ') · mánagers ' + Object.keys(k13.mgrs).length + ' (cambios ' + k13.mgr + ')');
  console.log('   recargas en arranque nuevo ' + k13.recargas + ' (con evento pendiente ' + k13.conPendiente + ', con rival en pantalla ' + k13.conRival + ') · carrera siguiente ' + (fin.siguiente || '—') +
              ' · compras ' + k11.compras.length + ' · visitas ' + k11.visitas + ' · invitaciones ' + k11.invit + ' · mudanzas ' + k12.mudanza + ' · técnicas ' + deEsta.tec +
              ' · Ultimates ' + (deEsta.ult || '—') + ' · rivales en memoria ' + deEsta.mem);
}
console.log('\n' + (N - rotas) + '/' + N + ' carreras sin fallos · invariantes cada semana · recarga en arranque nuevo cada ' + CADA + ' semanas · ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
process.exit(rotas ? 1 : 0);
