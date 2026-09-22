# E5 — lista de auditoría (se va llenando con lo que aparece medido)

> **`story` y `gym` ya NO están acá.** Son **E3b**, y E3b va antes que E4:
> `dev/E3b-STORY-GYM.md`.

## RESULTADO DEL BARRIDO

| frente | herramienta | resultado |
|---|---|---|
| estático | `dev/metrics.js` | `eval` **0** · dependencias externas **0** · escrituras de scroll **3** · escrituras de `UI.screen` **8** · funciones declaradas dos veces **0** · **1 línea duplicada** (corregida, ver abajo) |
| carreras largas | `dev/sim.js`, 200 × 300 semanas | fallos de invariante **0 → 0** |
| enganches aislados | `dev/e5-hooks.js`, 4 × 300 semanas | **0 fallos aislados**; sí deja escrituras parciales → **P-1** |
| caminos a mano | `dev/tests/15-camino.js` | contrato → pelea → pesaje → combate → cobro, y guardar/cargar después. **2 pruebas** |
| UI | `dev/browser-tests.js`, 4 viewports | **77 verdes**, desborde **0/105**, táctiles <44 px **0** |
| save/load | `dev/tests/03`, `09`, `11` | las 5 fixtures + el save congelado, carga idempotente |
| mono | `dev/e5-mono.js`, 4 semillas, ~2.500 toques | **0 errores de JavaScript · 0 invariantes rotas**; sigue guardando y cargando |

### Bugs encontrados y corregidos en E5

| id | qué | severidad | estado |
|---|---|---|---|
| **E5-1** | `DEV.initFromUrl` tenía la **misma línea dos veces** (`var q = …`): una sentencia muerta, resto de un copiar-pegar. | cosmético | **corregido** |

### Lo que se buscó y NO apareció

Ni una invariante rota en 200 carreras de 300 semanas, ni un error de JavaScript en ~2.500
toques al azar, ni un fallo de enganche aislado en 1.200 semanas. Las redes que se fueron
construyendo (187 pruebas + 77 de navegador) se quedaron verdes durante todo el barrido.
**Los bugs de esta obra aparecieron casi todos midiendo, no ejecutando** — y la mitad
estaban en el instrumento, no en el juego.

---

## A-1. `hookRun` se traga errores que la trampa global no ve

**El hallazgo.** Al escribir la red del rollback (`dev/tests/14-rollback.js`) quedó fijado
que un enganche de `week` que falla **no deshace la semana**: `hookRun` lo aísla, lo anota
en `G.hookFails` y sigue con los demás. Es política deliberada —`HOOK_ABORT` enumera los
seis eventos que sí abortan— pero tiene una consecuencia que no está medida:

> **la trampa global de errores no ve esos fallos.** Un enganche puede fallar cada semana
> de una carrera entera y el jugador no se entera, porque el contador `G.hookFails` no se
> mira en ninguna parte visible y el error no llega a `ERR`.

**HECHO, con `dev/e5-hooks.js`** — que envuelve `hookRun` **desde fuera**, en el sandbox, sin
tocar una línea del archivo del juego:

1. **Contar:** **0 fallos aislados** en 4 carreras × 300 semanas. La política no está
   tapando nada en juego normal.
2. **Escrituras parciales: SÍ las deja.** Con un enganche semanal que escribe un campo y
   revienta justo después: la popularidad pasó de **7,69 a 12,49** (la primera escritura
   quedó), la semana **avanzó igual** y `G.hookFails` subió a 1.

No es un bug del rollback —el rollback ni se dispara—, es el precio de la política
deliberada de aislar. Como es decisión de diseño del blindaje, va a **`dev/PENDIENTES.md`
§P-1** con las tres opciones y mi recomendación, y no se tocó.

## A-2. `stats` sigue sin salidas propias

E3 le dio contenido (las estadísticas clave del estilo, plegadas) y la bajó de 4,42 a 1,85
pantallas, pero sigue teniendo **0 botones**: se entra y sólo se sale por la barra. Decisión
5 del mapa: darle salidas es E5.
