'use strict';
/* FASE 12 — LO QUE SE PAGA FUERA DE LA TIENDA, CUMPLE LO QUE PROMETE
   ---------------------------------------------------------------------------
   El mismo contrato que la tienda (23-fase11-tienda.js), para todo lo que se
   paga por fuera: servicios, viajes, visitas, mudanzas, contenido, deudas,
   eventos con costo y los gastos de cada semana. Para cada pago:
     precio que se ve ANTES = lo que se cobra · el estado que deja · quién lo
     lee · la consecuencia medida · que se vea · que sobreviva a guardar y
     cargar · y que no se cobre dos veces.
   Las acciones que hacen pasar una semana se miden con el avance de semana
   reemplazado por un registro: así el cobro queda aislado de la cuota semanal
   y, a la vez, se comprueba que la semana pasa.                             */
const { suite, test, ok, eq } = require('../run-tests.js');
const H = require('../harness.js');
const fs = require('node:fs');
const path = require('node:path');

const ARCHIVO = process.env.CAGE_FILE || undefined;
const SRC = fs.readFileSync(ARCHIVO || path.join(__dirname, '..', '..', 'index-4-blindado.html'), 'utf8');

function carrera(seed){
  const h = H.boot({ seed, file: ARCHIVO });
  H.startCareer(h, { metaSeed: 9990 + seed, style: 'mma', div: 'LW', age: 22 });
  const c = h.ctx;
  const co = c.G.offers.find(o => o.type === 'contract' && c.G.orgs[o.org]);
  c.negoStart(co); c.negoClose(); c.G.mg = null; c.UI.screen = 'hub'; c.G.pending = [];
  return c;
}
const hook = (c, evt, id) => (c.HOOKS[evt] || []).find(x => x.id === id);
const texto = h => String(h).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const pantalla = (c, scr, sub) => { c.UI.screen = scr; c.UI.sub = sub === undefined ? null : sub; c.render(); return c.document.getElementById('app').innerHTML; };
/* el número de plata que sigue a un texto en pantalla ($1,234 → 1234) */
function precioEn(html, antes){
  const t = texto(html), i = t.indexOf(antes); if(i < 0) return NaN;
  const m = t.slice(i + antes.length).match(/\$([0-9][0-9,]*)/);
  return m ? Number(m[1].replace(/,/g, '')) : NaN;
}
function rival(c, cond){
  const p = c.G.player;
  return Object.values(c.G.fighters).find(f => f && !f.isPlayer && f.div === p.div && f.active && !f.retired && !f.inj &&
    !c.fightSpecProblem({ oppId: f.id, org: p.org }) && (!cond || cond(f)));
}
function enCamp(c, o){
  o = o || rival(c);
  ok(c.scheduleFight({ oppId: o.id, org: c.G.player.org, weeks: 8, title: false, purse: 8000, event: 'T' }, 'prueba').ok, 'no se firmó');
  ok(c.startCamp(c.G.nextFight), 'no arrancó el camp'); c.G.pending = [];
  return o;
}
/* corre fn con el avance de semana registrado en vez de ejecutado */
function sinSemana(c, fn){
  const aw = c.advanceWeek, cw = c.closeWeek; let semanas = 0;
  c.advanceWeek = () => { semanas++; }; c.closeWeek = () => {};
  try{ fn(); } finally { c.advanceWeek = aw; c.closeWeek = cw; }
  return semanas;
}
/* encola un evento tal como lo arma rollEvent y lo resuelve con la opción idx */
function evento(c, id, idx){
  const ev = c.EVENTS.find(e => e.id === id);
  const e = { id: ev.id, txt: ev.x(), opts: ev.o, important: ev.important };
  c.G.pending = [e]; c.UI.screen = 'hub'; c.render();
  const html = c.document.getElementById('app').innerHTML;
  c.resolveEvent(idx);
  return { e, html };
}
function pendienteCL(c, h){ return c.G.pending.find(e => e.h === h); }
function resolverCL(c, h, idx){ const i = c.G.pending.findIndex(e => e.h === h); ok(i >= 0, 'no hay ' + h); const e = c.G.pending.splice(i, 1)[0]; c.G.pending.unshift(e); c.resolveEvent(idx); }
function contarAzar(c, fn){ const rs0 = c.G.rs; fn(); return c.G.rs === rs0 ? 0 : 1; }
/* una deuda de prueba, sin pasar por las reglas de adelantos (CL.canAdvance) */
function deuda(c, amt){ c.CL.S().lastAdvance = -999; const d0 = c.CL.debtTotal(); c.CL.debtAdd(amt, 'prueba', 'prueba'); ok(c.CL.debtTotal() - d0 === amt, 'no se armó la deuda de prueba'); }
function guardarCargar(c){ c.saveGame(true); ok(c.loadGame(c.listSaves()[0].id), 'no cargó'); }
/* guardar acá y cargar en OTRO juego recién abierto: lo que vive sólo en
   memoria no sobrevive, como al cerrar y abrir el navegador */
function recargar(c){
  c.saveGame(true);
  const h2 = H.boot({ seed: 999, file: ARCHIVO }), d = h2.ctx;
  for(const [k, v] of c.localStorage.__map) d.localStorage.setItem(k, v);
  ok(d.loadGame(d.listSaves()[0].id), 'no cargó en el juego nuevo');
  d.UI.screen = 'hub'; d.G.pending = d.G.pending || [];
  return d;
}

/* ==========================================================================
   CONTRATO: cada pago de una vez, con precio visible, cobro, efecto y repetición
   ========================================================================== */
const PAGOS = {
  'visitar un gimnasio': {
    prep: c => { c.G.player.fatigue = 10; },
    visible: c => { const g = c.G.gyms.find(x => x.id !== c.G.player.gym); c.__g = g; return precioEn(pantalla(c, 'gyms', g.id), 'Visitar 1 semana'); },
    pagar: c => c.gymVisit(c.__g.id), semana: 1,
    efecto: c => {
      if(!((c.G.flags.gymSeen || {})[c.__g.id] >= 1)) return 'la visita no queda registrada';
      /* 10 del viaje (travelCost) más lo que cansa la sesión en la otra casa */
      if(!(c.G.player.fatigue >= 20)) return 'la visita no cansa el viaje: fatiga ' + c.G.player.fatigue;
      if(!/Entrenaste una semana en/.test(c.G.socOut.t)) return 'el resultado no dice lo que pasó';
      return /visitado ×1/.test(texto(pantalla(c, 'gyms'))) ? null : 'la pantalla no muestra la visita';
    } },
  'mudarse (Gimnasios)': {
    visible: c => { const g = c.G.gyms.find(x => x.id !== c.G.player.gym && x.a.wrest > 75) || c.G.gyms.find(x => x.id !== c.G.player.gym); c.__g = g; return precioEn(pantalla(c, 'gyms', g.id), 'Mudarme acá'); },
    pagar: c => c.gymJoin(c.__g.id),
    efecto: c => c.G.player.gym === c.__g.id && /Te mudaste a/.test(c.G.socOut.t) ? null : 'no se mudó o no lo dice',
    repetir: 0 },
  'mudarse (Equipo)': {
    visible: c => { const g = c.G.gyms.find(x => x.id !== c.G.player.gym); c.__g = g; const t = texto(pantalla(c, 'gym')); const i = t.indexOf(g.name); return precioEn(t.slice(i), 'mudarte'); },
    pagar: c => c.changeGym(c.__g.id),
    efecto: c => c.G.player.gym === c.__g.id ? null : 'no se mudó',
    repetir: 0 },
  'ir a ver una pelea': {
    prep: c => { const f = rival(c); c.relV(f).friend = 60; c.bondOf(f).chat = 1; },
    visible: c => { const f = rival(c); c.__f = f; return precioEn(pantalla(c, 'social', f.id), 'Ir a ver su pelea'); },
    pagar: c => c.watchFight(c.__f.id), semana: 1,
    efecto: c => {
      const intel = c.G.soc && c.G.soc.intel && c.G.soc.intel[c.__f.id];
      if(!intel) return 'no quedó lo que le leíste';
      if(!/Le leíste el juego/.test(c.G.socOut.t)) return 'el resultado no lo dice';
      return texto(pantalla(c, 'social', c.__f.id)).indexOf('Le detectaste: ' + intel) >= 0 ? null : 'la ficha no muestra lo que le detectaste';
    },
    repetir: 0 },
  'viajar con un compañero': {
    prep: c => { const f = rival(c); c.__f = f; c.relV(f).friend = 90; c.G.player.fatigue = 10; },
    visible: c => precioEn(pantalla(c, 'social', c.__f.id), 'Viajar juntos a un evento'),
    pagar: c => c.travelWith(c.__f.id), semana: 1,
    efecto: c => c.G.player.fatigue === 18 && /Viajaste con/.test(c.G.socOut.t) && c.relV(c.__f).trust >= 9 ? null : 'el viaje no cansa 8 o no cambia la relación: ' + c.G.player.fatigue,
    repetir: 0 },
  'producción de contenido': {
    prep: c => { c.G.flags.shop.camera = 1; c.CL.contentState().hype = 60; },
    visible: c => precioEn(c.CL.hubCards.find(x => x.id === 'content_team').fn(), 'Invertir en producción'),
    pagar: c => c.contentBoost(),
    efecto: c => {
      const s = c.CL.contentState(); if(s.hype !== 69) return 'el hype no subió 9: ' + s.hype;
      /* el hype lo lee la producción semanal: por encima de 65 rinde más popularidad */
      const pop = () => { const a = c.G.player.pop; c.CL.contentProduce([]); return c.G.player.pop - a; };
      s.hype = 60; const bajo = pop(); s.hype = 69; const alto = pop();
      return alto > bajo ? null : 'el hype no cambia lo que rinde la producción: ' + bajo + ' / ' + alto;
    },
    repetir: 'mismo' },
  'experiencia de carrera': {
    prep: c => { c.G.player.st.adaptability = 50; c.G.player.st.fightiq = 50; },
    visible: c => precioEn(pantalla(c, 'contracts'), 'Siguiente nivel:'),
    pagar: c => c.requestGameplayUpgrade(),
    efecto: c => {
      const st = c.G.player.st;
      if(!(c.G.gameplayLevel === 1 && st.adaptability === 51 && st.fightiq === 51)) return 'no subió de nivel o no dio +1/+1: ' + [c.G.gameplayLevel, st.adaptability, st.fightiq];
      return /adaptabilidad \+1, Fight IQ \+1/.test(JSON.stringify(c.G.news || [])) ? null : 'la noticia no dice qué compró';
    },
    repetir: 'siguiente' },
  'fisio en la semana de recuperación': {
    prep: c => { c.G.player.dmg = 60; c.G.player.fatigue = 50; c.recStart(); },
    visible: c => precioEn(c.scrMG(), 'FISIO daño ·'),
    pagar: c => { c.__d = c.G.player.dmg; c.recPick('physio'); }, semana: 1,
    efecto: c => c.__d - c.G.player.dmg >= 30 - 1e-9 ? null : 'la fisio no bajó el daño' },
  'pagar la deuda de tu bolsillo': {
    prep: c => { deuda(c, 5000); c.G.cash = 3000; },
    visible: c => { c.__d0 = c.CL.debtTotal(); return precioEn(pantalla(c, 'contracts'), 'Pagar ahora de tu bolsillo'); },
    pagar: c => c.CL.debtPayNow(),
    efecto: c => c.CL.debtTotal() === c.__d0 - 3000 && /pagado de tu bolsillo/.test(c.CL.S().debtLog[0].t) ? null : 'la deuda no bajó lo pagado: ' + c.CL.debtTotal(),
    nocash: true },
  /* --- eventos: el precio está en la opción o en el texto del evento --- */
  'evento: parar y hacer estudios': {
    evento: ['injury_scare', 0], visible: (c, r) => precioEn(r.html, 'Hacer estudios cuesta'),
    efecto: c => null },
  'evento: campamento abierto en otro gimnasio': {
    evento: ['training_camp_invite', 0], visible: (c, r) => precioEn(r.html, 'Ir cuesta'),
    efecto: c => null },
  'evento: mudarte de urgencia': {
    evento: ['x2_house', 0], prep: c => { c.G.player.st.composure = 50; }, visible: (c, r) => precioEn(r.html, 'Mudarte de urgencia cuesta'),
    efecto: c => c.G.player.st.composure === 48 ? null : 'la mudanza no cuesta lo que dice (temple ' + c.G.player.st.composure + ')' },
  'evento: pelear en peso pactado': {
    evento: ['x9_weight', 1], prep: c => { enCamp(c); c.G.camp.i = c.G.camp.weeks - 1; }, visible: (c, r) => precioEn(r.html, 'multa del 25 % de la bolsa ('),
    efecto: c => {
      /* la multa ya se pagó: la liquidación no la cobra otra vez */
      const q = c.fightPayout({ purse: 8000, title: false }, true, { method: 'dec' });
      return !(q.lines || []).some(l => /no dar el peso/.test(l[0])) && c.G.camp.missWeight ? null : 'la liquidación cobra la multa otra vez';
    } },
  'evento: devolvérsela ahí mismo': {
    evento: ['x15_ambush', 0], prep: c => { enCamp(c); c.G.camp.pressDone = true; }, visible: (c, r) => precioEn(r.html, 'la comisión multa con'),
    efecto: c => null },
  'evento: invertir en el gimnasio (veterano)': {
    evento: ['story_veteran_legacy', 1], prep: c => { c.G.cash = 10000; }, visible: (c, r) => precioEn(r.html, 'Invertir en el gimnasio son'),
    efecto: c => c.G.flags.legacyGym ? null : 'la inversión no llegó al gimnasio',
    /* con menos plata que el precio, se cobra entero igual (el rojo va al descubierto, como todos los eventos) */
    nocash: true },
};

function auditarPago(nombre, def, seed){
  const c = carrera(seed);
  if(def.prep) def.prep(c);
  if(!def.nocash) c.G.cash = Math.max(c.G.cash, 1e6);
  let visible, pagado, semanas = 0;
  if(def.evento){
    const cash = c.G.cash;
    const r = evento(c, def.evento[0], def.evento[1]);
    visible = def.visible(c, r); pagado = cash - c.G.cash;
  } else {
    visible = def.visible(c);
    const cash = c.G.cash;
    semanas = sinSemana(c, () => def.pagar(c));
    pagado = cash - c.G.cash;
  }
  const prob = [];
  if(!(visible > 0)) prob.push('no se ve el precio antes de pagar (' + visible + ')');
  if(pagado !== visible) prob.push('muestra ' + visible + ' y cobra ' + pagado);
  if((def.semana || 0) !== semanas) prob.push('pasa ' + semanas + ' semana(s), promete ' + (def.semana || 0));
  const ef = def.efecto(c); if(ef) prob.push(ef);
  if(def.repetir !== undefined && !def.evento){
    const cash2 = c.G.cash, prev = visible;
    const v2 = def.repetir === 'siguiente' ? def.visible(c) : null;
    sinSemana(c, () => def.pagar(c));
    const p2 = cash2 - c.G.cash;
    if(def.repetir === 0 && p2 !== 0) prob.push('repetir cobra otra vez (' + p2 + ')');
    if(def.repetir === 'mismo' && p2 !== prev) prob.push('repetir cobra ' + p2 + ', no el mismo precio');
    if(def.repetir === 'siguiente' && p2 !== v2) prob.push('el siguiente nivel cobra ' + p2 + ' y muestra ' + v2);
  }
  return prob.map(x => nombre + ': ' + x);
}

suite('ECONOMIA-12 · contrato: lo que se paga fuera de la tienda', () => {
  test('cada pago: se ve el precio antes, se cobra exactamente eso, pasa lo prometido y no se cobra dos veces', () => {
    const malos = [];
    Object.keys(PAGOS).forEach((k, i) => { malos.push(...auditarPago(k, PAGOS[k], 30 + (i % 5))); });
    eq(malos.join('\n'), '', 'pagos que no cumplen');
  });

  test('las dos entradas de la mudanza son la misma: mismo precio, mismos efectos, en campamento no', () => {
    const run = (fn) => {
      const c = carrera(41); const p = c.G.player;
      const g = c.G.gyms.find(x => x.id !== p.gym && (x.a.strike > 75 || x.a.wrest > 75 || x.a.grap > 75));
      ok(g, 'no hay un gimnasio fuerte en algo');
      const pot0 = JSON.stringify(p.pot), cash = c.G.cash = 1e6;
      fn(c, g.id);
      return { gym: p.gym, pagado: cash - c.G.cash, pot: JSON.stringify(p.pot) !== pot0, coach: p.coach, msg: c.G.socOut && c.G.socOut.t };
    };
    const a = run((c, id) => c.gymJoin(id)), b = run((c, id) => c.changeGym(id));
    eq(JSON.stringify(b), JSON.stringify(a), 'las dos mudanzas no hacen lo mismo');
    ok(a.pot && /Tu techo sube en/.test(a.msg), 'mudarse a una casa fuerte no sube techos o no lo dice');
    const c = carrera(42); enCamp(c); c.G.cash = 1e6;
    const g = c.G.gyms.find(x => x.id !== c.G.player.gym), cash = c.G.cash;
    c.changeGym(g.id); eq(c.G.cash, cash, 'se cobró una mudanza en pleno campamento');
    ok(c.G.player.gym !== g.id, 'se mudó en pleno campamento por la otra puerta');
  });

  test('«no te aceptan si querés mudarte acá»: con reputación baja en esa casa no hay mudanza ni cobro', () => {
    const c = carrera(43); c.G.cash = 1e6;
    const g = c.G.gyms.find(x => x.id !== c.G.player.gym);
    c.CL.S().gymRep = c.CL.S().gymRep || {}; c.CL.S().gymRep[g.id] = 10;
    ok(c.CL.gymPerks(g.id).some(x => /no te aceptan/.test(x)), 'la regla no está escrita');
    const cash = c.G.cash; c.gymJoin(g.id);
    ok(c.G.player.gym !== g.id && c.G.cash === cash, 'te aceptaron o te cobraron igual');
    /* mirar la reputación de una casa no crea la entrada de una casa que no te conoce */
    const otra = c.G.gyms.find(x => x.id !== c.G.player.gym && x.id !== g.id);
    delete c.CL.S().gymRep[otra.id]; c.CL.gymRepOf(otra.id);
    ok(!(otra.id in c.CL.S().gymRep), 'leer la reputación creó una entrada');
  });

  test('la cuota por reputación: la regla que se cobra es la que se lee, una sola vez', () => {
    const c = carrera(44); const g = c.gymById(c.G.player.gym); c.CL.gymRep(g.id);
    [[80, 0.30, /30% más barata/], [60, 0.15, /15% más barata/], [40, 0, null], [20, -0.20, /20% más cara/]].forEach(([r, fm, re]) => {
      c.CL.S().gymRep[g.id] = r;
      eq(c.CL.gymFeeMod(r), fm, 'regla con ' + r);
      const perks = c.CL.gymPerks(g.id).join(' | ');
      if(re) ok(re.test(perks), 'con ' + r + ' la lista no dice ' + re + ': ' + perks);
      ok((perks.match(/cuota/g) || []).length <= 1, 'la lista dice dos cuotas: ' + perks);
      /* lo que devuelve (o cobra de más) la semana es lo que dice el desglose */
      c.CL.S().once.spendWeek = null; const a = c.G.cash; hook(c, 'week', 'economia').fn({});
      const linea = c.CL.weeklyLines().find(l => /reputación en el gimnasio/.test(l[0]));
      eq(c.G.cash - a, linea ? linea[1] : 0, 'con ' + r + ' la semana ajusta distinto de lo que muestra');
    });
  });

  test('el adelanto por quedarte sin plata es deuda de verdad y sale de la próxima bolsa; si no te lo dan, no hay plata', () => {
    /* con un adelanto reciente, las reglas de adelantos lo niegan: ni plata ni costo */
    const n = carrera(45); const nc = n.G.cash, nd = n.CL.debtTotal(), nr = n.G.player.rep;
    n.CL.S().lastAdvance = n.G.year * 52 + n.G.week;
    ok(/no te adelanta nada/.test(n.CL.EVH.cl_broke(2, {})) && n.G.cash === nc && n.CL.debtTotal() === nd && n.G.player.rep === nr, 'negado, igual dio plata o costó');
    const c = carrera(45); c.CL.S().lastAdvance = -999; const cash = c.G.cash, d0 = c.CL.debtTotal();
    const out = c.CL.EVH.cl_broke(2, {});
    const adv = c.G.cash - cash;
    ok(adv > 0, 'no hubo adelanto');
    eq(c.CL.debtTotal() - d0, adv, 'el adelanto no quedó como deuda');
    ok(/deuda/.test(out) && !('clAdvance' in c.G.flags), 'el texto no lo dice o sigue la marca vieja');
    const q = c.fightPayout({ purse: 20000, title: false }, true, { method: 'dec' });
    ok((q.lines || []).some(l => /Descuento de deuda/.test(l[0]) && l[1] < 0), 'la próxima bolsa no lo descuenta');
  });

  test('deuda: saldarla por cualquier camino levanta cobranzas; cobranzas no renegocia', () => {
    const vias = {
      bolsa: c => c.fightPayout({ purse: 900000, title: false }, true, { method: 'dec' }),
      evento: c => { c.G.cash = 1e6; c.CL.EVH.cl_debt(2, { owed: c.CL.debtTotal() }); },
      bolsillo: c => { c.G.cash = 1e6; c.CL.debtPayNow(); } };
    Object.keys(vias).forEach(k => {
      const c = carrera(46); const s = c.CL.S();
      deuda(c, 95000); c.CL.debtCeiling([]);
      eq(s.debtFrozen, 1, 'no pasó a cobranzas');
      const r0 = c.CL.debts().map(d => d.rate).join();
      ok(/Cobranzas no negocia/.test(c.CL.EVH.cl_debt(1, {})), 'cobranzas renegoció');
      eq(c.CL.debts().map(d => d.rate).join(), r0, 'cambió el interés en cobranzas');
      vias[k](c);
      eq(c.CL.debtTotal(), 0, k + ': no se saldó');
      eq(s.debtFrozen, 0, k + ': saldada, cobranzas sigue marcada');
    });
  });

  test('peso: no dar el peso en el pesaje cobra el 20 % en la liquidación; pagar la multa antes, el 25 % una sola vez', () => {
    const c = carrera(47); enCamp(c);
    c.G.camp.missWeight = true;
    const q = c.fightPayout({ purse: 8000, title: false }, true, { method: 'dec' });
    ok((q.lines || []).some(l => /no dar el peso/.test(l[0]) && l[1] < 0), 'el pesaje fallido no cobra la multa');
  });
});

suite('ECONOMIA-12 · los gastos de cada semana', () => {
  test('lo que muestran Finanzas y el hub es lo que se cobra en una semana real', () => {
    const c = carrera(50); const p = c.G.player;
    c.G.cash = 500000; c.clSetSpend('pro');
    const asist = c.G.coaches.find(x => x.id !== p.coach); c.hireCoach(asist.id);
    c.G.flags.chef = 1; c.G.flags.vault = 1; c.G.flags.bizIncome = 900;
    c.CL.gymRep(p.gym); c.CL.S().gymRep[p.gym] = 80;
    const lineas = c.CL.weeklyLines(), neto = c.CL.weeklyNet();
    ['Vida', 'Cuota de', 'Descuento por tu reputación', 'Equipo técnico', 'Plan de gasto profesional', 'Chef de campamento', 'Ingreso pasivo', 'Renta de la bóveda']
      .forEach(n => ok(lineas.some(l => l[0].indexOf(n) === 0), 'falta la línea ' + n + ': ' + JSON.stringify(lineas)));
    const hub = texto(c.CL.hubCards.find(x => x.id === 'finanzas').fn());
    lineas.forEach(l => ok(hub.indexOf(l[0]) >= 0, 'el hub no muestra ' + l[0]));
    const gastos = -lineas.reduce((a, l) => a + Math.min(0, l[1]), 0);
    eq(precioEn(pantalla(c, 'contracts'), 'Gastos semanales'), gastos, 'Finanzas muestra otro gasto');
    /* una semana real, sin peleas ni eventos */
    c.G.pending = []; const a = c.G.cash;
    c.advanceWeek(); c.G.pending = [];
    eq(Math.round(c.G.cash - a), neto, 'la semana movió ' + Math.round(c.G.cash - a) + ' y el desglose dice ' + neto);
  });

  test('el plan de gasto hace exactamente lo que dice, y no tiene campos que nadie lea', () => {
    const c = carrera(51);
    /* cada campo numérico de cada plan tiene lector en el código */
    const campos = new Set(); Object.values(c.CL.SPEND).forEach(S => Object.keys(S).forEach(k => { if(typeof S[k] === 'number') campos.add(k); }));
    eq([...campos].sort().join(), 'cost,rec,train', 'campos del plan');
    ok(/SPEND\[[^\]]+\]\.cost/.test(SRC) && /S\.rec\b/.test(SRC) && /S\.train\b/.test(SRC), 'un campo sin lector');
    Object.keys(c.CL.SPEND).forEach(k => {
      const S = c.CL.SPEND[k]; c.clSetSpend(k);
      /* recuperación semanal */
      c.CL.S().once.spendWeek = null; c.G.player.fatigue = 50; c.G.player.dmg = 50;
      hook(c, 'week', 'economia').fn({});
      ok(Math.abs((50 - c.G.player.fatigue) - S.rec * 6) < 1e-9 && Math.abs((50 - c.G.player.dmg) - S.rec * 3) < 1e-9, k + ': la recuperación no es la del plan');
      /* entrenamiento */
      const m = hook(c, 'train:mod', 'enfoque').fn(1, { act: 'box' });
      const m0 = (() => { const sp = c.CL.S().spend; c.CL.S().spend = 'normal'; const r = hook(c, 'train:mod', 'enfoque').fn(1, { act: 'box' }); c.CL.S().spend = sp; return r; })();
      ok(Math.abs((m - m0) - S.train) < 1e-9, k + ': el entrenamiento no es el del plan');
      /* y la pantalla lo dice con esos números */
      const fx = c.CL.spendFx(k);
      if(S.train) ok(fx.indexOf(Math.round(Math.abs(S.train) * 100) + ' %') >= 0, k + ': la pantalla no dice el entrenamiento: ' + fx);
      if(S.rec) ok(fx.indexOf(String(Math.round(Math.abs(S.rec * 6) * 10) / 10).replace('.', ',')) >= 0, k + ': la pantalla no dice la recuperación: ' + fx);
      const hub = texto(c.CL.hubCards.find(x => x.id === 'decisiones').fn());
      ok(hub.indexOf(fx) >= 0, k + ': el hub no muestra el efecto del plan');
    });
  });

  test('el equipo técnico: cobra lo que dice, y cada ayudante entrena y opina', () => {
    const c = carrera(52); const p = c.G.player, main = c.coachById(p.coach);
    const prios = c.coachRecs().map(r => r.prio);
    const esp = c.G.coaches.find(x => x.id !== p.coach && x.spec !== main.spec && x.spec !== 'mma' && x.q >= 70 && prios.indexOf((c.COACH_PHIL[x.spec] || c.COACH_PHIL.mma).prio) < 0);
    ok(esp, 'no hay un especialista distinto');
    const act = Object.keys(c.TRAIN).find(k => c.TRAIN[k].g === esp.spec);
    const q0 = c.trainQuality(act);
    ok(!c.coachRecs().some(r => r.name === esp.name), 'ya opinaba antes de contratarlo');
    c.hireCoach(esp.id);
    ok(c.trainQuality(act) > q0, 'el especialista no mejora su disciplina');
    ok(c.coachRecs().some(r => r.name === esp.name), 'el ayudante no opina en el plan');
    eq(precioEn(pantalla(c, 'gym'), 'Los ayudantes cobran aparte:'), Math.round(c.teamCost()), 'muestra otro sueldo');
    eq(c.teamCost(), 220 + esp.q * 6, 'el sueldo no es el de la regla');
    ok(c.CL.weeklyBurn() >= c.teamCost(), 'la semana no lo cobra');
  });
});

suite('ECONOMIA-12 · lo que el juego promete sobre plata dice la verdad', () => {
  test('ninguna previa promete una bolsa de PPV que no existe', () => {
    ['La bolsa por PPV sube', 'La bolsa por PPV se dispara', 'la más vendida del año', 'dos semanas de concentración', 'te dejó su número', 'quedó disponible para tu esquina']
      .forEach(t => ok(SRC.indexOf(t) < 0, 'sigue la promesa «' + t + '»'));
    /* y lo que sí dice, pasa: la previa caliente suma popularidad al terminar la pelea */
    const run = (heat) => { const c = carrera(53); enCamp(c); c.G.camp.pressHeat = heat; c.G.camp.i = c.G.camp.weeks; c.goFight();
      c.G.player.pop = 40; c.finishFight('ko', 'p'); c.applyPlayerFight(); return c.G.player.pop; };
    const frio = run(0), caliente = run(8);
    ok(caliente > frio, 'la previa caliente no suma popularidad: ' + frio + ' / ' + caliente);
    ok(/tu nombre sale ganando en popularidad/.test(SRC), 'la conferencia no dice lo que pasa');
  });

  test('«te conoce»: la visita y el campamento lo anotan en un solo registro, y el catálogo lo muestra', () => {
    const c = carrera(54); const co = c.G.coaches.find(x => x.id !== c.G.player.coach);
    ok(texto(pantalla(c, 'gym')).indexOf(co.name + ' ' + co.pers + ' te conoce') < 0, 'ya decía que te conoce');
    c.G.flags.coachSeen = { [co.id]: 1 };
    ok(texto(pantalla(c, 'gym')).indexOf(co.name + ' ' + co.pers + ' te conoce') >= 0, 'el catálogo no muestra quién te conoce');
    ok(!/p\.coaches\.push/.test(SRC), 'sigue el registro paralelo p.coaches');
    /* la visita pagada que termina con un coach mirándote lo anota (rama del 20 %) */
    const d = carrera(55); d.G.cash = 1e6; const g = d.G.gyms.find(x => x.id !== d.G.player.gym && d.gymCoaches(x.id).length);
    const r = d.rnd; d.rnd = () => 0.1;
    try{ sinSemana(d, () => d.gymVisit(g.id)); } finally { d.rnd = r; }
    ok(Object.keys(d.G.flags.coachSeen || {}).length === 1 && /ahora te conoce/.test(d.G.socOut.t), 'la visita no lo anotó: ' + d.G.socOut.t);
  });

  test('el equipo de contenido: cada campo de su estado tiene quien lo lea', () => {
    /* cada acción que toca el estado, por la vía del jugador, antes de mirar los campos */
    const c = carrera(56); c.G.cash = 1e6; c.buyItem('camera'); c.buyItem('mediahouse');
    c.contentBoost(); c.CL.contentProduce([]); c.contentDrop();
    c.CL.contentState().hype = 90; for(let i = 0; i < 30; i++) c.CL.contentProduce([]);
    const k = Object.keys(c.G.flags.content).sort();
    eq(k.join(), 'backlog,episodes,hype,level', 'campos del contenido');
    k.forEach(x => ok(new RegExp('\\bc\\.' + x + '\\b(?!\\s*[+-]?=(?!=))').test(SRC), 'nadie lee ' + x));
  });

  test('los estados que deja un pago tienen lector: ninguna marca económica escrita sin leer', () => {
    /* barrido: toda G.flags.X que se escribe tiene al menos una lectura que no sea la propia escritura */
    const esc = /G\.flags\.([A-Za-z_][A-Za-z0-9_]*)\s*(=|\+=|-=)(?!=)/g, huerf = [];
    const claves = new Set(); let m; while((m = esc.exec(SRC))) claves.add(m[1]);
    claves.forEach(k => {
      const re = new RegExp('(flags\\.|\\bf\\.|flags\\[\'|flags&&G\\.flags\\.)' + k + '(?![A-Za-z0-9_])', 'g'); let x, lee = false;
      while((x = re.exec(SRC))){
        const resto = SRC.slice(x.index + x[0].length, x.index + x[0].length + 4);
        if(/^\s*(=|\+=|-=)(?!=)/.test(resto) || /^'\]\s*=(?!=)/.test(resto)) continue;             /* escritura */
        const linea = SRC.slice(SRC.lastIndexOf('\n', x.index) + 1, x.index);
        if(new RegExp('flags\\.' + k + '\\s*=(?!=)').test(linea)) continue;                       /* se lee para escribirse */
        lee = true; break;
      }
      if(!lee) huerf.push(k);
    });
    /* las que quedan, clasificadas (dev/ECONOMIA-AUDITORIA.md): ninguna es de un pago */
    const NO_ECONOMICAS = ['brawler', 'eliteCampWeek', 'late', 'lockDiv', 'lockGym', 'mgrIgnored', 'needCheapGym', 'scouted', 'turnedDown', 'viral'];
    eq(huerf.sort().join(), NO_ECONOMICAS.sort().join(), 'marcas escritas sin lector');
  });
});

suite('ECONOMIA-12 · guardar y cargar', () => {
  test('cada servicio conectado sobrevive a guardar y cargar, sigue actuando y no se vuelve a cobrar', () => {
    let c = carrera(60); const p = c.G.player; c.G.cash = 2e6;
    c.clSetSpend('allin');
    c.requestGameplayUpgrade();
    const g = c.G.gyms.find(x => x.id !== p.gym && (x.a.wrest > 75 || x.a.strike > 75 || x.a.grap > 75)); c.gymJoin(g.id);
    const f = rival(c); sinSemana(c, () => c.watchFight(f.id));
    c.G.flags.shop.camera = 1; c.contentBoost();
    deuda(c, 99000); c.CL.debtCeiling([]);
    const co = c.G.coaches.find(x => x.id !== p.coach); c.G.flags.coachSeen = { [co.id]: 1 };
    const antes = JSON.stringify({ spend: c.CL.S().spend, lv: c.G.gameplayLevel, gym: p.gym, pot: p.pot, intel: c.G.soc.intel, hype: c.G.flags.content.hype,
      deuda: c.CL.debtTotal(), frozen: c.CL.S().debtFrozen, conoce: c.G.flags.coachSeen });
    c = recargar(c);
    const q = c.G.player;
    eq(JSON.stringify({ spend: c.CL.S().spend, lv: c.G.gameplayLevel, gym: q.gym, pot: q.pot, intel: c.G.soc.intel, hype: c.G.flags.content.hype,
      deuda: c.CL.debtTotal(), frozen: c.CL.S().debtFrozen, conoce: c.G.flags.coachSeen }), antes, 'algo no sobrevivió');
    /* siguen actuando */
    c.CL.S().once.spendWeek = null; q.fatigue = 50; hook(c, 'week', 'economia').fn({});
    ok(Math.abs((50 - q.fatigue) - c.CL.SPEND.allin.rec * 6) < 1e-9, 'el plan dejó de actuar');
    ok(texto(pantalla(c, 'social', f.id)).indexOf('Le detectaste') >= 0, 'lo que le leíste dejó de verse');
    ok(texto(pantalla(c, 'gym')).indexOf('te conoce') >= 0, '«te conoce» dejó de verse');
    ok(/Cobranzas no negocia/.test(c.CL.EVH.cl_debt(1, {})), 'cobranzas se perdió al cargar');
    ok(c.CL.weeklyLines().some(l => /Plan de gasto todo adentro/.test(l[0])), 'el desglose no ve el plan');
    /* no se vuelve a cobrar lo que ya está hecho */
    const cash = c.G.cash; c.gymJoin(q.gym); c.clSetSpend('allin');
    eq(c.G.cash, cash, 'cobró de nuevo algo ya hecho');
    eq(c.gameplayLevel(), 1, 'el nivel de experiencia se perdió o se duplicó');
  });

  test('la multa del peso pactado ya pagada sigue pagada después de cargar', () => {
    let c = carrera(61); enCamp(c); c.G.camp.i = c.G.camp.weeks - 1;
    evento(c, 'x9_weight', 1);
    c = recargar(c);
    const q = c.fightPayout({ purse: 8000, title: false }, true, { method: 'dec' });
    ok(c.G.camp.missWeight && c.G.camp.missFinePaid && !(q.lines || []).some(l => /no dar el peso/.test(l[0])), 'después de cargar la cobra otra vez');
  });
});

suite('ECONOMIA-12 · sin azar nuevo', () => {
  test('los cambios de la fase no tiran el dado', () => {
    const c = carrera(62); c.G.cash = 1e6;
    eq(contarAzar(c, () => { c.CL.weeklyLines(); c.CL.weeklyNet(); c.CL.spendFx('pro'); c.CL.gymPerks(c.G.player.gym); c.CL.gymRepOf('gym3'); pantalla(c, 'gym'); pantalla(c, 'contracts'); }), 0, 'leer o dibujar tira el dado');
    deuda(c, 1000); c.CL.S().lastAdvance = -999;
    eq(contarAzar(c, () => { c.CL.debtApply(500); c.CL.EVH.cl_broke(2, {}); }), 0, 'la deuda tira el dado');
    const g = c.G.gyms.find(x => x.id !== c.G.player.gym);
    eq(contarAzar(c, () => c.gymJoin(g.id)), 0, 'la mudanza tira el dado');
  });
});
