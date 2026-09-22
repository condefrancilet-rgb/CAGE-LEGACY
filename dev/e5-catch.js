#!/usr/bin/env node
'use strict';
/* dev/e5-catch.js — E5 · try/catch QUE TAPAN ERRORES
   ---------------------------------------------------------------------------
   El encargo prohibe usar try/catch para ocultar fallos funcionales. Esto los
   clasifica todos, leyendo el cuerpo de cada catch:
     TAPA     el cuerpo esta vacio Y SIN EXPLICACION -> el error desaparece
              sin dejar rastro y nadie sabe si fue a proposito
     EXPLICADO el cuerpo esta vacio pero hay un comentario que dice por que.
              Los cinco que quedan son de diagnostico y recuperacion (leer un
              getter del objeto global, registrar un error desde el propio
              registrador de errores, reponer localStorage tras la prueba de
              cuota, leer ?dev=1 de la URL): ninguno tapa un error funcional
     ANOTA    llama a errLog / errRecord / errNote / console -> queda registro
     RELANZA  vuelve a lanzar
     DEVUELVE devuelve un valor de respaldo sin anotar: tapa, pero deliberado
              (hay que mirarlo uno a uno)
   Salir con codigo != 0 si aparece alguno de los que TAPAN.
     node dev/e5-catch.js [--file otra.html]                                 */
const fs = require('node:fs');
const path = require('node:path');
const arg = (k,d) => { const i = process.argv.indexOf('--'+k); return i>=0 ? process.argv[i+1] : d; };
const ARCH = path.resolve(arg('file', path.join(__dirname, '..', 'index-4-blindado.html')));
const src = fs.readFileSync(ARCH, 'utf8');

/* cuerpo de cada catch, contando llaves */
const catches = [];
const re = /catch\s*\(([^)]*)\)\s*\{/g;
let m;
while((m = re.exec(src))){
  let i = re.lastIndex, prof = 1;
  while(i < src.length && prof > 0){
    const ch = src[i];
    if(ch === '{') prof++;
    else if(ch === '}') prof--;
    i++;
  }
  const cuerpo = src.slice(re.lastIndex, i-1);
  const linea = src.slice(0, m.index).split('\n').length;
  catches.push({ linea, variable: m[1].trim(), cuerpo });
}

const sinComentarios = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').trim();
const tieneComentario = s => /\/\*[\s\S]*?\*\/|\/\/[^\n]*/.test(s);
const clasifica = c => {
  const b = sinComentarios(c.cuerpo);
  if(!b) return tieneComentario(c.cuerpo) ? 'EXPLICADO' : 'TAPA';
  if(/\bthrow\b/.test(b)) return 'RELANZA';
  if(/errLog|errRecord|errNote|errNan|console\.|toast\(/.test(b)) return 'ANOTA';
  if(/\breturn\b/.test(b)) return 'DEVUELVE';
  return 'OTRO';
};
const grupos = {};
for(const c of catches){ const k = clasifica(c); (grupos[k] = grupos[k] || []).push(c); }

console.log('try/catch en ' + path.basename(ARCH) + ': ' + catches.length + '\n');
for(const k of ['TAPA','EXPLICADO','DEVUELVE','OTRO','ANOTA','RELANZA']){
  const g = grupos[k] || [];
  console.log('  ' + k.padEnd(9) + String(g.length).padStart(4));
}
for(const k of ['TAPA','OTRO']){
  const g = grupos[k] || [];
  if(!g.length) continue;
  console.log('\n  ' + k + ':');
  for(const c of g.slice(0,20))
    console.log('   linea ' + c.linea + '  catch(' + c.variable + '){' +
                c.cuerpo.replace(/\s+/g,' ').slice(0,70) + '}');
}
const malos = (grupos.TAPA || []).length;
console.log('\n' + (malos
  ? malos + ' catch VACIOS Y SIN EXPLICACION — cada uno tiene que decir por que esta vacio'
  : 'ningun catch vacio sin explicacion'));
process.exit(malos ? 1 : 0);
