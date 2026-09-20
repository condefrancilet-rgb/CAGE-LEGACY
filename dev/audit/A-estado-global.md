# DOMINIO A — ESTADO GLOBAL

`G` (52 claves declaradas + 12-17 no declaradas) y `UI`. Verificado con el harness.

## Claves de `G` — las que importan

Origen: `newWorld()` 995-1000 crea 33; las demás las añaden módulos de forma perezosa.

**Fuentes de verdad**: `G.fighters` (mundo) · `G.rank` (ranking, escritor único
`recalcRank()` 1215) · `G.champs` (campeón) · `G.cash` (dinero) · `p.career[]` (récord
completo con fecha) · `p.pop` (popularidad, escritor canónico `changePopularity()` 21535)
· `G.news` (mundo) y `G.story.feed` (social).

**`G.player` es el MISMO objeto** que `G.fighters[p.id]` (alias por referencia).
Es la única duplicación que no causa problema — pero es un riesgo latente: cualquier
`JSON.parse(JSON.stringify(G))` (que hacen `TX.snapshot`, `saveGame` y `loadGame`)
**rompe el alias**. `loadGame` lo reata (12992); si alguna ruta lo olvidara, el jugador
quedaría duplicado.

## `STATE.RUNTIME_KEYS` — 19 claves (3773-3797)

`socOut, lastEventOut, simRunning, period, _weekBusy, _autoBusy, _autoStamp, _autoFp,
_txDepth, _lastAuto, savedAt, _migratedFrom, _migrationSteps, _saveState, _saveDamage,
tmpOpp, casG, hookFails, _saveBlocked`.

Tres familias: cerrojos de reentrada, salidas de pantalla que se redibujan, y metadatos
del disco. Tres consumidores: `saveSerialize()` 13856, `STATE.fingerprint()` 3901 y
`STATE.persistable()` 3912.

**`SESSION_KEYS === STATE.RUNTIME_KEYS` verificado como la misma referencia** (13850), con
un invariante activo que lo vigila (27811). **Este punto está sano.**

## Tabla concepto → variables

| Concepto | Variables | **Fuente de verdad** | Derivados que pueden quedar obsoletos |
|---|---|---|---|
| **Récord** | `p.rec`, `p.career[]`, `p.lastFights[]`, `p.streak`, `G.story.fightHistory[]`, `G.hist` | **`p.career[]`** | `p.rec` (agregado) · `p.lastFights` **truncado a 6** por `savePrune` 12611 y a 8 por `yearTick` 1427 → lossy · `story.fightHistory` truncado a 30/40 · **`G.hist` vacío siempre** |
| **Ranking** | `G.rank`, `rankOf()` 1219, `p.bestRank` | **`G.rank`** | **`p.bestRank`**: mínimo monótono **sin ámbito de org ni división** (A-003) |
| **Dinero** | `G.cash`, `G.careerEarn`, `p.earn`, `G.contract`, `G.spons[].week`, `G.lastPayout`, `G.fightPayout` | **`G.cash`** | `careerEarn` y `p.earn` **sólo saben subir** (A-002) · `fightPayout`/`lastPayout` son cachés que persisten sin declararse runtime |
| **Popularidad** | `p.pop`, `p.popPeak`, `p.rep`, `p.hype`, `CL.aud()`, `G.flags.heat/hype`, `POP_LOG` | **`p.pop`** | `popPeak` monótono · `CL.aud()` se sincroniza con `pop` **una sola vez** (migración, 21586) y luego derivan por separado · **`p.hype` write-only muerto** (A-007) |
| **Campeón** | `G.champs`, `p.titles`, `p.defenses` | **`G.champs`** (íntegro: 0 campeones fantasma en 150 semanas) | `titles`/`defenses` son contadores históricos, no el cinturón actual. Medido: 50 cinturones ocupados vs **125 peleadores con `titles>0`**. `p.defenses` **no se reinicia al perder el título** (3393) |
| **Noticias** | `G.news`, `G.feed`, `G.hist`, `G.weekLog`, `G.story.feed`, `G.story.memories` | **`G.news`** + **`G.story.feed`** | `feed`/`hist` **muertas** (A-005) · `weekLog` volátil, se sobrescribe (1329) · `G.news` tiene **tres topes incoherentes**: 120 (`pushNews` 2845), 90 (`yearTick` 1458) y **40 (`savePrune` 12615, destructivo)** |

## Hallazgos

### A-001 · `G.contract.left` se decrementa DOS veces por pelea — ALTA · CONFIRMADO ×2
Dos escritores corren en la misma pelea:
- `applyWinLossResult()` **3408**: `if(G.contract && G.contract.org===orgId){ G.contract.left--; }`
- hook `economia` (registrado en 12536), línea **12549**:
  `if(G.contract && safeInt(G.contract.left,0)>0) G.contract.left = safeInt(G.contract.left,1)-1;`

**Reproducido por el orquestador** (contrato firmado por la vía real, seed 55):
```
contrato: RFL, 4 peleas, left 4
una pelea (decisión) → left 2     decremento = 2
```
Los contratos expiran en **la mitad** de las peleas firmadas, y el evento
`contract_dispute` (3036, `c: left<=1`) salta antes de tiempo. Los invariantes 27700-27701
no lo detectan porque sólo comprueban `left<0` y `left>fights`.

### A-002 · `careerEarn` sólo sabe subir y diverge de `cash` — MEDIA · CONFIRMADO en código
Hook `economia` **12545-12547**:
```js
G.cash = safeNum(G.cash,0) + diff;                  /* diff PUEDE ser negativo */
G.careerEarn = safeNum(G.careerEarn,0) + Math.max(0, diff);
G.player.earn = safeNum(G.player.earn,0) + Math.max(0, diff);
```
`diff = q.net - paidOld` es negativo cuando la fórmula vieja (3365, `chance(.45)`) concede
bono y `fightPayout()` (12514, **`chance(0.45)` independiente**) no, o cuando `CL.payout()`
descuenta deuda. El dinero baja y las ganancias de carrera quedan infladas. `careerEarn`
alimenta legado (8538, 26087), tres logros (23721) y la puntuación (8514).
*No reproducido empíricamente* (los dos `chance` coincidieron en la prueba): CONFIRMADO a
nivel de código, no medido.

### A-003 · `p.bestRank` es un derivado monótono sin ámbito — MEDIA · CONFIRMADO
`recalcRank()` **1216** lo aplica a **cualquier** organización y división; nunca se
recalcula ni se reinicia al cambiar de división o subir de organización.
Verificado en 4 carreras de 120-150 semanas: **las 4 terminan con `bestRank=1`** en RFL
(org de tier 1) con récords 5-4, 6-3-1, 8-2 y 2-2 — y en una el jugador está actualmente
**#7**. La interfaz lo muestra como "Mejor ranking #1" (5114, 5237, 24576) sin decir de
qué organización.

### A-004 · 12 claves de sesión viven en `G` sin declararse runtime — MEDIA · CONFIRMADO
Presentes en `G` y ausentes de `RUNTIME_KEYS`: `mg` (minijuego en curso), `contract`,
`_autoTag` (13070), `__nickIds`/`__nickAt` (caché de apodos, 21636), `tmpAmt`, `tmpSpon`,
`tmpGym`, `tmpCoach`, `paid` (4786/4861), `fightPayout` (3413), `lastPayout` (12548).
Todas entran en `saveSerialize()` y en `STATE.fingerprint()`: un minijuego a medias o la
caché de apodos disparan autoguardados y cuentan como cambio de estado.
**La regla se contradice a sí misma**: el comentario de 13844 dice que no se incluyen los
`tmp*` porque un evento en curso puede depender de ellos, pero **`tmpOpp` SÍ está** en la
lista (3786). O persisten todos, o ninguno.

### A-005 · Cinco claves muertas — BAJA en corrección, ALTA en claridad · CONFIRMADO. **Resuelve H-006**

| Clave | Referencias | Escritores | Lectores |
|---|---|---|---|
| `G.hist` | **0** | ninguno | ninguno |
| `G.events` | **0** | ninguno | ninguno |
| `G.seasonEvents` | **0** | ninguno | ninguno |
| `G.mgState` | **0** | ninguno | ninguno |
| `G.feed` | **1** | **ninguno** | `socCD()` 11313 (defensivo, itera un array vacío) |

Se inicializan en `newWorld()` 996 y 999 y nunca vuelven a tocarse. **No hay defecto
funcional**: el feed real es `G.story.feed` (escritor único `feedPush()` **26437**, con
dedupe por frase y por autor/30 semanas, tope 80, poda a 60 al cargar). Medido: 59-62
entradas. El historial real es `p.career[]` más `G.story.fightHistory[]`.

**Por qué `G.news` se queda en 40**: `savePrune()` **12615** recorta a 40 y se invoca desde
`saveGame()` 12635 como `savePrune(G)` — **sobre el objeto vivo**. Los otros dos topes (120
y 90) nunca llegan a actuar porque el autoguardado corre antes.
**Veredicto sobre H-006**: confirmado el síntoma, pero la causa no es que se alimenten mal
— es que **esas claves nunca estuvieron conectadas a nada**.

### A-006 · Guardar destruye estado del mundo en memoria — MEDIA · CONFIRMADO
`saveGame()` 12635 llama `savePrune(G)` sobre el `G` vivo. Recorta de forma permanente y
sin aviso, **para todos los NPC**: `lastFights` a 6, `mem` a 8, `career` a 12, `bond.hist`
a 10 (12611-12614), `G.news` a 40, `G.retiredList` a 60. Guardar no debería cambiar la
partida. El código lo reconoce a medias (comentario de `autosaveNow` 13073) y lo compensa
tomando la huella **después** de guardar: trata el efecto en vez de la causa. El jugador
está exento (12610), así que no rompe su carrera, pero borra irreversiblemente la memoria
y el historial de los rivales.

### A-007 · `p.hype` es campo muerto de escritura — BAJA · CONFIRMADO
Escrito sólo en `pressEnd()` **2725** y saneado en 8821. **Ningún lector.** El "hype" real
es `CL.contentState().hype` y `G.nextFight.hype`, que son otros conceptos.

### A-008 · `G.cl.once` crece sin poda — BAJA · CONFIRMADO
`CL.once()` 16045 y `CL.onceYear()` 16052 escriben `s.once[key]`; nadie borra salvo el
autotest (18361). Medido: 20-21 claves tras 120 semanas — acotado en la práctica porque el
juego usa un conjunto fijo de claves, pero `CL.ask`/`CL.handler` permiten claves dinámicas.

### A-009 · `LEG_CACHE`: caché global fuera de `G`, rehidratación frágil — BAJA · CONFIRMADO
`var LEG_CACHE = null` (8444), poblada perezosamente desde `localStorage` (8448). Es el
progreso **entre carreras**, deliberadamente fuera de `G`. El riesgo ya está parcheado
(27493-27518). **No hay defecto actual**, sólo fragilidad: la rama de restauración funciona
porque está en el mismo ámbito léxico; moverla a un módulo la rompería en silencio.

### A-010 · `G.stKeys` se escribe como efecto lateral de serializar — BAJA · CONFIRMADO
`saveSerialize()` **13852**: `g.stKeys = STKEY.slice();` — una función llamada "serializar"
muta el estado que recibe. Inocuo hoy porque `STKEY` es constante, pero `stKeys` no está en
`UNHASHED_KEYS` (3803): el día que `STKEY` gane un atributo, serializar cambiará la huella
por sí mismo.

### A-011 · `p.career` y `p.lastFights` divergen: el jugador NO está exento de la poda — MEDIA · CONFIRMADO
`pruneWorld()` **1427** recorre **todos** los peleadores sin excluir al jugador, y
`G.player` es el mismo objeto que `G.fighters[p.id]`:
```js
if(f.lastFights && f.lastFights.length > 8) f.lastFights = f.lastFights.slice(-8);
```
Contrasta con `savePrune()` **12610**, que sí lo excluye explícitamente ("al jugador no se
le toca nada"): **dos podas con la misma intención y criterios opuestos sobre el jugador**.
`pruneWorld()` se invoca desde `yearTick()` 1395, una vez por año de juego.

Medido sobre 8 carreras × 200 semanas: a 120 semanas los dos almacenes coincidían; a 200
divergen en las tres inspeccionadas — `career` 15/17/16 frente a `lastFights` 12/12/11.

Impacto acotado: `matchPool()` 3221 usa `slice(-3)` y `CL.dramaOk()` 22005 sólo comprueba
`length>=2`, ambos inmunes. **Sí afectado**: el evento `old_rival` (3026, `length>2` y
`pick(lastFights)`) — los rivales de más de 8 peleas atrás dejan de poder reaparecer como
"viejo rival" aunque sigan vivos en `p.career`.

Refuerza la conclusión de la tabla concepto→variable: **`p.career[]` es la fuente de verdad
y `p.lastFights[]` es un derivado con pérdida**, recortado por tres caminos con tres topes
distintos (8 en `pruneWorld` 1427, 6 en `savePrune` 12611, 40 en la normalización de carga
27342), sin ningún invariante que compruebe que ambos cuentan la misma historia.

*Invariante sugerido (no aplicado):* `p.rec.w + p.rec.l + p.rec.d === p.career.length`
—se cumplió en todas las corridas y sería barato de vigilar.

### Reconfirmación de H-006 y A-003 sobre 8 carreras × 200 semanas
`feed = 0` y `hist = 0` en el **100%** de las corridas · `news = 40` exacto ·
`story.feed` 62 · `fightHistory` 17 · `cl.once` 22.
A-003 confirmado: `bestRank = 1` en 3/3 con el jugador en los puestos #2, #3 y #1 de una
organización de tier 1 y con **0 títulos**.

---

## Adenda F2 · A-012 · `G.retiredList` es estado de sólo escritura

Apareció midiendo `pruneWorld` para D-013. `G.retiredList` tiene **cinco apariciones en
todo el archivo y ninguna es una lectura**:

| línea | qué hace |
|---|---|
| 999 | se crea vacía en el estado inicial |
| 1357 | `push({id, year})` cuando un luchador se retira |
| 1464 | `pruneWorld` la filtra a los que siguen en `G.fighters` |
| 12726 | `savePrune` la recorta a 60 |
| 14023 | `saveCompact` le redondea los decimales |

Nada la consume: no hay pantalla que la muestre, ni lógica que la consulte. Se mantiene,
se poda, se normaliza y **se guarda en el save** sin que nadie la mire.

**Consecuencias medidas.** Ninguna sobre el juego. Sí sobre el save y el coste: cada
guardado recorre y normaliza una lista que no sirve, y la lista viaja en el archivo.

**Por qué importa para D-013.** La inconsistencia que encontré en `pruneWorld` —un
luchador que la capa externa restaura a `G.fighters` queda fuera de `retiredList`— **no
tiene consecuencia observable hoy**, precisamente porque nadie lee la lista. Eso no cambia
la decisión de no fusionar (el motivo real es que la fusión cambia qué luchadores sobreviven
al tope de población), pero sí baja la urgencia.

**Qué hacer con esto.** No borrarla en F2: está en el save y borrarla toca la forma del
estado persistido (I3). Es una decisión de **F4**: o se le da un consumidor —una pantalla
de retirados, que el juego no tiene— o se retira del estado con su migración.
