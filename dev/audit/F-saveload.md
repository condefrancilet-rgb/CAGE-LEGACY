# DOMINIO F — SAVE / LOAD / MIGRACIONES

Archivo: `index-4-blindado.html` (28.127 líneas, no modificado).
Verificado con `dev/harness.js` y las 5 fixtures. Fixture principal:
`03-mitad-carrera.json` (411 peleadores, 748 KB).

## Constantes y capas

| Símbolo | Línea | Nota |
|---|---|---|
| `SAVE_VERSION = 4` | 12587 | |
| `SAVE_BAK = 'cagelegacy_bak_'` | 12588 | declarada; **nunca escrita ni leída** (F-002) |
| `SAVE_IDX = 'cagelegacy_idx_v3'` | 12589 | índice liviano |
| `SAVE_ONE = 'cagelegacy_slot_'` | 12590 | una clave por partida |
| `SAVEKEY = 'cagelegacy_v1'` | 5156 | blob único legado |
| `STATE.RUNTIME_KEYS` | 3773 | única fuente de lo que NO persiste |
| `SESSION_KEYS = STATE.RUNTIME_KEYS` | 13850 | alias, no copia (correcto) |

**Redefiniciones vivas:** sólo `savePrune` (base 12603 + capa 13891 `_qSavePrunePrev`,
redondeo de decimales). `saveGame`, `loadGame`, `deleteSave`, `allSaves` tienen una
sola implementación. `normalizeWorldState` es alias de `normalizeFull` (6244).

## Flujo de guardado — `saveGame(silent)` 12631-12692

```
12634  hookEmit('save')  -> hookOn('save','saneo') 6598: normalizeWorldState()
                            + player.fatigue/dmg/weightNow + G.gameplayLevel
12635  savePrune(G)      -> [13892 -> 12603]  MUTA fighters/news/retiredList
12636  G.saveVersion / 12637 savedAt / 12638 saveId
12640  body = saveSerialize(G)   MUTA g.stKeys (13852)
12651  localStorage.setItem(SAVE_ONE+id, body)
12652    catch -> RUTA DE CUOTA (12653-12685) -> return false, índice NO escrito
12686  saveIndexWrite(idx) / 12687 G._autoFp / 12689 return true
```

## Flujo de carga — `loadGame(id)` 12953-13004

`getItem` → fallback al blob viejo → `JSON.parse` → `saveShape(parsed)` (**antes** de
mutar, correcto) → `saveMigrate(saveExpand(parsed))` → validación → `G = g` →
`normalizeWorldState()` (12994) → `hookEmit('load')` (9 suscriptores, prio 20→99) →
`go('hub')` → `saveGame(true)` (13000, reescribe el slot migrado).

## Migraciones — `SAVE_STEPS` 12708-12745

| Paso | Línea | Qué hace | Idempotente |
|---|---|---|---|
| v1→v2 estructuras base | 12709-12720 | crea `flags/pending/offers/news/sagas/soc/trainRec` si faltan | Sí |
| v2→v3 minijuegos y economía | 12721-12728 | `mgStats` por defecto; `cash/careerEarn/year/week` saneados | Sí |
| v3→v4 social y feed | 12729-12744 | `socCD`, `socWeek.cats`, `story.feedSchema`; borra `_weekBusy/_autoBusy/_autoStamp` | Sí |

Encadenado correcto (`if(v < step.to)`, 12925-12932). Verificado resellando la fixture:
v1→3 pasos, v2→2, v3→1, v4→0. Re-aplicar sobre un save ya migrado no cambia un byte.
`saveValidateV4` corre **siempre** tras migrar (12939) — salvo en `migrateLegacyBlob`.

## Hallazgos

### F-001 · `migrateLegacyBlob()` destruye partidas cuando falta espacio — CRÍTICA · CONFIRMADO
`migrateLegacyBlob` 13780-13812. El `setItem` de cada partida (13798) va en un `try`
cuyo `catch(e2)` (13805) **descarta esa partida en silencio**; después, 13809:
`localStorage.removeItem(SAVEKEY)` **sin condición**.
El comentario contempla dos casos ("o ya se migró, o no contenía nada usable") y falta
el tercero: **se migraron cero porque `setItem` lanzó `QuotaExceededError`**.
Corre sola al arrancar (IIFE `runBlobMigration`, 13936-13944), antes de que el jugador
toque nada y sin confirmación.

**Reproducido de forma independiente por el orquestador** (blob con 2 partidas de
747 KB, cuota apenas por encima del blob):
```
ANTES   blob presente: true
migradas: 0
DESPUES blob presente: false
DESPUES partidas visibles: {}
```
Contradice frontalmente la política que el propio `saveGame` documenta en 12653-12667
("NO SE BORRA NADA DEL JUGADOR… Borrar una partida es una decisión del jugador").
*Arreglo mínimo:* mover el `removeItem` dentro de `if(moved === totalConData)`, o no
borrar si hubo algún `catch(e2)`.

### F-002 · La copia de respaldo pre-migración nunca existe — ALTA · CONFIRMADO
`loadGame` 12988-12991 escribe `SAVE_BAK+id` sólo si `parsed.saveVersion !== 4`. Pero
`saveMigrate(saveExpand(parsed))` (12971) **devuelve el mismo objeto `parsed`** y en
12934 le pone `saveVersion = 4`. Cuando se evalúa la guarda, ya vale 4: la condición
es **siempre falsa**. Acto seguido `saveGame(true)` (13000) pisa el slot con la versión
migrada: el original es irrecuperable. `SAVE_BAK` tampoco se lee en ninguna parte.
*Arreglo mínimo:* usar `diag.v`, ya calculado en 12970 antes de mutar.

### F-003 · `migrateLegacyBlob` sella v4 sin ejecutar un paso de migración — MEDIA · CONFIRMADO
13796: `saveExpand(g); savePrune(g); g.saveVersion=SAVE_VERSION;` — no llama a
`saveMigrate`, ni a `SAVE_STEPS`, ni a `saveValidateV4`. Un save v1 del blob queda
etiquetado v4; al cargarlo `saveShape` dice "al día" y se aplican **0 pasos**.
`socCD` y `trainRec` quedan `undefined` en producción.

### F-004 · Rankings: reparación silenciosa y duplicados que sobreviven la carga — MEDIA · CONFIRMADO
`saveValidateV4` 12844-12854 filtra ids colgantes pero (a) no hace `rep.push`, así que
la reparación no llega a `_saveDamage` ni al jugador, y (b) `filter` **no deduplica**.
La deduplicación sólo vive en `repairCritical` 6180-6190, que **no participa en la
carga** (`loadGame` llama a `normalizeFull`, no a `normalizeRuntime`).
Reproducido: tras `loadGame`, `f196` aparece 4 veces y `_saveDamage` es `null`; tras
`repairCritical`, 1 vez. Un ranking duplicado se juega hasta el siguiente tick semanal.

### F-005 · `saveGame` acoplado a normalizar, con poda destructiva — ALTA · CONFIRMADO (= H-002)
Diff de `G` antes/después de **un solo** `saveGame(true)` sobre la fixture ensuciada:
```
G.week              99           -> 52     (normalizeGlobals 6098)
G.cash              "1200"       -> 0      (normalizeGlobals 6099)   *** pérdida ***
G.player.fatigue    250          -> 100    (hook 'saneo' 6600)
G.player.dmg        -40          -> 0
G.news              160 entradas -> 40     (savePrune 12617)
G.retiredList       103 entradas -> 60     (savePrune 12618, slice(-60))  *** pérdida ***
fighters.*.lastFights 20 -> 6 · mem 30 -> 8 · career 40 -> 12
fighters.*.pop/rep/rel  redondeo (saveCompact 13901-13903)
fighters.*.st.power NaN -> 50 · rel.{7 claves} undefined -> defaults
```
Dos pérdidas reales: `cash:"1200" -> 0` (string numérico descartado en vez de
parseado) y `retiredList.slice(-60)` (conserva los 60 **últimos**, borra los históricos).
**Por qué está acoplado:** el saneo se registró como listener del hook `save` (6598).
`normalizeFull` es caro y guardar es el único momento garantizado tras cualquier
acción, así que se usó el guardado como reloj del saneo. El propio `autosaveNow`
(13072-13075) documenta la consecuencia y recalcula la huella después de guardar.

**Coste medido** (411 peleadores): `saveSerialize` 33,9 ms · `normalizeFull` 31,6 ms ·
`savePrune` 5,4 ms · `saveValidateV4` 3,4 ms · **`saveGame` completo 81,3 ms**.
`normalizeFull` es O(plantel × STKEY × 3): ≈32.000 `safeNum` y 2.055 invocaciones de
hook por llamada.

### F-006 · Ruta de cuota en `saveGame`: honesta y no destructiva — SIN DEFECTO · CONFIRMADO
Verificado con `quota:1500000` y ranura NUEVA: devuelve `false`, no borra nada, las
claves antes y después son idénticas, `errRecord` CRITICAL siempre, el cartel al
jugador limitado a uno por minuto, `saveIndexWrite` queda después del `return false`
(no hay entrada fantasma) y `G` en memoria intacto.
*Residuo menor (BAJA):* `G.saveId` se fija en 12638 **antes** del `setItem`, así que
tras un fallo de cuota apunta a un slot inexistente. No destruye nada.

### F-007 · `_autoTag` es estado de sesión y se persiste — BAJA · CONFIRMADO
`autosaveNow` 13070 escribe `G._autoTag`, que **no** está en `STATE.RUNTIME_KEYS`
(3773-3806, que sí incluye `_lastAuto`, `_autoBusy`, `_autoStamp`, `_autoFp`,
`_saveBlocked`). Verificado: `_autoTag` aparece en disco.

### F-008 · Quién repara cada estado imposible tras cargar — INFORMATIVO
Cobertura buena, concentrada en `saveValidateV4`, con `CAGE_AUDIT.normalize`
(hook `load` prio 90) como red posterior. Avisan al jugador: `nextFight`/`camp`/`fight`
colgantes, campeón muerto, contrato fantasma, eventos en cola sin `opts`.
No avisan: rankings (F-004), `offers`, `team`, `mg`, NaN en stats.
**Único hueco real:** deduplicación de rankings, que vive sólo en `repairCritical`.

## Prioridad
1. **F-001** (destruye partidas al arrancar) · 2. **F-002** (la red de seguridad no existe)
3. **F-005/H-002** · 4. F-003, F-004 · 5. F-007 y el residuo de `saveId`.
