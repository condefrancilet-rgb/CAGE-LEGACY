# Auditoría B — Navegación y Render

**Archivo auditado:** `index-4-blindado.html` (28.127 líneas, 1 solo bloque `<script>` que abre en la línea 566).
**Método:** lectura estática (grep/sed) + verificación dinámica con `dev/harness.js` + `dev/autopilot.js` en `node:vm`.
**Nota de líneas:** todas las líneas citadas son del **HTML**. Las trazas de pila del harness dan líneas de `cage-legacy.js`; la conversión es `línea HTML = línea JS + 565`.

---

## 1. `render()` — cadena completa de capas

### 1.1 Las tres capas

| # | Línea | Qué es | Quién la instala |
|---|-------|--------|------------------|
| 1 | **4053–4056** | `function render(){ APP.innerHTML = (G && G.player) ? scrHub() : scrTitle(); renderNav(); }` — declaración base. Comentada en el propio archivo como *"Router de emergencia: sólo se alcanza si UI.screen no está en la tabla de pantallas"*. | declaración de función (izada a todo el script) |
| 2 | **4063** | `var CL_BASE_RENDER = render, CL_BASE_SCRHUB = scrHub, CL_BASE_SCRMG = scrMG;` — **captura por valor** de la capa 1, antes de cualquier parche. | módulo "NÚCLEO v2" |
| 3 | **17583–17602** | `render = function(){ ... }` dentro del IIFE `CLinstall()` (abre en 17491). Es la implementación **canónica**: `dedupeDOM` → `clDraw()` → recuperación de errores → saneo de NaN → `hookEmit('render:after')`. | reasignación de la variable global |

### 1.2 Quién gana en runtime

Gana **la capa 3** (línea 17583). Motivo mecánico:

- `function render(){...}` (4053) crea el *binding* `render` en el objeto global.
- `render = function(){...}` (17583) **sobrescribe ese mismo binding**. No es un wrapper: no llama a `CL_BASE_RENDER` salvo en la ruta de fallo.
- Todo el archivo llama a `render()` por nombre global, así que después de que el IIFE corre (en carga, línea 17491 en adelante), **toda** llamada ejecuta la capa 3.
- La capa 1 sobrevive **sólo** a través de la referencia `CL_BASE_RENDER` (4063) y **sólo** se ejecuta desde `clDraw()` línea 17573, cuando `UI.screen` no tiene entrada en `CL.SCREENS` o su `fn()` devolvió `null`.

Detalle importante y **correcto**: la capa 1 llama a `scrHub()` / `scrTitle()` **por nombre global**, no por referencia capturada. Como `scrHub` se reasigna después (17608), el "router de emergencia" dibuja el hub **con** las tarjetas del núcleo v2. No hay recursión infinita porque la nueva `scrHub` llama a `CL_BASE_SCRHUB` (capturada en 4063), no a sí misma.

### 1.3 Cuerpo de la capa ganadora (17583–17602), paso a paso

```
1. safeRun('render/dedupe', dedupeDOM)          -> 17584   (idempotente, guard _perfDeduped)
2. try{ clDraw() }                              -> 17585
   catch: errRecord + fxClose(true) + G.mg=null -> 17587-17589
          UI.screen = hub|title ; UI.sub = null -> 17590
          errNote + clDraw() de recuperación    -> 17591-17592
3. safeRun('render/nan'):                       -> 17594-17600
     si APP.innerHTML contiene 'NaN':
        normalizeWorldState()                   -> 17596
        reemplazo textual NaN% -> 0% / NaN -> — -> 17597
        errRecord('nan:'+UI.screen, ...)        -> 17598
4. hookEmit('render:after', {screen:UI.screen}) -> 17601
```

### 1.4 Tabla de cadenas de redefinición (dominio B)

| Función | Capas (línea → qué hace) | Cuál gana en runtime | Capa previa accesible |
|---|---|---|---|
| `render` | 4053 base (router de emergencia) → 4063 captura `CL_BASE_RENDER` → 17583 reasignación canónica | **17583** | sí, vía `CL_BASE_RENDER` (usada en 17573) |
| `renderNav` | 4041 base → 8731 `renderNav = function(){...}` (guarda `legacy` sin partida) | **8731** | sí, vía `_legRenderNavPrev` (8730), invocada en 8733 |
| `scrHub` | 4395 base → 4063 captura `CL_BASE_SCRHUB` → 17608 reasignación (guard de evento + coreStats + `CL.hubCards`) | **17608** | sí, vía `CL_BASE_SCRHUB` (17609) |
| `scrMG` | 4557 base → 4063 captura `CL_BASE_SCRMG` → 17695 reasignación (despacho por `mg.type`) | **17695** | sí, vía `CL_BASE_SCRMG` (17704) |
| `scrTrain` | 4481 base → 26016 `scrTrain = function(){ if(retiredGuard()) return scrLegacy(); ... }` | **26016** | sí, vía `_scrTrainFinal` (26016) |
| `scrFight` | 4789 base — **no se reasigna**; se extiende sólo con hooks `screen:fight` (6 suscriptores) | **4789** | n/a (bus de hooks) |
| `CL.screen` | 15986 (1ª def: escribe en `CL.screens` + `CL.SCREENS` si existe) → 17536 (2ª def dentro de `CLinstall`) | **17536** | no; la 1ª queda muerta. El puente está en 17543 (`for(var _sk in CL.screens) CL.SCREENS[_sk]=...`) |
| `normalizeWorldState` | 6244 `var normalizeWorldState = normalizeFull;` (alias, **no** es una capa) | `normalizeFull` (6229) | n/a |
| `fightFinishResolve` | base → 8379 reasignación (`_fxFightFinishResolvePrev`) | **8379** | sí |
| `sparFinishResolve` | base → 8390 reasignación (`_fxSparFinishResolvePrev`) | **8390** | sí |

**Veredicto del punto 1:** la cadena está *limpia*. Hay exactamente 1 reasignación de `render`, con captura explícita de la base y un uso acotado de esa base como fallback. No hay las "8 capas" que el propio archivo documenta como historia previa.

---

## 2. `clDraw()` — el despachador de pantallas (17556–17575)

```js
var CL_LAST_DRAWN = null;                      // 17556
function clDraw(){                             // 17557
  var sc = CL.SCREENS[UI.screen];              // 17558
  if(sc){
    if(!sc.any && (!G || !G.player)) UI.screen='title';           // 17560
    else {
      var html = sc.fn();                                          // 17562
      if(html!==null && html!==undefined){
        APP.innerHTML = html;                                      // 17564
        if(sc.nav==='hide') NAV.style.display='none'; else renderNav();  // 17565
        if(CL_LAST_DRAWN !== UI.screen){ CL_LAST_DRAWN = UI.screen; window.scrollTo(0,0); }  // 17566
        return;
      }
      UI.screen = (G&&G.player)? 'hub':'title';                    // 17569
    }
  }
  CL_LAST_DRAWN = null;                                            // 17572
  CL_BASE_RENDER();                                                // 17573
}
```

### 2.1 Cómo elige pantalla
Consulta **una sola tabla**: `CL.SCREENS[UI.screen]`. Tres salidas:
1. **Entrada existe y `fn()` devuelve HTML** → pinta, ajusta NAV, decide scroll, `return`.
2. **Entrada existe pero `fn()` devuelve `null`** (contrato explícito "no puedo dibujar esto": `fight` sin `G.fight` en 17520, `fightresult` sin `result` en 17525, `mg` sin `G.mg` en 17527, `retire` si ya está retirado en 17503) → reescribe `UI.screen` a `hub`/`title` y **cae al router de emergencia**.
3. **No hay entrada** (`UI.screen` desconocido) → router de emergencia directo.

### 2.2 `CL.SCREENS` vs `CL.screens`
- `CL.screens` (15975) es el registro **viejo**: `nombre -> fn`.
- `CL.SCREENS` (17500–17534) es el registro **nuevo**: `nombre -> {fn, any?, nav?}`. **`clDraw()` lee sólo de `CL.SCREENS`.**
- El comentario de 15982–15984 documenta el bug histórico (escribir en una y leer de la otra). La reconciliación es correcta y **doble**:
  - 17543: `for(var _sk in CL.screens) CL.SCREENS[_sk]={fn:CL.screens[_sk]};` — vuelca lo registrado *antes* de que existiera `CL.SCREENS`.
  - 17536–17541: la `CL.screen()` definitiva escribe en **ambas** tablas.
- **Verificado en runtime:** los 28 destinos literales de `go('X')` del archivo tienen entrada en `CL.SCREENS` (33 pantallas registradas). No queda ninguna pantalla huérfana ni ningún `go()` colgado. Estado: **CONFIRMADO, sin defecto**.

### 2.3 La condición de scroll `CL_LAST_DRAWN`
`if(CL_LAST_DRAWN !== UI.screen){ CL_LAST_DRAWN = UI.screen; window.scrollTo(0,0); }` (17566).
Separa **dibujar** de **navegar**: sólo se sube al tope cuando cambia la pantalla realmente pintada. Medido con `h.scrollCalls()`:

| Acción | scrollTo(0,0) observados |
|---|---|
| `render()` en sitio (misma pantalla) | **0** |
| `render()` x3 en sitio | **0** |
| `go('rank')` desde `hub` (cambio) | **2** ← ver B-004 |
| `go('rank')` estando ya en `rank` | **1** (sólo el de `go`) |
| `UI.screen='hub'; render()` (sin `go`) | **1** |
| `UI.screen` desconocido → router de emergencia | **0** |

Estado: **CONFIRMADO**. El mecanismo cumple su objetivo (0 scrolls en redibujado en sitio), con la salvedad de B-004.

---

## 3. `go(s, sub)` — línea 4009–4028

```js
function go(s,sub){
  var ctx={to:s, sub:(sub||null), from:UI.screen, fromSub:UI.sub, cancel:false};   // 4010
  if(typeof CL!=='undefined' && CL && CL.emit) CL.emit('nav', ctx);                // 4011
  if(ctx.cancel) return;                                                           // 4012
  if(G && G.fight && G.fight.over && ['fight','fightresult','mg'].indexOf(ctx.to)<0){
    G.fight=null;                                                                  // 4022-4024
  }
  UI.screen=ctx.to; UI.sub=ctx.sub;                                                // 4025
  if(window.scrollTo) window.scrollTo(0,0);                                        // 4026
  render();                                                                        // 4027
}
```

`go()` hace **cinco** cosas además de asignar la pantalla:

1. **Emite el hook `nav`** (4011) con un contexto redirigible (`ctx.to`, `ctx.sub`) y cancelable (`ctx.cancel`). Hay **5 suscriptores**, verificados en runtime en este orden:

   | orden | id | línea | efecto |
   |---|---|---|---|
   | 10 | `fx` | 8397 | `if(FX.running) fxClose(true)` — desmonta el overlay `#fxmg` |
   | 15 | `minijuego` | 21916 | `if(G.mg && c.to!=='mg' && G.mg.live) G.mg=null` — descarta minijuego a medias |
   | 20 | `casino` | 23351 | `if(c.from==='casino' && c.to!=='casino') CAS.stopTimer()` |
   | 40 | `retiro` | 26008 | `if(retiredGuard() && !NAV_RETIRED[c.to]){ c.to='legacy'; c.sub=null; }` |
   | 50 | `rutas` | 13556 | `menu/load → load`; y sin partida, `if(!NAV_OPEN[c.to]) c.to='title'` |

2. **Mata la pelea terminada** (4022–4024). Es **el único punto del archivo** donde `G.fight` con `over:true` se descarta. El comentario 4014–4021 explica por qué importa: una pelea cobrada que sobrevive se serializa en cada save, fija al rival en `pruneWorld()`, se re-sanea en cada `ensureFightTotals()`, y deja la pantalla `fightresult` dibujable, con lo que `recStart()` (3 semanas + mejoras) y `confirmFight()` (récord, bolsa e historial) **pueden volver a ejecutarse sobre un resultado ya cobrado**.

3. Asigna `UI.screen`/`UI.sub` (4025) — 1 de las 37 escrituras directas.
4. Hace `window.scrollTo(0,0)` (4026) — redundante con 17566, ver **B-004**.
5. Llama a `render()` (4027).

**Verificado en runtime** (semilla 1000, pelea real cobrada):
```
tras confirmFight: paid=true  screen=fightresult  G.fight=objeto vivo
UI.screen='hub'; render()  ->  G.fight sigue vivo: true
UI.screen='fightresult'; render() -> vuelve a dibujar VICTORIA/DERROTA: true
recStart() por 2ª vez      ->  abre G.mg tipo 'rec'  (las 3 semanas se pueden repetir)
go('hub')                  ->  G.fight = null
```
Es decir: **la única defensa contra la doble ejecución del post-pelea es pasar por `go()`**. Ver B-003.

---

## 4. Las 37 escrituras directas de `UI.screen`

`grep -c "UI\.screen\s*=[^=]"` → **49** coincidencias, de las cuales **12** están dentro de cadenas HTML (`onclick="...UI.screen=\'title\';render()"`) y **37** son código JS ejecutable. Las 37:

### A) Dentro de `go()` — 1 escritura (la única que sí pasa por el bus `nav`)
| línea | valor |
|---|---|
| 4025 | `UI.screen=ctx.to` |

### B) Dentro del propio despachador / recuperación de errores — 3 escrituras (correctas: el bus `nav` no aplica al redibujado)
| línea | valor | función |
|---|---|---|
| 17560 | `'title'` | `clDraw` — pantalla no-`any` sin partida |
| 17569 | `hub`/`title` | `clDraw` — `fn()` devolvió `null` |
| 17590 | `hub`/`title` | `render` — recuperación tras excepción |

### C) Entrada/salida de minijuegos (`mg`) — 18 escrituras, **ninguna pasa por `go()`**
| línea | valor | contexto |
|---|---|---|
| 2318 | `'mg'` | `sparStart()` |
| 2392 | `'mg'` | `finishMiniStart()` |
| 2445, 2473, 2503, 2543, 2593, 2691, 2740, 2769 | `'mg'` | arrancadores de minijuego (cardio, fuerza, drills, gameplan, pesaje, prensa, `recStart`, nego) |
| 8393 | `'mg'` | `sparFinishResolve` |
| 10644 | `'mg'` | minijuego de entrenamiento (`tgStart`) |
| 10677 | `'mg'` | `tgResolve` |
| 11749 | `'mg'` | chat social |
| 13401 | `'mg'` | visita a gimnasio |
| 14366 | `'mg'` | `fameStart` |
| 14412 | `'mg'` | `fameResolve` |
| 14957 | `'mg'` | resolución de otra actividad |

Justificación parcial: entrar a `mg` **debe** saltarse el hook `nav/fx` (10) y `nav/minijuego` (15), que precisamente cierran el overlay y descartan `G.mg`. Son bypass **deliberados**. Lo que no está justificado son los de la categoría D.

### D) Salidas de emergencia hacia `hub`/`fight`/`train` — 9 escrituras, **ninguna pasa por `go()`** ← foco de defectos
| línea | valor | función | riesgo |
|---|---|---|---|
| 1649 | `'hub'` | `fightStart()` — rival desaparecido | bajo (pone `G.fight=null` antes) |
| 4783 | `'hub'` | `goFight()` — sin pelea firmada | bajo (pone `G.fight=null` antes) |
| 8319 | `(G.fight&&!G.fight.over)?'fight':'hub'` | `fxResolveMini()`, rama `catch` | **alto** — si la pelea terminó, va a `hub` con `G.fight` vivo |
| 8381 | `'fight'` | `fightFinishResolve` | medio — salta `nav/fx`, el overlay puede quedar montado |
| 10959 | `'train'` | recuperación de minijuego interrumpido | medio |
| 10962 | `(G.fight&&!G.fight.over)?'fight':'hub'` | misma recuperación | **alto** — idéntico a 8319 |
| 14368 | `'hub'` | `fameStart` si `fxOpen` falla | bajo |
| 14413 | `'hub'` | `onFail` de `fameResolve` | bajo |
| 14958 | `'hub'` | `onFail` análogo | bajo |

### E) Transiciones de estado mayor — 5 escrituras, **ninguna pasa por `go()`**
| línea | valor | función |
|---|---|---|
| 1671 | `'fight'` | `fightStart()` |
| 2157 | `'fightresult'` | `finishFightCore()` |
| 22293 | `'fightresult'` | jueces v2.5 |
| 26084 | `'legacy'` | cierre de carrera / legado |
| 13002 | `'title'` | `onFail` de `loadGame()` |

### F) Código de diagnóstico — 1 escritura
| línea | valor |
|---|---|
| 27978 | `UI.screen=s` dentro del auto-test "pantallas abiertas tras el retiro" (valores del literal `['legacy','hall','history','stats','menu']`, todos válidos) |

### Resumen del punto 4
- **1 de 37** (2,7 %) pasa por `go()` y por tanto por los 5 hooks `nav`.
- **36 de 37** los saltan. 18 son bypass deliberados (entrada a `mg`), 3 son internos del despachador, y **15 son navegaciones reales sin bus** (categorías D + E), de las cuales **2 son un agujero demostrado** (B-003).
- Las 12 escrituras en cadenas `onclick` (5141, 5240, 8721, 8759, 8760, 13543, 13927, 13934, 24492, 24521, 24550, 24669) **todas** van a `'title'` y **todas** son botones "Volver al inicio" que sólo se muestran fuera de partida o al final. Riesgo: bajo, pero saltan `nav/retiro` y `nav/casino` igual.

---

## 5. `renderNav()`, overlays (`fxOpen`/`fxClose`, `#fxmg`) y la pantalla `mg`

### 5.1 `renderNav()` — base 4041–4049, override 8731–8734
```js
function renderNav(){
  if(['title','create','ending','fight','mg'].indexOf(UI.screen)>=0 || !G || !G.player){ NAV.style.display='none'; return; }  // 4042
  NAV.style.display='grid';
  var items=[['hub','◉','Inicio'],['train','⚡','Entrenar'],['rank','≡','Ranking'],['people','◐','Gente'],['menu','⚙','Menú']];
  NAV.innerHTML = items.map(function(i){
    return '<button class="'+(UI.screen===i[0]?'on':'')+'" onclick="go(\''+i[0]+'\')">...';  // 4046
  }).join('');
}
```
- Lista negra **hardcodeada** de 5 pantallas en 4042, en paralelo al mecanismo declarativo `sc.nav==='hide'` de `clDraw` (17565), que en la tabla sólo usa `load` (17502). **Dos mecanismos para lo mismo** → B-006.
- El override 8731 añade un caso más (`legacy` sin partida) llamando a `_legRenderNavPrev()` después.
- 4046 marca la pestaña activa comparando `UI.screen===i[0]`. Con un `UI.screen` desconocido ninguna queda marcada (ver B-005).
- `renderNav` es **pura**: reconstruye `NAV.innerHTML` en cada dibujo, sin tocar `G`. Verificado en el barrido de pureza.

### 5.2 Overlays `fxOpen` / `fxClose` / `#fxmg`
- `fxOpen(key,kind,mg,onEnd)` — **7049–7104**. Crea `<div class="fxmg" id="fxmg">` (7058–7059) con un `<canvas>` y el botón `#fxmgExit`, lo cuelga de `document.body` y **monta 13 listeners** (7081–7096). Bloquea el scroll del body (7099–7100), arranca un `setTimeout` de guardia de 32 s (7102) y el `requestAnimationFrame` del bucle (7103).
- Guardia de instancia única: `if(FX.running && FX.S && !FX.S.finished) return false;` (7053) + `fxClose(true)` inmediato (7054). Correcto.
- `fxClose(silent)` — **7111** en adelante. Early-return si no hay nada montado (7114), luego cancela `raf`/`guard` y desmonta los 13 listeners.
- El overlay es **DOM puro, fuera de `APP`**: `render()` sólo reescribe `APP.innerHTML`, así que redibujar **no** toca `#fxmg`. Esto es deliberado: la pantalla `mg` es el *fondo* del overlay.
- La única limpieza automática del overlay al navegar es el hook `nav/fx` (8397). Cualquier salida por escritura directa de `UI.screen` (categoría 4-D, p.ej. 8381, 10959) **no lo dispara**. En esas rutas `fxClose(true)` se llama a mano (10957), salvo en 8381.

### 5.3 La pantalla `mg`
- Registro: `mg: {fn:function(){ if(!G || !G.mg) return null; return scrMG(); }}` — **17527**. Sin `any`, sin `nav:'hide'` (la ocultación la hace la lista negra de 4042).
- `scrMG` base 4557–4751 (sparring, finish, cardio, fuerza, drills, gameplan, pesaje, prensa, recuperación, nego).
- `scrMG` ganadora 17695–17740: despacha por `mg.type` a `scrChat` / `scrFame` / `tgScreen` / `fxMiniScreen` / `scrMGArcade` / `CL_BASE_SCRMG`, y añade paneles de negociación y pesaje.
- Salida: `mgClose(consumesWeek)` — **4756–4770**. Tiene guard de doble toque (`if(!old) return;`, 4762) y sale por `go('hub')` (4766 y 4767), es decir **sí** pasa por el bus. Es la ruta correcta; las 9 salidas de emergencia de la categoría 4-D no.
- Con `G.mg` nulo, la entrada de la tabla devuelve `null` → `clDraw` reescribe a `hub` (17569) y cae en `CL_BASE_RENDER`. Comportamiento verificado.

---

## 6. CRÍTICO — Por qué `render()` NO es puro

### 6.1 Reproducción

```
node -e "H=require('./dev/harness.js'); A=require('./dev/autopilot.js'); ..."
```

| variante | huella `STATE.fingerprint(true)` | semanas | eventos | peleas |
|---|---|---|---|---|
| semilla 1000, render normal | `3e749205` | 120 | 75 | 11 |
| semilla 1000, `render = ()=>{}` | `ab1ebb05` | 120 | 64 | 12 |
| semilla 1001, render normal | `84a88285` | 120 | 75 | 9 |
| semilla 1001, `render = ()=>{}` | `25e61c32` | 120 | 64 | 11 |

Confirmado: dibujar cambia el resultado del juego.

### 6.2 Descarte de las hipótesis del enunciado

Medido sobre una carrera de 200 semanas (semilla 1000):

| Candidato | Veredicto | Prueba |
|---|---|---|
| `dedupeDOM()` (15884, llamado en 17584) | **INOCENTE** | Sólo redefine el *setter* de `APP.innerHTML` con un guard `_perfDeduped` (15886). Medido: `dedupeDOM()` no muta `G` ni avanza `G.rs`. |
| Bloque de saneo de NaN → `normalizeWorldState()` (17594–17599) | **INOCENTE — rama muerta** | Contador de `errRecord('nan:...')` a lo largo de 200 semanas de autopiloto: **0**. La condición `APP.innerHTML.indexOf('NaN')>=0` nunca se cumple. `normalizeWorldState` es alias de `normalizeFull` (6244) y es, además, idempotente. |
| `hookEmit('render:after')` (17601) y sus suscriptores | **INOCENTE** | El bus tiene **exactamente 1** suscriptor: `barraDeuda@10` (21837) → `debtBarUpdate()` (21817). Medido: no muta `G` ni avanza `G.rs` (sólo toca `DEBTBAR`, estado de módulo, y el DOM). |
| `clDraw()` en sí | **INOCENTE** | Sólo escribe `UI.screen`/`CL_LAST_DRAWN`, que están fuera de la huella. |

### 6.3 La causa real: dos `pick()` en la ruta de dibujo

Instrumentando `rnd()` con captura de pila **sólo mientras `render()` está en curso**, a lo largo de una carrera completa aparecen **exactamente tres sitios** y todos son el mismo patrón:

```
48 llamadas :: pantalla 'fight'
   rnd -> pick (HTML 638) -> cornerAdvice (HTML 2117) -> scrFight (HTML 4803) -> clDraw

 3 llamadas :: pantalla 'fightresult'
   rnd -> pick (HTML 638) -> postFightQuote (HTML 4871) -> scrFightResult (HTML 4847) -> clDraw

 1 llamada  :: pantalla 'fightresult'
   rnd -> pick (HTML 638) -> postFightQuote (HTML 4869) -> scrFightResult (HTML 4847) -> clDraw
```

- **`cornerAdvice()` — línea 2117:** `return pre + pick(tips);`. Llamada desde `scrFight()` **línea 4803** (`esc(cornerAdvice())`), dentro de la rama `if(UI.sub==='corner')`.
- **`postFightQuote()` — líneas 4868, 4869, 4870 y 4871:** cuatro `return` distintos, cada uno con un `pick([...])`. Llamada desde `scrFightResult()` **línea 4847**.

`pick(a)` (638) es `a[Math.floor(rnd()*a.length)]`, y `rnd()` (579–586) **avanza `G.rs`**, la semilla del mundo. Cada llamada desplaza el flujo aleatorio del juego entero.

### 6.4 Prueba definitiva de causalidad (aislamiento)

Se ejecutó una tercera variante, `nornd`: render **completo y activo**, pero con `cornerAdvice` y `postFightQuote` sustituidas por constantes (se elimina el consumo de RNG y **nada más**).

| variante | semilla 1000 | semilla 1001 |
|---|---|---|
| render normal | `3e749205` — 75 ev / 11 peleas | `84a88285` — 75 ev / 9 peleas |
| render **stubeado** | `ab1ebb05` — 64 ev / 12 peleas | `25e61c32` — 64 ev / 11 peleas |
| render activo **sin esos dos `pick`** | **`ab1ebb05`** — 64 ev / 12 peleas | **`25e61c32`** — 64 ev / 11 peleas |

**`nornd` ≡ `stub`, huella por huella, en las dos semillas.** Queda demostrado que **el 100 % de la divergencia `render` activo / `render` stubeado se explica por esas dos funciones**, y que ninguna otra parte de la cadena de render (dedupe, saneo de NaN, `render:after`, los 6 hooks de `screen:fight`, los 4 de `screen:fightresult`, la tabla de pantallas) toca la simulación.

### 6.5 Por qué esto es especialmente grave aquí
El propio archivo documenta la regla en **587–596**:
> *"`rnd()` avanza `G.rs`, que es la semilla del mundo. Si una pantalla lo llama mientras dibuja, ABRIR esa pantalla cambia los resultados posteriores del juego y rompe la reproducibilidad por semilla (el juego tiene códigos de carrera y modo semilla, así que esto es una garantía real, no un detalle)."*

Y provee la herramienta correcta: `dispHash(key)` (598) y `pickStable(a,key)` (602), **ya usada** por `memRef()` (4826–4831) con el comentario *"dibujar la pantalla no puede consumir el flujo aleatorio del mundo"*. Detalle revelador: `postFightQuote` (4867) **ya llama a `memRef(c)`** — pero guarda el resultado en una variable `m` que **nunca usa**, y acto seguido usa `pick()`. Son dos violaciones residuales de una regla que el resto del archivo cumple.

Consecuencia jugable concreta (no sólo de huella): en la pantalla de pelea, **entrar y salir del panel "Entre rounds"** (`UI.sub='corner'`) consume un `rnd()` por cada dibujo. El jugador que mira el consejo del córner obtiene un desarrollo de combate distinto del que no lo mira, y una partida no se puede reproducir desde su código de carrera.

---

## 7. Renderizadores `scr*` con efectos secundarios

Barrido exhaustivo en runtime: se ejecutaron **las 33 entradas de `CL.SCREENS`** con una partida avanzada (80 semanas), midiendo `G.rs` y un volcado JSON completo de `G` antes/después de cada `fn()`.

| Pantalla | ¿avanza RNG? | ¿muta `G`? | Qué muta y dónde |
|---|---|---|---|
| `fight` | **SÍ** (sólo con `UI.sub==='corner'`) | **SÍ** | RNG: `cornerAdvice` 2117 ← `scrFight` 4803. Mutación: crea `G.fight.tq` en `TQ.fs()` **20410**, llamado por `TQ.fightPanel()` **25989** desde el hook `screen:fight/tecnicas@45` (**21338**). Hook por hook: sólo `tecnicas` muta; `medidorDano`, `minijuegos`, `alcance`, `hudCL`, `identidadCombate` son puros. |
| `fightresult` | **SÍ** | no | `postFightQuote` 4868–4871 ← `scrFightResult` 4847 |
| `people` | no | **SÍ** | `relSummary(r)` **2834–2836** escribe en el objeto recibido (`r[_k]=clamp(...)`). Llamado desde `scrPeople` **4948** (`relSummary(c.rel)`) y **4960** (`relSummary(m.rel)`). Medido: crea `rivalry/fear/resent/interest` en `G.coaches[0].rel` y `G.mgrs[5].rel`. |
| `gyms` | no | **SÍ** | `gymIdentity(g)` **13143–13151** escribe `philo`, `spec`, `spec2`, `specName`, `spec2Name`, `tier` en cada gimnasio. Medido: **54 campos nuevos** en `G.gyms` al abrir la pantalla una vez. Llamado desde `scrGyms` (13250) y `gymById` (13153). |
| `gym` | no | **SÍ** | misma vía: `gymById(p.gym)` → `gymIdentity` |
| `social` | no | **SÍ** | `socBudget()` **13223–13224** crea `G.socWeek={at,used,log,cats}` |
| `casino` | no | **SÍ** | `CAS.S()` inicializa `G.cas`/`G.casG` al dibujar |
| `hub` | no | no | `scrHub` base (4395) y la reasignada (17608) son **puras** |
| `rank` | no | no | escribe `UI.tmp.rank` (4876), **no** `G`. Fuera de la huella. |
| `train`, `stats`, `history`, `menu`, `contracts`, `offers`, `fighter`, `title`, `create`, `legacy`, `hall`, `load`, `retire`, `shop`, `mg`, `tq`, `story`, `bio`, `race`, `ach`, `challenges`, `records`, `endgame`, `clcareer`, `cldiag` | no | no | puras |
| `ending` | — | — | **lanza** `TypeError: Cannot read properties of undefined (reading 't')` si se dibuja sin `G.legacyResult` (ver B-007) |

**Clasificación de los efectos secundarios encontrados:**
- *Consumo de RNG* (rompe determinismo): `fight`, `fightresult` → **B-001**, severidad **alta**.
- *Inicialización perezosa persistida* (`f.tq`, `G.socWeek`, `G.cas`): entra en el save y en la huella → **B-002**, severidad **media**.
- *Hidratación de datos derivados* (`gymIdentity`) y *saneo en sitio* (`relSummary`): deterministas e idempotentes, pero el save de un jugador que abrió "Gimnasios" pesa más que el de uno que no → **B-008**, severidad **baja**.

---

## Hallazgos numerados

### B-001 — `render()` consume el RNG del mundo y rompe el determinismo por semilla
- **Severidad: ALTA · Estado: CONFIRMADO** (reproducido con semillas 1000 y 1001, y aislado)
- **Función y línea:** `cornerAdvice()` **2117** (`pick(tips)`), llamada desde `scrFight()` **4803**; `postFightQuote()` **4868, 4869, 4870, 4871** (`pick([...])`), llamada desde `scrFightResult()` **4847**. Ambas terminan en `pick()` **638** → `rnd()` **579**, que avanza `G.rs`.
- **Evidencia:** con render activo la huella final es `3e749205`; con `render` stubeado, `ab1ebb05`. Sustituyendo **sólo** esas dos funciones por constantes y dejando `render()` **completo**, la huella pasa a ser **exactamente `ab1ebb05`**. Idéntico resultado en la semilla 1001 (`84a88285` → `25e61c32` ≡ `25e61c32`). También cambian los observables jugables: 75→64 eventos y 11→12 peleas en 120 semanas.
- **Impacto jugable:** abrir el panel "Entre rounds" (`UI.sub='corner'`) o redibujar la pantalla de resultado altera todo el desarrollo posterior de la carrera. Los códigos de carrera / modo semilla que el juego expone no reproducen la partida.
- **El archivo ya tiene la solución:** `pickStable(a,key)` **602** / `dispHash(key)` **598**, con la regla escrita en **587–596** y aplicada correctamente en `memRef()` **4826–4831**. De hecho `postFightQuote` **4867** ya llama a `memRef(c)` y **descarta el resultado en una variable `m` sin uso**.

### B-002 — Dibujar la pantalla de pelea crea estado persistente (`G.fight.tq`)
- **Severidad: MEDIA · Estado: CONFIRMADO**
- **Función y línea:** `TQ.fs()` **20410** (`if(!f.tq || typeof f.tq!=='object') f.tq={u:{},dodgeAt:-99,back:0,bleed:0,best:0,done:0};`), invocada por `TQ.fightPanel()` **25989** (y su versión previa **21311**) desde el hook `screen:fight/'tecnicas'@45` registrado en **21338**.
- **Evidencia:** test hook-por-hook sobre `screen:fight` con una pelea viva: de los 6 suscriptores, sólo `tecnicas` muta `G`; `scrFight()` completo con `UI.sub=null` muta `G` sin avanzar el RNG, y con `UI.sub='corner'` muta **y** avanza el RNG.
- **Impacto:** `G.fight` se serializa; el save de quien abrió la pantalla difiere del de quien no. No altera resultados en las trazas medidas (B-001 explica el 100 % de la divergencia), pero es estado de partida creado por un dibujo.

### B-003 — Salir de una pelea cobrada sin pasar por `go()` deja `G.fight` vivo y permite re-ejecutar el post-pelea
- **Severidad: ALTA · Estado: CONFIRMADO**
- **Función y línea:** el descarte vive **sólo** en `go()` **4022–4024**. Lo saltan, entre otras, `fxResolveMini()` **8319** (`UI.screen=(G&&G.fight&&!G.fight.over)?'fight':'hub'`, rama `catch`) y la recuperación de minijuego **10962** (línea idéntica). Igual de expuesta queda la ruta de recuperación de errores del propio `render()` **17590**, que pone `UI.screen='hub'` sin tocar `G.fight`.
- **Evidencia (semilla 1000, pelea real):** tras `confirmFight()` (`G.paid=true`), `UI.screen='hub'; render()` deja `G.fight` vivo; volver a poner `UI.screen='fightresult'` **vuelve a dibujar la pantalla de resultado**; y `recStart()` **se ejecuta por segunda vez** abriendo otra vez `G.mg` de tipo `'rec'` (3 semanas de recuperación y sus mejoras, repetidas). Por `go('hub')`, en cambio, `G.fight` queda en `null`.
- **Impacto:** exploit de repetición del post-pelea (recuperación; y `confirmFight()` sólo está protegido por el flag `G.paid`). Además la pelea muerta se serializa en todos los saves y fija al rival en `pruneWorld()`, exactamente lo que el comentario 4014–4021 dice que se quiso arreglar.

### B-004 — Doble `window.scrollTo(0,0)` en cada navegación
- **Severidad: BAJA · Estado: CONFIRMADO**
- **Función y línea:** `go()` **4026** y `clDraw()` **17566**.
- **Evidencia:** `h.scrollCalls()` registra **2** llamadas en `go('rank')` desde `hub` (cambio de pantalla) y **1** cuando ya se está en `rank`. La de `go()` es redundante: `clDraw` ya cubre el caso de cambio de pantalla, y la propia `go()` no puede saber si un hook `nav` la redirigió a la pantalla en que ya estaba.
- **Impacto:** cosmético/perf. En navegador son dos reflows por navegación.

### B-005 — El router de emergencia no repara `UI.screen`
- **Severidad: MEDIA · Estado: CONFIRMADO (demostrado en código y reproducido)**
- **Función y línea:** `CL_BASE_RENDER` = `render` base **4053–4056**; invocada desde `clDraw()` **17573** tras `CL_LAST_DRAWN=null` (17572).
- **Evidencia:** con `UI.screen='noexiste'`, `render()` dibuja el hub pero **`UI.screen` sigue valiendo `'noexiste'` indefinidamente**, y no se produce ningún `scrollTo`. Los dibujos siguientes repiten el camino de emergencia.
- **Impacto:** (a) `renderNav()` **4046** no marca ninguna pestaña activa; (b) las tablas `NAV_OPEN`/`NAV_RETIRED` (4005/4007) y el hook `nav/casino` (23351, compara `c.from`) trabajan con un `from` basura; (c) `CL_LAST_DRAWN` queda clavado en `null`, así que el siguiente dibujo válido siempre scrollea.
- **Atenuante (por eso no es alta):** se verificó que **los 28 destinos literales de `go('X')` del archivo tienen entrada en `CL.SCREENS`** (33 registradas), y `UI.screen` no se persiste en el save. La rama es una red de seguridad, hoy inalcanzable por las rutas normales. `clDraw` **sí** repara `UI.screen` en las otras dos ramas (17560, 17569): la inconsistencia está sólo en la tercera.

### B-006 — Dos mecanismos paralelos para ocultar la barra de navegación
- **Severidad: BAJA · Estado: CONFIRMADO**
- **Función y línea:** lista negra hardcodeada en `renderNav()` **4042** (`['title','create','ending','fight','mg']`) frente al mecanismo declarativo `sc.nav==='hide'` de `clDraw()` **17565**, que en la tabla `CL.SCREENS` se usa **una sola vez**, en `load` (**17502**). Un tercer criterio se añade en el override **8732** (`legacy` sin partida).
- **Impacto:** dar de alta una pantalla sin NAV exige acordarse de un sitio u otro según cómo se registre. Las pantallas registradas después con `CL.screen()` (p.ej. `tq` 21229, `casino` 23228, `clcareer` 18296, `cldiag` 18410, `story` 27264) no pueden ocultar NAV vía la lista negra sin editar 4042.

### B-007 — `scrEnding()` lanza si se dibuja sin `G.legacyResult`
- **Severidad: BAJA · Estado: CONFIRMADO**
- **Función y línea:** entrada `ending` en `CL.SCREENS` **17533** (`{fn:function(){ return scrEnding(); }}`); `scrEnding` en **5227**.
- **Evidencia:** en el barrido de las 33 pantallas, `ending` es la única que lanza: `TypeError: Cannot read properties of undefined (reading 't')`.
- **Atenuante:** `render()` **17586–17592** lo captura, registra `errRecord('render:ending')` y devuelve al jugador al hub con un aviso. Es decir: la red de recuperación funciona, pero `ending` es la única entrada de la tabla que **no** implementa el contrato "devuelvo `null` si no puedo dibujarme" que sí usan `fight` (17520), `fightresult` (17525), `mg` (17527) y `retire` (17503).

### B-008 — Pantallas informativas que hidratan/sanean estado persistido al dibujarse
- **Severidad: BAJA · Estado: CONFIRMADO**
- **Funciones y líneas:** `relSummary(r)` **2834–2836** (escribe en el `rel` recibido) llamada desde `scrPeople` **4948** y **4960**; `gymIdentity(g)` **13143–13151** llamada desde `scrGyms` **13250** y `gymById` **13153**; `socBudget()` **13223–13224** (crea `G.socWeek`) desde `scrSocial` **11617**; `CAS.S()` desde la pantalla `casino` **23228**.
- **Evidencia:** abrir "Gimnasios" una vez añade **54 campos** a `G.gyms`; abrir "Personajes" una vez añade 8 campos a `G.coaches[0].rel` y `G.mgrs[5].rel`; abrir "Social" crea `G.socWeek`.
- **Impacto:** deterministas e idempotentes (no consumen RNG), pero hacen que la huella de estado y el tamaño del save dependan de qué pantallas visitó el jugador. Corresponden a `normalize*`/`hookOn('load')`, no al dibujo.

---

## Anexo — comandos de reproducción

```bash
cd /home/user/CAGE-LEGACY

# B-001: aislamiento de la causa (normal vs stub vs sin-RNG-en-render)
node -e "
const H=require('./dev/harness.js'), A=require('./dev/autopilot.js');
function run(mode,seed){
  const h=H.boot({seed}); h.ctx.saveSerialize=()=>'{}';
  H.startCareer(h,{metaSeed:500000,style:'boxer',style2:'kick',div:'FLY',age:20,pers:'humble'});
  const c=h.ctx;
  if(mode==='stub')  c.render=function(){};
  if(mode==='nornd'){ c.cornerAdvice=()=>'x'; c.postFightQuote=()=>'y'; }
  const r=A.correrCarrera(h,{maxWeeks:120,politica:'basica',seedPolitica:seed});
  return c.STATE.fingerprint(true)+' '+JSON.stringify(r);
}
for(const s of [1000,1001]) for(const m of ['normal','stub','nornd']) console.log(s,m,run(m,s));
"

# B-001: traza de pila de cada rnd() consumido dentro de render()
#   (envolver c.rnd y c.render, acumular new Error().stack)

# B-004 / B-005: contador de scrollTo con h.scrollCalls() / h.clearScroll()

# 7: barrido de pureza de las 33 pantallas
#   para cada k de Object.keys(ctx.CL.SCREENS): UI.screen=k; comparar G.rs y JSON.stringify(G) antes/después de fn()
```

---

## Adenda F2 · `G.mg` tiene 30 escritores y cerrar un minijuego no lo posee nadie

Buscando si `fightFinishResolve` / `sparFinishResolve` eran duplicación real o
descomposición sana, apareció algo más grande detrás.

### Los 30 escritores de `G.mg`

**11 abridores, cada uno con su propia forma**, construidos en línea sin constructor
compartido: `spar` 2347, `cardio` 2474, `str` 2502, `drill` 2532, `gp` 2572, `weigh` 2622,
`press` 2719, `rec` 2769, `nego` 2798, `chat` 11838, `pod` 13498. Más tres abridores
genéricos (2422, 10734, 14485) con el molde `G.mg=mg; UI.screen='mg'`.

**El resto son cierres**, y ahí está el problema: **cerrar un minijuego y decidir a qué
pantalla se vuelve está escrito en seis sitios con tres respuestas distintas.**

| línea | a dónde vuelve |
|---|---|
| 8409 | `(G.fight && !G.fight.over) ? 'fight' : 'hub'` |
| 11052 | `(G.fight && !G.fight.over) ? 'fight' : 'hub'` |
| 11049 | `'train'` si `mg.type==='train'` |
| 14487 | `'hub'` incondicional |
| 14532 | `'hub'` incondicional |
| 15077 | `'hub'` incondicional |

Y hay cierres que no deciden pantalla ninguna: 4842, 8464, 8470, 8474, 17708, 22051.

### Por qué importa

Es **exactamente la misma forma que C-002**: nueve llamadores de `advanceWeek`, cada uno
haciendo un subconjunto distinto del cierre de semana. Aquí son seis cierres de minijuego,
cada uno con su propia idea de a dónde se vuelve.

Y explica por qué la capa FX de `fightFinishResolve` (8460) necesita su limpieza
defensiva: como cerrar no lo posee nadie, al fallar la finalización quedaba `G.mg` vivo y
la pantalla en `'mg'`, obligando a pulsar CONTINUAR en bucle. El comentario del archivo lo
dice; lo que no dice es que el arreglo fue **añadir un séptimo cierre** en vez de darle
dueño al cierre.

### Veredicto sobre las dos cadenas que se venían a mirar

`fightFinishResolve` y `sparFinishResolve` tienen 2 capas cada una, **pero no son
duplicación**: las dos capas tienen responsabilidades distintas y la externa delega
explícitamente (cálculo de probabilidad y cierre del intercambio dentro; atajo por
ejecución impecable y saneamiento fuera). No hay ninguna regla escrita dos veces. Fundirlas
sería renombrar, no consolidar — y hay que tener cuidado, porque el `return` de la capa
interna **no** salta el saneamiento de la externa.

**Lo que sí hay que consolidar aquí es el cierre de minijuego**, y eso toca `UI.screen`,
que es el terreno de F3. Va anotado como tal, no se toca en F2.
