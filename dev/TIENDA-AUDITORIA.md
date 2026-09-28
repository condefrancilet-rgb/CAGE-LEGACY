# Auditoría de la tienda — fase 11

Qué se compra, dónde se escribe, quién lo lee y qué pasa en la carrera. Se auditó el archivo
de `fbece34` (sha256 `a40dc3fa…5458`). Toda afirmación de «lo lee» está verificada en
`dev/tests/23-fase11-tienda.js`, que **compra** cada artículo y mide la consecuencia con el
consumidor real (no con la función que la aplica).

Estados: **VERIFICADO** (compra → estado → lector → efecto), **MARCA CONTABLE** (se escribe y
no necesita consumidor: está dicho por qué), **CONECTADO EN F11** (era promesa sin consumidor),
**CORREGIDO EN F11** (la promesa no tenía ningún sistema que la sostuviera y el texto se ajustó a
lo que la compra hace), **REPARADO EN F11** (contenido muerto o bug).

## 1. Dónde se compra

| superficie | cómo se llega | cómo se compra | dónde queda |
|---|---|---|---|
| Tienda (`SHOP`, 41 artículos: base 16 + extendida 14 + extras 11) | Vida → 🛒 Tienda | `buyItem(id)` → `shopCan` (una vez / `ok` / plata) → cobra `it.p` → `G.flags.shop[id]++` → `it.f()` | `G.flags.*` |
| Patrimonio y legado (`ENDGAME`: 3 propiedades, 2 transportes, 3 proyectos) | Tienda → 💎 Endgame (con $100.000+) | `egBuy(tipo,id)` → cobra → `G.endgame.owned[id]=1` (+ `projects[id]`) | `G.endgame` |
| Inversiones (`ENDGAME.investments`, 3) | la misma pantalla | `egInvest(id)` → capital comprometido | `G.endgame.investments` |
| Servicios sueltos | semana de recuperación (fisio), gimnasios (visitar, mudarse), círculo (viajar, ir a ver), contenido (producción), contratos (experiencia de carrera), deudas, plan de gasto | cobran y aplican el efecto en la misma acción | — |
| Casino | intocable | — | `CAS` |

## 2. Hallazgo principal: ocho artículos no se podían comprar

`scrShopPrev` (orden 20) rehace la pantalla de la tienda desde cero con cinco categorías fijas.
El filtro que agregaba **Tecnología** y **Negocios**, la tarjeta de actividades y la línea de
ingreso pasivo corría antes (orden 10) y su salida se tiraba. Desde el archivo original subido
(`532b639`) no había ningún botón para `lightboard`, `vrrig`, `forceplate`, `altitude`,
`investdesk`, `ownGym`, `restaurant` ni `academy` (de la tienda), y tres actividades jugables
(muro de reacción, simulador VR y mesa de inversiones) no se podían desbloquear. **REPARADO:** la
tienda dibuja todas las categorías que haya en `SHOP` y el filtro corre después (orden 25).

## 3. Las seis marcas conocidas

| compra | promesa (texto del juego) | flujo antes | primera ruptura | decisión | después |
|---|---|---|---|---|---|
| `apt` Departamento premium, 150.000 | «Base permanente en una ciudad clave» · `eff:'recovery', v:3` · la tarjeta decía «+recuperación logística» | cobra → `owned.apt` → `egTick` −1 fatiga/sem ✔ · además `G.flags.apt` | `G.flags.apt`: espejo que nadie lee | **A** (el consumidor existía, en `owned`) + espejo eliminado | −1 fatiga/sem (sale de `v/3`); la descripción lo dice |
| `villa` Villa de lujo, 500.000 | «descansar, recibir gente y mejorar recuperación» · `v:6` · la tarjeta decía «recuperación superior» | −1 fatiga/sem, **igual que el departamento** · «recibir gente» sin lector · `G.flags.villa` espejo | «superior» y «recibir gente» terminaban en nada | **B** | −2 fatiga/sem (`v/3`); en «Invitar a entrenar», la reticencia de quien no abre su gimnasio (`persW(accept)<1`) deja de pesar: vienen a tu casa, y el resultado lo dice |
| `estate` Mansión, 1.500.000 | «Una propiedad de legado. Abre eventos y proyectos de largo plazo» | +1 reputación/año ✔ · eventos: ninguno · `G.endgame.eventsSeen` creado y nunca usado desde el original | «abre eventos» no tiene ningún sistema: no existe un solo evento de lujo ni de mansión en el juego | **A** + **D** (texto) | +1 reputación por temporada (sale de `v`); el texto dice eso; se ve en «Impacto actual» (antes no aparecía) |
| `jet` Jet compartido, 750.000 | «Reduce penalizaciones de viaje y abre eventos de lujo» | −0,25 daño/sem (efecto genérico) · los viajes que existen (visitar un gimnasio: +10 fatiga; viajar con un compañero: +8) no lo leían · `G.flags.jet` espejo | «penalizaciones de viaje» sin lector; «eventos de lujo» sin sistema | **B** + **D** (texto) | los dos viajes cansan la mitad (`travelFatigue`); la plata y la semana no cambian; la pantalla de gimnasios muestra la fatiga del viaje; se conserva el −0,25 de daño/sem y ahora se muestra |
| `foundation` (`fund`) Fundación, 250.000 | «Contribuye al legado y genera historias de nuevos talentos» | noticia anual ✔ · legado: nada · `G.flags.foundation` espejo | «contribuye al legado» sin lector | **B** + espejo eliminado | cuenta en el perfil de legado como obra (`RPG.LEGADO_OBRA` = 30, lo mismo que ya valía el gimnasio comunitario) → «El Constructor» |
| `stylist` Estilista, 9.500 | «+8 de popularidad y mejores respuestas en prensa» | +8 ✔ · `G.flags.stylist` sin lector | «mejores respuestas en prensa» sin lector | **B** | cada aparición en medios (conferencia o podcast, `media:done`) rinde +1,5 de popularidad y el registro de la aparición dice por qué |

## 4. Compras adicionales encontradas (parte 8)

| compra | problema | estado | decisión |
|---|---|---|---|
| 8 artículos de Tecnología/Negocios | inalcanzables (§2) | CONTENIDO MUERTO | **REPARADO** |
| `restaurant` | «También te distrae un poco»: nada lo aplicaba | PROMESA SIN CONSUMIDOR | **B**: −0,5 de filo por semana de camp, con línea en el registro del camp |
| `documentary` | «puede abrir una pelea estelar»: nada | PROMESA SIN CONSUMIDOR | **B**: la coestelar de PPV que ya existía (`CL.extraOffers`, al azar) la abre el documental en las 16 semanas siguientes, con las mismas condiciones (liga grande, popularidad > 35, rival que vende), una vez por documental, sin azar; se gasta sólo si la oferta sobrevive a los filtros |
| `recoverylab` | «Reduce el coste de recuperar fatiga/daño entre camps»: sólo se cumplía «entre rounds» | PARCIAL | **B**: la fisio de la semana de recuperación cuesta la mitad y la pantalla (la del tablero, que no mostraba precio) lo dice |
| `mediahouse` | «habilita piezas de alto impacto»: la pieza especial ya estaba con la cámara | PROMESA SIN SISTEMA | **D** (texto): lo que hace es subir dos niveles la producción, y eso sí rinde más |
| `eg:academy` Academia de prospectos, 900.000 | «algunos pueden aparecer después en el mundo»: ningún mecanismo crea peleadores desde la academia | PARCIAL | **B** «formás talentos» → perfil de legado «El Maestro» (+30) · **D** «aparecer en el mundo» (no se inventa un generador de peleadores) |
| `gym_upgrade` Centro de alto rendimiento | encendía `G.flags.legacyGym`, la marca del **gimnasio comunitario**: +0,5 reputación/sem, +30 al legado y noticias de «tu gimnasio comunitario» que el jugador nunca compró | CONSUMIDOR FALSO | **REPARADO**: su efecto prometido (+0,35 filo/sem de camp) queda; el cruce se quita |
| `driver` (tienda) + `eg:driver` | los dos escriben `G.flags.driver`; con el transporte privado, el chofer se cobraba y no hacía nada | COMPRA DUPLICADA | **REPARADO**: el chofer no se vende a quien ya tiene transporte privado (al revés sí: el transporte suma su propio −1/sem) |
| `vault` | «Guarda patrimonio separado»: `G.flags.vaultCash` escrito y nunca leído ni mostrado | MARCA CONTABLE invisible | **C** documentada y **visible** en «Impacto actual»; la renta también entra en «Ingreso pasivo» |
| `egBuy` rama `vault` | `if(id==='vault')` en el patrimonio, donde no hay bóveda | CÓDIGO MUERTO | eliminado |
| `SHOP_TIER.cryro` | clave mal escrita; `cryo` caía al valor por defecto, que es el mismo | cosmético | corregido |
| «Mejorar experiencia de carrera» (`requestGameplayUpgrade`) | el comentario hablaba de multiplicadores en los minijuegos que no existen; al jugador no le promete eso | comentario falso | comentario corregido; el efecto real (+1,2 adaptabilidad y Fight IQ) no cambia |

## 5. Marcas contables legítimas (sin consumidor, a propósito)

| marca | por qué no necesita consumidor |
|---|---|
| `G.flags.shop[id]` | registro universal de compra: lo lee `shopCan` (no recomprar lo que es de una vez) y la tienda (×n) |
| `G.endgame.owned[id]` de los proyectos | registro de propiedad: lo lee `egBuy` (no recomprar) y el botón «ADQUIRIDO» |
| `G.flags.eliteCampWeek` | semana suelta del camp de élite, reemplazada por `eliteCampAt` (se rompía al cambiar de año); queda para partidas viejas |
| `G.flags.vaultCash` | valor del patrimonio de la bóveda: no se gasta ni se retira; se muestra |
| `G.endgame.eventsSeen` | contenedor vacío desde el original; nunca prometió nada al jugador. No se quitó para no cambiar la forma del guardado |
| `CL.SPEND[*].rep` / `.inj` | campos de configuración del plan de gasto sin lector; los textos del plan no prometen reputación ni lesiones |

## 6. Inventario completo (tienda y patrimonio)

| compra | precio | promesa | consumidor | efecto observable | estado |
|---|---|---|---|---|---|
| physio | 1.200 · rep. | −25 daño, −15 fatiga | la compra | los valores | VERIFICADO |
| cryo | 3.500 · rep. | −35 fatiga, +2 recuperación | la compra | los valores | VERIFICADO |
| surgery | 14.000 · rep. | cura la lesión | la compra | lesión fuera | VERIFICADO |
| nutri | 2.600 | el corte castiga menos | `applyWinLossResult`, `fightPayout` | multa por peso 10 % en vez de 20 % | VERIFICADO |
| strength | 5.200 | +8 % ritmo en fuerza y cardio | la compra (`lr`×1,08) + `train:adjust` | ritmo y sesiones | VERIFICADO (ver §7) |
| psych | 4.200 | +6 temple, +4 confianza | la compra | los valores | VERIFICADO |
| analyst | 6.800 | una debilidad del rival | `CMB.confOf('video')`, scouting | lectura de video (2) | VERIFICADO |
| pr | 3.800 | +10 pop y más por victoria | `fightPayout` | línea «Agente de prensa (+12 %)» | VERIFICADO |
| camera | 2.400 · rep. | produce contenido | `CL.contentProduce` | tarjeta del equipo de contenido | VERIFICADO |
| lawyer | 7.500 | más poder de negociación | `askManagerRaise` (umbral −8) | resultado del pedido | VERIFICADO |
| car / house / family | 22.000 / 120.000 / 38.000 | atributos | la compra | los valores | VERIFICADO |
| privgym | 46.000 | +10 % ritmo en todo | la compra | ritmo | VERIFICADO |
| sparteam | 9.000 · rep. | +4 timing, defensa, Fight IQ | la compra | los valores | VERIFICADO |
| cutman | 5.600 | menos daño tras la pelea | `applyWinLossResult` (×0,72) | daño acumulado | VERIFICADO |
| cryoroom | 26.000 | actividad de crioterapia | hub/tienda → `fameStart('cryoflow')` | la actividad | VERIFICADO |
| masseur | 8.800 | fatiga semanal | `shopWeekly` (−5) | fatiga | VERIFICADO |
| sleeplab | 15.500 | +5 recuperación, +4 temple | la compra | los valores | VERIFICADO |
| lightboard | 19.000 | actividad de reacción | `fameStart('reactwall')` | la actividad | REPARADO (inalcanzable) |
| vrrig | 34.000 | simulador VR | `fameStart('vrspar')` | la actividad | REPARADO (inalcanzable) |
| forceplate | 12.500 | +10 % ritmo | la compra | ritmo | REPARADO (inalcanzable) |
| altitude | 17.500 | +6 cardio, +3 resistencia | la compra | los valores | REPARADO (inalcanzable) |
| studio | 16.000 | transmisión | `fameStart('stream')` | la actividad | VERIFICADO |
| stylist | 9.500 | +8 pop, mejores respuestas en prensa | la compra + `media:done` | +1,5 pop por aparición, dicho en la aparición | CONECTADO EN F11 |
| sponsor | 0 (pop 45+) | cobro semanal | `shopWeekly` (+420; se cae con pop < 30) | caja | VERIFICADO |
| investdesk | 28.000 | actividad de inversión | `fameStart('invest')` | la actividad | REPARADO (inalcanzable) |
| ownGym | 150.000 | ingreso fijo, +8 % ritmo | `shopWeekly` (+900) + la compra | caja, ritmo | REPARADO (inalcanzable) |
| restaurant | 85.000 | ingreso, +6 pop, te distrae | `shopWeekly` (+520) + `camp:week:post` | caja; −0,5 filo/sem de camp, dicho en el camp | REPARADO + CONECTADO EN F11 |
| academy (tienda) | 52.000 | ingreso menor, +10 rep, +5 paciencia | `shopWeekly` (+260) + la compra | caja, valores | REPARADO (inalcanzable) |
| recoverylab | 18.000 | fisio entre camps más barata; mejor entre rounds | `recPhysioCost` + `endRound`/`RES` | $600 en la semana de recuperación; más aire entre rounds | CONECTADO EN F11 (la mitad que faltaba) |
| elitecamp | 28.000 · rep. | 6 semanas de mejor calidad y más fatiga | `train:mod`, `train`, `camp:week:post` | sesiones y registro del camp | VERIFICADO (+ marca `eliteCampWeek`) |
| nutritionchef | 9.500 (+650/sem) | menos desgaste, mejor corte | `camp:week:post` | desgaste y peso | VERIFICADO |
| mediahouse | 24.000 | producción de más nivel | `CL.contentProduce` (calidad) | hype y pop por producción | CORREGIDO EN F11 (texto) |
| documentary | 65.000 · rep. | historia pública; puede abrir una pelea estelar | la compra + `offers:made` | pop/rep/hype; oferta «EL DOCUMENTAL LA VENDIÓ» | CONECTADO EN F11 |
| coachcamp | 42.000 | un único plan | `gp:confirm` (2+ entrenadores) | +2 al plan | VERIFICADO (`16-rpg-accesos.js`) |
| videoWall | 78.000 | scouting de más calidad | `CMB.confOf('video')`, scouting | lectura de video (3) | VERIFICADO |
| driver (tienda) | 36.000 | fatiga en semanas de pelea | `luxury` (−2 con 3 semanas o menos) | fatiga | VERIFICADO; ya no se vende duplicado |
| penthouse | 300.000 | comodidad, prestigio, descanso | la compra + `advanceWeekCore` (×1,2) | valores y descanso | VERIFICADO (`10-bugs-abiertos.js`) |
| legacygym | 180.000 | talentos y oportunidades | `luxury` (+0,5 rep/sem, noticias) + legado | reputación, perfil «El Constructor» | VERIFICADO |
| vault | 750.000 | patrimonio separado y renta | `luxury` (renta) | renta; patrimonio visible | VERIFICADO + MARCA CONTABLE visible |
| apt | 150.000 | base, recuperación | `egTick` | −1 fatiga/sem | VERIFICADO (espejo eliminado) |
| villa | 500.000 | descanso, recibir gente | `egTick` + `inviteChance` | −2 fatiga/sem; invitaciones | CONECTADO EN F11 |
| estate | 1.500.000 | propiedad de legado | `egTick` | +1 rep/temporada | VERIFICADO + CORREGIDO (texto) |
| eg:driver | 90.000 | desgaste logístico, semanas de pelea | `egTick` + `luxury` | −1/sem y −2 en semanas de pelea | VERIFICADO |
| jet | 750.000 | penalizaciones de viaje | `travelFatigue` + `egTick` | viajes a mitad de fatiga; −0,25 daño/sem | CONECTADO EN F11 + CORREGIDO (texto) |
| gym_upgrade | 350.000 | mejores campamentos | `egTick` | +0,35 filo/sem de camp | VERIFICADO; cruce eliminado |
| eg:academy | 900.000 | formás talentos | legado + `careerEnding` (mentor) + noticias | «El Maestro»; cierre de carrera | CONECTADO EN F11 + CORREGIDO (texto) |
| fund | 250.000 | legado e historias | legado + `egTick` (noticia anual) | «El Constructor»; noticia | CONECTADO EN F11 |
| inversiones ×3 | 250.000–1.000.000 | ganancia o pérdida al vencer | `egTick` | liquidación y noticia | VERIFICADO |

## 7. Ambigüedades que se dejan como están (con evidencia)

- **Preparador físico (`strength`)** promete «+8 % de ritmo en fuerza y cardio» y entrega dos
  veces: multiplica el ritmo (`lr`×1,08, también en resistencia y recuperación) y además suma +8 %
  a cada sesión de fuerza o cardio (`train:adjust`). Cumple de más, a favor del jugador; tocarlo
  sería cambiar el balance.
- **Noticias de la academia y del gimnasio comunitario**: `CL.once` es una vez por SEMANA, así que
  «la academia descubre a un prospecto» puede salir hasta ~18 veces por año (35 % semanal) y la del
  gimnasio comunitario ~9 (18 %). Es la frecuencia que escribió el autor; no se cambia en esta fase.
- **Patrocinio (`sponsor`)** es de una vez: si se cae por popularidad < 30, no se puede volver a
  firmar. El texto dice «mientras seas relevante» y no promete lo contrario.
- **Dos compras con el mismo id `academy`** (la academia para chicos de la tienda y la academia de
  prospectos del patrimonio) viven en almacenes distintos (`G.flags.shop` y `G.endgame`); no chocan.

## 8. Regresión: qué cambia en una carrera, y por qué exactamente

- **Golden** (5 carreras del autopiloto, que no compran): traza, huella y estado final idénticos a
  `fbece34` (`node dev/rpg-neutralidad.js --ref <fbece34>`).
- **Carrera que compra** (A/B contra `fbece34`, 60 semanas, semillas 101/202/303, la compra en la
  primera semana y después el autopiloto):

| compra | traza | primera divergencia | clase |
|---|---|---|---|
| departamento, mansión, jet, fundación, estilista, laboratorio, documental, academia de prospectos, bóveda | idéntica (3/3) | — (el autopiloto no da conferencias, no viaja, no invita, juega en una liga chica, no elige fisio; el legado no entra en la traza) | — |
| villa | cambia | la fatiga de la semana en que el −2 supera al −1 (p. ej. 19,29 → 17,29) | INTENCIONAL |
| restaurante | cambia | la vida en la pelea siguiente al camp (p. ej. 40,61 → 40,43), por el −0,5 de filo por semana | INTENCIONAL |
| centro de alto rendimiento | cambia | desde la semana 4: el gimnasio comunitario que encendía por error tiraba un dado por semana (noticia al 18 %) y sumaba reputación; sin él, el azar se corre | BUGFIX |

  Atribución probada: con el cruce del centro restaurado, su carrera es idéntica (3/3); con el
  cruce, la villa y el restaurante restaurados, la carrera que compra las 13 cosas a la vez es
  idéntica a `fbece34` (3/3).
