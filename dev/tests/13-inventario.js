'use strict';
/* E3 · NADA SE PIERDE
   El inicio se va a reorganizar: bloques que hoy estan en el hub van a vivir
   en otras pantallas. Esta red exige que la reorganizacion sea un MOVIMIENTO y
   no una amputacion: cada accion que hoy se puede disparar desde el inicio
   tiene que seguir alcanzable despues, y a no mas de dos toques de distancia.

   El fixture (dev/fixtures/e3/inventario-inicio.json) se congela a mano con
   dev/make-inventario.js. NO se regenera en la suite: un fixture que se
   regenera solo no prueba nada -- se adapta a lo que rompiste.             */
const { suite, test, ok, eq } = require('../run-tests.js');
const H = require('../harness.js');
const fs = require('node:fs');
const path = require('node:path');

const FIX = process.env.CAGE_FIX ||
            path.join(__dirname, '..', 'fixtures', 'e3', 'inventario-inicio.json');
/* CAGE_FILE apunta la red a otra copia del juego. Existe para poder
   VERIFICAR la red con mutantes: se muta una copia, se corre esta suite contra
   ella y tiene que ponerse roja. Sin esa comprobacion la red no vale nada.  */
const ARCHIVO = process.env.CAGE_FILE || undefined;
const SAVE = path.join(__dirname, '..', 'perf', 'congelado', 'save-referencia.json');

/* SOLO los ids de posts del feed (fp3, fp8...), que se generan en cada
   arranque y cambian con la semilla: pinchar storyReact('fp8',3) hacia fallar
   la red por un post que no existia en otro arranque.
   Los ids de gimnasios, entrenadores y managers NO se canonizan: salen de
   tablas fijas y son estables, y generalizarlos perderia la garantia de que
   cada opcion concreta sigue alcanzable. Mi primer regex se los comia todos. */
function canon(oc){
  return String(oc).replace(/'fp\d+'/g, "'*'");
}

/* Misma extraccion que el generador del fixture. */
function acciones(html){
  const out = new Set();
  const re = /<button[^>]*onclick="([^"]*)"/g;
  let m; while((m = re.exec(html))) out.add(canon(m[1].trim()));
  return out;
}
/* Adonde lleva una pantalla: destinos de go('X') y de la barra inferior. */
const BARRA = ['hub','train','rank','people','menu'];
function destinos(html){
  const out = new Set();
  const re = /go\(\s*'([a-zA-Z0-9_]+)'/g;
  let m; while((m = re.exec(html))) out.add(m[1]);
  return out;
}

function estadoSemana(){
  const c = H.boot({ seed: 7, file: ARCHIVO }).ctx;
  c.startCareer();
  for(let i=0;i<12;i++){ try{ c.advanceWeek(); }catch(e){} }
  c.G.pending = [];
  return c;
}
function estadoPelea(){
  const c = H.boot({ seed: 8, file: ARCHIVO }).ctx;
  const crudo = fs.readFileSync(SAVE, 'utf8');
  const id = 's1789970254602';
  c.localStorage.setItem(c.SAVE_ONE + id, crudo);
  const idx = c.saveIndex();
  idx[id] = { name:'referencia', rec:'7-4', div:'', org:'', when:'congelado',
              cash:0, v:c.SAVE_VERSION, at:Date.now(), kb:1 };
  c.saveIndexWrite(idx);
  if(!c.loadGame(id)) throw new Error('el save congelado no carga');
  c.G.pending = [];
  return c;
}
/* HTML de una pantalla del alcance, en un contexto ya preparado. */
function pinta(c, nombre){
  if(nombre === 'hub') return c.scrHub();
  const e = c.CL.SCREENS[nombre];
  if(!e) throw new Error('pantalla desconocida en el alcance: ' + nombre);
  c.UI.screen = nombre; c.UI.sub = null;
  const h = e.fn();
  return h == null ? '' : h;
}

function redDeInventario(FIX, etiqueta, MINIMO, MIN_PELEA, MIN_SEMANA){
suite('E3 · nada se pierde (' + etiqueta + ')', () => {

  test('el fixture del inventario existe y no esta vacio', () => {
    ok(fs.existsSync(FIX), 'falta el fixture ' + FIX);
    const f = JSON.parse(fs.readFileSync(FIX, 'utf8'));
    ok(Array.isArray(f.acciones) && f.acciones.length >= MINIMO,
       'el fixture tiene ' + (f.acciones||[]).length + ' acciones, se esperaban >= ' + MINIMO);
    ok(Array.isArray(f.alcance) && f.alcance.length > 0, 'el fixture no declara alcance');
    ok(f.acciones.every(a => a.onclick && a.etiqueta !== undefined),
       'hay acciones sin onclick o sin etiqueta');
  });

  test('cada accion del inventario sigue alcanzable desde el alcance declarado', () => {
    const f = JSON.parse(fs.readFileSync(FIX, 'utf8'));
    const vistas = new Set();
    for(const c of [estadoSemana(), estadoPelea()])
      for(const p of f.alcance)
        for(const a of acciones(pinta(c, p))) vistas.add(a);

    const perdidas = f.acciones.filter(a => !vistas.has(a.onclick));
    ok(perdidas.length === 0,
       'desaparecieron ' + perdidas.length + ' acciones del inicio:\n      ' +
       perdidas.slice(0, 12).map(a => a.onclick + '   («' + a.etiqueta + '»)').join('\n      ') +
       (perdidas.length > 12 ? '\n      ... y ' + (perdidas.length-12) + ' mas' : ''));
  });

  test('ninguna pantalla del alcance queda a mas de dos toques del inicio', () => {
    const f = JSON.parse(fs.readFileSync(FIX, 'utf8'));
    const c = estadoSemana();
    /* toque 1: la barra inferior y todo lo que el inicio enlaza */
    const d1 = new Set(BARRA);
    for(const d of destinos(pinta(c, 'hub'))) d1.add(d);
    /* toque 2: lo que enlaza cada pantalla del toque 1 */
    const d2 = new Set(d1);
    for(const p of d1){
      if(!c.CL.SCREENS[p] && p !== 'hub') continue;
      let h = ''; try { h = pinta(c, p); } catch(e){ continue; }
      for(const d of destinos(h)) d2.add(d);
    }
    const lejos = f.alcance.filter(p => p !== 'hub' && !d2.has(p));
    eq(lejos, [], 'pantallas del alcance que no se alcanzan en <=2 toques desde el inicio');
  });

  test('el inventario cubre las dos caras del inicio (semana normal y semana de pelea)', () => {
    /* si esto se rompe, el fixture se genero desde un solo estado y la red
       de arriba solo protege la mitad del inicio. */
    const f = JSON.parse(fs.readFileSync(FIX, 'utf8'));
    const soloPelea = f.acciones.filter(a => a.estados.length === 1 && a.estados[0] === 'pelea');
    const soloSemana = f.acciones.filter(a => a.estados.length === 1 && a.estados[0] === 'semana');
    ok(soloPelea.length >= MIN_PELEA, 'el fixture solo tiene ' + soloPelea.length + ' acciones exclusivas de la semana de pelea');
    ok(soloSemana.length >= MIN_SEMANA, 'el fixture solo tiene ' + soloSemana.length + ' acciones exclusivas de la semana normal');
  });

});
}

/* El inicio (E3) y las pantallas de E3b usan la MISMA red: lo unico que
   cambia es el fixture y su alcance. */
redDeInventario(FIX, 'inventario del inicio', 82, 10, 30);
if(!process.env.CAGE_FIX)
  redDeInventario(path.join(__dirname, '..', 'fixtures', 'e3', 'inventario-story-gym.json'),
                  'inventario de story y gym', 55, 1, 1);
