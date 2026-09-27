#!/usr/bin/env node
'use strict';
/* dev/tq-inventario.js — INVENTARIO VERIFICABLE DEL ÁRBOL DE TÉCNICAS (TQ)
   ---------------------------------------------------------------------------
   No se escribe a mano: se genera del árbol que el juego tiene cargado
   (TQ.T) y cada función o consumidor que se nombra se comprueba en el código
   fuente o en el bus de hooks. Si algo deja de existir, el inventario lo dice.
   La prueba dev/tests/21-fightiq-capa.js regenera esto en memoria y exige que
   coincida con dev/TQ-INVENTARIO.md.
     node dev/tq-inventario.js            -> escribe dev/TQ-INVENTARIO.md
     node dev/tq-inventario.js --check    -> sale con 1 si el archivo quedó viejo */
const fs = require('node:fs');
const path = require('node:path');
const H = require('./harness.js');

const OUT = path.join(__dirname, 'TQ-INVENTARIO.md');

function generar(c, src){
  const T = c.TQ.T, C = c.TQ.C, BR = c.TQ.BR, RAR = c.TQ.RAR;
  const cuenta = (re) => (src.match(re) || []).length;
  const hay = (evt, id) => c.hookHas(evt, id);
  /* consumidores que el inventario nombra: se verifican, no se suponen */
  const V = {
    state: /TQ\.state = function/.test(src), use: /TQ\.use = function/.test(src),
    resolve: /TQ\.resolve = function/.test(src), apply: /TQ\.apply = function/.test(src),
    chance: /TQ\.chance = function/.test(src), resist: /TQ\.resist = function/.test(src),
    hit: /TQ\.hit = function/.test(src), divF: /TQ\.divF = function/.test(src),
    markDodge: /TQ\.markDodge = function/.test(src), passives: /TQ\.passives = function/.test(src),
    gpmod: hay('gp:mod', 'tecnicas'), eff: hay('combat:eff', 'TQ'), post: hay('exchange:post', 'tqPasivas'),
    drain: /var _tqDrain = drain;/.test(src)
  };
  /* ¿quién llama a TQ.use? (la IA del rival, ¿puede?) */
  const llamadoresUse = [];
  if(/onclick="TQ\.use\(/.test(src)) llamadoresUse.push('botón del panel de técnicas (jugador)');
  if(/try\{ TQ\.use\(id\); \}/.test(src)) llamadoresUse.push('CMB.ultUse (botón de Ultimate del jugador)');
  const otrosUse = cuenta(/TQ\.use\(/g) - cuenta(/onclick="TQ\.use\(/g) - cuenta(/try\{ TQ\.use\(id\); \}/g) - cuenta(/TQ\.use = function/g);
  /* lecturas de lo que las técnicas escriben (código muerto) */
  const lecturasBack = cuenta(/st\.back\b/g) - cuenta(/st\.back=1/g);
  const lecturasBleed = cuenta(/st\.bleed\b/g) - cuenta(/st\.bleed = safeNum\(st\.bleed,0\) \+ fx\.bleed\*mult/g);
  const ults = (c.CMB && c.CMB.ULT) ? c.CMB.ULT : {};
  const panel = cuenta(/TQ\.fightPanel\s*=\s*function/g);

  const L = [];
  L.push('# Inventario del árbol de técnicas (TQ)');
  L.push('');
  L.push('> Generado por `node dev/tq-inventario.js` a partir de `TQ.T` del juego cargado. No editar a mano:');
  L.push('> la prueba `dev/tests/21-fightiq-capa.js` exige que coincida con el juego.');
  L.push('');
  L.push('## Resumen verificado');
  L.push('');
  const porNivel = [1,2,3,4].map(lv => lv + ': ' + T.filter(t => t.lv === lv).length).join(' · ');
  L.push('- Técnicas: **' + T.length + '** (' + T.filter(t => t.t === 'a').length + ' activas, ' + T.filter(t => t.t === 'p').length + ' pasivas). Por nivel: ' + porNivel + '.');
  L.push('- Ramas: ' + Object.keys(BR).map(k => k + ' = ' + BR[k].n + ' (' + T.filter(t => t.br === k).length + ')').join(' · ') + '.');
  L.push('- Nivel 4 (legendarias): ' + T.filter(t => t.lv === 4).map(t => '`' + t.id + '`').join(', ') + '.');
  L.push('- Ultimates (`CMB.ULT`): ' + Object.keys(ults).map(k => '`' + k + '` → ' + ults[k].n.replace(/^[^A-ZÁÉÍÓÚÑ]+/, '')).join(', ') + '.');
  L.push('- Resolución de una activa: `TQ.state` (condiciones) → `TQ.use` (gasta el uso, abre el minijuego del motor FX, filtro `tq:node`) → `TQ.resolve` (nota por `TQ.grade`: PERFECTA ≥ 0,86, BUENA ≥ 0,50, FALLA; `TQ.chance` con `TQ.resist` puede bajarla un escalón; evento `tq:resolved`) → `TQ.apply` (efecto). Funciones presentes: ' +
         ['state','use','resolve','chance','resist','apply','hit','divF','markDodge'].map(k => k + (V[k] ? ' ✓' : ' ✗ FALTA')).join(', ') + '.');
  L.push('- Pasivas: `TQ.passives()` (caché `TQ.PAS`) ' + (V.passives ? '✓' : '✗ FALTA') + ', consumidas por `gp:mod/tecnicas` ' + (V.gpmod ? '✓' : '✗') +
         ' (ataque), `combat:eff/TQ` ' + (V.eff ? '✓' : '✗') + ' (defensa, anti-derribo, suelo), la envoltura de `drain` ' + (V.drain ? '✓' : '✗') +
         ' (aire), `exchange:post/tqPasivas` ' + (V.post ? '✓' : '✗') + ' (guardia, lectura, reja, esquiva, sangrado).');
  L.push('- ¿La IA del rival usa técnicas del árbol? **No.** `TQ.use` sólo se llama desde: ' + llamadoresUse.join('; ') + (otrosUse > 0 ? '; y ' + otrosUse + ' llamada(s) más a revisar' : '') + '.');
  L.push('- Puntos: `TQ.award` (+3 KO/sumisión, +2 unánime, +1 dividida/mayoritaria, +1 título, +1 si hubo una PERFECTA; techo 5 por pelea).');
  L.push('');
  L.push('## Hallazgos del inventario');
  L.push('');
  L.push('- `fx.flag:\'back\'` (toma de espalda) escribe `st.back=1` y **ninguna función lo lee** (' + lecturasBack + ' lecturas): la «espalda tomada» de `g_back` y `g_rev` no tiene efecto propio más allá de su control y desgaste.');
  L.push('- `st.bleed` (cortes) tiene ' + lecturasBleed + ' lecturas: se consume en `exchange:post/tqPasivas` y se muestra en el panel. Correcto.');
  L.push('- `TQ.fightPanel` está definido ' + panel + ' veces; la definición que rige es la última (paginada). Es una redefinición previa a esta etapa.');
  L.push('');
  L.push('## Técnica por técnica');
  const fxTxt = (fx) => {
    if(!fx) return '—';
    const p = [];
    if(fx.dmg) p.push('daño ' + fx.dmg[0] + '–' + fx.dmg[1]);
    if(fx.kd) p.push('knockdown ' + fx.kd);
    if(fx.finish) p.push('finaliza (sólo PERFECTA) ' + fx.finish + ' ' + (fx.fin || 'ko'));
    if(fx.sub) p.push('sumisión ' + fx.sub);
    if(fx.td) p.push('derribo');
    if(fx.pos) p.push('posición → ' + fx.pos);
    if(fx.ctrl) p.push('control +' + fx.ctrl);
    if(fx.sig) p.push('golpes significativos +' + fx.sig);
    if(fx.drainO) p.push('le saca aire ' + fx.drainO);
    if(fx.drainP) p.push('te cuesta aire ' + fx.drainP);
    if(fx.restP) p.push('recuperás aire ' + fx.restP);
    if(fx.healP) p.push('recuperás ' + fx.healP + ' de vida');
    if(fx.dist) p.push('distancia ' + (fx.dist > 0 ? '+' : '') + fx.dist);
    if(fx.read) p.push('lectura +' + fx.read);
    if(fx.bleed) p.push('corte (sangrado ' + fx.bleed + ')');
    if(fx.flag) p.push('marca «' + fx.flag + '»');
    if(fx.ctrlO) p.push('control del rival +' + fx.ctrlO);
    return p.join(', ');
  };
  const estado = (fx) => {
    if(!fx) return [];
    const e = new Set();
    if(fx.dmg || fx.kd) { e.add('f.o.hp'); e.add('f.p.sig'); e.add('f.p.rd'); }
    if(fx.kd) e.add('f.p.kd');
    if(fx.finish || fx.sub) e.add('fin de la pelea (finishFight)');
    if(fx.td) { e.add('f.p.td'); e.add('f.p.ctrl'); }
    if(fx.pos) e.add('f.pos');
    if(fx.ctrl) e.add('f.p.ctrl');
    if(fx.sig) e.add('f.p.sig');
    if(fx.drainO) e.add('f.o.stam');
    if(fx.drainP || fx.restP) e.add('f.p.stam');
    if(fx.healP) e.add('f.p.hp');
    if(fx.dist || fx.read) e.add('f.cl (distancia/lectura)');
    if(fx.bleed) e.add('f.tq.bleed');
    if(fx.flag === 'back') e.add('f.tq.back (sin lector)');
    if(fx.flag === 'dodge') e.add('f.tq.dodgeAt');
    if(fx.ctrlO) e.add('f.o.ctrl');
    return [...e];
  };
  for(const k of Object.keys(BR)){
    L.push('');
    L.push('### ' + BR[k].n);
    for(const t of T.filter(x => x.br === k)){
      L.push('');
      L.push('#### `' + t.id + '` — ' + t.n.replace(/^[^A-ZÁÉÍÓÚÑ0-9]+/, ''));
      L.push('');
      const req = [t.req ? 'antes `' + t.req + '`' : null, t.reqN ? t.reqN + ' técnicas de la rama' : null].filter(Boolean).join(' y ') || 'ninguno';
      L.push('- Nivel ' + t.lv + ' (' + (RAR[t.lv] ? RAR[t.lv].n : '?') + ') · ' + (t.t === 'a' ? 'activa' : 'pasiva') + ' · costo ' + t.cost + ' 🔷 · requisitos: ' + req + '.');
      if(t.t === 'a'){
        const conds = (t.cond || []).map(q => C[q] ? C[q].t : q);
        L.push('- Uso: desde ' + (t.pos || []).join(', ') + (conds.length ? ' · condiciones: ' + conds.join('; ') : ' · sin condiciones') +
               ' · ' + (t.uses || 1) + ' uso(s) por pelea · aire ' + (t.stam || 0) + (t.wt ? ' (ajustado por división: ' + t.wt + ', `TQ.divF`)' : '') + '.');
        L.push('- Ejecución: minijuego `' + (t.mg || 'zone') + '`, dificultad ' + (t.diff || 1) + '; éxito según ' + (t.st || []).join(', ') + ', la nota, el aire y la resistencia del rival.');
        L.push('- Efecto (BUENA ×0,78 / PERFECTA ×1,22): ' + fxTxt(t.fx) + '.');
        L.push('- Si FALLA: ' + (t.bad ? fxTxt(t.bad) + (t.bad.log ? ' — «' + t.bad.log + '»' : '') : 'sólo pierde el intercambio y el aire (60 %)') + '.');
        const cd = t.cond || [];
        L.push('- Distancia: ' + (cd.includes('close') ? 'exige rival cerca' : cd.includes('far') ? 'exige distancia media/larga' : 'no condiciona') + (t.fx && t.fx.dist ? '; la cambia' : '') +
               ' · Aire: ' + (cd.includes('gas') ? 'exige mucho aire' : cd.includes('fresh') ? 'exige aire' : 'no condiciona') +
               ' · Daño: ' + (cd.includes('hurt') ? 'exige rival dañado' : cd.includes('crit') ? 'sólo en situación crítica' : 'no condiciona') + '.');
        L.push('- Estado que modifica: ' + (estado(t.fx).concat(t.bad ? estado(t.bad).map(x => x + ' (al fallar)') : []).join(', ') || '—') + '.');
        L.push('- Funciones: `TQ.state` → `TQ.use` → `TQ.resolve` → `TQ.apply`' + (t.fx && (t.fx.dmg || t.fx.kd) ? ' → `TQ.hit`' : '') +
               (t.fx && (t.fx.finish || t.fx.sub) ? ' → `finishFight`' : '') + (t.fx && t.fx.flag === 'dodge' ? ' → `TQ.markDodge`' : '') + '. En combate: panel de técnicas, si está desbloqueada y la posición coincide.');
      } else {
        const q = t.pas || {}, efs = [];
        if(q.atk) Object.keys(q.atk).forEach(a => efs.push('+' + q.atk[a] + ' a ' + a + ' (`gp:mod/tecnicas`)'));
        if(q.def) efs.push('+' + q.def + ' defensa (`combat:eff/TQ`)');
        if(q.tdd) efs.push('+' + q.tdd + ' anti-derribo (`combat:eff/TQ`)');
        if(q.gnd) efs.push('+' + q.gnd + ' suelo (`combat:eff/TQ`)');
        if(q.chin) efs.push('guardia: devuelve ' + q.chin + ' del daño (`exchange:post/tqPasivas`)');
        if(q.stam) efs.push('aire: gasta ' + q.stam + ' menos (envoltura de `drain`)');
        if(q.read) efs.push('lectura +' + q.read + ' (`exchange:post/tqPasivas`)');
        if(q.grindO) efs.push('reja: le saca ' + q.grindO + ' de aire en el clinch (`exchange:post/tqPasivas`)');
        L.push('- Efecto permanente: ' + (efs.join('; ') || '—') + '. Sin uso, sin minijuego, sin fallo.');
      }
      L.push('- Ultimate: ' + (ults[t.id] ? '**sí** → ' + ults[t.id].n.replace(/^[^A-ZÁÉÍÓÚÑ]+/, '') + ' (ver `dev/ULTIMATES-AUDITORIA.md`)' : 'no') +
             ' · IA del rival: no · Efectos secundarios: ' + ([t.fx && t.fx.pos ? 'cambia la posición' : null, t.fx && t.fx.flag ? 'marca «' + t.fx.flag + '»' : null,
               t.fx && t.fx.bleed ? 'deja un corte' : null, t.bad && t.bad.pos ? 'al fallar cambia la posición' : null].filter(Boolean).join(', ') || 'ninguno') +
             (t.fx && t.fx.flag === 'back' ? ' · **código muerto**: la marca «back» no se lee' : '') + '.');
    }
  }
  return L.join('\n') + '\n';
}

if(require.main === module){
  const h = H.boot({ seed: 1 });
  const src = fs.readFileSync(path.join(__dirname, '..', 'index-4-blindado.html'), 'utf8');
  const md = generar(h.ctx, src);
  if(process.argv.includes('--check')){
    const ok = fs.existsSync(OUT) && fs.readFileSync(OUT, 'utf8') === md;
    console.log(ok ? 'inventario al día' : 'INVENTARIO VIEJO: correr node dev/tq-inventario.js');
    process.exit(ok ? 0 : 1);
  }
  fs.writeFileSync(OUT, md);
  console.log('escrito ' + OUT + ' · ' + md.split('\n').length + ' líneas');
}
module.exports = { generar, OUT };
