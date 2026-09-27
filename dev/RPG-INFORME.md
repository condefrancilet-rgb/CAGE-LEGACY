# CAGE LEGACY — Etapa RPG: informe de entrega

Rama `claude/cage-legacy-consolidacion-lfxhe9`. Base: el archivo subido
(`CAGE_LEGACY_refactor_coherente_FINAL.html`, commit `7058abb`). El detalle de cada cambio,
con su evidencia, está en `dev/CHANGES.md` (entradas RPG-00 a RPG-05); el inventario inicial y
su cierre, en `dev/RPG-AUDITORIA.md`.

| commit | fase |
|---|---|
| `938eb04` | base reparada (la versión subida no abría partidas con pelea firmada y daba 131/193) |
| `ea9522b` | F3 · accesibilidad: huérfanos conectados, 5 pilares |
| `800d718` | F4 · temperamento, filosofías, rasgos, identidad, diario, legado |
| `4560f4d` | F5 · Fight IQ real, revanchas, lecciones, maestría, Ultimates |
| `a87386e` | F6-F7 · campamento que pregunta, eras, ecos que vuelven, ciclo de rivalidad |
| (este) | F8 · promesas cumplidas, instrumento de rendimiento, carrera completa |

---

## A. Diagnóstico

- **La base subida estaba rota**: ninguna partida con pelea firmada se podía abrir (`TypeError`
  en la migración v4→v5), guardar y cargar alteraba ~430 peleadores, el agente libre no podía
  pelear nunca y había ofertas que fallaban al aceptarse. Suite: 131 verdes / 62 rojas.
- **Mucho contenido existía y no se alcanzaba**: 4 funciones sociales completas sin botón
  (`allyForm`, `travelWith`, `watchFight`, `podcastStart` — ésta sin pantalla), eliminatorias con
  consumidor y sin productor, 26 banderas escritas que nadie leía (entre ellas compras de la
  tienda que sólo cobraban y 3 modificadores de carrera que multiplicaban el puntaje sin
  aplicarse), y una memoria narrativa local que no podía usarse desde fuera.
- **No había capa RPG**: la personalidad era fija, no existían identidad derivada, rasgos,
  filosofías, diario ni eras; la «lectura del rival» existía como número sin uso.
- **El combate tenía un bug de fondo**: la identidad del rival elegía acciones que no existen
  en la posición y el rival perdía el turno (medido en 169 peleas).
- **Medir antes de construir** cambió el diseño del Fight IQ: detectar «patrones» contando
  repeticiones acertaba 22-28 %. Se descartó; la lectura muestra la distribución real con la
  que decide la IA.

## B. Cambios realizados

- **Base (RPG-00)**: `offerKeyFor(offer, g)`, validación deportiva fuera de `saveValidate`,
  `fightSpecProblem()` puro (admite la pelea amateur), puerta final de `offers:made`,
  `CL.remember` público.
- **F3 (RPG-01)**: podcast con pantalla, acciones sociales por etapa de relación, tienda que
  cumple (chef, camp de élite, camp de equipo), modificadores de carrera que muerden
  (`metaLock`), mánager que dirige (`MGR`: lee, recomienda, produce eliminatorias y revanchas por
  el título), navegación en 5 pilares (Carrera · Combate · Equipo · Vida · Mundo) + Menú.
- **F4 (RPG-02)**: 62 ecos de decisión → 8 ejes de temperamento; el temperamento se pregunta y
  asumido cambia `pers2`; filosofía de combate (de las acciones) y de carrera (de las decisiones),
  asumibles, que ordenan la esquina y lo que valora el mánager; 10 rasgos con condición y
  consecuencia concreta; identidad con histéresis; diario de 6 secciones; perfil de legado.
- **F5 (RPG-03)**: lectura real del rival en 4 niveles, «Anticipar» (bono sólo si acierta de
  verdad), aviso de «te está leyendo», memoria por rival para revanchas (vos lo leés antes, él
  viene preparado), scouting con datos reales, lecciones de derrota sin estadísticas gratis,
  maestría por técnica, 4 Ultimates que son las L4 del árbol evolucionadas y se ejecutan con
  `TQ.use`/`TQ.resolve`/`TQ.apply` del mismo nodo.
- **F6-F7 (RPG-04)**: tres momentos de campamento con costo real (sparring que muestra la
  tendencia del rival, carga, plan propio vs. del entrenador); eras por división; el gimnasio y
  el entrenador que dejaste vuelven; ciclo de rivalidad en la ficha.
- **F8 (RPG-05)**: 6 promesas de eventos cumplidas por caminos existentes; requisito de Ultimate
  basado en ejecución; instrumento de rendimiento corregido; script de carrera completa.

## C. Sistemas conectados (existían; ahora se usan)

`c.read` (lectura) → Fight IQ · `CL.oppPick`/identidad del rival → distribución mostrada y
scouting · `analyst`/`videoWall` → scouting real · `G.soc` social → acciones por etapa ·
`podcastStart` → Vida y ficha de rival · eliminatorias → mánager · `wantTitleRematch`,
`calloutTitle`, `trilogyOpp`, `polemicalOpp` → ofertas · `PERS`/`pers2` → temperamento ·
`COACH_PHIL`/`CL.PHILO`/`CL.coachPatience` → momentos del campamento · `teamCamp` → plan
unificado · `G.champs` → eras · `left_gym`/`left_coach` → ecos que vuelven · `RPG.rivalStage`
→ ficha del rival · `planDivUp`/`body_divup`, `changeMgr`, `betterOrgForPlayer` → promesas ·
`TQ` → maestría y Ultimates · `G.story.memories` → diario · `CL.thread` → hilos de legado.

## D. Sistemas nuevos (y por qué no duplican)

| nuevo | por qué no es un duplicado |
|---|---|
| `G.rpg` (ecos, ejes, rasgos, identidad, filosofías) | no reemplaza `p.pers` (lo leen 30+ sitios): la deriva y la pregunta |
| `CMB` (lectura, memoria de rival, lecciones, maestría, Ultimates) | se apoya en `c.read`, `CL.oppWeights`, `TQ`; no hay motor de combate paralelo |
| `CAMPO` (momentos del campamento) | eventos `CL.ask` del sistema existente; ningún menú nuevo |
| `ERA` | no había historia de cinturones; se deriva de `G.champs` |
| `PROM` | cumple lo que los eventos ya anunciaban |

Puntos de extensión agregados a funciones existentes (sin cambiar su lógica): `social:react`,
`social:chat`, `social:spend`, `fight:scheduled`, `media:done`, `tq:node`, `tq:resist`,
`tq:resolved`, `tq:ownInfo`, `scout:report`, `screen:train`. Refactors neutrales verificados
(estado final idéntico en 5 semillas): `CL.oppWeightsFor` puro, reglas del rival como datos.
**No se agregó**: monedas, cajas de botín, crafting, tienda o sistema de medios/relaciones
paralelo. El casino no se tocó.

## E. Archivos afectados

- `index-4-blindado.html` (29.552 → ~32.250 líneas).
- Pruebas nuevas: `dev/tests/16-rpg-accesos.js` (14), `17-rpg-identidad.js` (17),
  `18-rpg-combate.js` (17), `19-rpg-campo-mundo.js` (14), `20-rpg-promesas.js` (8).
- Pruebas adaptadas a la regla del juego (no al revés): `06`, `07`, `08`, `10`, `12`, `13`.
- Herramientas: `dev/rpg-neutralidad.js`, `dev/rpg-carrera-completa.js`,
  `dev/make-baseline.js --solo-trazas`, `dev/perf/inicio.js` (peor caso real).
- Documentación: `dev/RPG-AUDITORIA.md`, `dev/CHANGES.md` (RPG-00…05), este informe.
- `dev/baseline/traces/*`: regeneradas en cada fase **con la causa de cada diferencia buscada por
  bisección** (CHANGES). Las fixtures de guardado no se regeneraron nunca.

## F. Tests (resultados reales)

Corrida sobre este commit:

| qué | resultado |
|---|---|
| suite Node (`node dev/run-tests.js`) | **262/262** (193 al empezar, sobre el repo original; 131/193 con el archivo subido) |
| navegador (`node dev/browser-tests.js`, 4 viewports) | **77/77**, sin errores de JS |
| carreras completas, debut (21) → retiro (37), invariantes cada semana (`dev/rpg-carrera-completa.js --n 3`) | **3/3** sin fallos (758-802 semanas); final, diario y guardado íntegros |
| carreras largas sin pelear, invariantes cada semana (`e5-largas.js --n 20 --weeks 300`, por fase) | 20/20 en F4, F5 y F6-F7 |
| balance (`sim.js`, 60 carreras por fase; 150 en F6-F7) | win rate 78-80 % en todas las fases, 0 fallos de invariante |
| rendimiento del inicio (`dev/perf/inicio.js`, ahora con peor caso real) | «Avanzar» sin scroll en 360x640, 390x844 y 412x915 |


- Mutación: 7/7 (F4), 11/11 (F5), 10/10 + 1 equivalente (F6-F7), 9/9 + 1 equivalente (F8).
  Tres pruebas se reescribieron porque un mutante sobrevivía (histéresis, pureza del dibujado
  de la pelea, tendencia del sparring).
- Pureza: ninguna pantalla nueva mueve el RNG ni escribe estado al dibujarse (incluido el primer
  dibujado de la pelea).
- Chromium real: panel de lectura, «Anticipar» resuelto contra la elección real, Ultimate con el
  clutch del motor FX, momento del campamento y tarjeta de eras; sin errores de JS.

## G. Problemas restantes (no hechos, o hechos a medias)

- El **autopiloto** no usa técnicas, no anticipa, no arma gameplan, no hace sparring ni asume
  filosofías: la simulación masiva (`sim.js`) no ejercita esas partes. Las cubren las pruebas y
  `dev/rpg-carrera-completa.js`, que tiene su propia política.
- El balance base del juego es muy favorable al jugador (win rate del autopiloto ~79 %; carreras
  completas 54-13 a 67-1). No se tocó: es previo a esta etapa y cambiarlo es una decisión de
  diseño.
- Filosofías: se asumen desde el diario (Carrera → Diario); ninguna prueba recorre una carrera entera
  asumiéndolas.
- Quedan banderas escritas sin lector que no prometen nada (marcas de compra o de tipo de
  carrera): listadas en la auditoría, sección 6.
- El camino del reemplazo de rival → `CL.remember` no tiene prueba dedicada.
- Textos: revisados en pantalla sólo los de las capturas; el resto se comprobó por pruebas
  (sin `undefined`/`NaN`), no leído uno por uno.

## H. Riesgos

- **Balance**: cada fase cambia la carrera del autopiloto (medido con 60 carreras por fase; una
  aparente caída de campeones en F6-F7 se repitió con 150 carreras: 48,0 → 51,3 %, era ruido). Las variaciones por estilo son
  grandes en ambas direcciones porque las carreras divergen temprano.
- **Tamaño del guardado**: `G.rpg` ocupa 24-29 KB al final de una carrera completa (memoria de
  hasta 60 rivales, eras de todas las divisiones).
- **Golden**: se regeneró en cada fase; la justificación está en CHANGES, pero cualquier cambio
  futuro que toque decisiones del autopiloto lo va a mover otra vez.
- **Partidas de fases intermedias**: los contadores de la fase 4 se llamaron `st` en un commit
  intermedio (RPG-4 los renombró a `cnt` en el mismo commit en que nacieron), así que no hay
  partidas publicadas con el nombre viejo.
