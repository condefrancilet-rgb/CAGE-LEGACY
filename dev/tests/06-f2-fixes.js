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
