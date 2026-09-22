#!/usr/bin/env node
'use strict';
/* dev/e5-hooks.js — E5 · A-1: LOS FALLOS QUE hookRun SE TRAGA
   ---------------------------------------------------------------------------
   hookRun AISLA por politica los fallos de un enganche: los anota en
   G.hookFails y sigue con los demas (solo abortan los eventos de HOOK_ABORT).
   La consecuencia es que la trampa global de errores NO los ve: un enganche
   puede fallar cada semana de una carrera entera sin que nadie se entere.

   Esto mide dos cosas, SIN TOCAR EL ARCHIVO DEL JUEGO: se envuelve hookRun
   desde fuera, en el sandbox.
     1. cuantos fallos aislados hay en carreras largas, y de que enganche
     2. si un enganche que falla A MITAD deja escrituras parciales en G
        (se inyecta un enganche que escribe dos campos y revienta entre medio)
     node dev/e5-hooks.js [--n 6] [--weeks 300]                              */
const H = require('./harness.js');
const A = require('./autopilot.js');
const arg = (k,d) => { const i = process.argv.indexOf('--'+k); return i>=0 ? Number(process.argv[i+1]) : d; };
const N = arg('n', 6), WEEKS = arg('weeks', 300);

/* ---------- 1. censo de fallos aislados ---------- */
console.log('1) FALLOS AISLADOS EN CARRERAS LARGAS (' + N + ' carreras x ' + WEEKS + ' semanas)\n');
const censo = new Map();
let semanas = 0;
for(let i = 0; i < N; i++){
  const seed = 600 + i*37;
  const h = H.boot({ seed });
  H.startCareer(h, { metaSeed: 9000 + seed, style:'mma', div:'LW', age:22 });
  const c = h.ctx;
  const orig = c.hookRun;
  c.hookRun = function(evt, list, run){
    const envuelta = function(hh){
      try { return run(hh); }
      catch(e){
        const k = evt + '/' + hh.id;
        const v = censo.get(k) || { n:0, msg:String(e && e.message || e).slice(0,70) };
        v.n++; censo.set(k, v);
        throw e;                       /* se relanza: la politica no cambia */
      }
    };
    return orig.call(this, evt, list, envuelta);
  };
  A.correrCarrera(h, { maxWeeks: WEEKS, politica:'basica', seedPolitica: seed });
  semanas += (c.G.year*52 + c.G.week) - 0;
}
if(!censo.size){
  console.log('   0 fallos aislados. La politica de aislar no esta tapando nada.\n');
} else {
  console.log('   enganche                      veces   mensaje');
  for(const [k,v] of [...censo].sort((a,b)=>b[1].n-a[1].n))
    console.log('   ' + k.padEnd(30) + String(v.n).padStart(5) + '   ' + v.msg);
  console.log('');
}

/* ---------- 2. escrituras parciales ---------- */
console.log('2) UN ENGANCHE QUE FALLA A MITAD, ¿DEJA ESCRITURAS PARCIALES EN G?\n');
{
  const h = H.boot({ seed: 4242 });
  H.startCareer(h, { metaSeed: 424242, style:'mma', div:'LW', age:22 });
  const c = h.ctx;
  for(let i=0;i<10;i++){ try{ c.advanceWeek(); }catch(e){} }
  /* un enganche semanal que escribe DOS campos y revienta entre los dos */
  c.CL.on('week', '__parcial_e5', function(){
    c.G.player.pop = c.G.player.pop + 5;          /* primera escritura */
    throw new Error('fallo a mitad del enganche');
  }, 1);
  const popAntes = c.G.player.pop;
  const fallosAntes = c.safeInt(c.G.hookFails, 0);
  const semanaAntes = c.G.year*52 + c.G.week;
  c.advanceWeek();
  const popDespues = c.G.player.pop;
  const parcial = Math.abs((popDespues - popAntes) - 5) < 1e-9 ||
                  (popDespues !== popAntes && (c.G.year*52 + c.G.week) === semanaAntes + 1);
  console.log('   popularidad ' + popAntes.toFixed(2) + ' -> ' + popDespues.toFixed(2));
  console.log('   la semana ' + (((c.G.year*52+c.G.week) === semanaAntes+1) ? 'AVANZO (el fallo se aislo)' : 'se deshizo'));
  console.log('   G.hookFails ' + fallosAntes + ' -> ' + c.safeInt(c.G.hookFails,0));
  console.log('');
  console.log(parcial
    ? '   VEREDICTO: SI deja escrituras parciales. La primera escritura del\n' +
      '   enganche queda aplicada y la segunda no, porque hookRun aisla el fallo\n' +
      '   y la semana sigue adelante. No es un bug del rollback —el rollback no\n' +
      '   se dispara— es el precio de la politica de aislar.'
    : '   VEREDICTO: no deja escrituras parciales.');
}
