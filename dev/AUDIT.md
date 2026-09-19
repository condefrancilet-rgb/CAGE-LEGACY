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

---
---

# F1 — AUDITORÍA ARQUITECTÓNICA (consolidado)

Siete dominios auditados en paralelo, en modo sólo lectura, cada uno en
`dev/audit/<dominio>.md`. **Todos los hallazgos de severidad ALTA o CRÍTICA fueron
re-verificados de forma independiente por el orquestador antes de marcarse CONFIRMADO.**

| Dominio | Archivo | Estado |
|---|---|---|
| A · Estado global | `dev/audit/A-estado-global.md` | completo (11 hallazgos) |
| B · Navegación y render | `dev/audit/B-navegacion-render.md` | completo (8 hallazgos) |
| C · Tiempo | `dev/audit/C-tiempo.md` | completo (14 hallazgos) |
| D · Combate | `dev/audit/D-combate.md` | completo (11 hallazgos) |
| E · Entrenamiento | — | **PENDIENTE** (el subagente se cortó por límite de sesión) |
| F · Save/load | `dev/audit/F-saveload.md` | completo (8 hallazgos) |
| G · Eventos | `dev/audit/G-eventos.md` | completo (8 hallazgos) |
| H · Economía | `dev/audit/H-economia.md` | completo (12 hallazgos) |
| I · Rankings y mundo | `dev/audit/I-rankings-mundo.md` | completo (6 hallazgos) |

## Resolución de los hallazgos abiertos de F0

| F0 | Veredicto de F1 |
|---|---|
| **H-001** `render()` no es puro | **RESUELTO — causa raíz aislada.** `pick()` en `cornerAdvice()` (2117) y `postFightQuote()` (4868-4871), por la ruta de dibujo. Verificado: quitando **sólo** esos `pick()` y dejando `render()` completo, la huella coincide **exactamente** con la de stubear render entero (`2357404e`). Son el 100% de la impureza. El archivo ya tiene la solución escrita: `pickStable(a,key)` (602). Ver **B-001**. |
| **H-002** `saveGame` muta el mundo | **CONFIRMADO y detallado.** Ver **F-005** y **A-006**: el saneo se registró como listener del hook `save` (6598), así que guardar es el reloj del saneo. Dos pérdidas reales: `cash:"1200"→0` y `retiredList.slice(-60)`. |
| **H-003** la primera carga normaliza sin perder datos | **CONFIRMADO.** Ver **F-008**. |
| **H-006** `feed` e `hist` vacíos | **RESUELTO.** No es que se alimenten mal: `G.feed`, `G.hist`, `G.events`, `G.seasonEvents` y `G.mgState` son **claves muertas** (0 referencias). El feed real es `G.story.feed`. Ver **A-005**. |
| **H-008** título ganado sin campeón registrado | **RESUELTO — es un defecto grave.** `repairCritical` (6163) vacía el cinturón de cualquier campeón referenciado por la carrera activa, y el jugador **siempre** lo está. Ver **I-001**. |
| **H-009** rounds por encima del máximo | **REFUTADA la causa temida.** `endRound()` incrementa `f.round` **antes** de comprobar el tope, así que el centinela queda visible. No contamina el estado persistido. El `round:6` era una pelea de título. Ver **D-005**. |

## Lista priorizada de correcciones para F2

Bugs CONFIRMADOS, ordenados por daño al jugador. Cada uno exige primero un test que lo
reproduzca, después el fix en un commit `[F2] fix:` aparte, y entrada en `CHANGES.md`.

| # | ID | Sev | Qué rompe | Arreglo |
|---|---|---|---|---|
| 1 | **F-001** | CRÍTICA | `migrateLegacyBlob` borra el blob legado aunque no migrara ninguna partida por falta de cuota. Corre sola al arrancar | mover el `removeItem` (13809) dentro de "se migraron todas" |
| 2 | **I-001** | CRÍTICA | El jugador no puede ser campeón más de una semana; `defenses` siempre 0; nunca hay defensa de título | en 6163 usar `G.fighters[c]`, o que `revisar` devuelva el peleador en el camino memoizado |
| 3 | **D-003** | ALTA | Re-roll infinito del resultado: salir de `fightresult` sin confirmar borra la pelea y deja `nextFight` firmado | `renderNav` debe ocultar la barra en `fightresult`, y/o `go()` debe resolver o conservar la pelea sin cobrar |
| 4 | **D-001** | ALTA | `confirmFight()` aplica récord, bolsa y semana tantas veces como se llame | guarda de idempotencia al principio de `confirmFight` |
| 5 | **A-001** | ALTA | `contract.left` se decrementa dos veces por pelea: los contratos duran la mitad | un solo escritor (3408 **o** 12549, no ambos) |
| 6 | **H-005** | CRÍTICA | Patrocinios apilables sin guarda `seen()` y reescalados en compuesto cada año: deforma toda la economía a largo plazo | acotar `G.spons` y/o reescalar sobre el valor BASE, no sobre el del año anterior |
| 7 | **G-001** | ALTA | `rollEvent` pierde `important`: la simulación descarta **todos** los eventos del banco | copiar `important` en el objeto encolado (26397) |
| 8 | **C-001** | ALTA | `advancePeriod` quema semanas de campamento sin aplicarlo | usar `campWeek` cuando `G.camp` existe |
| 9 | **B-001** | ALTA | `render()` consume el RNG: los códigos de semilla no reproducen la partida | `pickStable` en `cornerAdvice` y `postFightQuote` |
| 10 | **D-002** | ALTA | Excepción a mitad de `applyPlayerFight` + reintento = doble récord y doble bolsa | envolver en `safeRun` o hacerla transaccional |
| 11 | **G-002** | ALTA | La puerta de drama está puenteada: eventos de drama en la semana 3 con 0 peleas | `eventAllowed` debe comprobar `e.drama` |
| 12 | **C-002/C-003/C-004** | ALTA | Rutas que consumen semana sin publicar noticias; `advancePeriod` no guarda nunca y destruye las ofertas cada semana | unificar el cierre de semana |
| 13 | **I-002** | ALTA | Campeón fantasma al ascender de organización: la división abandonada se congela | `recalcRank` debe comprobar `f.org===orgId` |
| 14 | **F-002** | ALTA | La copia de respaldo pre-migración nunca se escribe | usar `diag.v`, calculado antes de mutar |

**Deuda estructural, no bugs puntuales** (F2-F4, con golden master):
`saveGame` acoplado a `normalizeWorldState` (F-005/A-006) · 43 nombres redefinidos y 42
wrappers · 37 escrituras directas de `UI.screen` (→ F3) · claves de sesión que persisten
(A-004) · derivados almacenados sin dueño: `bestRank`, `careerEarn`, `lastFights`
(A-002/A-003/A-011 → F4) · colapso demográfico del mundo (I-003/I-004, decisión de diseño
para F6) · 11 artículos de tienda con el efecto muerto o inerte (H-009/H-010/H-011 → F14).
