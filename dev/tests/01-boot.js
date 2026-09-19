'use strict';
/* Arranque, creacion de carrera y determinismo del harness. */
const { suite, test, ok, eq } = require('../run-tests.js');
const H = require('../harness.js');
const A = require('../autopilot.js');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

suite('boot', () => {

  test('el juego carga en el harness sin errores', () => {
    const h = H.boot({ seed: 1 });
    ok(typeof h.ctx.G === 'object', 'G no existe');
    ok(typeof h.ctx.render === 'function', 'render no existe');
    eq(h.UI.screen, 'title', 'la pantalla inicial deberia ser el titulo');
    eq(h.errores.length, 0, 'el harness registro errores');
  }, { seed: 1 });

  test('node --check acepta el script extraido', () => {
    const fs = require('node:fs'), os = require('node:os');
    const js = H.extractJS();
    const tmp = path.join(os.tmpdir(), 'cage-check-' + process.pid + '.js');
    fs.writeFileSync(tmp, js);
    try { execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' }); }
    finally { fs.unlinkSync(tmp); }
  });

  test('crear carrera deja un mundo coherente', () => {
    const h = H.boot({ seed: 2 });
    const G = H.startCareer(h, { metaSeed: 4242, style: 'boxer', div: 'LW', age: 22 });
    ok(G.player, 'no hay jugador');
    eq(G.player.name, 'Mateo Ferrari');
    eq(G.player.div, 'LW');
    eq(G.player.style, 'boxer');
    ok(Object.keys(G.fighters).length > 100, 'el mundo tiene muy pocos peleadores');
    ok(G.fighters[G.player.id] === G.player, 'el jugador no esta en el roster');
  }, { seed: 2 });

  test('misma semilla y mismas decisiones -> misma huella', () => {
    const corre = () => {
      const h = H.boot({ seed: 5 });
      H.startCareer(h, { metaSeed: 31337, style: 'wrest', div: 'WW', age: 21 });
      A.correrCarrera(h, { maxWeeks: 30, politica: 'basica', seedPolitica: 5 });
      return h.call('STATE.fingerprint', true);
    };
    eq(corre(), corre(), 'la simulacion no es determinista dentro del proceso');
  }, { seed: 5 });

  test('el determinismo se mantiene entre procesos distintos', () => {
    const script = `
      const H=require(${JSON.stringify(path.join(__dirname,'..','harness.js'))});
      const A=require(${JSON.stringify(path.join(__dirname,'..','autopilot.js'))});
      const h=H.boot({seed:5}); H.startCareer(h,{metaSeed:31337,style:'wrest',div:'WW',age:21});
      A.correrCarrera(h,{maxWeeks:30,politica:'basica',seedPolitica:5});
      process.stdout.write(String(h.call('STATE.fingerprint',true)));`;
    const a = execFileSync(process.execPath, ['-e', script], { encoding: 'utf8' });
    const b = execFileSync(process.execPath, ['-e', script], { encoding: 'utf8' });
    eq(a, b, 'dos procesos dan huellas distintas');
    ok(a.length > 0, 'huella vacia');
  }, { seed: 5 });

  test('el juego no tiene dependencias externas (I2)', () => {
    const fs = require('node:fs');
    const src = fs.readFileSync(H.GAME, 'utf8');
    eq((src.match(/<script[^>]+src=/gi) || []).length, 0, 'hay <script src=>');
    eq((src.match(/<link[^>]+href=/gi) || []).length, 0, 'hay <link href=>');
    const js = H.extractJS();
    eq((js.match(/\bfetch\s*\(/g) || []).length, 0, 'hay fetch()');
    eq((js.match(/XMLHttpRequest/g) || []).length, 0, 'hay XMLHttpRequest');
  });

});
