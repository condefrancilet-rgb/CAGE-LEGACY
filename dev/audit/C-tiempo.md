# DOMINIO C — EL PASO DEL TIEMPO

## Capas de `advanceWeek`

**Única definición**: `function advanceWeek()` en **1249**. Sin reasignaciones ni
wrappers (`advanceWeek *=` → 0 resultados). El comentario de 15942 que menciona
"advanceWeek 5 capas" es histórico: ya fueron fundidas.
**No** está envuelta por GATE (comentario explícito en 13577: *"se dispara muchas
veces por acción"*). Gana en runtime: 1249 → `TX.run('advanceWeek', advanceWeekCore)`
(1275) → `advanceWeekCore` (1279).
`'week'` está en `HOOK_NO_REENTRY` (3485) y **no** en `HOOK_ABORT` (3481): un hook que
reviente se registra y la semana continúa.

## ORDEN EXACTO DE UNA SEMANA (camino `doWeek` → `finishWeek`)

**A. Antes de tocar el reloj — `doWeek` (4515)**
1. Guarda de lesión: si `p.inj` y la actividad no es `rest/mind/tech`, aborta (4517).
2. `G.camp ? campWeek(k,.85,0) : applyTrain(k,.85,0)` (4518).
   `campWeek` (2259): `camp:week:pre` → `campWeekCore` (2266) → `camp:week:post`.
   `applyTrain` (2209): `train:adjust` → ganancias → fatiga → **tirada de lesión** → `train:applied`.
3. GATE `doWeek`: guard de retiro (26059). Sin autosave.

**B. `advanceWeek` (1249)**
4. Corte si no hay partida o el jugador está retirado (1250).
5. `G._weekBusy`; si ya está activa → `errRecord('advanceWeek:reentrada', WARN)` (1263-1266).
6. `TX.run(...)` (1272-1275); `finally` libera la bandera (1276).

**C. `advanceWeekCore` (1279) — orden literal**
7. `STATE.bumpWorld()` (1280) · 8. `normalizeFighterState(G.player)` (1281)
9. **`G.week++`** — único punto donde avanza el reloj (1282)
10. Si `>52`: `week=1; year++; yearTick()` (1284) — envejecimiento, retiros, debuts, hook `year`
11. **`worldTick()`** (1285 → 1462): calendario de las 5 orgs, emparejamientos, títulos
    vacantes, `simFight` + `applyResult` (emite `result:applied`), noticias del mundo
12. **`historicalUfcTick()`** (1286 → 5184)
13. `queueEvent(historicAdvicePending())` (1287) — primer punto donde puede llenarse `G.pending`
14. Jugador: `weeksIdle++` (1290) · `injWeeks--` y alta (1291) · `fatigue -= 8+recovery/12`
    (1292) · `dmg -= 5` (1293) · penalización de pop si `weeksIdle>12` (1294)
15. **`G.nextFight.weeks--`** (1296)
16. Economía: `burn = 120 + gym/4 + teamCost() + CL.SPEND[...].cost` (1298-1307);
    `sponsorIncome` (1308)
17. Bifurcación financiera (1313): si el cierre daría negativo y no hay evento pendiente →
    `CL.finWarn(...)` (1315) y **no se toca la caja**; si no → `G.cash -= burn` (1317),
    caída a `gym9` si `< -2500`, patrocinios (1323), `CL.overdraft` (1327)
18. `G.weekLog = newsWeek` (1330) — **sobrescribe**
19. **`hookEmit('week')`** (1331) — 30 suscriptores

**D. Los 30 hooks de `week`, orden verificado en runtime**

| ord | id | línea | qué hace |
|---|---|---|---|
|10|`saneoJugador`|6522|normaliza fatiga/daño, `divAdapt`|
|10|`nucleo`|17334|`CL.week()`: social, relaciones, hilos narrativos|
|12|`saneoMundo`|8860|`normalizeRuntime()`|
|16|`shopWeekly`|15064|ingresos de negocio/patrocinio, caída de sponsor|
|18|`weightDrift`|15287|deriva de peso fuera de campamento|
|20|`camp`|18581|pilares del campamento|
|30|`economia`|18619|efectos no monetarios del plan de vida|
|32|`gymrep`|18689| · |33|`gymmove`|19091| · |34|`personalidad`|18738|
|35|`content`|25171| · |36|`camps`|18872| · |36|`luxury`|25243|chef −650, bóveda +3200|
|38|`alianzas`|18954| · |42|`mediaDrift`|19051|
|**50**|`audit_final_week`|27365|`normalizeLight()` — **no es final, ver C-007**|
|55|`deuda`|19472|interés compuesto| · |56|`publico`|19722| · |57|`publicoSpon`|19757|
|59|`wonder`|19817| · |60|`metaMods`|24196| · |62|`observado`|19618|
|62|`casino`|22511| · |62|`endgame`|26063| · |63|`percep`|19882| · |64|`storyTick`|26913|
|70|`apodos`|21633| · |80|`meta`|24106| · |99|`statfx`|18809|vacío| · |99|`descubierto`|21735|

**E. De vuelta en `finishWeek` (4523)**
20. `if(!G.pending.length && chance(.42)) fireEvent()` (4525)
21. `if(!G.nextFight && chance(.30)) makeOffers()` (4526)
22. `G.weekLog.forEach(pushNews)` (4527) · 23. `saveGame(true)` (4528) · 24. `toast` + `go('hub')`

## Llamadores de `advanceWeek`

| Línea | Función | Qué rodea la llamada |
|---|---|---|
|2759|`recPick`|1 semana por bloque ×3. **Sin** `fireEvent`, `makeOffers` ni `pushNews`|
|4524|`finishWeek`|camino canónico completo|
|4766|`mgClose(true)` con `weekApplied`|`advanceWeek` + `fireEvent(.42)` + `saveGame`. **Sin** `makeOffers` ni volcado de `weekLog`|
|4862|`confirmFight`|tras `applyPlayerFight`. Sin eventos ni ofertas|
|13215|`gymVisit`| · |13474|`watchFight`| · |13509|`travelWith`|1 semana + `saveGame` + `render`|
|14513|evento `invcamp`|`advanceWeek(); advanceWeek();` — 2 semanas intencionales|
|25958|`advancePeriod`|1 por iteración|

**No hay dobles ejecuciones de un mismo sistema en una semana**: `doWeek('box')` ⇒
`advanceWeek:1, worldTick:1, historicalUfcTick:1, applyTrain:1, campWeek:0, saveGame:1`
y **una** emisión de `week`. La reentrada desde un hook queda bloqueada.

## `advancePeriod` frente a `finishWeek`

Hueco `var advancePeriod = null` (5953); asignada en **25947**. Única implementación viva.

| | `finishWeek` | `advancePeriod` |
|---|---|---|
|Entrenamiento|1 × `campWeek`/`applyTrain` a 0.85|3 × `applyTrain` (Σ 1.0625), **nunca `campWeek`**|
|Eventos|42%, se resuelven|12%, los no-`important` se **descartan**|
|Ofertas|30%|**100% cada semana**|
|Noticias|`pushNews` de todo `weekLog`|sólo `sum.news` (máx 12), sin feed|
|Guardado|`saveGame(true)` cada semana|**ninguno**|

Medido (`advancePeriod(8)`, seed 7, 7 semanas):
`{advanceWeek:7, applyTrain:21, campWeek:0, fireEvent:1, makeOffers:6, saveGame:0, pushNews:0}`.

## Hallazgos

### C-001 · `advancePeriod` quema semanas de campamento sin aplicarlo — ALTA · CONFIRMADO
Línea **25955**: usa `applyTrain` sin comprobar `G.camp`. Con campamento activo y
`nextFight.weeks=7`: `campWeek=0, applyTrain=3, camp.i=0`. La semana se consume
(`week++`, `nextFight.weeks--`) pero `c.i`, `c.sharp`, `c.log`, `c.cutPenalty` y el corte
de peso no avanzan. El jugador pierde preparación de forma invisible.

### C-002 · Rutas que consumen semana sin publicar sus noticias — ALTA · CONFIRMADO
`mgClose` **4766** y `recPick` **2759**. Con un hook de prueba que empuja una noticia:
por `finishWeek` el feed pasa de 3 a 4; por `mgClose(true)+weekApplied` queda en 3.
Con `recPick` ×3: 3 semanas avanzadas, **0** noticias publicadas. Ninguna de las dos
llama `makeOffers`: terminar un minijuego de entrenamiento nunca genera ofertas.

### C-003 · `advancePeriod` no guarda nunca — ALTA · CONFIRMADO
`saveGame:0` en 7 semanas. Aparece en la lista de *guard* de GATE (26059) pero **no**
en la de *autosave* (13582). Un bloque de 52 semanas no deja ni un punto de guardado.

### C-004 · `makeOffers` incondicional destruye las ofertas cada semana — ALTA · CONFIRMADO
`advancePeriod` **25974** llama `makeOffers()` sin probabilidad; `makeOffers` (3203)
hace `G.offers = []` (3206) antes de repoblar. 6 llamadas en 7 semanas. Cualquier
oferta que el jugador estuviera evaluando desaparece cada semana del bloque.

### C-005 · `_weekBusy` no protege del doble toque secuencial — MEDIA · CONFIRMADO
**1257-1266**. El comentario afirma que arregla el doble toque. Verificado: dos
`advanceWeek()` secuenciales llevan la semana de 1 a **3**. La guarda es `try/finally`
síncrono: sólo bloquea reentrada **anidada**. La protección real viene de `CL.once`
(16042, sello año-semana) en los hooks que lo usan; los que no (`saneoJugador`,
`shopWeekly`, `weightDrift`, `luxury`, `metaMods`, `endgame`, `storyTick`) se aplicarían
dos veces.

### C-006 · `skipWeek` pierde su propio efecto al guardar antes de aplicarlo — MEDIA · CONFIRMADO
**4522**: `finishWeek(...)` (que guarda en 4528) corre **antes** de
`G.player.fatigue = clamp(fatigue-12,0,100)`. Fatiga al guardar 48.5, fatiga final 36.5.
Guardar → recargar devuelve 48.5: los 12 puntos de descanso se evaporan.

### C-007 · `audit_final_week` no corre al final de la semana — MEDIA · CONFIRMADO
**27365**: `CL.on('week','audit_final_week',fn)` sin argumento `order`. `hookOn` (3488)
asigna **50** por defecto, no 100. Corre en posición 16 de 30, **antes** de `deuda`(55),
`publico`(56), `wonder`(59), `metaMods`(60), `casino`(62), `endgame`(62), `storyTick`(64),
`apodos`(70), `meta`(80) y `descubierto`(99). La normalización "final" no ve nada de lo
que esos diez hooks mutan.

### C-008 · La semana del aviso financiero no se cobra — **NO REPRODUCE** (revisado en F2-bis)

> **Corrección del veredicto, medida.** La semana **no queda gratis**: la economía se
> *difiere*, no se salta. `CL.finWarn` tiene dos caminos y los dos la aplican —
> el de enfriamiento la aplica en el acto (`G.cash += sponsorIncome - burn`, bajada a
> `gym9`, `CL.overdraft`), y el otro se la pasa al manejador `cl_finwarn`, que cobra según
> la opción elegida.
>
> **Medido, 1 carrera x 250 semanas arrancando con 40 de caja:**
> ```
> avisos financieros ................... 60
> preguntaron al jugador (CL.ask) ...... 25
> aplicaron por enfriamiento ........... 35
> NI una NI otra (semana gratis real) ...  0
> rechazos de queueEvent ................  0
> ```
>
> **Un error de medición propio, anotado para no repetirlo.** La primera sonda contaba
> "semana inerte" como *no encoló y la caja no cambió*, y dio **275 de 527 (52%)**. Es
> falso: `CL.overdraft` convierte el descubierto en deuda y devuelve la caja a 0, así que
> "la caja no cambió" es compatible con que la economía SÍ se haya aplicado. La señal
> válida es instrumentar `CL.ask` y `CL.overdraft`, que distinguen los dos caminos.
>
> **Riesgo residual, no corregido porque no se puede demostrar.** `s.lastFinWarn = now` se
> escribe *antes* de `CL.ask`. Si algún día `queueEvent` rechazara ese `cl_dyn`, se
> quemaría el enfriamiento **y** la economía no se aplicaría. Medido: 0 rechazos en 60
> avisos. No se toca sin evidencia.

Texto original de la auditoría, conservado:

### C-008 (original) · La semana del aviso financiero no se cobra — MEDIA
**1313-1315**. Cuando `CL.finWarn` encola la pregunta, la rama `else` (1317-1328) no se
ejecuta: no se resta `burn`, no se acreditan patrocinios, no se aplica la caída a `gym9`
ni `CL.overdraft`. Con `G.cash=50`, la semana del aviso da `delta 0`. El enfriamiento de
3 semanas (25476) permite repetir el patrón. *SOSPECHA:* si `queueEvent` rechazara el
`cl_dyn`, esa semana quedaría gratis de forma definitiva.

### C-009 · El bloque descarta eventos rutinarios en silencio — MEDIA · CONFIRMADO
**25966-25972**: probabilidad `.12` (vs `.42`) y, si el sorteado no es `important`,
`G.pending.shift()` lo tira sin resolver. Está documentado como intención, pero la
asimetría de contenido entre jugar 52 semanas y avanzar un bloque no lo está.

### C-010 · `G.weekLog` se sobrescribe cada semana — BAJA · CONFIRMADO
**1330**: asignación, no concatenación. Con C-002, tras `recPick` ×3 sólo conserva la
noticia de la última semana.

### C-011 · `G.simRunning` no es guarda de reentrada — BAJA · CONFIRMADO
**25950-25952**: `if(G.simRunning){ G.simRunning=false; } G.simRunning=true;` apaga y
reenciende sin abortar. Una llamada anidada dejaría el bucle exterior con la bandera en
`false`, y el hook `event:pre`/`simulacion` dejaría de descartar a mitad del bloque.

### C-012 · El evento `invcamp` avanza 2 semanas saltándose el cierre — BAJA · CONFIRMADO
**14513**. Las 2 semanas son intencionales, pero ninguna pasa por `finishWeek`: sin
`fireEvent`, sin `makeOffers`, sin volcado de `weekLog`.

### C-013 · Curva de progreso distinta entre bloque y semana a semana — BAJA · CONFIRMADO
Bloque: Σ intensidad **1.0625** en 3 disciplinas con **3 tiradas de lesión**, más `−6`
de fatiga regalado (25957). Manual: **0.85** en una disciplina, **1 tirada**.
Medido en 240 semanas × 6 semillas: bloque 720 `applyTrain` / 1 lesión; manual 218
`applyTrain` / 4 lesiones. Impacto de balance no medido.

### C-014 · Empates de orden resueltos por orden de carga — BAJA · SOSPECHA
`hookCmp` (3512) es `x.o - y.o` y `sort` es estable, así que el desempate lo fija el
orden en el archivo. Empatan: `nucleo`/`saneoJugador` (10), `camps`/`luxury` (36),
`observado`/`casino`/`endgame` (62), `statfx`/`descubierto` (99). Caso sensible:
`luxury`(36, chef −650) corre **después** del cálculo de `burn` (1298), así que el aviso
preventivo de C-008 nunca lo contempla.
