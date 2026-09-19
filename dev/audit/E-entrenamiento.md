# DOMINIO E — ENTRENAMIENTO Y PROGRESIÓN

> Auditado por el orquestador tras cortarse el subagente por límite de sesión.
> La pregunta central se responde **midiendo**, no leyendo.

## Tabla de entrenamientos → stats

11 claves válidas. No existe `bjj` (es `grap`).

| clave | nombre | stats que sube |
|---|---|---|
| `box` | Boxeo | boxing · accuracy · timing · defense · footwork · speed |
| `kick` | Kickboxing | kicks · muay · timing · power · footwork |
| `muay` | Muay Thai / clinch | muay · clinch · kicks · power · toughness |
| `wrest` | Wrestling | wrestling · **takedowns** · tdd · clinch · power |
| `grap` | Grappling / BJJ | grappling · submission · ground · tdd · composure |
| `cardio` | Cardio | cardio · recovery · footwork · **discipline** |
| `str` | Fuerza y potencia | power · **speed** · recovery · toughness |
| `spar` | Sparring | timing · fightiq · defense · composure · **adaptability** · boxing · wrestling |
| `tech` | Técnica / drills | accuracy · timing · fightiq · footwork · **adaptability** |
| `mind` | Trabajo mental | composure · **confidence** · **patience** · **discipline** · toughness |
| `rest` | Recuperación | recovery |

En negrita las stats que la medición demuestra decorativas en combate.

## Método de medición

Dos pruebas complementarias, ambas sobre el harness:

**1. Proxy de lecturas.** Se sustituye `player.st` por un `Proxy` que registra cada
lectura y se marca si ocurre dentro de una pelea. 6 peleas completas, incluyendo el
dibujado de la pantalla de pelea y la de resultado.

**2. Sensibilidad.** Para cada stat: N peleas con **todas** las stats a 50 y el rival
también a 50, variando sólo la stat estudiada entre 5 y 95. Mismo mundo, mismo rival,
misma semilla. Se mide la diferencia de win rate en puntos porcentuales.
La prueba se corrió **dos veces con políticas de combate distintas** — una fija (siempre la
primera acción) y otra variada (recorre todas las opciones disponibles) — precisamente
porque una política fija puede neutralizar justo la stat que se quiere medir.

## Resultado 1 — qué se lee durante el combate

**24 de 26 stats se leen.** Sólo dos no se leen **nunca** dentro de una pelea:

| stat | lecturas en combate | lecturas fuera |
|---|---|---|
| `discipline` | **0** | 210 |
| `aggression` | **0** | 204 |

Las más consultadas: `cardio` (1337), `footwork` (1244), `fightiq` (895), `power` (550).

## Resultado 2 — qué influye de verdad

Política **fija**, 30 peleas por punto (control: winrate 66,7%):

| veredicto | stats |
|---|---|
| **DECISIVA** (≥15 pp) | footwork 30,0 · composure 30,0 · power 30,0 · defense 26,7 · cardio 23,3 · boxing 23,3 · kicks 23,3 · accuracy 23,3 · timing 23,3 · submission 20,0 · grappling 20,0 · ground 20,0 · fightiq 20,0 · toughness 16,7 |
| influye (5–15 pp) | wrestling 13,3 · tdd 13,3 · recovery 13,3 · muay 6,7 · clinch 6,7 |
| **SIN EFECTO (0,0 pp)** | **takedowns · speed · discipline · confidence · aggression · patience** |
| marginal | adaptability −3,3 |

Política **variada**, 30 peleas por punto (control: winrate 50,0%):

| stat | wr@5 | wr@95 | delta | veredicto |
|---|---|---|---|---|
| power *(control)* | 26,7 | 60,0 | **+33,3** | DECISIVA |
| footwork *(control)* | 30,0 | 53,3 | **+23,3** | DECISIVA |
| patience | 46,7 | 50,0 | +3,3 | marginal |
| takedowns | 46,7 | 46,7 | **0,0** | SIN EFECTO |
| speed | 50,0 | 50,0 | **0,0** | SIN EFECTO |
| discipline | 50,0 | 50,0 | **0,0** | SIN EFECTO |
| confidence | 50,0 | 50,0 | **0,0** | SIN EFECTO |
| aggression | 50,0 | 50,0 | **0,0** | SIN EFECTO |
| adaptability | 53,3 | 53,3 | **0,0** | SIN EFECTO |

Los dos controles conservan su efecto con la política variada, lo que prueba que el arnés
mide de verdad y que el cero de las otras no es un artefacto de la política.

## Hallazgos

### E-001 · Seis stats de 26 no afectan al combate — ALTA · CONFIRMADO
`takedowns`, `speed`, `discipline`, `confidence`, `aggression` y `adaptability` dan **0,0 pp**
de diferencia entre el mínimo y el máximo, con dos políticas de combate distintas.
Dos de ellas (`discipline`, `aggression`) **ni siquiera se leen** dentro de una pelea.

Es casi una cuarta parte de la hoja de atributos. El jugador entrena `wrest` creyendo que
mejora sus derribos (`takedowns`) y `str` creyendo que gana velocidad (`speed`), y ninguna
de las dos cosas cambia el resultado. `mind` sube cuatro stats de las que **tres** son
decorativas (`confidence`, `patience`, `discipline`) y sólo `composure` y `toughness`
influyen — pero `composure` es de las más decisivas, así que el entrenamiento no es inútil:
lo es la lectura que el jugador hace de él.

*Matiz honesto:* «sin efecto sobre el win rate» no es lo mismo que «sin ningún efecto».
Estas stats pueden influir en la narración, en la IA del rival o en sistemas fuera del
combate. Lo medido y afirmado es lo primero.

### E-002 · `adaptability` está en dos entrenamientos y no hace nada — MEDIA · CONFIRMADO
La suben `spar` y `tech`, dos de los entrenamientos que el juego presenta como avanzados,
y su efecto medido es exactamente cero en ambas políticas.

### E-003 · `takedowns` es el caso más engañoso — MEDIA · CONFIRMADO
`wrest` la anuncia como su stat principal y `tdd` (la defensa del derribo, de la misma
tabla) **sí** influye (13,3 pp). Es decir: defenderse del derribo importa y ejecutarlo no.
La asimetría es invisible para el jugador.

## Punto de partida para F7 y F10
El pilar de combate pide que las técnicas cambien **lo que el jugador puede hacer**, no que
sumen stats. Este dominio muestra el otro lado del mismo problema: hay stats que suman y no
cambian nada. Al rediseñar el combate, estas seis son candidatas naturales a **pasar de ser
números a ser condiciones de opción** (p. ej. `takedowns` abriendo entradas de derribo en
la situación de Takedown defense, `speed` acortando ventanas de reacción, `discipline` y
`patience` afectando la fidelidad con que el peleador ejecuta el gameplan).

## No medido
- Efecto de entrenadores, gimnasio y gameplan sobre el combate: **NO MEDIDO**.
- Aportación de los minijuegos de entrenamiento frente al trabajo estándar: **NO MEDIDO**.
- Técnicas TQ (`cl_*`): mapeadas en `dev/audit/D-combate.md` (D-009), sin medir su efecto.
