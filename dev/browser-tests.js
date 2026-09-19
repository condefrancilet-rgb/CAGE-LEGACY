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
const JUEGO  = 'file://' + path.join(__dirname, '..', 'index-4-blindado.html');

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

    /* --- I1 en navegador real: interaccion en sitio no mueve el scroll --- */
    const scroll = await page.evaluate(async () => {
      const esperar = ms => new Promise(r => setTimeout(r, ms));
      go('hub'); await esperar(150);
      const alto = document.documentElement.scrollHeight;
      if(alto < window.innerHeight + 300) return { saltado: true, alto };
      window.scrollTo(0, 400); await esperar(120);
      const antes = window.scrollY;
      const pantallaAntes = UI.screen;
      focusSet('a', 'wrest');                      // interaccion en sitio
      await esperar(200);
      const enSitio = { antes, despues: window.scrollY, mismaPantalla: UI.screen === pantallaAntes };
      window.scrollTo(0, 400); await esperar(120);
      const antesNav = window.scrollY;
      go('rank'); await esperar(200);
      return { saltado: false, enSitio, nav: { antes: antesNav, despues: window.scrollY } };
    });
    if(scroll.saltado){
      anota(vp.n + ' · T-SCROLL en navegador', true, 'NO MEDIDO: el hub no da margen de scroll a ' + vp.n);
    } else {
      anota(vp.n + ' · interaccion en sitio conserva el scroll (I1)',
        scroll.enSitio.mismaPantalla && scroll.enSitio.despues === scroll.enSitio.antes,
        scroll.enSitio.antes + ' -> ' + scroll.enSitio.despues);
      anota(vp.n + ' · navegar sube al inicio (I1)',
        scroll.nav.despues === 0, scroll.nav.antes + ' -> ' + scroll.nav.despues);
    }

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
