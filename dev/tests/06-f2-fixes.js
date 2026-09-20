'use strict';
/* Bugs CONFIRMADOS en F1 y corregidos en F2.
   Cada prueba se escribió ANTES del arreglo y se comprobó que fallaba contra el
   archivo sin corregir; la evidencia de la corrida en rojo está en CHANGES.md. */
const { suite, test, ok, eq } = require('../run-tests.js');
const H = require('../harness.js');
const fs = require('node:fs');
const path = require('node:path');

suite('F2 · F-001 migracion del blob legado', () => {

  test('con la cuota agotada, NO se borra el blob si no se migro nada', () => {
    const save = fs.readFileSync(path.join(__dirname, '..', 'fixtures', '03-mitad-carrera.json'), 'utf8');
    const blob = JSON.stringify({
      p1: { name: 'Carrera A', data: save, meta: '2018' },
      p2: { name: 'Carrera B', data: save, meta: '2019' },
    });
    /* cuota que da para el blob pero no para escribir las partidas migradas */
    const h = H.boot({ seed: 1, quota: blob.length + 50000 });
    const c = h.ctx;
    c.localStorage.setItem(c.SAVEKEY, blob);

    const movidas = c.migrateLegacyBlob();
    eq(movidas, 0, 'el caso de prueba no aplica: se migro alguna partida');
    ok(c.localStorage.getItem(c.SAVEKEY) !== null,
       'se borro el blob legado sin haber migrado ninguna partida: el jugador pierde todo');
  });

  test('cuando SI se migran todas, el blob se retira', () => {
    const save = fs.readFileSync(path.join(__dirname, '..', 'fixtures', '01-recien-creada.json'), 'utf8');
    const blob = JSON.stringify({ p1: { name: 'Carrera A', data: save, meta: '2016' } });
    const h = H.boot({ seed: 1 });                 /* sin cuota: cabe todo */
    const c = h.ctx;
    c.localStorage.setItem(c.SAVEKEY, blob);

    const movidas = c.migrateLegacyBlob();
    eq(movidas, 1, 'no se migro la partida');
    eq(c.localStorage.getItem(c.SAVEKEY), null, 'el blob deberia retirarse tras migrar todo');
    ok(Object.keys(c.allSaves()).length >= 1, 'la partida migrada no aparece en el indice');
  });

  test('una partida ilegible no bloquea el retiro del blob', () => {
    /* Si el contenido no es recuperable, no hay nada que perder: el blob se
       retira igual. Lo que no puede pasar es perder partidas que SI valian. */
    const h = H.boot({ seed: 1 });
    const c = h.ctx;
    c.localStorage.setItem(c.SAVEKEY, JSON.stringify({ p1: { name: 'rota', data: '{no es json' } }));
    c.migrateLegacyBlob();
    eq(c.localStorage.getItem(c.SAVEKEY), null,
       'un blob sin nada recuperable deberia retirarse');
  });

});

suite('F2 · I-001 el campeon conserva el cinturon', () => {

  function coronaJugador(seed){
    const h = H.boot({ seed });
    H.startCareer(h, { metaSeed: 1357, style: 'mma', div: 'LW', age: 24 });
    const c = h.ctx, p = c.G.player;
    p.org = 'VAN';
    c.G.champs.VAN = c.G.champs.VAN || {};
    c.G.champs.VAN[p.div] = p.id;
    c.recalcRank('VAN', p.div);
    return { h, c, p };
  }

  test('repairCritical no le quita el cinturon al jugador campeon', () => {
    const { c, p } = coronaJugador(31);
    eq(c.rankOf(p), 'C', 'el caso de prueba no aplica: el jugador no quedo campeon');
    c.repairCritical();
    eq(c.G.champs.VAN[p.div], p.id, 'repairCritical vacio el cinturon del jugador');
    eq(c.rankOf(p), 'C', 'el jugador dejo de ser campeon tras el saneo');
  });

  test('el cinturon sobrevive a una semana completa', () => {
    const { c, p } = coronaJugador(32);
    c.advanceWeek();
    eq(c.G.champs.VAN[p.div], p.id, 'el jugador perdio el cinturon al pasar una semana');
  });

  test('un campeon NPC no pierde el cinturon por figurar en una oferta', () => {
    const { c } = coronaJugador(33);
    const npc = Object.values(c.G.fighters)
      .find(f => f && f.org === 'VAN' && f.div === 'HW' && !f.retired && f.active);
    ok(npc, 'no hay NPC de VAN/HW para la prueba');
    c.G.champs.VAN.HW = npc.id;
    c.G.offers = [{ type:'fight', oppId: npc.id, org:'VAN', weeks:8, title:false, purse:1000, event:'x' }];
    c.repairCritical();
    eq(c.G.champs.VAN.HW, npc.id, 'el NPC perdio el cinturon solo por estar en una oferta');
  });

  test('repairCritical SIGUE vacando un cinturon realmente invalido', () => {
    /* La corrección no puede desactivar el saneo que la función debe hacer. */
    const { c } = coronaJugador(34);
    const npc = Object.values(c.G.fighters)
      .find(f => f && f.org === 'VAN' && f.div === 'HW' && !f.retired && f.active);
    c.G.champs.VAN.HW = npc.id;
    npc.retired = true;                       /* campeon retirado: debe quedar vacante */
    c.repairCritical();
    eq(c.G.champs.VAN.HW, null, 'un campeon retirado deberia dejar el cinturon vacante');

    c.G.champs.VAN.HW = 'fXXX-no-existe';     /* referencia colgante */
    c.repairCritical();
    eq(c.G.champs.VAN.HW, null, 'una referencia colgante deberia dejar el cinturon vacante');
  });

  test('repairCritical sigue reparando stats invalidas', () => {
    const { c, p } = coronaJugador(35);
    p.st.power = NaN;
    const r = c.repairCritical();
    ok(Number.isFinite(p.st.power), 'no se reparo un stat no numerico del jugador');
    ok(r.reparados > 0, 'repairCritical no conto la reparacion');
  });

});

suite('F2 · D-003 no se puede re-jugar una pelea sin cobrarla', () => {

  function peleaTerminada(seed){
    const h = H.boot({ seed });
    H.startCareer(h, { metaSeed: 5150, style: 'mma', div: 'LW', age: 22 });
    const c = h.ctx, p = c.G.player;
    const opp = Object.values(c.G.fighters)
      .find(f => f && f.div === p.div && f.id !== p.id && !f.retired);
    c.G.nextFight = { oppId: opp.id, weeks: 0, org: p.org, title: false, purse: 8000, event: 'Test' };
    c.startCamp(c.G.nextFight);
    c.G.camp.i = c.G.camp.weeks;
    c.goFight();
    let g = 0;
    while(c.G.fight && !c.G.fight.over && g++ < 600){
      const o = c.fightOptions();
      if(!o.length){ c.finishFight('dec', null); break; }
      c.fightAct(o[0].k);
    }
    return { h, c, p };
  }

  test('la pantalla de resultado no ofrece barra de navegacion', () => {
    /* Es la unica via de escape: scrFightResult solo tiene los botones
       confirmFight() y recStart(), que resuelven hacia adelante. Mientras la
       barra inferior este visible, el jugador puede salir sin cobrar, y al
       salir go() descarta la pelea dejando nextFight firmado: re-roll infinito. */
    const { c } = peleaTerminada(88);
    eq(c.UI.screen, 'fightresult', 'la pelea no dejo la pantalla de resultado');
    ok(!c.G.paid, 'el caso de prueba no aplica: la pelea ya estaba cobrada');
    c.render();
    eq(c.document.getElementById('nav').style.display, 'none',
       'la barra de navegacion esta visible en la pantalla de resultado');
  });

  test('las pantallas que exigen resolver ocultan la barra, las demas no', () => {
    const h = H.boot({ seed: 89 });
    H.startCareer(h, { metaSeed: 5151, style: 'mma', div: 'LW', age: 22 });
    const c = h.ctx;
    const nav = () => c.document.getElementById('nav').style.display;

    for(const s of ['hub', 'train', 'rank', 'people', 'menu']){
      c.go(s);
      eq(nav(), 'grid', 'la barra deberia verse en ' + s);
    }
    for(const s of ['title', 'create']){
      c.UI.screen = s; c.render();
      eq(nav(), 'none', 'la barra no deberia verse en ' + s);
    }
  });

  test('tras cobrar, la pelea si se descarta al navegar', () => {
    /* La limpieza que go() hace sobre una pelea ya cobrada debe seguir intacta:
       una pelea con resultado aplicado no es estado de la partida. */
    const { c } = peleaTerminada(90);
    c.confirmFight();
    ok(c.G.paid, 'confirmFight no marco la pelea como cobrada');
    c.go('hub');
    eq(c.G.fight, null, 'go() dejo viva una pelea ya cobrada');
  });

});

suite('F2 · D-001 cobrar una pelea es idempotente', () => {

  /* Prepara una pelea terminada y sin cobrar, por la via real del juego. */
  function peleaTerminada(seed, cfg){
    cfg = cfg || {};
    const h = H.boot({ seed });
    H.startCareer(h, { metaSeed: 2468, style: 'mma', div: 'LW', age: 22 });
    const c = h.ctx, p = c.G.player;
    const opp = Object.values(c.G.fighters)
      .find(f => f && f.div === p.div && f.id !== p.id && !f.retired);
    c.G.nextFight = { oppId: opp.id, weeks: 0, org: p.org, title: !!cfg.title, purse: 8000, event: 'Test' };
    c.startCamp(c.G.nextFight);
    c.G.camp.i = c.G.camp.weeks;
    c.goFight();
    let g = 0;
    while(c.G.fight && !c.G.fight.over && g++ < 600){
      const o = c.fightOptions();
      if(!o.length){ c.finishFight('dec', null); break; }
      c.fightAct(o[0].k);
    }
    return { h, c, p };
  }
  const foto = (c) => ({
    rec: c.G.player.rec.w + '-' + c.G.player.rec.l + '-' + c.G.player.rec.d,
    cash: Math.round(c.G.cash),
    career: c.G.player.career.length,
    semana: c.G.year * 52 + c.G.week,
  });

  test('la primera llamada SI cobra la pelea', () => {
    const { c } = peleaTerminada(77);
    const antes = foto(c);
    ok(!c.G.paid, 'el caso de prueba no aplica: ya estaba cobrada');
    c.confirmFight();
    const despues = foto(c);
    ok(despues.career === antes.career + 1, 'la pelea no se anoto en el historial');
    ok(despues.rec !== antes.rec, 'el record no cambio al cobrar');
    ok(despues.semana === antes.semana + 1, 'cobrar deberia consumir la semana');
    ok(c.G.paid, 'G.paid no quedo marcado');
  });

  test('llamarla varias veces no duplica record, bolsa ni semanas', () => {
    const { c } = peleaTerminada(78);
    c.confirmFight();
    const trasUna = foto(c);
    c.confirmFight();
    c.confirmFight();
    eq(foto(c), trasUna, 'cobrar de nuevo altero el estado de la partida');
  });

  test('sin pelea o sin resultado no hace nada', () => {
    const h = H.boot({ seed: 79 });
    H.startCareer(h, { metaSeed: 2469, style: 'mma', div: 'LW', age: 22 });
    const c = h.ctx;
    const antes = foto(c);
    c.confirmFight();
    eq(foto(c), antes, 'confirmFight actuo sin una pelea que cobrar');
  });

  test('D-006: una pelea nueva se puede volver a cobrar', () => {
    /* G.paid solo sirve de cerrojo si lo resetea la funcion canonica de
       arranque. Si el reset vive fuera, una pelea empezada por otra via hereda
       el "ya cobrada" de la anterior y su resultado no se puede cobrar nunca. */
    const { c, p } = peleaTerminada(80);
    c.confirmFight();
    ok(c.G.paid, 'la primera pelea no quedo cobrada');

    const opp2 = Object.values(c.G.fighters)
      .find(f => f && f.div === p.div && f.id !== p.id && !f.retired && f.id !== c.G.fight.opp);
    c.G.fight = null;
    c.G.nextFight = { oppId: opp2.id, weeks: 0, org: p.org, title: false, purse: 9000, event: 'Test2' };
    /* arranque por la funcion canonica, no por goFight */
    c.fightStart(opp2.id, { rounds: 3, title: false, org: p.org, purse: 9000, event: 'Test2' });
    eq(c.G.paid, false, 'fightStart no reseteo G.paid: la pelea nueva nace marcada como cobrada');
  });

});

suite('F2 · A-001 el contrato se descuenta una vez por pelea', () => {

  /* Firma contrato por la via real (negociacion) y deja una pelea lista. */
  function conContrato(seed, orgPelea){
    const h = H.boot({ seed });
    H.startCareer(h, { metaSeed: 2468, style: 'mma', div: 'LW', age: 22 });
    const c = h.ctx, p = c.G.player;
    const co = c.G.offers.find(o => o.type === 'contract' && c.G.orgs[o.org]);
    ok(co, 'no hubo oferta de contrato para la prueba');
    c.negoStart(co); c.negoClose(); c.G.mg = null; c.UI.screen = 'hub';
    const opp = Object.values(c.G.fighters)
      .find(f => f && f.div === p.div && f.id !== p.id && !f.retired);
    const org = orgPelea || p.org;
    c.G.nextFight = { oppId: opp.id, weeks: 0, org: org, title: false, purse: 5000, event: 'T' };
    c.startCamp(c.G.nextFight);
    c.G.camp.i = c.G.camp.weeks;
    return { h, c, p };
  }
  function pelearYCobrar(c){
    c.goFight();
    let g = 0;
    while(c.G.fight && !c.G.fight.over && g++ < 600){
      const o = c.fightOptions();
      if(!o.length){ c.finishFight('dec', null); break; }
      c.fightAct(o[0].k);
    }
    c.confirmFight();
  }

  test('una pelea descuenta exactamente una del contrato', () => {
    const { c } = conContrato(55);
    const antes = c.G.contract.left;
    ok(antes >= 2, 'el contrato de la prueba es demasiado corto: ' + antes);
    pelearYCobrar(c);
    eq(c.G.contract.left, antes - 1,
       'el contrato se descuento ' + (antes - c.G.contract.left) + ' veces en una sola pelea');
  });

  test('una pelea de OTRA organizacion no consume el contrato', () => {
    /* El escritor base comprueba que el contrato sea de la organizacion de la
       pelea. Esa regla no puede perderse al quitar el duplicado. */
    const { c, p } = conContrato(56);
    const otra = Object.keys(c.G.orgs).find(o => o !== p.org);
    ok(otra, 'no hay otra organizacion para la prueba');
    c.G.nextFight.org = otra;
    const antes = c.G.contract.left;
    pelearYCobrar(c);
    eq(c.G.contract.left, antes,
       'una pelea de otra organizacion consumio el contrato');
  });

  test('el contador no baja de cero', () => {
    const { c } = conContrato(57);
    c.G.contract.left = 0;
    pelearYCobrar(c);
    ok(c.G.contract.left >= 0, 'contract.left quedo negativo: ' + c.G.contract.left);
  });

});

suite('F2 · G-001 los eventos importantes frenan la simulacion', () => {

  function mundo(seed){
    const h = H.boot({ seed });
    H.startCareer(h, { metaSeed: 3210, style: 'mma', div: 'LW', age: 23 });
    return { h, c: h.ctx };
  }

  /* Nota de metodo: una primera version de esta prueba exigia que apareciera un
     evento marcado `important` entre 300 sorteos. Fallaba, pero por culpa de la
     prueba: en una carrera recien creada los 10 eventos important no son
     elegibles (piden campeon, pelea firmada, edad, racha negativa...). Lo que
     hay que medir es el mecanismo, no la suerte del sorteo: para CADA evento
     sorteado, la marca del objeto encolado tiene que coincidir con la de su
     definicion. Si rollEvent la deja caer, la discrepancia sale igual. */
  test('el objeto encolado conserva la marca important de su definicion', () => {
    const { c } = mundo(61);
    let total = 0, discrepan = 0;
    const ejemplos = [];
    for(let i = 0; i < 300; i++){
      const e = c.rollEvent();
      if(!e) continue;
      const def = c.EVENTS.filter(function(x){ return x.id === e.id; })[0];
      if(!def || !('important' in def)) continue;
      total++;
      if(e.important !== def.important){
        discrepan++;
        if(ejemplos.length < 3) ejemplos.push(e.id + ': definicion ' + def.important + ' -> encolado ' + e.important);
      }
    }
    ok(total > 50, 'no se sortearon suficientes eventos con marca declarada: ' + total);
    eq(discrepan, 0, discrepan + ' de ' + total + ' eventos perdieron la marca al encolarse. ' + JSON.stringify(ejemplos));
  });

  test('un evento importante frena el avance en bloque', () => {
    const { c } = mundo(62);
    /* se encola a mano un evento del banco marcado important y se avanza */
    const def = c.EVENTS.filter(function(x){ return x.important === true && x.o && x.o.length; })[0];
    ok(def, 'el banco no tiene ningun evento marcado important');
    c.G.pending = [{ id: def.id, txt: 'prueba', opts: def.o, important: true }];
    c.advancePeriod(20);
    eq(c.G.period.stop, 'event', 'el bloque no paro ante un evento importante');
    ok(c.G.pending.length === 1, 'el evento importante se descarto en vez de frenar');
  });

  test('un evento rutinario NO frena el bloque', () => {
    /* La asimetria es deliberada: el bloque existe para saltarse la rutina. */
    const { c } = mundo(63);
    const def = c.EVENTS.filter(function(x){ return x.important !== true && x.o && x.o.length; })[0];
    ok(def, 'el banco no tiene eventos rutinarios');
    c.G.pending = [{ id: def.id, txt: 'prueba', opts: def.o }];
    c.advancePeriod(6);
    ok(c.G.period.weeks >= 1, 'el bloque no avanzo ni una semana');
  });

});

suite('F2 · H-005 el reescalado de patrocinios no compone', () => {

  /* Deja una carrera con un patrocinio y un multiplicador de audiencia fijo,
     para poder ejercer el reescalado anual de forma determinista. */
  function conPatrocinio(seed, mult){
    const h = H.boot({ seed });
    H.startCareer(h, { metaSeed: 8642, style: 'mma', div: 'LW', age: 23 });
    const c = h.ctx;
    c.G.spons = [{ n: 'Marca de prueba', week: 500 }];
    const audReal = c.CL.aud;
    c.CL.aud = function(){ const a = audReal(); a.mult = mult; return a; };
    return { h, c };
  }
  /* Fuerza el reescalado anual N veces, saltando el cerrojo onceYear. */
  function reescalarAnios(c, n){
    for(let i = 0; i < n; i++){
      const s = c.CL.S();
      if(s && s.once) delete s.once['Y' + c.G.year];
      if(s && s.once) for(const k of Object.keys(s.once)) if(k.indexOf('audSpon') >= 0) delete s.once[k];
      c.G.year++;
      c.hookEmit('week', { news: [] });
    }
    return c.G.spons[0].week;
  }

  test('diez anios con audiencia alta no disparan el ingreso', () => {
    /* Con mult=1.6 sostenido, componer da 500 * 1.6^10 = 52.428 por semana.
       Reescalar sobre el valor BASE da 800, que es lo que significa
       "los patrocinios siguen al tamano de tu publico". */
    const { c } = conPatrocinio(91, 1.6);
    const final = reescalarAnios(c, 10);
    ok(final <= 900,
      'el ingreso semanal crecio hasta ' + final + ': el reescalado esta componiendo');
    ok(final >= 700, 'el reescalado dejo de responder a la audiencia: ' + final);
  });

  test('el reescalado sigue respondiendo a la audiencia', () => {
    const alto = reescalarAnios(conPatrocinio(92, 1.6).c, 3);
    const bajo = reescalarAnios(conPatrocinio(93, 0.7).c, 3);
    ok(alto > bajo, 'mas audiencia deberia pagar mas: ' + alto + ' vs ' + bajo);
    ok(bajo < 500, 'con audiencia a la baja el ingreso deberia caer: ' + bajo);
  });

  test('un patrocinio guardado sin base no da un salto al recargar', () => {
    /* Compatibilidad: los saves existentes traen {n, week} y ninguna base.
       Adoptar el valor actual como base debe dejar el ingreso donde estaba. */
    const { c } = conPatrocinio(94, 1.0);
    const antes = c.G.spons[0].week;
    const despues = reescalarAnios(c, 1);
    eq(despues, antes, 'un patrocinio antiguo cambio de valor con multiplicador neutro');
  });

});

suite('F2 · C-001 el avance en bloque aplica el campamento', () => {

  function conCampamento(seed){
    const h = H.boot({ seed });
    H.startCareer(h, { metaSeed: 1470, style: 'mma', div: 'LW', age: 23 });
    const c = h.ctx, p = c.G.player;
    const opp = Object.values(c.G.fighters)
      .find(f => f && f.div === p.div && f.id !== p.id && !f.retired);
    c.G.nextFight = { oppId: opp.id, weeks: 10, org: p.org, title: false, purse: 5000, event: 'T' };
    c.startCamp(c.G.nextFight);
    return { h, c, p };
  }

  test('un bloque de N semanas avanza el campamento N semanas', () => {
    const { c } = conCampamento(41);
    const antes = c.G.camp.i;
    eq(antes, 0, 'el campamento no arranco en cero');
    c.advancePeriod(5);
    const corridas = c.G.period.weeks;
    ok(corridas >= 1, 'el bloque no avanzo ninguna semana');
    eq(c.G.camp.i, antes + corridas,
       'el campamento avanzo ' + (c.G.camp.i - antes) + ' de ' + corridas + ' semanas consumidas');
  });

  test('el bloque mueve sharp, peso y diario del campamento', () => {
    const { c, p } = conCampamento(42);
    const sharp0 = c.G.camp.sharp, peso0 = p.weightNow, log0 = c.G.camp.log.length;
    c.advancePeriod(4);
    const corridas = c.G.period.weeks;
    ok(c.G.camp.sharp !== sharp0, 'el afilado del campamento no se movio');
    ok(p.weightNow < peso0, 'el corte de peso no avanzo: ' + peso0 + ' -> ' + p.weightNow);
    eq(c.G.camp.log.length, log0 + corridas, 'el diario no recibio una entrada por semana');
  });

  test('sin campamento el bloque sigue entrenando igual', () => {
    /* La correccion no puede cambiar el avance fuera de campamento. */
    const h = H.boot({ seed: 43 });
    H.startCareer(h, { metaSeed: 1471, style: 'mma', div: 'LW', age: 23 });
    const c = h.ctx;
    eq(c.G.camp, null, 'el caso de prueba no aplica: hay campamento');
    const st0 = JSON.stringify(c.G.player.st);
    c.advancePeriod(4);
    ok(c.G.period.weeks >= 1, 'el bloque no avanzo');
    ok(JSON.stringify(c.G.player.st) !== st0, 'el bloque no entreno nada sin campamento');
  });

});

suite('F2 · B-001 dibujar no consume el RNG del mundo', () => {

  function enPelea(seed){
    const h = H.boot({ seed });
    H.startCareer(h, { metaSeed: 9630, style: 'mma', div: 'LW', age: 23 });
    const c = h.ctx, p = c.G.player;
    const opp = Object.values(c.G.fighters)
      .find(f => f && f.div === p.div && f.id !== p.id && !f.retired);
    c.G.nextFight = { oppId: opp.id, weeks: 0, org: p.org, title: false, purse: 5000, event: 'T' };
    c.startCamp(c.G.nextFight); c.G.camp.i = c.G.camp.weeks;
    c.goFight();
    return { h, c, p };
  }

  test('el consejo de esquina no mueve G.rs', () => {
    const { c } = enPelea(71);
    c.UI.sub = 'corner';
    const rs0 = c.G.rs;
    c.render(); c.render(); c.render();
    eq(c.G.rs, rs0, 'dibujar el panel de esquina consumio el flujo aleatorio del mundo');
  });

  test('la frase del entrenador tras la pelea no mueve G.rs', () => {
    const { c } = enPelea(72);
    let g = 0;
    while(c.G.fight && !c.G.fight.over && g++ < 600){
      const o = c.fightOptions();
      if(!o.length){ c.finishFight('dec', null); break; }
      c.fightAct(o[0].k);
    }
    eq(c.UI.screen, 'fightresult', 'la pelea no dejo la pantalla de resultado');
    const rs0 = c.G.rs;
    c.render(); c.render(); c.render();
    eq(c.G.rs, rs0, 'dibujar el resultado consumio el flujo aleatorio del mundo');
  });

  test('el texto sigue siendo estable dentro del mismo contexto', () => {
    const { c } = enPelea(73);
    c.UI.sub = 'corner';
    const a = c.cornerAdvice(), b = c.cornerAdvice();
    eq(a, b, 'el mismo contexto da dos consejos distintos');
    ok(a && a.length > 10, 'el consejo salio vacio: ' + JSON.stringify(a));
  });

  test('el texto sigue variando entre contextos distintos', () => {
    /* La correccion no puede convertir el texto en una constante. */
    const vistos = new Set();
    for(const seed of [74, 75, 76, 77, 78, 79]){
      const { c } = enPelea(seed);
      /* se fuerzan estados de pelea distintos para que el abanico se abra */
      c.G.fight.p.stam = 20 + (seed % 3) * 30;
      c.G.fight.p.hp   = 40 + (seed % 2) * 40;
      c.G.fight.round  = 1 + (seed % 4);
      vistos.add(c.cornerAdvice());
    }
    ok(vistos.size >= 2, 'el consejo quedo constante en 6 contextos distintos');
  });

  test('sin render, la simulacion da el mismo resultado que con render', () => {
    /* Es la prueba de fondo: si dibujar no toca el mundo, stubear render no
       puede cambiar la partida. Antes cambiaba la huella, el record y el
       numero de peleas. */
    const A = require('../autopilot.js');
    const corre = (stub) => {
      const h = H.boot({ seed: 80 });
      H.startCareer(h, { metaSeed: 9631, style: 'mma', div: 'LW', age: 22 });
      if(stub) h.ctx.render = function(){};
      A.correrCarrera(h, { maxWeeks: 60, politica: 'basica', seedPolitica: 80 });
      return h.call('STATE.fingerprint', true);
    };
    eq(corre(true), corre(false), 'dibujar sigue cambiando el resultado de la partida');
  });

});

suite('F2 · D-002 aplicar el resultado es todo-o-nada', () => {

  function peleaLista(seed){
    const h = H.boot({ seed });
    H.startCareer(h, { metaSeed: 3579, style: 'mma', div: 'LW', age: 22 });
    const c = h.ctx, p = c.G.player;
    const opp = Object.values(c.G.fighters)
      .find(f => f && f.div === p.div && f.id !== p.id && !f.retired);
    c.G.nextFight = { oppId: opp.id, weeks: 0, org: p.org, title: false, purse: 8000, event: 'T' };
    c.startCamp(c.G.nextFight); c.G.camp.i = c.G.camp.weeks;
    c.goFight();
    let g = 0;
    while(c.G.fight && !c.G.fight.over && g++ < 600){
      const o = c.fightOptions();
      if(!o.length){ c.finishFight('dec', null); break; }
      c.fightAct(o[0].k);
    }
    return { h, c, p };
  }
  const foto = (c) => JSON.stringify({
    rec: c.G.player.rec, cash: Math.round(c.G.cash),
    career: c.G.player.career.length, pop: Math.round(c.G.player.pop),
    nextFight: !!c.G.nextFight,
  });

  test('si algo falla a mitad, no queda estado aplicado a medias', () => {
    const { c } = peleaLista(81);
    const antes = foto(c);
    /* se rompe una funcion del medio del pipeline, despues de que el record y
       la bolsa ya se hayan tocado */
    const orig = c.changePopularity;
    c.changePopularity = function(){ throw new Error('fallo inyectado'); };
    let lanzo = false;
    try { c.confirmFight(); } catch(e){ lanzo = true; }
    c.changePopularity = orig;

    ok(lanzo, 'el fallo inyectado no se propago: la prueba no aplica');
    eq(foto(c), antes, 'quedo estado aplicado a medias tras el fallo');
    eq(c.G.paid, false, 'la pelea quedo marcada como cobrada pese al fallo');
    ok(c.G.fight && c.G.fight.result, 'se perdio el resultado de la pelea');
  });

  test('tras el fallo, reintentar cobra exactamente una vez', () => {
    const { c } = peleaLista(82);
    const antes = foto(c);
    const orig = c.changePopularity;
    c.changePopularity = function(){ throw new Error('fallo inyectado'); };
    try { c.confirmFight(); } catch(e){}
    c.changePopularity = orig;
    eq(foto(c), antes, 'el estado no volvio a su sitio antes de reintentar');

    c.confirmFight();
    ok(c.G.paid, 'el reintento no cobro la pelea');
    eq(c.G.player.career.length, 1, 'el historial no tiene exactamente una pelea');
    eq(c.G.player.rec.w + c.G.player.rec.l + c.G.player.rec.d, 1,
       'el record no suma exactamente una pelea');
  });

  test('el camino normal sigue aplicando el resultado', () => {
    const { c } = peleaLista(83);
    c.confirmFight();
    ok(c.G.paid, 'no se cobro la pelea');
    eq(c.G.player.career.length, 1, 'el historial no registro la pelea');
    eq(c.G.nextFight, null, 'la pelea firmada no se limpio');
  });

});

suite('F2 · G-002 la puerta de drama vuelve a aplicarse', () => {

  /* Escenario REAL, no sintetico: un novato que acaba de firmar su primera
     pelea y lleva tres semanas de campamento. Ahi `dramaOk` es falso (0 peleas
     jugadas, pop baja, semana 3) y a la vez `sg_counterplan` es elegible,
     porque su condicion pide campamento con `i>=2`. Medido en 10 carreras x 120 semanas: 4 de 328 eventos del
     banco eran drama con la puerta cerrada, todos de este tipo.
     Una primera version de esta prueba forzaba rec.w=5 con lastFights=[], un
     estado que el juego nunca produce; pasaba sin arreglar nada y por tanto no
     medía nada. */
  function novatoConPeleaFirmada(seed){
    const h = H.boot({ seed });
    H.startCareer(h, { metaSeed: 2580, style: 'mma', div: 'LW', age: 22 });
    const c = h.ctx, p = c.G.player;
    const opp = Object.values(c.G.fighters)
      .find(f => f && f.div === p.div && f.id !== p.id && !f.retired);
    c.G.nextFight = { oppId: opp.id, weeks: 8, org: p.org, title: false, purse: 4000, event: 'T' };
    c.startCamp(c.G.nextFight);
    c.G.camp.i = 3;            /* tercera semana de campamento: sg_counterplan pide i>=2 */
    return { h, c, p };
  }
  const esDrama = (c, id) => {
    const d = c.EVENTS.filter(function(x){ return x.id === id; })[0];
    return !!(d && d.drama);
  };

  test('un novato con su primera pelea firmada no recibe drama', () => {
    const { c } = novatoConPeleaFirmada(51);
    eq(c.CL.dramaOk(), false, 'el caso de prueba no aplica: dramaOk es verdadero');
    const elegibles = c.EVENTS.filter(function(e){
      if(!e.drama) return false;
      try { return !e.c || e.c(); } catch(x){ return false; }
    });
    ok(elegibles.length > 0,
      'el caso de prueba no aplica: ningun evento de drama es elegible en este estado');

    let drama = 0; const ejemplos = {};
    for(let i = 0; i < 600; i++){
      const e = c.rollEvent();
      if(!e) continue;
      if(esDrama(c, e.id)){ drama++; ejemplos[e.id] = (ejemplos[e.id] || 0) + 1; }
    }
    eq(drama, 0, 'salieron ' + drama + ' eventos de drama con la puerta cerrada: ' + JSON.stringify(ejemplos));
  });

  test('un peleador hecho SI recibe drama', () => {
    /* La puerta no puede quedarse cerrada para siempre. */
    const { c, p } = novatoConPeleaFirmada(52);
    p.lastFights = [{}, {}, {}]; p.pop = 60; c.G.week = 40;
    eq(c.CL.dramaOk(), true, 'dramaOk sigue en falso con un peleador hecho');
    let drama = 0;
    for(let i = 0; i < 600; i++){
      const e = c.rollEvent();
      if(e && esDrama(c, e.id)) drama++;
    }
    ok(drama > 0, 'un peleador hecho no recibio ni un evento de drama en 600 sorteos');
  });

  test('el novato sigue recibiendo eventos, no se queda sin nada', () => {
    const { c } = novatoConPeleaFirmada(53);
    let total = 0;
    for(let i = 0; i < 200; i++) if(c.rollEvent()) total++;
    ok(total > 100, 'cerrar la puerta de drama dejo al novato casi sin eventos: ' + total);
  });

});

suite('F2 · F-002 la copia de respaldo pre-migracion existe', () => {

  /* Inyecta una fixture reetiquetada a una version antigua y la carga. */
  function cargaVersion(seed, version){
    const fs = require('node:fs'), path = require('node:path');
    const cuerpo = fs.readFileSync(
      path.join(__dirname, '..', 'fixtures', '03-mitad-carrera.json'), 'utf8');
    const obj = JSON.parse(cuerpo);
    obj.saveVersion = version;
    const raw = JSON.stringify(obj);

    const h = H.boot({ seed });
    const c = h.ctx;
    const id = 's-mig-' + version;
    c.localStorage.setItem(c.SAVE_ONE + id, raw);
    const idx = c.saveIndex();
    idx[id] = { name: 'fixture', rec: '0-0', div: '—', org: '—', when: '—',
                cash: 0, v: version, at: Date.now(), kb: Math.round(raw.length / 1024) };
    c.localStorage.setItem(c.SAVE_IDX, JSON.stringify(idx));
    const ok = c.loadGame(id);
    return { h, c, id, ok, raw };
  }

  test('cargar un save antiguo deja una copia intacta del original', () => {
    const { c, id, ok, raw } = cargaVersion(101, 2);
    ok2(ok, 'no se pudo cargar la fixture reetiquetada a v2');
    const copia = c.localStorage.getItem(c.SAVE_BAK + id);
    ok2(copia !== null, 'no se escribio la copia de respaldo antes de migrar');
    eq(copia, raw, 'la copia de respaldo no es el original intacto');
    /* y el slot si quedo reescrito en la version nueva */
    const enDisco = JSON.parse(c.localStorage.getItem(c.SAVE_ONE + id));
    eq(enDisco.saveVersion, c.SAVE_VERSION, 'el slot no quedo migrado');
  });

  test('cargar un save ya al dia no deja copia', () => {
    /* No tiene sentido duplicar cada partida en cada carga. */
    const { c, id, ok } = cargaVersion(102, 4);
    ok2(ok, 'no se pudo cargar la fixture v4');
    eq(c.localStorage.getItem(c.SAVE_BAK + id), null,
       'se escribio una copia de respaldo sin haber migrado nada');
  });

  function ok2(cond, msg){ ok(cond, msg); }
});

suite('F2 · I-002 el campeon fantasma', () => {

  function mundo(seed){
    const h = H.boot({ seed });
    H.startCareer(h, { metaSeed: 1928, style: 'mma', div: 'LW', age: 23 });
    return { h, c: h.ctx };
  }
  const campeonDe = (c, org, div) => {
    const id = c.G.champs[org] && c.G.champs[org][div];
    return id ? c.G.fighters[id] : null;
  };

  test('un campeon que cambia de organizacion deja el cinturon vacante', () => {
    const { c } = mundo(111);
    const org = 'VAN', div = 'HW';
    const ch = campeonDe(c, org, div);
    ok(ch, 'no hay campeon de ' + org + '/' + div + ' para la prueba');
    /* el ascenso de organizacion que hace yearTick: cambia f.org y no toca el cinturon */
    ch.org = 'RFL';
    c.rebuildRosters();
    c.recalcRank(org, div);
    eq(c.G.champs[org][div], null,
       'el cinturon de ' + org + '/' + div + ' sigue en manos de alguien que ya no compite ahi');
  });

  test('un campeon en su propia organizacion conserva el cinturon', () => {
    const { c } = mundo(112);
    const org = 'VAN', div = 'LHW';
    const ch = campeonDe(c, org, div);
    ok(ch, 'no hay campeon de ' + org + '/' + div + ' para la prueba');
    eq(ch.org, org, 'el campeon de la prueba no milita en su organizacion');
    c.recalcRank(org, div);
    eq(c.G.champs[org][div], ch.id, 'se vacio el cinturon de un campeon valido');
  });

  test('la division abandonada puede volver a coronar', () => {
    /* El dano real de I-002: worldTick solo organiza pelea por titulo vacante
       si G.champs[org][div] es falsy, asi que un cinturon fantasma congela la
       division para siempre. */
    const { c } = mundo(113);
    const org = 'VAN', div = 'HW';
    const ch = campeonDe(c, org, div);
    ok(ch, 'no hay campeon para la prueba');
    ch.org = 'TFC';
    c.rebuildRosters();
    c.recalcRank(org, div);
    eq(c.G.champs[org][div], null, 'el cinturon quedo congelado');
  });

});
