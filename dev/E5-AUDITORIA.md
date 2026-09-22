# E5 — lista de auditoría (se va llenando con lo que aparece medido)

> **`story` y `gym` ya NO están acá.** Son **E3b**, y E3b va antes que E4:
> `dev/E3b-STORY-GYM.md`.

## RESULTADO DEL BARRIDO

| frente | herramienta | resultado |
|---|---|---|
| estático | `dev/metrics.js` | `eval` **0** · dependencias externas **0** · escrituras de scroll **3** · escrituras de `UI.screen` **8** · funciones declaradas dos veces **0** · **1 línea duplicada** (corregida, ver abajo) |
| carreras largas | `dev/sim.js`, 200 × 300 semanas | fallos de invariante **0 → 0** |
| enganches aislados | `dev/e5-hooks.js`, 4 × 300 semanas | **0 fallos aislados**; sí deja escrituras parciales → **P-1** |
| caminos a mano | `dev/tests/15-camino.js` | contrato → pelea → pesaje → combate → cobro, y guardar/cargar después. **2 pruebas** |
| UI | `dev/browser-tests.js`, 4 viewports | **77 verdes**, desborde **0/105**, táctiles <44 px **0** |
| save/load | `dev/tests/03`, `09`, `11` | las 5 fixtures + el save congelado, carga idempotente |
| mono | `dev/e5-mono.js`, 4 semillas, ~2.500 toques | **0 errores de JavaScript · 0 invariantes rotas**; sigue guardando y cargando |

### La evidencia, con sus números

| prueba | cobertura | resultado |
|---|---|---|
| **carreras largas** (`dev/e5-largas.js`) | **50 carreras × 300 semanas**, `metaSeed` distinto en cada una (700.000 … 1.088.031), **invariantes después de CADA semana** (17 sistemas) | **15.000 semanas · 50/50 carreras sin un solo fallo** |
| **texto visible** (`dev/e5-texto.js`) | 35 pantallas × 2 estados × 3 resoluciones, leyendo `innerText` y **abriendo las secciones plegadas** | **1 hallazgo → corregido**; ahora sin hallazgos |
| **save congelado pre-refactor** | hecho con `juego-base.html` (1.519 KB, antes del refactor) | carga · **record 7-4 y 2018/47 intactos** · **120 semanas más sin excepciones ni invariantes rotas** · llega a 2020/23 · se vuelve a guardar y cargar |
| **`try`/`catch`** (`dev/e5-catch.js`) | los **108** del archivo, clasificados leyendo el cuerpo | **0 vacíos sin explicación** (eran 5) · 7 explicados · 66 anotan · 3 relanzan |
| **mono** (`dev/e5-mono.js`) | **3 resoluciones × 2 semillas × 600 toques = 3.600 toques**, 164-167 acciones distintas | **0 errores de JavaScript · 0 invariantes rotas** · sigue guardando y cargando en las 6 corridas |
| **enganches aislados** (`dev/e5-hooks.js`) | 4 × 300 semanas | **0 fallos aislados**; sí deja escrituras parciales → **P-1** |

**Sobre el mono y las resoluciones:** con la misma semilla, las tres resoluciones dan
**exactamente el mismo recorrido** (164 acciones, misma semana final). Es honesto decirlo:
el camino no depende del ancho de pantalla, así que las tres resoluciones **no multiplican
la cobertura** — lo que sí cubren es que ninguna se rompe.

### Bugs encontrados y corregidos en E5

| id | qué | severidad | estado |
|---|---|---|---|
| **E5-2** | La cabecera de `story` decía **«undefined/undefined»** en cada visita: el código leía `CAT_NAMES.MEDIA`/`.SOCIAL` y la tabla tiene las claves **en minúscula**. Visible para el jugador. | **grave** (texto roto a la vista) | **corregido** |
| **E5-3** | `acceptFight(i)` sobre una oferta de **contrato** la trataba como «pelea caducada»: avisaba «esa oferta ya no está disponible» y **la borraba**. Ninguna vía de la interfaz llega así (los contratos van a `negoStart`), pero la batería de autotest llama `acceptFight(0)` a ciegas. | menor (latente) | **corregido** |
| **E5-4** | El reset de emergencia de `UI` reponía `{screen, sub, tmp}` **sin `sec`**, dejando `UI` con otra forma que la declarada. | menor | **corregido** |
| **E5-5** | **5 `catch` vacíos sin una línea que dijera por qué.** Ninguno tapa un error funcional —son introspección, el propio registrador de errores, la reposición de `localStorage` tras la prueba de cuota y la lectura de `?dev=1`—, pero un `catch(e){}` pelado no se distingue de un descuido. | cosmético | **corregido** (y `dev/e5-catch.js` falla si vuelve a aparecer uno) |
| **E5-1** | `DEV.initFromUrl` tenía la **misma línea dos veces** (`var q = …`): una sentencia muerta, resto de un copiar-pegar. | cosmético | **corregido** |

### Qué pasó con `acceptFight(0)`

Apareció escribiendo `dev/tests/15-camino.js`: la prueba llamaba `acceptFight(0)` y no se
firmaba ninguna pelea. **El primer fallo era mío** —`G.offers` mezcla contratos y peleas, y
al empezar una carrera lo que llega son contratos—, así que la prueba se reescribió para
recorrer el orden real: **contrato → `negoStart` → `negoClose` → ofertas de pelea**.

Pero al mirarlo apareció **E5-3**, que sí es del juego: pasarle a `acceptFight` una oferta
que no es de pelea la **borraba** con un mensaje falso. Hoy ninguna vía del jugador llega
ahí, pero la batería de autotest sí. Corregido: una oferta que no es de pelea se deja donde
está y se explica por qué.

### Lo que se buscó y NO apareció

Ni una invariante rota en 200 carreras de 300 semanas, ni un error de JavaScript en ~2.500
toques al azar, ni un fallo de enganche aislado en 1.200 semanas. Las redes que se fueron
construyendo (187 pruebas + 77 de navegador) se quedaron verdes durante todo el barrido.
**Los bugs de esta obra aparecieron casi todos midiendo, no ejecutando** — y la mitad
estaban en el instrumento, no en el juego.

---

## A-1. `hookRun` se traga errores que la trampa global no ve

**El hallazgo.** Al escribir la red del rollback (`dev/tests/14-rollback.js`) quedó fijado
que un enganche de `week` que falla **no deshace la semana**: `hookRun` lo aísla, lo anota
en `G.hookFails` y sigue con los demás. Es política deliberada —`HOOK_ABORT` enumera los
seis eventos que sí abortan— pero tiene una consecuencia que no está medida:

> **la trampa global de errores no ve esos fallos.** Un enganche puede fallar cada semana
> de una carrera entera y el jugador no se entera, porque el contador `G.hookFails` no se
> mira en ninguna parte visible y el error no llega a `ERR`.

**HECHO, con `dev/e5-hooks.js`** — que envuelve `hookRun` **desde fuera**, en el sandbox, sin
tocar una línea del archivo del juego:

1. **Contar:** **0 fallos aislados** en 4 carreras × 300 semanas. La política no está
   tapando nada en juego normal.
2. **Escrituras parciales: SÍ las deja.** Con un enganche semanal que escribe un campo y
   revienta justo después: la popularidad pasó de **7,69 a 12,49** (la primera escritura
   quedó), la semana **avanzó igual** y `G.hookFails` subió a 1.

No es un bug del rollback —el rollback ni se dispara—, es el precio de la política
deliberada de aislar. Como es decisión de diseño del blindaje, va a **`dev/PENDIENTES.md`
§P-1** con las tres opciones y mi recomendación, y no se tocó.

## A-2. `stats` sigue sin salidas propias

E3 le dio contenido (las estadísticas clave del estilo, plegadas) y la bajó de 4,42 a 1,85
pantallas, pero sigue teniendo **0 botones**: se entra y sólo se sale por la barra. Decisión
5 del mapa: darle salidas es E5.
