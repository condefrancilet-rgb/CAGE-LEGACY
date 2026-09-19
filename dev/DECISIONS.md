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
