'use strict';
/* FASE 15 — ¿LAS DECISIONES DECIDEN ALGO?
   ---------------------------------------------------------------------------
   dev/decisiones.js mide cada decisión donde el jugador la encuentra. Esto fija
   lo que esa medición encontró y lo que se corrigió:
     · ninguna opción del banco de eventos deja el mismo estado que otra;
     · lo que se informa es lo que pasa (ganancias del entrenamiento, la ficha
       de personalidad);
     · los recursos compiten (entrenar, cansarse, recuperarse, el campamento);
     · el plan del campamento lee al rival y cambia la pelea;
     · personalidad, filosofía, entrenador y mánager cambian algo concreto;
     · cambiar de equipo cuesta; dos perfiles opuestos construyen personajes
       distintos.                                                            */
const { suite, test, ok, eq } = require('../run-tests.js');
const H = require('../harness.js');
const A = require('../autopilot.js');
const D = require('../decisiones.js');

const ARCHIVO = process.env.CAGE_FILE || undefined;

function carrera(seed, cfg){
  const h = H.boot({ seed, file: ARCHIVO });
  H.startCareer(h, Object.assign({ metaSeed: 150000 + seed, style: 'mma', div: 'LW', age: 23 }, cfg || {}));
  return h;
}
/* carrera con contrato y una pelea firmada con campamento abierto */
function enCamp(seed, cfg){
  const h = carrera(seed, cfg), c = h.ctx, p = c.G.player;
  const co = c.G.offers.find(o => o.type === 'contract' && c.G.orgs[o.org]);
  ok(co, 'no hubo oferta de contrato');
  c.negoStart(co); c.negoClose(); c.G.mg = null; c.UI.screen = 'hub';
  const opp = Object.values(c.G.fighters).find(f => f && f.div === p.div && f.id !== p.id && !f.retired && f.active && !f.inj && !c.fightSpecProblem({ oppId: f.id, org: p.org }));
  ok(c.scheduleFight({ oppId: opp.id, org: p.org, weeks: 8, title: false, purse: 5000, event: 'T' }, 'prueba').ok, 'no se firmó');
  ok(c.startCamp(c.G.nextFight), 'no arrancó el campamento');
  c.G.pending.length = 0;
  return h;
}
/* partida guardada: la misma para varias ramas */
function guardar(h){ const c = h.ctx; c.saveGame(true); return { seed: 1, sid: c.listSaves()[0].id, disco: new Map(c.localStorage.__map), rs: c.G.rs | 0 }; }

/* ================================================================== */
suite('DECISIONES-15 · ninguna decisión del banco es falsa', () => {
  test('cada opción de cada evento deja un estado distinto del de las otras (textos y memoria narrativa aparte)', () => {
    /* dos partidas: una con campamento y plan hecho, otra libre. Cada evento se mira
       en la que cumple su condición (si cumple en las dos, en la que menos empates da) */
    function base(conCamp){
      const h = carrera(1313, { metaSeed: 131301 }), c = h.ctx;
      for(let i = 0; i < 80; i++){
        A.correrCarrera(h, { maxWeeks: 1, politica: 'basica', seedPolitica: 40 + i });
        while(c.G.pending.length) c.resolveEvent(0); c.G.mg = null;
        const listo = c.G.player.org && c.G.player.rec.w + c.G.player.rec.l >= 6 &&
          (conCamp ? (c.G.camp && c.G.camp.i >= 2 && c.G.nextFight && c.G.nextFight.weeks > 1) : (!c.G.camp && !c.G.nextFight));
        if(listo) break;
      }
      if(conCamp){ ok(c.G.camp, 'no se llegó a un campamento'); c.gpStart(); c.gpSet('prio', 'striking'); c.gpSet('dist', 'media'); c.gpSet('pace', 'medio'); c.gpSet('def', 'cabeza'); c.gpConfirm(); c.G.mg = null; }
      /* confirmar el plan puede dejar en cola la objeción del entrenador (camp_split): la
         partida se guarda con la cola vacía, o se resolvería ese evento en vez del que se mide */
      c.G.pending.length = 0;
      c.G.player.pop = Math.max(c.G.player.pop, 50); c.G.cash = Math.max(c.G.cash, 50000);
      return guardar(h);
    }
    function efecto(snap, id, i){
      const c = D.abrir(snap).ctx, ev = c.EVENTS.find(e => e.id === id);
      let aplica = true; try{ aplica = !ev.c || !!ev.c(); } catch(e){ aplica = false; }
      c.G.rs = (snap.rs + 7919) | 0;
      let txt; try{ txt = ev.x(); } catch(e){ return null; }
      eq(c.G.pending.length, 0, id + ': la partida base tiene un evento en cola');
      const antes = D.aplanar(D.persistible(c), 'G');
      c.G.pending.push({ id: ev.id, txt, opts: ev.o, important: ev.important });
      c.G.rs = (snap.rs + 7919) | 0; c.resolveEvent(i);
      eq(c.G.pending.filter(e => e.id === ev.id).length, 0, id + ': no se resolvió el evento que se mide');
      const out = {};
      for(const [k, v] of D.aplanar(D.persistible(c), 'G')) if(D.tipo(k) !== 'texto' && D.tipo(k) !== 'memoria' && (!antes.has(k) || antes.get(k) !== v)) out[k] = v;
      return { out: JSON.stringify(out), aplica };
    }
    const bases = { camp: base(true), libre: base(false) };
    const c0 = carrera(1).ctx, falsas = []; let casos = 0, fuera = 0;
    for(const ev of c0.EVENTS){
      if(ev.id === 'cl_dyn' || !(ev.o || []).length) continue;
      /* se juzga sólo donde el evento puede salir (su condición se cumple); si se cumple en
         las dos partidas, basta que dos opciones empaten en una para marcarlas */
      let visto = false;
      for(const [nb, sn] of Object.entries(bases)){
        const ds = ev.o.map((_, i) => efecto(sn, ev.id, i)); if(ds.some(d => !d) || !ds[0].aplica) continue;
        visto = true;
        for(let i = 0; i < ds.length; i++) for(let j = i + 1; j < ds.length; j++) if(ds[i].out === ds[j].out) falsas.push(ev.id + ' [' + nb + '] ' + i + '=' + j);
      }
      if(visto) casos++; else fuera++;
    }
    if(process.env.DEC15_VERBOSE) console.log('   eventos juzgados en su condición: ' + casos + ' · fuera de condición en las dos partidas: ' + fuera + ' · pares falsos: ' + falsas.length);
    ok(casos >= 35, 'muy pocos eventos ejercitados en su condición: ' + casos + ' (fuera de condición en las dos partidas: ' + fuera + ')');
    eq(falsas, [], 'opciones de un mismo evento que dejan exactamente el mismo estado');
  });
});

/* ================================================================== */
suite('DECISIONES-15 · lo que se informa es lo que pasa', () => {
  test('el entrenamiento informa la ganancia real: cada «+n» movió la stat exactamente n, y nada que no se movió aparece', () => {
    const c = carrera(1501).ctx, p = c.G.player;
    let lineas = 0, fracciones = 0;
    for(const k of ['box', 'wrest', 'grap', 'cardio', 'mind', 'tech', 'spar', 'kick', 'box', 'wrest']){
      p.fatigue = 20; p.inj = null; p.injWeeks = 0;
      const antes = Object.assign({}, p.st);
      const r = c.applyTrain(k, 1.1, 0.2);
      const suma = {}; for(const [s, g] of r.gain){ suma[s] = (suma[s] || 0) + g; lineas++; if(Math.abs(g - Math.round(g)) > 1e-9) fracciones++; }
      for(const s in p.st){ const d = p.st[s] - antes[s]; eq(+(suma[s] || 0).toFixed(6), +d.toFixed(6), k + ': la stat ' + s + ' se informó +' + (suma[s] || 0) + ' y se movió ' + d); }
    }
    ok(lineas > 0, 'ningún entrenamiento movió nada: la prueba no aplica');
    eq(fracciones, 0, 'se informan fracciones que no existen (las stats son enteras)');
    eq(c.gainText([]), 'Sin progreso medible esta semana.', 'sin ganancias, el texto no lo dice');
  });
  test('la ficha de personalidad muestra lo que la personalidad hace: esquina, conflicto y prensa; no una barra de mánager que nadie lee', () => {
    const c = carrera(1502, { pers: 'charisma' }).ctx;
    c.UI.screen = 'clcareer';
    const h = c.hookFilter('screen:clcareer', '', {});
    ok(/Fuera del octágono/.test(h), 'la ficha no se dibujó: la prueba no aplica');
    ok(/Con tu esquina/.test(h) && /Conflicto que generás/.test(h) && /Interés de la prensa/.test(h), 'falta una de las tres barras con efecto');
    ok(!/Con tu manager/.test(h), 'volvió la barra «Con tu manager»: PERSX.mgr no lo lee ninguna regla');
  });
});

/* ================================================================== */
suite('DECISIONES-15 · los recursos compiten', () => {
  test('entrenar cansado rinde menos y lesiona más (mismo azar, 30 semanas de muestra)', () => {
    const snap = guardar(carrera(1503));
    const medir = (desgaste) => { let gan = 0, les = 0;
      for(let r = 0; r < 30; r++){ const c = D.abrir(snap).ctx, p = c.G.player; p.fatigue = desgaste; p.inj = null; p.injWeeks = 0; c.G.rs = (snap.rs + 7919 * (r + 1)) | 0;
        const a = Object.values(p.st).reduce((x, v) => x + v, 0); const res = c.applyTrain('spar', 1.0, 0); gan += Object.values(p.st).reduce((x, v) => x + v, 0) - a; if(res.inj) les++; }
      return { gan, les }; };
    const fresco = medir(20), cansado = medir(85);
    ok(cansado.gan < fresco.gan, 'cansado no rinde menos: ' + fresco.gan + ' / ' + cansado.gan);
    ok(cansado.les > fresco.les, 'cansado no se lesiona más: ' + fresco.les + ' / ' + cansado.les);
  });
  test('recuperarse compite con entrenar: la recuperación baja el desgaste más que cualquier trabajo, y el trabajo lo sube', () => {
    const snap = guardar(carrera(1504));
    const desgaste = (k) => { const c = D.abrir(snap).ctx, p = c.G.player; p.fatigue = 50; c.G.rs = (snap.rs + 11) | 0; c.applyTrain(k, 0.85, 0); return p.fatigue; };
    const rest = desgaste('rest');
    for(const k of ['box', 'kick', 'muay', 'wrest', 'grap', 'cardio', 'str', 'spar', 'tech', 'mind']){
      const f = desgaste(k); ok(f > rest, k + ' cansa menos que recuperarse: ' + f + ' / ' + rest);
      if(k !== 'mind') ok(f > 50, k + ' no cansa: ' + f);
    }
  });
  test('en campamento: la semana tranquila congela el campamento; recuperarse cuesta filo; la pelea llega igual', () => {
    const snap = guardar(enCamp(1505));
    const semana = (fn) => { const c = D.abrir(snap).ctx; c.G.camp.fatigue = 30; const cp0 = Object.assign({}, c.G.camp), nf0 = c.G.nextFight.weeks; c.G.rs = (snap.rs + 5) | 0; fn(c); return { i: c.G.camp.i - cp0.i, filo: c.G.camp.sharp - cp0.sharp, desg: c.G.camp.fatigue - cp0.fatigue, pelea: nf0 - c.G.nextFight.weeks }; };
    const tranquila = semana(c => c.skipWeek()), rest = semana(c => c.doWeek('rest')), spar = semana(c => c.doWeek('box'));
    eq([tranquila.i, tranquila.filo], [0, 0], 'la semana tranquila movió el campamento');
    eq(rest.i, 1, 'recuperarse no cuenta como semana de campamento');
    ok(rest.filo < 0 && rest.desg < 0, 'recuperarse en camp no cuesta filo o no descansa: ' + JSON.stringify(rest));
    ok(spar.filo > 0 && spar.desg > 0, 'entrenar en camp no afila o no cansa: ' + JSON.stringify(spar));
    eq([tranquila.pelea, rest.pelea, spar.pelea], [1, 1, 1], 'la fecha de la pelea no corre igual para las tres');
  });
});

/* ================================================================== */
suite('DECISIONES-15 · el plan del campamento depende del rival', () => {
  test('el puntaje del plan lee al rival: atacar su derribo suma si lo tiene flojo, no si lo tiene fuerte', () => {
    const snap = guardar(enCamp(1506));
    const puntaje = (tdd) => { const c = D.abrir(snap).ctx, o = c.F(c.G.camp.oppId); o.st.tdd = tdd;
      c.gpStart(); c.gpSet('prio', 'wrestling'); c.gpSet('dist', 'media'); c.gpSet('pace', 'medio'); c.gpSet('def', 'reja'); c.gpConfirm(); return c.G.camp.gameplan.score; };
    eq(puntaje(55) - puntaje(85), 3, 'el plan de lucha no lee la defensa de derribo del rival');
  });
  test('el plan cambia la pelea según el rival: contra un fajador, luchar gana mucho más que intercambiar; contra un luchador, la diferencia se achica', () => {
    const snap = D.baseCamp(1601), N = 24;
    const gana = (perfil, plan) => { let g = 0; for(let r = 0; r < N; r++) if(D.pelearPlan(snap, perfil, plan, r).gana) g++; return g / N; };
    const fw = gana('fajador', 'wrestling'), fs = gana('fajador', 'striking'), lw = gana('luchador', 'wrestling'), ls = gana('luchador', 'striking');
    ok(fw - fs >= 0.2, 'contra el fajador el plan de lucha no rinde más: ' + fw + ' / ' + fs);
    ok((lw - ls) < (fw - fs) - 0.15, 'el rival no cambia qué plan conviene: fajador ' + (fw - fs).toFixed(2) + ' · luchador ' + (lw - ls).toFixed(2));
  });
  test('el plan escrito tiene que pelearse: cada plan ayuda más a las acciones que nombra que el plan contrario', () => {
    /* sobre la base se suman bonos generales (capa CL, técnicas, rasgos) que valen para todo
       plan: lo que el plan decide es la diferencia */
    const c = enCamp(1507).ctx, mod = (gp, k) => { c.G.fight = { gp }; const v = c.gpMod(k); c.G.fight = null; return v; };
    const lucha = { prio: 'wrestling', dist: 'corta', pace: 'medio', def: 'derribo' }, golpe = { prio: 'striking', dist: 'larga', pace: 'medio', def: 'cabeza' };
    ok(mod(lucha, 'td') - mod(golpe, 'td') >= 5, 'el plan de lucha no ayuda al derribo más que el de golpeo');
    ok(mod(lucha, 'clinch') > mod(golpe, 'clinch'), 'el plan de lucha no ayuda al clinch');
    ok(mod(golpe, 'strike') - mod(lucha, 'strike') >= 4, 'el plan de golpeo no ayuda a golpear más que el de lucha');
    ok(mod({ prio: 'counter', dist: 'larga', pace: 'medio', def: 'cabeza' }, 'counter') > mod(lucha, 'counter'), 'el plan de contra no ayuda a la contra');
  });
});

/* ================================================================== */
suite('DECISIONES-15 · personalidad y filosofía', () => {
  test('la personalidad cambia la vida social, la paciencia de la esquina y los conflictos que se generan solos', () => {
    const correr = (pers) => {
      const c = enCamp(1508, { pers }).ctx, co = c.coachById(c.G.player.coach), st = c.CL.coachState(co);
      st.patience = 50; c.G.pending.length = 0;
      let rivales = 0; const tr = c.CL.track; c.CL.track = function(f, why){ if(why === 'rivalidad por carácter') rivales++; return tr.apply(this, arguments); };
      const ch = c.chance; c.chance = () => true;
      /* sólo el gancho semanal de la personalidad: el resto de la semana llenaría la cola antes */
      const hk = (c.HOOKS.week || []).find(x => x.id === 'personalidad');
      ok(hk, 'no está el gancho semanal de la personalidad');
      try{ for(let i = 0; i < 4; i++){ c.CL.S().once = {}; c.G.pending.length = 0; hk.fn({}); } } finally { c.chance = ch; }
      return { social: c.socCap(), paciencia: st.patience, rivales };
    };
    const humilde = correr('humble'), arrogante = correr('arrogant'), carisma = correr('charisma'), callado = correr('quiet');
    ok(carisma.social > callado.social, 'el carismático no tiene más vida social que el reservado: ' + carisma.social + ' / ' + callado.social);
    ok(humilde.paciencia > arrogante.paciencia, 'la esquina le tiene la misma paciencia al humilde que al arrogante: ' + humilde.paciencia + ' / ' + arrogante.paciencia);
    ok(arrogante.rivales > 0 && humilde.rivales === 0, 'los conflictos por carácter no dependen del carácter: arrogante ' + arrogante.rivales + ' · humilde ' + humilde.rivales);
  });
  test('asumir una filosofía de combate en público le importa a tu esquina: la que él enseña suma paciencia, otra la resta', () => {
    const correr = (coincide) => {
      const c = carrera(1509).ctx, co = c.coachById(c.G.player.coach), st = c.CL.coachState(co), ph = st.ph;
      const fps = Object.keys(c.RPG.FP_COACH), k = fps.find(x => (c.RPG.FP_COACH[x] || []).indexOf(ph) >= 0 === coincide);
      ok(k, 'no hay filosofía ' + (coincide ? 'afín' : 'ajena') + ' para la prueba');
      st.patience = 50; c.RPG.canAdopt = () => ({ ok: true, k });
      c.RPG.adopt('fight'); return st.patience - 50;
    };
    ok(correr(true) > 0, 'la filosofía afín no suma paciencia');
    ok(correr(false) < 0, 'la filosofía ajena no resta paciencia');
  });
});

/* ================================================================== */
suite('DECISIONES-15 · entrenador, mánager y lo que cuesta cambiar', () => {
  test('el entrenador cambia lo que rinde la semana: un especialista en lucha hace rendir más la lucha que uno de golpeo', () => {
    const c = carrera(1510).ctx, p = c.G.player;
    const q = (spec) => { const co = c.coachById(p.coach); const s0 = co.spec; co.spec = spec; const v = c.trainQuality('wrest'); co.spec = s0; return v; };
    ok(q('wrest') > q('strike'), 'la especialidad del entrenador no cambia la calidad: ' + q('wrest') + ' / ' + q('strike'));
  });
  test('el mánager con contactos consigue el acuerdo mejor; sin contactos, «dejalo en sus manos» no mueve nada', () => {
    const correr = (net) => { const c = carrera(1511).ctx, m = c.mgrById(c.G.mgId) || c.G.mgrs[0]; c.G.mgId = m.id; m.a.net = net; c.G.flags.betterDeal = false;
      const ev = c.EVENTS.find(e => e.id === 'contract_dispute'); c.G.pending.push({ id: ev.id, txt: 'x', opts: ev.o }); c.resolveEvent(1); return !!c.G.flags.betterDeal; };
    eq([correr(85), correr(50)], [true, false], 'los contactos del mánager no deciden el resultado');
  });
  test('cambiar de gimnasio cuesta y no se puede en campamento; dejar a tu entrenador le baja la confianza, y la confianza pesa en lo que rinde', () => {
    const h = carrera(1512), c = h.ctx, p = c.G.player;
    c.G.cash = 1e6;
    const g = c.G.gyms.find(x => x.id !== p.gym && c.CL.gymRepOf(x.id) >= c.GYM_REJECT);
    ok(g, 'no hay gimnasio que acepte para la prueba');
    const caja = c.G.cash; c.gymJoin(g.id);
    eq(p.gym, g.id, 'no se mudó'); eq(caja - c.G.cash, c.gymMoveFee(g), 'la mudanza no cobró su cuota');
    const c2 = enCamp(1513).ctx, g2 = c2.G.gyms.find(x => x.id !== c2.G.player.gym);
    const g0 = c2.G.player.gym; c2.G.cash = 1e6; c2.gymJoin(g2.id);
    eq(c2.G.player.gym, g0, 'se mudó en medio de un campamento');
    const co = c.coachById(p.coach), otro = c.G.coaches.find(x => x.id !== co.id);
    const q0 = c.trainQuality('box'), t0 = co.rel.trust;
    c.changeCoach(otro.id); c.changeCoach(co.id);
    ok(co.rel.trust < t0, 'dejar al entrenador no le bajó la confianza');
    ok(c.trainQuality('box') < q0, 'volver con el entrenador que dejaste rinde igual que antes');
  });
});

/* ================================================================== */
suite('DECISIONES-15 · builds', () => {
  test('dos perfiles opuestos construyen personajes distintos: técnicas, tono en la prensa y qué stats crecen', () => {
    const g = D.carreraPerfil('golpeador', 90, 1901), pr = D.carreraPerfil('presion', 90, 1901);
    const ramas = (r) => Object.keys(r.ramas).sort().join(',');
    ok(ramas(g) !== ramas(pr), 'las mismas ramas de técnicas: ' + ramas(g));
    ok(Object.keys(g.tonos).join() !== Object.keys(pr.tonos).join() || (!Object.keys(g.tonos).length && !Object.keys(pr.tonos).length), 'el mismo tono en la prensa');
    ok(g.eventosDistintos >= 10 && pr.eventosDistintos >= 10, 'muy pocas decisiones en 90 semanas: ' + g.eventosDistintos + ' / ' + pr.eventosDistintos);
    ok(g.semanas > 0 && pr.semanas > 0, 'no hubo semanas de entrenamiento');
  });
});

/* ================================================================== */
suite('DECISIONES-15 · repetición', () => {
  test('la investigación del patrocinador turbio sale una vez, no cada semana por el resto de la carrera', () => {
    /* medido antes: 282 veces en una carrera de 10 años (una cada semana y media) */
    const c = enCamp(1514).ctx, hk = (c.HOOKS.week || []).find(x => x.id === 'promesas');
    ok(hk, 'no está el gancho semanal de las promesas');
    c.G.flags.dirtyMoney = { at: c.RPG.stamp() - 20 };
    let veces = 0;
    for(let i = 0; i < 12; i++){
      c.G.pending.length = 0; hk.fn({});
      if(c.G.pending.some(e => e.h === 'prom_invest')){ veces++; c.resolveEvent(1); }
    }
    eq(veces, 1, 'la nota sobre el patrocinador salió ' + veces + ' veces en 12 semanas');
  });
});

/* ================================================================== */
suite('DECISIONES-15 · la posición del botón no decide', () => {
  test('la misma respuesta deja el mismo estado en la primera posición que en la tercera', () => {
    /* antes: la primera opción de cualquier evento sumaba +1,5 de confianza del entrenador y el
       resto +0,5, fuera cual fuera su contenido */
    const snap = guardar(carrera(1515));
    const correr = (pos) => {
      const c = D.abrir(snap).ctx, ev = c.EVENTS.find(e => e.id === 'coach_talk');
      const neutra = ev.o[2]; ev.o[pos] = { t: neutra.t, f: neutra.f };
      c.G.pending.length = 0; c.G.rs = (snap.rs + 3) | 0;
      c.G.pending.push({ id: ev.id, txt: ev.x(), opts: ev.o });
      c.resolveEvent(pos);
      const co = c.coachById(c.G.player.coach); return [co.rel.trust, co.rel.respect, co.rel.friend];
    };
    eq(correr(0), correr(2), 'la misma respuesta cambia la relación según su posición');
  });
});
