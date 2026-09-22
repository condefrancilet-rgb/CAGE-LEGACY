# DECISIONES — CAGE LEGACY

Formato: contexto · opciones · elección · motivo · cómo revertir.

---

## D-001 · Rama de trabajo
**Contexto.** El encargo pide trabajar en `cage-legacy-rework`; la sesión venía de
`claude/cage-legacy-scroll-bug-b5vpri`.
**Elección.** Rama `cage-legacy-rework` creada desde el commit `b9480fe`, que ya
contiene la corrección de scroll (I1). Tag `baseline-original` en ese punto.
**Motivo.** I1 declara la corrección de scroll como punto de partida, no como
algo a rehacer. La línea base del encargo es el juego *con* esa corrección.
**Revertir.** `git checkout claude/cage-legacy-scroll-bug-b5vpri`.

## D-002 · Identificación del archivo del juego
**Contexto.** F0.1 pide identificar el archivo real con certeza.
**Hecho.** Un único candidato: `index-4-blindado.html`, el único fichero trackeado
en git (`git ls-files`), sin archivos sin trackear, árbol limpio. No hay ambigüedad.
**Motivo.** Criterios de F0.1 (trackeado / más reciente / referenciado) convergen
en el mismo y único archivo.

## D-003 · Discrepancia de métricas contra documentación previa
**Contexto.** Un informe anterior declaraba 1.527.433 bytes y 28.116 líneas.
**Medido.** Al inicio del encargo anterior: 1.537.617 bytes, 28.115 líneas, md5
`2647c709…`, procedente del commit `532b639 "Add files via upload"` firmado por el
propio usuario, con árbol de trabajo idéntico a HEAD.
**Elección.** Continuar. La procedencia es verificable (commit del usuario, sin
modificaciones sin trackear); las métricas del informe describen una versión
anterior del archivo, no una corrupción.
**Estado actual** (tras la corrección de scroll): 1.538.459 bytes, md5 `f167031e…`.

## D-004 · `render()` no es puro — no se puede stubear en el harness
**Contexto.** Para acelerar la simulación se probó sustituir `render()` por un no-op.
**Medido.** Con render real: huella `05ab9909`, récord 9-3, 12 peleas.
Con render stubeado: huella `53f42e55`, récord 6-3, 9 peleas.
**Elección.** El harness **nunca** sustituye `render()`.
**Motivo.** El renderizador tiene efectos sobre el estado de la simulación
(consume RNG y/o dispara saneamientos). Stubearlo mediría otro juego.
Es además un hallazgo de F1-B: *los renderizadores no son puros*.

## D-005 · La simulación masiva omite sólo `saveSerialize`, nunca `saveGame`
**Contexto.** `saveGame` consume el 62% del tiempo de una carrera.
**Medido.** `saveGame` llama a `savePrune(G)` y dispara `normalizeWorldState`
(25,8 ms × 279 llamadas por carrera de 150 semanas): **muta el mundo**.
Desactivar `saveGame` entero cambia el estado (difieren `fighters`, `news`,
`player`, `cl`). Sustituir sólo `saveSerialize` (la cadena que va a
localStorage) deja la huella **idéntica** (`05ab9909` = `05ab9909`), 1,5×.
**Elección.** `sim.js` sustituye `saveSerialize` por defecto; `--io` lo conserva.
Los golden traces corren siempre con comportamiento completo.
**Revertir.** Pasar `--io` o borrar la línea en `dev/sim.js`.

## D-006 · El autopiloto firma el contrato por la vía real
**Contexto.** Una carrera nueva empieza sin organización: las primeras ofertas
son de contrato y pasan por el minijuego de negociación (`negoStart`).
**Elección.** El autopiloto llama a `negoStart(oferta)` y luego `negoClose()`
—acepta sin regatear— en vez de escribir `G.player.org` a mano.
**Motivo.** Mantiene el camino real del juego: contrato, exclusividad, memoria
del mánager y `rebuildRosters`/`recalcRank`. Escribir el campo a mano habría
producido un mundo que el juego nunca genera.

## D-007 · Semilla del mundo en el harness
**Contexto.** `createDraft()` llama a `syncCreateInputs()`, que repisa el borrador
leyendo inputs del DOM; sin navegador quedan vacíos y `metaSeed` vuelve a 0.
**Elección.** `H.startCareer()` neutraliza `syncCreateInputs` **sólo dentro del
harness** y fija el borrador en `UI.tmp.c`.
**Motivo.** El juego no se toca (I2/«el juego no conoce al harness»). Sin esto la
simulación no sería reproducible por semilla.

## D-008 · H-005: se corrige el compuesto, no el apilado — **decisión del usuario**
**Contexto.** H-005 tiene dos mitades: (a) el reescalado anual compone sobre el valor ya
reescalado, que es exponencial sin techo; (b) el evento `sponsor` (2906) no tiene guarda
`seen()`, así que los patrocinios se apilan sin límite.
**Consulta.** Se planteó que (a) es claramente un bug y (b) **puede ser diseño**.
**Respuesta del usuario:** *"arregla solo el bug de H-005 y segui"*.
**Elección.** Corregido sólo (a). El apilado queda **intacto** y pasa a F14 (economía) como
decisión de diseño, no como defecto.
**Revertir.** El apilado nunca se tocó, así que no hay nada que revertir por ese lado.

## D-009 · Los tags no se empujan — **decisión del usuario**
**Contexto.** El proxy git devuelve `HTTP 403` para refs de tag; la rama sí sube.
**Respuesta del usuario:** *"los tags no importan"*.
**Elección.** Se dejan de intentar. `baseline-original`, `fase-0-ok` y `fase-1-ok` viven
sólo en local; los commits de cada gate quedan identificados en `dev/WORKLOG.md`.

## D-010 · `boot({file})` en el harness para comparar versiones
**Contexto.** Medir el efecto de un arreglo exige un "antes" limpio. Revertir el árbol de
trabajo para cada medición es lento y propenso a dejar restos.
**Elección.** El harness acepta `boot({file})` y carga cualquier versión del archivo
(p. ej. `git show HEAD:index-4-blindado.html`), de modo que dos versiones conviven en el
mismo proceso con las mismas semillas.
**Motivo.** Es lo que permitió demostrar que H-005 **no** causaba la cola de dinero, en vez
de suponerlo. El juego no se entera: es una opción de lectura del arnés.

## D-011 · C-002 no se parchea: necesita la consolidación del cierre de semana
**Contexto.** `mgClose` (4766) y `recPick` (2759) consumen una semana sin volcar
`G.weekLog` al feed y sin llamar a `makeOffers`. Medido: con `recPick` ×3, tres semanas
avanzadas y **0 noticias publicadas**.

**Por qué no se corrige como los otros.** La causa no es una línea olvidada: es que el
cierre de semana —publicar noticias, sortear evento, generar ofertas, guardar— está
**duplicado a mano** en cada llamador de `advanceWeek`. Hay nueve, y cada uno hace un
subconjunto distinto:

| llamador | publica noticias | fireEvent | makeOffers | saveGame |
|---|---|---|---|---|
| `finishWeek` | sí | 42% | 30% | sí |
| `mgClose` | **no** | 42% | **no** | sí |
| `recPick` | **no** | **no** | **no** | sí (GATE) |
| `confirmFight` | **no** | **no** | **no** | sí |
| `gymVisit`/`watchFight`/`travelWith` | **no** | **no** | **no** | sí |
| `advancePeriod` | no (recoge en `sum.news`) | 12% | ahora condicional | sí (GATE, F2-14) |

Añadir las llamadas que faltan a `mgClose` y `recPick` sería **más duplicación**, que es
justo el antipatrón que el encargo prohíbe. Lo correcto es extraer el cierre de semana a
una función con contrato explícito y que cada llamador declare qué parte quiere.

**Elección.** C-002 pasa a ser el **primer punto de la parte estructural de F2**
(`dev/PLAN-F2-consolidacion.md`), no un parche más. Se documenta aquí para que no se
pierda: hoy terminar un minijuego de entrenamiento nunca genera ofertas y nunca publica
las noticias de esa semana.

**Revertir.** No hay nada que revertir: el comportamiento actual queda intacto.

---

## D-012 · Fundir `rollEvent` acepta dos diferencias en el nivel que el juego no recorre

**Contexto.** `rollEvent` tenía cuatro capas encadenadas. Medido: 328 de 328 sorteos de
juego real (8 carreras x 150 semanas) salen por la última; las tres de abajo sólo se
alcanzan con el mazo vacío, y lo que hacen entonces es devolver un evento que cumple
contexto + drama + `c()` **saltándose la veda**. Eso es exactamente un tercer nivel de la
misma escalera, así que caben en una sola función.

**La tensión.** F2 exige consolidar **sin cambiar el juego**, demostrado con golden master
idéntico. Reproducir las tres capas viejas *exactamente* dentro de una función significa
meter dentro tres esquemas de peso distintos y un bucle de doce reintentos: sería una
función única sólo de nombre, y las reglas seguirían escritas más de una vez — que es el
problema que se venía a resolver.

**Decisión.** Se funde a la política declarada de tres niveles y se aceptan **dos**
diferencias, ambas confinadas al nivel 3:

1. el nivel 3 pesa con `eventWeight`, como los otros dos, en vez del peso por
   personalidad de la capa base;
2. si una condición del banco lanza, propaga en vez de contarse como "no cumple" — era un
   `try/catch` que tapaba un error funcional, prohibido por el encargo, y el camino vivo
   nunca lo tuvo.

El **conjunto de candidatos** del nivel 3 es el mismo que devolvían las capas viejas; lo
que puede cambiar es cuál de ellos sale.

**Por qué es aceptable.** El nivel 3 no se alcanza en juego real: 0 de 328 sorteos. El
golden master es idéntico, y `CL.evNivel()` convierte esa afirmación en una prueba
permanente (`07-rollevent.js`) en vez de una medición de una vez.

**Cómo se vigila.** `dev/tests/07-rollevent.js` falla si un sorteo de juego real baja al
nivel 3. Si algún día baja, esta decisión hay que revisarla: dejaría de ser código
inalcanzable.

**Revertir.** `git revert` del commit de fusión devuelve las cuatro capas. No hay estado
guardado que dependa de esto: `CL.evNivel()` no vive en `G`.

---

## D-013 · `pruneWorld` NO se fusiona en F2: la fusión cambia qué luchadores existen

**Contexto.** `pruneWorld` tiene 2 capas y, a diferencia de
`fightFinishResolve`/`sparFinishResolve`, aquí **sí hay duplicación real**: dos conjuntos
`keep` calculados con reglas distintas.

| capa | línea | qué protege |
|---|---|---|
| base | 1421 | jugador, rivales de su `career` y `lastFights`, `nextFight`, `camp`, `fight`, ofertas |
| externa | 18097 | lo que devuelve `CL.tracked()` |

Y la externa **no evita el borrado: lo deshace**. Guarda los tracked antes, deja que la
base los borre, y los vuelve a insertar después. Es el mismo antipatrón que C-002 y que los
cierres de minijuego: el arreglo fue añadir una capa que repara, en vez de darle un dueño a
la regla "a quién no se borra".

**Por qué no se fusiona igual.** Fusionar los dos `keep` en uno calculado antes del borrado
parece el movimiento obvio, pero **cambia qué luchadores sobreviven**:

- El tope de población culpa a `ids.length - 300`. Hoy los tracked que no están en el
  `keep` de la base **sí** entran en el sorteo de culling, se borran, y la capa externa los
  reinserta — dejando la población otra vez por encima de 300. Si se fusionan, quedan
  protegidos y **el culling se lleva a otros en su lugar**. El mundo queda compuesto de
  forma distinta.
- `G.retiredList` se filtra **dentro** de la base (1464), antes de que la externa restaure.
  Medido en 3 carreras x 400 semanas (21 llamadas a `pruneWorld`, ~250 borrados cada una):
  el camino de restauración dispara **2 veces en la seed 13 y 0 en las otras dos**, y cuando
  dispara deja al luchador en `G.fighters` pero fuera de `retiredList`. Fusionar lo
  arreglaría — y eso es un **arreglo**, no un refactor.

**Decisión.** No se toca en F2. Es duplicación real, pero consolidarla es un cambio de
comportamiento observable sobre la composición del mundo, y eso necesita su propia
evidencia. Queda como candidato para **F4** (fuentes de la verdad), junto al dueño único
del cierre de minijuego.

**Cómo se vigila.** Nada todavía: no se escribió red porque no se tocó el código. Si se
aborda en F4, la red tiene que fijar primero qué luchadores sobreviven a un `pruneWorld`
con el mundo por encima de 300 y por encima de 340.

---

## D-014 · `savePrune` sí se consolida, pero sólo el recorrido

**Contexto.** 2 capas: la base trunca listas de los NPC, la externa (`saveCompact`) redondea
decimales. Medido instrumentando cada llamada real durante la carrera —medir el estado
final da 0 y **miente**, porque `savePrune` corre en cada autoguardado y al terminar ya está
todo podado—: **429 llamadas, 3400 campos redondeados, 60 `rel`, 979 arrays truncados, 187
podas de `news`** (seed 13; seed 29 casi idéntica). **Las dos capas hacen trabajo real.**

**Qué estaba escrito dos veces.** No las podas, que son distintas: el **recorrido** y la
regla **"al jugador no se le toca nada"**. Esa regla es la que impide que guardar le
destruya el historial — medido, un jugador de 250 semanas tiene `career`=22 y
`lastFights`=12, y sin ella cada guardado se los dejaría en 12 y 6. Escrita dos veces,
bastaba tocar una copia para perder datos del jugador en silencio.

**Decisión.** Se extrae **sólo** `eachPrunableFighter(g, fn)`. Las dos pasadas siguen siendo
dos: podan cosas distintas y cada una registra sus fallos con su propia etiqueta en
`safeRun`, así que fundirlas en un solo bucle cambiaría el comportamiento del camino de
error (hoy, si la primera lanza, la segunda corre igual).

**Lo que NO se arregló.** `news` y `retiredList` no se podan si falta `g.fighters`, porque
cuelgan del mismo guardia que el recorrido. Es una rareza latente, fijada por prueba para
que una fusión no la corrija sin querer; arreglarla es cambio de comportamiento.

---

## D-015 · Los tres minijuegos de entrenamiento NO se fusionan: la capa viva ya es una sola función

**Contexto.** `cardioStart`, `strStart` y `drillStart` tienen **3 capas** cada una y el
plan las marcaba como candidato "con cuidado, porque GATE las envuelve".

| capa | línea | qué hace |
|---|---|---|
| 1 base | 2473 / 2501 / 2526 | construye `G.mg = {type:'cardio'\|'str'\|'drill', ...}` |
| 2 arcade | 6721 / 6727 / 6656 | llama a la base y le parchea campos (`targets`, `load`, `colorMap`) |
| 3 TG | 10808-10810 | `tgStart('cardio', _tgCardioPrev)` — las anteriores pasan como **respaldo** |

Más una cuarta sobre `tgStart` (22053) que sólo añade la guarda de doble toque (`mgBusy`).

**La forma es la de `rollEvent`: las capas viejas son el camino de respaldo.** Y hay un
discriminador limpio para medirlo — `tgStart` produce `G.mg.type==='train'`, el respaldo
produce `'cardio'`, `'str'` o `'drill'`.

**Medición.** Conduciendo los tres arranques a mano (el autopiloto no pulsa botones de
minijuego), 40 mundos x 3 arranques: **120 de 120 por `tgStart`, 0 por el respaldo**.

Y algo más fuerte que muestrear, porque el respaldo se dispara si `tgPick` devuelve una
clave sin `TG_INFO` o sin `FX_GAMES`: se comprobaron **todas** las claves, no una muestra.
`TG_INFO` tiene 25 claves y **las 25 tienen juego FX**; los tres pools alcanzan 5, 5 y 15
claves y **ninguna queda sin cobertura**. El respaldo es **inalcanzable por construcción**;
lo único que puede dispararlo es que `fxOpen` falle en runtime.

**Decisión: no se fusionan.** Aplicando la pregunta del encargo —¿hay alguna regla escrita
dos veces?— la respuesta en el camino vivo es **no**: `tgStart(pool, fallback)` ya es una
sola función parametrizada, y las tres líneas 10808-10810 son tres llamadas con distinto
argumento, no tres copias. Lo que hay debajo son tres minijuegos **distintos** conservados
como recuperación de error, no tres copias del mismo.

Fundirlos sería borrar un camino de recuperación, que es cambio de comportamiento, no
consolidación.

**Lo que sí se hace.** Anotar la alcanzabilidad **en el archivo**, como ya se hizo junto a
`rollEvent` (línea 3100), para que el próximo lector no tenga que volver a medirlo y no
confunda código de respaldo con código vivo.

**Inconsistencia anotada, no tocada.** En la capa arcade, `cardioStart` y `strStart` llaman
a `render()` y `drillStart` no. Vive en el camino inalcanzable, así que no tiene efecto hoy;
si alguna vez se recorre, el drill no redibuja.

---

## D-016 · El cierre de intercambio no se extrae: lo compartido ya se extrajo

**Contexto.** Punto 4 de la cola (marcado opcional): "cierre de intercambio en un solo
sitio, con el coste de reloj como parámetro".

**Qué queda compartido, después de F2-19.** La regla que de verdad estaba escrita tres
veces era `f.ex >= f.exPer || f.clock<=20`, y ya vive en `roundOver(f)`. Lo que queda común
a los tres cierres son **dos sentencias**: `f.ex++` y el descuento de reloj — y el descuento
usa tres constantes distintas que, por decisión explícita, **no se igualan** (es balance,
F14).

**Lo que NO es común.** Todo lo demás difiere, y no por descuido:

| | `fightAct` | `fightFinishResolve` | `TQ.apply` |
|---|---|---|---|
| KO | si alguien cae, **ni cierra round ni redibuja** | **no lo comprueba** | `finishFight` y sale |
| drain | dentro de `resolveExchange` | `drain('p', 10\|9)` | `drain` 1,2 a ambos |
| render | dentro del guardia de KO | siempre | `if(typeof render==='function')` |
| hooks | `exchange:pre/post` + `act:post` | ninguno | ninguno |

**Decisión: no se extrae.** Un `closeExchange(lo, hi)` capturaría dos sentencias triviales y
dejaría tres colas distintas en los llamadores. Eso es renombrar, no consolidar — la misma
prueba que dejó fuera a `fightFinishResolve`/`sparFinishResolve` (precedente del encargo).

**Comprobado de paso, no arreglado.** Que `fightFinishResolve` no compruebe KO es inocuo:
en ese camino nada baja la vida. Lo único que toca es `drain`, y `drain` sólo modifica
`stam` —`G.fight[side].stam = clamp(...)`—, nunca `hp`. Queda dicho para que nadie lo
"arregle" creyendo que es un hueco.

---

## D-017 — Los dos sistemas de foco de entrenamiento: los dos están vivos, y no se pisan

**La pregunta.** El inicio tenía **dos** bloques de foco de entrenamiento a la vez: uno de
36 botones (`focusSet`) y otro de 10 (`clSetFocus` + `clSetSpend`). Antes de decidir dónde
vive cada uno hay que saber si los dos hacen algo, y si uno anula al otro. Si uno estuviera
muerto o pisara al otro, sería un bug para E5, no una cuestión de maquetación.

**No se dedujo leyendo: se midió.** `dev/focos.js`, 12 semillas por pregunta, dos brazos
idénticos salvo el ajuste que se mide, misma semilla en los dos. Se compara la foto de los
stats del jugador más fatiga y daño, antes y después.

| pregunta | resultado |
|---|---|
| **A** (`focusSet` → `G.focus`) cambia un bloque de 13 semanas | **SÍ — 12/12 carreras** |
| **A**: la carga (ligera/dura) cambia el bloque | **SÍ — 12/12** |
| **B** (`clSetFocus` → `CL.S().focus`) cambia una semana suelta | **SÍ — 12/12** |
| **B** también se aplica **dentro** de un bloque | **SÍ — 12/12** |
| **A** se aplica a una semana suelta | **NO — 0/12** |

Ejemplo de la primera: con foco `box/box/box` contra `wrest/wrest/wrest`, misma semilla,
el bloque de 13 semanas deja `boxing 47` contra `39` y `wrestling 44` contra `51`.

**Qué son en realidad.** No son dos sistemas que compiten: son **dos ejes de un mismo
sistema**, y cada uno lo lee un consumidor distinto.

- **A decide QUÉ se entrena** cuando el tiempo pasa en bloques. Lo leen `focusWeights()` y
  `loadMult()`, y a esos **sólo los llama `advancePeriod()`**.
- **B decide CÓMO se entrena** cada acción: multiplicador, fatiga, riesgo y el gasto
  semanal. Lo lee el enganche `CL.on('train','enfoque')`, que corre en **toda** acción de
  entrenamiento — también en las que el bloque dispara por dentro.

Por eso B se aplica dentro del bloque y A no se aplica a la semana suelta: no es que uno
pise al otro, es que **componen**. En un bloque, A elige las tres disciplinas y la carga, y
B modula cada una de esas semanas.

**Decisión: ninguno es un bug, y NO se funden en E3.** E3 movió los dos a `train` sin
tocarles una línea de lógica. Fundirlos sería cambiar comportamiento, y encima borraría una
distinción que existe de verdad.

**Lo que sí queda anotado, y es de diseño, no de código:** un jugador que nunca usa
«1 mes / 3 meses / 1 año» **nunca usa el sistema A**. El bloque más grande que tenía el
inicio (1.143 px, 36 botones) gobernaba únicamente el camino de los bloques. Eso refuerza
la mudanza, no la contradice. Si algún día se quiere que A pese siempre, es una decisión de
balance (F14), no una consolidación.
