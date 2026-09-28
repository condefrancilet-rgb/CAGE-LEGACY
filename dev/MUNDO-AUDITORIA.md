# MUNDO-AUDITORIA — Fase 14: el mundo dinámico, el emparejamiento y la simulación de carrera

Archivo de partida: `a16dc16` (sha256 `04c9983a…72fa4`). Herramientas nuevas:
`dev/mundo-sim.js` (el mundo con un jugador que no hace nada: no pelea, no firma, no cambia de
división, no contesta eventos), invariantes del sistema `mundo` en `dev/invariants.js` (se
comprueban después de CADA semana en toda simulación y en toda carrera del arnés) y
`dev/tests/26-fase14-mundo.js`.

## 1. Mapa del mundo

**Calendario → emparejamiento → pelea → resultado → mundo** (`advanceWeekCore`):

1. `reconcileScheduledFight('pre')` — la pelea firmada del jugador sigue siendo legal o se reemplaza.
2. `G.week++`; si pasa de 52 → `yearTick`.
3. `worldTick` — por organización, con probabilidad (85 % Vanguard, 60 % el resto) arma una
   cartelera: el **pool** es el roster activo, sano, con 16–30 semanas sin pelear y (fase 14) sin
   el rival ya firmado con el jugador; empareja por división y `rankScore` más cercano; es título si
   el campeón está en la pelea, o si el cinturón está vacante, hay 6 rankeados y los dos son top 5.
   `simFight` → `applyResult` → `applyResultCore` (récord, rachas, popularidad, reputación,
   experiencia, fatiga, daño, lesiones, cinturón, `recalcRank`) → gancho `result:applied`.
   Después: títulos vacantes (6 % por semana, top 2 del ranking), lesiones al azar e inactividad,
   y `recalcRank` en la mitad de las organización/división.
4. `historicalUfcTick`, `reconcileScheduledFight('post')`, `reconcileOffers`, `championSeasonTick`
   (oportunidades de título del campeón: 3 por temporada, 17 semanas de espacio).
5. El jugador: inactividad, lesión, fatiga, caja; gancho `week`.

**`yearTick`** (cada año): envejecer (`devYear`), retirar (riesgo por edad contra `retireAge`, racha,
KO sufridos; el campeón resiste), llegan los históricos pendientes, cambios de división ocasionales
(2 %), 8–14 prospectos en las cuatro ligas menores, rosters y rankings, **ascensos** entre
organizaciones (racha ≥4, OVR >72, 35 %), rosters y (fase 14) rankings otra vez, `pruneWorld`
(retirados sin títulos se borran a los 3 años; tope de población 300/340 sobre los irrelevantes),
`normalizeFull`, gancho `year` → `CL.year` → `CL.npcYear` para los NPC seguidos (cambio de
organización, gimnasio, entrenador, estilo, vínculos NPC-NPC, retiro, regreso) → (fase 14) rosters y
rankings → (fase 14) `worldReplenish`.

**Emparejamiento del jugador**: `makeOffers` (pool de su división y organización, sin los tres
últimos rivales; `spawnLocals` si quedan menos de 4; pelea por el título si es top 3 con racha; defensas
del campeón; defensa obligatoria de temporada; «la pelea que pediste»; oferta de ascenso) → ganchos
`offers:made` (última puerta de legalidad, piso de bolsa, ofertas de la capa CL —«acepto lo que
sea», gimnasio, personalidad, medios, público—, meta, documental, mánager, anti-repetición, rasgos,
ruido, promesas) → `acceptFight` → `scheduleFight` → campamento → reemplazo si hace falta →
`goFight` → `applyWinLossResult` (récord, cinturón, `contract.left`, ranking) → `confirmFight`.

**Agentes libres**: en el modelo sólo lo es el jugador (todo NPC activo pertenece a una
organización; medido: 0 NPC sin organización en 600 semanas). Su vía de pelea es la amateur de
«acepto lo que sea» (`G.flags.clTakeAny`).

## 2. Simulaciones sin jugador

3 semillas (101, 118, 135), medidas sobre el archivo final; como el mundo es determinista, cada fila es
la foto de la corrida de 600 semanas en esa semana (idéntica a correr sólo ese tramo). Invariantes del mundo cada semana, legalidad de cada pelea del
mundo en el momento (activo, de su organización, misma división, sin lesión de más de una semana).

| Semanas | Peleas (por semana) | Títulos en juego | Cambios de campeón | Retiros (edad p50) | Debutantes | Cambios de división | Activos al final | Vacantes (tier≥2) | Fallos |
|---|---|---|---|---|---|---|---|---|---|
| 50 | 358–376 (7,2–7,5) | 99–109 | 22–35 | 0 | 0 | 0 | 371 | 0 | 0 |
| 100 | 729–735 (7,3) | 209–210 | 50–63 | 2–3 | 15–20 | 5–6 | 369–375 | 0 | 0 |
| 150 | 1078–1096 (7,2–7,3) | 305–308 | 79–97 | 12–15 (34–36) | 37–42 | 9–10 | 370–375 | 0 | 0 |
| 300 | 2108–2169 (7,0–7,2) | 603–610 | 185–214 | 54–56 (34–35) | 108–117 | 21–25 | 354–359 | 0 | 0 |
| 600 | 4050–4070 (6,8) | 1169–1202 | 440–468 | 196–212 (35–36) | 285–290 | 43–45 | 320–332 | 0 | 0 |

A las 50 semanas todavía no pasó ningún cambio de año (retiros, debutantes y cambios de división
son anuales). Resultados KO/SUB/decisión/empate a 600 semanas: 16,1 % / 7,4 % / 73,3 % / 3,2 %. Edad de
retiro p10/p50/p90 a 600 semanas: 30–32 / 35–36 / 39–40.

**Antes de la fase** (misma herramienta, 5 semillas × 600): 2–10 peleas cruzadas entre organizaciones
por corrida, rankings y rosters con gente de otra organización hasta 208 semanas seguidas, campeones
de una organización que pertenecían a otra (2–4 semanas), 1–4 títulos contados de más; y en 20 años
el mundo pasaba de 353 activos a 138, con Vanguard de 112 a 1 y títulos vacantes durante 937 semanas.
En una carrera real de 16 años, Vanguard caía de 134 a 9 y quedaban vacantes 24 de 33 títulos.

## 3. Salud por sistema

| Sistema | Estado | Evidencia | Cambios |
|---|---|---|---|
| Campeones | funciona | invariante `mundo.campeones` (activo, de su organización y división, un solo cinturón) cada semana; 440–468 cambios en 600 semanas; retiro y cambio de división del campeón vacían el cinturón vía `recalcRank` | título vacante contado una vez (antes dos) |
| Rankings | funciona | `mundo.rankings` (≤15, sin retirados, organización y división correctas, campeón fuera, sin duplicados entre listas); se rehacen tras cada pelea de esa división y en la mitad de las semanas; 1124 subidas sin pelear contra 769 peleando (300 semanas): el puesto es relativo por diseño (`rankScore`: OVR, récord, racha, calidad de rivales, popularidad, −inactividad > 60 semanas, −lesión) | rehechos tras ascensos y tras `CL.npcYear` |
| Emparejamiento | funciona | legalidad de cada pelea del mundo; 0 peleas imposibles en todas las corridas | el rival firmado con el jugador ya no pelea otra (antes 36 de 100 firmas) |
| Contratos | corregido en parte / inconsistencia documentada | `contract.left` baja una vez por pelea (prueba A-001) y ahora también en el empate (antes un empate bajo contrato no lo consumía: semilla 55, 4 → 4); a 0 el contrato **no vence**: 132 de 145 peleas en 3 carreras se hicieron con un contrato de 4 peleas vencido, que sigue fijando piso de bolsa y bono; «Tu contrato está por vencer» salió hasta 7 veces con 0 | el empate consume el contrato (`consumeContractFight`, el mismo escritor para las dos salidas); el vencimiento no se toca: cerrarlo exige decidir la renovación, que hoy no existe (decisión de diseño, fase de economía) |
| Agentes libres | corregido | prueba de punta a punta: agente libre → «acepto lo que sea» → pelea amateur → resultado → récord | B-3 había vuelto: la oferta amateur vivía en un gancho que la rama del agente libre no alcanzaba |
| Reemplazos | funciona | prueba: lesión del rival → reemplazo de la misma división y organización, elegible, en el historial y en la memoria, campamento rehecho, el lesionado vuelve a estar disponible; 8 reemplazos en 3 carreras de 400 semanas | — |
| Retiros | funciona | edad p10/p50/p90 = 32/35/39 (semilla 101, 600 semanas; 196–212 retiros en las tres); el retirado sale de rankings, cinturones y carteleras (invariantes); los campeones retirados se conservan (prueba); los retirados sin títulos se podan a los 3 años (diseño, por tamaño del guardado) | — |
| Nuevos peleadores | corregido | 285–290 debutantes en 600 semanas; semilla 101: estilos repartidos entre los 10 (22–43 cada uno), las 11 divisiones (20–34), las 5 organizaciones (RFL 57, AXN 67, TFC 69, WMA 68, VAN 29); edad p10/p50/p90 22/25/30; OVR 36/46/63; **0 nombres repetidos** en todo el mundo (antes 25–31 a las 600 semanas) | reposición de divisiones con `spawnLocals` (ya existía, sólo para el jugador); nombre libre al crear (`freshName`) |
| Divisiones | corregido | clones del plantel real: con inicio 2016, 9 clones y 5 activos en dos divisiones a la vez (Holloway, Makhachev, Whittaker, Sterling, Figueiredo); ahora 0 en todos los años de inicio; 43–45 cambios de división de NPC en 600 semanas | consolidación de identidad fuera de 2026 |
| Rivalidades | funciona (jugador) / narrativa (NPC) | el ciclo del jugador (cruce → tensión → medios → pelea → cierre) está probado desde la fase 10; entre NPC los vínculos (`CL.rel2`) sólo tienen consecuencia en el evento de tomar partido del círculo del jugador; nunca arman peleas del mundo (0 rivalidades NPC-NPC por encima de 60 en 600 semanas) | — |
| Progresión | funciona | cambio anual de OVR por edad: <25 +1,44; 25–29 +0,69; 30–33 +0,03; 34+ −0,71; nadie fuera de 0..100; edad máxima de un activo 40; nadie congelado fuera de lo que la curva manda | — |
| Calendario | corregido | semana 52 → 1, año, envejecimiento y retiros sin fallos de invariante en 20 años; el mundo no peleaba las primeras 17 semanas (todos nacían con 0 semanas de inactividad) | inactividad inicial escalonada |
| Determinismo | funciona | misma semilla → misma huella (dos corridas de 200 y 300 semanas); otra semilla → otro mundo sin fallos; guardar a mitad y seguir en un arranque nuevo → la misma huella | — |

## 4. Hallazgos

**Bugs (corregidos):**
1. `CL.npcYear` cambiaba de organización (y retiraba / devolvía del retiro) a NPC sin reconstruir
   rosters ni rankings: la organización vieja lo seguía programando todo el año.
2. Los ascensos de `yearTick` se hacían después del recálculo de rankings: el que ascendía seguía en
   el ranking (o con el cinturón) de la organización que dejaba, y la poda decidía con eso.
3. El título vacante que se define en el bloque de vacantes sumaba el título dos veces.
4. El rival firmado con el jugador podía pelear otra pelea del mundo durante el campamento.
5. El mundo se vaciaba: sin reposición de divisiones, Vanguard desaparecía y los títulos quedaban
   vacantes indefinidamente.
6. Clones del plantel real activos en dos divisiones a la vez con cualquier año de inicio que no
   fuera 2026.
7. El agente libre no podía pelear: la oferta amateur nunca llegaba (B-3 reintroducido por la
   forma, no por la regla).
8. El mundo no peleaba las primeras 17 semanas.
9. Nombres repetidos: el generador no miraba quién existía; el mundo nacía con ~9 nombres repetidos y a
   las 600 semanas había 25–31, con parejas activas del mismo año (las «Mei Ferrer» de Vanguard que
   encontró el invariante `mundo.identidad` en una carrera de 745 semanas). `freshName` vuelve a sortear.

**Bugs que la regresión sacó a la luz (existían antes; el mundo nuevo cambió el azar de las pruebas
viejas y los hizo visibles). Se corrigen porque rompían estado; se fijan con el resultado forzado:**
10. Un **empate** bajo contrato no consumía el contrato: `applyDrawResult` no pasaba por el único
   escritor de `contract.left` (F2 · A-001 falló con la semilla 55: la pelea terminó en empate y el
   contrato quedó en 4). Ahora las dos salidas llaman a `consumeContractFight`.
11. **Conferencia de prensa:** seis respuestas del banco ampliado tienen tono `charisma`, que las tablas
   de `pressPick` no tienen → `NaN` en popularidad, calor y respeto → el saneador devolvía
   popularidad, reputación y hype a sus valores por defecto (medido: popularidad 40 → 8 por contestar
   «Me da energía»; TIENDA-11 · estilista falló por esto). Un tono sin fila ahora no suma nada, que es lo
   que la pantalla ya decía («Respuesta sin ruido»). **Cuánto debería rendir el tono carismático es una
   decisión de diseño que no se inventa aquí** (queda para la fase de decisiones).
12. **Ex entrenador en la esquina rival:** el bono de lectura (+12 de adaptación) se sumaba sobre
   `safeInt(adaptación)`, que redondea; `aiProfile` deja medios puntos, así que el bono era +12 o
   +12,5 según el rival (RPG-7 falló cuando el mundo nuevo puso enfrente a uno con 51,5). Se suma
   sobre el número tal cual. No cambia ninguna traza golden.

**Prueba frágil (no era un bug del juego):** el auditor de TIENDA-11 para el documental dependía de
que la coestelar AL AZAR de `CL.extraOffers` (28 %) no saliera primero; cuando sale, el documental
espera, como está escrito. Con el archivo de la fase 13 pasaba lo mismo con la semilla 5. El auditor
apaga ese azar ajeno para medir sólo la compra; la regla del documental no cambió.

**Sistemas muertos / estados huérfanos:** `G.retiredList` se escribe y se poda pero ningún sistema
de juego ni pantalla lo lee (declarado en `HUERFANAS_FUERA_DEL_MAPA`). `G.story.memories[].person`
(memoria `event_target` de la escalada de rivalidad): se escribe y nadie la lee; la carrera de muestra
del mapa de estado la alcanzó por primera vez con el mundo nuevo (declarada en `HUERFANAS`, a
investigar en la fase de decisiones). `G.nextFight.replacementReason`: copia del motivo del reemplazo
(el que se lee está en `replacementHistory[].reason` y en la noticia); apareció cuando la carrera de
muestra tuvo su primer reemplazo (declarada).

**Inconsistencias (documentadas, sin cambiar):**
- Contratos que no vencen (§3).
- El guardado crece con el mundo vivo: los campeones retirados se conservan siempre y ahora hay más
  campeones. A 20 años sin jugador, 1.284 KB y 705 peleadores (antes 748 KB y 396, porque el mundo se
  moría). Para la fase de rendimiento.
- Casi un tercio de las peleas del mundo son de título: toda pelea del campeón defiende el cinturón.
  Es el diseño; no se toca sin especificación.

**Comportamientos correctos (medidos):** determinismo, guardar/cargar del mundo, reemplazos,
retiros, progresión por edad, calendario, cambio de división del campeón (vacía el cinturón),
legalidad del emparejamiento del jugador (fases anteriores).

## 5. Golden

Trazas regeneradas con `dev/make-baseline.js --solo-trazas` (huellas 73a7d259, e7ba43fc, 08f3271b,
9b731ebd, 3cddd4a6). Atribución con `dev/rpg-neutralidad.js` contra las trazas de `a16dc16`:

| Variante del archivo final | Primera divergencia (5 trazas) | Causa |
|---|---|---|
| tal cual | entradas 0–3 (2016 s2–s5) | el mundo nace distinto: sin clones, nombres libres, inactividad escalonada |
| sin los cambios de creación | entradas 21–23 (2016 s22–s25) | la primera pelea firmada: el rival comprometido ya no pelea otra cartelera |
| sin creación ni compromiso | entradas 52–53 (2017 s1–s3) | el primer cambio de año: rosters y rankings rehechos, reposición de divisiones |

Los arreglos de empate, conferencia y ex entrenador no cambian ninguna de las cinco trazas (la
huella es la misma con y sin ellos).

## 6. Pruebas

- `dev/tests/26-fase14-mundo.js` — 15 pruebas: 150 y 600 semanas sin jugador con invariantes
  semanales, determinismo, guardar/cargar del mundo, rival comprometido, agente libre de punta a
  punta, reemplazo, retiro, ascenso de organización (coherente al entrar a la poda), cambio de
  organización en `CL.npcYear` (coherente al salir del gancho `year`), plantel real sin clones, nombres
  sin repetir, y los tres hallazgos de la regresión (empate y contrato, tono `charisma`, bono del ex
  entrenador) con el resultado forzado.
- Invariantes nuevos en `dev/invariants.js`: `mundo.campeones`, `mundo.rankings`, `mundo.rosters`,
  `mundo.peleadores`, `mundo.identidad` (global: nombre + año), `mundo.agenda`. Los corren todas las
  carreras del arnés, después de cada semana.
- Mutantes de la fase: **20/20 detectados**, cada uno por la prueba de su sistema (ranking sin tope,
  campeón de otra organización, título doble, nadie se corona, contrato que no descuenta, empate que no
  descuenta, clon del plantel real, lesionado programado, retirado activo, rival comprometido programado,
  `CL.npcYear` sin rosters, ascenso sin ranking, agente libre sin pelea, reemplazo de otra división,
  reemplazo sin memoria, mundo sin reposición, mundo que arranca parado, nombre repetido, tono sin fila,
  bono redondeado). Dos lecciones: la prueba F2 · A-001 no respeta `CAGE_FILE` (siempre carga el
  archivo real), así que no sirve para mutantes; y `npcYear-sin-rosters` sobrevivió cuando la
  reposición anual (que también rehace rosters) lo tapaba en la corrida de 150 semanas: se agregó la
  prueba dirigida.
- Regresión sobre el archivo final (`e3bfce85…`): suite 375/375, navegador 89/89,
  `dev/estado-carreras.js` 3/3 (754–816 semanas, recarga en arranque nuevo cada 150),
  `dev/rpg-carrera-completa.js` 3/3 (764–795 semanas, 23 sistemas de invariantes cada semana),
  `dev/recorridos-economia.js` sin diferencias entre lo mostrado y lo cobrado, `dev/tq-inventario.js
  --check` al día.
