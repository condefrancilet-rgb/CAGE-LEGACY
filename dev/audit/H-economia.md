# DOMINIO H — ECONOMÍA

Verificado con el harness. El CASINO (`G.cas`, `G.casG`, `CAS.*`) se documenta pero
**NO se refactoriza** (regla del encargo).

## Corrección a la premisa de F0

Los puntos de extensión **`week:burn` y `week:income` NO existen**. Hay un único evento
`'week'` (emitido en `advanceWeekCore` 1330) con 30 suscriptores. El gasto fijo y los
patrocinios se restan/suman **en línea** (1317-1323), **antes** de emitirlo, no como hooks.
Quien mueve dinero, en orden: `shopWeekly`(16) · `economia`(30) · `content`(35) ·
`luxury`(36) · `deuda`(55) · `publicoSpon`(57) · **`descubierto`(99, liquidación final)**.
El orden es correcto: todos los que mueven caja corren antes de la liquidación.

## La curva de dinero — medida

**Bucle base** (autopiloto, 4 semillas, política `basica`, que nunca compra ni abre minijuegos):

| semanas | cash medio | `careerEarn` medio | deuda media | **earn/semana** |
|---|---|---|---|---|
| 10 | 1.413 | 2.873 | 1.238 | 287 |
| 20 | 371 | 4.280 | 1.636 | 214 |
| 40 | 1.353 | 8.456 | 5.289 | 211 |
| 60 | 635 | 12.763 | 5.108 | 213 |
| 80 | **3** | 15.690 | 8.909 | 196 |
| 100 | 2.002 | 21.752 | 10.251 | **218** |

Hasta la semana ~100 la curva es **lineal** (≈218 $/semana constante) y la caja queda
**anclada cerca de cero**, porque `CL.overdraft` (21683-21687) pone `cash = 0` y convierte
el rojo en deuda. El `cash: 0` que vimos en F0 tras 40 semanas sin pelear **es el
descubierto funcionando**, no una pérdida de dinero.

### Corrección medida: la curva SÍ es superlineal, a partir de la semana ~125

Una segunda medición (8 semillas × 150 semanas) corrigió la conclusión anterior:

| sem | cash medio | cash máx | earn medio | deuda media | peleas |
|---|---|---|---|---|---|
| 100 | 853 | 3.986 | 22.234 | 17.901 | 8 |
| 125 | 2.134 | 11.634 | 30.429 | 20.871 | 10 |
| **150** | **44.743** | **319.121** | **87.522** | 19.278 | 12 |

Entre 125 y 150 la media de caja se multiplica por **21**. La media la crea **una sola
carrera** de ocho: desglose a 150 semanas `0 · 500 · 186 · 4.112 · 31.214 · 2.813 ·
319.121 · 0`, mediana ≈2.800 frente a media 44.743. Máx/media = 7,1×, que **reproduce** el
9,5× de la simulación 40×150 de F0 (1.303.591/137.206): misma forma, cola derecha pesada
creada por una minoría de carreras.

**El causante es H-005, no los minijuegos.** El autopiloto nunca compra en el SHOP, nunca
abre un minijuego y nunca entra al casino, así que H-001/H-002/H-003/H-008 quedan
**descartados como causa de esta cola**. Lo único que sí hace es resolver eventos al azar,
lo que incluye firmar el evento `sponsor` (2906), sin guarda `seen()`. Cada firma se apila
en `G.spons` y `publicoSpon` (19757) multiplica cada patrocinio cada año: ese es el motor
exponencial, y explica por qué la explosión llega tarde — necesita varios años de
reescalado compuesto sobre varios contratos apilados.
Corolario que lo confirma: la deuda media **deja de crecer justo en ese tramo**
(20.871 → 19.278, la única bajada de toda la serie), porque los patrocinios apilados pasan
a cubrir el gasto fijo y `CL.runwayWeeks()` devuelve `Infinity`.

**H-005 sube de ALTO a CRÍTICO**: es el único hallazgo que se manifiesta sin que el jugador
haga nada deliberado. H-001/H-002/H-003 siguen siendo exploits confirmados y mucho más
rápidos, pero son **adicionales** a esta cola.

> ### CORRECCIÓN tras el arreglo (F2-07) — la atribución de la cola era errónea
> Al corregir el compuesto se midió el A/B real (8 carreras × 400 semanas ≈ 7 años, mismas
> semillas, cargando la versión anterior del archivo en el harness):
>
> | | antes | después |
> |---|---|---|
> | ingreso semanal de patrocinios, mediana | 1.218 | **472** (−61%) |
> | ingreso semanal de patrocinios, máximo | 3.756 | **1.673** (−55%) |
> | `cash` mediana | 1.746.795 | 1.727.067 (−1%) |
> | `careerEarn` | 2.011.922 | **2.011.922 (idéntico)** |
>
> El compuesto desaparece, pero **la cola de dinero no se mueve**: los patrocinios no eran
> su causa. El mecanismo lo explica: el ingreso de `G.spons` se suma **sólo a `G.cash`**
> (1323), mientras que `careerEarn` lo alimenta `G.flags.sponsorW` (15131), que es el
> **artículo de tienda** H-004, otra cosa distinta con el mismo nombre coloquial.
> Confundirlos fue el error de atribución. **La causa de la cola sigue sin identificar** y
> queda abierta para F5.

## Hallazgos

### H-001 · Bucle de dinero compuesto e ingreso pasivo sin techo en `invest` — CRÍTICO · CONFIRMADO
`fameResolve` 14948-14953; disparador `fameStart` 14361; botón permanente en
`CL.hubCard('instalaciones')` 17672.
```js
var invested = Math.round(clamp(safeNum(G.cash,0)*0.10, 800, 25000));
var ret = Math.round(invested*mult);              // mult = (q-0.45)*2.2
G.cash = safeNum(G.cash,0) + ret;
G.flags.bizIncome = Math.max(0, safeInt(G.flags.bizIncome,0) + (q>=0.7 ? 180 : 0));
```
Tres defectos que se multiplican:
1. **`invested` nunca se resta de `G.cash`** — no se arriesga capital, sólo se acredita el retorno.
2. **El retorno es proporcional a la caja**, así que cada clic compone (×1,088 con q=0,85).
3. **`bizIncome` se acumula sin tope**: +180 $/semana **permanentes por clic**.

`fameStart` no comprueba `mgSlotBusy()` (a diferencia de `negoStart` 2766), no cobra, no
llama a `advanceWeek()` y no registra enfriamiento.
Medido: **12 clics en una sola semana → 50.000 → 137.570 y +2.160 $/semana para siempre.**

### H-002 · Ingreso ilimitado sin riesgo en `stream` — CRÍTICO · CONFIRMADO
`fameResolve` 14940-14946: `pay = 600 + q*4.200 + tips*350`, sin coste, sin tiempo y sin
límite de repeticiones. Medido: **+50.100 por 10 clics** en la misma semana. Coste de
entrada `studio` 16.000 — se amortiza en 4 clics.

### H-003 · Ingreso ilimitado sin riesgo en `photo` — ALTO · CONFIRMADO
`fameResolve` 14385-14389: `pay = 1.500 + q*7.000`. Botón permanente en
`CL.hubCard('vida')` 17656 con la única condición `pop >= 22`; **no requiere ninguna
compra**. Medido: **+78.000 por 10 clics**. Es el exploit accesible más temprano.

### H-004 · Artículo gratuito con renta perpetua — ALTO · CONFIRMADO
`SHOP` 15005: `{id:'sponsor', p:0, ok: pop>=45, f: sponsorW += 420}`.
Precio **cero** por **+420 $/semana** (21.840/año) perpetuos. La única baja es `pop < 30`,
y `changePopularity` tiene un **suelo del 45% del pico histórico** (21555-21560), así que
tras llegar a 45 es casi imposible bajar de 30. No existe razón para no comprarlo.

### H-005 · Patrocinios apilables con reescalado anual compuesto — **CRÍTICO** · CONFIRMADO
Evento `sponsor` 2906: `c: return G.player.pop > 18` — **sin guarda `seen()`** y sin mirar
`G.spons.length`. Cada disparo hace `G.spons.push(...)`. Sobre el total, el hook
`publicoSpon` 19757 aplica **cada año** `s.week *= clamp(aud.mult, 0.7, 1.6)`: interés
compuesto sobre ingreso pasivo. Medido con `mult=1,0661`: ×1,9 en 10 años; saturado a 1,6
serían ×110. Con 5 patrocinios a pop 60 → 1.500 $/semana contra un gasto de 525:
**`CL.runwayWeeks()` devuelve `Infinity`**. La economía queda resuelta sin volver a pelear.

### H-006 · El novato queda en descubierto antes de poder cobrar — ALTO · CONFIRMADO
`startCareer` 4375 da `cash = 2500`. Medido en arranque limpio: caja 3.150, gasto
**525 $/semana**, patrocinios 0, **runway = 6 semanas**; a las 10 semanas la deuda es 1.515.
El propio comentario del código (25419-25422) documenta que las ofertas tardan **6-11
semanas** en convertirse en pelea: **la ventana de supervivencia es estructuralmente más
corta que el tiempo hasta el primer ingreso posible.** Se agrava con gimnasios caros
(American Top Team 1.400 $/semana) más el plan `allin` (1.500): 2.900 $/semana contra
2.500 de caja inicial.

### H-007 · Las tasas están bien acotadas — INFORMATIVO · CONFIRMADO
Contra lo esperado, esta zona **no debería tocarse**: interés de deuda 0,4%/semana y sólo
con `weeksIdle > 10` (19479); renegociar tiene techo `min(0.035, rate*1.9)` (19503, con el
comentario que documenta el fallo previo de 3.700%/semana); `CL.OD_CAP = 60.000` (21714) y
`CL.DEBT_CAP = 90.000` (21745) con congelación; `CL.debtBite` limita el mordisco a la bolsa
al 30-55% (19431). El único coste fijo desproporcionado es H-009.

### H-008 · Las inversiones endgame tienen EV positivo y son repetibles — MEDIO · CONFIRMADO
`ENDGAME.investments` 26121-26123, resolución en `egTick` 26148-26163:

| id | principal | plazo | EV | anualizado |
|---|---|---|---|---|
| `media` | 250.000 | 26 sem | ×1,106 | ≈ +22% |
| `tech` | 500.000 | 39 sem | ×1,175 | ≈ +24% |
| `realestate` | 1.000.000 | 52 sem | ×1,146 | ≈ +15% |

Las tres son rentables en promedio y se reabren al vencer (`egInvest` sólo bloquea una
instancia `open` por id, 26140). Composición garantizada; alimenta el máximo de 1.303.591.

### H-009 · `nutritionchef`: 9.500 de compra y 650 $/semana eternos a cambio de nada — MEDIO · CONFIRMADO
Compra en 25211; **única** lectura del flag en 25245: `if(G.flags && G.flags.chef) G.cash -= 650;`.
`grep -c chef` = 2: la escritura y ese cobro. La descripción promete "menor caída de
energía y mejor corte"; ninguna está implementada. Coste real a 100 semanas: **74.500**.
Es el peor artículo de la tienda y es una trampa, no una decisión.

### H-010 · Dos artículos completamente inertes — MEDIO · CONFIRMADO
- `analyst` (6.800, 13610): `f()` hace `G.flags.analyst=1` y nada más. Promete "ves una
  debilidad del rival antes de cada pelea"; ese código no existe.
- `cutman` (5.600, 13641): idéntico patrón. Promete "menos daño acumulado";
  `applyWinLossResult` no consulta el flag.

### H-011 · Ocho artículos con el efecto anunciado muerto — BAJO/MEDIO · CONFIRMADO
Flags escritos una vez y leídos cero veces: `nutri` (13603), `stylist` (15004),
`recoveryLab` (25209), `eliteCampWeek`/`eliteCampBoost` (25210), `teamCamp` (25214),
`videoWall` (25215), `penthouse` (25217), `vaultCash` (25219). Todos entregan un bono de
stat colateral, así que la compra no es inerte del todo, pero **lo que el jugador lee en
la descripción no ocurre**. Los más caros: `videoWall` 78.000 por +3 de fightiq y
`penthouse` 300.000 por +7 composure. `elitecamp` es **repetible** a 28.000 con su efecto
entero muerto.

### H-012 · CASINO: inflación de `careerEarn` por ciclado — MEDIO · CONFIRMADO · **SIN REFACTOR**
> El casino es INTOCABLE. Se documenta para dejar constancia, no para corregirse.

`CAS.buy` 22448 descuenta caja y **no** toca `careerEarn`; `CAS.cashOut` 22464 acredita caja
**y además** `careerEarn`. Como exploit de dinero **no lo es** (EV negativo, 5% de comisión,
`CAS.buyCap` 60% de la caja/mes). Como exploit de **puntuación sí**: comprar fichas y
canjearlas sin jugar convierte caja en "ganancias de carrera" al 5%. Medido: ciclando
10.000 seis veces, `careerEarn` pasó de 0 a **47.500 con un coste real de 2.500**.
`careerEarn` alimenta el puntaje de legado y los finales (26087): es legado comprable.

## Resumen de severidades

| ID | Sev | Una línea |
|---|---|---|
| H-001 | CRÍTICO | `invest` compone el 10% de la caja por clic y apila +180/sem sin techo |
| H-002 | CRÍTICO | `stream` paga ~5.010 por clic, ilimitado y sin coste |
| H-003 | ALTO | `photo` paga ~7.800 por clic, sin requerir compra alguna |
| H-004 | ALTO | Artículo `sponsor` a coste 0 con renta perpetua de 420/sem |
| H-005 | **CRÍTICO** | Patrocinios apilables sin límite y reescalados en compuesto cada año — **causa la cola pesada de la simulación** |
| H-006 | ALTO | Runway de 6 semanas contra un primer ingreso a 6-11 semanas |
| H-007 | INFO | Las tasas e intereses están bien acotados; no tocar |
| H-008 | MEDIO | Las tres inversiones endgame tienen EV positivo y son repetibles |
| H-009 | MEDIO | `nutritionchef`: −650/sem eternos a cambio de nada |
| H-010 | MEDIO | `analyst` (6.800) y `cutman` (5.600) totalmente inertes |
| H-011 | BAJO/MEDIO | 8 artículos con el efecto anunciado muerto |
| H-012 | MEDIO | Casino: ciclar fichas infla `careerEarn` al 5% — documentado, sin refactor |
