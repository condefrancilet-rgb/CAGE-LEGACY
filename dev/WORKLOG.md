# WORKLOG — CAGE LEGACY

## Estado
**Fase actual:** F2 — Consolidación y corrección (3 de 14 bugs corregidos).
**Rama:** `cage-legacy-rework` · **Tags:** `baseline-original` · `fase-0-ok` · `fase-1-ok`

## Siguiente paso exacto
Seguir con **F2**, por la lista priorizada de `dev/AUDIT.md` → "Lista priorizada de
correcciones para F2". Hechos los tres primeros (F-001, I-001, D-003). **El siguiente es el #4, D-001**:
`confirmFight()` no tiene guarda de idempotencia — tres llamadas dan récord 0-3, tres
entradas de `career` y tres bolsas para una sola pelea. Arreglo indicado en
`dev/audit/D-combate.md`: guarda al principio de `confirmFight`. Ojo: el test debe
comprobar también que la llamada legítima **sí** sigue cobrando.

**Protocolo por cada bug, ya rodado dos veces:**
1. Escribir el test en `dev/tests/06-f2-fixes.js` **incluyendo las pruebas que vigilan que
   el arreglo no desactive lo que la función debía hacer**.
2. Correrlo contra el archivo sin corregir y **guardar la salida en rojo** (va a CHANGES.md).
3. Aplicar la corrección de raíz.
4. Suite completa. Si cambia el golden master, **aislar qué arreglo lo causó** revirtiendo
   uno solo, y medir el efecto con `dev/sim.js` antes/después.
5. Entrada en `CHANGES.md` con la evidencia. Commit `[F2] fix:`.

**Importante sobre las fixtures**: `dev/fixtures/` son saves de la versión **original** y
son la evidencia de I3. **No se regeneran nunca.** Las golden traces sí, cuando un fix
cambia el juego a propósito.

Tras los bugs vienen las consolidaciones estructurales (mismo orden del encargo:
startCareer → loadGame → advanceWeek → combate → entrenamiento → navegación/render →
minijuegos → save/load → eventos → progresión de rivales), que **no** deben cambiar
comportamiento y se demuestran con golden master idéntico.

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
