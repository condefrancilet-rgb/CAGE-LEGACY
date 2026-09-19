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
