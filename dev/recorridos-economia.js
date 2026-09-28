#!/usr/bin/env node
'use strict';
/* dev/recorridos-economia.js — USO REAL DE CADA PAGO, NO SÓLO PRUEBAS
   ---------------------------------------------------------------------------
   Una carrera determinista que usa, por la vía del jugador (las mismas
   funciones que llaman los botones), cada cosa que se paga fuera de la
   tienda: plan de gasto, experiencia de carrera, visitar un gimnasio,
   mudarse, ir a ver una pelea, viajar con un compañero, contenido, deuda,
   equipo técnico. El resto de cada semana la vive el autopiloto (peleas,
   campamentos, eventos). Para cada pago anota el precio que la pantalla
   mostraba ANTES y lo que se cobró (la caja se mira en el instante en que la
   acción pide pasar de semana: así el cobro queda separado de la semana).
   Invariantes cada semana; a mitad de camino se guarda y se sigue en un juego
   recién abierto.
     node dev/recorridos-economia.js [--semanas 104] [--semilla 7300] [--file otra.html]
   Sale con 1 si algún cobro no coincide con lo mostrado o se rompe algo. */
const H = require('./harness.js');
const A = require('./autopilot.js');
const INV = require('./invariants.js');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const SEMANAS = parseInt(arg('semanas', '104'), 10), SEMILLA = parseInt(arg('semilla', '7300'), 10);
const ARCHIVO = arg('file', null) || undefined;

const texto = h => String(h).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
function precioEn(html, antes){ const t = texto(html), i = t.indexOf(antes); if(i < 0) return NaN;
  const m = t.slice(i + antes.length).match(/\$([0-9][0-9,]*)/); return m ? Number(m[1].replace(/,/g, '')) : NaN; }
/* el botón que contiene ese texto: su precio, y si se puede pulsar */
function boton(html, txt){
  const bs = String(html).split('<button').slice(1).map(b => '<button' + b.split('</button>')[0]);
  const b = bs.find(x => texto(x).indexOf(txt) >= 0); if(!b) return { precio: NaN, ok: false, por: 'no está' };
  const off = /\sdisabled/.test(b.split('>')[0]);
  return { precio: precioEn(b, txt), ok: !off, por: off ? ((b.match(/title="([^"]*)"/) || [])[1] || 'deshabilitado') : '' };
}
function pantalla(c, scr, sub){ c.UI.screen = scr; c.UI.sub = sub === undefined ? null : sub; c.render(); return c.document.getElementById('app').innerHTML; }

let h = H.boot({ seed: SEMILLA, file: ARCHIVO }), c = h.ctx;
H.startCareer(h, { metaSeed: SEMILLA + 11, style: 'mma', div: 'LW', age: 23 });
{ const co = c.G.offers.find(o => o.type === 'contract' && c.G.orgs[o.org]); c.negoStart(co); c.negoClose(); c.G.mg = null; c.G.pending = []; c.UI.screen = 'hub'; }
/* capital declarado: sin él, una carrera que recién empieza no puede pagar
   cada servicio al menos una vez. Es lo único que se toca a mano. */
const CAPITAL = 150000; c.G.cash += CAPITAL;

const libro = [], fallos = [];
/* cobra: precio mostrado (o el botón entero), acción; mide el cobro antes de que pase la semana.
   Un botón deshabilitado no se pulsa: se anota por qué. */
function pago(nombre, mostrado, accion, efecto){
  if(mostrado && typeof mostrado === 'object'){ if(!mostrado.ok){ libro.push({ s: semana, nombre, mostrado: mostrado.precio, cobrado: null, nota: 'botón deshabilitado: ' + mostrado.por }); return false; } mostrado = mostrado.precio; }
  if(!(mostrado > 0)){ libro.push({ s: semana, nombre, mostrado, cobrado: null, nota: 'no disponible ahora' }); return false; }
  const aw = c.advanceWeek; let cajaAlPasar = null;
  c.advanceWeek = function(){ if(cajaAlPasar === null) cajaAlPasar = c.G.cash; return aw.apply(this, arguments); };
  const antes = c.G.cash;
  try{ accion(); } finally { c.advanceWeek = aw; }
  const cobrado = Math.round(antes - (cajaAlPasar === null ? c.G.cash : cajaAlPasar));
  const nota = efecto ? efecto() : '';
  libro.push({ s: semana, nombre, mostrado, cobrado, nota, paso: cajaAlPasar !== null });
  if(cobrado !== mostrado) fallos.push('semana ' + semana + ' · ' + nombre + ': mostraba ' + mostrado + ' y cobró ' + cobrado);
  return true;
}
/* alguien del círculo que la pantalla muestra (socCircle, los primeros 14) */
function amigo(min){
  return (c.socCircle() || []).slice(0, 14).filter(f => f && !f.isPlayer && f.active && !f.retired && !f.inj && (!c.G.nextFight || c.G.nextFight.oppId !== f.id))
    .sort((a, b) => c.relV(b).friend - c.relV(a).friend || String(a.id).localeCompare(String(b.id)))
    .find(f => c.relV(f).friend >= (min || 0));
}

let semana = 0, recargado = false;
const usados = {};
while(semana < SEMANAS && !c.G.player.retired){
  /* se puede actuar si no hay pelea, minijuego ni una decisión pendiente;
     viajar, visitar y mudarse además piden no estar en campamento */
  const libre = !c.G.fight && !c.G.mg && !c.G.pending.length, afuera = libre && !c.G.camp;
  const s = semana;
  try {
    if(libre){
      const p = c.G.player;
      if(s >= 2 && !usados.plan){ /* recurrente: lo que sube el gasto semanal que se cobra (CL.weeklyBurn) es la diferencia entre planes */
        const k = 'pro', vis = precioEn(c.CL.hubCards.find(x => x.id === 'decisiones').fn(), 'Profesional'), prev = c.CL.spend(), b0 = c.CL.weeklyBurn();
        c.clSetSpend(k); const cobrado = c.CL.weeklyBurn() - b0 + c.CL.SPEND[prev].cost;
        libro.push({ s, nombre: 'plan de gasto profesional (por semana)', mostrado: vis, cobrado, nota: c.CL.spendFx(k) });
        if(cobrado !== vis) fallos.push('plan: mostraba ' + vis + '/sem y la semana cobra ' + cobrado); usados.plan = 1; }
      if(s >= 3 && afuera && !usados.visita && c.G.cash > 8000){ const g = c.G.gyms.find(x => x.id !== p.gym); pago('visitar ' + g.name, precioEn(pantalla(c, 'gyms', g.id), 'Visitar 1 semana'), () => c.gymVisit(g.id),
        () => c.G.socOut && c.G.socOut.t.slice(0, 70)); usados.visita = 1; }
      if(s >= 5 && !usados.verPelea){ const f = amigo(1); if(f){
        if(pago('ir a ver a ' + c.fname(f), boton(pantalla(c, 'social', f.id), 'Ir a ver su pelea'), () => c.watchFight(f.id), () => c.G.socOut && c.G.socOut.t.slice(0, 70))) usados.verPelea = 1; } }
      if(s >= 8 && !usados.experiencia && c.G.cash > 4000){ const lv = c.gameplayLevel(); pago('experiencia de carrera nivel ' + (lv + 1), precioEn(pantalla(c, 'contracts'), 'Siguiente nivel:'), () => c.requestGameplayUpgrade(),
        () => { const n = (c.G.news || []).map(x => String(x.t || x.txt || x)).filter(x => /experiencia de carrera/.test(x)).slice(-1)[0]; return n ? n.slice(0, 110) : 'sin noticia'; }); usados.experiencia = 1; }
      if(s >= 10 && !usados.contenido && c.G.cash > 12000){ c.buyItem('camera'); c.G.socOut = null;
        pago('producción de contenido', precioEn(c.CL.hubCards.find(x => x.id === 'content_team').fn(), 'Invertir en producción'), () => c.contentBoost(),
          () => 'hype ' + Math.round(c.CL.contentState().hype)); usados.contenido = 1; }
      /* para viajar con alguien hace falta confianza: se la gana invitándolo a entrenar */
      if(s >= 12 && afuera && !usados.viaje && !amigo(62)){ const f = amigo(0) || (c.socCandidates(8) || []).find(x => x && !x.isPlayer && x.active && !x.retired && !x.inj); if(f && !c.socWhyBlocked('train:' + f.id, { weight: c.SOC_W.MAYOR, actor: f.id, cat: 'gym' })){ c.socInvite(f.id); usados.invitaciones = (usados.invitaciones || 0) + 1; } }
      if(s >= 12 && afuera && !usados.viaje){ const f = amigo(62); if(f){ if(pago('viajar con ' + c.fname(f), boton(pantalla(c, 'social', f.id), 'Viajar juntos a un evento'), () => c.travelWith(f.id),
        () => c.G.socOut && c.G.socOut.t.slice(0, 70))) usados.viaje = 1; } }
      if(s >= 14 && afuera && !usados.mudanza && c.G.cash > 6000){ const g = c.G.gyms.filter(x => x.id !== p.gym && c.gymMoveFee(x) < c.G.cash / 3).sort((a, b) => b.prest - a.prest)[0];
        if(g){ pago('mudarse a ' + g.name, precioEn(pantalla(c, 'gyms', g.id), 'Mudarme acá'), () => c.gymJoin(g.id), () => c.G.socOut && c.G.socOut.t.slice(0, 90)); usados.mudanza = 1; } }
      if(s >= 16 && !usados.equipo && c.G.cash > 10000){ const co = c.G.coaches.find(x => x.id !== p.coach && x.q >= 70), b0 = c.CL.weeklyBurn(); c.hireCoach(co.id);
        const vis = precioEn(pantalla(c, 'gym'), 'Los ayudantes cobran aparte:'), cobrado = c.CL.weeklyBurn() - b0;
        libro.push({ s, nombre: 'sumar a ' + co.name + ' (por semana)', mostrado: vis, cobrado, nota: 'sueldo, con la semana' });
        if(cobrado !== vis) fallos.push('equipo: mostraba ' + vis + '/sem y la semana cobra ' + cobrado); usados.equipo = 1; }
      if(c.CL.debtTotal() > 0 && c.G.cash > c.CL.debtTotal() + 5000){ pago('pagar la deuda', precioEn(pantalla(c, 'contracts'), 'Pagar ahora de tu bolsillo'), () => c.CL.debtPayNow(),
        () => 'deuda ' + c.CL.debtTotal()); usados.deuda = 1; }
      if(s >= 40 && !usados.planAusterio){ c.clSetSpend('lean'); usados.planAusterio = 1; libro.push({ s, nombre: 'plan de gasto austero', mostrado: 0, cobrado: 0, nota: c.CL.spendFx('lean') }); }
      c.UI.screen = 'hub'; c.UI.sub = null; c.G.socOut = null;
    }
    /* el resto de la semana lo vive el autopiloto */
    A.correrCarrera(h, { maxWeeks: 1, politica: 'basica', seedPolitica: SEMILLA * 1000 + semana });
  } catch(e){ fallos.push('excepción en la semana ' + semana + ': ' + e.message); break; }
  semana++;
  const malas = INV.checkInvariants(c.G, c.UI, {}) || [];
  if(malas.length){ fallos.push('invariante en la semana ' + semana + ': ' + JSON.stringify(malas[0]).slice(0, 160)); break; }
  /* mitad de camino: guardar y seguir en un juego recién abierto */
  if(!recargado && semana === Math.floor(SEMANAS / 2)){
    const ref = JSON.stringify({ spend: c.CL.S().spend, lv: c.G.gameplayLevel, gym: c.G.player.gym, deuda: c.CL.debtTotal(), team: c.G.team, hype: c.G.flags.content && c.G.flags.content.hype });
    c.saveGame(true);
    const h2 = H.boot({ seed: SEMILLA + 1, file: ARCHIVO });
    for(const [k, v] of c.localStorage.__map) h2.ctx.localStorage.setItem(k, v);
    if(!h2.ctx.loadGame(h2.ctx.listSaves()[0].id)){ fallos.push('no cargó a mitad de camino'); break; }
    h = h2; c = h2.ctx; c.UI.screen = 'hub'; recargado = true;
    const got = JSON.stringify({ spend: c.CL.S().spend, lv: c.G.gameplayLevel, gym: c.G.player.gym, deuda: c.CL.debtTotal(), team: c.G.team, hype: c.G.flags.content && c.G.flags.content.hype });
    if(got !== ref) fallos.push('guardar y seguir en otro juego cambió el estado económico: ' + ref + ' → ' + got);
    libro.push({ s: semana, nombre: 'guardar y seguir en un juego recién abierto', mostrado: 0, cobrado: 0, nota: got === ref ? 'estado económico idéntico' : 'DISTINTO' });
  }
}

console.log('recorrido económico · semilla ' + SEMILLA + ' · ' + semana + ' semanas' + (recargado ? ' · recargado a mitad' : ''));
libro.forEach(l => console.log('  sem ' + String(l.s).padStart(3) + ' · ' + l.nombre + (l.mostrado ? ' · mostraba $' + l.mostrado + (l.cobrado !== null ? ' · cobró $' + l.cobrado : '') : '') +
  (l.paso ? ' · pasó la semana' : '') + (l.nota ? ' · ' + l.nota : '')));
const P = c.G.player;
console.log('  final: récord ' + P.rec.w + '-' + P.rec.l + ' · caja $' + Math.round(c.G.cash) + ' · deuda $' + c.CL.debtTotal() + ' · plan ' + c.CL.spend() +
  ' · experiencia ' + c.gameplayLevel() + ' · gimnasio ' + c.gymById(P.gym).name + ' · usados: ' + Object.keys(usados).join(', '));
const faltan = ['plan', 'visita', 'verPelea', 'experiencia', 'contenido', 'viaje', 'mudanza', 'equipo', 'deuda'].filter(k => !usados[k]);
if(faltan.length) console.log('  no se llegaron a usar: ' + faltan.join(', '));
if(fallos.length){ console.log('\nFALLOS:\n  ' + fallos.join('\n  ')); process.exit(1); }
console.log('\ncada cobro coincide con lo que mostraba la pantalla · invariantes en cada semana (' + Object.keys(INV.SISTEMAS).length + ' sistemas)');
