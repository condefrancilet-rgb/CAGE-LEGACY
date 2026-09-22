# PENDIENTES — decisiones que no son mías

Cada una con su medición y mi recomendación. Nada de esto está tocado en el código.

---

## P-1 · `hookRun` aísla los fallos de enganche y eso deja escrituras parciales

**Medido** (`dev/e5-hooks.js`, sin tocar el archivo del juego — se envuelve `hookRun` desde
fuera):

1. **Cero fallos aislados** en 4 carreras × 300 semanas. La política no está tapando nada
   en juego normal.
2. **Sí deja escrituras parciales.** Con un enganche semanal que escribe un campo y revienta
   justo después: la popularidad pasó de **7,69 a 12,49** (la primera escritura quedó
   aplicada), la semana **avanzó igual** y `G.hookFails` subió a 1. La segunda mitad del
   enganche nunca corrió.

**Por qué no lo toqué.** No es un bug del rollback —el rollback ni se dispara— es el precio
de la política deliberada de aislar (`HOOK_ABORT` enumera los seis eventos que sí abortan).
Cambiarla es una decisión de diseño del blindaje.

**Mi recomendación: dejarlo como está, y hacer visible el contador.** Con 0 fallos en 1.200
semanas, envolver cada enganche en su propia transacción costaría un snapshot por enganche
—el mismo coste que E4 no pudo bajar— para proteger algo que no ocurre. Lo barato y honesto
es que `G.hookFails > 0` aparezca en la pantalla de diagnóstico, para que si algún día pasa,
se vea. Las otras dos opciones, por si preferís otra: (b) transacción por enganche, caro;
(c) mover a `HOOK_ABORT` los eventos que escriben estado del jugador, que convierte cualquier
fallo de un módulo en la pérdida de la semana entera.

---

## P-2 · `TX.snapshot` es el 40,7 % de `advanceWeek` y no tiene arreglo seguro

**Medido** (`dev/perf/perfil.json`, `dev/perf/baseline.js`):

| qué | resultado |
|---|---|
| serializaciones grandes por semana | **1**, de 975 KB — no hay trabajo duplicado que quitar |
| peso del estado | **91,6 % son los peleadores**; y **384 de 414 cambian cada semana** |
| `structuredClone` en vez de JSON | **más lento**: 9,45 ms contra 5,78 |
| aplanar los objetos de peleador | 6,19 → **3,82 ms**… que se degrada solo: 4,11 a las 5 semanas y **6,27 a las 25** |

Y rehacer los objetos en caliente rompe la identidad de `G.player` con el plantel — que es
exactamente el bug que atrapó el mutante MR7 de la red de rollback.

**Quedan dos caminos, los dos con coste:**

- **(a) Subir la transacción a `advancePeriod`**: un snapshot por bloque en vez de uno por
  semana. Ahorra 12 de 13 snapshots cuando el jugador salta tres meses. **Precio:** si algo
  falla en la semana 7 de un bloque de 13, se deshacen las 13, no una.
- **(b) Escritura con barrera (copy-on-write por peleador)**: sería el arreglo de verdad,
  pero exige interceptar toda mutación de peleador en 28.000 líneas.

**Mi recomendación: (a), y sólo si el rendimiento molesta de verdad en un teléfono real.**
Hoy `advanceWeek` está en 14,25 ms: una semana se procesa en un sexto de fotograma. El
rollback de un bloque entero es un cambio que el jugador puede notar; el ahorro, no.

---

## P-3 · Los enganches en 2 de los 3 cierres de intercambio

Heredado de F2. Los tres cierres de intercambio de combate (`fightAct`, `fightFinishResolve`,
`TQ.apply`) comparten dos sentencias y **divergen en todo lo demás**, incluidos los hooks:
`fightAct` emite `exchange:pre/post` y `act:post`; los otros dos no emiten ninguno.

**No se toca: es balance.** Emitir los hooks en los tres cambiaría lo que ocurre dentro de
una pelea, que es justo lo que el encargo manda a F14.

**Mi recomendación: dejarlo, y anotarlo también en F14.** Si algún día se unifica, tiene que
ser con un A/B pareado de 1.000+ carreras, porque toca el motor de combate.

---

## P-4 · La limpieza defensiva de FX

Heredado de E2. `mgExit`/`go()` limpian el overlay de FX "por si acaso". El encargo dice que
sólo se retira **con una prueba de que el dueño cubre el fallo**.

**Estado: no se retira, y la prueba no existe todavía.** Escribirla exige conducir a mano el
minijuego de finalización hasta un fallo del canvas, que es el mismo trabajo que P-5.

**Mi recomendación: dejarla.** Cuesta tres líneas y cubre el caso que el golden master no
recorre.

---

## P-5 · `fightScreen` no se une a `go()`

Heredado de E2. `go()` emite `nav`, y ese hook **descarta `G.mg`**: en mitad de una pelea eso
destruiría el minijuego de finalización. Por eso `fightScreen` existe como excepción con
nombre.

**Estado: no se une.** Unirla exige una prueba que conduzca a mano el minijuego de
finalización y demuestre que sobrevive — el camino que ni el autopiloto recorre ni el golden
master valida.

**Mi recomendación: dejarlo hasta tener esa prueba.** Es el peor sitio posible para un cambio
no verificable.

---

## P-6 · Balance: todo lo de `dev/F14-BALANCE.md`

Nueve entradas, cada una con su medición. La más cara de decidir sigue siendo la **tasa de
campeones** tras el cambio de agresividad: −2,00 pp con IC pareado **[−5,10, 1,10]**, y para
demostrar equivalencia a ±5 pp con 80 % de potencia hacen falta **~1.048 carreras pareadas
por brazo**, en una corrida nueva con el n fijado de antemano.
