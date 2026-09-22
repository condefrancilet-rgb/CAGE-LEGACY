# E5 — lista de auditoría (se va llenando con lo que aparece medido)

> **`story` y `gym` ya NO están acá.** Son **E3b**, y E3b va antes que E4:
> `dev/E3b-STORY-GYM.md`.

## A-1. `hookRun` se traga errores que la trampa global no ve

**El hallazgo.** Al escribir la red del rollback (`dev/tests/14-rollback.js`) quedó fijado
que un enganche de `week` que falla **no deshace la semana**: `hookRun` lo aísla, lo anota
en `G.hookFails` y sigue con los demás. Es política deliberada —`HOOK_ABORT` enumera los
seis eventos que sí abortan— pero tiene una consecuencia que no está medida:

> **la trampa global de errores no ve esos fallos.** Un enganche puede fallar cada semana
> de una carrera entera y el jugador no se entera, porque el contador `G.hookFails` no se
> mira en ninguna parte visible y el error no llega a `ERR`.

**Lo que hay que hacer en E5, en este orden:**

1. **Contar.** Instrumentar `hookRun` para registrar `evento/id` de cada fallo aislado, y
   correr las carreras largas del simulador (`dev/sim.js --n 200 --weeks 300`) sumando el
   total. **El número tiene que ser 0**, o cada fallo que aparezca tiene que estar
   explicado y anotado como bug.
2. **Comprobar las escrituras parciales.** Un enganche que falla a mitad puede dejar `G`
   con medio efecto aplicado: subió la popularidad y no cobró, descontó el dinero y no
   apuntó la deuda. Hay que inyectar un fallo **a mitad de un enganche** que escriba dos
   campos y comprobar qué queda. Si quedan escrituras parciales, la política de aislar
   necesita una transacción por enganche, o la lista de `HOOK_ABORT` está incompleta.

**Por qué no se hizo en E4.** E4 es rendimiento y esto es corrección; y el paso 2 puede
terminar cambiando la política de aislamiento, que es una decisión de diseño del blindaje.

## A-2. `stats` sigue sin salidas propias

E3 le dio contenido (las estadísticas clave del estilo, plegadas) y la bajó de 4,42 a 1,85
pantallas, pero sigue teniendo **0 botones**: se entra y sólo se sale por la barra. Decisión
5 del mapa: darle salidas es E5.
