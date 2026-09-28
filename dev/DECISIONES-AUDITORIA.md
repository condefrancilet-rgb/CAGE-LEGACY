# DECISIONES-AUDITORIA — Fase 15: decisiones, agencia y bucle RPG semanal

Archivo de partida: `5c4396b` (sha256 `e3bfce85…5391d3a`). Herramienta nueva: `dev/decisiones.js`
(modos `eventos`, `semana`, `camp`, `identidad`, `equipo`, `manager`, `builds`). Pruebas nuevas:
`dev/tests/27-fase15-decisiones.js`.

**Cómo se mide.** Cada decisión se toma donde el jugador la encuentra: se corren carreras y cada
vez que aparece un evento se guarda la partida. Desde esa misma partida se resuelve CADA opción con
el mismo azar (números aleatorios comunes: `G.rs` se fija antes y después). Se registra qué cambió
del estado guardado, clasificado por tipo (recurso con dirección, relación, memoria narrativa,
oportunidad, identidad, equipo, texto), y los recursos 8 semanas después con la misma política.
- **Falsa:** dos opciones que dejan el mismo estado (salvo textos) en todas las muestras.
- **Dominada:** una opción igual o peor en todo recurso con dirección, sin consecuencia propia de otro
  tipo, en todas las muestras. Cada stat es su propia dimensión: disciplina no compra confianza.
- **Con contexto:** ninguna de las dos.

## 1. El bucle semanal (Parte 1)

`fin de semana → estado → decisiones → trabajo de la semana → mundo → combate/eventos → recompensas → consecuencias → siguiente semana`

1. **Estado visible** (inicio): caja, desgaste, daño, lesión, peso, ranking, pelea firmada (rival,
   bolsa, rounds, semanas), campamento (filo, desgaste del camp, peso, gameplan), ofertas, evento pendiente.
2. **Decisiones libres de la semana** (no consumen la semana): aceptar oferta (`acceptFight`), pedir
   pelea (`askFight`), negociar contrato (`negoStart/negoAsk/negoClose`), mánager (`MGR.follow/ignore/push`,
   `askManagerRaise`), tienda y patrimonio (`buyItem`, `egBuy`, `egInvest`), plan de gasto (`clSetSpend`),
   foco (`focusSet`, `clSetFocus`), vida social (`socInvite`, `chatStart/chatPick`, `storyReact`,
   `CL.takeInvite`) con presupuesto social semanal (`socCap`: 1–6 según personalidad, popularidad,
   lesión y campamento), técnicas (`TQ.unlock`), filosofía (`RPG.adopt`), lecciones (`CMB.takeLesson`),
   evolución de estilo (`clEvoAccept/Reject`), equipo (`changeCoach`, `hireCoach`, `fireCoach`,
   `changeMgr`, `gymJoin`, `gymVisit`), división (`forceDivUp`, `changeWeightClass`), contenido
   (`contentDrop/contentBoost`), deuda (`CL.debtPayNow`), retiro (`confirmRetire`).
3. **El trabajo de la semana** (consume la semana, UNA por semana): 9 trabajos estándar (`doWeek`),
   «semana tranquila» (`skipWeek`), 4 minijuegos (`sparStart`, cardio/fuerza/drills arcade que terminan
   en `tgResolve`), gameplan en campamento (`gpStart/gpSet/gpConfirm`), semana de recuperación tras una
   pelea (`recStart/recPick`), o avanzar en bloque (`advancePeriod`, `autoAdvanceToImportant`).
4. **Mundo** (`advanceWeekCore`): pelea firmada revalidada, mundo, títulos, ofertas, campeón; el
   jugador recupera desgaste (−8−recuperación/12), daño −5, lesión −1 semana, la fecha de pelea −1,
   gasto semanal, ganchos `week` (capa CL: personalidad, prensa, promesas, rivales…).
5. **Eventos**: el sorteo del banco (66 estáticos, ~12 % de las semanas, 3 niveles de veda) y los
   dinámicos de la capa CL (`CL.ask`, 34 manejadores). Una sola decisión en cola a la vez.
6. **Pelea** cuando `nextFight.weeks ≤ 0` (pesaje → conferencia → pelea → cobro), por calendario, no
   por semanas de campamento trabajadas.
7. **Consecuencias**: récord, bolsa, ranking, cinturón, contrato, lesión, memoria de rivales, rasgos
   y filosofía (capa RPG), técnicas, reputación/popularidad, relaciones.

## 2. Inventario de decisiones (Parte 2)

| Decisión | Opciones | Coste | Riesgo | Beneficio | Consecuencia futura | Sistema |
|---|---|---|---|---|---|---|
| Trabajo de la semana (estándar) | 9 trabajos + tranquila | la semana; desgaste +5 a +16 (×intensidad) | lesión 0–3,5 % base, ×(1+desgaste/90); medido 0–8 % por semana | stats de su tabla (`TRAIN.w`), filo en camp | stats permanentes; desgaste que resta ganancia (×0,75 sobre 55, ×0,45 sobre 75) | entrenamiento |
| Trabajo de la semana (minijuego) | sparring, cardio, fuerza, drills (+ gameplan en camp) | más desgaste que el estándar si se juega bien | igual que su trabajo, ×intensidad | bien jugado: +50–100 % de stats; mal jugado: menos que el estándar | igual; el sparring cambia la confianza (±3) | entrenamiento |
| Recuperación / tranquila | recuperar, semana tranquila | la semana | ninguno | −15 a −28 de desgaste; en camp: −7,5 de desgaste del camp | en camp, recuperar cuesta 2 de filo y la tranquila congela el campamento | desgaste, campamento |
| Aceptar oferta | una de las de la mesa (ver ficha) | el calendario (campamento) | derrota, lesión | bolsa, ranking, título | contrato consumido, rival en memoria, revancha | carrera |
| Negociar contrato | 5 pedidos | riesgo de romper la negociación | que la organización se retire | bolsa y bono | peleas del contrato (no vence, ver §3) | contratos |
| Consejo del mánager | seguir, ignorar, presionar, revancha | relación (no se lee) | ninguno mecánico | la oferta que su codicia/honestidad/ambición elige | eco RPG (lealtad/ambición) | mánager |
| Gameplan | prioridad × distancia × ritmo × defensa (+ consejo de esquina) | una semana de camp | plan equivocado resta (medido) | +2 a +9 a las acciones que nombra | puntaje del plan (lectura del rival) | campamento → pelea |
| Conferencia de prensa | 4 preguntas × 4 tonos | — | calor (rivalidad) | popularidad, reputación, hype | personalidad puede derivar (arrogante/profesional) | medios |
| Evento del banco | 2–3 opciones | varía (caja, desgaste, relación) | varía (azar en algunas) | varía | marcas leídas después (`scouted`, `mentor`, `betterDeal`, `freeAgent`…), memoria, cadenas | eventos |
| Evento dinámico (CL) | 2–4 opciones | varía | varía | varía | relaciones, rivalidades, equipo, contratos | capa CL |
| Técnica | nodo del árbol (36, 4 ramas) | puntos de técnica | — | acción/pasiva nueva | irreversible; habilita Ultimates | técnicas |
| Filosofía de combate/carrera | asumir en público | cambiar después cuenta como negarla | la esquina reacciona (±paciencia) | identidad | rasgos, esquina, prensa | RPG |
| Cambiar de entrenador | cualquiera | el viejo pierde confianza (−12) | — | especialidad, calidad | la confianza pesa en lo que rinde el entrenamiento | equipo |
| Cambiar de mánager | cualquiera | ninguno mecánico | — | comisión, contactos, criterio | — | equipo |
| Mudarse de gimnasio | cualquiera que te acepte | 2 cuotas; no en campamento | rechazo por reputación | atributos del gimnasio, techos +1 | reputación en cada casa | equipo |
| Subir de división | forzada/planificada | adaptación, ranking | cuerpos más grandes | peso natural | bajar exige ser campeón | carrera |
| Social | invitar, chatear, reaccionar | presupuesto social semanal | rechazo | relación, invitaciones | amigos, rivales, bandos | relaciones |
| Compras | tienda, patrimonio, inversiones | caja | deuda | el consumidor de cada compra (fase 11) | permanentes | economía |
| Retiro | colgar los guantes | la carrera | — | legado | irreversible | legado |

## 3. Decisiones dominadas (Parte 3)

**Eventos** (barrido de 4 carreras × 400 semanas; 52 decisiones medidas en su contexto real; 2 muestras
de azar; dominada = en TODAS las carreras donde apareció). 15 eventos con una opción dominada:

| Evento | Opción dominada | La domina | Clase |
|---|---|---|---|
| `coach_talk` | «Cambiar de tema y seguir entrenando» (nada) | «Escuchar y aceptar» (+disciplina, +confianza del coach) | neutra gratis |
| `gym_politics` | «Mantenerte al margen» (nada) | «Mediar» (+compostura, +confianza) | neutra gratis |
| `fan_moment` | «Firmar rápido y seguir» (nada) | «Pasar media hora con él» (+confianza, +pop) | neutra gratis |
| `young_prospect` | «Decirle que no tenés tiempo» (nada) | «Entrenarlo» (+fight IQ, +paciencia, marca `mentor`) | neutra gratis |
| `cl_press_defense` | «Decir que el legado se verá al final» (nada) | las otras dos (+pop) | neutra gratis |
| `contract_dispute` | «Dejar que tu manager lo maneje» (nada si sus contactos ≤ 70) | «Presionar públicamente» | con contexto: con contactos > 70 da +20 % en el próximo contrato |
| `x8_dojo` | «Dejar que vaya otro» (nada) | «Invitarlos a entrenar» (+adaptabilidad, +rep) | neutra gratis |
| `rival_coach` | «Confiar en tu plan original» (−2 al plan) | «Enfocarte en imponer tu juego» (+2 confianza) | mala opción |
| `journo` | «Ignorarlo» (+1,5 rep) | «Invitarlo a ver un sparring» (+1,5 pop, +2 rep) | dominada estricta |
| `doping_rumor` | «Ignorar» (40 %: −4 rep) | «Publicar tus controles» (+4 rep) | mala opción |
| `x11_test` | «Pedir esperar unas horas» (−3,5 rep) | «Filmar el procedimiento» | mala opción |
| `x13_street` | «Seguir de largo» (−3 confianza) | «Llamar a emergencias» (+compostura, +rep) | mala opción (moral) |
| `x5_cancel` | «Pedir disculpas aunque no fue así» (−3 confianza, −2 rep) | «Grabar y publicar el video» | mala opción |
| `x6_spy` | «Cambiar el gameplan por completo» (borra tu plan) | «Filtrar información falsa» (+4 al plan, +2 IQ) | **premisa sin consecuencia** (§13) |
| `cl:prom_fix` | «Ignorarlo» (−3 confianza, −4 compostura) | «Denunciarlo ahora» (+pop, +rep) | mala opción |

**Trabajo de la semana** (mismo azar, 24 muestras, 3 contextos × 2 carreras):
- **«Semana tranquila» está dominada por «Recuperación» fuera del campamento.** Cuestan la misma semana
  y la recuperación descansa más: desgaste −27,5 contra −23,2 estando cansado; con el desgaste ya en el
  piso quedan iguales. **En campamento no está dominada:** la tranquila congela el campamento (0 filo,
  0 desgaste del camp) y la recuperación descansa (−7,5) a costa de 2 de filo.
- **«Grappling» fuera del campamento dio 0 en las dos carreras.** Lo dominan boxeo, trabajo mental y
  recuperación. Es el redondeo de §4: en ese punto de la carrera sus ganancias son menores a 0,5 y se
  pierden. En campamento rinde (+3).
- Los minijuegos jugados mal (fuerza −, drills −) quedan dominados por casi todo el trabajo estándar.
  Es el diseño: jugar bien rinde más que el estándar y jugar mal, menos.

**Plan del campamento** (§12): «contra» ganó más que los otros planes contra los dos perfiles de rival
(58/47 % y 23/28 %). Es candidata a dominancia **de la acción** en el motor de combate, no del plan: queda
para la fase 16.

## 4. Decisiones falsas (Parte 4)

- **Banco de eventos: 0.** Forzando cada una de las 173 opciones de los 66 eventos desde dos partidas
  fijas (con campamento y plan, y libre), ninguna deja el mismo estado que otra opción del mismo evento.
  Tampoco si se ignora la memoria narrativa. En su contexto real (barrido), 0 pares falsos.
- **Conferencia de prensa: 6 respuestas falsas (corregido).** Las respuestas de tono `charisma` no
  tenían fila en las tablas: primero daban `NaN` (fase 14) y después 0. Ahora rinden como el tono gracioso
  (ver Cambios).
- **Consecuencias informadas que no ocurren (corregido):**
  - el texto del entrenamiento anunciaba ganancias que no pasaban. En 10 años: +769 anunciado, +429
    real; el 82 % de las líneas «+0,x» no movía la stat, y las de 0,5–1,5 se inflaban un 33 %;
  - la ficha de personalidad mostraba una barra «Con tu manager» que ninguna regla lee.
- **Contextuales:** `cl_finwarn` «Pedirle un adelanto» y «Seguir así» quedan iguales cuando ya pediste
  un adelanto hace poco. Es una regla, no un defecto.

## 5. Recursos en conflicto (Parte 5)

| Recurso | Compite con | Evidencia |
|---|---|---|
| Tiempo (una acción por semana) | entrenar ↔ recuperarse ↔ minijuego ↔ gameplan ↔ recuperación posterior a la pelea | `doWeek`, `skipWeek`, `mgClose(true)` y `recPick` consumen la semana; el resto no |
| Desgaste | ganancia (×0,75 / ×0,45) y riesgo de lesión (×(1+desgaste/90)) | prueba: cansado (85) rinde menos y se lesiona más que fresco (20) con el mismo azar; sparring 8 % → 21 % |
| Filo del campamento | desgaste del camp y peso | en camp: sparring +9 filo / +14 desgaste; recuperar −2 filo / −7,5; tranquila 0/0 |
| Dinero | compras ↔ plan de gasto ↔ cuota del gimnasio ↔ deuda | el aviso financiero ofrece bajar de gimnasio; las mudanzas cobran 2 cuotas |
| Relaciones | confianza del entrenador ↔ confianza propia (discutir), lealtad ↔ ambición (mánager) | `coach_talk`, `gym_politics`, `mgr_conflict` |
| Reputación ↔ popularidad | tonos de prensa (arrogante: +pop −rep; humilde: −pop +rep) | tablas de `pressPick` |
| Vida social | presupuesto social semanal (`socCap` 1–6) | la personalidad cambia el presupuesto (reservado 2, carismático 4) |
| Riesgo | minijuegos bien jugados (más ganancia, más desgaste) ↔ estándar | §3 |

## 6. Coste de oportunidad (Parte 6)

Sí existe, con recursos que ya estaban:
- la semana: una sola acción que la consume;
- el campamento: la fecha es fija y cada semana de tranquila o de recuperación es filo que no se gana;
- el presupuesto social;
- la caja;
- la confianza del entrenador que dejás.

Donde **no** hay coste:
- cambiar de mánager (la relación no se lee);
- las opciones neutras dominadas de §3.

No se agregó ningún coste nuevo.

## 7. Plazos de las consecuencias (Parte 7)

- **Corto (la semana):** stats, desgaste, filo, caja, popularidad, reputación, relación.
- **Medio (semanas):** marcas que la próxima oferta o evento leen:
  - `betterDeal` (+20 % en el próximo contrato);
  - `freeAgent` (oferta de otra organización);
  - `scouted`, `mentor`, `planDivUp` (`body_divup`);
  - cadenas: la respuesta del rival (`story_rival_reply`), la investigación del patrocinador turbio;
  - desgaste arrastrado.
- **Largo (años):** técnicas, rasgos y filosofía (capa RPG), identidad oficial, reputación en cada
  gimnasio, memoria de los rivales y del entrenador, legado, división, contrato.
- **Desaparecen al final de la semana:**
  - los textos;
  - la memoria narrativa de las opciones neutras;
  - la tranquila fuera del campamento cuando el desgaste ya está en 0.

## 8. Información y decisión (Parte 8)

| Decisión | Qué se sabe antes | Incertidumbre |
|---|---|---|
| Aceptar oferta | estilo, edad, OVR, racha del rival, bolsa, semanas, motivo | resultado de la pelea |
| Gameplan | informe cualitativo del rival (`scoutReport`), opinión del entrenador (puntaje → frase) | el puntaje es una lectura, no un pronóstico: «contra» recibió 0 y fue el plan que más ganó (§12) |
| Fight IQ | capa de lectura cualitativa (fase 9) | no muestra pesos internos |
| Mánager | su consejo y sus advertencias (honestidad) | no muestra su puntuación |
| Entrenador | especialidad, calidad, «te conoce» | la filosofía (su plan preferido) se descubre en el camp |
| Contratos | base por pelea, cantidad de peleas | la organización puede retirarse |
| Entrenamiento | ahora informa la ganancia real | antes informaba fracciones inexistentes (corregido) |

## 9. Personalidad (Parte 9)

8 carreras idénticas salvo la personalidad (misma semilla y política, 208 semanas):
- **Conflictos por carácter:** arrogante 5, agresivo 6, impredecible 4; el resto 0.
- **Presupuesto social:** carismático y gracioso 4, reservado 2.
- **Paciencia de la esquina:** se mueve cada semana según `PERSX.coach`. Probado con el gancho
  aislado: humilde > arrogante.
- **Prensa:** multiplicador de popularidad por personalidad y ×1,35 cuando el tono coincide con ella.
- **Tipo de ofertas:** «show» o «mérito», con popularidad o reputación.
- **Deriva:** calor alto (≥7) → arrogante; respeto alto (≥6) → profesional.
- **Lo que NO hace:** ningún evento del banco mira la personalidad, y la barra «con tu mánager» no hacía
  nada (quitada). El resto de las diferencias de carrera (récord, caja) es divergencia caótica de la
  semilla, no atribuible.
- **Filosofía:** asumirla en público le importa a la esquina (+8 paciencia si coincide con la del
  entrenador, −6 si no; probado).

## 10. Mánager (Parte 10)

Sus atributos se leen:
- **contactos:** apalancamiento en la negociación, aumentos, «dejalo en sus manos»;
- **codicia:** qué oferta te recomienda;
- **honestidad:** si te avisa de una pelea riesgosa;
- **ambición:** también pesa en su consejo;
- **comisión:** caja.

**Pesan por su consejo** (seguir / ignorar / presionar), que es una decisión del jugador. Seis carreras
que sólo cambiaban de mánager y no usaban el consejo: con contactos 70 y 78, la **misma carrera** salvo
la comisión. **Lo que falta:**
- la relación con el mánager (confianza, respeto, amistad) no la lee ninguna regla, así que despedirlo
  no cuesta nada;
- el contrato no vence, así que nunca hay renovación que negociar (pendiente de la fase 14, para la de
  economía).

No se creó nada paralelo.

## 11. Entrenador (Parte 11)

Es un sistema de decisión, no sólo de bonos:
- la especialidad y la calidad cambian lo que rinde cada trabajo (probado: lucha con especialista en
  lucha > con especialista en golpeo);
- la confianza pesa en la calidad (dejarlo y volver rinde menos; probado);
- su filosofía reacciona a la tuya (±paciencia) y aconseja el trabajo de la semana (+1,2 de paciencia si
  lo seguís);
- en campamento propone su plan y discute el tuyo (`camp_split`).

8 carreras cambiando sólo el entrenador: OVR 57–63; la paciencia y la identidad cambian.

## 12. Campamento (Parte 12)

Dos partidas base × 60 peleas por celda, mismo azar, rival ajustado a dos perfiles de nivel parecido
(lado fuerte +12, débil −12 respecto del jugador), jugador que pelea su plan:

| Plan | vs fajador (1601 / 1637) | vs luchador (1601 / 1637) |
|---|---|---|
| striking | 13 % / 5 % | 17 % / 10 % |
| counter | 58 % / 47 % | 23 % / 28 % |
| wrestling | 55 % / 42 % | 18 % / 23 % |
| grappling | 45 % / 35 % | 18 % / 23 % |
| clinch | 25 % / 28 % | 15 % / 15 % |

- **El rival cambia qué plan conviene:** wrestling rinde +42/+37 puntos más que striking contra el
  fajador y +1/+13 contra el luchador.
- **El plan tiene que pelearse:** plan de lucha peleando de pie 7/3 %, contra 17/3 % sin plan; con plan
  de lucha peleando de lucha 55/42 %, contra 52/30 % sin plan.
- **El puntaje del plan lee al rival** (probado: atacar su derribo suma 3 si lo tiene flojo).
- **Pendiente para la fase 16:** «counter» rinde alto contra los dos perfiles, y el puntaje del
  entrenador le dio 0.

## 13. Eventos (Parte 13)

- **Siempre mejor:** las 15 dominadas de §3. En 7 la dominada es la opción neutra («no hacer nada») y
  en 6 es la opción mala a propósito (moral o impaciente).
- **Premisas sin consecuencia:**
  - `x6_spy` (el rival tiene tu sparring);
  - `rival_coach` (el rival cambió de entrenador);
  - `sg_counterplan`: el rival entrena contra tu arma y `counterPlan` no lo lee nadie.

  Ninguna de las tres llega a la pelea. Por eso «Cambiar el gameplan por completo» es un coste puro y
  «Rehacer el gameplan desde cero» castiga la respuesta sensata. La conexión natural existe (la
  adaptación inicial del rival, como el ex entrenador +12) pero es combate: se deja para la fase 16 con
  esta evidencia.
- **Sin consecuencia:** ninguna opción del banco (0 falsas).

## 14. Progresión (Parte 14)

- Construye personaje: las técnicas de ramas distintas, los rasgos, la identidad oficial y la filosofía
  difieren por perfil (§15).
- **Hallazgo de progresión (no corregido aquí, medido):** las stats son enteras (`cap` redondea), así
  que las ganancias < 0,5 se pierden y las de 0,5–1,5 se inflan. En 10 años (520 semanas): +769
  anunciado, +429 real, OVR 71. Con un acumulador de fracciones: +655 real, **OVR 79**. Los pesos
  secundarios de cada trabajo (juego de pies en boxeo, velocidad…) están muertos y la progresión se
  estanca cuando el margen al potencial baja de ~19. Es una decisión de curva de poder: fases 21 y 27.
  Aquí sólo se corrigió que la pantalla mienta.

## 15. Builds (Parte 15)

Cinco carreras de 10 años (misma semilla) que eligen distinto en entrenamiento, pelea, compras,
prensa, vida social, técnicas y eventos. Resultados en `BUILDS_TABLA`.

## 16. Repetición (Parte 16)

`REPETICION`

## 17. Agencia (Parte 17)

`AGENCIA`

## 18. Reversibilidad (Parte 18)

| Reversible (gratis) | Costosa | Irreversible |
|---|---|---|
| mánager (la relación no se lee); foco; plan de gasto; gameplan antes de confirmarlo | entrenador (confianza del que dejás); gimnasio (2 cuotas, reputación, no en campamento); filosofía (cambiarla cuenta como negarla); división hacia arriba (volver exige ser campeón) | técnicas; evolución de estilo; retiro; cinturón perdido; memoria de los rivales; contratos firmados |

La mezcla existe. La única reversión que no cuesta nada y debería costar algo es la del mánager: es
de la fase de relaciones.

## 19. Decisiones de alto impacto (Parte 19)

**Bien señalizadas:**
- pelea por el título (tarjeta dorada, 5 rounds);
- pelea obligatoria;
- negociación (minijuego con base y peleas);
- mudanza (cuota y beneficios visibles, fase 12);
- técnica (costo y efecto en la ficha);
- retiro (pantalla de confirmación);
- subida de categoría forzada (botón explícito).

**Sin señal:**
- cambiar de entrenador y de mánager es un solo toque, sin confirmación y sin mostrar qué se deja;
- asumir una filosofía no avisa que tu esquina puede reaccionar.

Van a las fases de equipo (23) y de interfaz (28).

## 20. Dominancia según el contexto (Parte 20)

- **Tranquila contra recuperación:** dominada fuera del campamento; con contexto dentro (congela filo
  contra descansar).
- **Plan del camp:** el óptimo cambia con el rival.
- **«Dejalo en manos de tu mánager»:** dominado con un mánager sin contactos; con contactos > 70 es la
  opción que mejora el próximo contrato.
- **Minijuego contra estándar:** el minijuego gana si se juega bien, el estándar es más seguro.
- **Tonos de prensa:** coincidir con tu personalidad multiplica ×1,35.

## 21. No balancear a ciegas (Parte 21)

No se agregaron costes, penalizaciones, cooldowns, monedas ni energía. La curva de progresión (§14) se
midió y se deja para su fase.

## 22. Interactividad (Parte 22)

Oportunidades que refuerzan decisiones que ya existen (no implementadas):
1. que el video filtrado, el cambio de entrenador del rival y el campamento en tu contra lleguen a la
   pelea como adaptación inicial del rival (fase 16);
2. que el cambio de entrenador o de mánager muestre qué se pierde antes de confirmar (fase 28);
3. que la respuesta del rival a una provocación pública no dependa del sorteo general (hoy puede no
   llegar nunca: 635 semanas habilitada y 0 veces en 5 carreras; fase 25).
