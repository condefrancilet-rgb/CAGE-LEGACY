'use strict';
/* dev/autopilot.js — juega carreras completas sin UI, con politica determinista.
   No toca el juego: solo llama a sus funciones publicas en el orden en que las
   llamaria un jugador. Usado por golden traces (F0), sim masiva (F5) y tests.  */

const ACCIONES_PIE   = ['jab','combo','counter','lowkick','clinch','td','move'];
const ENTRENOS       = ['box','kick','muay','wrest','grap','cardio','str','mind','rest'];

/** Politicas de accion en combate. Cada una recibe las opciones disponibles. */
const POLITICAS = {
  /* siempre la primera opcion disponible (bot de opcion fija) */
  fija:     (ops) => ops[0].k,
  /* aleatoria segun el RNG del juego, para no romper el determinismo */
  aleatoria:(ops, ctx) => ops[Math.floor(ctx.rnd() * ops.length)].k,
  /* heuristica simple: agresiva con ventaja, conservadora sin aire */
  basica:   (ops, ctx) => {
    const f = ctx.G.fight;
    const prefer = (ks) => { for(const k of ks){ const o = ops.find(x => x.k === k); if(o) return o.k; } return null; };
    if(f.p.stam < 30) return prefer(['move','hold','grind','break']) || ops[0].k;
    if(f.o.hp  < 35)  return prefer(['combo','gnp','sub','knees']) || ops[0].k;
    return prefer(['jab','grind','hold','knees']) || ops[0].k;
  },
};

/**
 * Corre una carrera hasta `maxWeeks` o hasta el retiro.
 * h: harness (dev/harness.js), opts: { maxWeeks, politica, entreno, traza }
 * Devuelve { semanas, eventos, peleas, traza[] }.
 */
function correrCarrera(h, opts){
  opts = opts || {};
  const c = h.ctx;
  const maxWeeks  = opts.maxWeeks || 200;
  const politica  = POLITICAS[opts.politica || 'basica'];
  const traza     = [];
  const quiereTraza = !!opts.traza;
  let peleas = 0, eventos = 0, guardas = 0;

  /* RNG propio del autopiloto, sembrado, para no consumir el del juego */
  let s = (opts.seedPolitica === undefined ? 12345 : opts.seedPolitica) >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const ctxPol = { G: c.G, rnd, c };

  const semanaInicial = c.G.year * 52 + c.G.week;

  while(!c.G.player.retired){
    const semanaActual = c.G.year * 52 + c.G.week;
    if(semanaActual - semanaInicial >= maxWeeks) break;
    if(++guardas > maxWeeks * 60) throw new Error('autopilot: bucle sin avance en la semana ' + c.G.week);

    /* 1. eventos pendientes bloquean todo */
    if(c.G.pending && c.G.pending.length){
      const ev = c.G.pending[0];
      const nOps = (ev && ev.opts && ev.opts.length) ? ev.opts.length : 1;
      c.resolveEvent(Math.floor(rnd() * nOps));
      eventos++;
      continue;
    }

    /* 2. pelea en curso */
    if(c.G.fight && !c.G.fight.over){
      const ops = c.fightOptions();
      if(!ops || !ops.length){ c.finishFight('dec', null); continue; }
      ctxPol.G = c.G;
      c.fightAct(politica(ops, ctxPol));
      continue;
    }

    /* 3. pelea terminada: cobrar y salir de la pantalla de resultado.
       Se sale NAVEGANDO, como el jugador: go() es quien descarta G.fight una
       vez cobrado. Anular G.fight a mano dejaba UI.screen en 'fightresult'
       sin resultado —un estado que el juego real nunca produce— y ademas
       saltaba la unica via por la que la pelea muere.                       */
    if(c.G.fight && c.G.fight.over){
      if(quiereTraza) traza.push(trazaPelea(c, c.G.fight));
      peleas++;
      if(!c.G.paid) c.confirmFight();
      c.go('hub');
      if(c.G.fight){ throw new Error('autopilot: go() no descarto la pelea terminada'); }
      continue;
    }

    /* 4. campamento terminado -> pelear */
    if(c.G.camp && c.G.nextFight && c.G.camp.i >= c.G.camp.weeks){ c.goFight(); continue; }

    /* 5a. sin organizacion: firmar contrato (pasa por la negociacion real) */
    if(!c.G.player.org && c.G.offers && c.G.offers.length){
      const co = c.G.offers.find(o => o.type === 'contract' && c.G.orgs[o.org]);
      if(co){
        c.negoStart(co);
        c.negoClose();
        c.G.mg = null;
        c.UI.screen = 'hub';
        continue;
      }
    }

    /* 5b. hay ofertas de pelea -> aceptar una */
    if(!c.G.nextFight && c.G.offers && c.G.offers.length){
      const idx = c.G.offers.findIndex(o => o.type === 'fight' && o.oppId && c.F(o.oppId));
      if(idx >= 0){ if(c.acceptFight(idx)) continue; }
      if(!c.G.offers.some(o => o.type === 'contract')) c.G.offers = [];
    }

    /* 6. semana normal: entrenar (campamento o no) */
    const antes = c.G.year * 52 + c.G.week;
    const p = c.G.player;
    const k = p.inj ? 'rest' : (opts.entreno || ENTRENOS[Math.floor(rnd() * ENTRENOS.length)]);
    c.doWeek(k);
    if(quiereTraza) traza.push(trazaSemana(c));
    /* si la semana no avanzo (evento que la bloquea), forzamos progreso */
    if(c.G.year * 52 + c.G.week === antes && (!c.G.pending || !c.G.pending.length)) c.advanceWeek();

    /* 7. sin ofertas ni pelea durante mucho tiempo: pedir ofertas */
    if(!c.G.nextFight && (!c.G.offers || !c.G.offers.length) && !p.inj) c.makeOffers();
  }

  return { semanas: c.G.year * 52 + c.G.week - semanaInicial, eventos, peleas, traza };
}

/* --- observables por semana: lo que un jugador ve --- */
function trazaSemana(c){
  const p = c.G.player;
  return {
    t: 'w', y: c.G.year, w: c.G.week,
    cash: redondea(c.G.cash),
    rec: p.rec.w + '-' + p.rec.l + '-' + p.rec.d,
    pop: redondea(p.pop), rank: rankDe(c, p),
    inj: p.inj ? (p.inj + ':' + p.injWeeks) : '',
    fat: redondea(p.fatigue), dmg: redondea(p.dmg),
  };
}
function trazaPelea(c, f){
  const p = c.G.player, r = f.result || {};
  return {
    t: 'f', y: c.G.year, w: c.G.week,
    opp: f.opp, round: f.round,
    metodo: r.method || '?', gano: r.win === 'p' || r.winner === 'p',
    hp: redondea(f.p.hp), ohp: redondea(f.o.hp),
    rec: p.rec.w + '-' + p.rec.l + '-' + p.rec.d,
    cash: redondea(c.G.cash), rank: rankDe(c, p),
  };
}
function rankDe(c, p){
  try {
    const r = c.G.rank && c.G.rank[p.org] && c.G.rank[p.org][p.div];
    if(!Array.isArray(r)) return -1;
    return r.indexOf(p.id);
  } catch(e){ return -1; }
}
function redondea(v){ return (typeof v === 'number' && isFinite(v)) ? Math.round(v * 100) / 100 : v; }

module.exports = { correrCarrera, POLITICAS, ACCIONES_PIE, ENTRENOS };
