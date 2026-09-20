# DECISIONES — CAGE LEGACY

Formato: contexto · opciones · elección · motivo · cómo revertir.

---

## D-001 · Rama de trabajo
**Contexto.** El encargo pide trabajar en `cage-legacy-rework`; la sesión venía de
`claude/cage-legacy-scroll-bug-b5vpri`.
**Elección.** Rama `cage-legacy-rework` creada desde el commit `b9480fe`, que ya
contiene la corrección de scroll (I1). Tag `baseline-original` en ese punto.
**Motivo.** I1 declara la corrección de scroll como punto de partida, no como
algo a rehacer. La línea base del encargo es el juego *con* esa corrección.
**Revertir.** `git checkout claude/cage-legacy-scroll-bug-b5vpri`.

## D-002 · Identificación del archivo del juego
**Contexto.** F0.1 pide identificar el archivo real con certeza.
**Hecho.** Un único candidato: `index-4-blindado.html`, el único fichero trackeado
en git (`git ls-files`), sin archivos sin trackear, árbol limpio. No hay ambigüedad.
**Motivo.** Criterios de F0.1 (trackeado / más reciente / referenciado) convergen
en el mismo y único archivo.

## D-003 · Discrepancia de métricas contra documentación previa
**Contexto.** Un informe anterior declaraba 1.527.433 bytes y 28.116 líneas.
**Medido.** Al inicio del encargo anterior: 1.537.617 bytes, 28.115 líneas, md5
`2647c709…`, procedente del commit `532b639 "Add files via upload"` firmado por el
propio usuario, con árbol de trabajo idéntico a HEAD.
**Elección.** Continuar. La procedencia es verificable (commit del usuario, sin
modificaciones sin trackear); las métricas del informe describen una versión
anterior del archivo, no una corrupción.
**Estado actual** (tras la corrección de scroll): 1.538.459 bytes, md5 `f167031e…`.

## D-004 · `render()` no es puro — no se puede stubear en el harness
**Contexto.** Para acelerar la simulación se probó sustituir `render()` por un no-op.
**Medido.** Con render real: huella `05ab9909`, récord 9-3, 12 peleas.
Con render stubeado: huella `53f42e55`, récord 6-3, 9 peleas.
**Elección.** El harness **nunca** sustituye `render()`.
**Motivo.** El renderizador tiene efectos sobre el estado de la simulación
(consume RNG y/o dispara saneamientos). Stubearlo mediría otro juego.
Es además un hallazgo de F1-B: *los renderizadores no son puros*.

## D-005 · La simulación masiva omite sólo `saveSerialize`, nunca `saveGame`
**Contexto.** `saveGame` consume el 62% del tiempo de una carrera.
**Medido.** `saveGame` llama a `savePrune(G)` y dispara `normalizeWorldState`
(25,8 ms × 279 llamadas por carrera de 150 semanas): **muta el mundo**.
Desactivar `saveGame` entero cambia el estado (difieren `fighters`, `news`,
`player`, `cl`). Sustituir sólo `saveSerialize` (la cadena que va a
localStorage) deja la huella **idéntica** (`05ab9909` = `05ab9909`), 1,5×.
**Elección.** `sim.js` sustituye `saveSerialize` por defecto; `--io` lo conserva.
Los golden traces corren siempre con comportamiento completo.
**Revertir.** Pasar `--io` o borrar la línea en `dev/sim.js`.

## D-006 · El autopiloto firma el contrato por la vía real
**Contexto.** Una carrera nueva empieza sin organización: las primeras ofertas
son de contrato y pasan por el minijuego de negociación (`negoStart`).
**Elección.** El autopiloto llama a `negoStart(oferta)` y luego `negoClose()`
—acepta sin regatear— en vez de escribir `G.player.org` a mano.
**Motivo.** Mantiene el camino real del juego: contrato, exclusividad, memoria
del mánager y `rebuildRosters`/`recalcRank`. Escribir el campo a mano habría
producido un mundo que el juego nunca genera.

## D-007 · Semilla del mundo en el harness
**Contexto.** `createDraft()` llama a `syncCreateInputs()`, que repisa el borrador
leyendo inputs del DOM; sin navegador quedan vacíos y `metaSeed` vuelve a 0.
**Elección.** `H.startCareer()` neutraliza `syncCreateInputs` **sólo dentro del
harness** y fija el borrador en `UI.tmp.c`.
**Motivo.** El juego no se toca (I2/«el juego no conoce al harness»). Sin esto la
simulación no sería reproducible por semilla.

## D-008 · H-005: se corrige el compuesto, no el apilado — **decisión del usuario**
**Contexto.** H-005 tiene dos mitades: (a) el reescalado anual compone sobre el valor ya
reescalado, que es exponencial sin techo; (b) el evento `sponsor` (2906) no tiene guarda
`seen()`, así que los patrocinios se apilan sin límite.
**Consulta.** Se planteó que (a) es claramente un bug y (b) **puede ser diseño**.
**Respuesta del usuario:** *"arregla solo el bug de H-005 y segui"*.
**Elección.** Corregido sólo (a). El apilado queda **intacto** y pasa a F14 (economía) como
decisión de diseño, no como defecto.
**Revertir.** El apilado nunca se tocó, así que no hay nada que revertir por ese lado.

## D-009 · Los tags no se empujan — **decisión del usuario**
**Contexto.** El proxy git devuelve `HTTP 403` para refs de tag; la rama sí sube.
**Respuesta del usuario:** *"los tags no importan"*.
**Elección.** Se dejan de intentar. `baseline-original`, `fase-0-ok` y `fase-1-ok` viven
sólo en local; los commits de cada gate quedan identificados en `dev/WORKLOG.md`.

## D-010 · `boot({file})` en el harness para comparar versiones
**Contexto.** Medir el efecto de un arreglo exige un "antes" limpio. Revertir el árbol de
trabajo para cada medición es lento y propenso a dejar restos.
**Elección.** El harness acepta `boot({file})` y carga cualquier versión del archivo
(p. ej. `git show HEAD:index-4-blindado.html`), de modo que dos versiones conviven en el
mismo proceso con las mismas semillas.
**Motivo.** Es lo que permitió demostrar que H-005 **no** causaba la cola de dinero, en vez
de suponerlo. El juego no se entera: es una opción de lectura del arnés.

## D-011 · C-002 no se parchea: necesita la consolidación del cierre de semana
**Contexto.** `mgClose` (4766) y `recPick` (2759) consumen una semana sin volcar
`G.weekLog` al feed y sin llamar a `makeOffers`. Medido: con `recPick` ×3, tres semanas
avanzadas y **0 noticias publicadas**.

**Por qué no se corrige como los otros.** La causa no es una línea olvidada: es que el
cierre de semana —publicar noticias, sortear evento, generar ofertas, guardar— está
**duplicado a mano** en cada llamador de `advanceWeek`. Hay nueve, y cada uno hace un
subconjunto distinto:

| llamador | publica noticias | fireEvent | makeOffers | saveGame |
|---|---|---|---|---|
| `finishWeek` | sí | 42% | 30% | sí |
| `mgClose` | **no** | 42% | **no** | sí |
| `recPick` | **no** | **no** | **no** | sí (GATE) |
| `confirmFight` | **no** | **no** | **no** | sí |
| `gymVisit`/`watchFight`/`travelWith` | **no** | **no** | **no** | sí |
| `advancePeriod` | no (recoge en `sum.news`) | 12% | ahora condicional | sí (GATE, F2-14) |

Añadir las llamadas que faltan a `mgClose` y `recPick` sería **más duplicación**, que es
justo el antipatrón que el encargo prohíbe. Lo correcto es extraer el cierre de semana a
una función con contrato explícito y que cada llamador declare qué parte quiere.

**Elección.** C-002 pasa a ser el **primer punto de la parte estructural de F2**
(`dev/PLAN-F2-consolidacion.md`), no un parche más. Se documenta aquí para que no se
pierda: hoy terminar un minijuego de entrenamiento nunca genera ofertas y nunca publica
las noticias de esa semana.

**Revertir.** No hay nada que revertir: el comportamiento actual queda intacto.

---

## D-012 · Fundir `rollEvent` acepta dos diferencias en el nivel que el juego no recorre

**Contexto.** `rollEvent` tenía cuatro capas encadenadas. Medido: 328 de 328 sorteos de
juego real (8 carreras x 150 semanas) salen por la última; las tres de abajo sólo se
alcanzan con el mazo vacío, y lo que hacen entonces es devolver un evento que cumple
contexto + drama + `c()` **saltándose la veda**. Eso es exactamente un tercer nivel de la
misma escalera, así que caben en una sola función.

**La tensión.** F2 exige consolidar **sin cambiar el juego**, demostrado con golden master
idéntico. Reproducir las tres capas viejas *exactamente* dentro de una función significa
meter dentro tres esquemas de peso distintos y un bucle de doce reintentos: sería una
función única sólo de nombre, y las reglas seguirían escritas más de una vez — que es el
problema que se venía a resolver.

**Decisión.** Se funde a la política declarada de tres niveles y se aceptan **dos**
diferencias, ambas confinadas al nivel 3:

1. el nivel 3 pesa con `eventWeight`, como los otros dos, en vez del peso por
   personalidad de la capa base;
2. si una condición del banco lanza, propaga en vez de contarse como "no cumple" — era un
   `try/catch` que tapaba un error funcional, prohibido por el encargo, y el camino vivo
   nunca lo tuvo.

El **conjunto de candidatos** del nivel 3 es el mismo que devolvían las capas viejas; lo
que puede cambiar es cuál de ellos sale.

**Por qué es aceptable.** El nivel 3 no se alcanza en juego real: 0 de 328 sorteos. El
golden master es idéntico, y `CL.evNivel()` convierte esa afirmación en una prueba
permanente (`07-rollevent.js`) en vez de una medición de una vez.

**Cómo se vigila.** `dev/tests/07-rollevent.js` falla si un sorteo de juego real baja al
nivel 3. Si algún día baja, esta decisión hay que revisarla: dejaría de ser código
inalcanzable.

**Revertir.** `git revert` del commit de fusión devuelve las cuatro capas. No hay estado
guardado que dependa de esto: `CL.evNivel()` no vive en `G`.
