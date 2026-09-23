'use strict';
/* RONDA 2 · A1 — RED DEL SERIALIZADOR DEL SAVE, escrita ANTES de tocarlo.
   saveSerialize era el 31,8 % del CPU de una carrera jugada en Chromium: un
   JSON.stringify con replacer, que llama a JS por cada propiedad del estado.
   Esta red fija QUE produce, no COMO: el texto tiene que ser byte a byte el
   de la semantica original, que esta escrita aqui mismo, en la prueba, y no
   se lee del juego (si se leyera, un cambio en el juego cambiaria tambien la
   referencia y la prueba no veria nada).
   Y fija dos propiedades mas: serializar NO cambia el estado (ni valores ni
   identidad de objetos), y si serializar falla a mitad, el estado queda como
   estaba.                                                                    */
const { suite, test, ok, eq, lanza } = require('../run-tests.js');
const H = require('../harness.js');
const A = require('../autopilot.js');
const fs = require('node:fs');
const path = require('node:path');

/* ---- la semantica ORIGINAL (00be0a4), copiada: no se toca nunca ---- */
function referencia(c, g){
  const STKEY = c.STKEY;
  const replacer = function(key, value){
    if((key==='st'||key==='pot'||key==='lr') && value && typeof value==='object' && !Array.isArray(value)){
      const out = new Array(STKEY.length);
      for(let i=0;i<STKEY.length;i++){
        const v = value[STKEY[i]];
        out[i] = (typeof v==='number' && isFinite(v)) ? Math.round(v*10)/10 : 50;
      }
      return out;
    }
    return value;
  };
  g.stKeys = STKEY.slice();
  const out = {};
  for(const k in g){
    if(!Object.prototype.hasOwnProperty.call(g, k)) continue;
    if(c.STATE.RUNTIME_KEYS.indexOf(k) >= 0) continue;
    out[k] = g[k];
  }
  return JSON.stringify(out, replacer);
}

/* compara, y exige que serializar no toque el estado */
function exigeIgual(c, contexto){
  const G = c.G;
  c.saveSerialize(G);        /* saveSerialize escribe G.stKeys por diseño: la primera vez lo crea */
  const fp0 = c.STATE.fingerprint(true);
  const stJugador = G.player && G.player.st;
  const a = c.saveSerialize(G);
  const fp1 = c.STATE.fingerprint(true);
  const b = referencia(c, G);
  if(a !== b){
    let i = 0; while(i < a.length && a[i] === b[i]) i++;
    throw new Error(contexto + ': el save difiere de la semantica original en el caracter ' + i +
      '\n      juego:      …' + a.slice(Math.max(0, i - 60), i + 60) +
      '\n      referencia: …' + b.slice(Math.max(0, i - 60), i + 60));
  }
  eq(fp1, fp0, contexto + ': serializar cambio el estado');
  if(G.player) ok(G.player.st === stJugador && !Array.isArray(G.player.st), contexto + ': serializar cambio la identidad de player.st');
}

function cargarCrudo(seed, crudo){
  const h = H.boot({ seed }), c = h.ctx, id = 's1789970254999';
  c.localStorage.setItem(c.SAVE_ONE + id, crudo);
  const idx = c.saveIndex(); idx[id] = { name:'x', v:c.SAVE_VERSION, at:1, kb:1 }; c.saveIndexWrite(idx);
  ok(c.loadGame(id), 'no carga');
  return h;
}

suite('R2 · el save se serializa igual que siempre (A1)', () => {

  test('carrera recien creada', () => {
    const h = H.boot({ seed: 31 });
    H.startCareer(h, { metaSeed: 31001, style: 'bjj', div: 'WW', age: 24 });
    exigeIgual(h.ctx, 'recien creada');
  });

  test('las fixtures y los dos saves congelados, cargados', () => {
    const dirF = path.join(__dirname, '..', 'fixtures');
    const saves = fs.readdirSync(dirF).filter(f => /^\d\d-.*\.json$/.test(f)).map(f => path.join(dirF, f));
    saves.push(path.join(__dirname, '..', 'perf', 'congelado', 'save-referencia.json'));
    saves.push(path.join(__dirname, '..', 'perf', 'congelado-r2', 'save-r2.json'));
    ok(saves.length >= 7, 'faltan saves: ' + saves.length);
    for(const f of saves){
      const h = cargarCrudo(32, fs.readFileSync(f, 'utf8'));
      exigeIgual(h.ctx, path.basename(f));
    }
  });

  test('una carrera jugada, en las semanas 40, 80 y 120', () => {
    const h = H.boot({ seed: 33 });
    H.startCareer(h, { metaSeed: 33001, style: 'mma', div: 'LW', age: 22 });
    for(const s of [40, 80, 120]){
      A.correrCarrera(h, { maxWeeks: 40, politica: 'basica', seedPolitica: 33 + s });
      exigeIgual(h.ctx, 'semana ' + s);
    }
  });

  test('en mitad de una pelea (G.fight vivo)', () => {
    const h = cargarCrudo(34, fs.readFileSync(path.join(__dirname, '..', 'perf', 'congelado-r2', 'save-r2.json'), 'utf8'));
    const c = h.ctx;
    c.G.pending = [];
    if(!c.G.nextFight){ c.makeOffers(); const i = c.G.offers.findIndex(o => o.type === 'fight'); if(i >= 0) c.acceptFight(i); }
    ok(!!c.G.nextFight, 'no se pudo firmar una pelea');
    c.goFight();
    ok(c.G.fight && !c.G.fight.over, 'no hay pelea en curso');
    for(let i = 0; i < 4 && !c.G.fight.over; i++){ c.fightAct(c.fightOptions()[0].k); c.UI.sub = null; }
    exigeIgual(c, 'en pelea');
  });

  /* Los sitios raros: la semantica original convierte st/pot/lr EN CUALQUIER
     PARTE del arbol, no solo en los peleadores. Una implementacion que solo
     mirara G.fighters pasaria todas las pruebas de arriba y fallaria aqui.
     OJO, pagado: la primera version de esta prueba metia tambien una fecha y
     un toJSON EN EL MISMO ESTADO. Con eso el juego vuelve entero al camino del
     replacer, asi que el camino rapido no se ejercitaba y dos mutantes (no
     bajar a los arrays) pasaban verdes. Van separados. */
  test('estado adversarial: st/pot/lr en sitios raros, alias, huecos (camino rapido)', () => {
    const h = H.boot({ seed: 35 });
    H.startCareer(h, { metaSeed: 35001, style: 'kick', div: 'FEA', age: 21 });
    const c = h.ctx, G = c.G;
    const hueco = [ { st: { speed: 3.33, power: 'x' } }, null ]; hueco[3] = 5;       /* indice 2 es un hueco */
    G.flags.r2raro = { st: { power: 12.345, raro: 7 }, pot: [1, 2, 3], lr: null,
                       anidado: { lr: { accuracy: 1.26 } }, lista: hueco, vacio: {},
                       matriz: [[ { pot: { chin: 88.88 } } ]] };
    G.flags.r2alias = G.player.st;                    /* el mismo objeto, bajo otra clave: NO se convierte */
    G.flags.r2mismo = { st: G.player.st };            /* el mismo objeto, bajo st en otro contenedor */
    G.flags.r2fn = { st: function(){}, u: undefined, lr: 'texto', pot: 42 };
    G.flags.r2proto = Object.create({ heredado: { st: { power: 1 } } });   /* heredado: JSON no lo ve */
    G.flags.r2proto.propio = 1;
    exigeIgual(c, 'adversarial');
  });

  test('estado adversarial: fechas y toJSON (camino del replacer)', () => {
    const h = H.boot({ seed: 37 });
    H.startCareer(h, { metaSeed: 37001, style: 'boxer', div: 'BAN', age: 25 });
    const c = h.ctx, G = c.G;
    G.flags.r2fecha = { st: new Date(0), pot: { toJSON(){ return { lr: { power: 99.99 } }; } } };
    G.flags.r2lista = [ { st: { speed: 3.33 } } ];
    exigeIgual(c, 'toJSON');
  });

  test('si serializar falla a mitad, el estado queda como estaba', () => {
    const h = H.boot({ seed: 36 });
    H.startCareer(h, { metaSeed: 36001, style: 'wrest', div: 'MW', age: 23 });
    const c = h.ctx, G = c.G;
    G.flags.r2raro = { st: { power: 12.345 } };
    c.saveSerialize(G);        /* crea G.stKeys, que es un efecto de diseño */
    const st = G.player.st, st2 = G.flags.r2raro.st;
    G.flags.zz_big = 10n;                             /* BigInt: JSON.stringify lanza */
    const fp0 = (() => { const b = G.flags.zz_big; delete G.flags.zz_big; const f = c.STATE.fingerprint(true); G.flags.zz_big = b; return f; })();
    lanza(() => c.saveSerialize(G), 'serializar un BigInt tenia que lanzar');
    delete G.flags.zz_big;
    ok(G.player.st === st && !Array.isArray(G.player.st), 'tras el fallo, player.st no es el objeto original');
    ok(G.flags.r2raro.st === st2, 'tras el fallo, un st de otro sitio no es el objeto original');
    eq(c.STATE.fingerprint(true), fp0, 'tras el fallo, el estado cambio');
  });

});
