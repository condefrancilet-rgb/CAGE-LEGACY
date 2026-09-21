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

| n por brazo | % campeones antes → después | IC95 de la diferencia |
|---|---|---|
| 200 | 85,50 → 82,50 | [−10,33, 4,33] |
| 500 | 81,00 → 79,00 | [−7,06, 3,06] |

**No concluyente en ambos.** El win rate **sí** resultó equivalente a n=500 (IC
[−0,98, 1,55] dentro de ±2 pp), así que la suma cero se sostiene donde importa.

Decidirlo exigiría ~2.200 carreras por brazo. **Pregunta abierta:** ¿molesta que la tasa de
campeones pueda bajar ~2-3 pp a cambio de que un atributo deje de ser decorativo?

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
