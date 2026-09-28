'use strict';
/* FASE 9 — CAPA DE INFORMACIÓN DEL FIGHT IQ, LEGALIDAD, INVENTARIO Y ULTIMATES
   ---------------------------------------------------------------------------
   pesos reales → modelo de información (CMB.read) → lo que ve el jugador.
   Estas pruebas no confían en la capa para comprobar la capa: los pesos se
   recalculan con el motor (CL.oppWeightsFor) o se sortea al rival con la
   cadena real de filtros, y se exige que lo mostrado salga de ahí.          */
const { suite, test, ok, eq } = require('../run-tests.js');
const H = require('../harness.js');
const fs = require('node:fs');
const path = require('node:path');

const ARCHIVO = process.env.CAGE_FILE || undefined;
const LEGAL = { stand: ['jab','combo','counter','lowkick','clinch','td','move'], clinch: ['knees','ctd','grind','break'],
                gbot: ['gnp','pass','sub','hold','up'], gtop: ['getup','guard','bsub','sweep'] };
const ARQ = ['missile','wall','marathon','showman','hunter','chess'];
const TECLAS = ['jab','combo','counter','lowkick','clinch','td','move','knees','ctd','grind','break','gnp','pass','sub','hold','up','getup','guard','bsub','sweep'];

function carrera(seed){
  const h = H.boot({ seed, file: ARCHIVO });
  H.startCareer(h, { metaSeed: 9950 + seed, style: 'mma', div: 'LW', age: 22 });
  const c = h.ctx;
  const co = c.G.offers.find(o => o.type === 'contract' && c.G.orgs[o.org]);
  c.negoStart(co); c.negoClose(); c.G.mg = null; c.UI.screen = 'hub'; c.G.pending = [];
  return c;
}
function rival(c){
  const p = c.G.player;
  return Object.values(c.G.fighters).find(f => f && !f.isPlayer && f.div === p.div && !c.fightSpecProblem({ oppId: f.id, org: p.org }));
}
function aLaJaula(c){
  const o = rival(c);
  ok(c.scheduleFight({ oppId: o.id, org: c.G.player.org, weeks: 8, title: false, purse: 5000, event: 'T' }, 'prueba').ok, 'no se firmó');
  ok(c.startCamp(c.G.nextFight), 'no arrancó el camp');
  c.G.camp.i = c.G.camp.weeks; c.goFight(); c.UI.sub = null;
  return o;
}
function muestrear(c, n){
  const cnt = {};
  for(let i = 0; i < n; i++){ const a = c.hookFilter('combat:oppPick', 'jab', { base: 'jab' }); cnt[a] = (cnt[a] || 0) + 1; }
  if(c.G.fight && c.G.fight.iq) c.G.fight.iq._b = null;
  for(const k in cnt) cnt[k] /= n;
  return cnt;
}
/* la especificación de la prominencia, escrita aparte de la capa */
function bandaSpec(d, pos){
  const r = Object.entries(d).sort((a, b) => b[1] - a[1]);
  const ratio = r[0][1] * LEGAL[pos].length, marg = r[1] ? r[0][1] / r[1][1] : 9;
  return (ratio >= 2.2 && marg >= 1.5) ? 'marcada' : (ratio >= 1.6 && marg >= 1.2) ? 'clara' : (ratio >= 1.2 && marg >= 1.05) ? 'leve' : 'ninguna';
}
/* todas las superficies de la lectura en una situación, como texto plano */
function superficies(c){
  const out = [];
  const panel = (c.CMB.panel() || '').replace(/<[^>]+>/g, ' ');
  out.push(['panel', panel]);
  c.fightOptions().filter(o => o.k === 'iq_x').forEach(o => out.push(['anticipar', o.t + ' ' + o.d]));
  return out;
}
/* lo único numérico permitido: conteos de lo que el jugador VIO o hizo */
const sinConteos = (t) => t.replace(/Así lo viste esta noche:[^.]*\./g, '').replace(/\d+ (vez|veces)/g, '').replace(/de antes: \d+/g, '');

suite('RPG-9 · la capa de información no expone el motor', () => {
  test('en ninguna situación el panel ni «Anticipar» muestran porcentajes, pesos o números internos', () => {
    const c = carrera(1); aLaJaula(c);
    const f = c.G.fight; let vistas = 0;
    for(const pos of ['stand','clinch','gbot','gtop']) for(const arq of ARQ) for(const [rd, iq] of [[0,50],[40,60],[70,75],[100,95]]) for(const ost of [90, 20]){
      f.pos = pos; f.identity.archetype = arq; f.cl.read = rd; c.G.player.st.fightiq = iq; f.o.stam = ost;
      f.identity.adaptation = 80; f.identity.playerPatterns = { jab: 2, combo: 3 }; f._lastPlayerAction = 'combo';
      const d = c.CMB.dist(), prohib = Object.values(d).map(p => Math.round(p * 100)).filter(v => v >= 10);
      for(const [q, t] of superficies(c)){
        vistas++;
        const limpio = sinConteos(t);
        ok(!/\d/.test(limpio), q + ' muestra un número interno (' + pos + '/' + arq + '): ' + limpio.trim().slice(0, 160));
        ok(!/%|de cada 100/.test(t), q + ' muestra un porcentaje: ' + t.slice(0, 160));
        prohib.forEach(v => ok(!new RegExp('\\b' + v + '\\b').test(limpio), q + ' deja ver ' + v + ' (una probabilidad real)'));
      }
      ok(!/width:/.test(c.CMB.panel() || ''), 'el panel dibuja barras con el valor real');
    }
    ok(vistas >= 192, 'no se recorrieron las situaciones: ' + vistas);
  });
  test('scouting (analista, sala de video, memoria) y sparring tampoco', () => {
    const c = carrera(2); const o = rival(c);
    const textos = [];
    for(const fl of [{ analyst: 1 }, { videoWall: 1 }]){
      c.G.flags.analyst = fl.analyst; c.G.flags.videoWall = fl.videoWall;
      c.scoutReport(o).forEach(t => textos.push(t));
    }
    c.G.rpg.fm[o.id] = { n: 3, res: 'W', obs: { stand: { td: 7, jab: 2, move: 1 }, gbot: { gnp: 2, pass: 1 } }, pp: { jab: 12 }, ex: {}, tq: {}, ult: {} };
    c.CMB.knowLines(o).forEach(t => textos.push(t));
    ok(c.scheduleFight({ oppId: o.id, org: c.G.player.org, weeks: 8, title: false, purse: 5000, event: 'T' }, 'p').ok, 'no se firmó');
    c.startCamp(c.G.nextFight); c.G.pending = [];
    c.campWeek('spar', .9, 0);
    const ev = c.G.pending.find(e => e.h === 'camp_spar');
    ok(ev, 'la prueba necesita que el sparring muestre algo de este rival');
    textos.push(ev.txt.replace(c.fname(o), 'X')); c.resolveEvent(0); c.scoutReport(o).forEach(t => textos.push(t));
    ok(textos.some(t => t.indexOf('Sparring: ') === 0), 'el informe no trae la línea del sparring');
    ok(textos.length >= 6, 'no se juntaron textos de las superficies');
    textos.forEach(t => {
      ok(!/%|de cada 100/.test(t), 'porcentaje visible: ' + t);
      ok(!/\d/.test(sinConteos(t).replace(/Ya lo peleaste \d+/, '')), 'número interno visible: ' + t);
    });
  });
});

suite('RPG-9 · lo que se lee sale de la decisión real', () => {
  test('cuando se percibe una tendencia clara o marcada, es la que el rival más elige al sortearlo', () => {
    const c = carrera(3); aLaJaula(c);
    const f = c.G.fight; let comprobadas = 0;
    c.G.player.st.fightiq = 95; f.cl.read = 100;
    for(const pos of ['stand','clinch','gbot','gtop']) for(const arq of ARQ) for(const ost of [90, 20]){
      f.pos = pos; f.identity.archetype = arq; f.o.stam = ost; f.round = 2; f.identity.playerPatterns = {}; f._lastPlayerAction = null;
      const obs = c.CMB.read('vivo');
      if(!obs.top || (obs.band !== 'clara' && obs.band !== 'marcada')) continue;
      const emp = muestrear(c, 4000), top = Object.entries(emp).sort((a, b) => b[1] - a[1])[0][0];
      eq(obs.top, top, 'lo leído (' + obs.top + ') no es lo que el rival más elige (' + top + ') en ' + pos + '/' + arq);
      eq(obs.band, bandaSpec(c.CMB.dist(), pos), 'la banda no es la de la especificación');
      comprobadas++;
    }
    ok(comprobadas >= 6, 'muy pocas situaciones con tendencia perceptible: ' + comprobadas);
  });
  test('la prominencia depende del contexto: el mismo 30 % no dice lo mismo de pie que en el clinch', () => {
    const c = carrera(4);
    const de = (top, pos) => { const r = {}; const L = LEGAL[pos]; L.forEach(a => { r[a] = (1 - top) / (L.length - 1); }); r[L[0]] = top; return r; };
    eq(c.CMB.prom(de(0.30, 'stand'), 'stand').band, 'clara', 'un 30 % de pie (7 opciones) no es una tendencia clara');
    eq(c.CMB.prom(de(0.30, 'clinch'), 'clinch').band, 'leve', 'un 30 % en el clinch (4 opciones) no es apenas una inclinación');
    eq(c.CMB.prom(de(0.26, 'clinch'), 'clinch').band, 'ninguna', 'un 26 % en el clinch no es parejo');
    eq(c.CMB.prom(de(0.45, 'stand'), 'stand').band, 'marcada', 'un 45 % de pie no es marcado');
    eq(c.CMB.prom(de(0.34, 'gtop'), 'gtop').band, 'leve', 'un 34 % abajo (4 opciones) no es leve');
    const casi = { jab: 0.30, combo: 0.28, counter: 0.1, lowkick: 0.1, clinch: 0.1, td: 0.06, move: 0.06 };
    ok(c.CMB.prom(casi, 'stand').band !== 'clara', 'con la segunda pegada a la primera no puede ser «clara»');
  });
  test('cada contraste es una diferencia real entre las dos situaciones, en la dirección que dice', () => {
    const c = carrera(5); aLaJaula(c);
    const f = c.G.fight, o = c.F(f.opp); let vistos = 0;
    c.G.player.st.fightiq = 95; f.cl.read = 100;
    for(const pos of ['stand','clinch','gbot']) for(const arq of ARQ) for(const [ost, hp] of [[90, 90], [20, 90], [90, 30]]) for(const round of [1, 2, 3]){
      f.pos = pos; f.identity.archetype = arq; f.o.stam = ost; f.o.hp = hp; f.round = round;
      const x = c.CMB.sitNow(), d0 = c.CMB.distFor(o, x);
      for(const k of c.CMB.contrasts(o, x, d0, 5)){
        const F = c.CMB.FACT.find(q => q.k === k.k); ok(F, 'contraste sin factor: ' + k.k);
        const d1 = c.CMB.distFor(o, F.flip(x)), dl = (d1[k.a] || 0) - (d0[k.a] || 0);
        /* especificación fija: 7 puntos de las elecciones y 40 % relativo */
        const ra = ((d1[k.a] || 0) + 0.01) / ((d0[k.a] || 0) + 0.01);
        ok(Math.abs(dl) >= 0.07 && (ra >= 1.4 || ra <= 1 / 1.4), 'contraste sin diferencia real: ' + k.k + '/' + k.a + ' Δ=' + dl.toFixed(3));
        eq(dl > 0, k.up, 'el contraste dice la dirección al revés: ' + k.k + '/' + k.a);
        vistos++;
      }
    }
    f.o.hp = 90;
    ok(vistos >= 20, 'casi no hubo contrastes: ' + vistos);
  });
  test('«sin aire se mueve más» se comprueba sorteando al rival de verdad', () => {
    const c = carrera(6); aLaJaula(c);
    const f = c.G.fight; f.pos = 'stand'; f.identity.archetype = 'hunter'; f.round = 2;
    c.G.player.st.fightiq = 95; f.cl.read = 100; f.o.stam = 90;
    const x = c.CMB.sitNow(), k = c.CMB.contrasts(c.F(f.opp), x, c.CMB.distFor(c.F(f.opp), x), 9).find(q => q.k === 'aire');
    ok(k, 'no hay contraste de aire para este rival');
    const antes = muestrear(c, 5000)[k.a] || 0;
    f.o.stam = 20;
    const despues = muestrear(c, 5000)[k.a] || 0;
    ok(k.up ? despues > antes + 0.05 : despues < antes - 0.05, 'sorteando, ' + k.a + ' no ' + (k.up ? 'sube' : 'baja') + ' sin aire: ' + antes.toFixed(3) + ' → ' + despues.toFixed(3));
  });
});

suite('RPG-9 · el sparring muestra lo más perceptible del rival', () => {
  test('en cada rival, el sparring elige la situación con la tendencia más marcada (calculada aparte)', () => {
    const c = carrera(21);
    const p = c.G.player, rivales = Object.values(c.G.fighters).filter(f => f && !f.isPlayer && f.div === p.div && f.active).slice(0, 40);
    const SITS = [['stand', { pos: 'stand', gap: 0 }], ['stand:c', { pos: 'stand', gap: 0, tired: true }],
                  ['stand:e', { pos: 'stand', gap: 0.6 }], ['gbot', { pos: 'gbot', gap: 0 }]];
    const RANGO = { marcada: 3, clara: 2 };
    let comparados = 0, conOpciones = 0;
    for(const o of rivales){
      if(c.G.story && c.G.story.npcSeeds && c.G.story.npcSeeds[o.id]) continue;   /* sin arquetipo: pesos puros */
      const B = c.CL.styleAt(o); let best = null, perceptibles = new Set();
      for(const [b, x] of SITS){
        const w = c.CL.oppWeightsFor(o, Object.assign({ B, hurt: false, winning: false, tired: false, pHp: 100, pStam: 100, last: false }, x));
        const t = w.reduce((a, e) => a + e[1], 0), d = {}; w.forEach(e => { d[e[0]] = e[1] / t; });
        const band = bandaSpec(d, x.pos);
        if(!RANGO[band]) continue;
        perceptibles.add(band);
        if(!best || RANGO[band] > RANGO[best.band]) best = { b, band };
      }
      const t = c.CAMPO.tell(o);
      if(!best){ eq(t, null, 'el sparring muestra algo que no se percibe'); continue; }
      eq(t && [t.b, t.band], [best.b, best.band], 'el sparring no eligió lo más perceptible de ' + o.id);
      comparados++; if(perceptibles.size >= 2) conOpciones++;
    }
    ok(comparados >= 5 && conOpciones >= 1, 'la prueba necesita rivales con varias situaciones perceptibles: ' + comparados + '/' + conOpciones);
  });
});

suite('RPG-9 · incertidumbre: cuánto se entiende depende de la información', () => {
  test('el mismo rival se entiende distinto en vivo, con analista, con sala de video, en el sparring y por memoria', () => {
    const c = carrera(7); const o = rival(c);
    c.G.player.st.fightiq = 60;
    const sit = { pos: 'stand', gap: 0, tired: true };
    c.G.flags.analyst = 1; c.G.flags.videoWall = 0; eq(c.CMB.read('video', { o, sit }).conf, 2, 'el analista no da confianza media');
    c.G.flags.videoWall = 1; eq(c.CMB.read('video', { o, sit }).conf, 3, 'la sala de video no da confianza alta');
    eq(c.CMB.read('sparring', { o, sit }).conf, 2, 'anotado en el sparring no es confianza media');
    eq(c.CMB.read('sparring', { o, sit, drill: true }).conf, 3, 'trabajado en el sparring no es confianza alta');
    eq([2, 5, 9].map(n => c.CMB.read('memoria', { o, b: 'stand', counts: { td: n } }).conf), [1, 2, 3], 'la memoria no escala con lo visto');
    c.G.player.st.fightiq = 85;
    eq(c.CMB.read('memoria', { o, b: 'stand', counts: { td: 2 } }).conf, 2, 'la experiencia (fight IQ) no ayuda a entender lo visto');
    aLaJaula(c); c.G.fight.cl.read = 0; c.G.player.st.fightiq = 50;
    eq(c.CMB.read('vivo').conf, 0, 'sin lectura en vivo hay confianza');
  });
  test('con poca confianza sólo se percibe lo marcado; con mucha, también lo leve', () => {
    const c = carrera(8); aLaJaula(c);
    const f = c.G.fight; let clara = null;
    for(const pos of ['stand','clinch','gbot','gtop']) for(const arq of ARQ) for(const ost of [90, 20]){
      f.pos = pos; f.identity.archetype = arq; f.o.stam = ost;
      const b = bandaSpec(c.CMB.dist(), pos); if(b === 'clara' || b === 'leve'){ clara = { pos, arq, ost, b }; break; }
    }
    ok(clara, 'no hubo ninguna situación con tendencia clara o leve');
    f.pos = clara.pos; f.identity.archetype = clara.arq; f.o.stam = clara.ost;
    const conf = (rd, iq) => { f.cl.read = rd; c.G.player.st.fightiq = iq; return c.CMB.read('vivo'); };
    const baja = conf(50, 55), alta = conf(100, 95);
    eq(baja.conf, 1, 'la prueba necesita confianza baja'); eq(alta.conf, 3, 'la prueba necesita confianza alta');
    eq(baja.top, null, 'con confianza baja se percibe una tendencia ' + clara.b);
    ok(alta.top, 'con confianza alta no se percibe una tendencia ' + clara.b);
    ok(c.CMB.sayHead(baja) !== c.CMB.sayHead(alta), 'las dos lecturas dicen lo mismo');
  });
  test('leer bien no es adivinar: el rival elige otra cosa una parte real de las veces', () => {
    const c = carrera(9); aLaJaula(c);
    const f = c.G.fight; c.G.player.st.fightiq = 95; f.cl.read = 100;
    let visto = 0;
    for(const pos of ['stand','clinch','gbot','gtop']) for(const arq of ARQ){
      f.pos = pos; f.identity.archetype = arq;
      const obs = c.CMB.read('vivo'); if(!obs.top) continue;
      const emp = muestrear(c, 3000);
      ok((emp[obs.top] || 0) < 0.9, 'la lectura se volvió certeza en ' + pos + '/' + arq);
      visto++;
    }
    ok(visto > 5, 'no hubo lecturas con tendencia');
  });
});

suite('RPG-9 · la capa no toca la IA del rival', () => {
  test('leer, dibujar el panel y el scouting no mueven el RNG ni escriben estado', () => {
    const c = carrera(10); const o = aLaJaula(c);
    const f = c.G.fight; c.G.player.st.fightiq = 95; f.cl.read = 100; c.G.flags.videoWall = 1;
    c.TQ.fs(); c.CL.fightCtx();
    const rs = c.G.rs, antes = JSON.stringify(c.G);
    for(let i = 0; i < 5; i++){ c.CMB.read('vivo'); c.CMB.panel(); c.fightOptions(); c.scoutReport(o); c.CMB.knowLines(o); c.CAMPO.tell(o); }
    eq(c.G.rs, rs, 'la capa movió el RNG'); eq(JSON.stringify(c.G), antes, 'la capa escribió estado');
  });
  test('la distribución de la capa es la misma composición que decide (CL.oppRules en vivo = CL.oppRulesFor)', () => {
    const c = carrera(11); aLaJaula(c);
    const f = c.G.fight;
    for(const pos of ['stand','clinch','gbot','gtop']) for(const arq of ARQ) for(const round of [1, 2, 3]) for(const key of [null, 'jab', 'gnp']){
      f.pos = pos; f.identity.archetype = arq; f.round = round; f.identity.adaptation = 80;
      f.identity.playerPatterns = key ? { [key]: 4 } : {}; f._lastPlayerAction = key;
      eq(JSON.stringify(c.CL.oppRules()), JSON.stringify(c.CL.oppRulesFor(c.CL.oppRuleSit())), 'la regla en vivo y la consultable difieren');
    }
  });
});

suite('RPG-9 · la legalidad del rival no depende del Fight IQ', () => {
  function barrido(c){
    const f = c.G.fight; let malas = 0, n = 0;
    for(const pos of Object.keys(LEGAL)) for(const arq of ARQ) for(const round of [1, 2, 3]) for(const ost of [100, 20]) for(const key of [null].concat(TECLAS)){
      f.pos = pos; f.round = round; f.o.stam = ost; f.identity.archetype = arq; f.identity.adaptation = key ? 90 : 40;
      f.identity.playerPatterns = key ? { [key]: 5 } : {}; f._lastPlayerAction = key;
      for(let i = 0; i < 15; i++){ n++; const a = c.hookFilter('combat:oppPick', 'jab', { base: 'jab' }); if(LEGAL[pos].indexOf(a) < 0) malas++; }
    }
    return { malas, n };
  }
  test('sin ninguna pieza de la lectura enganchada, el rival sólo elige acciones posibles', () => {
    const c = carrera(12); aLaJaula(c);
    [['combat:oppPick','lectura'], ['combat:oppPick','memoriaRival'], ['combat:oppPick:after','lectura'], ['fight:options','lectura'],
     ['act:translate','lectura'], ['combat:eff','lectura'], ['fight:start','lectura'], ['fight:start','campo'], ['screen:fight','lectura']]
      .forEach(([e, id]) => ok(c.hookOff(e, id), 'no se pudo desenganchar ' + e + '/' + id));
    const r = barrido(c);
    eq(r.malas, 0, 'sin Fight IQ, el rival eligió ' + r.malas + ' acciones imposibles de ' + r.n);
  });
  test('y con la lectura enganchada (incluida la memoria de revancha), tampoco', () => {
    const c = carrera(13); aLaJaula(c);
    const f = c.G.fight; f.iq.sup = { stand: 'jab', clinch: 'knees', gbot: 'gnp', gtop: 'getup', 'stand:c': 'move' };
    const r = barrido(c);
    eq(r.malas, 0, 'con Fight IQ, el rival eligió ' + r.malas + ' acciones imposibles de ' + r.n);
  });
  test('las reglas y la distribución que lee el Fight IQ sólo contienen acciones posibles', () => {
    const c = carrera(14); aLaJaula(c);
    const o = c.F(c.G.fight.opp);
    for(const pos of Object.keys(LEGAL)) for(const arq of ARQ) for(const round of [1, 3]) for(const key of [null].concat(TECLAS)){
      const x = c.CMB.sitFor(o, { pos, round, arche: arq, adaptation: 90, key, keyN: key ? 5 : 0 });
      c.CL.oppRulesFor(x).forEach(r => (r.to || []).forEach(a => ok(LEGAL[pos].indexOf(a) >= 0, 'regla ' + r.k + ' propone ' + a + ' en ' + pos)));
      Object.keys(c.CMB.distFor(o, x)).forEach(a => ok(LEGAL[pos].indexOf(a) >= 0, 'la lectura considera ' + a + ' en ' + pos));
    }
  });
});

suite('RPG-9 · inventario del árbol y Ultimates', () => {
  test('el inventario escrito coincide con el árbol del juego', () => {
    const c = carrera(15);
    const gen = require('../tq-inventario.js');
    const archivo = ARCHIVO || path.join(__dirname, '..', '..', 'index-4-blindado.html');
    const md = gen.generar(c, fs.readFileSync(archivo, 'utf8'));
    ok(fs.existsSync(gen.OUT), 'falta dev/TQ-INVENTARIO.md');
    eq(fs.readFileSync(gen.OUT, 'utf8'), md, 'dev/TQ-INVENTARIO.md quedó viejo: correr node dev/tq-inventario.js');
    c.TQ.T.forEach(t => ok(md.indexOf('#### `' + t.id + '`') >= 0, 'la técnica ' + t.id + ' no está en el inventario'));
    eq(c.TQ.T.filter(t => t.lv === 4).map(t => t.id).sort(), Object.keys(c.CMB.ULT).sort(), 'las Ultimates no son exactamente las L4');
  });
  test('cada Ultimate es su L4: mismo id, rama, nivel, posiciones, condiciones y usos', () => {
    const c = carrera(16);
    for(const id of Object.keys(c.CMB.ULT)){
      c.G.rpg.ult[id] = { v: 'pura' };
      const b = c.TQ.node(id), u = c.CMB.ultNode(b);
      eq([u.id, u.br, u.lv, JSON.stringify(u.pos), JSON.stringify(u.cond), u.uses, u.stam, u.mg, u.diff],
         [b.id, b.br, b.lv, JSON.stringify(b.pos), JSON.stringify(b.cond), b.uses, b.stam, 'clutch', 4], 'la Ultimate de ' + id + ' no es la misma técnica');
      ok(u.ult && u.fx !== b.fx, 'la Ultimate de ' + id + ' no tiene su forma');
    }
  });
  test('no se activa sin haber despertado, fuera de posición, en la esquina, ni dos veces', () => {
    const c = carrera(17); aLaJaula(c);
    c.TQ.S().un.s_perf = 1;
    const f = c.G.fight; f.pos = 'stand'; f.cl.dist = 1.5; f.p.stam = 100;
    ok(!c.CMB.ultState('s_perf').ok && !c.CMB.ultUse('s_perf'), 'se usa sin haber despertado');
    c.G.rpg.ult.s_perf = { v: 'pura', used: 0, landed: 0 };
    f.pos = 'clinch'; ok(!c.CMB.ultState('s_perf').ok, 'se ofrece fuera de su posición');
    f.pos = 'stand'; f.cl.dist = 0.5; ok(!c.CMB.ultState('s_perf').ok, 'se ofrece sin la distancia que pide la técnica');
    f.cl.dist = 1.5; c.UI.sub = 'corner';
    const u0 = (f.tq.u && f.tq.u.s_perf) || 0;
    eq(c.CMB.ultUse('s_perf'), false, 'en la esquina dice que se lanzó');
    eq((f.tq.u && f.tq.u.s_perf) || 0, u0, 'en la esquina gastó el uso');
    c.UI.sub = null;
    ok(c.CMB.ultUse('s_perf'), 'con todo en regla no se lanza');
    if(c.FX.S){ c.fxEnd(c.FX.S, 0.6); c.fxFinish(); }
    ok(!c.CMB.ultState('s_perf').ok && !c.CMB.ultUse('s_perf'), 'se usa dos veces en la misma pelea');
  });
  test('usar la L4 normal primero deja sin Ultimate esa noche (comparten el único uso)', () => {
    const c = carrera(18); aLaJaula(c);
    c.TQ.S().un.w_sup = 1; c.G.rpg.ult.w_sup = { v: 'pura' };
    const f = c.G.fight; f.pos = 'clinch'; f.p.stam = 100;
    ok(c.CMB.ultState('w_sup').ok, 'la Ultimate no está disponible al empezar');
    c.TQ.use('w_sup'); if(c.FX.S){ c.fxEnd(c.FX.S, 0.6); c.fxFinish(); }
    ok(!c.CMB.ultState('w_sup').ok, 'después de gastar la L4 la Ultimate sigue disponible');
  });
  test('los efectos son los del motor: el Suplex de la Tierra, aplicado BUENO, derriba y deja arriba', () => {
    const c = carrera(19); aLaJaula(c);
    c.G.rpg.ult.w_sup = { v: 'desgaste' };
    const f = c.G.fight; f.pos = 'clinch';
    const u = c.CMB.ultNode(c.TQ.node('w_sup'));
    eq(u.fx.drainO, (c.CMB.ULT.w_sup.fx.drainO || 0) + 10, 'el sello Desgaste no agrega desgaste');
    const td0 = f.p.td, ohp = f.o.hp;
    c.TQ.apply(u, 'good', 0.7);
    if(!f.over){ eq(f.pos, 'gtop', 'no quedó arriba'); eq(f.p.td, td0 + 1, 'no contó el derribo'); ok(f.o.hp < ohp, 'no hizo daño'); }
    c.G.rpg.ult.s_perf = { v: 'espectaculo' };
    eq(c.CMB.ultNode(c.TQ.node('s_perf')).fx.finish, Math.min(0.8, c.CMB.ULT.s_perf.fx.finish + 0.08), 'el sello Espectáculo no sube la finalización');
  });
  test('despertar y lo usado sobreviven a guardar y cargar', () => {
    const c = carrera(20);
    c.G.rpg.ult.g_def = { v: 'precision', y: 2017, w: 3, used: 2, landed: 1 };
    c.G.rpg.mast.g_def = { n: 9, p: 2, g: 4, f: 3, w: 1, x: 3 };
    const antes = JSON.stringify({ u: c.G.rpg.ult, m: c.G.rpg.mast });
    c.saveGame(true); ok(c.loadGame(c.listSaves()[0].id), 'no cargó');
    eq(JSON.stringify({ u: c.G.rpg.ult, m: c.G.rpg.mast }), antes, 'la Ultimate o su maestría no vuelven iguales del guardado');
  });
});
