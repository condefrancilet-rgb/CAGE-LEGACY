# F2 — Parte estructural: plan de consolidación

> Los 14 bugs de `dev/AUDIT.md` son correcciones puntuales. Esto es la otra mitad de F2:
> fundir las cadenas de redefinición **sin cambiar el comportamiento**, demostrado con
> golden master idéntico. Orden fijado por el encargo.

## Métricas de control (trinquete en `dev/tests/05-metricas.js`)

| métrica | línea base | objetivo F2 |
|---|---|---|
| nombres definidos >1 vez | 43 | bajar, no subir |
| wrappers que capturan la previa | 42 | bajar, no subir |
| escrituras directas de `UI.screen` | 37 | bajar (prepara F3) |
| escrituras de scroll | 3 | **no tocar** (I1) |

El mapa vivo, verificado en runtime, está en `dev/baseline/redef-map.json`
(`node dev/redef-map.js`). Dice qué definición **gana de verdad**, que es lo que importa al
consolidar, no cuál es más prolija.

## Punto 0 — el cierre de semana (viene de C-002) ✅ HECHO (F2-15)

**Antes que cualquier otra consolidación.** El cierre de semana está duplicado a mano en
los nueve llamadores de `advanceWeek`, cada uno con un subconjunto distinto (tabla en
`dev/DECISIONS.md`, D-011). De ahí sale C-002: terminar un minijuego de entrenamiento
nunca publica las noticias de esa semana ni genera ofertas.

**Resuelto en F2-15.** Se extrajo : publicar es lo único no opcional,
porque es lo único que se pierde; el resto lo declara cada llamador. Seis migrados.
Resultado medido: estado observable y traza semana a semana **idénticos** en las 5
semillas; sólo cambia el contenido del feed.  queda fuera a propósito
(recoge en  para el resumen del bloque).
Queda para F14 la decisión de diseño: hoy terminar un minijuego de entrenamiento sigue sin
generar ofertas.

## Orden y candidatos

### 1. `startCareer`
Comentario del archivo: *"14 implementaciones encadenadas"*, ya fundidas. **Verificar** que
no queda ninguna y cerrar. Riesgo bajo.

### 2. `loadGame` / save
`savePrune` tiene 2 capas (base 12603 + `_qSavePrunePrev` 13891, "saveCompact").
Candidato claro a una función con dos pasos explícitos.
**Ojo**: aquí vive la deuda gorda, no la cosmética — `saveGame` está acoplado a
`normalizeWorldState` (F-005/A-006). Guardar **muta el mundo**: poda `lastFights` a 6,
`mem` a 8, `career` a 12 de todos los NPC, `news` a 40 y `retiredList` a 60, sobre el `G`
vivo. Desacoplarlo **sí** cambia comportamiento observable, así que no es consolidación:
es un cambio que necesita su propia evidencia y probablemente su turno en F4.

### 3. `advanceWeek`
Ya es una sola definición (1249 → `TX.run` → `advanceWeekCore`). **Nada que consolidar.**
Lo que queda es de F3/F4: 30 hooks de `week` con empates de orden resueltos por orden de
carga del archivo (C-014) y `audit_final_week` registrado sin `order`, que corre en la
posición 16 de 30 creyéndose final (C-007).

### 4. Combate — **siguiente candidato, pero necesita red propia primero**
`eff`, `oppAction` y `fightAct` ya se consolidaron en una sesión anterior (3 capas → 1
función + suscripciones). **Pendiente**: `fightFinishResolve` y `sparFinishResolve` tienen
2 capas cada una; `TQ.apply` duplica a mano las reglas de reloj de `fightAct` con
constantes distintas y sin emitir `exchange:pre/post` (D-009) — eso es duplicación real de
lógica, no un wrapper.

Son **tres** cierres de intercambio con tres relojes distintos (`ri(38,62)`, `ri(24,46)`,
`ri(30,52)`) y sólo uno emite los hooks (adenda F2 de `dev/audit/D-combate.md`). Medido:
en 5 carreras x 200 semanas el autopiloto cierra **1433 intercambios por `fightAct` y 0
por los otros dos** — lo que significa que **el golden master no puede validar este
refactor**, igual que no podía validar el respaldo de `rollEvent`. Hay que escribir antes
una caracterización que conduzca `TQ.apply` y `fightFinishResolve` desde el harness.

Frontera: unificar las tres constantes de reloj es **balance** (F14). Emitir los hooks en
los tres caminos **cambia comportamiento** y necesita su propia evidencia. Lo que sí es
consolidación es que la estructura del cierre viva en un solo sitio con el coste de reloj
como parámetro.

### 5. Entrenamiento
`campWeek` ya es 1 función + 2 puntos de extensión. Poco que hacer.

### 6. Navegación / render
`render` 2 capas (base 4053 + canónica 17583, con `CL_BASE_RENDER` como router de
emergencia): **la estructura es sana**, el base es alcanzable sólo para `UI.screen`
desconocido. `renderNav` 2 capas (`_legRenderNavPrev`). `scrHub`, `scrMG`, `scrGym`,
`scrContracts`, `scrEnding`, `scrTrain`: 2 capas cada una, todas con el mismo molde
`_prevX`. **Es el bloque con más wrappers y el más mecánico de fundir.**

### 7. Minijuegos
`cardioStart`, `strStart`, `drillStart` tienen **3 capas** cada una y las tres están
envueltas por GATE en runtime (`redef-map` las marca "no coincide con ninguna definición
del archivo"). Requiere cuidado: hay que fundir sin romper la envoltura de GATE.

### 8. Eventos ✅ HECHO (F2-16, F2-17)
**El candidato más claro de todo F2.** `rollEvent` tiene **4 capas** (5265, 22011, 25847,
26388) y **tres constructores duplicados del mismo objeto** — lo destapó el arreglo de
G-001, que hubo que aplicar tres veces. Además:
- la veda `EV_COOL` de la capa 2 y la puerta `CL.dramaOk` son **código muerto** en el
  camino normal, porque la capa 4 sólo cae a las anteriores si su pool queda vacío (G-002);
- el hook `event:pre`/`simulacion` era inalcanzable hasta el arreglo de G-001.

Fundirlas en una función con la política declarada haría visible qué reglas están vivas.

**Resuelto en F2-16 y F2-17.** Primero se fundieron los dos predicados del filtro en
`eventCore()` + un nivel de exigencia (F2-16, golden idéntico). Después las cuatro capas en
una sola función con la escalera declarada de tres niveles (F2-17). Medido antes de tocar
nada: **328 de 328 sorteos de juego real salen por la capa 4**; las de abajo eran, en
conjunto, un tercer nivel de la misma escalera. `CL.evNivel()` deja la política medible
desde fuera y `dev/tests/07-rollevent.js` la fija con 7 pruebas de caracterización escritas
**contra las cuatro capas** y que siguen valiendo contra la función única. Dos diferencias
aceptadas, ambas dentro del nivel 3 que el juego no recorre: D-012.

### 9. Progresión de rivales
`pruneWorld` 2 capas (`_clPrune`). `rollEvent` cubre buena parte del resto.

## Cómo se demuestra "mismo juego"

1. **Igualdad exacta de golden traces** cuando el refactor preserva el orden de llamadas al
   RNG. Es el caso normal de una consolidación bien hecha.
2. Si el orden cambia **legítimamente**, equivalencia estadística con `dev/sim.js --file`
   entre una copia congelada de antes y el archivo actual: medias dentro de 2 errores
   estándar, proporciones dentro de 2 pp. Documentar **por qué** se rompió la igualdad.

`boot({file})` y `sim.js --file` existen precisamente para esto: comparan dos versiones en
el mismo proceso, con las mismas semillas, sin revertir el árbol de trabajo.

## Lo que NO es consolidación, aunque lo parezca
- Desacoplar `saveGame` de `normalizeWorldState` → cambia comportamiento (F4).
- Arreglar el orden de los hooks de `week` → cambia comportamiento (F3/F4).
- Unificar el bloque (`advancePeriod`) con la semana a semana (`doWeek`) → es balance
  (C-013), va a F14.
