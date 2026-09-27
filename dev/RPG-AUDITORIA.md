# RPG — Fase 1: auditoría antes de tocar

> Encargo: *consolidar → descubrir → conectar → profundizar → expandir* sobre el
> CAGE LEGACY que existe. Este documento es el inventario sobre el que se decidió
> qué conectar y qué crear. Todo lo que dice "medido" tiene su comando al lado.
> Las cifras de línea son de `index-4-blindado.html` en el commit de la auditoría
> y se mueven con cada cambio: buscar por nombre, no por número.

---

## 0. De qué código se parte (y en qué estado venía)

Hay **dos** candidatos a "código actual":

| candidato | origen | `node dev/run-tests.js` |
|---|---|---|
| `index-4-blindado.html` en `00be0a4` | último merge del repo (refactor E1–E5) | **193 / 193 verdes** |
| `CAGE_LEGACY_refactor_coherente_FINAL.html` | lo subió el usuario con este encargo | **131 verdes · 62 rojas** |

Se parte del **archivo subido** —es el que el usuario llama actual— y se versiona
tal cual (`7058abb`) para que su procedencia quede trazada. Añade sobre el repo una
capa de integridad de carrera (`scheduleFight`, `validateScheduledFight`, elegibilidad
de título a 5 peleas, temporada del campeón, reemplazos), el save **v5** y la ruta de
estilos en `simFight`. Su propia batería interna (`TESTS.all`) sí pasaba: 32/32
invariantes, 21/21 escenarios, determinismo PASS. La suite del repo no.

### Las 62 rojas, por causa raíz

| # | causa | pruebas | tipo |
|---|---|---|---|
| B-1 | `offerKeyFor()` y `validateScheduledFight()` leen el **`G` global** dentro de la migración v4→v5 y de `saveValidate`, que trabajan sobre `g` **antes** de que la partida sea `G`. Desde la portada `G` es `null` → `TypeError` → `loadGame` devuelve `false`. **Ninguna partida con una pelea firmada se podía abrir.** Desde otra partida, validaba contra el mundo equivocado. | fixture 02, save congelado ×2, inventarios E3 ×2 | **bug crítico del juego** |
| B-2 | `titleEligibility`: copia guardada de `proFightCount(f)` que **nadie lee**; nace en 0, no se actualiza, y la carga la recalcula → guardar y cargar altera los ~430 peleadores. | I3, "guardar→cargar→continuar" | bug (derivado sin dueño) |
| B-3 | Toda pelea exige organización. El agente libre tiene UNA vía de pelea documentada (módulo 27, "acepto lo que sea" → show regional): la oferta se mostraba y fallaba al aceptarla. | — (sin prueba propia) | bug del juego |
| B-4 | Las fixtures de 25 pruebas firmaban peleas de un agente libre contra "el primer peleador de la división", que ya no es una pelea legal. | 45 | fixture de prueba |
| B-5 | F-002 escribía a mano "la versión al día es 4". | 1 | fixture de prueba |
| B-6 | Golden master: `simFight` suma `combatStyleRoute`, cambia `x9_weight`, el gameplan admite un entrenador, el campeón tiene tick semanal. **Cambio de juego deliberado del archivo subido.** | 5 | regenerar con justificación |
| B-7 | Ofertas añadidas por los suscriptores de `offers:made` (rivalidad, revancha, gimnasio, "acepto lo que sea"…) no pasaban por la regla: se veían y fallaban al aceptar. | — | bug del juego |

Corregido en el commit `[base-fix]` (ver `dev/CHANGES.md`, entrada RPG-00).

---

## 1. Mapa de sistemas

`CL.mods` lista 33 módulos registrados; hay 35 pantallas en `CL.SCREENS`, 25 tarjetas
en `CL.hubCards`, 69 eventos de hook distintos, 66 eventos en `EVENTS`, 25 handlers
serializables en `CL.EVH`, 36 técnicas en `TQ.T` y 41 artículos en `SHOP`
(medido con `dev/`-style harness: `CL.SCREENS`, `CL.hubCards`, `HOOKS`).

Cada fila: **dónde vive la verdad** · qué la muta · cómo persiste · quién la dibuja.

### Combate
| sistema | fuente de verdad | mutación | persistencia | render |
|---|---|---|---|---|
| intercambio | `G.fight` (transitorio) | `fightAct` → `resolveExchange`; hooks `act:*`, `exchange:*`, `combat:eff`, `gp:mod`, `combat:oppPick` | viaja en `G.fight` | `scrFight` + filtros `screen:fight` |
| distancia/ritmo/lectura | `G.fight.cl` (`CL.fightCtx`) | `CL.effMod`, `CL.combatBonus`, `CL.postExchange` | transitorio | `CL.advice` |
| recursos de estilo | `CL.MOVES` (10) | `act:translate` | — | `fight:options` |
| técnicas especiales | `G.tq` (`TQ.S`) — 36 nodos, L1–L4, PERFECT/GOOD/FAIL (`TQ.grade`) | `TQ.unlock`, `TQ.use`→`TQ.resolve`→`TQ.apply` | `G.tq` | pantalla `tq`, panel en pelea |
| puntos de técnica | `TQ.award` (+3 KO/SUB, +2 unánime, +1 mayoritaria/dividida, +1 título, +1 perfecta; techo 5) | hook `fight:applied` | `G.tq.pts` | tarjeta de recompensa |
| IA del rival | `oppActionBase` + `CL.oppPick` + `identidadRival` (arquetipo, `playerPatterns`) | `combat:oppPick` | `G.story.npcSeeds` | log |
| resistencia/KO/sumisión | `RES` | `exchange:post`, `fight:finish:pre` | — | log |
| gameplan | `G.camp.gameplan` / `unifiedGameplan` | `gpConfirm`, consejo de esquina `gpCouncil` | `G.camp` | minijuego `gp` |

### Carrera
| sistema | fuente de verdad | mutación | persistencia |
|---|---|---|---|
| ofertas | `G.offers` | `makeOffers` + `offers:made` (pisoDeBolsa 10, CL 20, meta 30, antiRepetición 40, **puertaFinal 99**) | `G.offers` |
| pelea firmada | `G.nextFight` con **setter validado** (`installNextFightGuard`) | `scheduleFight`, `reconcileScheduledFight`, `cancelScheduledFight` | `G.nextFight` |
| resultado | `applyPlayerFight` (transacción) | `fight:pre` / `fight:applied` | `p.career`, `p.rec`, `lastFights` |
| títulos y temporada | `G.champs`, `G.championSeasonStats` | `applyWinLossResult`, `championSeasonTick` | ambos |
| matchmaking con historia | `CL.offerAnalysis`, `CL.extraOffers` | `offers:made` | — |
| liga mayor | `CL.ufc()` | `CL.ufcWeek` | `G.cl.ufc` |
| derrota → encrucijada | `CL.afterLoss` → `loss_cross` | `CL.ask` | `G.pending` |
| contratos/mánager | `G.contract`, `G.mgId`, `askManagerRaise`, `requestPromoterChange` | pantalla contratos | `G.contract`, `G.flags.raise*` |

### Identidad y personaje (lo que YA existe)
| pieza | dónde | qué hace |
|---|---|---|
| personalidad declarada | `p.pers` + `p.pers2` (8 rasgos, `PERS`) | se elige en la creación; `persW`, `CL.PERSX` la conectan a coach, mánager, prensa, ofertas |
| identidad de pelea | `CL.identity(f)` | lee cuerpo+estilo+stats+edad+gym: "Contragolpeador", "Presión de volumen"… |
| evolución de estilo | `CL.EVO` (14) + `CL.evoCandidates` | variantes con requisitos reales |
| estilo observado | módulo 25 (`observado`) | compara lo que elegiste con lo que hacés |
| etapa de carrera | `CL.stage` (6 etapas) | prime 27–36 |
| legado | `legacyScore`, `CL.legacyExtra`, `META.timeline`, `META.stories` | puntaje, marcas, línea temporal, etiquetas |
| memoria narrativa | `G.story.memories` (`remember`, **local al IIFE**), `G.story.fightHistory`, `CL.S().threads` | decisiones y resultados con fecha |
| relación con NPC | `f.rel` (friend/respect/trust/rivalry/resent/fear), `f.bond` (train/spar/chat/adv/clash/fought/defended + partner/mentor/ally/rival), `f.mem`, `f.cl.arc` | etiquetas derivadas `relTags` |
| NPC ↔ NPC | `CL.rel2`, `CL.bond2`, `CL.npcYear` | amistades/rivalidades entre seguidos |
| coaches | `CL.PHILO` (6 filosofías), paciencia, `coach_beef`, `coach_quit`, `COACH_PHIL` por especialidad | opinan y se van |

### Vida, medios, mundo
| pieza | dónde |
|---|---|
| presupuesto social semanal | `G.socWeek` (`socSpend`, `socCap`) + enfriamientos `G.socCD` |
| acciones sociales con UI | `socInvite`, `socAdvice`, `chatStart`, feed (`G.story.feed`) |
| medios | `CL.S().media` (calor), `CL.mediaTier`, prensa (`pressStart`), feed contextual |
| tienda | `SHOP` (41), `buyItem`, `G.flags.shop` |
| casino | `CAS` — **intocable** por decisión anterior (H-012) |
| mundo | `G.news`, `G.rank`, `CL.tracked()` (24 NPC seguidos), `CL.npcYear` |
| eras | **no existe** como sistema: sólo `startYear` y el plantel histórico |

---

## 2. Contenido huérfano (medido)

### 2.1 Funciones completas sin ninguna entrada de interfaz
`grep` de llamadores fuera de su definición y de la lista de autoguardado (`GATE.want`):

| función | qué hace | llamadores |
|---|---|---|
| `allyForm(id)` | propone una alianza (interacción MAYOR); si acepta, `bond.ally` | **0** |
| `travelWith(id)` | viaje con un amigo: relación, contactos, fight IQ, gimnasios | **0** |
| `watchFight(id)` | ir a ver una pelea: lectura del rival (`G.soc.intel`), respeto | **0** |
| `podcastStart(kind)` | podcast con preguntas construidas del historial real (`pod` minijuego ya dibujado) | **0** |

`scrSocial()` sólo ofrece **"Invitar a entrenar"** y **"Pedir un consejo"** por persona.

### 2.2 Estructura con consumidor y sin productor
| pieza | consumidores | productor |
|---|---|---|
| **eliminatorias** (`spec.elim`) | `fightSpecProblem` (rango ≤12, elegibles), `issueChampionOpportunity` cuenta `elims`, texto "Elegible para título/eliminatoria" | **ninguno**: ninguna oferta nace con `elim:true` |
| `G.flags.trilogyOpp`, `G.flags.polemicalOpp` | filtro de repetición de rivales | **ninguno** |

### 2.3 Banderas que se escriben y nadie lee (26)
`analyst, apt, betterDeal, brawler, calloutTitle, considerDivisionChange, dirtyMoney,
divTalk, dualGym, eliteCampBoost, eliteCampWeek, estate, fixed, foundation, freeAgent,
jet, late, lockDiv, lockGym, needCheapGym, stylist, teamCamp, videoWall, villa, wantMgr,
wantTitleRematch` (script en el commit de la auditoría: escrituras `G.flags.X =` sin
lecturas).

Las que prometen algo al jugador y no lo cumplen:

| bandera | promesa textual | estado |
|---|---|---|
| `analyst` (6.800) | "Antes de cada pelea ves una debilidad del rival" | inerte |
| `teamCamp` (42.000) | "Todos los entrenadores trabajan sobre un único plan durante el próximo camp" | inerte (sólo +5 fightIQ al comprar) |
| `videoWall` (78.000) | "Mejora scouting, lectura de rivales y calidad de gameplan" | inerte (sólo +3 fightIQ) |
| `eliteCampWeek/Boost` (28.000, repetible) | "cambia el enfoque de las próximas 6 semanas: mejor calidad, más fatiga" | inerte |
| `chef` (9.500 + 650/sem) | "menor caída de energía y mejor corte" | **sólo cobra** |
| `lockGym` (modificador "Un solo gimnasio", ×1,20 de puntaje) | "No podés cambiar de gimnasio en toda la carrera" | **no se aplica**: se puede cambiar y se cobra el multiplicador |
| `lockDiv` (modificador "Sin cambiar de peso", ×1,10) | "Nunca podés cambiar de categoría" | **no se aplica** |
| `short` (modificador "Carrera corta", ×1,15) | "Te retirás obligatoriamente a los 32" | **no se aplica**: el jugador nunca se retira solo (H-007) |
| `wantTitleRematch` | "El campamento empieza a girar alrededor de recuperar lo que perdiste" | inerte |
| `calloutTitle` | "Ahora la organización tiene una pelea que vender" | inerte |
| `considerDivisionChange` | "La derrota abre una puerta…" | inerte |

### 2.4 Llamada muerta
`reconcileScheduledFight` hace `if(typeof remember==='function') remember(...)`, pero
`remember` es local al IIFE de narrativa: **nunca se registra un reemplazo en la memoria**.

---

## 3. Duplicados y ambigüedades que afectan a lo que se va a construir

| tema | situación | decisión |
|---|---|---|
| "memoria" | cuatro almacenes: `G.story.memories` (decisiones), `G.story.fightHistory`, `CL.S().threads` (hilos), `f.mem`/`f.cl.arc`/`f.bond.hist` (por persona) | **no se crea un quinto para "lo que pasó"**. Los ecos de decisión se escriben en `G.story.memories` con un escritor público; el journal LEE los cuatro. |
| personalidad | fija (`p.pers`) | la emergente se DERIVA de los ecos; no reemplaza `p.pers` (lo leen 30+ sitios) |
| identidad | `CL.identity` (combate) y `META.stories` (relato) | la identidad de carrera las combina; no las reemplaza |
| lectura en combate | `c.read` existe y crece con Fight IQ/paciencia, pero **no muestra nada que el jugador pueda usar** salvo "la contra está disponible" | Fight IQ se construye sobre `c.read` y los patrones reales de la IA |
| consejo de esquina | `coachRecs` + `gpCouncil` (consenso) | las opiniones enfrentadas del camp salen de `COACH_PHIL` y `CL.PHILO`, no de un sistema de diálogo nuevo |

---

## 4. Dependencias clave (cadena real)

```
aceptar oferta ── acceptFight ─▶ scheduleFight ─▶ G.nextFight (setter validado)
      │                                   └──▶ startCamp ─▶ G.camp
semana ── advanceWeek ─▶ hookEmit('week') ─▶ CL.week, championSeasonTick, storyTick…
camp   ── campWeek ─▶ camp:week:pre/post ─▶ pilares, partners
pelea  ── goFight ─▶ fightStart ─▶ fight:start ─▶ fightAct ─▶ act:translate ▸ act:pre ▸
          oppAction(combat:oppPick) ▸ resolveExchange(gp:mod, combat:eff, exchange:*) ▸ act:post
cobro  ── confirmFight ─▶ applyPlayerFight (TX) ─▶ fight:pre ▸ applyWinLossResult ▸ fight:applied
          ─▶ TQ.award, memoria narrativa, CL.afterLoss, medios, gimnasio
guardar ── saveGame ─▶ hook 'save' (normalizeWorldState) ─▶ STATE.persistable ─▶ localStorage
cargar  ── loadGame ─▶ saveShape ▸ saveMigrate(v1..v5) ▸ saveValidate(g) ▸ G=g ▸ normalizeRuntime
          (installNextFightGuard + reconcileScheduledFight) ▸ hook 'load'
```

---

## 5. Riesgos para el trabajo que sigue

1. **Golden master**: la huella cubre TODO el estado persistible; cualquier estado nuevo
   la cambia aunque el juego no cambie. Se separa "huella" de "traza observable" para
   poder demostrar neutralidad (ver `dev/rpg-neutralidad.js`).
2. **El autopiloto no pisa** el árbol de técnicas, el minijuego de finalización ni la
   interfaz social: lo que se construya ahí necesita pruebas propias.
3. **`render()` no puede consumir RNG** (B-001): toda lectura nueva en pantalla usa
   `pickStable` o texto determinista.
4. **Casino intocable**: no se engancha nada dentro de `CAS`.
5. **`remember()` es local**: exponer un escritor público en vez de duplicar el almacén.

---

## 6. Estado al cerrar la etapa (verificado con pruebas, no declarado)

| pieza (sección) | estado | dónde se prueba |
|---|---|---|
| `allyForm`, `travelWith`, `watchFight` (2.1) | con entrada en la ficha social, según la etapa de la relación | `16-rpg-accesos.js` |
| `podcastStart` (2.1) | con pantalla propia (`scrPod`) y entradas desde Vida y la ficha de un rival | `16-rpg-accesos.js` |
| eliminatorias (2.2) | las produce el mánager (`MGR.push`); ganarla deja la pelea por el título | `16-rpg-accesos.js` |
| `trilogyOpp`, `polemicalOpp` (2.2) | con productor al terminar una pelea | `16-rpg-accesos.js` |
| `analyst`, `videoWall` (2.3) | scouting con la tendencia REAL del rival (`CL.oppWeightsFor`) y +6 de lectura | `18-rpg-combate.js` |
| `teamCamp` (2.3) | +2 al gameplan con 2+ entrenadores; tercera vía en el desacuerdo de plan | `16`, `19` |
| `eliteCampWeek/Boost` (2.3) | la promesa se cumple con `eliteCampAt` (6 semanas); las dos banderas viejas quedan escritas sin lector | `16-rpg-accesos.js` |
| `chef` (2.3) | −2 desgaste y −0,35 lb por semana de camp | `16-rpg-accesos.js` |
| `lockGym`, `lockDiv`, `short` (2.3) | `metaLock()` en todas las vías voluntarias; retiro a los 32 | `16-rpg-accesos.js` |
| `wantTitleRematch`, `calloutTitle` (2.3) | producen la revancha por el título / la defensa contra el retador | `16-rpg-accesos.js` |
| `considerDivisionChange`, `divTalk`, `betterDeal`, `freeAgent`, `wantMgr`, `dirtyMoney`, `fixed`, `dualGym` | cumplidas (RPG-05) | `20-rpg-promesas.js` |
| `remember` local (2.4) | `CL.remember` público; lo usan ecos, maestría, eras y el reemplazo de un rival | ecos: `17-rpg-identidad.js`; el camino del reemplazo **no tiene prueba dedicada** |
| «lectura» sin uso (3) | Fight IQ sobre `c.read` con la distribución real del rival | `18-rpg-combate.js` |
| eras (1, "no existe") | `ERA`, derivadas de `G.champs` | `19-rpg-campo-mundo.js` |
| `G.flags.heat` (fase 10; no figuraba en 2.3 porque cada escritura lo leía para sumarse, pero ninguna **decisión** lo leía) | consumido por el emparejamiento: las peleas de rivalidad/revancha pagan +4 % por punto (tope +30 %); con 4+ se arma la del rival con más rivalidad; firmarla gasta el ruido; se enfría 3 % por semana | `22-fase10.js` |
| `CL.ufc().heat` (fase 10: segundo «heat», escrito y enfriado, sin lector) | la bienvenida de Vanguard escribe en `G.flags.heat`; el enfriamiento propio se retiró (el campo queda en partidas viejas, sin uso) | `22-fase10.js` |
| `gp.def` «Defensa principal» (fase 10: sólo sumaba al puntaje del plan) | cuenta en el intercambio en que el rival hace eso (`gpDefShift` por `combat:eff`, +3 a esa defensa) | `22-fase10.js` · A/B de 400 peleas por defensa |
| `f.tq.back` toma de espalda (fase 10, del árbol) | posición `TQ.back()`: suelo +6, sumisión del árbol ×1,15, +1 de control por intercambio | `22-fase10.js` |
| ciclo de rivalidad (fase 10: derivado en cada consulta, sin «medios» ni resolución) | `RPG.rivalFacts` (lector puro) + `RPG.rivalTick` (avance guardado en `bond.rc`, `bondNote`, `CL.remember`, diario); la resolución es `canOfferRematch` | `22-fase10.js` |

**Siguen escritas sin lector** (no prometen una consecuencia futura: son marcas de compra o de
tipo de carrera): `apt`, `villa`, `estate`, `jet`, `foundation`, `stylist`, `brawler`, `late`,
`needCheapGym` (su lectura se reemplazó por `CL.cheapGym`), `eliteCampWeek`, `eliteCampBoost`.

**Bugs del juego encontrados durante la etapa** (además de B-1…B-7): el rival elegía acciones
que no existen en la posición (RPG-03); peleadores nacidos a mitad de carrera sin `f.cl` (guardar
y cargar cambiaba el mundo, RPG-03); `saveReplacer` compacta toda clave `st`/`pot`/`lr` (RPG-02);
dos pantallas movían el RNG o creaban estado al dibujarse (RPG-01); el instrumento de rendimiento
no medía el peor caso (RPG-05).
