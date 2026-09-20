'use strict';
/* CARACTERIZACION de savePrune antes de consolidar sus 2 capas.
   Describe lo que hace HOY, no lo que deberia hacer.

   Medido antes de escribirlas, instrumentando cada llamada real durante la
   carrera (al final no sirve: savePrune corre en cada autoguardado, asi que
   medir el estado final da 0 y miente):

     seed 13 -> 429 llamadas · 3400 campos redondeados · 60 rel · 979 arrays
                truncados · 187 podas de news · 0 de retiredList
     seed 29 -> 421 llamadas · 3389 campos redondeados · 50 rel · 977 arrays
                truncados · 194 podas de news · 0 de retiredList

   Las DOS capas hacen trabajo real; ninguna es peso muerto. Lo que si esta
   escrito dos veces es el recorrido y la regla "al jugador no se le toca",
   que es la que impide que guardar le destruya el historial: medido, un
   jugador de 250 semanas tiene career=22 y lastFights=12, y sin esa regla la
   poda se los dejaria en 12 y 6.                                            */
const { suite, test, ok, eq } = require('../run-tests.js');
const H = require('../harness.js');

suite('savePrune (caracterizacion)', () => {

  function mundo(seed){
    const h = H.boot({ seed });
    H.startCareer(h, { metaSeed: 5150, style: 'mma', div: 'LW', age: 22 });
    return { h, c: h.ctx };
  }
  const npcDe = c => {
    const pid = c.G.player.id;
    return Object.keys(c.G.fighters).filter(id => id !== pid).map(id => c.G.fighters[id])[0];
  };

  test('al jugador no se le toca nada', () => {
    const { c } = mundo(1301);
    const p = c.G.player;
    p.career     = Array.from({length: 40}, (_, i) => ({ i }));
    p.lastFights = Array.from({length: 30}, (_, i) => ({ i }));
    p.mem        = Array.from({length: 25}, (_, i) => ({ i }));
    p.pop = 51.5555;
    c.savePrune(c.G);
    eq(p.career.length, 40, 'la poda trunco el historial del jugador');
    eq(p.lastFights.length, 30, 'la poda trunco las ultimas peleas del jugador');
    eq(p.mem.length, 25, 'la poda trunco la memoria del jugador');
    eq(p.pop, 51.5555, 'la poda redondeo un campo del jugador');
  });

  test('a los NPC les trunca los arrays con los limites de hoy', () => {
    const { c } = mundo(1302);
    const f = npcDe(c);
    f.career     = Array.from({length: 40}, (_, i) => ({ i }));
    f.lastFights = Array.from({length: 30}, (_, i) => ({ i }));
    f.mem        = Array.from({length: 25}, (_, i) => ({ i }));
    f.bond = { hist: Array.from({length: 22}, (_, i) => ({ i })) };
    c.savePrune(c.G);
    eq(f.career.length, 12,     'career deberia quedar en 12');
    eq(f.lastFights.length, 6,  'lastFights deberia quedar en 6');
    eq(f.mem.length, 8,         'mem deberia quedar en 8');
    eq(f.bond.hist.length, 10,  'bond.hist deberia quedar en 10');
  });

  test('trunca por el extremo correcto: lo reciente se conserva', () => {
    const { c } = mundo(1303);
    const f = npcDe(c);
    /* lastFights y career se cortan por el final (slice(-n)): lo viejo se va.
       mem y bond.hist se cortan por el principio (slice(0,n)): esas listas
       llevan lo reciente delante. */
    f.lastFights = Array.from({length: 30}, (_, i) => i);
    f.career     = Array.from({length: 40}, (_, i) => i);
    f.mem        = Array.from({length: 25}, (_, i) => i);
    f.bond       = { hist: Array.from({length: 22}, (_, i) => i) };
    c.savePrune(c.G);
    eq(f.lastFights[0], 24, 'lastFights no conservo las 6 ultimas');
    eq(f.career[0], 28,     'career no conservo las 12 ultimas');
    eq(f.mem[0], 0,         'mem no conservo las 8 primeras');
    eq(f.bond.hist[0], 0,   'bond.hist no conservo las 10 primeras');
  });

  test('a los NPC les redondea los decimales', () => {
    const { c } = mundo(1304);
    const f = npcDe(c);
    f.pop = 51.5555; f.rep = 33.3333; f.fatigue = 12.9876;
    f.weightNow = 70.4444; f.divAdapt = 1.23456;
    f.rel = { trust: 44.6, friend: 22.4 };
    c.savePrune(c.G);
    eq(f.pop, 51.6,       'pop no quedo a un decimal');
    eq(f.rep, 33.3,       'rep no quedo a un decimal');
    eq(f.fatigue, 13,     'fatigue no quedo a un decimal');
    eq(f.weightNow, 70.4, 'weightNow no quedo a un decimal');
    eq(f.divAdapt, 1.2,   'divAdapt no quedo a un decimal');
    eq(f.rel.trust, 45,   'rel.trust no quedo entero');
    eq(f.rel.friend, 22,  'rel.friend no quedo entero');
  });

  test('poda news a 40 y retiredList a 60', () => {
    const { c } = mundo(1305);
    c.G.news        = Array.from({length: 120}, (_, i) => 'n' + i);
    c.G.retiredList = Array.from({length: 150}, (_, i) => ({ i }));
    c.savePrune(c.G);
    eq(c.G.news.length, 40,         'news deberia quedar en 40');
    eq(c.G.retiredList.length, 60,  'retiredList deberia quedar en 60');
    eq(c.G.news[0], 'n0',           'news no conservo las 40 primeras');
  });

  test('sin g.fighters no poda news ni retiredList (comportamiento de hoy)', () => {
    /* Rareza latente, NO un arreglo: las dos podas de arriba viven dentro del
       mismo guardia que el recorrido de luchadores. Se fija para que una
       fusion no la "arregle" en silencio: arreglarlo es cambio de
       comportamiento y necesita su propia evidencia. */
    const { c } = mundo(1306);
    const g = { player: { id: 'p' }, news: Array.from({length: 120}, (_, i) => i),
                retiredList: Array.from({length: 150}, (_, i) => i) };
    c.savePrune(g);
    eq(g.news.length, 120,        'hoy sin fighters news no se poda');
    eq(g.retiredList.length, 150, 'hoy sin fighters retiredList no se poda');
  });

  test('devuelve el mismo objeto que recibe', () => {
    const { c } = mundo(1307);
    const g = c.G;
    eq(c.savePrune(g), g, 'savePrune deberia devolver el mismo g');
  });

});
