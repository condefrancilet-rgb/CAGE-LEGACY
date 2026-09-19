# WORKLOG — CAGE LEGACY

## Estado
**Fase actual:** F0 — Reconocimiento y línea base.
**Rama:** `cage-legacy-rework` · **Tag de partida:** `baseline-original` (b9480fe)

## Siguiente paso exacto
**F0 cerrado (tag `fase-0-ok`).** Abrir **F1 — auditoría arquitectónica, sólo
lectura**. Empezar por los dominios que ya tienen hallazgos abiertos en
`dev/AUDIT.md`: B (navegación/render, por H-001), F (save/load, por H-002),
D (combate, por H-009) e I (rankings, por H-008). Un documento por dominio en
`dev/audit/<dominio>.md`, citando función y línea. Los hallazgos de severidad
alta pasan por refutación antes de marcarse CONFIRMADO.

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

## Bloqueos
Ninguno.

## Notas de rendimiento (medidas, para F5/F18)
- `saveGame` 39,2 ms de media · `normalizeWorldState` 25,8 ms · `advanceWeek`
  22,7 ms · `render` 0,7 ms.
- Carrera de 150 semanas ≈ 26 s con I/O, ≈ 17 s sin serializar el save.
- Sim en 4 workers: ≈ 33 ms/semana agregados. 1000 carreras × 150 semanas
  ≈ 1,4 h. Aceptable en segundo plano; si hace falta bajarlo, el objetivo es
  `normalizeWorldState` en cada autosave (F2+).
