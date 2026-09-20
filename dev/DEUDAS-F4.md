# Entrada a F4 — fuentes de la verdad

> Lo que F2 encontró **y decidió no tocar**, porque arreglarlo cambia comportamiento
> observable y eso necesita su propia evidencia, no un refactor. Cada entrada trae la
> medición con la que se descartó, para no tener que volver a medirla.

Todas comparten la misma forma, que es la que F2 vio repetirse cinco veces: **una regla sin
dueño, y encima una capa que repara en vez de evitar.** Es el patrón de C-002 (nueve
llamadores de `advanceWeek`, cada uno con su subconjunto del cierre de semana).

---

## 1. `pruneWorld`: dos conjuntos `keep` y uno deshace al otro — D-013

| capa | línea | qué protege |
|---|---|---|
| base | 1421 | jugador, rivales de su `career` y `lastFights`, `nextFight`, `camp`, `fight`, ofertas |
| externa | 18097 | lo que devuelve `CL.tracked()` |

La externa **no evita el borrado: lo deshace**. Guarda los tracked, deja que la base los
borre y los reinserta.

**Por qué no se fusionó.** Cambia **qué luchadores existen**. El tope de población culpa a
`ids.length - 300`: hoy los tracked fuera del `keep` de la base entran en el sorteo, se
borran, y la reinserción deja la población otra vez por encima de 300. Fusionados quedan
protegidos y **el culling se lleva a otros en su lugar**.

**Medido.** 3 carreras x 400 semanas = 21 llamadas, ~250 borrados cada una. El camino de
restauración dispara **2 veces en la seed 13, 0 en las seeds 29 y 47**.

**Qué hace falta antes de tocarlo.** Una red que fije **qué luchadores sobreviven** a un
`pruneWorld` con el mundo por encima de 300 y por encima de 340. Sin eso no hay forma de
distinguir un arreglo de una regresión.

---

## 2. `G.retiredList` es estado de sólo escritura — A-012

Cinco apariciones en todo el archivo y **ninguna es una lectura**: se crea (999), se le hace
`push` al retirarse alguien (1357), `pruneWorld` la filtra (1464), `savePrune` la recorta a
60 (12726), `saveCompact` le redondea los decimales (14023).

Nada la consume. Se mantiene, se poda, se normaliza y **viaja en el save**.

**Consecuencia medida.** Ninguna sobre el juego. Sí sobre el coste: cada guardado recorre y
normaliza una lista que no sirve.

**Decisión pendiente.** O se le da un consumidor —una pantalla de retirados, que el juego no
tiene— o se retira del estado **con su migración**, porque está en el save (I3).

---

## 3. El cierre de minijuego no lo posee nadie — adenda F2 de `B-navegacion-render.md`

`G.mg` tiene **30 escritores**: 11 abridores construidos en línea, cada uno con su propia
forma y sin constructor compartido, tres genéricos, y el resto cierres.

**Cerrar un minijuego y decidir a qué pantalla se vuelve está escrito en seis sitios con
tres respuestas distintas:**

| líneas | a dónde vuelve |
|---|---|
| 8409, 11052 | `(G.fight && !G.fight.over) ? 'fight' : 'hub'` |
| 11049 | `'train'` |
| 14487, 14532, 15077 | `'hub'` incondicional |

Y hay cierres que no deciden pantalla: 4842, 8464, 8470, 8474, 17708, 22051.

**El síntoma que ya costó un parche.** La capa FX de `fightFinishResolve` (8460) lleva una
limpieza defensiva porque, al fallar la finalización, quedaba `G.mg` vivo y la pantalla en
`'mg'`, obligando a pulsar CONTINUAR en bucle. El arreglo fue **añadir un séptimo cierre**
en vez de darle dueño al cierre.

**Por qué es F4 y no F2.** Toca `UI.screen`, que tiene 37 escrituras directas y es el
terreno de la máquina de estados.

---

## 4. `saveGame` está acoplado a `normalizeWorldState` — F-005 / A-006

**Guardar muta el mundo vivo.** Sobre el `G` en curso, no sobre una copia: poda
`lastFights` a 6, `mem` a 8 y `career` a 12 de todos los NPC, `news` a 40 y `retiredList` a
60.

**Medido en F2-20.** No es teórico: **429 llamadas a `savePrune` por carrera**, 3400 campos
redondeados, 979 arrays truncados. El jugador se salva sólo porque hay una regla explícita
que lo excluye — y esa regla estaba escrita dos veces hasta F2-20.

**Por qué es F4.** Desacoplarlo cambia comportamiento observable: el mundo dejaría de
encogerse al guardar.

---

## Lo que F2 sí dejó listo para esto

- `dev/tests/09-saveprune.js` fija qué poda `savePrune` hoy, incluida la rareza de que
  `news` y `retiredList` no se podan sin `g.fighters`. Una fusión futura no la puede
  "arreglar" en silencio.
- `eachPrunableFighter` es el único sitio donde vive "al jugador no se le toca nada".
- `dev/tests/08-intercambio.js` conduce a mano `TQ.apply` y `fightFinishResolve`, que el
  autopiloto no pisa.
- `CL.evNivel()` es el precedente a copiar: convertir una medición puntual en prueba
  permanente.

## Trampas del instrumento, pagadas en F2

1. **Medir el estado final miente** cuando la función corre en cada autoguardado. `savePrune`
   daba 0 redondeos al final de la carrera y 3400 instrumentando cada llamada.
2. **`metaSeed` fijo** hace que "N seeds" sean N copias de la misma muestra.
3. **El autopiloto no pisa** el minijuego de finalización ni el árbol de técnicas. Lo que el
   golden master no recorre, no lo valida.
4. **Los mutantes van en un script con los literales dentro**, nunca por la línea de
   órdenes: el escapado del shell los silencia y las pruebas salen verdes sin mutante.
