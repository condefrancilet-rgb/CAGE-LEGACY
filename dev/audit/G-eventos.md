# DOMINIO G — EVENTOS

## Capas de `rollEvent` y cuál gana

| Capa | Línea | Qué hace | ¿Gana? |
|---|---|---|---|
| L1 personalidad | 5265 | `EVENTS.filter(e.c())`, peso × `drama`/`calm`. Sin memoria | No |
| L2 módulo 34 | 22011 | añade `CL.dramaOk()` y veda `EV_COOL=26` vía `CL.evSeen` | No |
| L3 contexto | 25847 | reintenta hasta 12 veces hasta que `eventContextOK` pase | No |
| **L4 narrativa** | **26388** | `EVENTS.filter(eventAllowed)` + `eventWeight`, escribe `eventHistory` y `recentCats` | **SÍ** |

`var rollEvent` es global, así que `window.rollEvent` (L4) ocupa la misma ranura.
Verificado: `rollEvent === window.rollEvent`. L4 sólo cae a las anteriores si su pool
relajado queda **vacío**, cosa que casi nunca ocurre.

**Cola**: escritor único `queueEvent` (3141), política `eventAdmissible` (3129).
Invariante `G.pending.length <= 1`: si ya hay uno, devuelve `false` (3143).
Lectura: `resolveEvent(idx)` (3166) → `hookEmit('event:pre')` → si nadie marcó
`handled`, `resolveEventCore` (3172) → `hookEmit('event:resolved')`.

**Hooks sobre `event:pre`**: 50 `marcarVisto` (5260) · 40 `opcionesEnLinea` (17983) ·
30 `bitacora` (22066) · 20 `simulacion` (25982, **nunca dispara**) · 10 `memoria` (26404).

## Banco: 66 eventos

31 literales base (2848-3080) + 15 obligatorios `x*` (5408+) + 9 `sg_*` + 3 `body_*` +
3 `cas_*` + `cl_dyn` (stub, 17981) + 6 `story_*` (`addStoryEvents`, 26341).
20 llevan `drama`, 1 `calm`, **10 `important`**. Pesos de 3 a 16 (`sg_rematch` w16,
`sg_book` w14, `body_divup` w14 son los más altos).

**Contexto duro** en `eventContextOK` (25790-25841): `x9_weight|bad_camp|body_cutwarn`
exigen `G.camp`; `title_talk|x10_short|sg_bigfish|sg_book` prohibidos si campeón;
`story_champion_pressure` exige campeón; `story_rival_escalation|sg_counterplan|sg_short`
exigen `G.nextFight`; `legacy_thought|story_veteran_legacy|x3_veteran` exigen edad ≥33;
`story_loss_rebuild` exige `streak<0`; todo `cl_*` pasa sin reglas; retirado → `false`.

**No hay cooldown por evento**: es global, 26 semanas, en `recentEvent(e.id,26)` (26313).

## Mecanismo real de anti-repetición

No es `lastEvent !== event`. `eventAllowed` (26311):
1. retirado → false · 2. `recentEvent(id, 26)` → false (veda de 26 semanas sobre
`G.story.eventHistory`) · 3. `!eventContextAllows(id)` → false · 4.
`recentCats[0]===cat && length>=2` → false (no dos veces la misma categoría seguida) ·
5. `!e.c()` → false.
`eventWeight` (26322) amortigua: `×0.35` si la categoría es la más reciente, `×0.65` si
es la anterior, más ajustes por `careerState()` y por lesión.
Estado persistente: `eventHistory` (tope 100) y `recentCats` (tope 5), **escritos en el
momento del sorteo, no de la resolución** (26398-26400) → ver G-004.

Mecanismos paralelos en rutas muertas: `CL.evSeen`/`EV_COOL` (21988-22005) lo escribe el
hook `bitacora` al resolver, pero sólo lo **lee** L2, que no corre.

## Hallazgos

### G-001 · `important` no llega a `G.pending`: la simulación descarta todos los eventos del banco — ALTA · CONFIRMADO
`window.rollEvent` construye `var out = {id:sel.id, txt:sel.x(), opts:sel.o}` (**26397**)
y **no copia `important`**. En `advancePeriod` (25967-25972):
```js
var e = G.pending[0];
if(e && e.important){ sum.stop='event'; break; }   // e.important === undefined
G.pending.shift();                                  // se tira SIEMPRE
```
Medición: 300 sorteos → **300 con `important === undefined`**; claves del objeto
encolado = `['id','txt','opts']`. Consecuencia: los 10 eventos marcados `important`
(26214) **nunca frenan el avance en bloque**, y `autoAdvanceToImportant` (25294) sólo se
detiene por `CL.ask`. Además se descartan sin pasar por `event:pre`, así que
`G.flags.seen` no se marca y el jugador no se entera — pero su veda de 26 semanas **sí**
quedó grabada en el sorteo.

### G-002 · La puerta de drama `CL.dramaOk` está puenteada — ALTA · CONFIRMADO
`eventAllowed` (26311) no comprueba `e.drama`. La regla vive sólo en L2 (**22017**), que
no corre. Reproducción: jugador con `rec.w=5` pero `lastFights=[]`, `pop=10`, semana 3 →
`CL.dramaOk() === false`; 600 sorteos → **125 eventos `drama`** (`x1_parking` ×80,
`sg_veteran` ×44). `x1_parking` narra una emboscada en un estacionamiento a las 3
semanas de carrera y con 0 peleas disputadas — el escenario exacto que el comentario de
22004-22007 afirma haber corregido.
Corolario: como `eventWeight` usa `e.w` crudo, los `sg_*` (w 11-16) aplastan a los base
(w 3-9) en cuanto su `c()` pasa.

### G-003 · Hook `simulacion` inalcanzable — MEDIA · CONFIRMADO
**25983**: `if(e && G.simRunning && e.important === false)`. Comparación estricta con
`false`, pero el pendiente tiene `important === undefined` (G-001). Nunca se cumple.
(El `EVENTS.forEach(... important=false)` de 26219 normaliza las *definiciones*, y corre
**antes** de `addStoryEvents()`, así que `story_training_partner`, `story_loss_rebuild` y
`story_veteran_legacy` se quedan con `important === undefined` incluso en la definición.)

### G-004 · El sorteo tiene efectos aunque la cola lo rechace — MEDIA · CONFIRMADO
`fireEvent(){ queueEvent(rollEvent()); }` (**3153**): JS evalúa `rollEvent()` antes de que
`queueEvent` compruebe `G.pending.length` (3143). Verificado con `pending` ocupado:
`rollEvent()` devolvió `family`, `eventHistory` pasó de 0 a 1, y `queueEvent` devolvió
`false`. Dos daños:
- **Veda quemada**: un evento que el jugador nunca vio queda vetado 26 semanas.
- **Contexto pisado**: `sel.x()` se ejecuta y muta los temporales compartidos
  (`G.tmpOpp`, `G.tmpSpon`, `G.tmpGym`, `G.tmpCoach`). Si el pendiente en pantalla lee
  `G.tmpOpp` en su `opts[i].f()`, se resuelve **apuntando al peleador equivocado**
  (p. ej. `callout` opción 3 → `G.flags.wantFight = G.tmpOpp`). Es la carrera de datos que
  el comentario de 21959-21966 da por cerrada: se cerró en `advancePeriod`, no en el resto.

### G-005 · `mgClose` llama a `fireEvent()` sin comprobar la cola — MEDIA · CONFIRMADO
**4766**: `advanceWeek(); if(chance(.42)) fireEvent();` — único llamador sin la guarda
`!G.pending.length` (compárese con `finishWeek`, 4525). `advanceWeek` puede encolar un
`cl_dyn` en sus hooks de semana, y entonces el `fireEvent()` siguiente entra en G-004.

### G-006 · `G.seasonEvents` es campo muerto — BAJA · CONFIRMADO
Declarado en **999** (`seasonEvents:[]`). `grep -n seasonEvents` sobre las 28.127 líneas
devuelve **esa única coincidencia**. Tras 200 semanas: longitud 0.

### G-007 · 37 de 66 eventos no aparecen nunca — MEDIA · CONFIRMADO (medido)
200 semanas, seed 4: **55 disparos, 29 ids distintos**. Domina la rutina (`rival_coach` 5,
`coach_talk` 5, `x9_weight` 4). **Nunca aparecen** ni una vez, pese a `c()` permisiva:
`family` (cuyo `c` es `return true`), `short_notice`, `sponsor`, `fan_moment`,
`weight_issue`, `top10_injured`, `doping_rumor`, `x1_parking`, `x2_house`, `x14_fix`,
`x15_ambush`, y los 9 `sg_*` de peso alto.
*SOSPECHA* sobre la causa: veda de 26 semanas + bloqueo por categoría + `×0.35/×0.65`
concentran los sorteos en las categorías menos pobladas.

### G-008 · `cl_dyn` con handler ausente se resuelve como "nada" — BAJA · SOSPECHA
`eventAdmissible` (3137) exime a `cl_dyn` del requisito de handler. Si llegara con `h` no
registrado en `CL.EVH`, caería al stub de 17981 y con `idx>=1` daría "La situación se
resolvió sola" + `errRecord`. **Hoy no es alcanzable**: los 25 ids de `CL.ask` y los 25 de
`CL.handler` coinciden.

### No-hallazgos (verificados y sanos)
- **Eventos pendientes para siempre**: no. `queueEvent` exige `opts` no vacío (3133) y
  `resolveEventCore` (3176) descarta con mensaje si la definición no existe.
  `CL.evSanitize` (22090) poda al cargar los huérfanos y trunca a 1.
- **Ejecución estando retirado**: bloqueada en 3 sitios (3132, 25791, 26389).
- **Crecimiento sin límite**: `eventHistory` 100 · `recentCats` 5 · `memories` 100 ·
  `CL.evLog` 40 · `CL.evSeen` ≤66 · `G.cl.once` 21 claves tras 200 semanas ·
  `G.flags.seen` acotado por el nº de ids. Ninguna se limpia nunca, **todas están acotadas**.

## `CL.ask` frente a `EVENTS[]`

| | Banco `EVENTS[]` | Dinámico `CL.ask` (16034) |
|---|---|---|
|`id`|propio|siempre `'cl_dyn'`|
|Payload|`{id,txt,opts}` con closures|`{id,h,txt,data,important:true,opts}` serializable|
|Resolución|`resolveEventCore` → `EVENTS[].o[idx].f()`|hook `opcionesEnLinea` (17999) → `CL.EVH[e.h]`|
|Filtros|veda 26 sem, categoría, `c()`, contexto|sólo `eventAdmissible`|
|`important`|**se pierde** (G-001)|`true` explícito → **los únicos que frenan la simulación**|

**`CL.ask` no informa del rechazo**: si `G.pending` ya tiene algo, `queueEvent` devuelve
`false` y la situación dinámica (deuda, prensa, rivalidad) se **pierde en silencio**;
`CL.ask` ni mira el retorno. La mayoría de generadores se protegen antes
(`if(G.pending.length) return`), pero no todos.
