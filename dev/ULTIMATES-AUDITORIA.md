# Auditoría de las 4 Ultimates (fase 9)

Contra el inventario generado (`dev/TQ-INVENTARIO.md`) y el comportamiento medido. Las cifras
de «magnitud» salen de las fórmulas de `TQ.apply` con habilidad 0,5 y 0,7 (cálculo reproducible
en la corrida de esta fase); las rutas, de `dev/tests/21-fightiq-capa.js` y `18-rpg-combate.js`.

## Lo común a las cuatro (verificado)

| pregunta | respuesta | evidencia |
|---|---|---|
| ¿Qué la origina? | una técnica **L4** del árbol; las 4 L4 son exactamente las 4 Ultimates | prueba «el inventario escrito coincide…» |
| ¿Qué función la resuelve? | `TQ.use` del **mismo nodo** → filtro `tq:node` (fase `use`: arma `ultLive`) → minijuego del motor FX → `TQ.resolve` (fase `resolve`: devuelve la forma Ultimate) → `TQ.apply` | prueba «la Ultimate se ejecuta con TQ.use del mismo nodo…» |
| ¿Consume recursos? | sí: el **único uso por pelea de su L4**, el mismo aire que la L4 (×`TQ.divF`), y una marca de «ya usada» (`f.tq.ultDone`) | pruebas «usar la L4 normal primero deja sin Ultimate…» y «…ni dos veces» |
| ¿Condiciones de activación? | despertada (`G.rpg.ult[id]`) + `TQ.state` de la L4 (posición, condiciones, aire) + no usada esta pelea; `TQ.use` exige además tenerla desbloqueada, no estar en la esquina ni con otro minijuego | `CMB.ultState`, `TQ.use` |
| ¿Se puede activar sin requisitos? | **no**: sin despertar, fuera de posición, sin la distancia o en la esquina, `ultState`/`ultUse` la niegan | prueba «no se activa sin haber despertado, fuera de posición, en la esquina, ni dos veces» |
| ¿Se activa por azar? | **no**: sólo con el botón del jugador (`CMB.ultUse`). Despertar tampoco es azar: 8 ejecuciones, 3 perfectas en el minijuego y una pelea ganada con ella. Lo que sí depende del dado es el **resultado** (nota, `TQ.chance`, finalización) | `CMB.ultReady`, `CMB.awaken` |
| ¿Depende de ejecución perfecta? | para **despertar**, sí (3 ejecuciones con q ≥ 0,86, antes de la resistencia del rival). Para **finalizar** (`fx.finish`), sólo a nota PERFECTA, igual que la L4 | prueba de maestría (`x`), `TQ.apply` |
| ¿Interactúa bien con TQ.use/resolve/apply? | sí. **Bug encontrado y corregido en esta fase:** `CMB.ultUse` devolvía `true` aunque `TQ.use` se negara (p. ej. en la esquina) | prueba «…en la esquina» + mutante `ultUse-miente` |
| ¿Es distinta de la L4? | **misma técnica**: mismo id, rama, nivel, posiciones, condiciones, usos, aire y minijuego (las 4 L4 ya usan `clutch` 4). Cambia la **magnitud** (tabla) y el **sello** | prueba «cada Ultimate es su L4…» |
| ¿Guardado/carga? | `G.rpg.ult` y `G.rpg.mast` vuelven idénticos | prueba «despertar y lo usado sobreviven…» + mutante `ult-no-persiste` |
| ¿La IA del rival puede usarla? | no: `TQ.use` sólo tiene llamadores del jugador (inventario, sección «Resumen verificado») | `dev/TQ-INVENTARIO.md` |

## Cada una

| Ultimate | L4 | dónde / cuándo | magnitud frente a la L4 (PERFECTA · BUENA) | ¿puede quedar sin uso por una ruta legítima? |
|---|---|---|---|---|
| **Talón del Verdugo** | `s_perf` Spinning hook perfecta | de pie, distancia media/larga, mucho aire | daño ≈ +16 %, knockdown 0,63 → 0,76, finalización 0,56 → 0,71 · daño +15 %, knockdown 0,41 → 0,48 | sí: si se usó la L4 esa noche, o si la pelea nunca da distancia con aire |
| **Suplex de la Tierra** | `w_sup` Suplex explosivo | en el clinch, mucho aire | daño ≈ +20 %, knockdown 0,51 → 0,61, finalización 0,24 → 0,33 · daño +20 %, knockdown 0,33 → 0,39 | sí: igual; además, en pesos pesados cuesta más aire (`TQ.divF`) |
| **La Última Puerta** | `g_def` Submission chain definitiva | en el suelo (arriba o abajo), desde el round 2, con aire | sumisión 0,76 → 0,80 con habilidad 0,5 y **0,80 = 0,80 con habilidad 0,7** (techo del motor) · sumisión 0,48 → 0,62 / 0,53 → 0,69; desgaste 22 → 26 | sí: igual. **Hallazgo:** a nota PERFECTA con habilidad alta no mejora la probabilidad de sumisión porque ambas tocan el techo de 0,80 de `TQ.apply`; su ventaja está en la nota BUENA y en el desgaste |
| **Último Aliento** | `i_last` Last chance | de pie, clinch o arriba, **sólo en situación crítica** (vida < 48 o perdiendo el final) | daño ≈ +17 %, knockdown 0,56 → 0,67, finalización 0,47 → 0,56, +8 de aire y +6 de vida · daño +17 % | sí, por diseño: si nunca estás en situación crítica, no aparece |

## Personalidad y filosofía (parte I)

- **Hoy**: el **sello** se fija al despertar según la **identidad oficial** (`RPG.officialIdentity`,
  derivada de lo que hiciste en la carrera): Espectáculo (finalizador/showman) sube la
  finalización +0,08 o la sumisión +0,05 y, a PERFECTA, el público; Precisión
  (técnico/estratega/contragolpeador) anula la parte de la resistencia que viene de que el mundo
  «la tiene fichada»; Desgaste (presionador/veterano/capitán) le saca +10 de aire aunque no
  termine; Pura, sin cambios. No es un multiplicador genérico: cada sello toca **una** vía del
  efecto, y la toca en `TQ.apply`/`TQ.resist`, las mismas funciones del motor.
- **No se usa** la filosofía de combate asumida (`G.rpg.philo.fight`). La arquitectura lo permite
  sin sistemas nuevos: `CMB.ultVariant` ya lee el estado RPG, y `G.rpg.philo.fight` existe
  (castigar errores → Precisión; finalizar/espectáculo → Espectáculo; adelante/control →
  Desgaste). **No se implementó** en esta fase: cambiaría el diseño (parte M) y queda como
  propuesta para decidir.

## Hallazgos de la auditoría

1. **Corregido:** `CMB.ultUse` informaba un lanzamiento que `TQ.use` había rechazado.
2. **Sin corregir (decisión de diseño):** La Última Puerta no mejora la sumisión a PERFECTA con
   habilidad alta (techo 0,80).
3. **Sin corregir (previo, del árbol):** la «toma de espalda» (`g_back`, `g_rev`) escribe una marca
   que nadie lee; no afecta a ninguna Ultimate.
4. Las Ultimates no cambian el minijuego respecto de su L4 porque las cuatro L4 ya usan el clutch
   de dificultad 4: la forma evolucionada se siente en el resultado, no en la ejecución.
