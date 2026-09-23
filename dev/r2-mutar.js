#!/usr/bin/env node
'use strict';
/* dev/r2-mutar.js — verificacion por mutacion: una prueba que no se vio caer
   no vale nada.
   Para cada mutante: aplica UNA sustitucion de texto al juego, corre las
   pruebas filtradas y exige que FALLEN; despues repone el archivo. Al final
   comprueba que el juego quedo byte a byte como estaba (md5) y que git no ve
   diferencias. Si una sustitucion no encuentra su texto, el mutante no vale
   (el codigo cambio y el mutante apunta a nada): se informa como INVALIDO.
     node dev/r2-mutar.js <archivo-de-mutantes.json>
   El archivo: { "filtro": "texto para --solo", "mutantes": [
                  { "nombre": "...", "buscar": "...", "poner": "..." }, ... ] }
   Opcional por mutante: "filtro" propio; "comando": ["node","dev/x.js",...]
   para mutantes que se verifican con otra herramienta (sale != 0 = cazado). */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync, execSync } = require('node:child_process');

const RAIZ = path.join(__dirname, '..');
const JUEGO = path.join(RAIZ, 'index-4-blindado.html');
const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const md5 = b => crypto.createHash('md5').update(b).digest('hex');
const original = fs.readFileSync(JUEGO);
const md50 = md5(original);
const texto = original.toString('utf8');

let cazados = 0, vivos = 0, invalidos = 0;
try {
  for(const m of spec.mutantes){
    const n = texto.split(m.buscar).length - 1;
    if(n !== 1){ console.log('  INVALIDO ' + m.nombre + ' — el texto a mutar aparece ' + n + ' veces'); invalidos++; continue; }
    fs.writeFileSync(JUEGO, texto.replace(m.buscar, m.poner));
    const cmd = m.comando || ['node', 'dev/run-tests.js', '--solo', m.filtro || spec.filtro];
    const r = spawnSync(cmd[0], cmd.slice(1), { cwd: RAIZ, encoding: 'utf8', timeout: 1800000 });
    fs.writeFileSync(JUEGO, original);
    const salida = (r.stdout || '') + (r.stderr || '');
    const falla = r.status !== 0;
    const linea = (salida.split('\n').find(l => /FALLA|FALLO|CIEGO|difiere|distint/.test(l)) || salida.split('\n').filter(Boolean).slice(-1)[0] || '').trim();
    console.log((falla ? '  CAZADO   ' : '  VIVO     ') + m.nombre.padEnd(46) + ' ' + linea.slice(0, 110));
    if(falla) cazados++; else vivos++;
  }
} finally {
  fs.writeFileSync(JUEGO, original);
}
const md51 = md5(fs.readFileSync(JUEGO));
const diff = execSync('git diff --stat -- index-4-blindado.html', { cwd: RAIZ, encoding: 'utf8' }).trim();
console.log('\nmutantes: ' + cazados + ' cazados · ' + vivos + ' vivos · ' + invalidos + ' invalidos');
console.log('md5 tras mutar: ' + md51 + (md51 === md50 ? ' == original' : ' != ORIGINAL ' + md50));
console.log('git diff tras mutar (contra HEAD): ' + (diff || 'vacio'));
process.exit(vivos || invalidos || md51 !== md50 ? 1 : 0);
