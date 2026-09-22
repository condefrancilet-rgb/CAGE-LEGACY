#!/usr/bin/env node
'use strict';
/* dev/browser-tests.js — smoke tests de UI en Chromium real.
   Separado de run-tests.js porque depende de que haya navegador: si no lo hay,
   sale con codigo 0 y deja constancia de NO VERIFICADO EN NAVEGADOR (I5).
     node dev/browser-tests.js [--head]                                       */
const path = require('node:path');
const fs = require('node:fs');

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PW     = '/opt/node22/lib/node_modules/playwright';
/* --file apunta la suite a otra copia del juego. Existe para poder VERIFICAR
   estas pruebas con mutantes: se muta una copia y tienen que ponerse rojas. */
const ARCHIVO = process.argv.includes('--file')
  ? path.resolve(process.argv[process.argv.indexOf('--file')+1])
  : path.join(__dirname, '..', 'index-4-blindado.html');
const JUEGO  = 'file://' + ARCHIVO;

/* viewports exigidos: 360x640 vertical y horizontal, mas dos telefonos reales */
const VIEWPORTS = [
  { n: '360x640 vertical',   width: 360, height: 640 },
  { n: '360x640 horizontal', width: 640, height: 360 },
  { n: '390x844 vertical',   width: 390, height: 844 },
  { n: '412x915 vertical',   width: 412, height: 915 },
];

const resultados = [];
const anota = (nombre, ok, detalle) => {
  resultados.push({ nombre, ok, detalle });
  process.stdout.write('  ' + (ok ? 'ok   ' : 'FALLA') + ' ' + nombre + (detalle ? '  — ' + detalle : '') + '\n');
};

async function crearCarrera(page){
  await page.click('button:has-text("Empezar una carrera")');
  await page.waitForTimeout(120);
  await page.click('button.pri:has-text("Continuar")');
  await page.waitForTimeout(120);
  await page.fill('#cfirst', 'Mateo');
  await page.fill('#clast', 'Ferrari');
  await page.click('button.pri:has-text("Continuar")');
  await page.waitForTimeout(120);
  await page.click('button.pri:has-text("Continuar")');
  await page.waitForTimeout(120);
  await page.click('button:has-text("Empezar carrera")');
  await page.waitForTimeout(800);
}

async function main(){
  if(!fs.existsSync(CHROME) || !fs.existsSync(PW)){
    console.log('NO VERIFICADO EN NAVEGADOR: no hay Chromium ni Playwright en este entorno.');
    console.log('  esperado en ' + CHROME);
    process.exit(0);
  }
  const { chromium } = require(PW);
  const browser = await chromium.launch({ executablePath: CHROME, headless: !process.argv.includes('--head') });

  for(const vp of VIEWPORTS){
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    });
    const page = await ctx.newPage();
    const errores = [];
    page.on('pageerror', e => errores.push(String(e)));

    await page.goto(JUEGO);
    await page.waitForTimeout(350);
    await crearCarrera(page);

    const pantalla = await page.evaluate(() => UI.screen);
    anota(vp.n + ' · arranca y crea carrera', pantalla === 'hub', 'pantalla=' + pantalla);

    /* --- todas las pantallas: 0 error, 0 desborde horizontal --- */
    const barrido = await page.evaluate(() => {
      const malas = [], desborde = [];
      for(const k of Object.keys(CL.SCREENS)){
        try {
          UI.screen = k; UI.sub = null; render();
          if(document.documentElement.scrollWidth > window.innerWidth + 1)
            desborde.push(k + ':' + document.documentElement.scrollWidth + '>' + window.innerWidth);
        } catch(e){ malas.push(k + ': ' + e.message); }
      }
      UI.screen = 'hub'; render();
      return { malas, desborde, n: Object.keys(CL.SCREENS).length };
    });
    anota(vp.n + ' · ' + barrido.n + ' pantallas sin excepcion', barrido.malas.length === 0, JSON.stringify(barrido.malas).slice(0, 200));
    anota(vp.n + ' · sin desborde horizontal', barrido.desborde.length === 0, JSON.stringify(barrido.desborde).slice(0, 200));

    /* --- I1 en navegador real: interaccion en sitio no mueve el scroll ---
       Esta prueba media SIEMPRE en el hub con focusSet(). E3 dejo el hub en
       1,49 pantallas y mudo focusSet a «Entrenar», asi que a 412x915 el hub
       dejo de dar margen de scroll y la prueba se auto-salto: dos aserciones
       de I1 pasaron a "NO MEDIDO" y siguieron contando como VERDES. Un aviso
       que se apaga solo no es un aviso. Ahora:
         · se busca una pantalla con margen de scroll REAL y con un control en
           sitio que exista ahi de verdad (se comprueba en el DOM);
         · si no hay ninguna, la prueba FALLA. No se salta.                 */
    const scroll = await page.evaluate(async () => {
      const esperar = ms => new Promise(r => setTimeout(r, ms));
      /* [pantalla, selector de un control que re-dibuja SIN navegar] */
      const candidatas = [
        ['train', 'button[onclick^="focusSet("]'],
        ['menu',  'button[onclick^="setPerf("]'],
        ['hub',   'button[onclick^="clSetFocus("]'],
      ];
      for(const [pant, sel] of candidatas){
        go(pant); await esperar(150);
        if(document.documentElement.scrollHeight < window.innerHeight + 300) continue;
        const btn = document.querySelector('#app ' + sel);
        if(!btn) continue;
        window.scrollTo(0, 400); await esperar(120);
        const antes = window.scrollY, pantallaAntes = UI.screen;
        btn.click();                                  // interaccion en sitio
        await esperar(200);
        const enSitio = { antes: antes, despues: window.scrollY,
                          mismaPantalla: UI.screen === pantallaAntes };
        window.scrollTo(0, 400); await esperar(120);
        const antesNav = window.scrollY;
        go('rank'); await esperar(200);
        return { medido: true, pantalla: pant, enSitio: enSitio,
                 nav: { antes: antesNav, despues: window.scrollY } };
      }
      return { medido: false,
               detalle: candidatas.map(function(c){
                 go(c[0]);
                 return c[0] + ' alto=' + document.documentElement.scrollHeight +
                        ' control=' + (document.querySelector('#app ' + c[1]) ? 'si' : 'no');
               }).join(' · ') };
    });
    anota(vp.n + ' · interaccion en sitio conserva el scroll (I1)',
      scroll.medido && scroll.enSitio.mismaPantalla && scroll.enSitio.despues === scroll.enSitio.antes,
      scroll.medido ? (scroll.pantalla + ': ' + scroll.enSitio.antes + ' -> ' + scroll.enSitio.despues)
                    : 'SIN PANTALLA DONDE MEDIR I1 — ' + scroll.detalle);
    anota(vp.n + ' · navegar sube al inicio (I1)',
      scroll.medido && scroll.nav.despues === 0,
      scroll.medido ? (scroll.nav.antes + ' -> ' + scroll.nav.despues)
                    : 'SIN PANTALLA DONDE MEDIR I1 — ' + scroll.detalle);

    /* --- targets tactiles (F17) --- */
    const tactil = await page.evaluate(() => {
      go('hub');
      const bs = Array.prototype.slice.call(document.querySelectorAll('button, [onclick]'));
      const chicos = [], cajas = [];
      for(const b of bs){
        const r = b.getBoundingClientRect();
        if(r.width === 0 && r.height === 0) continue;
        cajas.push({ x: r.left, y: r.top, w: r.width, h: r.height, t: (b.textContent||'').trim().slice(0, 24) });
        if(r.height < 44 || r.width < 44) chicos.push({ w: Math.round(r.width), h: Math.round(r.height), t: (b.textContent||'').trim().slice(0, 24) });
      }
      /* solapamientos entre targets */
      let solapados = 0;
      for(let i = 0; i < cajas.length; i++) for(let j = i+1; j < cajas.length; j++){
        const a = cajas[i], b = cajas[j];
        if(a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) solapados++;
      }
      return { total: cajas.length, chicos: chicos.length, muestraChicos: chicos.slice(0, 5), solapados };
    });
    anota(vp.n + ' · targets tactiles medidos', true,
      tactil.total + ' targets · ' + tactil.chicos + ' por debajo de 44px · ' + tactil.solapados + ' solapados');

    anota(vp.n + ' · sin errores de JavaScript', errores.length === 0, errores.slice(0, 2).join(' | '));
    await ctx.close();
  }

  await browser.close();
  const fallos = resultados.filter(r => !r.ok);
  console.log('\n' + '─'.repeat(60));
  console.log('navegador: pasados ' + (resultados.length - fallos.length) + ' · fallados ' + fallos.length);
  if(fallos.length){ fallos.forEach(f => console.log('  • ' + f.nombre + ' — ' + f.detalle)); process.exit(1); }
  console.log('todo verde en navegador');
}
main().catch(e => { console.error('fallo el arnes de navegador:', e); process.exit(1); });
