# E3b — `story` y `gym`, con los mismos criterios que el inicio

**Es el siguiente paso, antes de E4.** Salió de la decisión 4 del mapa de E3: hacerlo en
cuanto el inicio cerrara. Estaba mal archivado en `dev/E5-AUDITORIA.md`; esto lo corrige.

## Lo medido hoy, a 360×640 con el save congelado

| pantalla | alto | nodos | botones | táctiles < 44 px |
|---|---|---|---|---|
| `story` | **9,95 pantallas** · 6.367 px | 224 | 56 | 0 |
| `gym` | **8,35 pantallas** · 5.347 px | 197 | 50 | **14** |

`gym` tiene los **14 únicos objetivos táctiles por debajo de 44 px** que quedan en el juego
fuera de lo ya arreglado.

## Los mismos criterios, sin rebaja

1. **Inventario medido antes de tocar**: bloque por bloque, con sus acciones, en los dos
   estados (carrera nueva y save congelado).
2. **Red de "nada se pierde" antes de tocar**, con el inventario de fixture, verificada por
   mutación, y recorrida **pulsando en el navegador** sobre elementos visibles — no leyendo
   el HTML (`checkVisibility`, por lo aprendido con las secciones plegables).
3. **≤ 2 pantallas de alto** a 360×640, con las secciones en su estado por defecto.
4. **44 px** de objetivo táctil en toda la pantalla.
5. **Desborde horizontal cero** en las tres resoluciones.
6. **Pruebas de navegador propias** para las dos pantallas, dentro de la corrida normal.

## Aviso que ya está cubierto

La red de I1 medía en `gym` y `story`; si E3b las acorta se quedaría otra vez sin sitio. Ya
no depende de eso: antes de medir **abre todas las secciones plegables** de la pantalla
candidata, así que cualquier pantalla con secciones le da margen de scroll sin importar
cómo quede su diseño. Verificado: mide en `train` con sus secciones abiertas.
