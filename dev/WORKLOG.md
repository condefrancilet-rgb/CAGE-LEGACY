# WORKLOG — CAGE LEGACY

## Estado
**Fase actual:** F2 — Consolidación y corrección (9 de 14 bugs; B-001 a la espera de su evidencia).
**Rama:** `cage-legacy-rework` · **Tags:** `baseline-original` · `fase-0-ok` · `fase-1-ok`

## Siguiente paso exacto
**En curso: la validación de B-001.** El arreglo está aplicado y sus 5 pruebas verdes,
pero cambia el orden de consumo del RNG, así que las 5 trazas del golden master cambian.
Eso exige **equivalencia estadística**, no igualdad (regla de F2). Hay un A/B corriendo en
segundo plano: `dev/sim.js --file` contra copias congeladas de antes y después, 600
carreras × 150 semanas por lado, salidas en
`…/scratchpad/eq-antes.json` y `…/scratchpad/eq-despues.json`, con `eq.done` como testigo.
Criterio: medias dentro de 2 errores estándar, proporciones dentro de 2 pp.
Si pasa → regenerar trazas, documentar en `CHANGES.md` y commitear. Si no pasa →
investigar qué más cambió antes de dar el arreglo por bueno.

Después, los bugs que quedan de la lista de `dev/AUDIT.md`:
**#10 D-002** (`applyPlayerFight` sin envolver: excepción a mitad deja estado parcial),
**#11 G-002** (la puerta de drama está puenteada),
**#12 C-002/3/4** (rutas que consumen semana sin publicar noticias; `advancePeriod` no
guarda nunca y destruye las ofertas cada semana),
**#13 I-002** (campeón fantasma al ascender de organización),
**#14 F-002** (la copia de respaldo pre-migración nunca se escribe).

Y después la **parte estructural de F2**, ya planificada en `dev/PLAN-F2-consolidacion.md`.
El candidato más claro es `rollEvent`: 4 capas y 3 constructores duplicados del mismo
objeto — lo destapó G-001, que hubo que arreglar tres veces.

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
