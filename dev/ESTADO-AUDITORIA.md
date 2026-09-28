# ESTADO-AUDITORIA — Fase 13: estados, consumidores y sistemas de carrera

Archivo de partida: `c6f1e23` (sha256 `286328b5…0b74`). Herramientas nuevas:
`dev/estado-mapa.js` (análisis sintáctico con acorn de los 56.798 accesos a propiedades del
script + recorrido del estado guardado de una carrera real), `dev/estado-inventario.js` (por qué
existe cada clave y cada huérfana, con su decisión), `dev/estado-carreras.js` (carreras enteras
que recargan la página cada 150 semanas) y `dev/tests/25-fase13-estado.js`.

«No es necesario que todas las variables tengan un efecto jugable. Sí es necesario saber POR QUÉ
existe cada una.» Eso es lo que exige ahora la prueba 25, en las dos direcciones: cada clave de
`G` tiene clase y porqué; cada hoja guardada que nadie lee está declarada, y si alguien la
conecta hay que sacarla de la lista.

## 1. Método

1. **Código.** `estado-mapa.js` recorre el árbol sintáctico real (no cuenta apariciones de un
   nombre): distingue escribir (`a.x=`), leer y escribir (`+=`, `++`), inicializar (`{x:…}`),
   leer (`a.x`), borrar y usar una clave por cadena (`a['x']`, `a[k]` con `k` de una tabla). Cada
   acceso lleva la función que lo contiene. Los alias (`var c=G.camp; c.x`) se resuelven por el
   nombre de la hoja. Un contenedor que el código recorre o indexa con una clave calculada
   (`for-in`, `Object.keys`, `x[k]`) es un **registro dinámico**: sus hijos son datos.
2. **Lector.** Se separa quién lee: el **juego**, la **interfaz**, un **registro** (bitácora,
   diario), una **prueba** o el **saneo** (normalize/migrate/save). Sólo los dos primeros son
   consumidores; leer para mostrar es observabilidad (§4 de la fase).
3. **Estado.** Una carrera de 160 semanas (con plan de gasto y técnicas) junta, cada 4 semanas,
   todas las rutas de `STATE.persistable(G)` (lo que va al disco), con los ids plegados a `*`.
   Resultado: 1.338 rutas, 66 claves de primer nivel. Las del combate se midieron aparte en una
   pelea real (107 claves).
4. **Dinámica.** Lo que el análisis no puede ver se midió jugando: barrido de los 66 eventos y sus
   170 opciones con y sin recargar la página en medio; minijuegos y peleas guardados a medias;
   carrera A → carrera B en la misma sesión contra B en un arranque limpio con el mismo disco;
   y tres carreras enteras que recargan cada 150 semanas en un contexto NUEVO (el arnés ahora
   puede arrancar con un localStorage previo, `H.boot({storage})`, como una recarga de verdad).

## 2. Mapa de estado

Persistencia: **P** persistente · **D** derivable (se guarda, se puede rehacer) · **T** temporal
(interacción en curso, se guarda a propósito para retomarla) · **S** de sesión (no va al disco:
`STATE.RUNTIME_KEYS`). La clasificación completa, clave por clave, está en
`dev/estado-inventario.js` (101 claves de primer nivel).

| Sistema | Estado | Escritor | Consumidor (juego) | Efecto | Persist. | Pruebas |
|---|---|---|---|---|---|---|
| Tiempo y azar | `year`, `week`, `rs`, `nid` | `advanceWeekCore`, `newWorld`, `rnd`, `uid` | todo el motor; `rnd` | calendario, azar reproducible | P | 03, 04 |
| Carrera | `flags`, `offers`, `nextFight`, `meta` | `makeOffers`, `acceptFight`/`scheduleFight`, `META.*` | `validateScheduledFight`, `MGR.score`, `confirmFight` | qué peleas hay y cuánto pagan | P | 15, 16, 20, 25 |
| Jugador | `player` (st, pot, rec, pop, rep, dmg, fatigue, inj, div, org, **beltDivs**) | `applyTrain`, `applyWinLossResult`, `createPlayer`, `divMoveUp` | combate, emparejamiento, eventos, final | todo | P | 01–25 |
| Peleadores | `fighters.*` (rel, mem, bond, cl) | `makeFighter`, `yearTick`, `applyResult`, `addMemF` | `recalcRank`, `makeOffers`, `oppActionBase`, `socCircle` | el mundo y los rivales | P | 19, 25 |
| Mundo | `orgs`, `champs`, `retiredList`, `news`, `rank` | `newWorld`, `worldTick`, `recalcRank`, `pruneWorld` | `makeOffers`, `rankOf`, `championStats` | ranking y títulos | P / `rank` D | 06, 19 |
| Contratos | `contract`, ofertas de contrato | `negoStart/Ask/Close`, `applyWinLossResult` | `makeOffers`, `fightPayout` | bolsa, exclusividad | P | 16, 24 |
| Equipo | `team`, `coaches`, `cl.coach.*` (ph, patience, adv) | `hireCoach`/`fireCoach`, `CL.coachState/Patience` | `trainQuality`, `coachRecs`, `CL.coachOpinion` | calidad de entrenamiento, esquina | P | 24 |
| Mánager | `mgId`, `mgrs[].a` | `changeMgr`, `createPlayer` | `MGR.score`, `negoAsk` | criterio de ofertas, negociación | P | 16, 25 |
| Relaciones | `f.rel` (friend, respect, trust, rivalry, resent), `f.bond`, `soc`, `socCD` | `addMem/F`, `socInvite/Advice`, `chatPick`, `storyReactApply` | `relScore`, `relStage`, `inviteChance`, `socCircle`, `trainQuality` | quién acepta, ayuda o rivaliza | P | 19, 22, 25 |
| Rivalidades | `bond.rc`, `flags.heat`, `flags.wantFight`, `story.chains`, `flags.storyRivalReplyOpp` | `RPG.rivalTick`, eventos (callout, old_rival, escalada), `storyTick` | `makeOffers`, `HEAT.v`, `story_rival_reply` | peleas de rivalidad, bolsa, respuesta del rival | P | 22, 25 |
| Legado | `legacy*`, `ending`, `meta`, disco propio (`legacyData`) | `legacyRegisterRun`, `buildLegacySnapshot`, `META.grant` | `careerEnding`, `scrLegacy`, `legacyApplyRewards` (fx:mods) | salón de la fama, recompensas | P | 25 |
| Personalidad | `rpg.tally`, `rpg.traits`, temple | `RPG.echo` | `RPG.persFromAxes`, ganchos de rasgos | rasgos con efecto | P | 17 |
| Filosofías | `rpg.philo`, `rpg.fp`, `rpg.cp` | `RPG.adopt`, tallies | `mgr:score`, `coach:recs`, `CMB.ultVariantSrc` | criterio del mánager, esquina, sello de la Ultimate | P | 17, 22, 25 |
| Fight IQ | `rpg.fm` (memoria de rivales), `fight.iq` | gancho `fight:applied` «lectura» | `CMB.guess`, `oppActionBase` | lectura del rival, revancha | P | 18, 21, 25 |
| Combate | `fight`, `paid`, `fightPayout`, `lastPayout` | `fightStart`, `fightAct`, `finishFight`, `confirmFight` | la pelea; **`loadGame` (fase 13)** | resultado y cobro | T | 18, 25 |
| Campamento | `camp` (fatigue, sharp, cutPenalty, gameplan, weighDone, pressDone) | `startCamp`, `campWeekCore`, `weighEnd`, `gpConfirm` | `fightStart` (aire y salud), `scrHub` | estado al salir a pelear | P | 22, 25 |
| Economía | `cash`, `careerEarn`, `spons`, `cl.debts`, `cl.spend` | `advanceWeekCore`, `CL.debtAdd`, `fightPayout` | `CL.weeklyLines`, `CL.canAdvance` | caja, deuda | P | 24 |
| Medios | `news`, `story.feed`, `flags.heat`, `cas` (público) | `pushNews`, `feedPush`, prensa, podcast | `socCD` (hilos), `HEAT`, `CL.popSync` | popularidad, ruido | P | 22, 25 |
| Eventos | `pending`, `tmp*`, `cl.evSeen`, `cl.evLog`, `story.eventHistory` | `queueEvent`/`rollEvent`, `x()` | `resolveEventCore`, `eventAdmissible` | decisiones | T / P | 07, 10, 25 |
| Títulos | `champs`, `championSeasonStats`, `titles`, `defenses`, **`beltDivs`** | `applyWinLossResult`, `championStats` | `makeOffers` (defensas), `careerEnding` | cinturón, final | P | 06, 25 |
| Divisiones | `p.div`, `divAdapt`, `weightNow` | **`divMoveUp`**, `changeWeightClass` | `recalcRank`, `makeOffers`, pesaje | emparejamiento, peso | P | 25 |
| Eras | `rpg.era`, `rpg.eraEnds` | ERA (gancho semanal) | tarjetas y diario | época | P | 19 |
| Técnicas | `tq` (un, pts, mast) | `TQ.unlock`, `TQ.use` | `TQ.available`, combate | acciones y techos | P | 21, 22, 25 |
| Ultimates | `rpg.ult` | `CMB.awaken` | `CMB.ultState/ultUse` | acción especial | P | 22, 25 |
| Viajes | `soc`, fatiga | `travelWith`, `gymVisit` | fatiga, relaciones | fatiga y vínculo | P | 23, 24 |
| Patrimonio | `endgame` (owned, projects, investments) | `egBuy`, `egInvest` | `egImpact`, villa, jet | efectos pasivos | P | 23 |
| Tienda | compras (`flags`, `shopOwned`) | `buyItem` | consumidor por artículo | `TIENDA-AUDITORIA.md` | P | 23, 25 |
| Servicios | `cl.spend`, `gameplayLevel`, contenido | `clSetSpend`, `requestGameplayUpgrade` | recuperación, entrenamiento | `ECONOMIA-AUDITORIA.md` | P | 24 |
| Minijuegos | `mg`, `mgStats`, `lastTrainGame` | lanzadores y cierres | el minijuego; promedio de ejecución | — | `mg` T (se guarda, al cargar se descarta) | 25 |
| Casino | `cas`, `casG` | `CAS.*` | `CAS.*` | intocable | P / `casG` S | — |
| Guardado | `saveVersion`, `saveId`, `stKeys`, `_autoTag` | `saveGame` | `saveExpand` | formato | serialización | 03 |

**Grafo ESTADO → ESCRITOR → CONSUMIDOR → EFECTO, por clase** (fase 13 §2):
A — escribe, lee y efecto verificable: la gran mayoría (1.316 de 1.338 rutas guardadas tienen un
lector de juego o de interfaz). B — contable: `careerEarn`, `mgStats`, `championSeasonStats`,
`cl.evLog`. C — lectura sin consecuencia (sólo interfaz): `rel.fear`, `camp.weighDone/pressDone`
(guardas de un botón), `fightPayout`, `lastPayout`. D/E/H — §3. F — consumidor equivocado: el
enganche «memoria» (§3). G — consumidores incompatibles: los que se corrigieron (§5: tope del feed,
tres copias de la subida de categoría, `tmpOpp` de sesión contra `evSanitize` que lo daba por
guardado).

## 3. Huérfanas

Clases: **D** escrita sin lector · **E** leída sin escritor · **H** muerta · **O** observabilidad ·
**S** serialización · **C** sólo interfaz · **F** escritor que llega tarde. «Eliminar» es la
decisión; **no se borró nada en esta fase** (cambia la forma del guardado: se hace en una
limpieza con su propia migración).

| Estado | Clase | Decisión | Por qué |
|---|---|---|---|
| `f.rel.interest` (y del jugador) | D | eliminar | `defRel` lo pone en 40; nada lo lee ni lo mueve. No se convierte en barra. |
| `f.realPeak` | D | documentar | dato de origen del plantel real |
| `gyms[].members` | H | eliminar | la pertenencia vive en `f.gym` |
| `camp.sparDone` | H | eliminar | se crea en 0 y nada lo mueve |
| `G.events`, `G.hist`, `G.seasonEvents`, `G.mgState`, `G.feed` | H | eliminar | vestigios creados vacíos (ya señalados en A-005; `G.feed` lo recorre `socCD` por compatibilidad) |
| `G.rosterVersion` | D | eliminar | nadie consulta la versión del plantel |
| `nextFight.signedAt` | D | documentar | registro de la firma |
| `engineLog[].msg` | O | documentar | bitácora del motor |
| `story.version`, `stKeys` | S | documentar | esquema de la historia / orden de compactación |
| `story.matchupHistory/trainingHistory/mediaHistory/lastEventAt` | H | eliminar | `normalizeStory` las crea y recorta; nadie escribe |
| `story.npcSeeds.*.roundBias` | D | investigar (fase de combate) | la IA la sortea y no la consulta |
| `cl.coach.*.fav` | H | eliminar | se crea en 0 |
| `cl.coach.*.beef` | D | eliminar | el manejador usa el id que viaja en el pendiente |
| `endgame.eventsSeen` | H | eliminar | se crea vacío |
| `_autoTag` | O | documentar | motivo del último autoguardado |
| `lastPayout.debtPaid` | D | documentar | la línea visible ya está en `lines` |
| `flags.lockDiv/lockGym`, `brawler/late`, `mgrIgnored` | D | documentar | marcas; los consumidores leen el modificador / el tipo ya actuó |
| `flags.twoDiv` | D | **eliminada** | su único lector (el final) lee ahora `p.beltDivs` |
| `meta.ach` → `runs[].ach` | D | documentar | omite logros ya desbloqueados en otra carrera y nadie lo lee |
| `legacy.streakBest` ← `p.bestStreak` | E | documentar | nadie escribe `bestStreak` (siempre 0) y nadie lee `streakBest` |
| `G.nextFightPaid`, `fight._clLastPlayerAction` | E | documentar | alternativas preferidas que nadie escribe |
| `fight.p/o.initialStam`, `fight.A`, `fight._clLastOpp` | D | documentar | combate: no se toca |
| `fight.oppSubLock`, `fight.momentum` | H | eliminar (fase de combate) | se crean en 0 y nada los mueve |
| `fight.identity.patterns/styleKey/scoreline` | D | investigar (fase de combate) | la IA usa otros campos del perfil |
| `rel.fear` | C | documentar | se escribe al ganar; sólo lo muestra la interfaz |
| `flags.storyRivalReplyOpp` desde el enganche «memoria» | F | documentar | «memoria» (orden 30) lee `G.tmpOpp` después de que «bitácora» (orden 20) lo limpió; el camino vivo es la cadena `rival_reply` |

**Consumidores falsos** (§4): las lecturas de `relSummary`, `relTags`, `scrHub`,
`payoutCard`, `careerLog`, `saveValidateV4` y las `inv()` se clasificaron como interfaz, registro
o prueba, nunca como consumidores; por eso `rel.fear`, `engineLog[].msg` o `_autoTag` figuran
arriba aunque «alguien los lea».

## 4. Guardar, cargar y empezar de nuevo

- **Inventario** (Persistente / Derivable / Temporal / De sesión): `dev/estado-inventario.js`. La
  lista de sesión es EXACTAMENTE `STATE.RUNTIME_KEYS` (prueba).
- **Desaparecía cuando debía persistir:** `tmpOpp` (§5.1), las cadenas de la historia (§5.5), las
  publicaciones 61–62 del feed (§5.6).
- **Persistencia accidental inocua:** `mg` (minijuego a medias) va al disco y la carga lo descarta;
  medido en los 7 minijuegos del campamento: nada queda bloqueado. Se documenta.
- **Estado imposible después de cargar:** una pelea guardada viva o decidida sin cobrar (§5.2).
- **Duplicación:** ninguna encontrada (la carga es idempotente y punto fijo desde antes: 03).
- **Carrera nueva:** B después de A en la misma sesión es idéntica (huella por bloque y estado) a
  B en un arranque limpio con el mismo disco; la única diferencia contra un disco VACÍO es
  `meta.ach`, que por diseño omite logros ya ganados en otra carrera (§3). Medido en la prueba 25
  y al final de cada una de las tres carreras enteras.

## 5. Promesas rotas y lo que se corrigió

Cada una: texto → estado → consumidor → resultado, y si el roto era el sistema o la descripción.

1. **«La pelea se cae antes de firmarse» después de recargar** (sistema). `tmpOpp` era de sesión;
   los otros diez `tmp*` persistían y `CL.evSanitize` lo validaba al cargar como si se guardara.
   Con el evento en pantalla, guardar y recargar cambiaba 12 de 170 opciones: la pelea de aviso
   corto y la de cinco días se caían, «Pedirle la pelea» no pedía nada, el rival no recordaba lo
   que le dijiste. **Arreglo:** `tmpOpp` persiste. Barrido después: 0 de 170.
2. **Cerrar la app en medio de la pelea congelaba la carrera** (sistema). El autoguardado de
   `fxResolveMini` corre dentro de la pelea: un «Buscar KO/Sumisión» que no la termina la guarda
   viva (24 de 24 intentos medidos). Al cargar se iba al inicio, que no tiene botón para volver
   a una pelea abierta: 20 semanas después la pelea seguía abierta, sin peleas nuevas ni récord.
   Y un intento que SÍ la terminaba la guardaba sin cobrar: `go('hub')` la descartaba — récord y
   bolsa perdidos, la misma pelea otra vez. **Arreglo:** `loadGame` vuelve a `fight` o a
   `fightresult` según corresponda (la pelea guardada está entera: continuarla da el mismo
   resultado que sin recargar). Probado también en Chromium.
3. **Subir de categoría por el pesaje no era subir** (sistema; duplicado). Tres copias de la misma
   subida: la planificada, la forzada y la de emergencia del pesaje (`x9_weight`, «subís a …»),
   que sólo reescribía `p.div`: el campeón seguía siendo dueño del cinturón que dejaba, no entraba
   al ranking de la nueva hasta la semana siguiente y subía sin la adaptación de −8 que cobran las
   otras. **Arreglo:** una sola `divMoveUp`; `changeWeightClass` (voluntaria del campeón) sigue
   aparte con su costo.
4. **«CAMPEÓN EN DOS DIVISIONES»** (sistema). La condición comparaba una división con un estilo
   (siempre distintos) y leía una marca que sólo ponía el pesaje al subir. Lo recibía quien ganó un
   título y después no dio el peso; no lo recibía el campeón que cambió de categoría por la vía
   propia y volvió a ganar. **Arreglo:** el cinturón anota su división (`p.beltDivs`) y el final
   exige dos. En las carreras largas: 2 de 3 terminan así, con cinturones reales en LW y WW.
5. **«Responder públicamente» → «La rivalidad sube un nivel»** (sistema). La respuesta del rival
   (`story_rival_reply`, importante) llegaba por una cadena que se guarda sin `id`; el saneo
   SEMANAL filtraba por `id` y la borraba antes de que la leyera `storyTick`. Nunca salía, ni
   recargando ni sin recargar. **Arreglo:** una cadena vale si tiene tipo.
6. **Cargar la partida borraba publicaciones** (consumidores incompatibles). El feed tenía dos
   topes: 80 al publicar y 60 en el saneo semanal y en la carga, así que la semana cerraba con
   61–62 y cargar borraba las últimas (y sus cierres en `socCD`). Lo encontraron las tres
   carreras largas en su primera recarga. **Arreglo:** un tope, 60 (el que ya regía).

**Promesas de texto que quedan (la descripción, no el sistema; no se reescribe narrativa en esta
fase):** el pesaje dice «Empezás casi de cero en el ranking» y `recalcRank` ubica por mérito (en
las mediciones, 1.º a 3.º de la nueva división). «Pedirle la pelea a la organización» («Puede
aparecer pronto») se concede la mitad de las veces y se mantiene hasta que llega, **pero** si el
rival es alguien con quien peleaste hace menos de un año, la regla anti-repetición descarta la
oferta en silencio y el pedido ya se consumió: **investigar** (¿un pedido explícito debe saltarse
esa regla? es una decisión de diseño).

## 6. Relaciones, mundo, narrativa, personalidad, combate, técnicas

- **Relaciones.** `friend`, `respect`, `trust`, `rivalry`, `resent` tienen consumidores de juego
  (invitaciones, consejo, alianzas, calidad de entrenamiento, rivalidad en el emparejamiento);
  `fear` sólo se muestra; `interest` está muerta. Paciencia y filosofía de los entrenadores:
  conectadas (renuncia, esquina, opinión). Mánager: su personalidad pondera las ofertas y la
  filosofía de carrera del jugador empuja ese criterio (cadena probada con recarga).
- **Mundo y carrera.** Divisiones (§5.3), campeones y defensas (`championStats`), eliminatorias
  (fase 3), reemplazos (`replacementHistory`), retirados (`retiredList`), agentes libres
  (contratos de organizaciones bajas). Cambio de división → el emparejamiento ofrece sólo rivales
  de la división nueva, también tras recargar (prueba).
- **Narrativa.** Lógica separada del texto: §5.5 era lógica (la cadena), el ranking «casi de
  cero» es texto. Memorias, historia de eventos y categorías recientes tienen topes coherentes
  entre quien escribe y el saneo (sólo el feed no los tenía).
- **Personalidad y filosofías.** No son multiplicadores sueltos: la de carrera cambia el criterio
  del mánager, la de combate ordena la esquina y elige el sello de la Ultimate (cadena probada
  con recarga).
- **Combate.** 107 claves de una pelea real: 99 con lector de juego; las 8 restantes, en §3. No se
  tocó el combate (no hubo una rotura demostrada que lo pidiera).
- **Técnicas y Ultimates.** Persisten y se usan después de recargar (prueba: desbloquear → recargar
  → la técnica está disponible en la pelea y cambia la pelea).

## 7. Pruebas

- `dev/tests/25-fase13-estado.js` — 22 pruebas: inventario contra el análisis (dos direcciones),
  carrera larga «cargar = lo guardado», evento pendiente con recarga (todos los que usan `G.tmp*`),
  pelea viva y sin cobrar al cargar, minijuego a medias, las tres subidas iguales y el
  emparejamiento posterior, el final de dos divisiones, carrera nueva sin herencia, y las cadenas
  de la fase — comprar→cargar→efecto, filosofía→pelea, rivalidad→oferta, mánager→criterio,
  campamento→combate, derrota→memoria→revancha, título→legado→mundo, técnica→combate, contestar
  en público→respuesta del rival — cada una con una recarga en el medio.
- `dev/estado-carreras.js` — 3 carreras enteras (751–825 semanas) con el jugador completo de
  `rpg-carrera-completa.js`, cambios de mánager y de división, recarga en arranque nuevo cada 150
  semanas (15 recargas, 10 con un evento en pantalla) y la carrera siguiente en la misma sesión.
- Navegador: cerrar la página con la pelea a medias y «Cargar partida» vuelve a la pelea (4 tamaños).
- Resultado: suite 360/360, navegador 89/89, `estado-carreras` 3/3 (15 recargas, 2 finales de dos
  divisiones con cinturones reales, carrera siguiente limpia en las tres), `rpg-carrera-completa`
  3/3, `recorridos-economia` sin diferencias, `tq-inventario --check` al día, mutantes 19/19 (§8).
- Golden: trazas regeneradas con cada divergencia atribuida contra `c6f1e23` (ver `CHANGES.md`
  RPG-11): 101 y 404 con traza idéntica; 202 por la subida unificada (pesaje, 2017 s5); 303 y 505
  porque la respuesta del rival ahora existe (escalada respondida en público, 2018 s29 y 2016 s35).

## 8. Mutantes por familia (19/19 detectados)

Cada mutante es una copia del juego con UN cambio; se corre `--solo ESTADO-13` contra ella.

| Familia | Mutantes | Lo detecta |
|---|---|---|
| estado huérfano | un campo nuevo en el campamento sin lector; una clave nueva en `G` sin declarar | el inventario contra el análisis (las dos pruebas de §1) |
| consumidor eliminado | el final sin leer `beltDivs`; el emparejamiento sin leer el pedido; la Ultimate sin leer la filosofía; el mánager sin personalidad | dos divisiones; rivalidad → oferta; filosofía → pelea; mánager → criterio |
| escritor eliminado | el cinturón sin anotar su división; la memoria del rival sin escribirse | dos divisiones; derrota → memoria → revancha |
| condición invertida | la carga manda a la pelea cuando ya terminó; la subida vacía el cinturón cuando NO es del jugador | pelea viva/sin cobrar; subidas (sobrevivió la primera vez: la prueba sólo subía campeones; se agregó el caso del que no lo es) |
| persistencia eliminada | `tmpOpp` otra vez de sesión; `beltDivs` perdido al cargar; las cadenas filtradas por `id` | inventario y barrido de eventos; dos divisiones con recarga; respuesta del rival con recarga |
| reset eliminado | `newWorld` hereda las marcas de la carrera anterior | carrera nueva sin herencia |
| UI desconectada | la carga siempre al inicio | pelea viva y pelea sin cobrar |
| efecto eliminado | la subida sin adaptación; el corte sin efecto en el aire | subidas; campamento → combate |
| incompatibles / duplicado | el feed con dos topes otra vez; el pesaje con su copia vieja | carrera larga «cargar = lo guardado»; subidas y huérfanas a mano |
