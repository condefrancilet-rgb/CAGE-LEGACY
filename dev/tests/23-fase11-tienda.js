'use strict';
/* FASE 11 — LO QUE SE COMPRA, CUMPLE LO QUE PROMETE
   ---------------------------------------------------------------------------
   Contrato de la tienda: toda compra que promete algo tiene que tener quién lo
   cumpla. Para CADA artículo (tienda, patrimonio e inversiones) el contrato
   dice qué estado deja la compra y quién lo lee, y lo que se prueba no es que
   «el botón compra», sino que la compra cambia el mundo que promete cambiar:
   se mide la consecuencia antes y después de comprar, con el consumidor real.

   Tres clases, y el auditor las distingue:
     · compra con consumidor   compra → estado → lector → efecto   (pasa)
     · marca contable          compra → estado, documentada con su razón (pasa)
     · compra rota             compra → estado → nada               (FALLA)   */
const { suite, test, ok, eq } = require('../run-tests.js');
const H = require('../harness.js');
const fs = require('node:fs');
const path = require('node:path');

const ARCHIVO = process.env.CAGE_FILE || undefined;
const SRC = fs.readFileSync(ARCHIVO || path.join(__dirname, '..', '..', 'index-4-blindado.html'), 'utf8');
const LINEAS = SRC.split('\n');
const TESTS = path.join(__dirname);

function carrera(seed){
  const h = H.boot({ seed, file: ARCHIVO });
  H.startCareer(h, { metaSeed: 9990 + seed, style: 'mma', div: 'LW', age: 22 });
  const c = h.ctx;
  const co = c.G.offers.find(o => o.type === 'contract' && c.G.orgs[o.org]);
  c.negoStart(co); c.negoClose(); c.G.mg = null; c.UI.screen = 'hub'; c.G.pending = [];
  return c;
}
const hook = (c, evt, id) => (c.HOOKS[evt] || []).find(x => x.id === id);
const semana = (c, id) => hook(c, 'week', id).fn({ news: [] });
const texto = h => String(h).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
function rival(c){
  const p = c.G.player;
  return Object.values(c.G.fighters).find(f => f && !f.isPlayer && f.div === p.div && !c.fightSpecProblem({ oppId: f.id, org: p.org }));
}
function enCamp(c){
  const o = rival(c);
  ok(c.scheduleFight({ oppId: o.id, org: c.G.player.org, weeks: 8, title: false, purse: 5000, event: 'T' }, 'prueba').ok, 'no se firmó');
  ok(c.startCamp(c.G.nextFight), 'no arrancó el camp');
  c.G.pending = [];
  return o;
}
/* ¿consumió azar? el juego tira con su propio estado (G.rs) */
function contarAzar(c, fn){ const rs0 = c.G.rs; fn(); return c.G.rs === rs0 ? 0 : 1; }

/* ---------- compras: tienda, patrimonio, inversiones ---------- */
const EG = { apt: 'props', villa: 'props', estate: 'props', 'eg:driver': 'vehicles', jet: 'vehicles',
             gym_upgrade: 'projects', 'eg:academy': 'projects', fund: 'projects' };
const INV = { 'inv:media': 'media', 'inv:tech': 'tech', 'inv:realestate': 'realestate' };
/* precios del patrimonio (ENDGAME es local al módulo: la pantalla los muestra) */
const PRECIO = { apt: 150000, villa: 500000, estate: 1500000, 'eg:driver': 90000, jet: 750000, gym_upgrade: 350000,
                 'eg:academy': 900000, fund: 250000, 'inv:media': 250000, 'inv:tech': 500000, 'inv:realestate': 1000000 };
const precio = (c, id) => PRECIO[id] != null ? PRECIO[id] : c.SHOP.find(i => i.id === id).p;
function comprar(c, id){
  c.G.cash = Math.max(c.G.cash, 5e6);
  if(EG[id]) return c.egBuy(EG[id], id.replace('eg:', ''));
  if(INV[id]) return c.egInvest(INV[id]);
  c.buyItem(id); return true;
}
/* lo que una compra puede dejar escrito y persistente */
function foto(c){
  const f = c.G.flags || {}, e = c.G.endgame || { owned: {}, projects: {}, investments: [] }, o = {};
  Object.keys(f).forEach(k => { if(k !== 'shop') o['flags.' + k] = JSON.stringify(f[k]); });
  Object.keys(e.owned || {}).forEach(k => { o['owned.' + k] = JSON.stringify(e.owned[k]); });
  Object.keys(e.projects || {}).forEach(k => { o['projects.' + k] = JSON.stringify(e.projects[k]); });
  o.investments = JSON.stringify(e.investments || []);
  return o;
}
const escritas = (a, b) => Object.keys(b).filter(k => a[k] !== b[k]);
/* ¿hay en el código alguien que LEA esta clave? (una línea que la lee y no la escribe) */
function lectores(clave){
  const [dom, k] = clave.split('.');
  if(dom === 'investments') return LINEAS.map((l, i) => /e\.investments\.forEach/.test(l) ? i + 1 : 0).filter(Boolean);
  const pat = dom === 'flags'
    ? new RegExp("(flags(\\.|\\[')|\\bf\\.)" + k + "(?![A-Za-z0-9_])('\\])?(?!\\s*=[^=])")
    : new RegExp('(' + dom + '\\.' + k + '(?![A-Za-z0-9_])(?!\\s*=[^=])|' + dom + "\\[id\\]|egOwns\\('" + k + "'\\))");
  const esc = dom === 'flags' ? new RegExp("flags\\." + k + "\\s*=[^=]") : null;
  const out = [];
  LINEAS.forEach((l, i) => { if(pat.test(l) && !(esc && esc.test(l))) out.push(i + 1); });
  return out;
}
/* EL AUDITOR: compra, mira qué quedó escrito, exige que cada clave tenga
   dueño (consumidor con lector y efecto medido, o marca documentada). */
function auditar(c, id, def){
  const prob = [];
  if(!def) return ['«' + id + '» no está en el contrato: una compra sin clasificar'];
  if(def.prep) def.prep(c);
  let escr = null;
  const compra = () => {
    c.G.cash = Math.max(c.G.cash, 5e6);
    const a = foto(c), cash = c.G.cash; const r = comprar(c, id); escr = escritas(a, foto(c));
    if(r === false) prob.push(id + ': la compra no se hizo');
    else if(cash - c.G.cash !== precio(c, id)) prob.push(id + ': cobró ' + (cash - c.G.cash) + ' y el precio es ' + precio(c, id));
  };
  let efecto = null;
  try{ efecto = def.efecto(c, compra); } catch(e){ efecto = 'la medición reventó: ' + e.message; }
  if(escr === null) prob.push(id + ': la sonda no compró');
  if(efecto) prob.push(id + ': ' + efecto);
  (escr || []).forEach(k => {
    if((def.lee || []).indexOf(k) < 0 && !(def.marcas || {})[k])
      prob.push(id + ': escribe ' + k + ' y nadie la reclama (compra rota)');
  });
  (def.lee || []).forEach(k => {
    if(escr && escr.indexOf(k) < 0) prob.push(id + ': el contrato dice que consume ' + k + ' pero la compra no lo escribe');
    if(!lectores(k).length) prob.push(id + ': nadie lee ' + k + ' en el código');
  });
  Object.keys(def.marcas || {}).forEach(k => {
    if(!(def.marcas[k] && def.marcas[k].length > 20)) prob.push(id + ': la marca ' + k + ' no documenta por qué no necesita consumidor');
  });
  return prob;
}

/* ---------- mediciones reutilizables ---------- */
const ruta = (o, p) => p.split('.').reduce((x, k) => x == null ? x : x[k], o);
/* efecto inmediato: los campos del jugador cambian EXACTAMENTE lo prometido */
const inm = (cambios, extra) => (c, compra) => {
  const p = c.G.player, antes = {};
  Object.keys(cambios).forEach(k => { antes[k] = Number(ruta(p, k)); });
  compra();
  for(const k of Object.keys(cambios)){
    const d = Number(ruta(p, k)) - antes[k], w = cambios[k];
    if(Math.abs(d - w) > 1e-6) return k + ' cambió ' + d + ', la descripción promete ' + w;
  }
  return extra ? extra(c) : null;
};
/* multiplica el ritmo de aprendizaje de esas claves por r */
const ritmo = (claves, r) => (c, compra) => {
  const lr = c.G.player.lr, antes = {}; claves.forEach(k => { antes[k] = lr[k]; });
  compra();
  for(const k of claves){ const e = c.cap(antes[k] * r); if(lr[k] !== e) return 'ritmo de ' + k + ': ' + antes[k] + ' → ' + lr[k] + ' (promete ' + e + ')'; }
  return null;
};
/* desbloquea una actividad: el hub y la tienda la ofrecen */
const actividad = (mg, resto) => (c, compra) => {
  const hub0 = c.hookFilter('screen:shop', c.scrShop(), {});
  if(hub0.indexOf("fameStart('" + mg + "')") >= 0) return 'la actividad ya estaba antes de comprar';
  const r = resto ? resto(c, compra) : (compra(), null);
  if(r) return r;
  const shop = c.scrShop();
  if(shop.indexOf("fameStart('" + mg + "')") < 0) return 'la tienda no ofrece la actividad ' + mg + ' después de comprarla';
  if(!c.FX_GAMES[mg] || !c.FAME_INFO[mg]) return 'la actividad ' + mg + ' no existe';
  return null;
};
/* ingreso semanal: shopWeekly paga exactamente eso más */
const ingreso = (monto) => (c, compra) => {
  let a = c.G.cash; semana(c, 'shopWeekly'); const sin = c.G.cash - a;
  compra();
  a = c.G.cash; semana(c, 'shopWeekly'); const con = c.G.cash - a;
  return con - sin === monto ? null : 'la semana paga ' + (con - sin) + ' más, promete ' + monto;
};
function multaPeso(c){
  const p = c.G.player, o = rival(c);
  c.G.nextFight = { oppId: o.id, weeks: 0, org: p.org, title: false, purse: 10000, event: 'T' };
  c.startCamp(c.G.nextFight); c.G.camp.missWeight = true;
  const q = c.fightPayout({ purse: 10000, title: false }, true, { method: 'ko' });
  const l = (q.lines || []).find(x => String(x[0]).indexOf('no dar el peso') >= 0);
  c.G.camp = null; c.G.nextFight = null;
  return l ? Math.abs(l[1]) : NaN;
}
function danoTrasPelea(c){
  const p = c.G.player, o = rival(c);
  c.G.nextFight = { oppId: o.id, weeks: 0, org: p.org, title: false, purse: 8000, event: 'T' };
  c.startCamp(c.G.nextFight); c.G.camp.i = c.G.camp.weeks; c.goFight();
  c.G.fight.p.hp = 40; p.dmg = 0;
  c.finishFight('ko', 'p'); c.applyPlayerFight();
  return p.dmg;
}
function pidoAumento(c){
  /* sin azar: la tirada queda fija justo entre el umbral con abogado y sin él */
  const g = c.gauss, fl = c.fighterLeverage;
  c.gauss = () => 0; c.fighterLeverage = () => 38;
  const m = c.mgrById(c.G.mgId); m.a.net = 50;
  c.G.contract.left = 3; c.G.contract.purse = 1000;
  c.G.flags.raiseAsks = 0; c.G.flags.raiseYear = -99;
  try{ c.askManagerRaise(); } finally { c.gauss = g; c.fighterLeverage = fl; }
  return c.G.contract.purse;
}
const egTick = c => semana(c, 'endgame');
function fatigaEg(c){ const p = c.G.player; p.fatigue = 50; p.dmg = 50; egTick(c); return { fat: 50 - p.fatigue, dmg: 50 - p.dmg }; }
function callado(c){
  return Object.values(c.G.fighters).find(f => f && !f.isPlayer && f.active && !f.retired && !f.inj && f.pers === 'quiet' && f.pers2 !== 'charisma' && c.persW(f, 'accept') < 1);
}
function prensa(c, picks){
  c.pressStart();
  (picks || [0, 0, 0, 0]).forEach(i => c.pressPick(i));
  return c.G.mg;
}
function estrella(c, tier){
  /* fixture: la organización del jugador pasa a ser una liga grande y dos de
     su división venden (pop > 50): las mismas condiciones que la coestelar.
     Dos, para que «el que más vende» no sea el único posible. */
  const p = c.G.player, org = c.G.orgs[p.org]; org.tier = tier == null ? 3 : tier; p.pop = 60;
  const aptos = org.roster.map(c.F).filter(f => f && f.div === p.div && !f.isPlayer && f.active && !f.inj && !f.retired && !c.fightSpecProblem({ oppId: f.id, org: p.org }));
  aptos.forEach(f => { if(c.clN(f.pop) > 50) f.pop = 40; });
  aptos[0].pop = 70; aptos[1].pop = 80;          /* el más vendedor NO es el primero del plantel */
  return aptos[1];
}
function ofertas(c){ c.G.offers = c.G.offers.filter(o => o.type !== 'fight'); c.hookEmit('offers:made', {}); return c.G.offers.filter(o => o.docMade); }

/* ==========================================================================
   EL CONTRATO: cada artículo, con quién cumple lo que promete
   ========================================================================== */
const MARCA_TIENDA = 'la cuenta de compras (G.flags.shop) la lee shopCan: impide recomprar lo que es de una vez y muestra ×n';
const CONTRATO = {
  /* --- tienda base --- */
  physio:   { tipo: 'inmediato', prep: c => { c.G.player.dmg = 50; c.G.player.fatigue = 50; }, efecto: inm({ dmg: -25, fatigue: -15 }) },
  cryo:     { tipo: 'inmediato', prep: c => { c.G.player.fatigue = 50; c.G.player.st.recovery = 50; }, efecto: inm({ fatigue: -35, 'st.recovery': 2 }) },
  surgery:  { tipo: 'inmediato', prep: c => { c.G.player.inj = 'x'; c.G.player.injWeeks = 4; c.G.player.dmg = 40; },
              efecto: inm({ dmg: -20 }, c => c.G.player.inj === null && c.G.player.injWeeks === 0 ? null : 'la lesión sigue') },
  nutri:    { tipo: 'consumidor', lee: ['flags.nutri'],
              efecto: (c, compra) => { const sin = multaPeso(c); compra(); const con = multaPeso(c);
                return con * 2 === sin ? null : 'la multa por no dar el peso no bajó a la mitad: ' + sin + ' → ' + con; } },
  strength: { tipo: 'consumidor', lee: ['flags.pf'],
              efecto: (c, compra) => { const m0 = { act: 'str', bonus: 0 }; hook(c, 'train:adjust', 'tienda').fn(m0);
                const r = ritmo(['power', 'cardio', 'toughness', 'recovery'], 1.08)(c, compra); if(r) return r;
                const m1 = { act: 'str', bonus: 0 }; hook(c, 'train:adjust', 'tienda').fn(m1);
                return m0.bonus === 0 && Math.abs(m1.bonus - 0.08) < 1e-9 ? null : 'la sesión de fuerza no rinde +8 %'; } },
  psych:    { tipo: 'inmediato', prep: c => { c.G.player.st.composure = 50; c.G.player.st.confidence = 50; }, efecto: inm({ 'st.composure': 6, 'st.confidence': 4 }) },
  analyst:  { tipo: 'consumidor', lee: ['flags.analyst'], prep: c => { c.G.player.st.fightiq = 50; },
              efecto: (c, compra) => { const a = c.CMB.confOf('video'); compra(); const b = c.CMB.confOf('video');
                return a === 0 && b === 2 ? null : 'el video no pasó a ser una fuente de lectura: ' + a + ' → ' + b; } },
  pr:       { tipo: 'consumidor', lee: ['flags.pr'], prep: c => { c.G.player.pop = 40; },
              efecto: (c, compra) => { const l = q => (q.lines || []).some(x => /Agente de prensa/.test(x[0]));
                const a = l(c.fightPayout({ purse: 10000, title: false }, true, { method: 'ko' })); compra();
                const b = l(c.fightPayout({ purse: 10000, title: false }, true, { method: 'ko' }));
                if(!(!a && b)) return 'la victoria no paga el extra del agente de prensa';
                return c.G.player.pop === 50 ? null : 'no dio +10 de popularidad'; } },
  camera:   { tipo: 'consumidor', lee: ['flags.content'],
              efecto: (c, compra) => { const b0 = c.CL.contentState().backlog; semana(c, 'content'); const b1 = c.G.flags.content.backlog;
                compra(); semana(c, 'content'); const b2 = c.G.flags.content.backlog;
                return b1 === b0 && b2 === b1 + 1 ? null : 'el equipo de contenido no produce: ' + [b0, b1, b2]; } },
  lawyer:   { tipo: 'consumidor', lee: ['flags.lawyer'],
              efecto: (c, compra) => { const sin = pidoAumento(c); compra(); const con = pidoAumento(c);
                return sin === 1000 && con > 1000 ? null : 'el abogado no mueve la negociación: ' + sin + ' / ' + con; } },
  car:      { tipo: 'inmediato', prep: c => { c.G.player.st.confidence = 50; }, efecto: inm({ 'st.confidence': 5 }) },
  house:    { tipo: 'inmediato', prep: c => { c.G.player.st.composure = 50; c.G.player.st.confidence = 50; }, efecto: inm({ 'st.composure': 10, 'st.confidence': 6 }) },
  family:   { tipo: 'inmediato', prep: c => { Object.assign(c.G.player.st, { composure: 50, discipline: 50, patience: 50 }); }, efecto: inm({ 'st.composure': 8, 'st.discipline': 6, 'st.patience': 5 }) },
  privgym:  { tipo: 'inmediato', prep: c => { c.STKEY.forEach(k => { c.G.player.lr[k] = 50; }); }, efecto: (c, compra) => ritmo(c.STKEY.slice(), 1.10)(c, compra) },
  sparteam: { tipo: 'inmediato', prep: c => { Object.assign(c.G.player.st, { timing: 50, defense: 50, fightiq: 50 }); }, efecto: inm({ 'st.timing': 4, 'st.defense': 4, 'st.fightiq': 4 }) },
  cutman:   { tipo: 'consumidor', lee: ['flags.cutman'],
              efecto: (c, compra) => { const sin = danoTrasPelea(carrera(4701)); compra(); const o = carrera(4701); comprar(o, 'cutman'); const con = danoTrasPelea(o);
                return con < sin ? null : 'el cutman no reduce el daño acumulado: ' + sin + ' → ' + con; } },
  /* --- tienda extendida --- */
  cryoroom:   { tipo: 'actividad', prep: c => { c.G.player.st.recovery = 50; }, efecto: actividad('cryoflow', inm({ 'st.recovery': 3 })) },
  masseur:    { tipo: 'consumidor', lee: ['flags.masseur'],
                efecto: (c, compra) => { const f = () => { c.G.player.fatigue = 50; semana(c, 'shopWeekly'); return 50 - c.G.player.fatigue; };
                  const a = f(); compra(); const b = f(); return a === 0 && b === 5 ? null : 'el masajista no baja 5 de fatiga por semana: ' + a + ' / ' + b; } },
  sleeplab:   { tipo: 'inmediato', prep: c => { c.G.player.st.recovery = 50; c.G.player.st.composure = 50; }, efecto: inm({ 'st.recovery': 5, 'st.composure': 4 }) },
  lightboard: { tipo: 'actividad', prep: c => { c.G.player.st.speed = 50; }, efecto: actividad('reactwall', inm({ 'st.speed': 2 })) },
  vrrig:      { tipo: 'actividad', prep: c => { c.G.player.st.fightiq = 50; }, efecto: actividad('vrspar', inm({ 'st.fightiq': 3 })) },
  forceplate: { tipo: 'inmediato', prep: c => { ['power', 'speed', 'footwork'].forEach(k => { c.G.player.lr[k] = 50; }); }, efecto: ritmo(['power', 'speed', 'footwork'], 1.10) },
  altitude:   { tipo: 'inmediato', prep: c => { c.G.player.st.cardio = 50; c.G.player.st.toughness = 50; }, efecto: inm({ 'st.cardio': 6, 'st.toughness': 3 }) },
  studio:     { tipo: 'actividad', prep: c => { c.G.player.pop = 40; }, efecto: actividad('stream', inm({ pop: 5 })) },
  stylist:    { tipo: 'consumidor', lee: ['flags.stylist'], prep: c => { c.G.player.pop = 40; },
                efecto: (c, compra) => {
                  const ap = kind => { c.G.mg = { type: kind, log: [] }; const a = c.G.player.pop; c.hookEmit('media:done', { kind, tones: [] }); const d = c.G.player.pop - a; const l = c.G.mg.log.join(' '); c.G.mg = null; return { d, l }; };
                  const s0 = ap('press'); const r = inm({ pop: 8 })(c, compra); if(r) return r;
                  const s1 = ap('press'), s2 = ap('pod');
                  if(!(s0.d === 0 && s1.d === c.SHOPX.STYLIST_POP && s2.d === c.SHOPX.STYLIST_POP)) return 'las apariciones en prensa no rinden más: ' + [s0.d, s1.d, s2.d];
                  return /Estilista/.test(s1.l) ? null : 'la aparición no dice por qué rindió más';
                } },
  sponsor:    { tipo: 'consumidor', lee: ['flags.sponsorW'], prep: c => { c.G.player.pop = 60; }, efecto: ingreso(420) },
  investdesk: { tipo: 'actividad', efecto: actividad('invest') },
  ownGym:     { tipo: 'consumidor', lee: ['flags.bizIncome'], prep: c => { c.STKEY.forEach(k => { c.G.player.lr[k] = 50; }); },
                efecto: (c, compra) => { let r = null; const i = ingreso(900)(c, () => { r = ritmo(c.STKEY.slice(), 1.08)(c, compra); }); return r || i; } },
  restaurant: { tipo: 'consumidor', lee: ['flags.bizIncome'], prep: c => { c.G.player.pop = 40; },
                efecto: (c, compra) => {
                  const i = ingreso(520)(c, compra); if(i) return i;
                  if(c.G.player.pop !== 46) return 'no dio +6 de popularidad';
                  enCamp(c); c.G.camp.sharp = 40; hook(c, 'camp:week:post', 'restaurante').fn({});
                  return Math.abs(c.G.camp.sharp - (40 - c.SHOPX.REST_SHARP)) < 1e-9 && /restaurante/.test(c.G.camp.log[0]) ? null : 'el restaurante no distrae en el camp';
                } },
  academy:    { tipo: 'consumidor', lee: ['flags.bizIncome'], prep: c => { c.G.player.rep = 40; c.G.player.st.patience = 50; },
                efecto: (c, compra) => { const i = ingreso(260)(c, compra); if(i) return i;
                  return c.G.player.rep === 50 && c.G.player.st.patience === 55 ? null : 'no dio +10 de reputación y +5 de paciencia'; } },
  /* --- extras de la tienda --- */
  recoverylab:   { tipo: 'consumidor', lee: ['flags.recoveryLab'], prep: c => { c.G.player.st.recovery = 50; },
                   efecto: (c, compra) => { const a = c.recPhysioCost(); compra(); const b = c.recPhysioCost();
                     return a === 1200 && b === 600 ? null : 'la fisio entre camps no cuesta la mitad: ' + a + ' → ' + b; },
                   ref: '10-bugs-abiertos.js' /* entre rounds */ },
  elitecamp:     { tipo: 'consumidor', lee: ['flags.eliteCampAt', 'flags.eliteCampBoost'],
                   marcas: { 'flags.eliteCampWeek': 'semana suelta del camp de élite: se rompía al cambiar de año y la ventana se mide con eliteCampAt (fase RPG); queda escrita para partidas viejas' },
                   efecto: (c, compra) => { const f = hook(c, 'train:mod', 'campElite').fn; const a = f(1); compra(); const b = f(1);
                     return a === 1 && Math.abs(b - 1.12) < 1e-9 ? null : 'el camp de élite no mejora la calidad: ' + a + ' → ' + b; } },
  nutritionchef: { tipo: 'consumidor', lee: ['flags.chef'],
                   efecto: (c, compra) => { enCamp(c); const f = () => { c.G.camp.fatigue = 50; c.G.player.weightNow = c.DIVS[c.G.player.div].lb + 1; hook(c, 'camp:week:post', 'tienda2').fn({}); return 50 - c.G.camp.fatigue; };
                     const a = f(); compra(); const b = f(); return a === 0 && b === 2 ? null : 'el chef no baja el desgaste del camp: ' + a + ' / ' + b; } },
  mediahouse:    { tipo: 'consumidor', lee: ['flags.content'], prep: c => { c.G.flags.shop.camera = 1; },
                   efecto: (c, compra) => { const s = c.CL.contentState(); const h = () => { s.hype = 10; c.CL.contentProduce([]); return s.hype - 10; };
                     const a = h(); compra(); const b = h(); return s.level >= 2 && b > a ? null : 'el estudio no hace rendir más cada producción: ' + a + ' → ' + b; } },
  documentary:   { tipo: 'consumidor', lee: ['flags.docAt', 'flags.docUsed', 'flags.content'], prep: c => { c.G.flags.shop.camera = 1; c.G.player.rec.w = 8; },
                   /* fase 14: la coestelar AL AZAR de CL.extraOffers (chance .28) hace esperar al
                      documental, como está escrito; con el mundo nuevo la semilla de esta fila la
                      sacaba (con la vieja pasaba lo mismo en la semilla 5). El documental no tira
                      el dado: se apaga el azar ajeno para medir sólo lo que promete la compra. */
                   efecto: (c, compra) => { const sinAzar = (fn) => { const ch = c.chance; c.chance = () => false; try{ return fn(); } finally { c.chance = ch; } };
                     const st = estrella(c); const a = sinAzar(() => ofertas(c)).length; compra(); const b = sinAzar(() => ofertas(c));
                     if(!(a === 0 && b.length === 1 && b[0].oppId === st.id)) return 'el documental no abre la coestelar: ' + a + ' / ' + b.length;
                     return c.G.flags.docUsed && sinAzar(() => ofertas(c)).length === 0 ? null : 'un documental abre más de una pelea'; } },
  coachcamp:     { tipo: 'consumidor', lee: ['flags.teamCamp'], ref: '16-rpg-accesos.js',
                   efecto: (c, compra) => { compra(); return typeof c.teamCampActive === 'function' ? null : 'no existe el lector'; } },
  videoWall:     { tipo: 'consumidor', lee: ['flags.videoWall'], prep: c => { c.G.player.st.fightiq = 50; },
                   efecto: (c, compra) => { const a = c.CMB.confOf('video'); compra(); const b = c.CMB.confOf('video');
                     return a === 0 && b === 3 ? null : 'la sala de análisis no es la mejor fuente de video: ' + a + ' → ' + b; } },
  driver:        { tipo: 'consumidor', lee: ['flags.driver'],
                   efecto: (c, compra) => { enCamp(c); c.G.nextFight.weeks = 2;
                     const f = () => { c.G.player.fatigue = 50; semana(c, 'luxury'); return 50 - c.G.player.fatigue; };
                     const a = f(); compra(); const b = f(); return a === 0 && b === 2 ? null : 'el chofer no baja la fatiga de las semanas de pelea: ' + a + ' / ' + b; } },
  penthouse:     { tipo: 'consumidor', lee: ['flags.penthouse'], ref: '10-bugs-abiertos.js', prep: c => { c.G.player.st.composure = 50; c.G.player.pop = 40; },
                   efecto: inm({ 'st.composure': 7, pop: 4 }) },
  legacygym:     { tipo: 'consumidor', lee: ['flags.legacyGym'], prep: c => { c.G.player.rep = 40; },
                   efecto: (c, compra) => { const k0 = c.RPG.legacyProfile().k; compra(); const k1 = c.RPG.legacyProfile().k;
                     const r = c.G.player.rep; semana(c, 'luxury');
                     return k0 !== 'constructor' && k1 === 'constructor' && Math.abs(c.G.player.rep - r - 0.5) < 1e-9 ? null : 'el gimnasio comunitario no cuenta en el legado o no suma reputación'; } },
  vault:         { tipo: 'consumidor', lee: ['flags.vault'],
                   marcas: { 'flags.vaultCash': 'valor del patrimonio guardado en la bóveda: no se gasta ni se retira (así lo describe la compra); es contable y se MUESTRA en Patrimonio y legado' },
                   efecto: (c, compra) => { const r = () => { const a = c.G.cash; semana(c, 'luxury'); return c.G.cash - a; };
                     const a = r(); compra(); c.CL.S().once.vaultIncome = null; const b = r();
                     if(!(a === 0 && b === c.VAULT_RENT)) return 'la bóveda no rinde su renta: ' + a + ' / ' + b;
                     return texto(c.CL.SCREENS.endgame.fn()).indexOf(texto(c.money(375000))) >= 0 ? null : 'el patrimonio guardado no se ve en ningún lado'; } },
  /* --- patrimonio --- */
  apt:           { tipo: 'consumidor', lee: ['owned.apt'],
                   efecto: (c, compra) => { const a = fatigaEg(c); compra(); const b = fatigaEg(c); return a.fat === 0 && b.fat === 1 ? null : 'el departamento no baja 1 de fatiga por semana: ' + b.fat; } },
  villa:         { tipo: 'consumidor', lee: ['owned.villa'],
                   efecto: (c, compra) => { const q = callado(c); const i0 = c.inviteChance(q); const a = fatigaEg(c); compra(); const b = fatigaEg(c); const i1 = c.inviteChance(q);
                     if(!(a.fat === 0 && b.fat === 2)) return 'la villa no baja 2 de fatiga por semana: ' + b.fat;
                     return i1 > i0 ? null : 'la villa no recibe a quien no abre su gimnasio: ' + i0 + ' → ' + i1; } },
  estate:        { tipo: 'consumidor', lee: ['owned.estate'], prep: c => { c.G.player.rep = 40; },
                   efecto: (c, compra) => { compra(); egTick(c); const r1 = c.G.player.rep; egTick(c);
                     return r1 === 41 && c.G.player.rep === 41 ? null : 'la mansión no suma +1 de reputación una vez por temporada: ' + r1 + ' / ' + c.G.player.rep; } },
  'eg:driver':   { tipo: 'consumidor', lee: ['owned.driver', 'flags.driver'],
                   efecto: (c, compra) => { const a = fatigaEg(c); compra(); const b = fatigaEg(c);
                     return a.fat === 0 && b.fat === 1 ? null : 'el transporte privado no baja 1 de fatiga por semana'; } },
  jet:           { tipo: 'consumidor', lee: ['owned.jet'],
                   efecto: (c, compra) => { const g = c.G.gyms.find(x => x.id !== c.G.player.gym); const t0 = c.travelCost(g).fatigue; const a = fatigaEg(c);
                     compra(); const t1 = c.travelCost(g).fatigue; const b = fatigaEg(c);
                     if(!(t0 === 10 && t1 === 5)) return 'el viaje no cansa la mitad: ' + t0 + ' → ' + t1;
                     return a.dmg === 0 && Math.abs(b.dmg - 0.25) < 1e-9 ? null : 'el jet dejó de bajar el desgaste semanal'; } },
  gym_upgrade:   { tipo: 'consumidor', lee: ['owned.gym_upgrade', 'projects.gym_upgrade'],
                   efecto: (c, compra) => { enCamp(c); const s = () => { c.G.camp.sharp = 40; egTick(c); return c.G.camp.sharp - 40; };
                     const a = s(); compra(); const b = s();
                     if(!(a === 0 && Math.abs(b - 0.35) < 1e-9)) return 'el centro no mejora el camp: ' + a + ' / ' + b;
                     return c.G.flags.legacyGym ? 'el centro de alto rendimiento sigue encendiendo el gimnasio comunitario' : null; } },
  'eg:academy':  { tipo: 'consumidor', lee: ['owned.academy', 'projects.academy', 'flags.mentor'],
                   efecto: (c, compra) => { c.G.flags.mentor = 1; const k0 = c.RPG.legacyProfile().k; const e0 = c.careerEnding().d;
                     compra(); const k1 = c.RPG.legacyProfile().k; const e1 = c.careerEnding().d;
                     if(!(k0 !== 'maestro' && k1 === 'maestro')) return 'la academia no cuenta en el legado: ' + k0 + ' → ' + k1;
                     return !/te piden que los entrenes/.test(e0) && /te piden que los entrenes/.test(e1) ? null : 'el alumno de la academia no llega al cierre de carrera'; } },
  fund:          { tipo: 'consumidor', lee: ['owned.fund', 'projects.fund'],
                   efecto: (c, compra) => { const k0 = c.RPG.legacyProfile().k; compra(); const k1 = c.RPG.legacyProfile().k;
                     const n0 = (c.G.news || []).length; egTick(c);
                     const dijo = JSON.stringify(c.G.news || []).indexOf('fundación') >= 0;
                     return k0 !== 'constructor' && k1 === 'constructor' && dijo ? null : 'la fundación no cuenta en el legado o no genera su historia: ' + k0 + ' → ' + k1 + ' · ' + n0; } },
  /* --- inversiones --- */
  'inv:media':      { tipo: 'consumidor', lee: ['investments'], efecto: (c, compra) => vence(c, compra, 26) },
  'inv:tech':       { tipo: 'consumidor', lee: ['investments'], efecto: (c, compra) => vence(c, compra, 39) },
  'inv:realestate': { tipo: 'consumidor', lee: ['investments'], efecto: (c, compra) => vence(c, compra, 52) }
};
function vence(c, compra, plazo){
  compra();
  const inv = c.G.endgame.investments.slice(-1)[0];
  if(!inv || inv.status !== 'open' || inv.due - inv.open !== plazo) return 'la inversión no quedó abierta con su plazo';
  const a = c.G.cash; c.G.week += plazo; while(c.G.week > 52){ c.G.week -= 52; c.G.year++; }
  egTick(c);
  return (inv.status === 'won' || inv.status === 'loss') && c.G.cash - a === inv.returned ? null : 'la inversión no se liquida al vencer';
}
const ids = c => c.SHOP.map(i => i.id).concat(Object.keys(EG), Object.keys(INV));

suite('TIENDA-11 · contrato: toda compra que promete algo tiene quién lo cumpla', () => {
  test('cada artículo de la tienda, del patrimonio y de las inversiones está en el contrato, y nada sobra', () => {
    const c = carrera(3);
    const faltan = ids(c).filter(id => !CONTRATO[id]);
    eq(faltan.join(), '', 'compras sin clasificar');
    const sobran = Object.keys(CONTRATO).filter(id => ids(c).indexOf(id) < 0);
    eq(sobran.join(), '', 'el contrato habla de compras que ya no existen');
    /* el patrimonio del contrato es el del juego (ENDGAME es local: se lee de la pantalla) */
    c.G.cash = 5e6;
    const eg = [...c.CL.SCREENS.endgame.fn().matchAll(/egBuy\('([a-z]+)','([a-z_]+)'\)/g)].map(m => (m[2] === 'driver' || m[2] === 'academy' ? 'eg:' : '') + m[2]);
    eq(eg.sort().join(), Object.keys(EG).sort().join(), 'el patrimonio del contrato no es el de la pantalla');
    const inv = [...c.CL.SCREENS.endgame.fn().matchAll(/egInvest\('([a-z]+)'\)/g)].map(m => 'inv:' + m[1]);
    eq(inv.sort().join(), Object.keys(INV).sort().join(), 'las inversiones del contrato no son las de la pantalla');
  });

  test('cada compra: lo que escribe tiene dueño, alguien lo lee y la consecuencia prometida se mide', () => {
    const malos = [];
    Object.keys(CONTRATO).forEach((id, i) => { malos.push(...auditar(carrera(3 + (i % 5)), id, CONTRATO[id])); });
    eq(malos.join('\n'), '', 'compras que no cumplen');
  });

  test('los consumidores que se verifican en otra prueba siguen allí', () => {
    Object.keys(CONTRATO).filter(id => CONTRATO[id].ref).forEach(id => {
      const src = fs.readFileSync(path.join(TESTS, CONTRATO[id].ref), 'utf8');
      const clave = CONTRATO[id].lee[0].split('.')[1];
      ok(src.indexOf(clave) >= 0, id + ': ' + CONTRATO[id].ref + ' ya no prueba ' + clave);
    });
  });

  test('el auditor distingue las tres: consumidor, marca documentada y compra rota', () => {
    const rota = c => c.SHOP.push({ id: '_prueba', c: 'Vida', n: 'Prueba', p: 1, ico: '·', once: true, d: 'promete algo',
      f: function(){ c.G.flags._pruebaX = 1; return 'ok'; } });
    /* 1) sin contrato: sin clasificar */
    let c = carrera(3); rota(c);
    ok(/sin clasificar/.test(auditar(c, '_prueba', undefined).join()), 'una compra sin contrato pasó');
    /* 2) rota: dice consumirla pero nadie la lee y no cambia nada */
    c = carrera(3); rota(c);
    const p2 = auditar(c, '_prueba', { tipo: 'consumidor', lee: ['flags._pruebaX'], efecto: (c2, compra) => { compra(); return c2.G.player.pop > 99 ? null : 'no cambió nada'; } });
    ok(p2.some(x => /nadie lee flags\._pruebaX/.test(x)) && p2.some(x => /no cambió nada/.test(x)), 'una compra rota pasó: ' + p2.join(' | '));
    /* 3) rota: escribe algo que el contrato no reclama */
    c = carrera(3); rota(c);
    ok(auditar(c, '_prueba', { tipo: 'inmediato', efecto: (c2, compra) => { compra(); return null; } }).some(x => /nadie la reclama/.test(x)), 'una escritura sin dueño pasó');
    /* 4) marca: aceptada sólo si documenta por qué */
    c = carrera(3); rota(c);
    eq(auditar(c, '_prueba', { tipo: 'marca', marcas: { 'flags._pruebaX': 'marca de prueba: registra la compra y nada más, a propósito' }, efecto: (c2, compra) => { compra(); return null; } }).join(), '', 'una marca documentada no pasó');
    c = carrera(3); rota(c);
    ok(auditar(c, '_prueba', { tipo: 'marca', marcas: { 'flags._pruebaX': 'x' }, efecto: (c2, compra) => { compra(); return null; } }).length, 'una marca sin razón pasó');
  });
});

suite('TIENDA-11 · todo lo que se vende se puede comprar y se ve', () => {
  test('la tienda ofrece los 41 artículos: Tecnología y Negocios ya no se pierden', () => {
    const c = carrera(3); c.G.cash = 5e6;
    const h = c.scrShop();
    const vis = [...h.matchAll(/buyItem\('([^']+)'\)/g)].map(m => m[1]);
    eq(c.SHOP.filter(i => vis.indexOf(i.id) < 0).map(i => i.id).join(), '', 'artículos que no se pueden comprar');
    ok(/Tecnología/.test(h) && /Negocios/.test(h), 'faltan las categorías');
    eq(vis.length, new Set(vis).size, 'un artículo aparece dos veces');
  });
  test('comprar una actividad la muestra en la tienda y en el hub; el ingreso pasivo incluye la bóveda', () => {
    const c = carrera(3); c.G.cash = 5e6;
    c.buyItem('lightboard'); c.buyItem('vault'); c.buyItem('ownGym');
    const h = texto(c.scrShop());
    ok(/Actividades desbloqueadas/.test(h), 'la tienda no muestra las actividades');
    ok(h.indexOf(texto(c.money(900 + c.VAULT_RENT))) >= 0, 'el ingreso pasivo no suma la renta de la bóveda: ' + h.slice(h.indexOf('Ingreso'), h.indexOf('Ingreso') + 60));
    const card = c.CL.hubCards.find(x => x.id === 'instalaciones');
    ok(card && /fameStart\('reactwall'\)/.test(card.fn()), 'el hub no ofrece la actividad comprada');
  });
  test('el chofer de la tienda no se vende dos veces a quien ya tiene transporte privado', () => {
    const c = carrera(3); c.G.cash = 5e6;
    c.egBuy('vehicles', 'driver');
    const it = c.SHOP.find(i => i.id === 'driver');
    ok(c.shopCan(it), 'se puede pagar el chofer teniendo el transporte privado que ya lo incluye');
    const cash = c.G.cash; c.buyItem('driver'); eq(c.G.cash, cash, 'se cobró igual');
    /* al revés sí tiene sentido: el transporte privado suma su propio −1 semanal */
    const d = carrera(3); d.G.cash = 5e6; d.buyItem('driver'); ok(d.egBuy('vehicles', 'driver') !== false, 'con el chofer no se puede comprar el transporte privado');
  });
  test('el patrimonio muestra lo que hace cada cosa que tenés; las descripciones ya no prometen lo que no existe', () => {
    const c = carrera(3); c.G.cash = 9e6;
    ['apt', 'villa', 'estate', 'jet', 'eg:driver', 'gym_upgrade', 'eg:academy', 'fund', 'vault'].forEach(id => comprar(c, id));
    const h = texto(c.CL.SCREENS.endgame.fn());
    ['Departamento premium', 'Villa de lujo', 'Mansión', 'Transporte privado', 'Jet compartido', 'Centro de alto rendimiento', 'Academia', 'Fundación', 'Bóveda de campeón']
      .forEach(n => ok(h.indexOf(n) >= 0, 'el impacto no muestra ' + n));
    ok(/−2 de fatiga por semana/.test(h) && /−1 de fatiga por semana/.test(h), 'no dice cuánto recupera cada propiedad');
    /* promesas sin sistema que las sostenga: corregidas, no inventadas */
    const todo = c.CL.SCREENS.endgame.fn() + c.scrShop();
    ['Abre eventos', 'eventos de lujo', 'aparecer después en el mundo', 'piezas de alto impacto', 'Reduce el coste de recuperar']
      .forEach(t => ok(todo.indexOf(t) < 0, 'la tienda sigue prometiendo «' + t + '»'));
  });
});

suite('TIENDA-11 · las promesas corregidas se cumplen en el flujo real', () => {
  test('estilista: en una conferencia de verdad rinde exactamente SHOPX.STYLIST_POP más, y el registro lo dice', () => {
    const run = (con) => { const c = carrera(12); if(con) comprar(c, 'stylist'); enCamp(c); c.G.player.pop = 40; const mg = prensa(c); return { pop: c.G.player.pop, log: mg.log.join(' '), pantalla: texto(c.scrMG()) }; };
    const sin = run(false), con = run(true);
    ok(/Estilista: salís bien/.test(con.pantalla), 'la pantalla de la conferencia no muestra lo del estilista');
    ok(Math.abs(con.pop - sin.pop - 1.5) < 1e-9, 'la conferencia no rindió +1,5: ' + sin.pop + ' / ' + con.pop);
    ok(/Estilista/.test(con.log) && !/Estilista/.test(sin.log), 'el registro de la conferencia no lo dice');
  });
  test('villa: el callado que no abre su gimnasio viene a tu casa; al que ya aceptaba no le cambia nada', () => {
    const c = carrera(13); const q = callado(c);
    const abierto = Object.values(c.G.fighters).find(f => f && !f.isPlayer && f.active && !f.retired && !f.inj && c.persW(f, 'accept') >= 1);
    const q0 = c.inviteChance(q), a0 = c.inviteChance(abierto);
    /* sin villa, la misma invitación aceptada no habla de villa */
    { const d = carrera(13); const ch0 = d.chance; d.chance = () => true; try{ d.socInvite(callado(d).id); } finally { d.chance = ch0; }
      ok(!/villa/.test(d.G.socOut.t), 'sin villa, el resultado habla de la villa'); }
    comprar(c, 'villa');
    ok(c.inviteChance(q) > q0, 'la villa no cambió nada para el callado');
    eq(c.inviteChance(abierto), a0, 'la villa cambió la chance de alguien que ya aceptaba');
    /* invitación real, aceptada: el resultado dice por qué vino */
    const ch = c.chance; c.chance = () => true;
    try{ c.socInvite(q.id); } finally { c.chance = ch; }
    ok(/Vino a tu villa/.test(c.G.socOut.t), 'la invitación no dice que vino a tu casa: ' + c.G.socOut.t);
  });
  test('jet: visitar otro gimnasio y viajar con un compañero cansan la mitad; la plata no cambia', () => {
    const run = (con, fn) => { const c = carrera(14); if(con) comprar(c, 'jet'); c.G.cash = 1e6; c.G.player.fatigue = 20; const a = c.G.cash; fn(c); return { fat: c.G.player.fatigue, cash: a - c.G.cash, out: c.G.socOut && c.G.socOut.t }; };
    const visita = c => { const g = c.G.gyms.find(x => x.id !== c.G.player.gym); c.gymVisit(g.id); };
    const s = run(false, visita), j = run(true, visita);
    eq(s.cash, j.cash, 'el jet cambió lo que cuesta el viaje');
    ok(/Con el jet/.test(j.out) && !/Con el jet/.test(s.out), 'la visita no dice lo del jet');
    /* la semana entera corre igual en las dos: la diferencia es el viaje */
    ok(Math.abs((s.fat - j.fat) - 5) < 1e-6, 'la visita no cansó 5 menos: ' + s.fat + ' / ' + j.fat);
    const amigo = c => { const f = rival(c); c.relV(f).friend = 90; c.travelWith(f.id); };
    const s2 = run(false, amigo), j2 = run(true, amigo);
    ok(Math.abs((s2.fat - j2.fat) - 4) < 1e-6, 'viajar con un compañero no cansó 4 menos: ' + s2.fat + ' / ' + j2.fat);
    const c = carrera(14); c.UI.sub = c.G.gyms.find(x => x.id !== c.G.player.gym).id;
    ok(/\+10 de fatiga/.test(texto(c.scrGyms())), 'la pantalla de gimnasios no dice cuánto cansa el viaje');
    comprar(c, 'jet'); ok(/\+5 de fatiga \(jet\)/.test(texto(c.scrGyms())), 'la pantalla de gimnasios no muestra el viaje con jet');
  });
  test('laboratorio: la fisio de la semana de recuperación cobra la mitad y el botón lo dice', () => {
    const run = (con) => { const c = carrera(15); if(con) comprar(c, 'recoverylab'); c.G.cash = 50000; c.G.player.dmg = 60; c.recStart(); const btn = texto(c.scrMG()); const a = c.G.cash; c.recPick('physio'); return { pago: a - c.G.cash, btn }; };
    const s = run(false), l = run(true);
    eq(s.pago - l.pago, 600, 'la fisio con laboratorio no costó 600 menos que la misma semana sin laboratorio');
    /* la pantalla que se ve (la del tablero arcade) dice lo que cobra */
    const cuesta = (b, m) => { const i = b.indexOf('FISIO'); return b.slice(i, i + 40).indexOf(texto(m)) >= 0; };
    const c0 = carrera(15);
    ok(cuesta(s.btn, c0.money(1200)) && !/\(lab\)/.test(s.btn), 'la fisio no dice lo que cuesta: ' + s.btn.slice(s.btn.indexOf('FISIO'), s.btn.indexOf('FISIO') + 40));
    ok(cuesta(l.btn, c0.money(600)) && /\(lab\)/.test(l.btn), 'la fisio no dice el precio con laboratorio: ' + l.btn.slice(l.btn.indexOf('FISIO'), l.btn.indexOf('FISIO') + 40));
  });
  test('restaurante: una semana de camp real pierde medio punto de filo contra la misma sin restaurante, y el camp lo dice', () => {
    const run = (con) => { const c = carrera(16); if(con) comprar(c, 'restaurant'); enCamp(c); c.G.camp.sharp = 40; c.campWeek('spar', 1, 0); return { s: c.G.camp.sharp, log: (c.G.camp.log || []).join(' ') }; };
    const s = run(false), r = run(true);
    ok(Math.abs((s.s - r.s) - 0.5) < 1e-6, 'el restaurante no restó medio punto: ' + s.s + ' / ' + r.s);
    ok(/restaurante/.test(r.log) && !/restaurante/.test(s.log), 'el camp no lo dice');
  });
  test('documental: en una liga grande abre UNA coestelar legal contra el más vendedor, que se puede firmar; en una chica, no', () => {
    const c = carrera(17); comprar(c, 'camera'); c.G.player.rec.w = 8;
    const st = estrella(c);
    comprar(c, 'documentary');
    c.G.offers = []; c.makeOffers();
    const o = c.G.offers.find(x => x.docMade);
    ok(o, 'el documental no abrió la pelea');
    eq(o.oppId, st.id, 'no es el más vendedor');
    eq(c.fightSpecProblem({ oppId: o.oppId, org: o.org }), '', 'la pelea no es legal');
    ok(/EL DOCUMENTAL LA VENDIÓ/.test(o.txt) && o.event === 'PPV — pelea coestelar', 'no dice de dónde sale');
    ok(c.G.flags.docUsed, 'no se gastó');
    c.G.offers = []; c.makeOffers(); ok(!c.G.offers.some(x => x.docMade), 'el mismo documental abre otra');
    /* liga chica, con los mismos que venden: no hay coestelar que abrir, y el documental espera */
    const d = carrera(17); comprar(d, 'camera'); d.G.player.rec.w = 8; estrella(d, 1); comprar(d, 'documentary');
    d.G.offers = []; d.makeOffers(); ok(!d.G.offers.some(x => x.docMade), 'abrió una coestelar en una liga chica'); ok(!d.G.flags.docUsed, 'se gastó sin abrir nada');
  });
  test('centro de alto rendimiento: ya no dispara noticias de un gimnasio comunitario que no compraste', () => {
    const c = carrera(18); comprar(c, 'gym_upgrade');
    ok(!c.G.flags.legacyGym, 'sigue encendiendo el gimnasio comunitario');
    for(let i = 0; i < 20; i++) semana(c, 'luxury');
    ok(JSON.stringify(c.G.news || []).indexOf('gimnasio comunitario') < 0, 'aparecen noticias del gimnasio comunitario');
  });
});

suite('TIENDA-11 · guardar y cargar', () => {
  test('comprar, guardar, cargar: sigue siendo tuyo, no se recompra, el consumidor sigue activo y la consecuencia existe', () => {
    const c = carrera(19); c.G.cash = 9e6; c.G.player.rec.w = 8;
    ['stylist', 'restaurant', 'recoverylab', 'camera', 'documentary', 'vault', 'lightboard'].forEach(id => c.buyItem(id));
    ['apt', 'villa', 'estate', 'jet', 'eg:driver', 'eg:academy', 'fund', 'gym_upgrade'].forEach(id => comprar(c, id));
    const leg0 = JSON.stringify(c.RPG.legacyProfile());
    const antes = JSON.stringify({ o: c.G.endgame.owned, p: Object.keys(c.G.endgame.projects), s: c.G.flags.shop, doc: c.G.flags.docAt, v: c.G.flags.vaultCash });
    c.saveGame(true); ok(c.loadGame(c.listSaves()[0].id), 'no cargó');
    eq(JSON.stringify({ o: c.G.endgame.owned, p: Object.keys(c.G.endgame.projects), s: c.G.flags.shop, doc: c.G.flags.docAt, v: c.G.flags.vaultCash }), antes, 'la propiedad no sobrevive a guardar y cargar');
    /* no se recompra */
    const cash = c.G.cash;
    ok(c.egBuy('props', 'villa') === false, 'la villa se volvió a comprar'); c.buyItem('stylist'); eq(c.G.cash, cash, 'se cobró algo ya comprado');
    /* los consumidores siguen activos después de cargar */
    eq(fatigaEg(c).fat, 1 + 2 + 1, 'departamento + villa + transporte no recuperan después de cargar');
    eq(c.travelCost(c.G.gyms.find(x => x.id !== c.G.player.gym)).fatigue, 5, 'el jet dejó de contar');
    eq(c.recPhysioCost(), 600, 'el laboratorio dejó de contar');
    eq(JSON.stringify(c.RPG.legacyProfile()), leg0, 'el legado de la academia y la fundación cambió al cargar');
    ok(c.RPG.legacyProfile().s >= c.RPG.LEGADO_OBRA, 'la academia y la fundación dejaron de contar en el legado');
    c.G.mg = { type: 'pod', log: [] }; const p0 = c.G.player.pop; c.hookEmit('media:done', { kind: 'pod' });
    eq(c.G.player.pop - p0, c.SHOPX.STYLIST_POP, 'el estilista dejó de contar');
    ok(c.SHOPX.docLeft() > 0, 'el documental pendiente se perdió');
    const h = texto(c.CL.SCREENS.endgame.fn());
    ok(h.indexOf('Bóveda') >= 0 && h.indexOf('Jet compartido') >= 0, 'el impacto no se ve después de cargar');
    ok(c.scrShop().indexOf("fameStart('reactwall')") >= 0, 'la actividad comprada no se ofrece después de cargar');
    const q = callado(c); ok(c.villaHosts(q), 'la villa dejó de recibir gente después de cargar');
    c.CL.S().once.estateLegacy = null; const r0 = c.G.player.rep = 40; egTick(c);
    eq(c.G.player.rep, r0 + 1, 'la mansión dejó de sumar reputación después de cargar');
    enCamp(c); c.G.camp.sharp = 40; egTick(c); hook(c, 'camp:week:post', 'restaurante').fn({});
    ok(Math.abs(c.G.camp.sharp - (40 + 0.35 - c.SHOPX.REST_SHARP)) < 1e-9, 'el centro o el restaurante dejaron de contar en el camp después de cargar: ' + c.G.camp.sharp);
  });
});

suite('TIENDA-11 · sin azar nuevo', () => {
  test('los consumidores nuevos no tiran el dado', () => {
    const c = carrera(20); c.G.cash = 9e6;
    ['apt', 'villa', 'estate', 'jet'].forEach(id => comprar(c, id));
    ['stylist', 'restaurant', 'recoverylab'].forEach(id => c.buyItem(id));
    eq(contarAzar(c, () => egTick(c)), 0, 'el patrimonio tira el dado');
    c.G.mg = { type: 'press', log: [] };
    eq(contarAzar(c, () => c.hookEmit('media:done', { kind: 'press' })), 0, 'el estilista tira el dado');
    enCamp(c);
    eq(contarAzar(c, () => hook(c, 'camp:week:post', 'restaurante').fn({})), 0, 'el restaurante tira el dado');
    eq(contarAzar(c, () => { c.travelCost(c.G.gyms[0]); c.inviteChance(callado(c)); c.recPhysioCost(); }), 0, 'las lecturas tiran el dado');
    const d = carrera(21); comprar(d, 'camera'); d.G.player.rec.w = 8; estrella(d); comprar(d, 'documentary'); d.G.nextFight = null;
    d.G.offers = [];
    eq(contarAzar(d, () => { hook(d, 'offers:made', 'documental').fn({}); hook(d, 'offers:made', 'documentalGasto').fn({}); }), 0, 'el documental tira el dado');
    ok(d.G.offers.some(o => o.docMade), 'la prueba no abrió la pelea');
  });
});
