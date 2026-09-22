'use strict';
/* E4 · LA RED DEL ROLLBACK — SE ESCRIBE ANTES DE TOCAR TX.snapshot
   ---------------------------------------------------------------------------
   El perfilador dice que TX.snapshot es el 42,5 % de advanceWeek: un
   JSON.stringify(G) de la partida entera, cada semana. Es el candidato numero
   uno de E4. Pero NO es grasa: es el mecanismo que hace que una semana sea
   todo-o-nada. Se optimiza COMO se hace, nunca SI se hace.

   Para poder cambiarlo con las manos firmes hace falta una red que pruebe la
   propiedad, no la implementacion: si algo falla a mitad de semana, el estado
   persistible tiene que quedar EXACTAMENTE como estaba. Eso es lo que mide
   esto, inyectando el fallo a cuatro profundidades distintas del avance.

   La comparacion es doble a proposito:
     · la huella (STATE.fingerprint) para el veredicto,
     · un diff profundo de STATE.persistable(G) para poder decir QUE cambio.
   Una huella distinta sin saber que campo se movio no sirve para arreglar
   nada.                                                                     */
const { suite, test, ok, eq } = require('../run-tests.js');
const H = require('../harness.js');

const ARCHIVO = process.env.CAGE_FILE || undefined;

function partida(seed){
  const h = H.boot({ seed, file: ARCHIVO });
  H.startCareer(h, { metaSeed: 5000 + seed, style:'mma', div:'LW', age:22 });
  const c = h.ctx;
  for(let i=0;i<10;i++){ try{ c.advanceWeek(); }catch(e){} }
  return c;
}
/* foto exacta del estado que la partida promete conservar */
function foto(c){
  return { json: JSON.stringify(c.STATE.persistable(c.G)), fp: c.STATE.fingerprint(true) };
}
/* primeras diferencias entre dos JSON de estado, con su ruta */
function diff(aJson, bJson, max){
  const a = JSON.parse(aJson), b = JSON.parse(bJson), out = [];
  (function rec(x, y, ruta){
    if(out.length >= (max||6)) return;
    if(x === y) return;
    const tx = Object.prototype.toString.call(x), ty = Object.prototype.toString.call(y);
    if(tx !== ty){ out.push(ruta + ': ' + tx + ' -> ' + ty); return; }
    if(tx === '[object Object]' || tx === '[object Array]'){
      const ks = new Set([...Object.keys(x||{}), ...Object.keys(y||{})]);
      for(const k of ks) rec(x ? x[k] : undefined, y ? y[k] : undefined, ruta ? ruta+'.'+k : k);
      return;
    }
    if(JSON.stringify(x) !== JSON.stringify(y)) out.push(ruta + ': ' + JSON.stringify(x) + ' -> ' + JSON.stringify(y));
  })(a, b, '');
  return out;
}

/* DOS POLITICAS, NO UNA. Esto lo aprendi rompiendo la red, no leyendo:
     · un fallo en una LLAMADA DIRECTA de advanceWeekCore sube hasta TX.run y
       deshace la semana entera;
     · un fallo en un ENGANCHE de 'week' NO deshace nada: hookRun aisla el
       enganche, anota el error y sigue con los demas. Es politica deliberada
       (HOOK_ABORT enumera los eventos que SI abortan), no un descuido.
   Mis dos primeras inyecciones apuntaban a enganches y el test fallo diciendo
   "el rollback dejo 6 campos cambiados". No estaba roto el rollback: estaba
   mal la inyeccion. La red ahora fija LAS DOS politicas por separado.       */
const PUNTOS = [
  ['worldTick (justo despues de G.week++)', c => { c.worldTick = function(){ throw new Error('fallo inyectado: worldTick'); }; }],
  ['historicalUfcTick',                     c => { c.historicalUfcTick = function(){ throw new Error('fallo inyectado: historicalUfcTick'); }; }],
  ['queueEvent (cola de eventos)',          c => { c.queueEvent = function(){ throw new Error('fallo inyectado: queueEvent'); }; }],
  ['teamCost (dentro de la economia)',      c => { c.teamCost = function(){ throw new Error('fallo inyectado: teamCost'); }; }],
];

suite('E4 · rollback: una semana es todo-o-nada', () => {

  /* Sin este control, todo lo de abajo pasaria aunque advanceWeek no hiciera
     nada: "el estado no cambio" es trivial si la semana no hace nada. */
  test('control: una semana SIN fallo si cambia el estado', () => {
    const c = partida(11);
    const antes = foto(c);
    c.advanceWeek();
    const despues = foto(c);
    ok(antes.json !== despues.json, 'avanzar una semana no cambio el estado persistible');
    ok(antes.fp !== despues.fp, 'avanzar una semana no cambio la huella');
  });

  for(let i = 0; i < PUNTOS.length; i++){
    const [donde, romper] = PUNTOS[i];
    test('fallo en ' + donde + ' → el estado queda identico', () => {
      const c = partida(21 + i);
      const antes = foto(c);
      romper(c);
      c.advanceWeek();                       /* TX.run lo captura: no relanza */
      const despues = foto(c);
      const d = diff(antes.json, despues.json);
      ok(d.length === 0, 'el rollback dejo ' + d.length + ' campos cambiados:\n      ' + d.join('\n      '));
      eq(despues.fp, antes.fp, 'la huella cambio tras el rollback');
    }, { seed: 21 + i });
  }

  test('el fallo se registra, no se silencia', () => {
    const c = partida(31);
    const rbAntes = c.STATE.stats.txRollback;
    c.worldTick = function(){ throw new Error('fallo inyectado: worldTick'); };
    c.advanceWeek();
    ok(c.TX.lastError && /worldTick/.test(c.TX.lastError.message),
       'TX.lastError no quedo con el fallo: ' + JSON.stringify(c.TX.lastError));
    eq(c.TX.lastError.name, 'advanceWeek', 'el rollback no se atribuyo a advanceWeek');
    ok(c.STATE.stats.txRollback === rbAntes + 1,
       'no se conto el rollback: ' + rbAntes + ' -> ' + c.STATE.stats.txRollback);
  });

  test('tras el rollback la partida sigue viva y avanza una sola semana', () => {
    const c = partida(41);
    const semana0 = c.G.year*52 + c.G.week;
    const original = c.worldTick;
    c.worldTick = function(){ throw new Error('fallo inyectado: worldTick'); };
    c.advanceWeek();
    eq(c.G.year*52 + c.G.week, semana0, 'el reloj avanzo pese al rollback');
    c.worldTick = original;                  /* se repara y se reintenta */
    let lanzo = false;
    try { c.advanceWeek(); } catch(e){ lanzo = true; }
    ok(!lanzo, 'tras el rollback, avanzar la semana lanza');
    eq(c.G.year*52 + c.G.week, semana0 + 1, 'la semana reintentada no avanzo exactamente uno');
  });

  /* Si el comparador no distingue, todo lo de arriba es decorativo. */
  /* Dos agujeros que encontre mutando MI PROPIA red, no el juego: con las
     cuatro inyecciones de arriba, MR3 (restore deja de borrar las claves que
     sobran) y MR4 (restore olvida G.pending) pasaban en VERDE. No porque el
     rollback estuviera bien, sino porque ninguno de mis escenarios agregaba
     una clave ni tocaba la cola. Un mutante que no se pone rojo es un hueco
     en la red, aunque el codigo este bien. */

  test('una clave que la semana fallida AGREGA no sobrevive al rollback', () => {
    const c = partida(81);
    const antes = foto(c);
    c.worldTick = function(){
      c.G.__basuraDeLaSemana = { dejado: 'por una semana que fallo' };
      throw new Error('fallo inyectado: worldTick despues de ensuciar G');
    };
    c.advanceWeek();
    ok(!('__basuraDeLaSemana' in c.G),
       'la clave agregada por la semana fallida sigue en G tras el rollback');
    const d = diff(antes.json, foto(c).json);
    ok(d.length === 0, 'el rollback dejo ' + d.length + ' campos cambiados:\n      ' + d.join('\n      '));
  });

  test('la cola de eventos vuelve entera, con sus manejadores vivos', () => {
    /* G.pending es el unico sitio donde el estado lleva FUNCIONES, y por eso
       el snapshot lo guarda aparte: JSON.stringify las perderia. Si el rollback
       repusiera el JSON a secas, la cola volveria sin manejadores y el evento
       quedaria imposible de resolver. */
    const c = partida(91);
    let llamado = 0;
    c.G.pending = [{ id:'__prueba', t:'evento de prueba',
                     opts:[{ t:'Aceptar', f: function(){ llamado++; } }] }];
    const antes = foto(c);
    c.worldTick = function(){
      c.G.pending.shift();                    /* la semana consume el evento */
      c.G.pending.push({ id:'__otro', t:'otro', opts:[] });
      throw new Error('fallo inyectado: worldTick despues de tocar la cola');
    };
    c.advanceWeek();
    eq(c.G.pending.length, 1, 'la cola no volvio a su largo original');
    eq(c.G.pending[0].id, '__prueba', 'la cola volvio con otro evento');
    ok(typeof c.G.pending[0].opts[0].f === 'function',
       'el manejador del evento se perdio en el rollback');
    c.G.pending[0].opts[0].f();
    eq(llamado, 1, 'el manejador repuesto no es el original');
    const d = diff(antes.json, foto(c).json);
    ok(d.length === 0, 'el rollback dejo ' + d.length + ' campos cambiados:\n      ' + d.join('\n      '));
  });

  test('tras el rollback G.player sigue siendo EL MISMO objeto del plantel', () => {
    /* Tercer agujero de mi red, encontrado mutando: si restore repusiera
       G.player desde el JSON en vez de reapuntarlo a G.fighters[id], los dos
       serian iguales campo a campo y distintos como objeto. El diff no lo ve
       -JSON identico- pero el juego si: a partir de ahi, tocar al jugador deja
       de verse en el plantel y el mundo pelea contra una copia congelada. */
    const c = partida(101);
    c.worldTick = function(){ throw new Error('fallo inyectado: worldTick'); };
    c.advanceWeek();
    const id = c.G.player.id;
    ok(c.G.fighters[id] === c.G.player,
       'G.player quedo desconectado del plantel tras el rollback (mismo contenido, otro objeto)');
    /* y se comprueba de verdad, moviendo uno y mirando el otro */
    c.G.player.pop = c.G.player.pop + 1;
    eq(c.G.fighters[id].pop, c.G.player.pop, 'mover al jugador ya no se ve en el plantel');
  });

  /* --- la otra politica, fijada a proposito --- */
  test('un enganche semanal que falla NO deshace la semana: se aisla y se anota', () => {
    const c = partida(61);
    const fallos0 = c.safeInt(c.G.hookFails, 0);
    const semana0 = c.G.year*52 + c.G.week;
    const rb0 = c.STATE.stats.txRollback;
    c.CL.on('week','__fallo_inyectado', function(){ throw new Error('fallo inyectado: hook semanal'); }, 1);
    c.advanceWeek();
    eq(c.G.year*52 + c.G.week, semana0 + 1, 'un enganche roto deshizo la semana (deberia aislarse)');
    ok(c.safeInt(c.G.hookFails,0) > fallos0, 'el fallo del enganche no se conto en G.hookFails');
    eq(c.STATE.stats.txRollback, rb0, 'hubo rollback donde la politica dice aislar');
  });

  test('un enganche de un evento que ABORTA si deshace la semana', () => {
    /* 'normalize' esta en HOOK_ABORT y se emite una vez por semana: es el caso
       que el comentario de hookRun describe —un evento que aisla no puede
       tragarse el aborto de uno anidado que exige integridad—. */
    const c = partida(71);
    ok(c.HOOK_ABORT && c.HOOK_ABORT['normalize'], "'normalize' dejo de estar en HOOK_ABORT");
    const antes = foto(c);
    const rb0 = c.STATE.stats.txRollback;
    c.hookOn('normalize','__fallo_inyectado', function(){ throw new Error('fallo inyectado: normalize'); }, 1);
    c.advanceWeek();
    ok(c.STATE.stats.txRollback === rb0 + 1,
       'un evento que ABORTA no provoco rollback: ' + rb0 + ' -> ' + c.STATE.stats.txRollback);
    const d = diff(antes.json, foto(c).json);
    ok(d.length === 0, 'el rollback del evento que aborta dejo ' + d.length + ' campos cambiados:\n      ' + d.join('\n      '));
  });

  test('el comparador es sensible: un solo campo movido se detecta', () => {
    const c = partida(51);
    const antes = foto(c);
    c.G.cash = c.G.cash + 1;
    const despues = foto(c);
    const d = diff(antes.json, despues.json);
    ok(d.length === 1 && /^cash: /.test(d[0]), 'el diff no vio el cambio de cash: ' + JSON.stringify(d));
    ok(antes.fp !== despues.fp, 'la huella no vio el cambio de cash');
  });

});
