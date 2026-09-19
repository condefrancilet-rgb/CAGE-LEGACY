# DOMINIO I — RANKINGS Y MUNDO

## Mapa

| Elemento | Línea | Qué es |
|---|---|---|
| `G.rank[org][div]` | init 1019 | hasta 15 ids, **sin el campeón** (se filtra en 1211) |
| `G.champs[org][div]` | init 1019 | id del campeón o `null` |
| `rebuildRosters()` | 1147 | reconstruye `G.orgs[o].roster` con `f.org && f.active && !f.retired` |
| `rankScore(f)` | 1175 | overall, récord, racha, pop, calidad de las últimas 6, inactividad, lesión |
| `rankScoreSafe(f)` | 1163 | si no es finito → `RANK_INVALID = -1e9` y marca `NORM.touch` |
| **`recalcRank(org,div)`** | **1189** | **único camino canónico** |
| `rankOf(f)` | 1219 | `0` sin org · `'C'` si es campeón **de su propia org** · si no índice+1 |
| `setRank(k,v)` | 4907 | **sólo UI** (`UI.tmp.rank`), no toca `G.rank`. Nombre engañoso pero inocuo |
| `pruneWorld()` | 1414 | borra retirados irrelevantes, topes de 300/340 |
| `yearTick(news)` | 1334 | envejecer / retirar / debutar / prospectos / ascensos de organización |

`recalcRank` por pasos: guarda de entrada (1194) → candidatos del roster por división
(1195) → score precalculado y `sort` con desempate por id (1200-1206) → **validación del
campeón (1206-1209)** → el campeón se saca del array (1210) → corte a 15 y actualización
de `bestRank` (1214-1217).

## Escritores de `G.champs`

| Línea | Función | ¿Consistente? |
|---|---|---|
| 1063 | `initWorld` (coronación inicial) | Sí |
| **1206-1208** | **`recalcRank`** | **NO — I-002**: valida `retired/active/div` pero **no `f.org===orgId`** |
| 1518 | `worldTick` (cinturón vacante) | Sí |
| 1600-1601 | `applyResult` (NPC vs NPC) | Sí, cierra con `recalcRank` |
| 3390-3394 | `applyPlayerFight` | Sí, cierra con `recalcRank` |
| 5916 | `seedChampions` | Sí (init) |
| **6161-6168** | **`repairCritical`** | **NO — I-001. CRÍTICO** |
| 6507-6508 | `changeWeightClass` | Sí |
| 12843-12848 | `saveValidateV4` | Sí — usa `g.fighters[c]` **directamente**, por eso aquí no falla |
| 15456 / 15724 | subida de división | Sí |
| 25789 | hook `rosterReal` | Sí (init) |

## Escritores de `G.rank`

| Línea | Función | ¿Consistente? |
|---|---|---|
| **1214-1215** | **`recalcRank`** — escritor canónico | Sí |
| 6169-6184 | `repairCritical` (ids colgantes, retirados, duplicados) | Sí |
| 12830-12836 | `saveValidateV4` | Sí |
| **25123-25126** | **`evolvePlayerDivisionWorld`** | **NO — I-005 (bajo)** |
| 25786-25787 | hook `rosterReal` | Sí (init) |

## Hallazgos

### I-001 · `repairCritical` deja el campeonato sin dueño cada semana — CRÍTICA · CONFIRMADO ×2 · **resuelve H-008**

**Mecánica.** `revisar(id)` memoiza en `vistos` y, para un id **ya visitado**, devuelve
`null` en vez del peleador:
```js
function revisar(id){
  if(!id || vistos[id]) return null;      // 6142  ← devuelve null, no el peleador
  vistos[id]=1;
  ...
  return f;
}
NORM.activeRefs().forEach(revisar);       // 6158  ← paso 1: marca todos los activos
...
var f = revisar(c);                       // 6163  ← ya visitado → null
if(!f || f.retired || f.div!==d){ t[d]=null; ... }   // 6165-6166
```
`NORM.activeRefs()` (6087-6095) **siempre** incluye `G.player.id`, y además
`G.nextFight.oppId`, `G.camp.oppId`, `G.fight.opp` y todos los `G.offers[].oppId`.
`saveValidateV4` (12845) hace la misma comprobación pero con `g.fighters[c]` directo y
**no** falla: ese contraste prueba que es un defecto de implementación, no la política
deseada.

**Reproducido por el orquestador**, con contraste A/B/C/D:
```
A) jugador coronado            -> champs.VAN.LW = f548   rankOf = 'C'
B) tras repairCritical         -> null                   rankOf = 0
C) campeón NPC no referenciado -> CONSERVA el cinturón   (correcto)
D) el mismo NPC, en G.offers   -> PIERDE el cinturón     (defecto)
```
`repairCritical` corre **cada semana** vía `hookOn('week','saneoMundo')` (8860).

**Impacto**: el jugador **no puede retener un cinturón ni una semana**; `p.defenses` queda
en 0 de por vida; nunca se genera la oferta "DEFENSA DE TÍTULO" (3266, que exige
`rankOf(p)==='C'`); `careerContext().champion` (25803) siempre es `false` y el jugador se
clasifica permanentemente como `exChampion`; los logros y arcos de reinado son
inalcanzables. Y cualquier NPC campeón ofrecido como rival pierde su cinturón.

**Explica H-008 de F0** (seed 1029: `titles=1` con `champs=null`). La traza del propio
`G.champs` lo confirma: `2016-w27 null→f548` (el jugador gana el título) y
`2016-w28 f548→null` por `repairCritical`. `p.career` sólo registra **una** pelea de
título, ganada: el jugador nunca perdió el cinturón en el cajón.

*Arreglo mínimo (no aplicado):* en 6163 usar `G.fighters[c]` y llamar a `revisar(c)` por
su efecto de saneo, o que `revisar` devuelva el peleador también en el camino memoizado.

### I-002 · Campeón fantasma: `recalcRank` no comprueba la organización — ALTA · CONFIRMADO
`recalcRank` **1206-1209** valida `retired`, `active` y `div`, pero **no** `f.org===orgId`.
Cómplice: `yearTick` **1386-1389** asciende de organización (`f.org = up;`) sin vaciar el
cinturón. Reproducido por el camino real: tras 5 `yearTick`, el campeón de TFC/HW milita en
VAN y `G.champs.TFC.HW` lo sigue apuntando; el mismo id es campeón de una organización y
retador de otra.
**Impacto**: la división abandonada queda congelada — `worldTick` 1509 y 1487-1492 sólo
organizan pelea por título vacante si `G.champs[oid][d]` es falsy, así que el cinturón no
se disputa jamás. Frecuencia natural baja (0 ocurrencias espontáneas en 10 años, seed 404).

### I-003 · Colapso demográfico del mundo — MEDIA-ALTA · CONFIRMADO (medido)
`yearTick` **1369-1370**: `var n = ri(8,14)` prospectos/año, frente a ~24 retiros anuales.

| año | activos | cinturones vacantes (de 55) | divisiones vacías |
|---|---|---|---|
| 2016 | 377 | 0 | 0 |
| 2020 | 356 | 8 | 0 |
| 2024 | 292 | 12 | 0 |
| 2028 | 227 | 19 | 4 |
| 2032 | **175** | **27** | **11** |

`G.fighters` se mantiene en ~400 gracias a `pruneWorld`, pero el **censo activo cae un 54%
en 16 años**: la mayoría de los registros son retirados. Con 55 combinaciones org/división,
175 activos dan ~3 peleadores por división.

### I-004 · Cinturones vacantes permanentes y divisiones vacías — MEDIA · CONFIRMADO (medido)
Consecuencia de I-003. `worldTick` **1507-1520** exige `r.length >= 6` para coronar a un
campeón vacante; por debajo de ese umbral el cinturón **queda vacante para siempre**. Con
la división vacía, `makeOffers` **3267** obtiene `undefined` y el jugador campeón tampoco
recibe defensa. Medido (seed 77): 0 → 27 cinturones vacantes, 0 → 11 divisiones sin
ranking, 0 → 6 campeones con **cero** retadores.

### I-005 · Escritura directa del ranking sin recálculo — BAJA · CONFIRMADO
`evolvePlayerDivisionWorld` **25123-25126**: `list.splice(idx,1); list.splice(ni,0,f.id);`
mueve ±1 puesto sobre `G.rank[f.org][d]` sin pasar por `recalcRank`, así que el orden deja
de reflejar `rankScore` hasta el siguiente recálculo, y no actualiza `bestRank`. No
corrompe el array (la guarda `if(idx>=0)` protege del `-1`).

### I-006 · Divisiones femeninas: pobladas, pero las más delgadas — SIN DEFECTO PROPIO
WSW, WBW y WFLY existen en las 5 organizaciones, se rellenan en `initWorld` 1030, reciben
prospectos anuales (`pick(DIVKEYS)` no discrimina sexo) y tienen campeonas. Sufren
I-003/I-004 antes que el resto sólo porque parten con menos censo: `HIST` aporta muchos
menos nombres femeninos.

### Invariantes que SÍ se cumplen (más allá de los de `dev/sim.js`)
Tras 10 años de autopiloto sobre las 55 combinaciones org/división: sin ids muertos en
`G.rank`, sin duplicados, sin `rankScore` no finito, ningún rankeado retirado ni de otra
división ni de otra organización, **ningún campeón aparece a la vez en el array de su
ranking** (el filtro de 1211 se respeta en todos los caminos), y ningún `G.champs[o][d]`
apunta a un id inexistente. Los únicos problemas son los arrays vacíos de I-004, que son
consecuencia de la despoblación, no de una escritura mal formada.
