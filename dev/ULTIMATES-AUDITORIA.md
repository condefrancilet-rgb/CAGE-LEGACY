# Auditoría de las 4 Ultimates (fase 9, actualizada en la fase 10)

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
| ¿Es distinta de la L4? | **misma técnica**: mismo id, rama, nivel, posiciones, condiciones, usos, aire y minijuego (las 4 L4 ya usan `clutch` 4). Cambia la **magnitud** (tabla), el **sello** y, en La Última Puerta, el **techo** de la sumisión (fase 10) | prueba «cada Ultimate es su L4…», «La Última Puerta es distinta de su L4 también a PERFECTA» |
| ¿Guardado/carga? | `G.rpg.ult` y `G.rpg.mast` vuelven idénticos | prueba «despertar y lo usado sobreviven…» + mutante `ult-no-persiste` |
| ¿La IA del rival puede usarla? | no: `TQ.use` sólo tiene llamadores del jugador (inventario, sección «Resumen verificado») | `dev/TQ-INVENTARIO.md` |

## Cada una

| Ultimate | L4 | dónde / cuándo | magnitud frente a la L4 (PERFECTA · BUENA) | ¿puede quedar sin uso por una ruta legítima? |
|---|---|---|---|---|
| **Talón del Verdugo** | `s_perf` Spinning hook perfecta | de pie, distancia media/larga, mucho aire | daño ≈ +16 %, knockdown 0,63 → 0,76, finalización 0,56 → 0,71 · daño +15 %, knockdown 0,41 → 0,48 | sí: si se usó la L4 esa noche, o si la pelea nunca da distancia con aire |
| **Suplex de la Tierra** | `w_sup` Suplex explosivo | en el clinch, mucho aire | daño ≈ +20 %, knockdown 0,51 → 0,61, finalización 0,24 → 0,33 · daño +20 %, knockdown 0,33 → 0,39 | sí: igual; además, en pesos pesados cuesta más aire (`TQ.divF`) |
| **La Última Puerta** | `g_def` Submission chain definitiva | en el suelo (arriba o abajo), desde el round 2, con aire | sumisión 0,76 → **0,88** con habilidad 0,5 y 0,80 → **0,88** con habilidad 0,7 (la L4 queda en el techo 0,80 del árbol; la Ultimate trae el suyo, `fx.subCap` 0,88) · sumisión 0,48 → 0,62 / 0,53 → 0,69; desgaste 22 → 26 | sí: igual. **Corregido en la fase 10:** antes, a PERFECTA con habilidad alta, las dos tocaban el mismo techo (0,80 = 0,80) |
| **Último Aliento** | `i_last` Last chance | de pie, clinch o arriba, **sólo en situación crítica** (vida < 48 o perdiendo el final) | daño ≈ +17 %, knockdown 0,56 → 0,67, finalización 0,47 → 0,56, +8 de aire y +6 de vida · daño +17 % | sí, por diseño: si nunca estás en situación crítica, no aparece |

## Personalidad y filosofía (parte I)

- **El sello** se fija al despertar. Desde la fase 10 sale **primero de la filosofía de combate que
  asumiste en público** (`G.rpg.philo.fight`, que sólo se puede asumir si tus peleas la muestran:
  `RPG.canAdopt`) y, si no asumiste ninguna, de la **identidad oficial** (`RPG.officialIdentity`,
  derivada de lo que hiciste en la carrera). La filosofía **elige entre los mismos cuatro sellos**;
  no crea efectos nuevos:

  | filosofía asumida | sello |
  |---|---|
  | Buscar la finalización · Dar espectáculo | Espectáculo |
  | Castigar errores · Minimizar el daño | Precisión |
  | Controlar · Nunca retroceder | Desgaste |
  | (ninguna) | el de la identidad: finalizador/showman → Espectáculo; técnico/estratega/contragolpeador → Precisión; presionador/veterano/capitán → Desgaste; el resto → Pura |

- Lo que hace cada sello no cambió: Espectáculo sube la finalización +0,08 o la sumisión +0,05 y,
  a PERFECTA, el público; Precisión anula la parte de la resistencia que viene de que el mundo «la
  tiene fichada»; Desgaste le saca +10 de aire aunque no termine; Pura, sin cambios. Cada sello
  toca **una** vía del efecto, en `TQ.apply`/`TQ.resist`, las mismas funciones del motor.
- Queda guardado **de dónde salió** (`G.rpg.ult[id].src` = `filosofia` | `identidad`, y `k`), y el
  árbol lo explica («por tu filosofía: «Castigar errores»»). Las partidas viejas, sin ese dato, se
  explican como «por cómo peleaste», sin inventar el origen.

## Hallazgos de la auditoría

1. **Corregido (fase 9):** `CMB.ultUse` informaba un lanzamiento que `TQ.use` había rechazado.
2. **Corregido (fase 10):** La Última Puerta no mejoraba la sumisión a PERFECTA con habilidad alta
   (las dos formas tocaban el techo 0,80). Ahora la forma evolucionada trae su techo (0,88; el
   motor lo acota a 0,90 como máximo) y ninguna otra técnica ni Ultimate cambia el suyo.
3. **Corregido (fase 10, del árbol):** la «toma de espalda» (`g_back`, `g_rev`) escribía una marca
   que nadie leía. Ahora es una posición (`TQ.back()`), mientras sigas arriba en ese round: +6 al
   trabajo de suelo por `combat:eff` (también para resistir su barrida y su levantada), ×1,15 a la
   sumisión del árbol (la cadena, incluida La Última Puerta, sale más fuerte desde la espalda) y +1
   de control por intercambio. Se pierde si cambia la posición o termina el round, y el HUD lo dice.
4. Las Ultimates no cambian el minijuego respecto de su L4 porque las cuatro L4 ya usan el clutch
   de dificultad 4: la forma evolucionada se siente en el resultado, no en la ejecución.
5. **Observación (sin cambio):** con el rival herido, el Talón del Verdugo y su L4 quedan cerca del
   techo de finalización del árbol (0,72 frente a 0,71 con nota 1,0); la diferencia sigue en el
   daño (+16 %) y el knockdown (0,63 → 0,76).
