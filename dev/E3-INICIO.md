# E3 — Reorganizar el inicio · INVENTARIO Y MAPA PROPUESTO

> **ESTADO: E3 CERRADO.** El mapa se aprobó y está implementado. Lo de abajo es el
> inventario y el mapa tal como se enviaron, sin retocar; el resultado medido está en
> la sección 11, al final, y el relato en `dev/CHANGES.md`.

Todo lo de acá está medido, no argumentado. Herramientas y salidas:

| herramienta | qué mide | salida |
|---|---|---|
| `dev/perf/pantalla-dom.js` | alto de `title` y `hub` en 3 resoluciones | `dev/perf/pantalla-dom.json` |
| `dev/perf/hub-inventario.js` | bloque por bloque del inicio + captura | `dev/perf/hub-inventario-*.json`, `dev/perf/hub-360x640.png` |
| `dev/perf/pantallas-todas.js` | alto de **todas** las pantallas a 360×640 | `dev/perf/pantallas-todas.json` |

---

## 1. En este juego hay DOS pantallas que se llaman "inicio"

- **`title`** — la portada. Es adonde llevan los **seis** botones *"Volver al inicio"*
  (líneas 5383, 5482, 8960, 8998, 13849, 14261 de `index-4-blindado.html`).
- **`hub`** — la semana en curso. Es adonde lleva el botón **◉ Inicio** de la barra inferior.

Medidas (alto del documento ÷ alto del viewport):

| pantalla | estado | 360×640 | 390×844 | 412×915 | nodos | botones | <44 px |
|---|---|---|---|---|---|---|---|
| `title` | virgen (sin partidas) | **1,47** | 1,10 | 1,00 | 23 | 6 | 0 |
| `title` | con carrera guardada | **1,58** | 1,18 | 1,07 | 25 | 7 (+5 de la barra oculta) | 0 |
| `hub` | semana normal | **8,84** | 6,35 | 5,64 | 327 | 76 | 38 |
| `hub` | semana de pelea (save congelado) | 8,34 | — | — | 329 | 42 | 0 |

**Veredicto de `title`:** pasa de 1,5 pantallas, pero **sólo a 360×640 y sólo en el
estado con carrera** (1,58 = 1.013 px contra 960 px de umbral: **se pasa por 53 px**).
Entra en E3 por la regla, pero no tiene un problema de densidad: son 25 nodos y 7
botones. Se arregla con un retoque, no con una reorganización (§5).

**El problema es `hub`:** 8,84 pantallas, 327 nodos, **76 botones** (71 en la pantalla
+ 5 en la barra inferior) y **38 por debajo de 44 px** de alto, el mínimo táctil: los
**33** del bloque *Foco de entrenamiento* (miden 38 px) más los **5 de la barra inferior**.
Mover ese bloque se lleva 33 de los 38; los 5 de la barra son otra discusión (E5).
Y 8,84 es un **piso**, no un techo:
hay 22 tarjetas registradas y en una semana normal dibujan 13. Seis
(`ufc`, `peso`, `sagas`, `observado`, `content_team`, `instalaciones`) no las vi dibujar
en ninguno de los dos estados medidos; cuando aparezcan, el inicio crece más.
La séptima muda, `deuda`, lo es **a propósito**: una consolidación anterior la dejó en
`return ''` (`:22243`) porque el aviso de deuda lo da la barra `DEBTBAR` (`:22228`), que
es la franja roja del principio de la captura. No es una tarjeta dormida.

---

## 2. Inventario medido del inicio (semana normal, 360×640, 5.655 px)

Los bloques 0–7 los dibuja el hub base; del 8 al 20 son tarjetas registradas con
`CL.hubCard(id, fn, orden)` y las compone el núcleo en `index-4-blindado.html:17996`.

| # | px | % | tarjeta | bloque | botones |
|---|---|---|---|---|---|
| 0 | 55 | 1,0 % | — | topbar (nombre · semana · dinero) | 0 |
| 1 | 296 | 5,2 % | — | Estadísticas clave de tu estilo | 0 |
| 2 | 152 | 2,7 % | — | récord `0-0 (0 KO · 0 SUB · 0 DEC)` | 0 |
| 3 | 145 | 2,6 % | — | Ofertas sobre la mesa | 1 → `offers` |
| 4 | 256 | 4,5 % | — | rejilla de 6 accesos | 6 → `train` `stats` `rank` `people` `gym` `contracts` |
| 5 | **1.143** | **20,2 %** | — | Foco de entrenamiento | **36** → `focusSet` ×33 + carga ×3 |
| 6 | 191 | 3,4 % | — | Dejar correr el tiempo | 3 → `advancePeriod(4/13/52)` |
| 7 | 316 | 5,6 % | — | El mundo (noticias) | 1 → `history,news` |
| 8 | 240 | 4,2 % | `identity` | Peleador completo · DESARROLLO | 1 → `clcareer` |
| 9 | 153 | 2,7 % | `finanzas` | 💰 Gasto semanal | 0 |
| 10 | **532** | **9,4 %** | `decisiones` | Cómo estás trabajando | **10** → `clSetFocus` ×6 + `clSetSpend` ×4 |
| 11 | 160 | 2,8 % | `tecnicas` | ⚡ Técnicas especiales | 1 → `tq` |
| 12 | 141 | 2,5 % | `meta` | 🎯 Tu carrera | 2 → `bio` `challenges` |
| 13 | 237 | 4,2 % | `auto_advance` | ⏩ Tiempo | 1 → `autoAdvanceToImportant` |
| 14 | 180 | 3,2 % | `circulo` | Tu círculo | 2 → `social` `chatStart` |
| 15 | 261 | 4,6 % | `publico` | Quién te sigue | 0 |
| 16 | 181 | 3,2 % | `historia` | 📖 Tu historia | 1 → `story` |
| 17 | 96 | 1,7 % | `inversion` | Invertir / Gimnasios | 2 → `shop` `gyms` |
| 18 | 160 | 2,8 % | `casino` | 🎰 Casino | 1 → `CAS.enterScreen()` |
| 19 | 244 | 4,3 % | `threads` | Tu mundo | 1 → `clcareer` |
| 20 | 199 | 3,5 % | `legado` | Legado | 2 → `hall` `retire` |

Bloques que sólo vi en carrera avanzada (save congelado, 2018/47, 7-4):

| px | tarjeta | bloque | botones |
|---|---|---|---|
| 191 | — | PRÓXIMA PELEA · SEMANA DE PELEA | 1 → `weighStart()` |
| 366 | `pilares` | Pilares del campamento | 4 → `clTogglePillar` |
| 386 | `vida` | Vida y prensa | 5 → `fameStart` ×5 |

**Total del inventario: 82 acciones distintas** (onclick únicos) entre los dos estados.
En el navegador salieron 81; la 82.ª (`skipWeek()`) aparece en un estado que el harness sí
alcanza. El fixture se queda con la unión, que es la lista más larga.
Ésa es la lista que la prueba de "nada se pierde" usa de fixture.

**Captura del inicio a 360×640:** `dev/perf/hub-360x640.png` (360 × 5.655 px, página completa).

---

## 3. Qué dicen los números que hay que arreglar

1. **Dos bloques son el 30 % del inicio** y los dos son **configuración**, no decisión
   semanal: *Foco de entrenamiento* (1.143 px, 36 botones) y *Cómo estás trabajando*
   (532 px, 10 botones). Se eligen una vez y se miran cada tanto.
2. **33 de los 38 botones por debajo de 44 px están en ese mismo bloque de foco** (miden
   38 px de alto). Los otros 5 son los de la barra inferior. Mover el bloque se lleva el
   87 % del problema táctil con él.
3. **La rejilla de 6 accesos (#4) duplica la barra inferior**: `train`, `rank`, `people`
   ya están en la barra como *Entrenar · Ranking · Gente*.
4. **Dos tarjetas distintas llevan al mismo sitio**: `identity` (#8) y `threads` (#19),
   las dos a `clcareer`.
5. **Hay sitio adonde mover.** Alto a 360×640 de los destinos candidatos:
   `train` 3,08 · `people` 2,68 · `contracts` 1,84 · `menu` **1,43** · `rank` 1,02.

---

## 4. Mapa propuesto para `hub`

**Criterio único:** el inicio contesta *"¿qué hago esta semana?"*. Todo lo que no sea
estado que necesitás ver ahora, o una decisión de esta semana, se va — **pero no
desaparece**: cada una de las 81 acciones conserva al menos un camino.

### Queda en el inicio (objetivo ≤ 1,5 pantallas a 360×640)

| bloque | por qué | cambio |
|---|---|---|
| topbar | encabezado | + el récord (#2) comprimido a una línea |
| Ofertas sobre la mesa (#3) | decisión de la semana | igual |
| PRÓXIMA PELEA / Pesaje | decisión de la semana | igual |
| Vida y prensa (`vida`) | son las actividades que consumen la semana | igual |
| Avanzar | funde *Dejar correr el tiempo* (#6) + ⏩ *Tiempo* (`auto_advance`) | 4 botones en un bloque |
| Foco (resumen) | una línea *"Boxeo · Wrestling · Cardio · carga normal"* + 1 botón a `train` | de 1.143 px a ~90 px |
| El mundo (resumen) | el titular más reciente + 1 botón a `history` | de 316 px a ~60 px |
| Avisos | las 7 tarjetas hoy mudas (`peso`, `deuda`, `observado`, …) siguen apareciendo acá cuando tengan algo que decir | igual |

### Se va, y adónde

| bloque | destino | por qué |
|---|---|---|
| Estadísticas clave del estilo (#1) | `stats` (2,92 pantallas, **0 botones**) | es una ficha, no una decisión |
| Rejilla de 6 accesos (#4) | la barra inferior ya cubre `train`/`rank`/`people`; `stats`, `gym` y `contracts` pasan a `menu` | duplicado |
| **Foco de entrenamiento (#5)** | **`train`** | es la pantalla de entrenar; tiene sitio (3,08) y se lleva los 33 botones chicos |
| **Cómo estás trabajando (`decisiones`)** | **`train`** | enfoque y gasto son configuración |
| Gasto semanal (`finanzas`) | **`train`**, pegado a donde se elige el gasto | hoy el dato está separado del control |
| Pilares del campamento (`pilares`) | **`train`** | preparación, no decisión semanal |
| Técnicas especiales (`tecnicas`) | `train` · en el inicio **sólo si hay puntos sin gastar** | aviso, no acceso fijo |
| Tu círculo (`circulo`) | `people` (2,68) | es gente |
| Quién te sigue (`publico`) | `bio` | es tu ficha pública |
| Tu carrera (`meta`) | `menu` (1,43 — el más vacío) | archivo |
| Tu historia (`historia`) | `menu` | archivo |
| Invertir / Gimnasios (`inversion`) | `menu` | tienda |
| Legado (`legado`) | `menu` | archivo + retiro |
| Peleador completo (`identity`) + Tu mundo (`threads`) | `menu`, **un solo acceso a `clcareer`** | mismo destino, dos tarjetas |
| 🎰 Casino (`casino`) | `menu` | ver la nota de frontera abajo |

**Cuenta estimada del inicio después:** ~840 px ≈ **1,3 pantallas** a 360×640,
con **0 botones por debajo de 44 px**. Es una estimación de la suma de bloques, no
una medición: se mide de verdad cuando esté implementado, con la misma herramienta.

---

## 5. Mapa propuesto para `title` (se pasa por 53 px)

No se reorganiza. Se hace lo mínimo para bajar de 1,5 pantallas sin perder nada:

- Los dos párrafos de **"Cómo funciona"** pasan a un desplegable cerrado por defecto.
  Son ~150 px; con eso `title` queda en ~0,85–1,3 pantallas en las tres resoluciones.
- Nada más. Los botones se quedan donde están: **seis** en la portada virgen
  (Empezar · Salón de la fama · Desafíos · Logros · Récords · Race) y **siete** con
  carrera guardada (se suma *Cargar partida*).

---

## 6. Fronteras que este mapa respeta

- **CASINO: NO TOCAR.** La tarjeta se registra **dentro** del módulo 33
  (`index-4-blindado.html:23610`), así que **no se edita esa línea**. Lo que cambia es
  el **compositor del hub**, que está en el núcleo (`:17996`) y decide qué tarjetas
  dibuja el inicio y cuáles dibuja `menu`. La `fn` del casino se sigue llamando tal
  cual y `CAS.enterScreen()` no se toca. Es exactamente el "se puede proteger desde
  fuera" de la frontera. **Si al implementarlo hiciera falta cambiar una línea del
  módulo 33, la tarjeta del casino se queda en el inicio** (son 160 px de 5.655).
- **Sin frameworks ni dependencias nuevas**; un solo archivo; `file://`.
- **Nada de `eval`** para el despacho de tarjetas: el compositor ya es una tabla.
- **I1 (scroll):** mover bloques no agrega ni un `window.scrollTo` nuevo. El ratchet
  de `dev/tests/02-scroll.js` sigue en 3 escrituras.
- **Balance intacto:** no se cambia ni un número. Mover un botón no cambia qué hace.

---

## 7. Cómo se demuestra que no se pierde nada — YA ESTÁ, Y YA SE VERIFICÓ

La red está escrita y en verde **antes** de tocar la interfaz:

- `dev/make-inventario.js` congela el inventario a mano → `dev/fixtures/e3/inventario-inicio.json`
  (**82 acciones**: 41 sólo en semana normal, 12 sólo en semana de pelea, 29 en las dos).
  No se regenera en la suite: un fixture que se regenera solo se adapta a lo que rompiste.
- `dev/tests/13-inventario.js`, 4 pruebas:
  1. el fixture existe, tiene ≥ 82 acciones y declara su `alcance`;
  2. **cada acción del inventario sigue alcanzable** desde las pantallas del `alcance`,
     en los dos estados; falla **nombrando la acción que desapareció**;
  3. ninguna pantalla del `alcance` queda a **más de dos toques** del inicio;
  4. el fixture cubre las dos caras del inicio (si alguien lo regenera desde un solo
     estado, la red pasa a proteger la mitad y esto lo delata).

Hoy `alcance: ["hub"]`. E3 lo va ampliando a los destinos del mapa; la prueba 3 impide
que "mover" se convierta en "enterrar".

**Verificación con mutantes** (`CAGE_FILE` apunta la red a una copia mutada; el archivo
del juego no se toca — md5 igual antes y después):

| mutante | resultado |
|---|---|
| borrar la tarjeta del casino del inicio | **ROJO** — "desaparecieron 1 acciones" |
| romper el emisor del foco de entrenamiento | **ROJO** — 33 acciones, empezando por `focusSet('a','box')` |
| borrar el acceso a Contratos de la rejilla | **ROJO** — `go('contracts')` («Contratos») |
| borrar el botón del pesaje (sólo semana de pelea) | **ROJO** — confirma que el segundo estado se mide |
| mover la tarjeta `legado` sin ampliar el `alcance` | **ROJO** — `go('hall')`, `go('retire')` |
| meter en el `alcance` una pantalla a >2 toques (`race`, `ach`) | **ROJO** |
| meter en el `alcance` una pantalla inexistente | **ROJO** |
| recortar el fixture a un solo estado | **ROJO** |

Dos mutantes que escribí primero (`focusSet('a','box')` y `go('contracts')` como texto
literal) **no existían en el fuente** —los botones se emiten con comillas escapadas— así
que tocaban código que el inicio no dibuja. Se descartaron por inválidos y se rehicieron
contra el emisor real. Un mutante que no muta lo que creías no prueba nada.

---

## 8. Decisiones que dejo marcadas, no tomadas

| # | qué vi | opción conservadora que tomo si no decís otra cosa |
|---|---|---|
| 1 | **Hay dos sistemas de foco de entrenamiento vivos a la vez** en la misma pantalla: `focusSet('a'/'b'/'c', …)` + carga (36 botones) y `clSetFocus(…)` + `clSetSpend(…)` (10 botones). | E3 **mueve los dos a `train` sin fundirlos**. Fundirlos cambia comportamiento → es F14/decisión aparte, no E3. |
| 2 | `identity` y `threads` llevan las dos a `clcareer`. | Se mueven las dos a `menu` y se deja **un** acceso. Si preferís conservar las dos tarjetas, se conservan. |
| 3 | La tarjeta del casino. | Se mueve desde el compositor (§6). Si eso no se pudiera sin tocar el módulo, se queda. |
| 4 | **`story` mide 9,95 pantallas — más que el inicio.** Y `gym` 8,35. | **Fuera del alcance de E3**, que es el inicio. Queda anotado para E5. |
| 5 | `stats` tiene 323 nodos y **0 botones**: es un callejón sin salida. | E3 le agrega contenido (las estadísticas del estilo), no salidas. Las salidas son E5. |

---

## 9. Hallazgos de alcance que salieron al montar la red

Midiendo a cuántos toques está cada pantalla desde el inicio (`go()` + barra inferior):

- **A un toque (20):** `bio challenges clcareer contracts gym gyms hall history hub menu
  offers people rank retire shop social stats story tq train`.
- **Fuera de dos toques:** `ach`, `records`, `race`, `legacy`, `casino`, `create`,
  y las de combate (`fight`, `fightresult`, `mg`, `ending`, `endgame`, `load`).
- **`ach` (Logros), `records` (Récords) y `race` sólo se alcanzan desde la portada `title`.**
  Con una partida abierta no hay camino: la tarjeta `meta` del inicio lleva a `bio` y a
  `challenges`, pero no a Logros ni a Récords. Es un hallazgo, no una propuesta: si el mapa
  se aprueba, la tarjeta `meta` se muda a `menu` y **ahí sí** conviene que lleve a las
  cuatro. Lo marco y espero.
- **`casino` no se alcanza con `go()`** sino con `CAS.enterScreen()`, que es del módulo 33.
  Por eso no aparece en el grafo. Si la tarjeta se mueve a `menu`, se mueve con su botón:
  el camino no cambia de largo.

---

## 10. E3 y E4 empujan para el mismo lado (no lo busqué, salió del perfilador)

`dev/perf/perfil.js` midió el coste de dibujar el inicio: **1,14 ms por `scrHub()`**, y el
reparto es

| función | % del tiempo de dibujar el inicio |
|---|---|
| `socCircle` (`:11823`) | 12,9 % |
| `socPartners` (`:11792`) | 8,6 % |

Las dos son de la tarjeta ***Tu círculo*** — el bloque #14 del inventario, que el mapa manda
a `people`. O sea que el bloque más caro de dibujar del inicio es uno de los que el mapa ya
se llevaba por razones de interfaz. **No cambia la propuesta**, pero conviene saberlo: si el
mapa se aprueba, E4 empieza con parte del trabajo hecho.

---

## 11. RESULTADO — qué pasó de verdad

| pantalla | antes | después | objetivo |
|---|---|---|---|
| **inicio (`hub`)**, 360×640 | **8,84** pantallas · 5.655 px | **1,49** · 954 px | ≤ 1,5 ✓ |
| inicio, 390×844 | 6,35 | 1,09 | ✓ |
| inicio, 412×915 | 5,64 | 1,00 | ✓ |
| **portada (`title`)** con carrera, 360×640 | **1,58** | **1,30** | ≤ 1,5 ✓ |
| portada virgen, 360×640 | 1,47 | 1,19 | ✓ |

| medida del inicio | antes | después |
|---|---|---|
| bloques | 21 | **5** |
| nodos | 327 | **59** |
| botones | 76 | **12** |
| táctiles por debajo de 44 px | 38 | **5** (los cinco de la barra) |
| acciones visibles a la vez | 70 | 7 |

En **semana de pelea** el inicio queda en 1.294 px (2,02 pantallas): se suman el bloque
de la pelea y las cinco actividades que consumen la semana. Todas son decisiones de esa
semana, así que el mapa las deja donde están. Es la cara más cargada del inicio y está
medida: `dev/perf/hub-inventario-save.json`.

### Adónde fue cada cosa, ya hecho

`train` ← foco de entrenamiento · cómo estás trabajando · gasto semanal · pilares · técnicas
`menu` ← los seis accesos · peleador completo · tu mundo · tu carrera · tu historia ·
invertir/gimnasios · legado · **casino**
`people` ← tu círculo · `bio` ← quién te sigue · `stats` ← estadísticas clave del estilo

**La frontera del casino se respetó exactamente como estaba escrito:** no se tocó una línea
del módulo 33. Lo que cambió es el compositor (`CL.CARD_HOME` + `CL.renderCards`, en el
núcleo), que decide qué pantalla llama a cada `fn()`.

### Lo que la red evitó

Al fundir los dos bloques de tiempo, el botón de avance automático quedó dentro de
`periodPanel()`, que **no** se dibuja en semana de pelea — donde ese botón sí existía, con
tope de 8 semanas en vez de 26. La prueba falló nombrándolo
(*«desapareció `autoAdvanceToImportant(8)`»*) y el bloque se sacó a `avanzarCard()`, que el
inicio dibuja en sus dos caras. Sin la red, eso se iba silencioso.

### Dos cosas que aparecieron al medir, y que no eran de E3

1. **Desborde horizontal de 15 px en `menu` a 360 px**, presente ya en `1881841`. Causa:
   `.g2/.g3/.g4` usaban `1fr`, y una celda de grid no baja de su contenido, así que una
   palabra larga ensancha la columna. Con `minmax(0,1fr)` el desborde cae a **cero en las
   105 combinaciones** de pantalla y resolución.
2. **La prueba de scroll del navegador se auto-saltaba.** Medía siempre en el hub; al
   quedar el hub sin margen de scroll, dos aserciones de I1 pasaron a "NO MEDIDO" y
   siguieron contando como verdes. Ahora falla si no puede medir, y está verificada con
   tres mutantes.

### Decisiones de §8: qué se hizo con cada una

| # | qué decidí |
|---|---|
| 1 | **Los dos sistemas de foco se movieron a `train` sin fundirlos.** Fundirlos cambia comportamiento; sigue siendo pregunta de balance. |
| 2 | `identity` y `threads` se mudaron las dos a `menu` y **se conservaron las dos tarjetas**: unificarlas es cambiar lo que el jugador ve, no dónde lo ve. |
| 3 | El casino se movió **desde el compositor**, sin abrir el módulo 33. |
| 4 | `story` (9,95 pantallas) y `gym` (8,35) siguen **fuera del alcance de E3**. Anotadas para E5. |
| 5 | `stats` dejó de ser un callejón sin salida en contenido —recibió las estadísticas del estilo—, pero **sigue sin salidas propias**. Eso es E5. |
