# AUDIT — CAGE LEGACY

> F1 consolidará aquí el mapa por dominios. Lo que sigue son los hallazgos
> **medidos durante F0**, con su evidencia. Estado: CONFIRMADO (reproducido con
> semilla en el harness) o SOSPECHA (observado, sin causa raíz aislada).

## Métricas de partida (F0)

| métrica | valor |
|---|---|
| bytes / líneas HTML / líneas JS | 1.538.459 / 28.128 / 27.560 |
| md5 | `f167031eaa9513043cf11f3b051992ba` |
| bloques `<script>` | 1 |
| nombres de función (decl + asignación) | 622 |
| **nombres definidos más de una vez** | **50** |
| **wrappers que capturan la versión previa** | **42** |
| addEventListener / removeEventListener | 19 / 12 |
| setTimeout / clear · setInterval / clear · rAF / cancel | 9/3 · 0/0 · 3/1 |
| llamadas a `render()` | 161 |
| escrituras de `UI.screen` | 37 |
| escrituras de scroll | 3 |
| `onclick` inline | 317 |
| `eval` funcional | 0 |
| dependencias externas (src/href/fetch/XHR/urls) | 0 / 0 / 0 / 0 / 0 |

Detalle completo, con líneas, en `dev/baseline/metrics.json`.

---

## Hallazgos de F0

### H-001 · `render()` no es puro — CONFIRMADO · severidad alta
Sustituir `render()` por un no-op cambia el resultado de la simulación:
huella `05ab9909` → `53f42e55`, récord 9-3 → 6-3, 12 peleas → 9.
El renderizador influye en el estado del juego (consume RNG y/o dispara
saneamientos). Rompe el flujo objetivo ESTADO → LÓGICA → RENDER.
*Repro:* carrera seed 7 / metaSeed 555, 150 semanas, política `basica`.
*Impacto en el utillaje:* el harness nunca puede stubear `render` (D-004).

### H-002 · `saveGame` muta el mundo — CONFIRMADO · severidad alta
`saveGame()` llama a `savePrune(G)` y dispara `normalizeWorldState()`. No es
I/O: desactivarlo cambia `fighters`, `news`, `player` y `cl`.
Además es el mayor coste del juego: **39,2 ms de media**, del cual
`normalizeWorldState` son **25,8 ms**, sobre 548 peleadores, **en cada
autoguardado** (279 llamadas por carrera de 150 semanas).
*Consecuencia:* guardar y normalizar están acoplados; no se puede guardar sin
reescribir el mundo.

### H-003 · La primera carga normaliza, pero no pierde datos — CONFIRMADO · severidad baja
Tras `save`→`load`, cambian `fighters` y `offers`, siempre **creciendo**:
se añaden `cl` a peleadores creados esa semana y `bonus`/`fights` a las ofertas.
Comparación campo a campo: **0 campos perdidos o alterados**, 4 añadidos.
La segunda vuelta sí es punto fijo. I3 se sostiene.
*Cubierto por* `dev/tests/03-saveload.js`.

### H-004 · Sumisiones prácticamente inexistentes — CONFIRMADO · severidad alta (balance)
Sobre 40 carreras × 150 semanas (501 peleas): **KO 31,1% · SUB 0,2% · DEC 68,7%**.
Bandas del MMA real: KO/TKO 30–35%, sumisiones 15–20%, decisiones 45–50%.
Las sumisiones están efectivamente desconectadas del resultado.
*Evidencia:* `dev/baseline/sim.json`.

### H-005 · Win rate del jugador muy alto — CONFIRMADO · severidad media (balance)
73,5% de victorias con política de combate `basica` (heurística simple).
Estilos por encima del umbral de detección (>65%): `out` 87,7%, `sw` 82,7%,
`bjj` 79,2%. `boxer` es el más bajo con 67,4%. Ningún estilo baja de 35%.

### H-006 · `feed` e `hist` siempre vacíos — SOSPECHA · severidad media
En las 40 carreras, `G.feed` y `G.hist` terminan con longitud 0, mientras
`G.news` se mantiene en 40 (tope). Sugiere sistemas declarados pero no
alimentados, o alimentados sólo por vías que el autopiloto no recorre.
*Pendiente:* confirmar en F1-G / F1-A si hay escritores reales.

### H-007 · El jugador nunca se retira solo — CONFIRMADO · no es un defecto
El peleador del jugador se crea con `retireAge: 99` (línea ~4351), así que el
retiro por edad no le aplica: es una decisión explícita (`retire()`).
Anotado porque invalida cualquier medición de "edad de retiro" que espere
retiro automático, y obligó a generar la fixture `05-retirado` ejerciendo la
decisión, como en el juego.

### H-008 · Título ganado sin campeón registrado — SOSPECHA · severidad media
Carrera seed 1029: `player.titles = 1` pero `G.champs[org][div]` es `null` al
final de las 150 semanas. Puede ser correcto (perdió el cinturón y el registro
quedó vacío en vez de apuntar al nuevo campeón) o un escritor inconsistente del
ranking/campeonato.
*Pendiente:* F1-I.

### H-009 · Rounds por encima del máximo declarado — SOSPECHA · severidad media
Trazas de pelea con `round: 4` y `round: 6` en peleas de 3 asaltos
(`rounds: 3`, sin título). Puede ser que `f.round` se incremente una vez más al
terminar, o que el bucle de asaltos no respete el tope.
*Pendiente:* F1-D.

---

## Lo que ya está sano (medido, no asumido)
- **Sin dependencias externas**: 0 `<script src>`, 0 `<link href>`, 0 `fetch`,
  0 `XMLHttpRequest`, 0 URLs http. I2 se sostiene.
- **Sin `eval` funcional**: 3 ocurrencias, las 3 en comentarios.
- **Determinismo**: misma semilla y mismas decisiones → misma huella, también
  entre procesos distintos.
- **Invariantes baratos**: 0 fallos en 40 carreras (dinero/popularidad/stats
  numéricos, récord no negativo, semana en rango, rankings sin duplicados ni
  referencias rotas, retirado sin pelea activa).
- **Compatibilidad de saves**: las 5 fixtures cargan y siguen siendo jugables.

---

## Medición en navegador real (Chromium, F0)
`node dev/browser-tests.js` · 28 comprobaciones verdes, 0 errores de JavaScript.

| viewport | pantallas sin excepción | desborde H | targets | <44 px | solapados |
|---|---|---|---|---|---|
| 360×640 vertical | 35/35 | 0 | 76 | 38 | 0 |
| 360×640 horizontal | 35/35 | 0 | 76 | 38 | 0 |
| 390×844 vertical | 35/35 | 0 | 76 | 38 | **6** |
| 412×915 vertical | 35/35 | 0 | 76 | 38 | **6** |

**I1 confirmado en navegador real** en los cuatro viewports: interacción en sitio
400 → 400; navegación 400 → 0.

### H-010 · Targets táctiles por debajo de 44 px — CONFIRMADO · severidad media (F17)
38 de 76 targets del hub bajan de 44 px CSS en algún eje. Pendiente de clasificar
en F17 entre controles aislados (hay que corregirlos) y filas de lista de ancho
completo (aceptables).

### H-011 · Targets solapados sólo en viewports anchos — CONFIRMADO · severidad media (F17)
6 pares de targets se solapan a 390×844 y 412×915, y **ninguno** a 360×640.
Que el solape aparezca al *ensanchar* sugiere un layout que reflowa mal por
encima de cierto ancho, no un problema de espacio.
