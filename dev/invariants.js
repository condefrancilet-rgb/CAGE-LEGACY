'use strict';
/* dev/invariants.js — checkInvariants(G, UI, opts)
   Se ejecuta en el harness tras cada semana, pelea y transicion.
   Un fallo NUNCA se corrige en silencio: se devuelve con sistema, funcion,
   estado y causa, para que el llamador decida (I6).
   `nivel: 'barato'` es el subconjunto que podria correr en produccion.       */

const SISTEMAS = {};

function reg(id, sistema, nivel, fn){ SISTEMAS[id] = { id, sistema, nivel, fn }; }
const esNum = v => typeof v === 'number' && isFinite(v);

/* ---------- barato: numeros, rangos y coherencia basica ---------- */
reg('num.cash', 'economia', 'barato', (G) => esNum(G.cash) ? null : 'G.cash no numerico: ' + G.cash);
reg('num.semana', 'tiempo', 'barato', (G) =>
  (Number.isInteger(G.week) && G.week >= 1 && G.week <= 52) ? null : 'G.week fuera de rango: ' + G.week);
reg('num.año', 'tiempo', 'barato', (G) =>
  (Number.isInteger(G.year) && G.year >= 2000 && G.year <= 2200) ? null : 'G.year fuera de rango: ' + G.year);

reg('record.noNegativo', 'combate', 'barato', (G) => {
  const r = G.player && G.player.rec; if(!r) return 'el jugador no tiene record';
  for(const k of ['w','l','d']) if(!Number.isInteger(r[k]) || r[k] < 0) return 'record.' + k + ' invalido: ' + r[k];
  return null;
});

reg('record.coherente', 'combate', 'caro', (G) => {
  const p = G.player, r = p && p.rec; if(!r) return null;
  const porMetodo = (r.ko||0) + (r.sub||0) + (r.dec||0);
  if(porMetodo > r.w) return 'victorias por metodo (' + porMetodo + ') superan las victorias (' + r.w + ')';
  const porMetodoL = (r.kol||0) + (r.subl||0) + (r.decl||0);
  if(porMetodoL > r.l) return 'derrotas por metodo (' + porMetodoL + ') superan las derrotas (' + r.l + ')';
  if(Array.isArray(p.career) && p.career.length > r.w + r.l + r.d)
    return 'career tiene ' + p.career.length + ' peleas pero el record suma ' + (r.w + r.l + r.d);
  return null;
});

reg('stats.enRango', 'progresion', 'barato', (G) => {
  const p = G.player; if(!p || !p.st) return null;
  for(const k in p.st){
    const v = p.st[k];
    if(!esNum(v)) return 'st.' + k + ' no numerico: ' + v;
    if(v < 0 || v > 100) return 'st.' + k + ' fuera de 0..100: ' + v;
  }
  for(const k of ['pop','rep','fatigue','dmg']) if(p[k] !== undefined && !esNum(p[k])) return 'player.' + k + ' no numerico: ' + p[k];
  return null;
});

reg('lesion.coherente', 'progresion', 'barato', (G) => {
  const p = G.player; if(!p) return null;
  if(p.inj && !(Number.isInteger(p.injWeeks) && p.injWeeks >= 0)) return 'lesionado con injWeeks invalido: ' + p.injWeeks;
  if(!p.inj && p.injWeeks > 0) return 'sin lesion pero injWeeks=' + p.injWeeks;
  return null;
});

/* ---------- rankings y referencias ---------- */
reg('rank.sano', 'rankings', 'caro', (G) => {
  for(const org in (G.rank || {})) for(const div in G.rank[org]){
    const r = G.rank[org][div];
    if(!Array.isArray(r)) return 'rank ' + org + '/' + div + ' no es array';
    if(new Set(r).size !== r.length) return 'rank ' + org + '/' + div + ' tiene posiciones duplicadas';
    for(const id of r){
      if(id === null || id === undefined) continue;
      if(typeof id !== 'string') return 'rank ' + org + '/' + div + ' con id no textual: ' + JSON.stringify(id);
      if(!G.fighters[id]) return 'rank ' + org + '/' + div + ' referencia rota: ' + id;
    }
  }
  return null;
});

reg('champs.sano', 'rankings', 'caro', (G) => {
  for(const org in (G.champs || {})) for(const div in G.champs[org]){
    const id = G.champs[org][div];
    if(id === null || id === undefined || id === '') continue;
    if(!G.fighters[id]) return 'campeon inexistente en ' + org + '/' + div + ': ' + id;
  }
  return null;
});

reg('ref.nextFight', 'combate', 'barato', (G) =>
  (G.nextFight && !G.fighters[G.nextFight.oppId]) ? 'nextFight apunta a un rival inexistente: ' + G.nextFight.oppId : null);
reg('ref.camp', 'combate', 'barato', (G) =>
  (G.camp && G.camp.oppId && !G.fighters[G.camp.oppId]) ? 'camp apunta a un rival inexistente: ' + G.camp.oppId : null);
reg('ref.fight', 'combate', 'barato', (G) =>
  (G.fight && G.fight.opp && !G.fighters[G.fight.opp]) ? 'la pelea activa apunta a un rival inexistente: ' + G.fight.opp : null);

/* ---------- estados imposibles ---------- */
reg('retiro.terminal', 'progresion', 'barato', (G) => {
  const p = G.player; if(!p || !p.retired) return null;
  if(G.nextFight) return 'retirado pero con pelea firmada';
  if(G.camp) return 'retirado pero con campamento activo';
  if(G.fight && !G.fight.over) return 'retirado pero con una pelea en curso';
  if(G.offers && G.offers.length) return 'retirado pero con ofertas sobre la mesa';
  return null;
});

reg('pelea.rounds', 'combate', 'caro', (G) => {
  const f = G.fight; if(!f) return null;
  if(!esNum(f.round) || f.round < 1) return 'round invalido: ' + f.round;
  if(esNum(f.rounds) && f.round > f.rounds + 1)
    return 'round ' + f.round + ' supera el maximo declarado (' + f.rounds + ')';
  for(const lado of ['p','o']){
    const s = f[lado]; if(!s) continue;
    for(const k of ['hp','stam']) if(!esNum(s[k]) || s[k] < 0 || s[k] > 100) return 'fight.' + lado + '.' + k + ' fuera de rango: ' + s[k];
  }
  return null;
});

reg('pelea.unaSola', 'combate', 'barato', (G) =>
  (G.fight && G.mg) ? 'hay una pelea y un minijuego abiertos a la vez' : null);

reg('ui.coherente', 'navegacion', 'barato', (G, UI) => {
  if(!UI) return null;
  if(UI.screen === 'fight' && !G.fight) return 'pantalla de pelea sin pelea activa';
  if(UI.screen === 'mg' && !G.mg) return 'pantalla de minijuego sin minijuego activo';
  if(UI.screen === 'fightresult' && !(G.fight && G.fight.result)) return 'pantalla de resultado sin resultado';
  return null;
});

/* ---------- crecimiento sin limite ---------- */
const TOPES = { news: 200, feed: 500, pending: 20, career: 400, retiredList: 2000 };
reg('arrays.acotados', 'estado', 'caro', (G) => {
  for(const k in TOPES){
    const a = G[k] !== undefined ? G[k] : (G.player ? G.player[k] : undefined);
    if(Array.isArray(a) && a.length > TOPES[k]) return k + ' crecio a ' + a.length + ' (tope ' + TOPES[k] + ')';
  }
  if(G.player && Array.isArray(G.player.career) && G.player.career.length > TOPES.career)
    return 'player.career crecio a ' + G.player.career.length;
  return null;
});

/**
 * checkInvariants(G, UI, opts)
 * opts.nivel: 'barato' (subconjunto de produccion) | 'todo' (por defecto)
 * opts.contexto: texto que describe el momento ('tras semana 12', 'tras pelea')
 * Devuelve [] si todo esta bien, o una lista de fallos con sistema y causa.
 */
function checkInvariants(G, UI, opts){
  opts = opts || {};
  const soloBarato = opts.nivel === 'barato';
  const fallos = [];
  if(!G) return [{ id: 'estado.existe', sistema: 'estado', causa: 'no hay estado de juego', contexto: opts.contexto }];
  for(const id in SISTEMAS){
    const s = SISTEMAS[id];
    if(soloBarato && s.nivel !== 'barato') continue;
    let causa = null;
    try { causa = s.fn(G, UI); }
    catch(e){ causa = 'el propio invariante lanzo: ' + (e && e.message); }
    if(causa) fallos.push({ id: s.id, sistema: s.sistema, causa, contexto: opts.contexto || null });
  }
  return fallos;
}

module.exports = { checkInvariants, SISTEMAS };
