# Lista para F14 — balance

> Todo lo que se encontró durante el refactor y **no se tocó** porque es decisión de
> balance, no de corrección. Cada entrada trae la medición que la sostiene.

## 1. Los tres relojes del cierre de intercambio

`fightAct` gasta `ri(38,62)`, `TQ.apply` `ri(30,52)` y `fightFinishResolve` `ri(24,46)`.
La regla de **cuándo** se cierra el round ya está unificada en `roundOver(f)`; lo que sigue
divergiendo es el **coste**. Puede ser deliberado —una técnica cuesta menos reloj que un
intercambio completo— y por eso no se igualó. Fijado por prueba en
`dev/tests/08-intercambio.js` para que no se cierre por accidente.

## 2. La tasa de campeones tras el cambio de agresividad

`3a635ea` hace que la agresividad del jugador afecte al combate (antes se escribía y no se
leía nunca). Medido:

| n por brazo | % campeones antes → después | IC95 sin parear | **IC95 pareado** |
|---|---|---|---|
| 200 | 85,50 → 82,50 | [−10,33, 4,33] | [−6,99, 0,99] |
| 500 | 81,00 → 79,00 | [−7,06, 3,06] | **[−5,10, 1,10]** |

**Sigue sin ser concluyente contra el margen de 5 pp, pero por muy poco.**

**Dos correcciones a los números que di, y la segunda es mía otra vez.**

*Primera:* dije que decidirlo exigía ~2.200 carreras por brazo. Ese cálculo salía del
análisis **sin parear**, que tira a la basura el hecho de que los dos brazos corren las
mismas semillas. Con el pareo, a n=500 el EE del % de campeones baja de **2,53 pp a 1,55 pp**.

*Segunda:* entonces dije **~534 por brazo**, y eso también está mal. 534 es el n con el que
el intervalo cerraría **si la estimación volviera a dar exactamente −2,00 pp**, y eso pasa
alrededor de la mitad de las veces. Calcular el n con el que el IC cierra *en el punto
estimado* no es calcular el n con el que la prueba **funciona**: es diseñar para el caso
mediano y llamarlo garantía.

La cuenta correcta es la potencia de la prueba de equivalencia. Con margen ±5 pp y un efecto
real de −2 pp, el lado que ata es el inferior: hace falta `δ̂ − 1,96·EE > −5`, así que
`potencia = P(Z > 1,96 − 3/EE)`. Derivado (no copiado):

| potencia | EE necesario | n pareado por brazo |
|---|---|---|
| **49 %** | 1,55 pp — *lo que ya tenemos a n=500* | 500 |
| 52 % | 1,50 pp | **534** ← mi cifra equivocada |
| 80 % | 1,071 pp | **~1.048** |
| 90 % | 0,926 pp | ~1.403 |

Sin parear, para la misma potencia del 80 %, harían falta ~2.790 por brazo. Así que el
pareo **sí** reduce el coste a la mitad larga; lo que no hace es dejarlo al alcance de las
500 que ya corrimos.

**Regla, si alguna vez se corre:** una corrida **nueva**, con el n fijado **de antemano**
(1.050 por brazo para 80 %). **Nunca sumar carreras a las 500 hasta que cierre.** Mirar el
resultado y seguir corriendo hasta que dé bien sesga el veredicto hacia «equivalente»: es
parada opcional, y convierte la prueba en un trámite que siempre aprueba.

**No la lancé:** la instrucción fue matar ese A/B y mandar la pregunta acá. Queda el número
corregido para que la decisión se tome con el coste real.

El resto sí quedó resuelto con el pareo a n=500: **win rate [−0,27, 0,84] pp, % KO
[−0,42, 1,29], % decisión [−1,24, 0,48], % sumisión [−0,11, 0,01] — los cuatro EQUIVALENTES**
dentro de ±2 pp. La suma cero se sostiene donde importa.

**Pregunta abierta:** ¿molesta que la tasa de campeones pueda bajar ~2 pp a cambio de que un
atributo deje de ser decorativo?

## 3. Tasa de campeones demasiado alta en general

Medido en 200 carreras × 300 semanas: **85,5 %** de las carreras terminan con al menos un
título, y el récord medio es de ~24 peleas. Es muy alto para un simulador de carrera.

## 4. Sumisiones casi inexistentes

**0,11 %** de las peleas terminan por sumisión, contra 45,5 % por KO y 54,4 % por decisión.
El árbol de técnicas tiene ramas de sumisión completas que casi nunca se ven.

## 5. Dinero de fin de carrera

Tras cerrar los tres exploits (`810e624`), la caja media sigue siendo **~1,16 M** a las 300
semanas. Queda por decidir si es la escala buscada.

## 6. Eventos inalcanzables por edad

`legacy_thought`, `x3_veteran` y `story_veteran_legacy` piden 33+ años, pero la edad final
media es **28,0**. Nunca aparecen. O bajan el umbral, o las carreras tienen que durar más.

## 7. El techo del ingreso pasivo

`BIZ_INCOME_MAX = 1800` lo puse yo al cerrar H-001, como el equivalente a diez inversiones
buenas. Es un número elegido, no medido: conviene revisarlo con criterio de diseño.

## 8. `advancePeriod` vs semana a semana

Curva de progreso distinta entre avanzar por bloques y semana a semana (C-013).

## 9. A-002 desinfla `careerEarn`, y `careerEarn` calibra cuatro cosas

`careerEarn` (ganancias acumuladas de la carrera) no es sólo un número de adorno: es
entrada de **cuatro** sistemas.

| dónde | línea | qué hace con él |
|---|---|---|
| puntaje de legado | `:8753` | `careerEarn / 25.000` puntos. Los escalones son 200 · 500 · 1.000 · 1.800 · 3.000 (APRENDIZ → LEYENDA) |
| logro `first` | `:24082` | `careerEarn > 0` |
| logro `k100` | `:24083` | `careerEarn >= 100.000` |
| logro `m1` | `:24084` | `careerEarn >= 1.000.000` (raro) |
| desafío de dinero | `:24162` | barra de progreso sobre 500.000 |
| puntuación final / récords | `:8777`, `:24385` | se guarda como `earn` de la carrera |

**Qué cambió A-002.** Antes, cuando la corrección del pago era negativa —la fórmula vieja
había concedido un bono que `fightPayout` no concede, o `CL.payout` descuenta deuda— la
caja se llevaba el `diff` entero pero `careerEarn` se quedaba con la cifra vieja, inflada
(`Math.max(0, diff)`). Medido antes de arreglarlo: **94 de 144 peleas divergían**; un caso
real **metía $947 en la caja y anotaba $1.597 en la carrera**. Ahora las dos reciben el
mismo `diff`, así que `careerEarn` iguala el neto liquidado de verdad.

**La consecuencia de balance.** Si los cinco umbrales de arriba se calibraron mirando el
valor inflado, ahora **se alcanzan más tarde**: el mismo jugador con la misma carrera
acumula menos ganancias registradas, así que llega después a `k100`, a `m1`, al desafío de
500.000 y a cada escalón de legado. No es un bug —el número nuevo es el correcto—, es una
recalibración pendiente: **o se bajan los umbrales, o se acepta que el dinero pese menos
en el legado**. No se tocó ni uno.

**Magnitud medida.** A/B de 200 carreras × 300 semanas por brazo, `43d8925` contra
`6e7854b`, **pareado por semilla** (cada carrera es su propio control):

| campo | antes | después | delta | IC95 |
|---|---|---|---|---|
| `careerEarn` | 1.370.860 | 1.360.268 | **−10.592** | [−11.403, −9.782] |
| todo lo demás (32 campos) | — | — | **0 exacto** | [0, 0] |

`careerEarn` baja en **las 200 carreras**, entre −207 y −33.160 (media −10.592, **−0,77 %**).
**Ningún otro campo cambia en ninguna carrera**: ni caja, ni récord, ni KO, ni títulos, ni
campeón, ni popularidad, ni ranking. El efecto está aislado exactamente donde tenía que
estar.

Traducido a los umbrales: −0,77 % sobre 1,37 M son **unos 10.600 pesos menos por carrera**,
o **0,42 puntos de legado** de los ~55 que aporta el dinero. Es chico frente a los escalones
(200 · 500 · 1.000 · 1.800 · 3.000), así que **la recalibración no es urgente**; el que sí se
mueve de verdad es el logro `m1` ($1.000.000), porque la media queda a un 36 % de distancia
y el sesgo se acumula en las carreras largas.
