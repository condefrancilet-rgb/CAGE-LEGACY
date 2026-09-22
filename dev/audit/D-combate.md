# DOMINIO D — COMBATE

Verificado con el harness (semillas 3,5,7,9,11,77,88; 560+ peleas sintéticas y una
carrera completa de 33 peleas). Las cuatro ALTAS fueron **re-verificadas de forma
independiente por el orquestador**.

## Pipeline, en orden

```
scrHub → goFight() 4773
  ├ si !G.nextFight → aborta, G.fight=null, go hub        4780-4785
  ├ G.paid = false            ◄── ÚNICO reset             4786
  └ fightStart(nf.oppId, {rounds: title?5:3, …})          4787
fightStart 1641
  ├ hookEmit 'fight:start:pre'  casino(10) → fx(20)
  ├ si !F(oppId) → cancela la pelea entera                1645-1652
  ├ G.fight = {…21 campos…}                               1653-1662
  ├ ajuste por campamento: p.stam / p.hp / sharp          1664-1670
  ├ hookEmit 'fight:start'  totales(10) → bonoCampamento(20) → CL(30)
  │                         → resistencia(40) → identidadRival(50)
  └ UI.screen='fight'; render()                           1674

BUCLE — fightAct(key) 1816
  ├ if(!f || f.over) return                        1817  ◄ GUARDA
  ├ base = hookFilter 'act:translate'               1818
  ├ hookEmit 'act:pre'  identidadRival(5) → CL(10)  1820
  ├ oAct = oppAction() 1784 → oppActionBase() 1750 (wpick por pesos de estilo)
  │        → filtro 'combat:oppPick' → evento 'combat:oppPick:after'
  ├ resolveExchange(base,oAct,p,o)                  1809
  │   ├ 'exchange:pre'  tqPasivas(10) → danoAcumulado(20)
  │   ├ resolveExchangeCore 1866
  │   │   ├ 10× eff() → filtro 'combat:eff' CL(10) → TQ(20)
  │   │   ├ gpMod() → filtro 'gp:mod' CL(10) → tecnicas(20)
  │   │   ├ sub/bsub → finishFight('sub',·)         2000/2008/2025/2037
  │   │   └ KO: if(f.o.hp<=0) finishFight('ko','p') 2045
  │   └ 'exchange:post' danoAcumulado(10, →tkoCheck) → tqPasivas(20) → saneoRecursos(30)
  ├ f.ex++;  f.clock -= ri(38,62)                   1823
  ├ if(f.ex>=f.exPer || f.clock<=20) endRound()     1828
  └ hookEmit 'act:post'  CL(90) → identidadRival(95)
endRound 2052
  ├ puntúa el round y push a f.cards
  ├ f.round++ ; f.ex=0 ; f.clock=300                2092
  ├ if(f.round > f.rounds) finishFight('dec',null)  2103  ◄ D-005
  └ UI.sub='corner'                                 2104
finishFight 2129 → 'fight:finish:pre' totales(10) → sumision(20, puede CANCELAR)
  ├ if(ctx.handled) return false                    2132
  ├ 'dec' → finishByDecision() 22279 (jueces v2.5)  2134
  └ else → finishFightCore 2138 → f.over=true, f.result, UI.screen='fightresult'
[fightresult] scrFightResult 4831  ← LA NAV INFERIOR SIGUE VISIBLE
  └ si !G.paid → "Ver consecuencias" → confirmFight() 4836
confirmFight 4852   ◄── SIN GUARDA
  ├ applyPlayerFight() 3334 → 'fight:pre' → applyWinLossResult 3341
  │     rec/streak/lastFights · purse+bonus−cut · pop · rep · XP · fatiga/dmg/lesión
  │     · títulos/G.champs · p.career.push · contract.left-- · recalcRank · pushNews
  │     · G.nextFight=null · G.camp=null            3414
  │  → 'fight:applied' (economia RE-CALCULA la bolsa y ajusta G.cash, 12536)
  ├ G.paid = true 4861 · advanceWeek() 4862 · saveGame(true) 4863
go(destino) 4009
  └ if(G.fight && G.fight.over && destino ∉ {fight,fightresult,mg}) G.fight=null  4021
```

## Puntos de extensión y suscriptores (volcado real de `HOOKS`)

| Punto | Tipo | Suscriptores en orden |
|---|---|---|
| `fight:start:pre` | evento | casino(10) → fx(20) |
| `fight:start` | evento | totales(10) → bonoCampamento(20) → CL(30) → resistencia(40) → identidadRival(50) |
| `fight:options` | filtro | metaYRecomendacion(10) → tecnicasDesbloqueadas(20) *(inyecta los `cl_*`, 17824)* |
| `combat:eff` | filtro | CL(10) → TQ(20) |
| `combat:oppPick` | filtro | CL(10) → identidadRival(20) |
| `act:translate` | filtro | CL(10) *(17838: `cl_*` → `mv.base`)* |
| `act:pre` / `act:post` | evento | identidadRival(5) → CL(10) / CL(90) → identidadRival(95) |
| `exchange:pre` | evento | tqPasivas(10) → danoAcumulado(20) |
| `exchange:post` | evento | danoAcumulado(10, →`tkoCheck`) → tqPasivas(20, sangrado→KO) → saneoRecursos(30) |
| `gp:mod` | filtro | CL(10) → tecnicas(20) |
| `fight:finish:pre` | evento | totales(10) → **sumision(20)** *(25007: puede poner `handled` y CANCELAR el final)* |
| `fight:pre` / `fight:applied` | evento | saga(10) → economia(20) → CL(30) → tq(40) → meta(50) → memoria(60) |
| `screen:fightresult` | filtro | eco(10) → dr(20) → tarjetasDeJueces(30) → recompensaTecnicas(40) — **los 4 son puros** |

## Hallazgos

### D-001 · `confirmFight()` no tiene guarda de idempotencia — ALTA · CONFIRMADO ×2
`confirmFight` **4852** llama a `applyPlayerFight()` sin comprobar `G.paid`. `G.paid` sólo
se lee en la **presentación** (`scrFightResult` 4835): es decoración de UI, no un cerrojo.
GATE (3631-3648) sólo añade `retiredGuard` + `autosaveNow`, **no** idempotencia.

**Reproducido por el orquestador** (sumisión encajada, seed 77):
```
antes     rec 0-0  cash  3.150  career 0  week 1  paid false
1 llamada rec 0-1  cash  5.767  career 1  week 2  paid true
2 llamadas rec 0-2 cash 12.194  career 2  week 3  paid true
3 llamadas rec 0-3 cash 18.621  career 3  week 4  paid true
```
Tres entradas de `p.career`, tres bolsas y tres semanas **para una sola pelea**.
*Arreglo:* `if(!G.fight || !G.fight.result || G.paid) return;` como primera línea.

### D-002 · Aplicación parcial + reintento = doble récord y doble bolsa — ALTA · CONFIRMADO
`applyPlayerFight` 3334 **no está envuelta en `safeRun`** (figura en `ERR.CRITICAL` 10817 y
tiene mensaje en `ERR.MSG` 10919, pero nadie la envuelve). Si algo lanza a mitad de
`applyWinLossResult` (el archivo documenta un caso real en 1190-1193), la excepción sale
de `confirmFight` **antes** de `G.paid=true` 4861 → el botón sigue vivo → el reintento
re-aplica el prefijo que sí funcionó. Reproducido forzando fallo en `changePopularity`:
una pelea → **rec 0-2 y dos bolsas**.

### D-003 · Re-roll infinito del resultado saliendo sin confirmar — ALTA · CONFIRMADO ×2
El descarte de `go()` 4021-4023 cierra la doble aplicación pero **abre la contraria**:
`G.nextFight` sólo se anula dentro de `applyWinLossResult` 3414 / `applyDrawResult` 22226,
que nunca corren si no se confirma. Y `renderNav()` **4045** oculta la barra inferior en
`['title','create','ending','fight','mg']` — **`fightresult` NO está en la lista**, así que
el jugador tiene los cinco botones de navegación en la pantalla de resultado.

**Reproducido por el orquestador** (seed 88):
```
intento 1: sub, ganador=o → go('hub') → fight=null, nextFight=true, rec 0-0
intento 2: dec, ganador=o → go('hub') → fight=null, nextFight=true, rec 0-0
intento 3: ko,  ganador=o → go('hub') → fight=null, nextFight=true, rec 0-0
```
Tres derrotas encajadas, récord 0-0 y la pelea sigue firmada. Un toque en "Inicio" borra
cualquier resultado; la lesión, la fatiga y el daño tampoco se aplican.

### D-004 · Autoguardado con el resultado sin confirmar — ALTA · CONFIRMADO (estructural)
`fxResolveMini` está en la lista de autoguardado (13581) y es el callback del minijuego de
finalización → `fightFinishResolve` 6367 → `finishFight`. El wrapper de GATE (3642)
dispara `autosaveNow` **después**, con `f.over===true` y `G.paid===false`. `fight` y `paid`
**no** están en `STATE.RUNTIME_KEYS` (3773-3797) → se serializan. Al cargar, `loadGame`
12999 hace siempre `go('hub')` → 4021 anula `G.fight`: resultado perdido y pelea
repetible. Mismo efecto que D-003, alcanzable por cierre de pestaña o crash.

### D-005 · H-009 resuelto: `f.round` alcanza `rounds+1` — MEDIA en trazas / BAJA en juego · CONFIRMADO el síntoma, REFUTADA la causa temida
`endRound()` **2092** hace `f.round++` **antes** del tope de **2103**
`if(f.round > f.rounds) finishFight('dec',null)`. El incremento **es** el mecanismo que
dispara la decisión, así que en toda pelea a las tarjetas `f.round` queda en `rounds+1`.
No es que el bucle no respete el tope: el tope funciona y lo que se observa es el centinela.

Medido (300 peleas a 3 rounds): `f.round` final `{1:17, 2:88, 3:91, 4:104}` — los 104
cuatros son exactamente las 104 decisiones. Con `rounds:5` aparece el 6.
**El `round:6` de nuestras trazas de F0 es una pelea de título a 5 rounds, no una de 3.**

**No contamina el estado persistido**: `finishByDecision` 22289 escribe `round: r.round` y
`v25JudgeCards` 22275 lo fija en `f.rounds`. En 200 peleas, `f.result.round` nunca pasó de 3.
El invariante interno 27766 ya tolera `rounds+1`. La fuente de la traza es
`dev/autopilot.js:133`, que guarda el campo crudo.

### D-006 · `fightStart()` no resetea `G.paid` — MEDIA · CONFIRMADO
`G.paid=false` vive sólo en `goFight` 4786, no en `fightStart` 1641, que es la función
canónica de arranque. Cualquier ruta que llame a `fightStart` directamente hereda
`G.paid=true` de la pelea anterior → nunca se muestra "Ver consecuencias" y el resultado
no se puede cobrar. El reset pertenece a `fightStart`.

### D-007 · `finishFight()` no comprueba `f.over` — MEDIA · CONFIRMADO (estructural)
2129 no tiene la guarda que sí tienen `fightAct` 1817, `tkoCheck` 6341 y `tqPasivas` 21103.
Una segunda llamada sobrescribe `f.result`, vuelve a consumir RNG (`chance(.5)` en 2154) y
re-renderiza. Hoy está tapada por los llamadores, pero es el mismo agujero que el
comentario de 22280-22284 describe como ya sufrido. `fightFinishResolve` 6367 llama sin
comprobar `f.over`.

### D-008 · Sumisión anulada: se pierde el log y la fatiga del intercambio — BAJA · CONFIRMADO
Cuando el hook `sumision` 25007 pone `handled=true`, `finishFight` devuelve `false` y
`resolveExchangeCore` **ya había hecho `return`** (2000/2008/2025/2037) → se saltan
`txt.forEach(flog)` y `drain('p',1.5); drain('o',1.5)` (2048-2049). El intercambio ocurre
pero no narra ni cansa. En la carrera de 33 peleas hubo 34 llamadas a `finishFight`.

### D-009 · `TQ.apply` duplica las reglas de reloj del bucle — BAJA · CONFIRMADO
`TQ.apply` 20660-20668 reimplementa `f.ex++`, `f.clock-=ri(30,52)`, chequeo de HP y
`endRound()` con constantes distintas a `fightAct` 1823 (`ri(38,62)`) y **sin emitir
`exchange:pre/post`**: `danoAcumulado` no contabiliza ese daño, `tkoCheck` no corre y
`saneoRecursos` no normaliza. Un round resuelto con técnicas TQ tiene contabilidad de daño
distinta a uno normal.

### D-010 · La pantalla de resultado dice "DERROTA" en los empates — BAJA · CONFIRMADO
`scrFightResult` 4832-4834 calcula `won = res.winner==='p'`, así que con `winner==='d'`
pinta "DERROTA / PERDISTE"; el hook `drScrFightResPrev` 15531 antepone después una tarjeta
"EMPATE". Quedan los dos mensajes contradictorios en la misma pantalla.

### D-011 · La rama de jueces de `finishFightCore` es código muerto — INFO · CONFIRMADO
2141-2151 (3 jueces con ruido ±1.2, sin 10-10 ni empate) es inalcanzable: 2134 desvía todo
`method==='dec'` a `finishByDecision`, que el módulo v2.5 siempre define (22279).

## Contraste: el flujo nominal NO duplica
Carrera completa instrumentada (seed 7, 400 semanas): 33 peleas → 33 `confirmFight` → 33
`applyPlayerFight` → `p.career.length === 33`, `rec` suma 33. Las vías D-001…D-004 son
**condicionales** (segunda pulsación, excepción, navegación, crash), no sistemáticas.
**La guarda que el comentario de `go()` 4014-4022 da por completa tiene dos huecos:
`confirmFight` sin cerrojo propio, y la salida sin confirmar.**

---

## Adenda F2 · Los tres cierres de intercambio (preparación de la consolidación)

Al buscar el siguiente candidato estructural de F2, el archivo resulta tener **tres sitios
distintos que cierran un intercambio**, cada uno con sus propias constantes:

| sitio | línea | reloj | qué hace al cerrar | emite `exchange:pre/post` |
|---|---|---|---|---|
| `fightAct` | 1837 | `ri(38,62)` | si hay KO no cierra round ni redibuja; si no, `endRound` + `render` | **sí**, vía `resolveExchange` |
| `fightFinishResolve` | 6468 | `ri(24,46)` | `drain('p',10\|9)`, `endRound`, `render` — **sin comprobar KO** | **no** |
| `TQ.apply` | 20783 | `ri(30,52)` | `finishFight` si cae cualquiera, `drain` 1,2 a ambos, `endRound`, `render` | **no** |

Es el mismo patrón que hizo falta consolidar en `rollEvent`: una regla —cómo se cierra un
intercambio— escrita tres veces y ya divergida. Los tres suscriptores de
`exchange:pre/post` (`danoAcumulado`, `tqPasivas`, `saneoRecursos`) **no corren** para dos
de los tres caminos.

### Lo que la medición dice, y lo que NO dice

5 carreras x 200 semanas con el autopiloto:

```
fightAct (intercambio normal) .... 1433
fightFinishResolve (minijuego) ...    0
TQ.apply (tecnica) ...............    0
hook exchange:pre disparado ......  1433
hook exchange:post disparado .....  1433
```

**Esto NO prueba que esos dos caminos no se usen en juego real.** Prueba que *el
autopiloto* no los pisa: su política resuelve las peleas llamando a `fightAct` y nunca abre
el minijuego de finalización ni el árbol de técnicas. Es una limitación del instrumento,
no un hallazgo sobre el juego. Un jugador humano sí los recorre.

### Consecuencia para el plan

La consolidación de combate **no se puede validar con el golden master**, porque las trazas
del autopiloto no entran en dos de los tres caminos — exactamente el mismo problema que
tuvo el respaldo de `rollEvent`. Necesita primero su propia red de caracterización que
conduzca `TQ.apply` y `fightFinishResolve` directamente desde el harness, como se hizo en
`dev/tests/07-rollevent.js` forzando el mazo vacío.

Y hay una frontera que respetar: **unificar las tres constantes de reloj es balance, no
consolidación** (hoy una técnica cuesta menos reloj que un intercambio normal, y eso puede
ser deliberado). Lo que sí es consolidación es que la *estructura* del cierre —comprobar
KO, cerrar round, redibujar, y qué se emite— viva en un solo sitio con el coste de reloj
como parámetro. Hacer que los hooks se emitan en los tres caminos **cambia
comportamiento** (empezaría a correr el TKO por daño acumulado en técnicas y minijuegos):
es un arreglo con su propia evidencia, no un refactor.
