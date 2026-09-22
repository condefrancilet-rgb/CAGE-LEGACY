#!/usr/bin/env node
'use strict';
/* dev/focos.js — EL JUEGO TIENE DOS SISTEMAS DE FOCO DE ENTRENAMIENTO.
   Antes de diseñar dónde vive cada uno hay que saber si los dos hacen algo y
   si uno pisa al otro. Esto no se deduce leyendo: se mide.

     A  focusSet(slot,v) -> G.focus {a,b,c,load}   · lo leen focusWeights() y
        loadMult(), y a esos sólo los llama advancePeriod().
     B  clSetFocus(k) -> CL.S().focus              · lo lee el enganche
        CL.on('train','enfoque'), que corre en cada accion de entrenamiento.

   Cinco preguntas, cada una con N semillas distintas. Se comparan los STATS
   del jugador antes y despues, mas fatiga y daño. Dos brazos identicos salvo
   el ajuste que se mide, misma semilla en los dos.
     node dev/focos.js [--n 12]                                              */
const H = require('./harness.js');
const arg = (k,d) => { const i = process.argv.indexOf('--'+k); return i>=0 ? Number(process.argv[i+1]) : d; };
const N = arg('n', 12);
const STK = ['box','kick','muay','wrest','grap','cardio','str','power','speed','timing','accuracy',
             'defense','footwork','fightiq','composure','tdd','chin','recovery','toughness','patience'];

function nuevo(seed){
  const h = H.boot({ seed });
  H.startCareer(h, { metaSeed: 4000+seed, style:'mma', div:'LW', age:22 });
  return h.ctx;
}
/* foto del estado que el entrenamiento puede tocar */
function foto(c){
  const p = c.G.player, st = p.st || {}, o = { __fat: Math.round(p.fatigue*100)/100, __dmg: Math.round(p.dmg*100)/100 };
  for(const k of Object.keys(st)) if(typeof st[k] === 'number') o[k] = Math.round(st[k]*1000)/1000;
  return o;
}
function difiere(a, b){
  const ks = new Set([...Object.keys(a), ...Object.keys(b)]);
  const d = [];
  for(const k of ks) if((a[k]||0) !== (b[k]||0)) d.push(k + ' ' + (a[k]||0) + '->' + (b[k]||0));
  return d;
}

/* Un experimento: dos brazos, misma semilla, difieren SOLO en `ajuste`. */
function experimento(nombre, ajusteA, ajusteB, accion){
  let cambian = 0; const ejemplos = [];
  for(let s = 1; s <= N; s++){
    const ca = nuevo(1000 + s*7), cb = nuevo(1000 + s*7);
    ajusteA(ca); ajusteB(cb);
    const a0 = foto(ca), b0 = foto(cb);
    accion(ca); accion(cb);
    const da = difiere(a0, foto(ca)), db = difiere(b0, foto(cb));
    /* ¿los dos brazos terminan distinto? */
    const fin = difiere(foto(ca), foto(cb));
    if(fin.length){ cambian++; if(ejemplos.length < 2) ejemplos.push('semilla '+(1000+s*7)+': '+fin.slice(0,3).join(' · ')); }
    else if(ejemplos.length < 2 && s <= 2) ejemplos.push('semilla '+(1000+s*7)+': identicos (el brazo A movio '+da.length+' campos, el B '+db.length+')');
  }
  console.log((cambian? 'SI  ' : 'NO  ') + nombre);
  console.log('      los dos brazos terminan distinto en ' + cambian + '/' + N + ' carreras');
  for(const e of ejemplos) console.log('      ' + e);
  console.log('');
  return cambian;
}

const ponerA = (a,b,c,load) => (ctx) => { ctx.G.focus = {a:a, b:b, c:c, load:load}; };
const ponerB = (k) => (ctx) => { const S = ctx.CL.S(); S.focus = k; };
const bloque = (sem) => (ctx) => { ctx.advancePeriod(sem); };
const semana = (act) => (ctx) => { ctx.applyTrain(act, .85, 0); };

console.log('DOS SISTEMAS DE FOCO — ' + N + ' semillas por pregunta\n');
const r = {};
r.a_bloque = experimento(
  'A (G.focus) cambia lo que pasa al avanzar un BLOQUE de 13 semanas',
  ponerA('box','box','box','normal'), ponerA('wrest','wrest','wrest','normal'), bloque(13));
r.a_carga = experimento(
  'A: la CARGA (ligera/dura) cambia lo que pasa en un bloque de 13 semanas',
  ponerA('box','wrest','cardio','ligera'), ponerA('box','wrest','cardio','dura'), bloque(13));
r.b_semana = experimento(
  'B (CL.focus) cambia una semana suelta de entrenamiento',
  ponerB('none'), ponerB('war'), semana('box'));
r.b_bloque = experimento(
  'B tambien se aplica DENTRO de un bloque (A identico en los dos brazos)',
  (c)=>{ ponerA('box','wrest','cardio','normal')(c); ponerB('none')(c); },
  (c)=>{ ponerA('box','wrest','cardio','normal')(c); ponerB('war')(c); },
  bloque(13));
r.a_semana = experimento(
  'A se aplica a una semana suelta (no deberia: solo lo lee advancePeriod)',
  ponerA('box','box','box','normal'), ponerA('wrest','wrest','wrest','dura'), semana('box'));

console.log('─'.repeat(64));
console.log('A vivo en bloques      :', r.a_bloque ? 'SI' : 'NO');
console.log('A: la carga hace algo  :', r.a_carga ? 'SI' : 'NO');
console.log('B vivo semana a semana :', r.b_semana ? 'SI' : 'NO');
console.log('B vivo dentro del bloque:', r.b_bloque ? 'SI' : 'NO  <- B no llega al bloque');
console.log('A llega a la semana suelta:', r.a_semana ? 'SI  <- se pisan' : 'NO  (esperado)');
