# WORKLOG — CAGE LEGACY

## Estado
**Fase actual:** F2 — Consolidación y corrección. **Los 14 bugs de la lista están cerrados** (13 corregidos, C-002 reconducido a la parte estructural con justificación en D-011). Pendiente: la parte estructural.
**Rama:** `cage-legacy-rework` · **Tags:** `baseline-original` · `fase-0-ok` · `fase-1-ok`

## Siguiente paso exacto
**Abrir la parte estructural de F2**, planificada en `dev/PLAN-F2-consolidacion.md`.
Empezar por el **punto 0: el cierre de semana** (viene de C-002). Está duplicado a mano en
los nueve llamadores de `advanceWeek`, cada uno con un subconjunto distinto —la tabla está
en `dev/DECISIONS.md`, D-011—. Extraer una función con contrato explícito y que cada
llamador declare qué parte quiere. **Sí cambia comportamiento** en los llamadores a los que
hoy les falta algo, así que necesita evidencia de simulación, no golden master idéntico.

Después, por orden del encargo: `startCareer` → `loadGame`/save → `advanceWeek` →
combate → entrenamiento → navegación/render → minijuegos → eventos → progresión de rivales.
El candidato más claro sigue siendo **`rollEvent`**: 4 capas, 3 constructores duplicados
del mismo objeto, y dos reglas (`important` en G-001, puerta de drama en G-002) que hubo
que arreglar en más de un sitio por culpa de los caminos de respaldo.

Al cerrar la consolidación: tag `fase-2-ok` (local; los tags no suben, D-009) y abrir F3.

## Comandos
```
node dev/run-tests.js            suite completa (golden master incluido, ~4 min)
node dev/run-tests.js --solo X   filtra por nombre
node dev/browser-tests.js        smoke de UI en Chromium real
node dev/metrics.js              métricas · --diff dev/baseline/metrics.json
node dev/redef-map.js            cadenas de redefinición verificadas en runtime
node dev/sim.js --n 200 --weeks 150
node dev/make-baseline.js        regenera TODA la línea base
```

## Tareas cerradas
- [x] Entorno inventariado: node v22.22.2, git 2.43.0, Chromium en
      `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, playwright 1.56.1.
      Sin `npm install`: todo el utillaje usa módulos nativos (I2).
- [x] Rama `cage-legacy-rework` + tag `baseline-original`.
- [x] `dev/metrics.js` — métricas F0/F21. Ignora comentarios y cadenas para que
      el texto no contamine los escáneres.
- [x] `dev/harness.js` — carga el juego en `node:vm` con stub de DOM,
      localStorage (con cuota opcional), timers controlables y `Math.random`
      sembrado (mulberry32). Pre-crea los ids que declara el HTML.
- [x] `dev/autopilot.js` — juega carreras completas: eventos, contrato,
      ofertas, campamento, pelea acción a acción, cobro. Políticas de combate
      `fija` / `aleatoria` / `basica`.
- [x] `dev/sim.js` — simulación masiva en `worker_threads`, con invariantes
      baratos e informe agregado.
- [x] `dev/run-tests.js` — punto de entrada único, exit ≠ 0 ante fallo
      (comprobado), imprime semilla de cada fallo.
- [x] `dev/tests/01-boot.js` — 6 pruebas verdes, incluido determinismo entre
      procesos y ausencia de dependencias externas.
- [x] `dev/tests/02-scroll.js` — **T-SCROLL (I1)**, 7 pruebas verdes,
      dinámicas + estáticas. **Verificado por mutación**: al reintroducir el
      `window.scrollTo(0,0)` incondicional fallan 3 pruebas. El test muerde.
- [x] `dev/tests/03-saveload.js` — 10 pruebas verdes. Incluye I3 contra las 5
      fixtures. **Una prueba mía falló y estaba mal**: exigía punto fijo en la
      primera carga, que el juego no promete. Medido campo a campo: 0 datos
      perdidos, sólo defaults añadidos. Reescrita para medir la garantía real.
- [x] `dev/tests/04-golden.js` — golden master (I4): las 5 trazas se reproducen
      idénticas (huella + estado final + secuencia semana a semana).
- [x] `dev/make-baseline.js` — regenera toda la línea base con un comando.
- [x] Línea base completa: `metrics.json`, 5 golden traces, **5 fixtures**
      (recién creada · antes de la primera pelea · mitad de carrera · con
      título · retirado), `sim.json` (40 carreras × 150 semanas, 0 fallos de
      invariante).
- [x] `dev/AUDIT.md` con 9 hallazgos medidos en F0 (H-001…H-009).

## Hecho en F2 hasta ahora
- **F-001** · `migrateLegacyBlob` ya no borra partidas que no pudo migrar. Impacto jugable
  nulo, verificado aislando el arreglo.
- **I-001** · el jugador puede volver a ser campeón. Carreras con título 12,5% → **67,5%**;
  defensas por carrera 0 → 0,38. Golden master regenerado; fixtures intactas.
- **D-003** · la pantalla de resultado ya no se abandona sin resolver: `fightresult` se
  añadió a la lista de pantallas sin barra de navegación. Cerraba el re-roll infinito del
  resultado. Verificado en Chromium real. Golden master sin cambios.
- **D-001 + D-006** · cobrar una pelea es idempotente. `G.paid` pasa de ser decoración de
  interfaz a cerrojo real: el reset se mudó a `fightStart` (atómico con la creación de la
  pelea) y `confirmFight` abre con condición explícita. Golden master sin cambios.
- **A-001** · un solo escritor de `contract.left`. El duplicado además no comprobaba la
  organización —lo destapó el test—. Cambian 2 de 5 trazas.
- **H-005** · el reescalado de patrocinios deja de componer (sólo el bug; el apilado queda
  intacto por decisión tuya, D-008). Ingreso de patrocinios a 7 años: mediana −61%.
  **Corrigió una atribución errónea de la auditoría**: H-005 NO causaba la cola pesada de
  la economía; esa causa sigue sin identificar y queda para F5.
- **C-001** · el avance en bloque aplica el campamento. Antes consumía semanas con
  `camp.i`, `sharp` y el corte de peso clavados. A/B: `camp.i` 0→2, `sharp` 35→45,
  peso −2,7 lb en un bloque de 8 semanas.
- **B-001** (pendiente de evidencia) · `cornerAdvice` y `postFightQuote` pasan a
  `pickStable`, el molde que el archivo ya usaba en `memRef`. **`render()` deja de alterar
  la partida**: stubearlo ya da la misma huella. Era H-001 desde F0.
- **G-001** · la marca `important` viaja con el evento, en los **tres** constructores
  (`rollEvent` tiene 4 capas). Mecanismo corregido; **efecto extremo a extremo NO MEDIDO
  como significativo**: los bloques se detienen por `cl_dyn`, que se adelantan al banco.
  Cambian 3 de 5 trazas, pero el estado observable y la traza semana a semana son
  idénticos: sólo cambió la forma del estado.

## Aprendizajes de método (valen para los que quedan)
- **La media miente en la economía.** En A-001 la media de dinero cayó un 24% y la
  mediana no se movió, con el máximo idéntico: era la cola pesada de H-005
  redistribuyéndose. Mirar siempre mediana y máximo antes de atribuir un efecto.
- **Un test que falla puede ser el test.** Pasó dos veces: el de punto fijo en save/load
  (F0) y el de `important` (G-001, exigía un evento que no es elegible en una carrera
  nueva). Preguntarse primero si la prueba está bien planteada.
- **Aislar qué arreglo cambió el golden master** revirtiendo uno solo. Así se supo que
  F-001 no tiene impacto jugable y que G-001 sólo cambia la forma del estado.
- **Cada arreglo lleva pruebas que vigilan que no desactive lo que la función debía
  hacer** (p. ej. `repairCritical` sigue vacando cinturones realmente inválidos).

## Bloqueos
- Los subagentes de auditoría corren en modo sólo lectura y **no pueden escribir**
  archivos: entregan el informe en su handback y el orquestador lo vuelca a
  `dev/audit/`. El de navegación (B) sí consiguió escribir el suyo.
- El límite de sesión cortó a los subagentes de **B**, **E** e **I** a mitad.
  B e I alcanzaron a entregar su informe completo; **E no**.
- **Los tags no se pueden empujar**: el proxy git devuelve `HTTP 403` para refs de tag
  (`git push origin fase-1-ok` → `RPC failed; HTTP 403`). La rama sí sube sin problema.
  `baseline-original`, `fase-0-ok` y `fase-1-ok` existen **sólo en local**. No es algo que
  se pueda resolver desde aquí; los commits de cada gate están identificados en este
  documento por si hay que recrearlos.

## Notas de rendimiento (medidas, para F5/F18)
- `saveGame` 39,2 ms de media · `normalizeWorldState` 25,8 ms · `advanceWeek`
  22,7 ms · `render` 0,7 ms.
- Carrera de 150 semanas ≈ 26 s con I/O, ≈ 17 s sin serializar el save.
- Sim en 4 workers: ≈ 33 ms/semana agregados. 1000 carreras × 150 semanas
  ≈ 1,4 h. Aceptable en segundo plano; si hace falta bajarlo, el objetivo es
  `normalizeWorldState` en cada autosave (F2+).

## Resumen de F2 — bugs corregidos (13)

| # | id | qué rompía | evidencia del efecto |
|---|---|---|---|
| 1 | F-001 | borraba partidas al arrancar si no cabían | impacto jugable nulo (aislado) |
| 2 | I-001 | el jugador no podía ser campeón | carreras con título 12,5% → 67,5% |
| 3 | D-003 | re-roll infinito del resultado | verificado en Chromium real |
| 4 | D-001+D-006 | cobrar duplicaba récord, bolsa y semanas | golden master sin cambios |
| 5 | A-001 | el contrato duraba la mitad | medianas sin mover |
| 6 | G-001 | `important` no llegaba a la cola | efecto NO MEDIDO como significativo |
| 7 | H-005 | patrocinios componían sin techo | ingreso a 7 años: mediana −61% |
| 8 | C-001 | el bloque quemaba el campamento | `camp.i` 0→2, `sharp` 35→45 |
| 9 | B-001 | dibujar consumía el RNG del mundo | **no equivalente**, documentado |
| 10 | D-002 | resultado aplicado a medias | golden master sin cambios |
| 11 | G-002 | la puerta de drama no se aplicaba | 4/328 → 0/321 · equivalencia aceptada |
| 12 | F-002 | la copia pre-migración no existía | impacto jugable nulo (aislado) |
| 13 | I-002 | campeón fantasma congelaba divisiones | equivalencia aceptada · 172/250 idénticas |

**Suite: 82 pruebas verdes · navegador: 28 verdes · 0 fallos de invariante.**
Métricas de control planas: 43 redefiniciones, 42 wrappers, 3 escrituras de scroll,
0 dependencias externas, 0 `eval`.
