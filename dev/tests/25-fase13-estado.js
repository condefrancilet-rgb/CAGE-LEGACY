'use strict';
/* FASE 13 — ESTADOS, CONSUMIDORES Y SISTEMAS DE CARRERA
   ---------------------------------------------------------------------------
   Tres garantías que no dependen de un sistema en particular:
     · cada clave de G tiene una clase de persistencia y un porqué, y cada hoja
       guardada que nadie lee está declarada (dev/estado-inventario.js, contra
       el análisis sintáctico de dev/estado-mapa.js), en las dos direcciones;
     · lo que está en pantalla cuando se guarda —un evento, una pelea— sigue
       igual después de recargar la página (un arranque NUEVO, no el mismo);
     · una carrera nueva en la misma sesión es la misma que en un arranque
       limpio con el mismo disco.
   Y las cadenas completas de la fase: cada una atraviesa un guardado y una
   recarga en el medio, porque ahí es donde se rompían.                      */
const { suite, test, ok, eq } = require('../run-tests.js');
const H = require('../harness.js');
const A = require('../autopilot.js');
const INV = require('../invariants.js');
const MAPA = require('../estado-mapa.js');
const DECL = require('../estado-inventario.js');

const ARCHIVO = process.env.CAGE_FILE || undefined;

/* ---------- una carrera con organización y peleas, guardada una vez ---------- */
let BASE = null;
function base(){
  if(BASE) return BASE;
  const h = H.boot({ seed: 1313, file: ARCHIVO });
  H.startCareer(h, { metaSeed: 131301, style: 'mma', div: 'LW', age: 23 });
  const c = h.ctx;
  for(let i = 0; i < 40 && !(c.G.player.org && c.G.player.rec.w + c.G.player.rec.l >= 6); i++)
    A.correrCarrera(h, { maxWeeks: 4, politica: 'basica', seedPolitica: 13 + i });
  ok(c.G.player.org && c.G.player.rec.w + c.G.player.rec.l >= 6, 'la carrera base no llegó a una organización con 6 peleas');
  c.G.pending.length = 0; c.G.mg = null;
  c.saveGame(true);
  BASE = { sid: c.listSaves()[0].id, disco: new Map(c.localStorage.__map) };
  return BASE;
}
/* abre la carrera base en un arranque nuevo (la página recién cargada) */
function abrir(b, seed){
  b = b || base();
  const h = H.boot({ seed: seed || 1313, file: ARCHIVO, storage: new Map(b.disco) });
  ok(h.ctx.loadGame(b.sid), 'no se pudo cargar la carrera base');
  return h;
}
/* guardar, cerrar la página y volver a abrirla */
function recargar(h){
  const c = h.ctx; c.saveGame(true);
  const sid = c.listSaves()[0].id;
  const x = H.boot({ seed: 1313, file: ARCHIVO, storage: new Map(c.localStorage.__map) });
  ok(x.ctx.loadGame(sid), 'no se pudo recargar');
  return x;
}
/* lo último que quedó en el disco, tal cual (sin guardar de nuevo) */
function reabrir(h){
  const c = h.ctx, sid = c.G.saveId;
  const x = H.boot({ seed: 1313, file: ARCHIVO, storage: new Map(c.localStorage.__map) });
  ok(x.ctx.loadGame(sid), 'no se pudo reabrir');
  return x;
}
function estado(c){ const o = JSON.parse(JSON.stringify(c.STATE.persistable(c.G))); delete o.saveId; delete o.savedAt; return o; }
function difiere(a, b, p, out){
  out = out || []; if(out.length > 4 || JSON.stringify(a) === JSON.stringify(b)) return out;
  if(a && b && typeof a === 'object' && typeof b === 'object'){ for(const k of new Set([...Object.keys(a), ...Object.keys(b)])) difiere(a[k], b[k], p + '.' + k, out); }
  else out.push(p + ': ' + String(JSON.stringify(a)).slice(0, 50) + ' ≠ ' + String(JSON.stringify(b)).slice(0, 50));
  return out;
}
function alCampLleno(h){
  const c = h.ctx;
  for(let i = 0; i < 60 && !(c.G.camp && c.G.nextFight && c.G.camp.i >= c.G.camp.weeks); i++)
    A.correrCarrera(h, { maxWeeks: 1, politica: 'basica', seedPolitica: 70 + i });
  while(c.G.pending.length) c.resolveEvent(0);
  ok(c.G.camp && c.G.nextFight, 'no se llegó a un campamento completo');
}
function terminaPelea(c){
  let g = 0;
  while(c.G.fight && !c.G.fight.over && g++ < 500){ const ops = c.fightOptions(); if(!ops || !ops.length){ c.finishFight('dec', null); break; } c.fightAct(ops[0].k); }
  return c.G.fight && c.G.fight.result ? c.G.fight.result.winner + '/' + c.G.fight.result.method + '/' + c.G.fight.round : null;
}
/* hace campeón al jugador por la vía del juego: pelea por el título firmada y ganada */
function ganaTitulo(c){
  const p = c.G.player, org = p.org;
  let champ = c.G.champs[org] && c.G.champs[org][p.div];
  if(!champ || champ === p.id || c.fightSpecProblem({ oppId: champ, org, title: true })){
    const o = Object.values(c.G.fighters).find(f => f && !f.isPlayer && f.org === org && f.div === p.div && f.active && !f.retired && !f.inj && c.proFightCount(f) >= 5);
    ok(o, 'no hay un rival elegible para el título');
    c.G.champs[org][p.div] = o.id; c.recalcRank(org, p.div); champ = o.id;
  }
  c.cancelScheduledFight && c.cancelScheduledFight('prueba');
  p.inj = null; p.injWeeks = 0; c.G.camp = null;
  const r = c.scheduleFight({ oppId: champ, org, title: true, weeks: 1 }, 'prueba');
  ok(r && r.ok !== false && c.G.nextFight && c.G.nextFight.title, 'no se pudo firmar la pelea por el título: ' + JSON.stringify(r));
  c.goFight(); ok(c.G.fight && c.G.fight.title, 'la pelea por el título no empezó');
  c.finishFight('ko', 'p'); c.confirmFight(); c.go('hub');
  eq(c.G.champs[org][p.div], p.id, 'ganar la pelea por el título no dio el cinturón');
}

/* ================================================================== */
suite('ESTADO-13 · cada estado sabe por qué existe', () => {
  let M = null;
  const mapa = () => M || (M = MAPA.mapa({ file: ARCHIVO, semanas: 160 }));

  test('cada clave de G está declarada con su clase y su porqué; la lista de sesión es STATE.RUNTIME_KEYS', () => {
    const m = mapa(), c = m.h.ctx;
    const vistas = new Set(Object.keys(c.G));
    const sinDeclarar = [...vistas].filter(k => !DECL.ESTADO[k]);
    eq(sinDeclarar, [], 'claves de G sin declarar en dev/estado-inventario.js');
    eq(c.STATE.RUNTIME_KEYS.slice().sort(), DECL.sesion().sort(), 'la lista de sesión declarada no es STATE.RUNTIME_KEYS');
    const persistidas = Object.keys(c.STATE.persistable(c.G));
    const sesionEnDisco = persistidas.filter(k => DECL.ESTADO[k] && DECL.ESTADO[k].clase === 'sesion');
    eq(sesionEnDisco, [], 'claves de sesión que van al disco');
    ok(persistidas.indexOf('tmpOpp') >= 0 || c.G.tmpOpp === undefined, 'tmpOpp existe pero no va al disco');
  });

  test('ninguna hoja guardada sin lector que no esté declarada, y ninguna declarada que ya tenga lector', () => {
    const m = mapa();
    const nuevas = m.sinLector.filter(x => !DECL.huerfana(x.ruta)).map(x => x.ruta + ' (escribe ' + x.escritores.join(', ') + ')');
    eq(nuevas, [], 'estado guardado que nadie lee: declararlo en HUERFANAS con su decisión, o conectarlo');
    const vistas = new Set(m.sinLector.map(x => DECL.huerfana(x.ruta)).filter(Boolean).map(h => h.ruta));
    const conectadas = DECL.HUERFANAS.map(h => h.ruta).filter(r => !vistas.has(r));
    eq(conectadas, [], 'estas ya tienen lector (o no aparecen en la carrera de muestra): sacarlas de HUERFANAS');
  });

  test('en una carrera larga, guardar y cargar en un arranque nuevo no cambia nada (el feed y las cadenas incluidos)', () => {
    const h = mapa().h, c = h.ctx;
    ok((c.G.story.feed || []).length >= 55, 'la carrera de muestra no llenó el feed: el caso no aplica (' + (c.G.story.feed || []).length + ')');
    const antes = estado(c), x = recargar(h).ctx;
    eq(difiere(antes, estado(x), 'G'), [], 'lo cargado no es lo guardado');
  });

  test('las huérfanas a mano siguen siéndolo: las marcas y alternativas muertas de la fase', () => {
    const I = mapa().I, L = (n) => MAPA.lectores(I, n);
    eq([...L('interest').juego, ...L('interest').interfaz], [], 'rel.interest ya tiene lector');
    eq([...L('twoDiv').escritores], [], 'G.flags.twoDiv se vuelve a escribir');
    eq([...L('nextFightPaid').escritores], [], 'G.nextFightPaid ahora tiene escritor: actualizar HUERFANAS_FUERA_DEL_MAPA');
    eq([...L('_clLastPlayerAction').escritores], [], 'f._clLastPlayerAction ahora tiene escritor');
    eq([...L('bestStreak').escritores], [], 'p.bestStreak ahora tiene escritor: el legado ya puede leerlo (actualizar HUERFANAS_FUERA_DEL_MAPA)');
  });
});

/* ================================================================== */
suite('ESTADO-13 · lo que está en pantalla sobrevive a recargar la página', () => {
  test('evento pendiente: guardar y recargar no cambia ninguna opción de los eventos que dejan algo en G.tmp*', () => {
    const b = base(), c0 = abrir(b).ctx;
    const ids = c0.EVENTS.filter(e => /G\.tmp[A-Z]/.test(String(e.x)) && (e.o || []).length).map(e => e.id);
    ok(ids.length >= 12, 'se esperaban al menos 12 eventos con temporales, hay ' + ids.length);
    const malos = []; let casos = 0;
    for(const id of ids){
      const n = (c0.EVENTS.find(e => e.id === id).o || []).length;
      for(let i = 0; i < n; i++){
        const a = abrir(b), c = a.ctx, ev = c.EVENTS.find(e => e.id === id);
        let txt; try { txt = ev.x(); } catch(e){ break; }            /* el evento no aplica en esta carrera */
        c.G.pending.push({ id: ev.id, txt, opts: ev.o, important: ev.important });
        const r = recargar(a);
        eq(r.ctx.G.pending.length, 1, id + ': el evento pendiente no sobrevivió a la recarga');
        c.resolveEvent(i); r.ctx.resolveEvent(i); casos++;
        const d = difiere(estado(c), estado(r.ctx), 'G');
        if(d.length) malos.push(id + ' #' + i + ' «' + ev.o[i].t + '»: ' + d.slice(0, 2).join(' | '));
      }
    }
    ok(casos >= 25, 'muy pocos casos ejercitados: ' + casos);
    eq(malos, [], 'resolver después de recargar no da lo mismo');
  });

  test('pelea guardada viva (un «Buscar KO» que no termina): al cargar se retoma y termina igual que sin recargar', () => {
    /* se busca un intento que NO termine la pelea (depende del azar de la pelea) */
    let h = null, c = null, vivas = 0;
    for(const [kind, pre, q] of [['sub', 3, 0.1], ['ko', 8, 0.1], ['sub', 0, 0.3], ['ko', 0, 0.2], ['sub', 6, 0.5], ['ko', 4, 0.05]]){
      h = abrir(); c = h.ctx; alCampLleno(h); c.goFight();
      for(let i = 0; i < pre && c.G.fight && !c.G.fight.over; i++) c.fightAct(c.fightOptions()[0].k);
      if(!c.G.fight || c.G.fight.over) continue;
      vivas = 0; const orig = c.saveGame;
      c.saveGame = function(){ if(c.G.fight && !c.G.fight.over) vivas++; return orig.apply(this, arguments); };
      c.finishMiniStart(kind, 'fight', 0.6);
      ok(c.FX.S, 'el intento de finalizar no abrió el minijuego');
      c.fxEnd(c.FX.S, q); c.fxFinish();
      if(c.G.fight && !c.G.fight.over) break;
    }
    ok(c.G.fight && !c.G.fight.over, 'el caso de prueba no aplica: ningún intento dejó la pelea viva');
    ok(vivas >= 1, 'el juego ya no guarda con la pelea viva: el caso de prueba no aplica');
    const x = reabrir(h).ctx;
    eq(x.UI.screen, 'fight', 'al cargar una pelea viva no se vuelve a la pelea');
    x.render(); ok(/onclick="fightAct\(/.test(x.document.getElementById('app').innerHTML), 'la pantalla de pelea no ofrece acciones');
    const rec0 = x.G.player.rec.w + x.G.player.rec.l + x.G.player.rec.d;
    eq(terminaPelea(x), terminaPelea(c), 'la pelea retomada no termina igual que sin recargar');
    x.confirmFight(); x.go('hub');
    eq(x.G.player.rec.w + x.G.player.rec.l + x.G.player.rec.d, rec0 + 1, 'la pelea retomada no entró en el récord');
    eq(INV.checkInvariants(x.G, x.UI, {}) || [], [], 'invariantes rotas después de retomar');
  });

  test('pelea decidida sin cobrar: al cargar se ve el resultado y se cobra una sola vez', () => {
    const h = abrir(); const c = h.ctx; alCampLleno(h);
    c.goFight();
    let g = 0;
    while(c.G.fight && !c.G.fight.over && g++ < 12){
      c.finishMiniStart('ko', 'fight', 0.6); if(c.FX.S){ c.fxEnd(c.FX.S, 1); c.fxFinish(); }
      if(c.G.fight && !c.G.fight.over) c.fightAct(c.fightOptions()[0].k);
    }
    ok(c.G.fight && c.G.fight.over && !c.G.paid, 'el caso de prueba no aplica: la pelea no quedó decidida sin cobrar');
    const disco = JSON.parse(c.localStorage.__map.get('cagelegacy_slot_' + c.G.saveId) || '{}');
    ok(disco.fight && disco.fight.over && !disco.paid, 'el juego ya no guarda la pelea decidida sin cobrar: el caso no aplica');
    const x = reabrir(h).ctx;
    eq(x.UI.screen, 'fightresult', 'al cargar una pelea decidida no se ve su resultado');
    const rec0 = x.G.player.rec.w + x.G.player.rec.l + x.G.player.rec.d, caja0 = x.G.cash;
    x.confirmFight(); const caja1 = x.G.cash; x.confirmFight(); x.go('hub');
    eq(x.G.player.rec.w + x.G.player.rec.l + x.G.player.rec.d, rec0 + 1, 'la pelea decidida se perdió al cargar');
    ok(caja1 !== caja0, 'la bolsa no se cobró');
    eq(x.G.cash, caja1, 'se cobró dos veces');
    ok(!x.G.fight, 'la pelea cobrada sigue abierta');
  });

  test('un minijuego a medias se guarda pero al cargar no se retoma ni deja nada bloqueado', () => {
    const h = abrir(); const c = h.ctx; alCampLleno(h);
    c.G.camp.i = 0; c.sparStart(); c.sparPick(0);
    ok(c.G.mg && c.G.mg.type === 'spar', 'el sparring no se abrió');
    const x = recargar(h).ctx;
    eq(x.G.mg, null, 'el minijuego a medias volvió a aparecer al cargar');
    ok(!x.mgSlotBusy(), 'al cargar quedó ocupado el lugar del minijuego');
    x.sparStart(); ok(x.G.mg && x.G.mg.type === 'spar', 'después de cargar no se puede volver a entrenar');
  });
});

/* ================================================================== */
suite('ESTADO-13 · divisiones: subir por el peso es una sola cosa', () => {
  function campeon(){
    const h = abrir(); const c = h.ctx; ganaTitulo(c);
    return h;
  }
  function comprueba(c, old, via){
    const p = c.G.player, org = p.org;
    ok(p.div !== old, via + ': no cambió de división');
    ok(c.G.champs[org][old] !== p.id, via + ': sigue figurando como campeón de la división que dejó');
    ok((c.G.rank[org][p.div] || []).indexOf(p.id) >= 0, via + ': no entró en el ranking de la división nueva');
    eq(p.divAdapt, -8, via + ': no cobró la adaptación al peso nuevo');
    eq(p.weightNow, Math.round(c.walkLb(p) * 10) / 10, via + ': el peso de caminar no es el de la división nueva');
    eq((c.G.offers || []).filter(o => o && o.type === 'fight' && o.div === old).length, 0, via + ': quedan ofertas de la división vieja');
    eq(INV.checkInvariants(c.G, c.UI, {}) || [], [], via + ': invariantes rotas');
  }
  test('el pesaje de emergencia, la subida forzada y la planificada dejan el mundo igual', () => {
    { const c = campeon().ctx, old = c.G.player.div;
      alCampLleno({ ctx: c }); const ev = c.EVENTS.find(e => e.id === 'x9_weight');
      ev.o[2].f(); comprueba(c, old, 'pesaje (x9_weight)'); }
    { const c = campeon().ctx, old = c.G.player.div;
      c.forceDivUp(); comprueba(c, old, 'forzada (forceDivUp)'); }
    { const c = campeon().ctx, old = c.G.player.div;
      const ev = c.EVENTS.find(e => /G\.tmpDivUp/.test(String(e.x)));
      ok(ev, 'no se encontró el evento de la subida planificada');
      c.G.flags.planDivUp = 1; ev.x();
      if(c.G.tmpDivUp === old){ const p = c.G.player, orden = c.DIVKEYS.filter(d => c.DIVS[d].f === (p.fem ? 1 : 0)).sort((a, b) => c.DIVS[a].o - c.DIVS[b].o); c.G.tmpDivUp = orden[orden.indexOf(old) + 1]; }
      ev.o[0].f(); comprueba(c, old, 'planificada (' + ev.id + ')'); }
    /* y si el que sube NO es el campeón, el cinturón de la división que deja
       sigue en manos de su dueño (recalcRank no lo tocaría: lo haría la subida) */
    { const c = abrir().ctx, p = c.G.player, old = p.div, org = p.org;
      let ch = c.G.champs[org][old];
      if(!ch || ch === p.id){ const o = Object.values(c.G.fighters).find(f => f && !f.isPlayer && f.org === org && f.div === old && f.active && !f.retired && c.proFightCount(f) >= 5); c.G.champs[org][old] = o.id; c.recalcRank(org, old); ch = o.id; }
      c.forceDivUp();
      ok(p.div !== old, 'el que no es campeón no subió');
      eq(c.G.champs[org][old], ch, 'subir de categoría le sacó el cinturón al campeón de la división que se deja'); }
  });
  test('cambiar de división cambia el matchmaking: las ofertas nuevas son de la división nueva, y sobreviven a recargar', () => {
    const h = campeon(); const c = h.ctx, old = c.G.player.div;
    c.forceDivUp(); c.makeOffers();
    const x = recargar(h).ctx, p = x.G.player;
    const peleas = (x.G.offers || []).filter(o => o && o.type === 'fight');
    ok(peleas.length > 0, 'después de subir no hubo ofertas de pelea');
    eq(peleas.filter(o => x.F(o.oppId).div !== p.div).length, 0, 'hay ofertas contra rivales de otra división');
    ok(p.div !== old, 'la división no sobrevivió a recargar');
  });
});

/* ================================================================== */
suite('ESTADO-13 · CAMPEÓN EN DOS DIVISIONES dice la verdad', () => {
  test('un cinturón y subir de peso no alcanza; cinturones en dos divisiones, sí', () => {
    const h = abrir(); const c = h.ctx, p = c.G.player, d1 = p.div;
    ganaTitulo(c);
    eq(p.beltDivs, [d1], 'el cinturón no anotó su división');
    ok(c.careerEnding().t !== 'CAMPEÓN EN DOS DIVISIONES', 'con un solo cinturón ya dice dos divisiones');
    alCampLleno(h); c.EVENTS.find(e => e.id === 'x9_weight').o[2].f();
    ok(c.careerEnding().t !== 'CAMPEÓN EN DOS DIVISIONES', 'subir de peso sin ganar ahí ya dice dos divisiones (la regla vieja)');
    const x = recargar(h).ctx;
    ganaTitulo(x);
    eq(x.G.player.beltDivs.length, 2, 'el segundo cinturón no anotó su división o se perdió el primero al recargar');
    eq(x.careerEnding().t, 'CAMPEÓN EN DOS DIVISIONES', 'con cinturones en dos divisiones no lo dice');
  });
  test('el campeón que cambia de categoría por la vía propia y vuelve a ganar, también', () => {
    const c = abrir().ctx;
    ganaTitulo(c);
    c.changeWeightClass(1);
    ganaTitulo(c);
    eq(c.careerEnding().t, 'CAMPEÓN EN DOS DIVISIONES', 'changeWeightClass + título nuevo no da el final de dos divisiones');
  });
});

/* ================================================================== */
suite('ESTADO-13 · una carrera nueva no hereda nada de la anterior', () => {
  test('carrera B después de A en la misma sesión == B en un arranque limpio con el mismo disco', () => {
    const B = (h) => {
      H.startCareer(h, { metaSeed: 222333, style: 'wrest', div: 'WW', age: 23, first: 'Beto', last: 'Bravo' });
      const huellas = [];
      for(let i = 0; i < 40; i += 8){ A.correrCarrera(h, { maxWeeks: 8, politica: 'basica', seedPolitica: 9 + i }); huellas.push(h.ctx.STATE.fingerprint(true)); }
      return { huellas, st: estado(h.ctx) };
    };
    const h1 = H.boot({ seed: 5, file: ARCHIVO });
    H.startCareer(h1, { metaSeed: 111222, style: 'boxer', div: 'LW', age: 22 });
    A.correrCarrera(h1, { maxWeeks: 60, politica: 'basica', seedPolitica: 7 });
    h1.ctx.buyItem && h1.ctx.G.cash > 50000 && h1.ctx.buyItem('nutri');
    h1.ctx.saveGame(true);
    const disco = new Map(h1.ctx.localStorage.__map);
    const b1 = B(h1);
    const b2 = B(H.boot({ seed: 5, file: ARCHIVO, storage: disco }));
    eq(difiere(b1.st, b2.st, 'G'), [], 'la carrera B cambia según lo que se jugó antes en la misma sesión');
    eq(b1.huellas, b2.huellas, 'la trayectoria de B diverge');
  });
});

/* ================================================================== */
suite('ESTADO-13 · cadenas completas (con una recarga en el medio)', () => {
  test('contestarle en público a un rival → una semana → su respuesta, también si se recarga en el medio', () => {
    for(const conRecarga of [false, true]){
      let h = abrir(); const c = h.ctx;
      alCampLleno(h); c.G.flags.storyRivalReplyOpp = null; c.G.story.chains = [];
      const ev = c.EVENTS.find(e => e.id === 'story_rival_escalation'); const txt = ev.x();
      const rival = c.G.tmpOpp; ok(rival, 'la escalada no eligió rival');
      c.G.pending.push({ id: ev.id, txt, opts: ev.o, important: true }); c.resolveEvent(0);
      eq(c.G.story.chains.map(x => x.type + ':' + x.oppId), ['rival_reply:' + rival], 'contestar en público no dejó la respuesta en camino');
      if(conRecarga) h = recargar(h);
      const x = h.ctx; eq(x.G.story.chains.length, 1, (conRecarga ? 'al cargar' : 'al resolver') + ' se perdió la cadena');
      x.G.pending.length = 0; x.advanceWeek();
      eq(x.G.flags.storyRivalReplyOpp, rival, (conRecarga ? 'con recarga' : 'sin recarga') + ': a la semana, la respuesta del rival no quedó habilitada');
      ok(x.EVENTS.find(e => e.id === 'story_rival_reply').c(), 'la respuesta del rival no puede salir');
    }
  });
  test('comprar → guardar → cargar → efecto: el laboratorio abarata la fisio después de recargar', () => {
    const fisio = (h) => { const c = h.ctx; c.G.cash = 90000; c.G.player.dmg = 60; c.G.camp = null; c.G.nextFight = null; c.recStart(); const a = c.G.cash; c.recPick('physio'); return a - c.G.cash; };
    const sin = fisio(abrir());
    const h = abrir(); h.ctx.G.cash = 900000; h.ctx.buyItem('recoverylab');
    ok(h.ctx.shopOwned('recoverylab'), 'no se pudo comprar el laboratorio');
    const x = recargar(h);
    ok(x.ctx.shopOwned('recoverylab'), 'el laboratorio no sobrevivió a recargar');
    eq(sin - fisio(x), 600, 'después de recargar la fisio no cuesta 600 menos');
  });
  test('elegir filosofía → pelea → consecuencia: la Ultimate despierta con el sello de la filosofía, también después de recargar', () => {
    const h = abrir(); const c = h.ctx, r = c.RPG.S();
    r.fpN = Math.max(3, r.fpN || 0); r.fp = { control: 9, castigo: 1 };
    const can = c.RPG.canAdopt('fight'); ok(can.ok, 'no se puede asumir la filosofía: ' + can.why);
    c.RPG.adopt('fight'); eq(r.philo.fight, 'control', 'la filosofía no quedó asumida');
    const x = recargar(h).ctx;
    eq(x.RPG.R().philo.fight, 'control', 'la filosofía no sobrevivió a recargar');
    eq(x.CMB.ultVariantSrc(), { v: x.CMB.ULT_FP.control, src: 'filosofia', k: 'control' }, 'el sello no sale de la filosofía asumida');
  });
  test('iniciar rivalidad → siguiente pelea: pedirle la pelea a la organización con el evento en pantalla, recargar, y la oferta llega', () => {
    const h = abrir(); const c = h.ctx;
    c.cancelScheduledFight && c.cancelScheduledFight('prueba'); c.G.camp = null; c.G.player.inj = null; c.G.player.injWeeks = 0;
    /* un rival con el que no peleó en el último año: contra uno reciente la regla
       anti-repetición descarta la oferta (y el pedido se pierde: ver ESTADO-AUDITORIA §3) */
    const ev = c.EVENTS.find(e => e.id === 'callout'); let txt = null, rival = null;
    const reciente = (id) => (c.G.player.lastFights || []).some(x => x && x.opp === id && (c.G.year * 52 + c.G.week) - (x.year * 52 + x.week) < 52);
    for(let i = 0; i < 12; i++){ txt = ev.x(); rival = c.G.tmpOpp; if(rival && !reciente(rival)) break; }
    ok(rival && !reciente(rival), 'el callout no eligió un rival sin pelea reciente');
    c.G.pending.push({ id: ev.id, txt, opts: ev.o, important: ev.important });
    const x = recargar(h).ctx;
    x.resolveEvent(2);
    eq(x.G.flags.wantFight, rival, 'después de recargar, «pedirle la pelea» no pidió a ese rival');
    const r = x.F(rival); r.inj = null; r.injWeeks = 0;          /* contra un lesionado no se concede: otra regla */
    eq(r.org, x.G.player.org, 'el rival del callout no es de tu organización');
    /* «Puede aparecer pronto»: cada vez que el matchmaker arma ofertas la
       concede la mitad de las veces; el pedido sigue en pie hasta que llega. */
    let llego = false;
    for(let i = 0; i < 10 && !llego; i++){
      eq(x.G.flags.wantFight, rival, 'el pedido se perdió antes de llegar la pelea');
      x.G.offers = []; x.makeOffers();
      llego = x.G.offers.some(o => o && o.oppId === rival && o.event === 'La pelea que pediste');
    }
    ok(llego, 'la pelea pedida no llegó nunca');
    ok(!x.G.flags.wantFight, 'la pelea llegó pero el pedido sigue abierto');
  });
  test('cambiar de mánager → comportamiento: la misma oferta vale distinto para otro mánager, y sigue así después de recargar', () => {
    const h = abrir(); const c = h.ctx;
    c.cancelScheduledFight && c.cancelScheduledFight('prueba'); c.G.camp = null; c.G.player.inj = null; c.G.player.injWeeks = 0;
    c.G.offers = []; c.makeOffers();
    const o = c.G.offers.find(x => x && x.type === 'fight' && c.F(x.oppId)); ok(o, 'no hubo oferta de pelea');
    const antes = c.MGR.score(o, c.MGR.m()).sc;
    const otro = c.G.mgrs.filter(m => m.id !== c.G.mgId).sort((a, b) => Math.abs(b.a.greed - c.MGR.m().a.greed) - Math.abs(a.a.greed - c.MGR.m().a.greed))[0];
    c.changeMgr(otro.id);
    const x = recargar(h).ctx;
    eq(x.G.mgId, otro.id, 'el mánager nuevo no sobrevivió a recargar');
    const o2 = x.G.offers.find(y => y && y.oppId === o.oppId && y.type === 'fight') || o;
    const despues = x.MGR.score(o2, x.MGR.m()).sc;
    ok(Math.abs(despues - antes) > 1e-9, 'la misma oferta vale igual con otro mánager');
  });
  test('entrenar → campamento → combate: el cansancio y el corte del campamento son la energía con la que se sale a pelear', () => {
    const h = abrir(); alCampLleno(h);
    const x = recargar(h).ctx, camp = x.G.camp;
    camp.cutPenalty = 10;
    const fat = camp.fatigue, cut = camp.cutPenalty;
    x.goFight(); ok(x.G.fight, 'la pelea no empezó');
    eq(Math.round(x.G.fight.p.stam * 1000), Math.round(Math.max(45, Math.min(100, 100 - fat * .45 - cut * 1.2)) * 1000), 'el aire del primer asalto no es el que deja el campamento');
    eq(Math.round(x.G.fight.p.hp * 1000), Math.round(Math.max(70, Math.min(100, 100 - cut * .8)) * 1000), 'la salud del primer asalto no es la que deja el corte');
  });
  test('perder → memoria → revancha: la derrota queda en la memoria del rival y ganarle después cuenta como revancha', () => {
    const h = abrir(); const c = h.ctx; alCampLleno(h);
    const opp = c.G.nextFight.oppId;
    c.goFight(); for(let i = 0; i < 4 && !c.G.fight.over; i++) c.fightAct(c.fightOptions()[0].k);
    if(!c.G.fight.over) c.finishFight('ko', 'o');
    ok(c.G.fight.result.winner === 'o', 'el caso de prueba no aplica: no perdió');
    c.confirmFight(); c.go('hub');
    const m = c.G.rpg.fm && c.G.rpg.fm[opp];
    ok(m && m.res === 'L', 'la derrota no quedó en la memoria del rival');
    const x = recargar(h).ctx;
    eq(x.G.rpg.fm[opp], m, 'la memoria del rival cambió al recargar');
    x.G.player.inj = null; x.G.player.injWeeks = 0; x.G.camp = null; x.G.player.dmg = 0;
    const r = x.scheduleFight({ oppId: opp, org: x.G.player.org, weeks: 1 }, 'prueba');
    ok(r && r.ok !== false, 'no se pudo firmar la revancha: ' + JSON.stringify(r));
    x.goFight(); for(let i = 0; i < 4 && !x.G.fight.over; i++) x.fightAct(x.fightOptions()[0].k);
    if(!x.G.fight.over) x.finishFight('ko', 'p');
    ok(x.G.fight.result.winner === 'p', 'el caso de prueba no aplica: no ganó la revancha');
    x.confirmFight();
    eq(x.G.rpg.fm[opp].n, m.n + 1, 'la revancha no sumó a la memoria del mismo rival');
    ok(x.G.rpg.lastFight && x.G.rpg.lastFight.revenge, 'ganarle al que te ganó no cuenta como revancha');
  });
  test('ganar → legado → mundo: el cinturón cambia el mundo, y el retiro lo lleva al legado', () => {
    const h = abrir(); const c = h.ctx, p = c.G.player;
    const t0 = p.titles; ganaTitulo(c);
    const x = recargar(h).ctx, q = x.G.player;
    eq(x.G.champs[q.org][q.div], q.id, 'el cinturón no sobrevivió a recargar');
    eq(x.rankOf(q), 'C', 'el ranking no lo muestra campeón');
    eq(q.titles, t0 + 1, 'el título no se contó');
    x.retire();
    ok(x.G.legacy && x.G.legacy.titles === q.titles, 'el legado no registra el título');
    ok(/CAMPEÓN/.test(x.careerEnding().t), 'el final no reconoce al campeón: ' + x.careerEnding().t);
  });
  test('desbloquear técnica → combate → efecto: la técnica desbloqueada sigue tuya después de recargar y en la pelea hace algo', () => {
    const h = abrir(); const c = h.ctx;
    c.G.tq.pts = Math.max(c.G.tq.pts || 0, 20);
    const t = c.TQ.T.filter(x => c.TQ.canUnlock(x.id).ok).sort((a, b) => a.cost - b.cost)[0];
    ok(t, 'no hay técnica desbloqueable'); c.TQ.unlock(t.id);
    ok(c.TQ.has(t.id), 'la técnica no quedó desbloqueada');
    alCampLleno(h);
    const x = recargar(h).ctx;
    ok(x.TQ.has(t.id), 'la técnica no sobrevivió a recargar');
    x.goFight();
    let usada = null;
    for(let i = 0; i < 30 && x.G.fight && !x.G.fight.over && !usada; i++){
      const lista = x.TQ.available().filter(e => e.s.ok);
      if(lista.length){
        const oHp = x.G.fight.o.hp, oSt = x.G.fight.o.stam, log = (x.G.fight.log || []).length;
        x.TQ.use(lista[0].t.id); if(x.FX.S){ x.fxEnd(x.FX.S, 0.9); x.fxFinish(); }
        usada = { id: lista[0].t.id, cambio: x.G.fight ? (x.G.fight.o.hp !== oHp || x.G.fight.o.stam !== oSt || (x.G.fight.log || []).length !== log) : true };
      } else x.fightAct(x.fightOptions()[0].k);
    }
    ok(usada, 'en toda la pelea no hubo una técnica disponible');
    ok(usada.cambio, 'usar la técnica no cambió nada en la pelea');
  });
});
