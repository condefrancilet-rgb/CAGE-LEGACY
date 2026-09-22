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

/* el mismo fixture que la red rapida de dev/tests/13-inventario.js */
const FIXTURE = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'fixtures', 'e3', 'inventario-inicio.json'), 'utf8'));
/* el mismo save congelado que usa la suite rapida: es la otra cara del inicio */
const SAVE_REF = fs.readFileSync(
  path.join(__dirname, 'perf', 'congelado', 'save-referencia.json'), 'utf8');

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
      /* [pantalla, selector de un control que re-dibuja SIN navegar]
         Las pantallas largas van primero: E3 dejo `train`, `menu` y el hub en
         menos de una pantalla y media, y con el umbral viejo (+300 px) la
         prueba se quedo SIN SITIO donde medir y fallo. Fallar era lo correcto
         —para eso se arreglo— pero la respuesta no es bajar la exigencia sino
         medir donde de verdad hay scroll. */
      const candidatas = [
        ['train', 'button[onclick^="focusSet("]'],   /* con sus secciones abiertas */
        ['menu',  'button[onclick^="setPerf("]'],
        ['gym',   'button[onclick^="changeCoach("]'],
        ['story', 'button[onclick^="storyReact("]'],
        ['rank',  'button[onclick^="setRank("]'],
      ];
      const detalle = [];
      /* FUENTE DE SCROLL QUE NO DEPENDE DEL DISEÑO. La ronda pasada esta
         prueba se quedo sin sitio donde medir porque E3 acorto las pantallas,
         y ahora mide en `gym` y `story` — que E3b va a acortar tambien. Para
         no repetir el problema: antes de medir se ABREN TODAS las secciones
         plegables de la pantalla, que es lo que haria un jugador que las
         despliega. Cualquier pantalla con secciones da margen de scroll sin
         importar como quede su diseño. */
      const abrirTodas = async () => {
        const n = document.querySelectorAll('#app details.sec').length;
        for(let i = 0; i < n; i++){
          const sec = document.querySelectorAll('#app details.sec')[i];
          if(sec && !sec.open){ sec.querySelector('summary').click(); await esperar(90); }
        }
      };
      for(const [pant, sel] of candidatas){
        go(pant); await esperar(150);
        await abrirTodas(); await esperar(120);
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const btn = document.querySelector('#app ' + sel);
        detalle.push(pant + ' margen=' + max + ' control=' + (btn ? 'si' : 'no'));
        /* margen minimo para que el scroll signifique algo */
        if(max < 120 || !btn) continue;
        const y = Math.min(400, max);
        window.scrollTo(0, y); await esperar(120);
        const antes = window.scrollY, pantallaAntes = UI.screen;
        btn.click();                                  // interaccion en sitio
        await esperar(200);
        const enSitio = { antes: antes, despues: window.scrollY,
                          mismaPantalla: UI.screen === pantallaAntes };
        window.scrollTo(0, y); await esperar(120);
        const antesNav = window.scrollY;
        go('rank'); await esperar(200);
        return { medido: true, pantalla: pant, enSitio: enSitio,
                 nav: { antes: antesNav, despues: window.scrollY } };
      }
      return { medido: false, detalle: detalle.join(' · ') };
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

    /* ====================================================================
       E3 · LAS SECCIONES PLEGABLES NO SE CIERRAN SOLAS
       render() reescribe APP.innerHTML, asi que un <details> abierto se
       destruia y volvia a nacer cerrado en cuanto tocabas un boton de dentro.
       Medido antes del arreglo: la seccion se cerraba, el boton pasaba de
       y=298 a y=673 y el scroll caia de 615 a 240.
       OJO con la sonda: hay que pulsar un boton que CAMBIE algo. La primera
       que escribi pulsaba el boton ya seleccionado, el html salia identico,
       el DOM no se reescribia y la prueba decia que todo estaba bien.
       ==================================================================== */
    const secciones = await page.evaluate(async () => {
      const esperar = ms => new Promise(r => setTimeout(r, ms));
      go('train'); await esperar(180);
      const sec = document.getElementById('sec-foco');
      if(!sec) return { err: 'no existe la seccion del foco en train' };
      if(!sec.open){ sec.querySelector('summary').click(); await esperar(180); }
      /* un boton que cambia de verdad: el foco primario arranca en 'box' */
      const sel = 'button[onclick="focusSet(\'a\',\'wrest\')"]';
      const btn = sec.querySelector(sel);
      if(!btn) return { err: 'no hay boton que cambie el valor dentro de la seccion' };
      btn.scrollIntoView({ block: 'center' }); await esperar(140);
      const antes = { y: Math.round(btn.getBoundingClientRect().top), scroll: window.scrollY };
      btn.click(); await esperar(280);
      const sec2 = document.getElementById('sec-foco');
      const btn2 = sec2 ? sec2.querySelector(sel) : null;
      const r = btn2 ? btn2.getBoundingClientRect() : null;
      return { err: null, abierta: !!(sec2 && sec2.open),
               y: antes.y, y2: r ? Math.round(r.top) : null,
               scroll: antes.scroll, scroll2: window.scrollY,
               visible: !!(r && r.top >= 0 && r.bottom <= window.innerHeight),
               aplicado: !!(btn2 && /\bsel\b/.test(btn2.className)) };
    });
    anota(vp.n + ' · una seccion abierta sigue abierta tras tocar un boton (E3)',
      !secciones.err && secciones.abierta && secciones.aplicado,
      secciones.err || ('abierta=' + secciones.abierta + ' · el cambio se aplico=' + secciones.aplicado));
    anota(vp.n + ' · el boton tocado no se mueve de la pantalla (E3)',
      !secciones.err && secciones.y === secciones.y2 && secciones.scroll === secciones.scroll2 && secciones.visible,
      secciones.err || ('y ' + secciones.y + '->' + secciones.y2 + ' · scroll ' + secciones.scroll + '->' + secciones.scroll2 + ' · visible=' + secciones.visible));

    /* ====================================================================
       E3 · LAS PANTALLAS QUE RECIBIERON BLOQUES DEL INICIO
       Cada una: sin desborde, sin objetivos tactiles chicos, y como mucho dos
       pantallas de alto. Si E3 hubiera mudado el scroll en vez de quitarlo,
       esto lo dice.
       ==================================================================== */
    const nuevas = await page.evaluate(async () => {
      const esperar = ms => new Promise(r => setTimeout(r, ms));
      /* estado POR DEFECTO de las secciones: la prueba de arriba dejo una
         abierta y sin esto se median 4,51 pantallas en train. El alto con una
         seccion abierta es correcto que sea mayor: para eso estan. */
      UI.sec = {};
      const out = [];
      for(const p of ['hub','train','menu','people','bio','stats']){
        go(p); await esperar(150);
        const alto = document.documentElement.scrollHeight;
        const chicos = [...document.querySelectorAll('button, .avisos a')]
          .map(b => b.getBoundingClientRect())
          .filter(r => r.height > 0 && (r.height < 44 || r.width < 44)).length;
        out.push({ p, alto, pantallas: +(alto / window.innerHeight).toFixed(2), chicos,
                   desborde: document.documentElement.scrollWidth > window.innerWidth });
      }
      go('hub');
      return out;
    });
    /* El limite de dos pantallas se pidio para vertical (360x640 y demas). En
       apaisado el viewport mide 360 px de ALTO, asi que dos pantallas son
       720 px y ninguna pantalla con contenido entra: ahi se exigen desborde y
       objetivos tactiles, que si valen en cualquier orientacion. */
    const vertical = vp.height > vp.width;
    for(const n of nuevas){
      /* el inicio tiene su propio criterio (dev/perf/inicio.js, contra el
         pliegue); aca solo se exige que no desborde ni tenga tactiles chicos */
      const limite = (n.p === 'hub') ? 2.6 : 2.0;
      const altoOk = !vertical || n.pantallas <= limite;
      anota(vp.n + ' · ' + n.p + ': alto, tactiles y desborde (E3)',
        altoOk && n.chicos === 0 && !n.desborde,
        n.pantallas + ' pantallas' + (vertical ? ' (max ' + limite + ')' : ' (apaisado: sin limite de alto)') +
        ' · ' + n.chicos + ' tactiles <44px · desborde=' + n.desborde);
    }

    /* ====================================================================
       E3 · LAS 82 ACCIONES, POR EL CAMINO REAL
       La red de dev/tests/13-inventario.js busca los onclick en el HTML. Con
       secciones plegables eso ya no alcanza: un boton dentro de un <details>
       CERRADO esta en el html y no se ve ni se puede pulsar, asi que la red
       pasaria aunque el jugador no llegara nunca.
       Esto recorre el camino real en el navegador: cuenta solo botones con
       caja visible, y abre las secciones con un CLICK en su resumen —que es
       lo que hace el jugador— contando ese toque.
       ==================================================================== */
    const inventario = await page.evaluate(async ({ acciones, alcance, save }) => {
      const esperar = ms => new Promise(r => setTimeout(r, ms));
      /* OJO, y me costo una prueba que pasaba por el motivo equivocado: un
         boton dentro de un <details> CERRADO sigue midiendo 66x44 px y tiene
         offsetParent — Chromium le conserva la caja. Con "rect > 0" esta
         prueba contaba como alcanzables botones que el jugador no ve, que es
         exactamente el agujero que venia a tapar. Lo unico que dice la verdad
         es checkVisibility(); el recorrido de ancestros queda como red por si
         corre en un motor que no la tenga. */
      const esVisible = b => {
        if(typeof b.checkVisibility === 'function' &&
           !b.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
        const r = b.getBoundingClientRect();
        if(r.width <= 0 || r.height <= 0) return false;
        for(let n = b.parentElement; n; n = n.parentElement)
          if(n.tagName === 'DETAILS' && !n.open) return false;
        return true;
      };
      const visibles = () => [...document.querySelectorAll('#app button, #app .avisos a')]
        .filter(esVisible)
        .map(b => (b.getAttribute('onclick') || ('href:' + b.getAttribute('href')) || '').trim());
      const alcanzables = new Map();          /* onclick -> toques necesarios */
      const anotar = (lista, toques) => {
        for(const a of lista) if(!alcanzables.has(a)) alcanzables.set(a, toques);
      };
      async function recorrer(){
        UI.sec = {};
        for(const p of alcance){
          go(p); await esperar(140);
          anotar(visibles(), 1);              /* la pantalla, a un toque */
          const n = document.querySelectorAll('#app details.sec').length;
          for(let i = 0; i < n; i++){
            /* se relee cada vez: abrir una seccion puede redibujar */
            const sec = document.querySelectorAll('#app details.sec')[i];
            if(!sec || sec.open) continue;
            sec.querySelector('summary').click(); await esperar(140);
            anotar(visibles(), 2);            /* pantalla + abrir la seccion */
          }
          UI.sec = {};
        }
      }
      /* ESTADO 1: la carrera recien creada de esta sesion */
      await recorrer();
      /* ESTADO 2: el save congelado — semana de pelea, con campamento. El
         fixture se congelo desde LOS DOS estados, asi que recorrer uno solo
         daba 12 acciones "perdidas" que en realidad no existen en ese estado:
         el pesaje, los pilares del campamento y las actividades de prensa.
         El fallo era de la prueba, no del juego. */
      const id = 's1789970254602';
      localStorage.setItem(SAVE_ONE + id, save);
      const idx = saveIndex();
      idx[id] = { name:'ref', rec:'7-4', div:'', org:'', when:'x', cash:0,
                  v:SAVE_VERSION, at:Date.now(), kb:1 };
      saveIndexWrite(idx);
      if(loadGame(id)){ G.pending = []; await recorrer(); }
      go('hub');
      const perdidas = acciones.filter(a => !alcanzables.has(a));
      const conSeccion = acciones.filter(a => alcanzables.get(a) === 2).length;
      return { total: acciones.length, perdidas: perdidas.slice(0, 8),
               nPerdidas: perdidas.length, directas: acciones.length - perdidas.length - conSeccion,
               conSeccion };
    }, { acciones: FIXTURE.acciones.map(a => a.onclick), alcance: FIXTURE.alcance, save: SAVE_REF });
    anota(vp.n + ' · las ' + inventario.total + ' acciones se alcanzan PULSANDO, no leyendo el html (E3)',
      inventario.nPerdidas === 0,
      inventario.nPerdidas
        ? ('faltan ' + inventario.nPerdidas + ': ' + inventario.perdidas.join(' · '))
        : (inventario.directas + ' visibles de entrada · ' + inventario.conSeccion + ' tras abrir su seccion'));

    /* ====================================================================
       I1 · TERCERA CATEGORIA: EL SALTO QUE PIDE EL JUGADOR
       Las otras dos son "interactuar en sitio no mueve el scroll" y "navegar
       sube al inicio". Esta es la que faltaba: tocar un aviso de la franja
       lleva a su tarjeta. El salto lo hace el navegador con un ancla nativa,
       no JS, y la tarjeta tiene que quedar VISIBLE y sin que la cabecera
       pegajosa la tape.
       ==================================================================== */
    const salto = await page.evaluate(async () => {
      const esperar = ms => new Promise(r => setTimeout(r, ms));
      const p = G.player, lim = DIVS[p.div].lb;
      p.weightNow = lim + 30;                       /* enciende el aviso de peso */
      go('hub'); await esperar(160);
      const chip = document.querySelector('#app .avisos a[href="#aviso-peso"]');
      if(!chip) return { err: 'no hay chip de peso en la franja' };
      window.scrollTo(0, 0); await esperar(100);
      const antes = window.scrollY;
      chip.click(); await esperar(420);
      const destino = document.getElementById('aviso-peso');
      if(!destino) return { err: 'el ancla no tiene destino' };
      const r = destino.getBoundingClientRect();
      const tb = document.querySelector('#app .topbar');
      const cab = tb ? tb.getBoundingClientRect().bottom : 0;
      return { err: null, antes, despues: window.scrollY,
               top: Math.round(r.top), cabecera: Math.round(cab),
               tapada: r.top < cab - 1, visible: r.top >= 0 && r.top < window.innerHeight };
    });
    anota(vp.n + ' · tocar un aviso lleva a su tarjeta y no la tapa la cabecera (I1)',
      !salto.err && salto.visible && !salto.tapada,
      salto.err || ('scroll ' + salto.antes + '->' + salto.despues + ' · tarjeta en ' + salto.top +
                    ' · cabecera hasta ' + salto.cabecera + ' · tapada=' + salto.tapada));

    anota(vp.n + ' · sin errores de JavaScript', errores.length === 0, errores.slice(0, 2).join(' | '));
    await ctx.close();
  }

  await browser.close();

  /* TRINQUETE DEL INICIO. dev/perf/inicio.js mide el criterio de aceptacion de
     E3 contra el pliegue y sale con codigo != 0 si algo no cumple. Se corre
     dentro de la suite de navegador para que un inicio que vuelva a pasarse
     ponga la suite en rojo, no un informe aparte que nadie mira. */
  {
    const r = require('node:child_process').spawnSync(
      process.execPath, [path.join(__dirname, 'perf', 'inicio.js'), '--file', ARCHIVO],
      { encoding: 'utf8' });
    const ultima = String(r.stdout || '').trim().split('\n').pop();
    anota('trinquete · el inicio sigue cumpliendo el criterio (dev/perf/inicio.js)',
      r.status === 0, ultima || String(r.stderr || '').slice(0, 120));
  }

  const fallos = resultados.filter(r => !r.ok);
  console.log('\n' + '─'.repeat(60));
  console.log('navegador: pasados ' + (resultados.length - fallos.length) + ' · fallados ' + fallos.length);
  if(fallos.length){ fallos.forEach(f => console.log('  • ' + f.nombre + ' — ' + f.detalle)); process.exit(1); }
  console.log('todo verde en navegador');
}
main().catch(e => { console.error('fallo el arnes de navegador:', e); process.exit(1); });
