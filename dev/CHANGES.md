# CHANGES — cambios intencionales de comportamiento

Sólo entran aquí los cambios que el jugador puede observar. Cada uno con su
evidencia (sim antes/después o test que lo reproduce).

---

# ETAPA RPG — consolidación e integración sistémica

> Las entradas de esta etapa van arriba, la más nueva primero. El inventario que
> las motivó está en `dev/RPG-AUDITORIA.md`.

## RPG-13 · Fase 15: las decisiones deciden algo
**Tipo:** auditoría de decisiones y agencia, más cuatro correcciones de información o repetición
· **Cambio observable:** sí. El entrenamiento informa lo que realmente cambió; las respuestas
carismáticas de la prensa rinden; la ficha de personalidad ya no muestra una barra de mánager que no
hace nada; la investigación del patrocinador turbio sale una vez y no cada semana y media. Archivo de
partida: `5c4396b` (sha256 `e3bfce85…5391d3a`). Auditoría en `dev/DECISIONES-AUDITORIA.md`;
herramienta en `dev/decisiones.js`.

**Medido:** cada decisión donde el jugador la encuentra, con el mismo azar para todas las opciones
(4 carreras × 400 semanas, 52 decisiones en contexto; 173 opciones del banco forzadas en dos partidas;
trabajo de la semana en 6 contextos × 24 muestras; plan del camp en 2 partidas × 60 peleas por celda;
personalidad, entrenador y mánager en carreras idénticas salvo esa elección; 5 builds de 10 años).
- **0 decisiones falsas** en el banco de eventos.
- **15 eventos con una opción dominada:** 7 neutras gratis, 6 malas a propósito, 1 que depende del
  mánager, 1 con premisa sin consecuencia.
- **«Semana tranquila» dominada por la recuperación fuera del campamento** (en campamento no).
- **El plan óptimo cambia con el rival:** lucha contra striking, +42/+37 puntos contra un fajador y
  +1/+13 contra un luchador.

**1. El entrenamiento informa lo que pasó.** Las stats son enteras y `cap` redondea: una ganancia de 0,3
no mueve nada y una de 0,6 mueve un punto. La pantalla anunciaba la fracción calculada; medido en 10
años, +769 anunciado y +429 real, con el 82 % de las líneas «+0,x» sin efecto. Ahora cada línea es el
cambio real. **La regla de progreso no se tocó:** con un acumulador de fracciones la misma carrera
terminaba con OVR 79 en vez de 71. Es la curva de poder y queda para su fase.

**2. El tono carismático rinde.** Seis respuestas del banco de prensa tenían tono `charisma`, que las
tablas no tenían (fase 14: `NaN`, después 0). Ahora rinden como el tono gracioso, la misma equivalencia
que el eco de prensa de la capa RPG ya hacía.

**3. La ficha de personalidad no muestra lo que no pasa.** La barra «Con tu manager» (`PERSX.mgr`) no la
leía ninguna regla y se quitó. Las otras tres (esquina, conflicto, prensa) actúan cada semana.

**4. La investigación del patrocinador turbio sale una vez.** La guarda escribía `done` y la condición no
lo miraba: en una carrera de 10 años que aceptó ese patrocinador, la misma pregunta salió 282 veces
(una cada semana y media), cada una restando reputación o popularidad.

**Lo que NO se tocó (documentado con su medición, para su fase):**
- la curva de progresión por el redondeo (fases 21 y 27);
- «counter» rinde alto contra los dos perfiles de rival (fase 16);
- tres premisas de campamento sin consecuencia en la pelea: video filtrado, entrenador nuevo del rival
  y `counterPlan` (fase 16);
- la relación con el mánager no pesa en ninguna regla y el contrato no vence (fases 17 y 18);
- cambiar de entrenador o de mánager es un toque sin confirmación (fases 23 y 28);
- la respuesta pública del rival depende del sorteo general (fase 25);
- las opciones neutras dominadas: son rol, no se inventaron costes.

**Evidencia.** EVID_15

## RPG-12 · Fase 14: el mundo existe sin el jugador
**Tipo** auditoría del mundo dinámico + nueve bugs del mundo corregidos + tres bugs viejos que la
regresión sacó a la luz · **Cambio observable:** sí — el mundo pelea desde la primera semana, no se
vacía, Vanguard no desaparece, los títulos no quedan vacantes años, el rival firmado no pelea otra
cartelera durante el campamento, el agente libre puede pelear, nadie existe dos veces (ni el
plantel real ni los nombres generados), el empate consume el contrato y una respuesta «carismática»
en la conferencia ya no borra la popularidad. Archivo de partida: `a16dc16` (sha256 `04c9983a…72fa4`).
Auditoría completa en `dev/MUNDO-AUDITORIA.md`; simulador en `dev/mundo-sim.js`.

**Medido antes** (el mundo con un jugador que no hace nada, 600 semanas, invariantes cada semana):
2–10 peleas entre organizaciones distintas por corrida; rankings y rosters con gente de otra
organización hasta 208 semanas; campeones que pertenecían a otra organización; 1–4 títulos contados
dos veces; en 36 de 100 firmas el rival peleaba otra antes; a los 20 años 353 → 138 activos,
Vanguard 112 → 1 y títulos vacantes 937 semanas; con inicio 2016, 9 clones del plantel real (5
activos en dos divisiones); 25–31 nombres repetidos; las primeras 17 semanas sin una sola pelea; la
oferta amateur del agente libre no llegaba nunca.

**1. Cambios de organización coherentes.** `CL.npcYear` (y el regreso o retiro de un NPC seguido)
cambiaba la organización sin rehacer rosters ni rankings; los ascensos de `yearTick` se hacían
después del recálculo. Ahora los dos rehacen rosters y rankings en el acto.

**2. El título vacante suma un título.** El bloque de vacantes lo sumaba y `applyResultCore`
también.

**3. El rival firmado está comprometido.** `worldTick` (carteleras y título vacante) ya no programa
al rival de `G.nextFight`: 36/100 → 0/106.

**4. El mundo se repone.** `worldReplenish()` (al final del cambio de año, después de `CL.npcYear`)
repone con `spawnLocals` —la regla que ya existía para la división del jugador— cada división que
cae por debajo del tamaño con que nació (5 en RFL/AXN, 6 en TFC/WMA, 6 en Vanguard). A 600 semanas:
320–332 activos, 0 títulos vacantes en ligas nacionales o mayores, 0 fallos.

**5. Una persona, un peleador.** El plantel real respeta la división de la época sin crear otro
igual en la división de 2026; los que llegan después tampoco. Y el generador de nombres vuelve a
sortear si el nombre ya existe (`freshName`): 0 repetidos (antes 25–31; el invariante nuevo
`mundo.identidad` encontró dos «Mei Ferrer» del mismo año activas en Vanguard).

**6. El agente libre pelea.** La pelea amateur de «acepto lo que sea» vivía en el evento `offers`,
que la rama del agente libre de `makeOffers` nunca alcanzaba. `CL.takeAny` es la misma función
para las dos.

**7. El mundo arranca andando.** Todos nacían con 0 semanas de inactividad y el mundo sólo programa
a quien lleva 16–30: la inactividad inicial se escalona en el último medio año.

**8. El empate consume el contrato** (existía antes; la regresión lo sacó a la luz):
`applyDrawResult` no pasaba por el único escritor de `contract.left`. Ahora las dos salidas llaman a
`consumeContractFight`.

**9. La conferencia no borra la popularidad** (existía antes): seis respuestas tienen tono
`charisma`, que las tablas de `pressPick` no tienen → `NaN` → el saneador devolvía popularidad,
reputación y hype a sus valores por defecto (40 → 8). Un tono sin fila no suma, que es lo que la
pantalla ya decía («Respuesta sin ruido»). Cuánto debería rendir es decisión de diseño pendiente.

**10. El ex entrenador enfrente lee +12, no +12,5** (existía antes): el bono se sumaba sobre la
adaptación redondeada (`safeInt`); ahora sobre el número (`safeNum`). Ninguna traza golden cambia.

**Lo que NO se tocó:** los contratos no vencen al llegar a 0 (132 de 145 peleas se hicieron con un
contrato vencido; cerrarlo exige decidir la renovación: fase de economía); `G.retiredList` y
`G.story.memories[].person` y `G.nextFight.replacementReason` quedan declaradas huérfanas; el tamaño del guardado a 20 años (1.284 KB,
porque el mundo ya no se muere: fase de rendimiento); ningún balance.

**Golden:** trazas regeneradas (`--solo-trazas`). Todas divergen desde la creación del mundo por
construcción (§4, §5 y §7 cambian quién existe, sus nombres y su inactividad). Atribución contra
`a16dc16`: el archivo final diverge en la entrada 0–3 (2016 s2–s5: el
rango del jugador y la fatiga ya difieren porque el mundo nace distinto). Revirtiendo sólo lo que
cambia el mundo al nacer (clones, nombres, inactividad inicial), las cinco trazas coinciden hasta
2016 s22–s25, la primera pelea firmada del jugador (entra el rival comprometido, §3); revirtiendo
también eso, coinciden el primer año entero y divergen en 2017 s1–s3, el primer cambio de año
(rosters, rankings y reposición, §1 y §4). Los arreglos de empate, conferencia y ex entrenador no
tocan ninguna de las cinco trazas.

**Evidencia.** `dev/tests/26-fase14-mundo.js` (15 pruebas: el mundo 150 y 600 semanas con invariantes cada
semana, determinismo, guardar/cargar del mundo, rival comprometido, agente libre de punta a punta,
reemplazo, retiro, ascensos y cambios de organización coherentes, identidad, y los tres hallazgos de
la regresión con el resultado forzado). Invariantes nuevos del sistema `mundo`
(campeones, rankings, rosters, peleadores, identidad, agenda) en toda carrera del arnés. Mutantes de la fase 20/20 (uno sobrevivió
la primera vez porque la reposición anual lo tapaba: se agregó la prueba dirigida). Suite 375/375,
navegador 89/89, `estado-carreras` 3/3 y `rpg-carrera-completa` 3/3 (754–816 semanas),
`recorridos-economia` y `tq-inventario --check` al día.

## RPG-11 · Fase 13: cada estado sabe por qué existe, y lo que está en pantalla sobrevive a recargar
**Tipo** auditoría global de estado + persistencia corregida + duplicado unificado + dos promesas
que el sistema no cumplía · **Cambio observable:** sí — al recargar con un evento o una pelea en
pantalla, al subir de categoría por el pesaje, al contestarle en público a un rival y en el final
«CAMPEÓN EN DOS DIVISIONES». Archivo de partida: `c6f1e23` (sha256 `286328b5…0b74`). Inventario
completo en `dev/ESTADO-AUDITORIA.md`; por qué existe cada clave, en `dev/estado-inventario.js`.

**1. Recargar con un evento en pantalla ya no cambia la decisión.** `G.tmpOpp` —el rival que nombra
el evento que está en pantalla— era la única de las once `tmp*` que no se guardaba, y
`CL.evSanitize` la validaba al cargar como si se guardara. Barrido de los 66 eventos y sus 170
opciones, resolviendo con y sin recargar la página en el medio: 12 daban otro resultado (la pelea
de aviso corto y la de cinco días «se caían», «Pedirle la pelea a la organización» no pedía nada,
el rival no recordaba lo que le dijiste). Ahora persiste: 0 de 170.

**2. Cerrar la app en medio de una pelea congelaba la carrera.** El autoguardado de
`fxResolveMini` corre dentro de la pelea, así que un «Buscar KO/Sumisión» que no la termina deja
guardada una pelea viva. Al cargar se iba al inicio, que no tiene cómo volver a una pelea abierta:
20 semanas después seguía abierta, sin peleas nuevas. Y un intento que sí la terminaba la dejaba
guardada sin cobrar, y el inicio la descartaba (récord y bolsa perdidos, la misma pelea otra vez).
Ahora `loadGame` vuelve a la pelea o al resultado; continuarla da el mismo final que sin recargar.

**3. Subir de categoría por el peso es una sola cosa.** Había tres copias (planificada, forzada y
la de emergencia del pesaje); la del pesaje sólo reescribía la división: el campeón seguía dueño
del cinturón que dejaba, no entraba al ranking nuevo hasta la semana siguiente y no pagaba la
adaptación. Ahora las tres son `divMoveUp`.

**4. «CAMPEÓN EN DOS DIVISIONES» dice la verdad.** Comparaba una división con un estilo (siempre
distintos) y leía una marca que ponía sólo el pesaje: lo recibía quien ganó un título y después no
dio el peso, y no el campeón que cambió de categoría por la vía propia y volvió a ganar. Ahora cada
cinturón anota su división (`p.beltDivs`) y el final exige dos.

**5. La respuesta del rival llega.** «Responder públicamente» deja en camino la respuesta del rival
(`story_rival_reply`) como una cadena sin `id`; el saneo semanal filtraba las cadenas por `id` y la
borraba antes de que se leyera. No salía nunca. Ahora una cadena vale si tiene tipo.

**6. Cargar ya no borra publicaciones.** El feed tenía dos topes (80 al publicar, 60 en el saneo y
en la carga): la semana cerraba con 61–62 y cargar borraba las últimas. Un tope, 60.

**Lo que NO se tocó:** ninguna huérfana se borró (37 clasificadas, con su decisión: se eliminan en
una limpieza con migración propia); el combate (8 claves sin lector de juego, documentadas); el
texto «Empezás casi de cero en el ranking» (es texto, no sistema); y el pedido de pelea que la
regla anti-repetición descarta en silencio (decisión de diseño: queda en «investigar»).

**Golden:** trazas regeneradas (`--solo-trazas`), con cada divergencia atribuida contra
`c6f1e23`: 101 y 404 con traza idéntica (sólo aparece `tmpOpp: null` y el feed se corta en 60);
202 cambia en 2017 s6 porque el autopiloto elige en 2017 s5 «Cancelar la pelea y subir de
división» (ahora entra al ranking nuevo en el acto); 303 (2018 s29) y 505 (2016 s35) porque el
autopiloto elige «Responder públicamente» y ahora la respuesta del rival entra al sorteo de eventos.

**Evidencia.** `dev/tests/25-fase13-estado.js` (22 pruebas: inventario contra el análisis en las
dos direcciones, recargas, subidas, dos divisiones, carrera nueva sin herencia y nueve cadenas con
una recarga en el medio). `dev/estado-carreras.js`: 3/3 carreras enteras (751–825 semanas) con
cambios de mánager y de división, 15 recargas en arranque nuevo (10 con un evento en pantalla),
dos terminan «CAMPEÓN EN DOS DIVISIONES» con cinturones reales y la carrera siguiente sale limpia
en las tres. Las tres encontraron, en su primera recarga, el tope doble del feed (§6). Mutantes de
la fase 19/19 (el de la condición invertida de la subida sobrevivió la primera vez: la prueba sólo
subía campeones; se agregó el que no lo es). Suite 360/360, navegador 89/89 (nueva: cerrar la
página con la pelea a medias y cargar vuelve a la pelea), `rpg-carrera-completa` 3/3,
`recorridos-economia` y `tq-inventario --check` al día.

## RPG-10 · Fase 12: lo que se paga fuera de la tienda, cumple lo que promete
**Tipo** auditoría económica + duplicados unificados + cobros corregidos + textos que dicen lo que
pasa · **Cambio observable:** sí, al pagar servicios, mudarse, endeudarse y en tres eventos.
**Nulo en el golden** (5 trazas, huellas y estado final idénticos a `081560a`). Archivo de
partida: `081560a` (sha256 `a854eeb1…cf00`). Inventario, flujo por flujo, en
`dev/ECONOMIA-AUDITORIA.md`.

**1. Los dos campos del plan de gasto.** `rep` e `inj` no los leía nadie desde el archivo
original y ningún texto los prometía: eran configuración muerta y se quitaron (conectarlos habría
sido inventar reputación semanal o menos lesiones). Lo que el plan sí hace —recuperación y
entrenamiento— ahora lo dice cada botón con sus números.

**2. Cobros incorrectos.**
- Peso pactado a 24 horas: se cobraba el 25 % de la bolsa en el momento **y** otro 20 % (10 % con
  nutricionista) en la liquidación. Ahora una sola vez; el hecho de no dar el peso queda registrado.
- Adelanto «por quedarte sin plata»: sumaba la plata y la anotaba en una marca que nadie leía
  (gratis). Ahora es deuda como los otros dos adelantos, y respeta sus reglas: si no te lo dan, no
  hay plata ni costo.
- Inversión del veterano: con menos de $25.000, cobraba lo que hubiera y daba el efecto entero.
  Ahora cobra entero, como todo evento (el rojo va al descubierto).
- Campamento abierto: se cobraban centavos (media cuota sin redondear).

**3. Duplicados unificados.**
- Mudarse de gimnasio tenía dos caminos (Equipo: una cuota, subía techos, dejaba mudarse en
  campamento; Gimnasios: dos cuotas, cuidaba compañeros y entrenador). Ahora uno solo, con la
  unión de los efectos y un precio que se ve en los dos catálogos; y la regla escrita «no te
  aceptan si querés mudarte acá» (reputación < 18) se cumple sin cobrar.
- Pagar deuda: tres copias del mismo recorrido; sólo una levantaba cobranzas al saldar. Ahora un
  solo pago (`CL.debtApply`), y cobranzas («ya no se negocia») no renegocia.
- «Te conoce»: dos registros (`coachSeen` y `p.coaches`), ninguno leído. Queda uno, y el catálogo
  de entrenadores lo muestra.

**4. Lo que se ve es lo que se cobra.** Finanzas y el hub mostraban un gasto semanal incompleto;
ahora un solo desglose (`CL.weeklyLines`) con las mismas fuentes que cobran: una semana real mueve
exactamente lo que dice. El recargo del 20 % de la cuota con reputación baja se cobraba sin
figurar; la lista mostraba 15 % y 30 % a la vez. «Ir a ver una pelea» y «viajar juntos» mostraban
el precio sólo si no alcanzaba. Los eventos que cobran dicen el precio antes de elegir (en la
descripción, no en la opción: la opción se guarda como la decisión tomada).

**5. Textos que prometían lo que no existe.** Tres textos prometían más bolsa de PPV (no existe
ningún ingreso por PPV): ahora dicen lo que pasa (más popularidad al terminar la pelea). La
mudanza de urgencia prometía «dos semanas de concentración» y hacía −2 de temple. La experiencia
de carrera no decía qué se compraba (+1 adaptabilidad y +1 Fight IQ por nivel). El equipo de
contenido llevaba dos campos que nadie leía (`budget`, `last`).

**Evidencia.** `dev/tests/24-fase12-economia.js` (17 pruebas): el contrato cobra cada pago y
exige precio visible = cobro, semana si la promete, efecto medido y que repetir no cobre de
nuevo; los gastos de una semana real = el desglose; el plan sin campos sin lector; barrido
automático de marcas escritas sin leer; guardar y cargar **en un juego recién abierto** (lo que
vive sólo en memoria no sobrevive). Recorrido real: `dev/recorridos-economia.js` usa los 10
servicios en 104 semanas por la vía del jugador, con invariantes y recarga a mitad: cada cobro
coincidió con lo que mostraba la pantalla (y encontró que un botón deshabilitado también muestra el
precio: el juego, bien, no cobra). **Mutantes de la fase 45/45** (la primera corrida dejó vivo uno
—volver a llevar el presupuesto del contenido— porque la prueba miraba un estado recién creado; se
reforzó). Suite 338/338, navegador 85/85 (una prueba nueva por pantalla: mudarse desde Equipo
pulsando cobra lo que muestra), golden idéntico, 3/3 carreras completas usando los servicios.

## RPG-09 · Fase 11: lo que se compra, cumple lo que promete
**Tipo** auditoría de la tienda + contenido muerto reparado + promesas conectadas o corregidas ·
**Cambio observable:** sí, sólo si comprás. **Nulo en el golden** (5 trazas, huellas y estado final
idénticos a `fbece34`: las carreras del golden no compran). Archivo de partida: `fbece34`
(sha256 `a40dc3fa…5458`, verificado contra el repositorio). Inventario completo, con el flujo de
cada compra, en `dev/TIENDA-AUDITORIA.md`.

**1. Ocho artículos no se podían comprar desde el archivo original.** `scrShopPrev` rehacía la
tienda con cinco categorías fijas y tiraba lo que había agregado el filtro anterior: Tecnología,
Negocios, las actividades desbloqueadas y el ingreso pasivo. Muro de reacción, simulador VR,
plataforma de fuerza, carpa de altura, mesa de inversiones, gimnasio propio, restaurante y
academia para chicos existían, con efecto programado, y ningún botón los vendía (tres de ellos
desbloquean actividades jugables). Ahora la tienda dibuja todas las categorías de `SHOP` y el
filtro de actividades corre después.

**2. Las seis marcas de la auditoría.** Decisión por marca, con la primera ruptura del flujo:
- `apt`: el consumidor existía (`G.endgame.owned`, −1 fatiga/sem); `G.flags.apt` era un espejo
  que nadie leía → se dejó de escribir; la descripción dice el efecto.
- `villa`: recuperaba lo mismo que el departamento aunque su ficha decía «superior» (y su `v`
  era el doble) → −2 por semana, del `v`. «Recibir gente» → en «Invitar a entrenar», la reticencia
  de quien no abre su gimnasio deja de pesar: viene a tu casa, y el resultado lo dice.
- `estate`: +1 de reputación por temporada existía; «abre eventos y proyectos de largo plazo» no
  tiene ningún sistema detrás (no hay un solo evento de lujo en el juego; `eventsSeen` está vacío
  desde el original) → el texto dice lo que hace, y ahora se ve en «Impacto actual».
- `jet`: su efecto era un −0,25 de daño semanal genérico, y los viajes que existen no lo leían →
  visitar otro gimnasio y viajar con un compañero cansan la mitad (la plata y la semana no
  cambian); la pantalla de gimnasios muestra la fatiga del viaje. «Eventos de lujo»: texto
  corregido, como la mansión. El −0,25 se conserva y se muestra.
- `foundation`: «contribuye al legado» no llegaba al legado → cuenta como obra en el perfil de
  legado («El Constructor»), con el mismo peso que ya tenía el gimnasio comunitario.
- `stylist`: «mejores respuestas en prensa» → cada conferencia o podcast rinde +1,5 de popularidad
  y la aparición lo dice.

**3. Otras compras rotas que la auditoría anterior no había visto.**
- Restaurante: «te distrae un poco» → −0,5 de filo por semana de camp, con su línea en el camp.
- Documental: «puede abrir una pelea estelar» → abre la coestelar de PPV que ya existía (antes
  salía al azar), en las 16 semanas siguientes y con las mismas condiciones (liga grande,
  popularidad > 35, rival que vende), una vez por documental, sin azar.
- Laboratorio de recuperación: la mitad de su promesa (fisio entre camps más barata) no existía →
  cuesta la mitad, y la pantalla de recuperación (que no mostraba ningún precio) lo dice.
- Academia de prospectos: «formás talentos» → perfil de legado «El Maestro»; «aparecen después en
  el mundo» no tiene mecanismo y no se inventa uno: texto corregido.
- Estudio audiovisual: «habilita piezas de alto impacto» (no habilitaba nada) → texto corregido a
  lo que hace (dos niveles de producción).
- Centro de alto rendimiento: encendía la marca del GIMNASIO COMUNITARIO (reputación semanal,
  legado y noticias de «tu gimnasio comunitario») → cruce eliminado; su efecto prometido queda.
- Chofer (tienda) y transporte privado (patrimonio) escriben la misma marca: el chofer ya no se
  cobra a quien tiene transporte privado.
- Bóveda: el patrimonio guardado (`vaultCash`) era invisible → se muestra, y la renta entra en el
  ingreso pasivo. Queda como marca contable, documentada.

**4. Qué cambia en una carrera que compra, y por qué exactamente.** A/B contra `fbece34`, misma
semilla y política, 60 semanas, 3 semillas: comprar el departamento, la mansión, el jet, la
fundación, el estilista, el laboratorio, el documental, la academia de prospectos o la bóveda deja
la traza **idéntica** (el autopiloto no da conferencias, no viaja, no juega en una liga grande y el
legado no entra en la traza). Cambian tres, y ninguna otra cosa: la **villa** (primera divergencia:
la fatiga de esa semana, un punto más baja — INTENCIONAL), el **restaurante** (primera divergencia:
la vida de la pelea siguiente, por el filo del camp — INTENCIONAL) y el **centro de alto
rendimiento** (BUGFIX: el gimnasio comunitario que encendía tiraba un dado por semana; sin él el
azar de la carrera se corre desde la primera semana). Prueba de la atribución: con esos tres
cambios deshechos, la carrera que compra las 13 cosas es idéntica a `fbece34` en las 3 semillas.

**Evidencia.** `dev/tests/23-fase11-tienda.js` (17 pruebas): el **contrato de la tienda** compra
cada una de las 52 compras (41 de la tienda, 8 del patrimonio, 3 inversiones), exige el precio
exacto, que todo lo que escribe tenga dueño (consumidor con lector en el código y efecto medido,
o marca con su razón) y mide la consecuencia prometida con el consumidor real; el propio auditor
se prueba con una compra rota inyectada (sin clasificar, sin lector, escritura sin dueño, marca
sin razón: las cuatro fallan). Además: flujos reales (conferencia, invitación, viaje, semana de
recuperación, semana de camp, ofertas), guardar/cargar con 15 compras (siguen siendo tuyas, no se
recompran, los consumidores siguen activos) y ningún consumidor nuevo tira el dado. Navegador:
una prueba nueva por pantalla (41/41 botones, compra pulsando, patrimonio visible); contra
`fbece34` falla con «33/41». Carreras completas: el corredor ahora compra (una por semana, de una
lista fija) y usa lo comprado (conferencias, visitas, invitaciones): 3/3 sin fallos, con 16, 18 y 19
compras; la villa recibió una invitación en juego real, el estilista rindió en 38 apariciones y el
restaurante distrajo 951 semanas de camp; el jet no llegó a usarse en un viaje y el documental no
abrió coestelar (ninguna de las tres jugó en una liga grande con un documental vigente): esos dos
quedan cubiertos por las pruebas de flujo, no por las carreras. **Mutantes de la fase 45/45**
(quitar el consumidor, cambiar la bandera, impedir la activación, perder la persistencia, desviar
el flujo de compra, no cobrar, efecto de más, azar, observabilidad): la primera corrida dejó vivos
dos del documental —el decorado tenía un solo rival que vende y la liga chica no tenía ninguno—, y
se reforzaron las pruebas. Suite 321/321, navegador 81/81, golden idéntico, 3/3 carreras.

## RPG-08 · Fase 10, segunda pasada: la defensa del plan es un compromiso; el HUD sabe dónde está la pelea
**Tipo** ajuste de diseño + presentación · **Cambio observable:** sí, en la pelea (si armás plan)
y en el HUD fuera de la pelea de pie. **Nulo en la decisión del rival** y en el golden (las 5
trazas y huellas idénticas a RPG-07). Archivo de partida: `a5eeb63`.

**1. «Defensa principal» de suma cero.** En RPG-07 la defensa elegida sumaba +3 cuando él hacía
eso y nada costaba: medido, era un empuje a favor del jugador en cualquier pelea (+1 a +3 pp de
victorias) y la parte M pide no mover el balance sin necesidad. Ahora, como `aggrShift`, es un
compromiso: +3 a lo que cubre la elegida y **−1,5** a lo que cubren las otras dos cuando él hace
eso (`GP_DEF_COST`). Los dominios no se pisan, así que en cada intercambio cuenta a lo sumo una.
Lo que decide es elegir la que pide ESE rival: por eso el sparring de la revancha ya ofrecía
ajustarla (RPG-07).

A/B, 400 peleas por variante, mismos rivales y dados, política básica:

| defensa | victorias | daño recibido | derribos de él | te llevó al clinch |
|---|---|---|---|---|
| ninguna | 71,3 % | 24,99 | 1,45 | 1,00 |
| cabeza | 73,3 % | **23,38** | 1,46 | 1,06 |
| derribo | 72,5 % | 25,63 | **1,34** | 1,05 |
| reja | 71,5 % | 25,86 | 1,48 | **0,96** |

Cada una mejora lo suyo y empeora lo demás; las victorias quedan dentro del ruido (±2,3 pp).
Separando por estilo del rival, la mejor contra golpeadores (320 peleas) es cabeza (76,3 % contra
74,4 % sin defensa) y contra luchadores (80 peleas, ruido ±5,5 pp) es derribo (62,5 % contra
58,8 %): la dirección es la esperada, con muestra chica del lado luchador.

**2. El HUD distingue la pelea de pie del resto.** El motor sigue usando la distancia en el clinch
y en el suelo (`CL.effMod`: tu terreno), pero ahí casi ninguna acción la mueve: queda la de antes.
Esconderla sería esconder un factor real; mostrarla con una barra y «necesitás alejarte» era
engañoso. Ahora, fuera de la pelea de pie: el encabezado dice la posición
(`POSICIÓN · Suelo — arriba`), una línea dice «distancia en suspenso (media) hasta que vuelvan a
estar de pie: vos querés media · él corta», el terreno sigue, y el consejo ya no pide alejarse ni
entrar. De pie, igual que antes. La tarjeta del plan en la pelea muestra también la defensa.

**Evidencia.** `dev/tests/22-fase10.js` (21 pruebas): la defensa se prueba contra una
especificación escrita aparte, sobre 3 defensas × 11 acciones del rival × 3 tuyas × 2 posiciones y
4 grupos de claves (+3 / −1,5 / 0, y el rival sin cambios); el HUD, en clinch, arriba y abajo, con
distancia corta y larga. Mutantes de la fase **44/44** (se agregaron «sin costo», «costo al revés»,
«barra en el suelo», «alejate en el suelo», «sin posición»). Golden idéntico (traza, final y
huella), suite 304/304, navegador 77/77, 3/3 carreras completas: en una, el ciclo de rivalidad pasó
por tensión y en los medios en juego real.

## RPG-07 · Fase 10: lo que se escribía y nadie leía, ahora llega a algún lado
**Tipo** conexión de datos sin consumidor + 1 corrección de diseño + consolidación · **Cambio
observable:** sí, en la pelea (sólo si usás la toma de espalda, La Última Puerta o armás plan), en
el campamento de una revancha, en las ofertas cuando hay ruido y en la ficha/diario de una
rivalidad. **Nulo en la decisión del rival** y en las 5 carreras del golden (traza y final
idénticos; sólo cambia la huella del estado). Archivo de partida: `7d694d0`.

**Qué estaba mal** (hallazgos de la fase 9 y del inventario):
- la **toma de espalda** (`g_back`, `g_rev`) escribía `st.back=1` y nadie lo leía;
- **La Última Puerta** a PERFECTA con habilidad alta empataba con su L4 (las dos en el techo 0,80);
- `TQ.fightPanel` estaba **definido dos veces**;
- el HUD de distancia mostraba en **%** la distancia preferida de cada uno;
- el **sello** de la Ultimate ignoraba la filosofía de combate asumida;
- la **«Defensa principal»** del plan sólo sumaba al puntaje del plan: en la pelea no hacía nada
  (A/B: las cuatro defensas daban resultados idénticos, 400 peleas cada una);
- la **memoria del rival** no llegaba al campamento de la revancha;
- `G.flags.heat` (seis escritores) y `CL.ufc().heat` no tenían ninguna decisión que los leyera;
- el **ciclo de rivalidad** se derivaba en cada consulta: sin «en los medios», sin resolución y sin
  historia.

**Qué se hizo** (siempre por las vías que el motor ya tenía):

| pieza | ahora | vía existente |
|---|---|---|
| toma de espalda | `TQ.back()`: vigente mientras sigas arriba ese round; suelo +6, sumisión del árbol ×1,15, +1 de control por intercambio; se pierde (y se dice) si cambia la posición o el round; el HUD la muestra | `combat:eff/TQ`, `TQ.apply`, `exchange:post/tqPasivas` |
| La Última Puerta | techo propio de sumisión 0,88 (`fx.subCap`, acotado a 0,90); ninguna otra técnica cambia | `TQ.apply` |
| `TQ.fightPanel` | una sola definición (la paginada); 49 paneles idénticos a la fase 9 | — |
| HUD de distancia | «vos querés media · él larga» | `CL.zone` |
| sello de la Ultimate | primero la filosofía de combate asumida (finalizar/espectáculo → Espectáculo; castigar/minimizar → Precisión; controlar/adelante → Desgaste), si no, la identidad; se guarda el origen y el árbol lo explica | `CMB.ultVariant`, `CMB.ULT_V` (los mismos 4 sellos) |
| Defensa principal | +3 a esa defensa sólo en el intercambio en que él hace eso: cabeza ↔ él golpea de pie; derribo ↔ va al derribo (de pie o desde el clinch); reja ↔ te quiere llevar al clinch. Se ve en la tarjeta del plan y se explica al armarlo | `combat:eff` + `exchange:pre/post` |
| memoria → campamento | el sparring de la revancha compara lo que muestra con lo que le viste («lo mismo» / «algo cambió» / «se la castigaste y se acuerda»); si el hábito pide otra defensa, ofrece ajustar el plan, y ese plan llega a la pelea | `CAMPO.tell`, `camp_spar`, `CMB.supOf` (la misma regla que usa la pelea) |
| heat | las peleas de rivalidad/revancha pagan +4 % por punto (tope +30 %) y lo dicen; con 4+ y sin una, se arma la del rival con más rivalidad (sin azar); firmarla gasta el ruido (queda 40 %); se enfría 3 %/semana; Vanguard escribe en el mismo | `offers:made`, `fight:accepted`, `week` |
| ciclo de rivalidad | cruce → tensión → en los medios → pelea firmada → ya se pelearon → revancha → resuelta; la resolución es `canOfferRematch`; el avance queda en `bond.rc` y la relación, los hitos en la memoria del mundo y el diario; la ficha del rival lo muestra desde antes de la primera pelea | `RPG.rivalFacts` (lector puro) + `RPG.rivalTick` |

**Evidencia.**
- Golden: con los siete cambios apagados las 5 trazas son idénticas (huella, final y traza); con
  cada uno prendido por separado sólo el **heat** (enfriamiento) y el **ciclo** (registro) mueven
  la huella; traza y final, idénticos siempre. Trazas regeneradas con `--solo-trazas`: el diff es
  sólo `fingerprint`.
- A/B de la defensa (400 peleas por variante, mismos rivales y dados, política básica): sin
  defensa 71,3 % de victorias, 24,99 de daño recibido, 1,45 derribos de él, 1,00 entradas al
  clinch. Cabeza: daño 22,98 (−8 %); derribo: derribos 1,34 (−8 %); reja: clinch 0,96 (−4 %).
  Victorias +1 a +3 pp (ruido ±2,3 pp). En la versión anterior las cuatro daban exactamente lo
  mismo. Es un empuje pequeño a favor del jugador, en su propio terreno, y queda declarado
  (en RPG-08 pasó a ser de suma cero).
- Memoria del mundo (tope 100): en las 5 carreras del golden quedan 1–6 hitos de rivalidad; los
  resultados de pelea y los recuerdos de ayuda que sobreviven al final no cambian.
- Legalidad del rival: 0 de 181.440 sorteos y 0 de 2.715 elecciones reales.
- `dev/tests/22-fase10.js` (21 pruebas; efectos medidos contra `eff`/el dado, no contra la función
  que los aplica; «sin azar» comprobado sobre `G.rs`); mutantes de la fase **39/39**. Cinco
  sobrevivieron durante el desarrollo y obligaron a endurecer pruebas: la defensa fuera del
  intercambio, la defensa aplicada al rival, el heat con azar (la prueba miraba `Math.random`, no
  `G.rs`), el diario sin rivalidades y «una pelea suelta es rivalidad» (tras dejar sólo los hitos
  en la memoria del mundo, la prueba tenía que mirar la relación). El conjunto de la fase 9 sigue
  en 17/17 sobre este archivo.
- Suite **304/304**, navegador **77/77**, **3/3** carreras completas (invariantes cada semana).
  `dev/rpg-carrera-completa.js` cuenta lo nuevo por la vía del jugador y su política asume la
  filosofía cuando las peleas la muestran: por carrera, 111–171 intercambios cubiertos por la
  defensa del plan, 0–2 con la espalda tomada, 19–26 avances de rivalidad, ruido máximo 2,3–2,9
  (1 pelea cobrada con ruido y firmada), y un sello Precisión que salió de «Minimizar el daño».
  El sparring de revancha no aparece ahí porque la política no entrena sparring: lo cubren las
  pruebas.
- Costo: el barrido semanal del ciclo mira 16 candidatos de 381 peleadores en 0,28 ms (una semana
  completa, ~200 ms) y no mueve el dado.

**Hallazgos sin corregir.** El HUD de distancia se sigue mostrando en el suelo (previo; resuelto
en RPG-08). El
autopiloto del golden no arma plan, no usa técnicas ni hace sparring: esas vías se prueban con
`22-fase10.js` y con las carreras completas, no con el golden. `CL.ufc().heat` queda en partidas
viejas, sin uso.

## RPG-06 · Fase 9: capa de información del Fight IQ, inventario del árbol, Ultimates auditadas
**Tipo** capa de información + refactor neutral + 1 fix · **Cambio observable:** sí en la interfaz
de la lectura; **nulo en la decisión del rival** (ver evidencia). Archivo de partida: `b099e0d`
(sha256 `dd576a9d…b4ed5`), confirmado por el usuario como fuente de verdad.

**Qué estaba mal.** La lectura mostraba los pesos internos del rival casi en crudo: 8 exposiciones
en 5 superficies (porcentaje exacto y redondeado en el panel, ancho de barra = probabilidad, la
probabilidad de la regla de adaptación, el texto de «Anticipar», el scouting con sala de video, la
pregunta de sparring y su línea de scouting).

**Qué se hizo.**
- `pesos reales → modelo → jugador`: `CMB.distFor(o, x)` compone lo mismo que decide
  (`CL.oppWeightsFor` + `CL.oppRulesFor` + memoria) para cualquier situación; `CMB.read(fuente)`
  devuelve un objeto **sin números** (salvo nivel de confianza y conteos de lo que el jugador vio);
  `CMB.sayHead/sayContrast/sayAlso/sayMem/sayOften` son el único lenguaje. Las 8 exposiciones
  pasan por ahí.
- **Prominencia contextual**, no «0,63 → alta»: depende de cuántas acciones tiene el rival en esa
  posición (7/4/5/4) y de cuánto le saca la primera a la segunda (marcada / clara / leve / ninguna).
- **Confianza por fuente**: en vivo, la lectura que ya existía; analista = media, sala de video =
  alta; sparring anotado = media, trabajado = alta; memoria según cuántas veces lo viste; fight IQ
  ≥ 80 suma un nivel al interpretar lo visto. Con confianza baja sólo se percibe lo marcado; con
  alta, también lo leve. Si no se percibe, se dice que no se percibe.
- **Contrastes verificables** («cuando se queda sin aire, aumenta su tendencia a moverse…»): cada
  uno compara la distribución real de dos situaciones (aire, daño, distancia, vos herido/sin aire,
  final ganando, primer round, tercer round) y sólo se dice si la diferencia es ≥ 7 puntos y ≥ 40 %
  relativo. En 3.609 lecturas de peleas reales aparecieron: sin aire → moverse (el +0,55 del
  motor), vos herido → combinación (+0,35), primer round → patada baja (arquetipo Misil), llegando
  ganando al último round → moverse/controlar.
- Refactor neutral: la regla de identidad del rival se consulta para una situación cualquiera
  (`CL.oppRulesFor`, `CL.oppRuleSit`); `CL.oppRules()` en vivo devuelve lo mismo (probado).
- **Fix**: `CMB.ultUse` devolvía `true` aunque `TQ.use` se negara (en la esquina).
- `dev/tq-inventario.js` genera `dev/TQ-INVENTARIO.md` del árbol cargado (36 técnicas, cada campo,
  funciones y consumidores verificados en el fuente) y una prueba exige que esté al día.
  `dev/ULTIMATES-AUDITORIA.md`: las 4 Ultimates contra el inventario.

**Evidencia.** `node dev/rpg-neutralidad.js --ref b099e0d`: las 5 trazas **idénticas** al golden y
el estado final **idéntico** a `b099e0d` en las 5 semillas; no se regeneró nada. Legalidad: 0 de
181.440 sorteos y 0 de 2.715 elecciones reales; y una prueba nueva lo verifica **con todas las
piezas de la lectura desenganchadas**. `dev/tests/21-fightiq-capa.js`: 20 pruebas; 3 pruebas viejas
(18, 19) pasaron del contrato de porcentajes al nuevo, con cálculo independiente de los pesos.
Mutantes de la fase 18/18 (uno, «el sparring elige la situación menos perceptible», sobrevivía y
obligó a agregar una prueba sobre 40 rivales); los conjuntos de las fases 4, 5, 6-7 y 8 se
re-ejecutaron sobre este archivo con sus blancos actualizados y siguen detectando (salvo los dos
equivalentes ya documentados). Suite 283/283, navegador 77/77, 3/3 carreras completas.

**Hallazgos sin corregir** (fuera de alcance o de diseño): la «toma de espalda» (`g_back`,
`g_rev`) escribe una marca que nadie lee; La Última Puerta no mejora la sumisión a PERFECTA con
habilidad alta (techo 0,80); `TQ.fightPanel` está definido dos veces (previo); el HUD de distancia
de CL muestra en % la distancia preferida del rival según su estilo (no es parte de las 5
superficies).

## RPG-05 · Fase 8: lo prometido pasa, y una carrera entera lo prueba
**Tipo** conexión de promesas + instrumento + ajuste · **Cambio observable:** sí.

**Seis promesas que los eventos hacían y no cumplían** (auditoría RPG, 2.3: sólo escribían una
bandera sin lector). Cada una se cumple por el camino que el juego ya tenía:

| el evento decía | ahora | camino existente |
|---|---|---|
| «Va a llegar algo mejor» (`betterDeal`) | la próxima oferta de contrato llega +20 % | `offers:made` |
| «Todo el mundo sabe que estás disponible» (`freeAgent`) | con el contrato por vencer, otra organización se adelanta | `betterOrgForPlayer()` + `offers:made` |
| «Tu equipo empieza a evaluar subir» / «La derrota abre una puerta» (`divTalk`, `considerDivisionChange`) | si tu cuerpo es de otra categoría, se arma el cambio; si no, el equipo lo descarta y lo dice | `planDivUp` → evento `body_divup` (ya existía); respeta «Sin cambiar de peso» |
| «Empezás a buscar alternativas» (`wantMgr`) | dos representantes llaman; firmar cambia de mánager | `changeMgr()` |
| «Dos periodistas empiezan a investigarte» (`dirtyMoney`) | doce semanas después sale la nota, y responderla cuesta o no | evento serializable |
| «Vas a tener que perder a propósito en el segundo asalto» (`fixed`) | en el round 2 de la pelea siguiente aparece «Ir a la lona»; cumplirlo es perder (y deja eco); ganarla trae al empresario a cobrar | `fight:options`/`act:*`, `fight:applied` |
| «Campamentos allá sin romper con tu equipo» (`dualGym`) | en campamento, el gimnasio de afuera pesa en la calidad del trabajo, con el peso que `trainQuality` le da al gimnasio | `train:adjust` |

`x14_fix` ahora guarda el monto en la bandera (`G.flags.fixed = G.tmpAmt`), que era `true`.

**Ajuste de las Ultimates.** Tres carreras completas mostraron que casi nunca despertaban: se
pedían 3 notas PERFECTAS *después* de la resistencia del rival, y una ejecución perfecta del
minijuego se degrada por azar. El requisito pasa a **3 ejecuciones perfectas del minijuego**
(`q ≥ 0,86`, lo que depende del jugador), además de 8 usos y una pelea ganada con ella. Notas,
niveles y puntos del árbol no cambian.

**Instrumento de rendimiento.** `dev/perf/inicio.js` escribía `G.nextFight` directo; la guarda del
juego rechazaba la pelea de título en silencio y el «peor caso» se medía **sin pelea**. Ahora
escribe detrás de la guarda y falla si el estado no quedó puesto. Resultado real: «Avanzar» sigue
sin scroll en los tres viewports, también con la pelea de título.

**Carrera completa real** (`dev/rpg-carrera-completa.js`): `e5-largas.js` avanza semanas sin
pelear; este script corre carreras del debut (21) al retiro (37), con una política que usa lo que
agregó la etapa por la vía del jugador (técnicas con su minijuego, «Anticipar», gameplan,
lecciones, puntos del árbol) y comprueba las invariantes **cada semana**. 3/3 carreras de ~762
semanas sin fallos; al retiro, final con perfil, diario con sus 6 secciones y `G.rpg` idéntico
tras guardar y cargar (24-29 KB).

**Golden.** Las 5 trazas cambian; bisección: 404 y 505, el autopiloto había elegido «Cambiar de
mánager» (semanas 4 y 12) y ahora llaman los representantes. Trazas regeneradas.
**Pruebas:** `dev/tests/20-rpg-promesas.js`, 8 pruebas; mutantes 9/9 significativos (uno
equivalente documentado: quitar `hp=0` antes de `finishFight('ko','o')`).

## RPG-04 · Fases 6 y 7: el campamento pregunta, el mundo recuerda
**Tipo** decisiones + mundo (capa sobre lo existente) + fix · **Cambio observable:** sí.

**Lo que ya había y se respetó.** El campamento tenía trabajo semanal, minijuegos, gameplan con
consejo de esquina, filosofía y paciencia del entrenador (`CL.PHILO`, `CL.coachPatience`,
`COACH_PHIL`). Faltaban decisiones con costo que salieran de su propio estado. Entran como eventos
serializables (`CL.ask`/`CL.handler`), no como un menú nuevo: a lo sumo uno por semana (la cola
del juego admite uno a la vez) y cada uno una vez por campamento.

| momento | cuándo aparece (estado real) | qué cuesta / qué llega a la pelea |
|---|---|---|
| **El sparring mostró algo** | una semana de sparring en campamento | la tendencia más marcada del rival, calculada con `CL.oppWeightsFor` (la misma que decide en la jaula). Trabajarla: +4 afilado, +6 desgaste, +10 de lectura en esa situación; anotarla: +5 |
| **El cuerpo avisa** | desgaste del camp ≥ 62 con 2+ semanas por delante | descargar (−15 desgaste, −3 afilado) · apretar (+5 afilado, +8 desgaste, +6 fatiga del peleador: la que lee el riesgo de lesión de `applyTrain`) · «lo que diga el coach»: hace lo que pide **su** filosofía (volumen/trabajo/finalizar aprietan; técnica/lectura/control descargan) y sube su paciencia |
| **Tu plan contra el suyo** | desde la mitad del camp, si la prioridad de tu gameplan no es la de tu entrenador | hacerle caso cambia el plan que entra a la jaula (+6 paciencia) · mantenerlo (−6 paciencia, eco `plan_own`) · con camp de equipo: plan unificado (su prioridad, tu distancia) |

**Mundo:**
- **Eras** (`ERA`, en `G.rpg.era`): no existían. Se derivan comparando `G.champs` semana a semana:
  un reinado de 3+ defensas (o 2 años con inicio conocido) es una era. Mundo muestra la era vigente
  y las terminadas de tu división; terminar la era de otro o empezar la tuya es noticia, memoria
  narrativa, hilo de legado y momento del diario.
- **Decisiones que vuelven:** el gimnasio que dejaste (eco `left_gym`, que ya existía) vuelve entre
  20 y 60 semanas después: alguien de ahí te cruza, y lo que hagas queda en su relación por
  `addMemF` (el escritor canónico). El entrenador que dejaste, si está en la esquina del rival, le
  suma +12 de adaptación (te lee antes: es la regla de adaptación de su identidad) y el scouting
  lo advierte.
- **Ciclo de rivalidad a la vista:** la ficha de un rival con historia muestra la etapa (la que ya
  derivaba `RPG.rivalStage`), el récord entre ustedes y el paso siguiente (revancha, trilogía…).

**Fix encontrado por las pruebas:** un reinado observado desde el inicio de la carrera (inicio
desconocido) contaba como «más de 2 años» y quedaba como era. Sin inicio, sólo cuentan las
defensas. **Fix de robustez:** un momento (y la pregunta de temperamento de RPG-02) sólo se da por
usado si la cola lo admitió; antes, un rechazo lo consumía sin preguntarse.

**Evidencia.** `dev/tests/19-rpg-campo-mundo.js`, 14 pruebas (la del sparring calcula la tendencia
con los pesos del motor sin pasar por el módulo). Mutantes 10/10 (uno equivalente documentado:
quitar el `return` tras la primera pregunta no cambia nada porque la cola admite un evento).
Chromium: el momento se ve y se resuelve desde el inicio; la tarjeta de eras se dibuja en Mundo.
Golden: las 5 trazas cambian; primera diferencia por bisección: 505 y 101, la decisión de carga
del primer campamento («lo que diga el coach»); 202, el eco del gimnasio que dejó (semana 40).
Trazas regeneradas (`--solo-trazas`). Suite 254/254, navegador 77/77.
Balance: con 60 carreras los campeones parecían bajar (53,3 → 46,7 %), dentro del error estándar
(~6,5 pp). Repetido con 150 carreras por versión (`sim.js --n 150`): campeones **48,0 → 51,3 %**,
win rate 78,2 → 78,7 %, 0 fallos de invariante en ambas. No hay una caída: era ruido.

## RPG-03 · Fase 5: la pelea se lee, se recuerda y enseña
**Tipo** combate (capa sobre el motor existente) + 2 fixes · **Cambio observable:** sí.

**Antes de diseñar se midió.** La idea obvia —contar qué hace el rival en cada situación y
declarar un «patrón» tras 3-4 repeticiones— se probó contra 169 peleas del autopiloto
(8 estilos, 250 semanas): la predicción acertaba **22-28 %**. Mostrar eso sería inventar
patrones. Por eso la lectura muestra otra cosa: **la distribución real con la que la IA del
rival va a elegir**, compuesta con las mismas piezas que usa `oppAction()`.

**Refactors neutrales para poder leer al rival sin tocar el azar** (verificado: estado final
idéntico en las 5 semillas contra la versión sin refactor):
- `CL.oppPick` = `wpick(CL.oppWeights())`; los pesos viven en `CL.oppWeightsFor(o, situación)`,
  función pura (la usan la pelea, la lectura y el scouting: los mismos números).
- la capa «identidad del rival» pasa a reglas-dato (`CL.oppRules()`): mismas condiciones, mismo
  orden, mismas llamadas a `chance`/`pick`.
- puntos de extensión en el árbol de técnicas: `tq:node` (forma de una técnica), `tq:resist`,
  `tq:resolved`, `tq:ownInfo`; y `scout:report` en `scoutReport()`.

**Fix 1 · el rival elegía acciones imposibles.** Los arquetipos «Misil», «Pared» y «Showman» y la
contra-lectura de la identidad del rival reemplazaban su elección sin mirar la posición:
«combinación» estando arriba en el suelo, «controlar» dentro del clinch. El motor no resuelve
esas acciones y el rival perdía el turno. Medido en las 169 peleas: aparecían `combo`, `td`,
`lowkick` en el suelo y `hold` en el clinch. Ahora cada reemplazo pasa por `oppCanDo(pos, a)`
(tabla `OPP_ACTS`, la que lee `resolveExchangeCore`). Balance (`sim.js --n 60`): win rate
80,4 → 79,1 %, campeones 55 → 56,7 %.

**Fix 2 · guardar y cargar cambiaba el mundo (latente).** Un peleador nacido a mitad de carrera
no tenía `f.cl`; la carga (`CL.boot`) se lo agregaba. Sólo se veía si nacía alguien justo antes
de guardar, y el fix 1 lo destapó en la prueba *guardar → cargar → continuar*. Ahora nace con
él (`fighter:made`, el evento que ya existía). Trazas idénticas con y sin este fix.

| pieza | qué hace | de dónde salen los datos |
|---|---|---|
| **Lectura** (panel en la pelea) | 4 niveles: nada → intuición (lo más probable) → lectura (~%) → leído (% exactos) | `CMB.dist()` = pesos de `CL.oppWeights` + reglas de identidad + memoria; el nivel sale de `c.read` (ya existía: jab/contra/moverse leen, pelear a lo loco no), `fightiq`, lo visto esta noche y antes, video, «Cerebro frío» |
| **Anticipar** | opción en la pelea desde el nivel «lectura»: responde a lo más probable con la acción que el motor premia contra eso | +8 de eficacia al intercambio **sólo si el rival hace lo predicho** (se compara con su elección real); −3 si no |
| **Te está leyendo** | aviso cuando repetiste algo 2 veces: a la tercera te espera con su contra, y con qué probabilidad | la regla de adaptación exacta de su identidad |
| **Memoria de revancha** (`G.rpg.fm`) | vos lo leés antes (+10); él viene esperando lo que más usaste y hace la mitad lo que le castigaste anticipando | lo observado, lo que él te vio (`playerPatterns`) y tus aciertos, por rival |
| **Scouting** | con analista / sala de video, la tendencia real en 2 / 4 situaciones; lo que ya sabés de él en su ficha | `CL.oppWeightsFor`, memoria |
| **Lecciones** | una derrota se explica con sus números (daño por acción del rival, derribos, aire, veces que te esperó) y se puede anotar | 6 sesiones del entrenamiento que corresponde rinden +0,12; aprendida, 3 peleas leyendo antes esa parte. **Ninguna estadística gratis** |
| **Maestría** | Dominada (6 usos, 4 buenas) y Firma (14 usos, 4 perfectas) | ventana del minijuego más ancha; la Firma disimula la mitad de «la tiene fichada». Notas PERFECTA/BUENA/FALLA, niveles y puntos del árbol intactos |
| **Ultimates** (4) | las L4 del árbol evolucionadas (8 ejecuciones, 3 perfectas, metida en una pelea ganada): Talón del Verdugo, Suplex de la Tierra, La Última Puerta, Último Aliento | se ejecutan con `TQ.use` del **mismo nodo**: gastan su uso, mismas condiciones, clutch dificultad 4, una por pelea; sello (Espectáculo/Precisión/Desgaste/Pura) según la identidad al despertar; un rival que ya te la vio la resiste más |

**Evidencia.** `dev/tests/18-rpg-combate.js`, 17 pruebas; la central sortea al rival 3.000-6.000
veces con la cadena real de filtros y compara con lo que muestra la lectura (±2,5 %), en pie,
con la regla de adaptación armada, en el suelo con arquetipos y con memoria. Mutantes 11/11
(el de «el panel escribe» obligó a endurecer la prueba de pureza: ahora compara desde antes del
primer dibujado). En Chromium real: panel visible, anticipar resuelto contra la elección real,
la Ultimate abre el clutch del motor FX y se resuelve con `TQ.apply`; sin errores de JS.
Golden: sobre el fix 1, sólo cambia la semilla 101, en la **tercera** pelea contra el mismo rival
(la memoria: viene esperando el jab del autopiloto). Trazas regeneradas (`--solo-trazas`).
Balance con todo el módulo, contra el fix 1 solo (`sim.js --n 60 --weeks 250`): win rate 79,1 → 78,9 %,
campeones 56,7 → 53,3 %, 0 fallos de invariante (el autopiloto no anticipa ni anota lecciones: lo
que le llega es la memoria de revancha). `e5-largas.js --n 20 --weeks 300`: 20/20 sin fallos con
invariantes cada semana. Suite 241/241, navegador 77/77.

## RPG-02 · Fase 4: la carrera deja huella
**Tipo** sistema de identidad (capa sobre lo existente) + fix · **Cambio observable:** sí,
también en la carrera del autopiloto (ver evidencia).

**Principio.** Nada de clases fijas ni de "+5 %". Todo sale de decisiones que el juego ya
pedía; lo nuevo es que se **registran**, se **nombran** y **vuelven**. Estado propio:
`G.rpg` (un objeto; save compatible: `RPG.S()` lo completa en partidas viejas).

| pieza | de dónde sale | qué cambia en el juego |
|---|---|---|
| **ecos** (62 tipos, 32 dejan memoria) | eventos del banco (`event:pre`, tabla `RPG.EV_ECHO`, 23 eventos), `media:done` (prensa/podcast), reacciones y charlas sociales, gastos de estilo de vida, `fight:scheduled` (título, poco aviso, rival arriesgado), decisiones del mánager, foco semanal, cambios de gimnasio/entrenador | mueven 8 ejes de temperamento (bipolares: riesgo, disciplina, lealtad, ego, confrontación, estrategia, espectáculo, ambición) y la tendencia de carrera; los importantes van a `G.story.memories` por `CL.remember` |
| **temperamento** | los ejes | si describe un rasgo de `PERS` distinto del declarado, el juego **lo pregunta** (como mucho una vez por año): asumirlo cambia `pers2` por la vía existente (`persFix`); negarlo también queda |
| **filosofía de combate** | las acciones que elegís en cada pelea (`RPG.ACT_FP`, 33 acciones → 6 filosofías) | se puede asumir en público; ordena las recomendaciones de tu esquina (`coach:recs`) |
| **filosofía de carrera** | ecos de carrera (dinero, gloria, competencia, libertad, lealtad, legado, fama) | asumida, cambia a qué le da valor el mánager (`mgr:score`) |
| **rasgos** (10) | hechos contados en `G.rpg.cnt` (remontadas, guerras, revanchas ganadas, pesajes seguidos, planes cumplidos…) | cada uno abre algo concreto: «Cambio de marcha» en el último round yendo abajo; replantear una vez entre rounds; reemplazos +30 %; bono asegurado en finalizaciones; revanchas de hasta 12 peleas atrás; cruces públicos; «Cortar el ring» sin depender del estilo; clases a los jóvenes del gimnasio. `cerebro_frio` queda definido para la fase 5 (lo alimenta el Fight IQ) |
| **identidad** (10 nombres) | los mismos hechos | la prensa la anuncia; cambia sólo si la nueva supera a la vigente por 10 puntos (sin eso cambiaba de apodo por un punto); se ve en Carrera |
| **diario** | memoria, rivales, rasgos, identidad | pantalla `diario` (desde Carrera y Menú): Carrera · Identidad · Personas · Rivalidades · Momentos · Legado |
| **perfil de legado** | la carrera entera | la pantalla final dice qué perfil fue (con umbrales: sin 2 títulos y 4 defensas no hay "Leyenda") |

**Puntos de extensión nuevos** (emisiones en funciones existentes, sin cambiar su lógica):
`social:react`, `social:chat`, `social:spend`, `fight:scheduled`.

**Bug encontrado por la suite y corregido en esta misma fase.** `saveReplacer` compacta
TODA clave llamada `st`/`pot`/`lr` como si fueran atributos de peleador. Los contadores
del RPG se llamaban `st`: al cargar volvían como un array de 26 cincuentas y los rasgos
se recalculaban desde cero. Lo mostró *guardar → cargar → continuar equivale a continuar*.
Se renombran a `cnt` (comentado en `RPG.DEF`) y la prueba de guardado ahora compara
`G.rpg` entero con contadores distintos de cero; un mutante que vuelve a compactar
`cnt` la pone roja.

**Evidencia (autopiloto).** `node dev/rpg-neutralidad.js --ref <RPG-3>`: las 5 trazas
difieren, y la primera diferencia de cada una se buscó por bisección:

| semilla | primera semana distinta | causa |
|---|---|---|
| 101 | 2017 s29 | «Profesional impecable»: un reemplazo pagó 6.287 en vez de 4.836 (+30 %) |
| 202 | 2017 s27 | la pregunta de temperamento ocupa la semana y el evento al azar no sale |
| 303 | 2017 s32 | ídem (la pregunta sustituye a un evento `short_notice`) |
| 404 | 2017 s24 | «Profesional»: una oferta con `rpgPro` |
| 505 | 2018 s13 | la pregunta de temperamento |

Antes de esas semanas el RNG del mundo es idéntico aunque los ganchos de registro corren
desde el debut: registrar no consume azar. Dibujar tampoco (la prueba de pureza de RPG-3
recorre `CL.SCREENS`, que ya incluye `diario`).
Balance, `dev/sim.js --n 60 --weeks 250` antes/después: win rate 78,4 → 80,4 %,
campeones 53,3 → 55 %, popularidad media 79,8 → 83,8, dinero medio 745.849 → 702.375,
finalizaciones 44,1 → 41,9 %, 0 fallos de invariante en ambas. Las diferencias por estilo
son grandes en las dos direcciones (las carreras divergen desde la semana ~80); la de
popularidad es consistente con «Veterano de guerras» y los cruces del «Provocador».
Carreras largas con invariantes **cada semana** (`dev/e5-largas.js --n 20 --weeks 300`):
20/20 sin fallos. Por todo esto se regeneraron las trazas del golden (`--solo-trazas`);
las fixtures no se tocan.

**Pruebas:** `dev/tests/17-rpg-identidad.js`, 17 pruebas. Mutantes: quitar la emisión de
`fight:scheduled`, que asumir el temperamento cambie `pers2`, el +30 % de «Profesional»,
«Alta presión» en `cutring`, la condición de rasgo de «Cambio de marcha», el límite de un
replanteo y la histéresis de 10 puntos → 7/7 detectados (la de la histéresis **no** se
detectaba con puntajes de carreras reales: la prueba se reescribió con puntajes fijos).

## RPG-01 · Fase 3: lo que existía y no se podía alcanzar
**Tipo** accesibilidad + fix · **Cambio observable:** grande en interfaz, **nulo en la
carrera del autopiloto** (ver evidencia).

**Qué se conectó (todo existía; se le dio entrada, se completó o se hizo cumplir):**

| pieza | antes | ahora |
|---|---|---|
| `podcastStart` | 0 llamadores; y el minijuego `pod` **no tenía pantalla** (caía en la base y dibujaba "undefined") | `scrPod` con la misma infraestructura que la prensa; entradas desde VIDA y desde la ficha de un rival (`podcastStart('rival', id)`); emite `media:done` (prensa y podcast) |
| `allyForm`, `travelWith`, `watchFight` | 0 llamadores | botones en la ficha social, según la etapa de la relación |
| relación | 0-100 y etiquetas sueltas | progresión derivada `relStage`: Conocido → Compañero → Amigo/Rival → Aliado/Némesis, + "historia compartida"; muestra qué hace falta para el paso siguiente |
| chef (9.500 + 650/sem) | sólo cobraba | −2 desgaste y −0,35 lb por semana de camp |
| camp de élite (28.000) | bandera inerte (y guardaba sólo `G.week`) | 6 semanas: +12 % de aprendizaje, +3 fatiga; en camp +3 afilado y +4 desgaste |
| camp de equipo (42.000) | bandera inerte | con ≥2 entrenadores, el gameplan confirmado suma +2 y lo explica |
| modificadores "Un solo gimnasio", "Sin cambiar de peso", "Carrera corta" | multiplicaban el puntaje y **no se aplicaban** | `metaLock()` en las 6 vías voluntarias; retiro obligatorio a los 32 por `retire()` |
| eliminatorias | regla y contador sin productor | el mánager las produce (`MGR.push`); ganarla deja `titleShot` y la pelea por el título aparece |
| `wantTitleRematch`, `calloutTitle` | se escribían y nadie leía | producen la revancha por el título / la defensa contra el retador nombrado |
| `trilogyOpp`, `polemicalOpp` | se leían y nadie escribía | productores al terminar una pelea (1-1 / dividida o empate) |
| mánager | negociador | `MGR.read/card`: recomienda, advierte, detecta oportunidades; el jugador sigue, presiona, pide revancha o ignora; todo queda en su memoria |
| navegación | Inicio · Entrenar · Ranking · Gente · Menú | **Carrera · Combate · Equipo · Vida · Mundo · Menú** (pantallas nuevas `vida` y `mundo` son índices; no hay lógica en ellas) |

**Bug de pureza encontrado y corregido (B-001, otra vez).** `CL.offerAnalysis` usaba
`pick()`: mirar la pantalla de ofertas movía el RNG del mundo. Medido en el commit
anterior: la pantalla `offers` cambiaba `G.rs`; ahora ninguna. Y `CL.styleAt`/`styleName`
creaban `f.cl` al leerlo: dibujar el inicio creaba estado. Las dos pasan a sólo lectura.

**Evidencia de neutralidad** (`node dev/rpg-neutralidad.js --ref <commit anterior>`): las
5 trazas del golden son **idénticas**; el estado final sólo difiere en las banderas que
ahora sí se producen (`polemicalOpp`, `trilogyOpp`). Por eso se regeneraron las huellas
(`--solo-trazas`: una línea por traza) y no las trazas.

**Pruebas:** `dev/tests/16-rpg-accesos.js`, 14 pruebas. Verificadas con mutantes: quitar la
ruta del podcast, el candado de gimnasio, la elegibilidad de la eliminatoria o el efecto
del chef, y revertir `pickStable`, pone roja la prueba correspondiente (5/5).

## RPG-00 · La base subida por el usuario, reparada
**Commits** `7058abb` (el archivo tal cual) · `[base-fix]` (este).
**Tipo** fix · **Severidad** CRÍTICA (B-1) · **Cambio observable:** las partidas con una
pelea firmada vuelven a abrir; el show amateur vuelve a poder aceptarse.

**De dónde se parte.** El archivo subido añade la capa de integridad de carrera
(`scheduleFight`, `validateScheduledFight`, título a 5 peleas, temporada del campeón,
reemplazos) y el save v5. Medido: **131 verdes / 62 rojas** en la suite del repo, que en
`00be0a4` daba 193/193.

**Qué se arregló (causa raíz → cambio):**

1. **B-1 · no se podía abrir ninguna partida con pelea firmada.** La migración v4→v5 y
   `saveValidate` trabajan sobre `g` antes de que sea `G`, pero `offerKeyFor()` y
   `validateScheduledFight()` leían el `G` global (null desde la portada). Reproducido con
   la fixture 02 y con el save congelado: `TypeError` en `offerKeyFor` → `loadGame=false`.
   `offerKeyFor(offer, g)` recibe el estado; la validación deportiva sale de
   `saveValidate` y queda en `normalizeRuntime → reconcileScheduledFight`, que ya corría
   con la partida cargada y además intenta un reemplazo antes de cancelar.
2. **B-2 · guardar y cargar alteraba ~430 peleadores.** `titleEligibility` era una copia
   de `proFightCount(f)` que nadie leía, nacía en 0 y la carga la recalculaba. Se retira
   el campo: la elegibilidad es `titleEligible(f)`.
3. **B-3 · el agente libre no podía pelear nunca.** La regla exigía organización a toda
   pelea y el show regional de "acepto lo que sea" (módulo 27) aparecía y fallaba al
   aceptarlo. La regla vive ahora en `fightSpecProblem()` —pura, sin escribir el
   `engineLog`— y admite la pelea amateur: sin organización, sin título, sin eliminatoria,
   rival activo, sano y de la división.
4. **B-7 · ofertas que no se podían aceptar.** Lo que agregan los suscriptores de
   `offers:made` no pasaba por la regla. Nueva última puerta (`puertaFinal`, orden 99).
5. **`remember()` era local** al módulo narrativo: el reemplazo de un rival nunca quedaba
   en la memoria. Se expone `CL.remember` como escritor único de `G.story.memories`.

**Pruebas adaptadas (no el juego):** 25 fixtures firmaban peleas de un agente libre contra
"el primer peleador de la división"; ahora eligen un rival con `fightSpecProblem()`, la
misma regla del juego. A-001 "otra organización" prueba el caso que sigue existiendo (un
contrato de otra organización). F-002 usa `SAVE_VERSION` en vez de un 4 escrito a mano.

**Golden master regenerado** (`make-baseline.js --solo-trazas`, flag nuevo: regenerar
TODA la línea base habría reescrito las fixtures antiguas, que son la prueba de
compatibilidad). **Evidencia de que la regeneración sólo recoge el cambio del archivo
subido:** con el archivo subido tal cual y con esta base, la traza observable (160
semanas, semana a semana y pelea a pelea) es **idéntica en las 5 semillas**; sólo cambia
la huella interna. Contra la traza vieja de `00be0a4`, el archivo subido diverge entre la
semana 3 y la 22 según la semilla, y el récord final pasa de 7-4, 8-4, 12-3, 10-1, 9-3 a
12-1, 12-3, 9-2, 14-0, 7-5 (**16 → 11 derrotas en 5 carreras**). Queda anotado como
riesgo de balance: el jugador gana más con la base subida.

**Resultado:** 193/193 en `node dev/run-tests.js`.

---

## Antes de F0 — corrección del salto al inicio (invariante I1)
**Commit** `b9480fe` · **Tipo** fix · **Estado** cerrado antes de este encargo.
**Qué cambia.** El despachador de pantallas (`clDraw`) llamaba a
`window.scrollTo(0,0)` en cada dibujado. Como casi toda acción en sitio pasa por
`render()`, cualquier interacción devolvía el documento al inicio.
Ahora sólo sube cuando `UI.screen` cambia de verdad.
**Evidencia.** Medido en Chromium real: de 70 controles en sitio, 66 saltaban al
inicio; tras la corrección, 0. Navegación (`go()` y asignación directa de
`UI.screen`) sigue subiendo. Cubierto por `dev/tests/02-scroll.js` (T-SCROLL),
verificado por mutación: al reintroducir el scroll incondicional fallan 3 pruebas.

---

## F2-01 · `migrateLegacyBlob` ya no borra partidas que no pudo migrar (F-001)
**Tipo** fix · **Severidad** CRÍTICA · **Cambio observable para el jugador:** ninguno en
partida; deja de perder sus partidas antiguas.

**Qué pasaba.** `migrateLegacyBlob()` (13780) migra las partidas del formato antiguo al
nuevo al arrancar el juego. El `localStorage.setItem` de cada partida iba dentro de un
`try` cuyo `catch` la descartaba en silencio, y después el blob legado se borraba
**siempre**. El comentario contemplaba dos casos ("o ya se migró, o no contenía nada
usable") y faltaba el tercero: **se migraron cero porque no había espacio**. La función
corre sola al arrancar, antes de que el jugador toque nada y sin pedir confirmación.

**Evidencia — corrida en rojo antes del arreglo** (blob con 2 partidas de 747 KB, cuota
apenas por encima del blob):
```
ANTES   blob presente: true
migradas: 0
DESPUES blob presente: false
DESPUES partidas visibles: {}
```

**Qué se cambió.** La escritura se aisló del resto: un fallo al escribir ya no se confunde
con una partida irrecuperable. Se cuenta cuántas partidas válidas no cupieron y **el blob
sólo se retira si ese contador es cero**. Un fallo de espacio ahora deja registro
`errRecord('migracion:sinEspacio', …, CRITICAL)`. Es la misma política que `saveGame` ya
aplicaba ante la cuota agotada: fallar de forma visible sin destruir nada del jugador.

**Impacto en el juego: NINGUNO.** Verificado aislando el arreglo: con **sólo** F-001
aplicado, la golden trace `trace-101` se reproduce **idéntica**. La función no hace nada
cuando no hay blob legado.

**Cubierto por** `dev/tests/06-f2-fixes.js`, 3 pruebas: no borra si no migró nada · sí
retira el blob cuando migró todo · un blob sin nada recuperable sí se retira.

---

## F2-02 · El jugador puede volver a ser campeón (I-001)
**Tipo** fix · **Severidad** CRÍTICA · **Cambio observable: grande y buscado.**

**Qué pasaba.** `repairCritical()` (6138) sanea el estado cada semana. Su función interna
`revisar(id)` memoiza en `vistos` y, para un id **ya visitado**, devolvía `null` en vez del
peleador. El paso 1 (`NORM.activeRefs().forEach(revisar)`, 6158) marca todas las
referencias de la carrera activa, que **siempre** incluyen `G.player.id`. Cuando el bloque
de campeones (6163) llamaba a `revisar(c)`, recibía `null`, leía "este campeón no existe" y
declaraba el cinturón vacante.

Consecuencia: **el jugador no podía ser campeón más de una semana**, `p.defenses` se
quedaba en 0 de por vida, nunca se generaba la oferta de defensa de título (3266, que exige
`rankOf(p)==='C'`) y los arcos narrativos de reinado eran inalcanzables. Cualquier campeón
NPC ofrecido como rival perdía también su cinturón.

**Evidencia — contraste A/B/C/D antes del arreglo:**
```
A) jugador coronado            -> champs.VAN.LW = f548   rankOf = 'C'
B) tras repairCritical         -> null                   rankOf = 0
C) campeón NPC no referenciado -> CONSERVA el cinturón   (correcto)
D) el mismo NPC, en G.offers   -> PIERDE el cinturón     (defecto)
```
`saveValidateV4` (12845) hace la misma comprobación con `g.fighters[c]` directo y **no**
falla: ese contraste prueba que era un defecto de implementación, no la política deseada.

**Qué se cambió.** `revisar` devuelve el peleador también en el camino memoizado. Se
conserva intacto lo que la memoización existía para evitar (no repetir el saneo caro ni el
contador `revisados`). Se corrigió la causa, no el síntoma.

**Evidencia — simulación antes/después, 40 carreras × 150 semanas:**

| métrica | antes | después | delta |
|---|---|---|---|
| **carreras con título** | **12,5%** | **67,5%** | **+55,0 pp** |
| títulos por carrera | 0,13 | 0,75 | +0,62 |
| **defensas por carrera** | **0** | **0,38** | **+0,38** |
| finalizaciones | 31,3% | 38,0% | +6,7 pp |
| KO | 31,1% | 37,8% | +6,7 pp |
| decisiones | 68,7% | 62,0% | −6,7 pp |
| popularidad media | 46,6 | 55,1 | +8,5 |
| dinero medio | 137.206 | 146.998 | +9.792 |
| fallos de invariante | 0 | 0 | 0 |

Las defensas de título pasan de ser **estructuralmente imposibles** a ocurrir. El alza de
finalizaciones y KO viene de que las peleas de título son a 5 asaltos.

**Golden master regenerado**: las 5 trazas cambian, y 4 de 5 terminan ahora con el jugador
habiendo ganado un título. Las **fixtures NO se regeneraron**: son la evidencia de I3 y
deben seguir siendo las que produjo la versión original. Las 5 siguen cargando.

**Deuda que abre, para F6+ (no se corrige aquí):** 67,5% de carreras con título es
demasiado alto frente al MMA real. El sistema estaba apagado y al encenderlo queda mal
calibrado. Es una decisión de balance, no de corrección.

**Cubierto por** `dev/tests/06-f2-fixes.js`, 5 pruebas, dos de ellas dedicadas a que el
arreglo **no** desactive el saneo: un campeón retirado y una referencia colgante siguen
dejando el cinturón vacante, y las stats no numéricas se siguen reparando.

---

## F2-03 · La pantalla de resultado ya no se puede abandonar sin resolver (D-003)
**Tipo** fix · **Severidad** ALTA · **Cambio observable:** desaparece la barra de
navegación inferior mientras hay un resultado de pelea sin cobrar.

**Qué pasaba.** `scrFightResult` ofrece exactamente dos botones, `confirmFight()` y
`recStart()`, ambos resuelven hacia adelante. Pero `renderNav` (4042) ocultaba la barra
inferior sólo en `['title','create','ending','fight','mg']`: **`fightresult` faltaba en una
lista a la que pertenece**, junto a `fight` y `mg`, que son las otras pantallas que hay que
resolver antes de salir.

Con la barra visible, el jugador podía tocar "Inicio" sin cobrar. Entonces `go()` (4021)
descartaba `G.fight`, pero `G.nextFight` sólo se anula dentro de `applyWinLossResult`
(3414), que no había corrido. Resultado: la pelea seguía firmada y se podía volver a
disputar tantas veces como se quisiera.

**Evidencia — corrida en rojo antes del arreglo:**
```
intento 1: sub, ganador=o → go('hub') → fight=null, nextFight=true, rec 0-0
intento 2: dec, ganador=o → go('hub') → fight=null, nextFight=true, rec 0-0
intento 3: ko,  ganador=o → go('hub') → fight=null, nextFight=true, rec 0-0
```
Tres derrotas encajadas, récord 0-0 y la pelea aún firmada. La lesión, la fatiga y el daño
tampoco se aplicaban.

**Qué se cambió.** La lista pasó a ser una constante con nombre, `NAV_SIN_BARRA`, y se le
añadió `fightresult`. Un solo elemento; la intención de la lista queda escrita.

**Verificado en Chromium real:** en la pantalla de resultado sin cobrar,
`nav.style.display === 'none'` y el único botón de la pantalla es `confirmFight()`.
La barra sigue visible en `hub`, `train`, `rank`, `people` y `menu`, y oculta en `title`
y `create`. Tras cobrar, `go()` sigue descartando la pelea como antes.

**Impacto en la simulación: ninguno** — el autopiloto nunca usó la barra de navegación.
Suite: 47 pruebas verdes · navegador: 28 verdes · golden master **sin cambios**.

**Lo que este arreglo NO cierra** (queda para su propio turno en F2):
**D-001**, `confirmFight()` sigue sin guarda de idempotencia — llamarla dos veces por otra
vía sigue duplicando récord y bolsa; y **D-004**, un autoguardado con el resultado sin
cobrar sigue pudiendo perderlo al recargar.

---

## F2-04 · Cobrar una pelea es idempotente (D-001 + D-006)
**Tipo** fix · **Severidad** ALTA · **Cambio observable:** ninguno en el camino nominal;
deja de ser posible duplicar récord, bolsa y semanas.

**Qué pasaba.** `confirmFight()` (4859) llamaba a `applyPlayerFight()` sin ninguna
condición de entrada. `G.paid` sólo se leía en la presentación (`scrFightResult` 4842 y
`TQ.rewardCard` 21391): era decoración de interfaz, **no un cerrojo**. GATE sólo añade
guarda de retiro y autoguardado, no idempotencia.

Y el cerrojo no podía funcionar aunque se usara, porque `G.paid = false` vivía en
`goFight()` (4793) y no en `fightStart()`, que es la función canónica de arranque: una
pelea empezada por otra vía heredaba el "ya cobrada" de la anterior (**D-006**).

**Evidencia — corrida en rojo antes del arreglo:**
```
• llamarla varias veces no duplica record, bolsa ni semanas
  esperado: {"rec":"0-1-0","cash":5767, "career":1,"semana":104834}
  obtenido: {"rec":"0-3-0","cash":12301,"career":3,"semana":104836}
• sin pelea o sin resultado no hace nada
  Cannot read properties of null (reading 'result')      ← ademas lanzaba
• D-006: fightStart no reseteo G.paid
  esperado: false · obtenido: true
```
Tres llamadas: **récord 0-3, tres entradas de `career`, tres bolsas y tres semanas
consumidas para una sola pelea.**

**Qué se cambió.** Tres cosas, todas sobre el mismo concepto — hacer de `G.paid` un
cerrojo real:
1. `G.paid = false` se movió a `fightStart()`, **atómico con la creación de `G.fight`**.
2. `goFight()` deja de resetearlo: un solo dueño.
3. `confirmFight()` abre con una condición de entrada explícita —
   `if(!G || !G.fight || !G.fight.result || G.paid) return false;` — y devuelve `true`
   cuando cobra, para que el llamador pueda distinguir.

Se corrigió la causa (un flag de UI hacía de cerrojo sin serlo), no el síntoma.

**Impacto en el juego: ninguno en el camino nominal.** Golden master **sin cambios**: las
5 trazas se reproducen idénticas. Suite: **51 pruebas verdes**.

**Nota sobre el alcance.** D-001 y D-006 van en el mismo commit a propósito: la guarda de
D-001 sólo es correcta si `G.paid` significa de verdad "la pelea actual ya se cobró", y eso
exige el reset de D-006. Separarlos habría dejado un arreglo que introduce un fallo latente
(una pelea que nunca se puede cobrar). Es un cambio a un concepto, no dos cambios sueltos.

**Lo que NO cierra:** **D-002** — `applyPlayerFight` sigue sin envolver, así que una
excepción a mitad deja la aplicación a medias; el reintento ya no duplica (la guarda lo
impide) pero el estado queda parcial. Tiene su propio turno.

---

## F2-05 · El contrato se descuenta una vez por pelea (A-001)
**Tipo** fix · **Severidad** ALTA · **Cambio observable:** los contratos duran las peleas
que dicen durar.

**Qué pasaba.** Dos escritores descontaban `G.contract.left` en la misma pelea:
- `applyWinLossResult` **3414**: `if(G.contract && G.contract.org===orgId){ G.contract.left--; }`
- hook `fight:applied`/`economia` **12583**: `if(G.contract && ...>0) G.contract.left = ...-1;`

Los contratos duraban **la mitad** de las peleas firmadas, y el evento
`contract_dispute` (3042, `c: left<=1`) saltaba antes de tiempo. Los invariantes 27762-27763
no lo detectaban porque sólo comprueban `left<0` y `left>fights`.

Además el duplicado **no comprobaba la organización**: una pelea fuera del contrato también
lo consumía. Eso no estaba en el hallazgo original; lo destapó el test.

**Evidencia — corrida en rojo antes del arreglo:**
```
• una pelea descuenta exactamente una del contrato
  esperado: 3 · obtenido: 2          (contrato de 4, una sola pelea)
• una pelea de OTRA organizacion no consume el contrato
  esperado: 4 · obtenido: 3
```

**Qué se cambió.** Escritor único: la cuenta vive en `applyWinLossResult`, que es donde se
sabe bajo qué organización se peleó. Conserva la regla de organización y se le añadió el
suelo explícito (`left > 0`) que tenía el duplicado. El hook `economia` deja de descontar
y conserva su trabajo real, ajustar la caja al contrato firmado.

**Efecto medido — 40 carreras × 150 semanas.** Aquí hay que tener cuidado con la media,
porque la economía tiene cola pesada (ver H-005):

| | antes | después |
|---|---|---|
| dinero **medio** | 146.998 | 112.257 |
| dinero **mediana** | **11.289** | **11.496** |
| dinero **máximo** | 1.227.237 | **1.227.237** (idéntico) |
| ganancias medianas | 49.749 | 48.398 |
| peleas por carrera | 11,93 | 11,93 |
| fallos de invariante | 0 | 0 |

La media cae un 24% pero **la mediana no se mueve y el máximo es exactamente el mismo**:
lo que cambió es la posición de un par de carreras dentro de la cola, no el
comportamiento del sistema. Tomar la media como evidencia de un efecto económico habría
sido un error de lectura — es justo la trampa que enseñó H-005.

Se comprobó además que **no existe ningún manejador de expiración de contrato**:
`left` llegando a 0 no dispara renegociación ni agencia libre. Los únicos lectores son la
pantalla de contratos (5085), el evento `contract_dispute` y los saneadores. Así que el
arreglo no podía tener un efecto económico sistemático, y no lo tiene.

**Golden master**: cambian 2 de 5 trazas (101 y 404), las que agotan un contrato; 202, 303
y 505 se reproducen **idénticas**. Suite: **54 pruebas verdes**.

---

## F2-06 · La marca `important` viaja con el evento (G-001)
**Tipo** fix · **Severidad** ALTA · **Cambio observable: mecanismo corregido, efecto
extremo a extremo NO MEDIDO como significativo.** Ver la sección de honestidad abajo.

**Qué pasaba.** `rollEvent` construía el objeto encolado como
`{id, txt, opts}` y **dejaba caer `important`**. Los 66 eventos del banco llegaban a
`G.pending` con `important === undefined`. Consecuencias declaradas en el código pero
inalcanzables: `advancePeriod` (26030) descartaba en silencio incluso los 10 marcados como
decisivos; `autoAdvanceToImportant` sólo paraba ante `CL.ask`; y el hook
`event:pre`/`simulacion`, que compara con `=== false`, nunca se cumplía (G-003).

**Evidencia — corrida en rojo:** `300 de 300 eventos perdieron la marca al encolarse`,
con ejemplos `coach_offer: definición false -> encolado undefined`.

**Qué se cambió.** Los **tres** constructores del objeto llevan ahora `important`.
No era uno: `rollEvent` tiene cuatro capas y la última cae a las anteriores cuando su pool
se vacía, así que corregir sólo la capa ganadora dejaba 288 de 300 eventos sin marca.
Se corrigió la capa 1 (5309), la capa 2 (22111) y la capa ganadora (26469).

**Nota de método.** La primera versión de la prueba exigía que apareciera un evento marcado
`important` entre 300 sorteos. Falló, pero **por culpa de la prueba**: en una carrera recién
creada esos 10 eventos no son elegibles (piden campeón, pelea firmada, edad, racha
negativa). Se reescribió para medir el mecanismo: para **cada** evento sorteado, la marca
del objeto encolado debe coincidir con la de su definición.

**Honestidad sobre el efecto real.** Medido con 120 bloques de 26 semanas, reproduciendo
el comportamiento anterior en el arnés para tener un "antes" limpio:

| | antes | después |
|---|---|---|
| bloques detenidos por un evento | 95,0% | 95,0% |
| **de ellos, procedentes del banco** | **0** | **0** |

**No hay diferencia observable.** Los bloques se detienen por eventos dinámicos (`cl_dyn`,
que siempre llevaron `important:true`), y esos se adelantan al banco: `advancePeriod` sólo
sortea del banco con `chance(.12)` y para entonces ya suele haber un `cl_dyn` en cola.
El mecanismo queda corregido y hay una prueba directa de que un evento importante del banco
**sí** frena el bloque cuando llega a la cola — pero afirmar que esto cambia la experiencia
sería inventar un resultado que no medí.

**Golden master**: cambian 3 de 5 trazas. Verificado entrada por entrada que **el estado
final observable y la traza semana a semana son IDÉNTICOS** en las tres: lo único que
cambió es la forma del estado (`G.pending` ahora lleva el campo, y entra en la huella).
El juego no cambió. Suite: **57 pruebas verdes**.

**Lo que deja al descubierto**, para la parte estructural de F2: `rollEvent` tiene **cuatro
capas** y tres constructores duplicados del mismo objeto. Es el candidato más claro a
consolidación del dominio de eventos.

---

## F2-07 · El reescalado de patrocinios deja de componer (H-005, mitad bug)
**Tipo** fix · **Severidad** CRÍTICA · **Alcance acotado por decisión del usuario**: se
corrige **sólo** el compuesto, no el apilado sin límite (ver D-008 en DECISIONS.md).

**Qué pasaba.** El hook `publicoSpon` (19824) aplicaba cada año
`s.week = round(s.week * clamp(mult, 0.7, 1.6))` sobre el valor **ya reescalado** del año
anterior. El multiplicador de audiencia es un **nivel** —dice cuánto vale tu público hoy—,
no una tasa de crecimiento, así que aplicarlo en cadena es exponencial sin techo.

**Evidencia — corrida en rojo:** con `mult` en su tope sostenido diez años,
**500/semana se convertían en 54.976/semana**.

**Qué se cambió.** El patrocinio guarda su valor `base` y el reescalado parte de ahí:
`s.week = round(s.base * m)`. Los patrocinios ya guardados no traen `base`: **adoptan su
valor actual la primera vez**, de modo que cargar una partida antigua no produce ningún
salto de ingreso (cubierto por una prueba). Sigue respondiendo a la audiencia: con `mult`
alto paga más que con `mult` bajo, y baja cuando el público se encoge.

**Efecto medido — A/B real.** Para esto se añadió al harness la opción `boot({file})`, que
carga otra versión del archivo; así se comparan dos versiones en el mismo proceso, con las
mismas semillas, sin revertir el árbol de trabajo. 8 carreras × 400 semanas (≈7 años):

| | antes | después |
|---|---|---|
| ingreso semanal de patrocinios, **mediana** | 1.218 | **472** (−61%) |
| ingreso semanal de patrocinios, **máximo** | 3.756 | **1.673** (−55%) |
| nº de patrocinios por carrera | 1 (máx 2) | 1 (máx 2) — sin cambio, el apilado no se tocó |
| `cash` mediana | 1.746.795 | 1.727.067 (−1%) |
| `careerEarn` | 2.011.922 | **2.011.922 (idéntico)** |

**Corrección importante a la auditoría.** El informe de economía atribuía a H-005 la cola
pesada de la distribución de dinero. **Es falso**, y este A/B lo demuestra: el compuesto
desaparece y la cola no se mueve. El mecanismo lo explica: el ingreso de `G.spons` se suma
**sólo a `G.cash`** (1323), mientras que `careerEarn` lo alimenta `G.flags.sponsorW`
(15131), que es el **artículo de tienda** de H-004 — otra cosa distinta con el mismo nombre
coloquial. **La causa de la cola sigue sin identificar** y queda abierta para F5.
`dev/audit/H-economia.md` lleva la corrección anotada.

**Golden master**: de 5 trazas, 2 idénticas (202, 303); 1 cambia sólo de huella por el campo
`base` nuevo, con estado y traza idénticos (404); y 2 tienen diferencias reales de caja al
final —`cash` −152 y −116 en la entrada 156 de 160— que son exactamente el efecto buscado,
pequeño a 3 años porque el compuesto necesita años para morder (101, 505).
Suite: **60 pruebas verdes**.

---

## F2-08 · El avance en bloque aplica el campamento (C-001)
**Tipo** fix · **Severidad** ALTA · **Cambio observable:** avanzar por bloques durante un
campamento ya no quema la preparación.

**Qué pasaba.** `advancePeriod` (26034) entrenaba con `applyTrain` **sin comprobar
`G.camp`**. El reloj avanzaba y `nextFight.weeks` bajaba, pero `camp.i`, `camp.sharp`, el
corte de peso y el diario se quedaban clavados: el jugador llegaba a la pelea con la
preparación de la semana cero sin ninguna señal de que la había perdido.

**Evidencia — corrida en rojo:** `el campamento avanzó 0 de 2 semanas consumidas`.

**Qué se cambió.** El bloque entrena tres disciplinas por semana, pero el campamento avanza
**una** semana: la disciplina de mayor peso pasa ahora por `campWeek()`, que lleva la
contabilidad del campamento, y el resto sigue por `applyTrain()`. Así `camp.i` avanza
exactamente una vez por semana, no tres.

**Efecto medido — A/B real, 5 semillas, bloque de 8 semanas con campamento activo:**

| | antes | después |
|---|---|---|
| semanas consumidas | 2 | 2 |
| **`camp.i`** | **0** | **2** |
| **`camp.sharp`** | **35** (el inicial) | **45** |
| **peso bajado** | **0** | **2,7 lb** |
| entradas de diario | 0 | 2 |

Idéntico en las 5 semillas. Las semanas consumidas no cambian: lo que cambia es que ahora
cuentan.

**Golden master sin cambios**: el autopiloto avanza con `doWeek`, no con `advancePeriod`,
así que la vía corregida no aparece en las trazas. Suite: **63 pruebas verdes**.

**Lo que NO se tocó, y queda anotado:** el bloque y la semana a semana **no son
equivalentes** y siguen sin serlo. El bloque reparte Σ 1,0625 de intensidad entre tres
disciplinas con tres tiradas de lesión; `doWeek` aplica 0,85 a una sola con una tirada, y el
bloque además regala −6 de fatiga (26036). Es C-013 en `dev/audit/C-tiempo.md`, una
diferencia de balance entre dos formas de jugar la misma semana. Decidir cuál es la
intención es trabajo de F14, no de una corrección.

---

## F2-09 · Dibujar deja de consumir el RNG del mundo (B-001) — **con cambio de comportamiento medido**
**Tipo** fix · **Severidad** ALTA · **NO es equivalente**: las 600 carreras del A/B divergen.
Se documenta como corrección con efecto medido, no como consolidación.

**Qué pasaba.** `cornerAdvice()` (2124) y `postFightQuote()` (4874-4877) elegían su texto con
`pick()`, que avanza `G.rs`, el flujo aleatorio **del mundo**. Como ambas se llaman desde la
ruta de dibujo, **redibujar alteraba la partida**: abrir el panel "Entre rounds" o volver a
la pantalla de resultado cambiaba todo el desarrollo posterior de la carrera, y los códigos
de semilla que el juego ofrece no reproducían la partida.

Era **H-001**, el hallazgo de F0 que obligó al harness a no poder stubear `render()` nunca.

**Qué se cambió.** `pickStable(array, clave)` en lugar de `pick(array)`, que es el molde que
el archivo **ya usaba** en `memRef()` (2836) para exactamente este problema. La clave
codifica el contexto: rival + round para el consejo de esquina, rival + fecha + método +
resultado para la frase del entrenador. El texto sigue siendo estable dentro del mismo
contexto y sigue variando entre contextos distintos (ambas cosas con prueba).
Detalle que confirma la intención original: `postFightQuote` ya llamaba a `memRef(c)` y
**descartaba el resultado en una variable sin usar**.

**La prueba de fondo, ahora verde:** stubear `render()` da la **misma huella** que dejarlo
correr. `render()` es puro respecto de la simulación.

**Efecto medido — A/B, 600 carreras × 150 semanas por lado, mismas semillas**
(`dev/sim.js --file` contra copias congeladas):

| métrica | antes | después | delta | tolerancia | |
|---|---|---|---|---|---|
| peleas por carrera | 11,9 | 11,9 | −0,1 | ±0,1 | equivalente |
| win rate | 72,46% | 71,53% | −0,93 pp | ±2 pp | equivalente |
| % KO | 36,05% | 34,84% | −1,20 pp | ±2 pp | equivalente |
| % sumisión | 0,19% | 0,16% | −0,03 pp | ±2 pp | equivalente |
| % decisión | 63,77% | 65,00% | +1,23 pp | ±2 pp | equivalente |
| `cash` | 132.818 | 122.385 | −10.433 | ±29.668 | equivalente |
| `careerEarn` | 175.193 | 162.845 | −12.348 | ±30.398 | equivalente |
| **popularidad** | 52,7 | 50,4 | **−2,2** | ±2,1 | **fuera** |
| **% campeones** | 57,50% | 52,83% | **−4,67 pp** | ±2 pp | **fuera** |
| fallos de invariante | 0 | 0 | — | — | |

**Lectura honesta de las dos que se salen:**
- **Las 600 carreras divergen** (0 huellas idénticas). Era inevitable: `endRound` pone
  `UI.sub='corner'` en cada fin de round, así que el consejo consumía un sorteo por round
  en **todas** las peleas. Quitarlo desplaza la trayectoria entera del RNG.
- **% campeones es inestable**: partiendo la muestra en tres tercios de 200, el delta es
  −8,5 / −4,0 / −1,5. Además, su propio ruido de muestreo a n=600 es ±4,1 pp a 2 EE, o sea
  que **la tolerancia plana de 2 pp es más estrecha que la medición**: ese criterio no puede
  discriminar aquí. **NO CONCLUYENTE** con esta muestra.
- **Popularidad sí es consistente**: −1,92 / −2,45 / −2,27 en los tres tercios. Parece un
  efecto real pequeño, coherente con el ligero descenso de KO y de campeones.

**Por qué se mantiene el arreglo pese a no ser equivalente.** No es un refactor cosmético:
es un bug confirmado —el juego ofrece códigos de semilla que no reproducen la partida— y la
solución es la que el propio archivo ya había escrito para este caso. Preservar el
comportamiento aquí significaría preservar que dibujar cambie el mundo.

Golden master regenerado (las 5 trazas). Suite: **68 pruebas verdes**.

---

## F2-10 · Aplicar el resultado de una pelea es todo-o-nada (D-002)
**Tipo** fix · **Severidad** ALTA · **Cambio observable:** ninguno en el camino normal;
un fallo a mitad ya no deja la partida a medias.

**Qué pasaba.** `applyPlayerFight()` (3345) no estaba envuelta en nada. Toca récord, bolsa,
popularidad, lesión, títulos, ranking, historial y la limpieza de `nextFight`/`camp`, y
además emite `fight:pre` y `fight:applied`, con seis suscriptores cada uno. Una excepción a
mitad dejaba aplicado **todo el prefijo que sí funcionó** y sin aplicar el resto.

**Evidencia — corrida en rojo**, inyectando un fallo en `changePopularity`:
```
esperado (sin tocar): rec 0-0-0 · cash 3.150 · career 0
obtenido            : rec 1-0-0 · cash 9.470 · career 0
```
Récord sumado y bolsa cobrada, historial vacío y `nextFight` sin limpiar.
Antes de F2-04 esto además se combinaba con la falta de guarda: el botón seguía vivo y el
reintento duplicaba el prefijo. Con la guarda ya puesta el reintento no duplicaba, pero el
estado parcial se quedaba.

**Qué se cambió.** El cuerpo va dentro de `TX.run('applyPlayerFight', …)`, que hace
snapshot y `TX.restore` ante excepción, con `errRecord` CRÍTICO. Es **la misma garantía que
`advanceWeek` ya tenía**, no un mecanismo nuevo. El `rethrow` se conserva a propósito:
`confirmFight` **no debe** marcar `G.paid` si esto no terminó, y la excepción propagándose
es justo lo que se lo impide.

Ahora, tras un fallo: el estado vuelve intacto, `G.paid` sigue en `false`, el resultado de
la pelea se conserva, y **reintentar cobra exactamente una vez** (probado).

**Golden master sin cambios**: en el camino feliz `TX.run` es transparente —hace snapshot y
no restaura—, así que no altera el consumo de RNG. Suite: **71 pruebas verdes**.

---

## F2-11 · La puerta de drama vuelve a aplicarse (G-002)
**Tipo** fix · **Severidad** ALTA · **Equivalencia estadística ACEPTADA.**

**Qué pasaba.** `CL.dramaOk()` (22105) decide si el jugador ya está en condiciones de
recibir eventos de circo: exige 2 peleas disputadas, o popularidad ≥24, o 20 semanas desde
el debut. La regla estaba escrita **sólo** en una capa anterior de `rollEvent` (22119), a la
que la capa ganadora no llega salvo que su pool quede vacío. Resultado: no se aplicaba.

**Nota de método — la primera prueba no medía nada.** La escribí replicando el escenario de
la auditoría (`rec.w=5` con `lastFights=[]`) y **pasaba sin arreglar nada**, porque en un
novato limpio ninguno de los 20 eventos de drama tiene su `c()` verdadera: la condición
propia de cada evento ya los excluía. El escenario de la auditoría era sintético —el juego
nunca produce `rec.w=5` con `lastFights` vacío—.
Hubo que buscar el caso **real**: un novato en su tercera semana de campamento, donde
`sg_counterplan` sí es elegible (pide `camp.i>=2`) y `dramaOk` sigue en falso.

**Evidencia — medición en juego real, 10 carreras × 120 semanas:**
```
eventos del banco encolados : 328
de ellos, drama con la puerta cerrada : 4      (1,2%)
    sg_counterplan @ semana 3, pop 8,  0 peleas
    sg_counterplan @ semana 3, pop 8,  0 peleas
    sg_counterplan @ semana 18, pop 16, 1 pelea
    sg_counterplan @ semana 16, pop 16, 1 pelea
```
Tras el arreglo, **la misma medición: 0 de 321**.

**Qué se cambió.** Dos sitios, porque el primero no bastaba:
1. `eventAllowed` (26440), que es el camino que el selector recorre de verdad.
2. El **respaldo relajado** (26519), que re-filtra con su propio predicado cuando el pool
   baja de 4 candidatos. Su comentario dice que relaja el enfriamiento *"NO la coherencia"*
   — y la puerta de drama es coherencia, así que faltaba ahí.

Es el mismo patrón que G-001: una regla aplicada en un sitio y olvidada en los caminos de
respaldo. `rollEvent` sigue siendo el candidato número uno a consolidación.

**Equivalencia estadística — 250 carreras × 150 semanas por lado, mismas semillas:**
todas las métricas dentro de tolerancia (`node dev/equivalencia.js`). 16 de 250 carreras
quedan con la huella **idéntica**: las que nunca rozaron la puerta.

Se añadió `dev/equivalencia.js`, que aplica el criterio de F2 y además imprime el **ruido de
muestreo** de cada proporción. Ese dato importa: `% campeones` tiene 6,30 pp de ruido a
n=250, así que una tolerancia plana de 2 pp es más estrecha que la propia medición y no
puede discriminar. Es la misma cautela que quedó anotada en F2-09.

Golden master regenerado (las 5 trazas). Suite: **74 pruebas verdes**.

---

## F2-12 · La copia de respaldo pre-migración vuelve a existir (F-002)
**Tipo** fix · **Severidad** ALTA · **Impacto jugable: NINGUNO** (verificado aislando el arreglo).

**Qué pasaba.** `loadGame` (13055) guarda una copia intacta del slot antes de migrarlo,
condicionada a `safeInt(parsed.saveVersion,1) !== SAVE_VERSION`. Pero
`saveMigrate(saveExpand(parsed))` **devuelve el mismo objeto `parsed`** y le pone
`saveVersion = SAVE_VERSION` antes de llegar a esa línea: la comparación era **siempre
falsa** y la copia **no se escribía nunca**. Acto seguido `saveGame(true)` (13066) pisa el
slot con la versión migrada, así que el original quedaba irrecuperable.
`SAVE_BAK` tampoco se lee en ninguna parte: era código muerto por los dos extremos.

**Evidencia — corrida en rojo:** `no se escribio la copia de respaldo antes de migrar`.

**Qué se cambió.** Se usa `diag.v`, que ya se había calculado con `saveShape()` **antes** de
mutar nada. Una línea. Ahora un save antiguo deja su copia intacta y uno ya al día no
duplica nada (ambas cosas con prueba).

**Impacto jugable nulo, verificado**: aplicando **sólo** este arreglo sobre la versión
anterior, la golden trace `trace-101` da la huella **idéntica** (`21a947ad`).

---

## F2-13 · El campeón fantasma (I-002)
**Tipo** fix · **Severidad** ALTA · **Equivalencia estadística ACEPTADA.**

**Qué pasaba.** `recalcRank` (1207) validaba al campeón por `retired`, `active` y `div`,
pero **no** comprobaba que siguiera militando en **esa** organización. `yearTick`
(1386-1389) asciende de organización (`f.org = up`) sin vaciar el cinturón, así que el
mismo peleador quedaba como campeón de la que abandonó y a la vez retador de la nueva.

El daño no es cosmético: `worldTick` (1509) sólo organiza pelea por título vacante si
`G.champs[org][div]` es falsy, de modo que **la división abandonada se congelaba para
siempre** — cinturón que nadie puede disputar.

**Evidencia — corrida en rojo:** tras mover al campeón de VAN/HW a otra organización y
recalcular, `G.champs.VAN.HW` seguía siendo `f154`.

**Qué se cambió.** Se añade `G.fighters[ch].org !== orgId` a la validación, junto a una
guarda por si el id ya no existe. Mismo sitio, misma forma que el resto de condiciones.

**Equivalencia estadística — 250 carreras × 150 semanas por lado:** todas las métricas
dentro de tolerancia. **172 de 250 carreras quedan con la huella idéntica**, lo que encaja
con lo que decía la auditoría: el caso es real pero de frecuencia natural baja (0
ocurrencias espontáneas en 10 años en la semilla que se revisó). Fallos de invariante 0 → 0.

Golden master regenerado. Suite: **79 pruebas verdes**.

---

## F2-14 · El avance en bloque guarda y no destruye las ofertas (C-003, C-004)
**Tipo** fix · **Severidad** ALTA · **Impacto en las trazas: ninguno** (el autopiloto avanza
con `doWeek`, no con `advancePeriod`).

**C-004 — el bloque borraba las ofertas cada semana.** `advancePeriod` (26107) llamaba a
`makeOffers()` **sin condición** en cada iteración, y `makeOffers` hace `G.offers = []`
antes de repoblar. Cualquier oferta que el jugador estuviera evaluando desaparecía.
Comparar con `finishWeek` (4525), que lo hace con `chance(.30)` y sólo si no hay pelea
firmada.
*Evidencia en rojo:* tras un bloque de 6 semanas se perdieron las ofertas `f212` y `f215`.
*Arreglo:* sólo se generan si no hay ninguna oferta de pelea sobre la mesa. El bloque sigue
deteniéndose ante una oferta importante (probado).

**C-003 — el bloque no guardaba nunca.** `advancePeriod` aparecía en la lista de *guard* de
GATE pero **no** en la de *autosave* (13658). Un bloque de 52 semanas no dejaba ni un punto
de guardado: cerrar la pestaña a mitad perdía el año entero.
*Evidencia en rojo:* `el bloque avanzo 7 semanas sin guardar ni una vez`.
*Arreglo:* `advancePeriod` entra en la lista de autoguardado, junto a las otras 27
funciones que ya la usan. No se añade lógica nueva: se declara el blindaje que le faltaba.

Suite: **82 pruebas verdes**. Golden master sin cambios.

**C-002 queda abierto a propósito** — ver `dev/DECISIONS.md`, D-011.

---

## F2-15 · El cierre de semana vive en un solo sitio (C-002) — primera consolidación estructural
**Tipo** refactor + fix · **El juego no cambia**: estado observable y traza semana a semana
**idénticos** en las 5 semillas. Lo único que cambia es que el feed contiene las noticias
que antes se perdían.

**Qué pasaba.** Todo lo que hay que hacer **después** de `advanceWeek()` estaba copiado a
mano en los nueve llamadores, y cada copia se quedó con un subconjunto distinto:

| llamador | publicaba noticias | fireEvent | makeOffers | saveGame |
|---|---|---|---|---|
| `finishWeek` | sí | 42% | 30% | sí |
| `mgClose` (rama `weekApplied`) | **no** | 42% | **no** | sí |
| `recPick` | **no** | no | no | sí (GATE) |
| `confirmFight` | **no** | no | no | sí |
| `gymVisit` / `watchFight` / `travelWith` | **no** | no | no | sí |

Y no era un retraso: `G.weekLog` **se sobrescribe** en la semana siguiente
(`advanceWeekCore`), así que esas noticias **se perdían**.

**Evidencia — corrida en rojo**, con una sonda que inyecta una noticia por semana:
```
finishWeek                 -> 1 noticia publicada   (control, correcto)
cerrar minijuego (semana)  -> 0
tres bloques de recPick    -> 0 de 3
```

**Qué se cambió.** Se extrajo `closeWeek(opts)`, un único cierre de semana. **Publicar es
lo único que no es opcional**, porque es lo único que se pierde; el resto lo declara cada
llamador, conservando exactamente lo que hacía. Seis llamadores migrados.

No se añadieron `fireEvent` ni `makeOffers` a los que no los tenían: eso es una decisión
de diseño, no una pérdida de datos, y queda anotada para F14 (hoy terminar un minijuego de
entrenamiento sigue sin generar ofertas).

**Verificación — 5 de 5 trazas:** `final IDENTICO · traza identica`. Sólo difiere el
contenido de `G.news`, que sigue acotado a 40. Suite: **86 pruebas verdes**.
Métricas de control planas (43 redefiniciones, 42 wrappers, 3 escrituras de scroll).

`advancePeriod` queda **fuera a propósito**: recoge las noticias en `sum.news` para el
resumen del bloque, así que no las pierde — las muestra en otra superficie. Cambiar eso
sería una decisión de diseño sobre qué ve el jugador al avanzar por bloques.

---

## F2-16 · El filtro de eventos tiene dos niveles, no dos copias

**Commit** `857f777` · refactor, sin cambio de comportamiento.

El selector sorteaba con `eventAllowed()` y, si le quedaban menos de cuatro candidatos,
repetía con un predicado escrito a mano **en la misma línea**. Los dos compartían tres
reglas duras —carrera viva, coherencia de contexto y puerta de drama— escritas por
separado. De ahí que G-002 hubiera que arreglarlo dos veces: tras corregir el estricto se
seguían colando eventos de circo por el relajado (el arreglo bajó de 4/328 a 1/328 antes
de tocar el segundo predicado).

Ahora las tres reglas viven en `eventCore()` y cada nivel declara **sólo lo que afloja**:

| nivel | veda | contexto | drama | categoría | `c()` |
|---|---|---|---|---|---|
| 1 estricto | `EV_VEDA` (26) | sí | sí | sí | sí |
| 2 relajado | `EV_VEDA_CORTA` (8) | sí | sí | — | sí |

**El orden de las comprobaciones se conserva tal cual estaba en cada nivel**, y no es
cosmético. Medido: **tres condiciones del banco hacen inicialización perezosa** —
`x1_parking` crea `G.flags.seen`, `sg_callout` y `sg_invcamp` crean su registro de saga —
así que adelantar una comprobación barata delante de `e.c()` se salta esa inicialización y
**cambia el estado que se guarda**. Llamar a las 66 condiciones mueve la huella del estado
en la primera pasada (`95ab9be9` → `ce51317e`) y ya no en la segunda.

También se pasan los predicados a `filter()` envueltos en una función de un solo
argumento: `filter()` pasa `(elemento, indice, array)` y el índice se colaría como segundo
parámetro — con `eventAllowed(e, relajado)` habría dejado todo el banco en nivel relajado
salvo el primer elemento.

**Verificación.** Golden master idéntico. Suite **93 verde**.

---

## F2-17 · `rollEvent`: cuatro capas encadenadas → una función

**Commit** pendiente · consolidación estructural, diferencia acotada y documentada.

### Lo que había

| capa | línea | qué añadía | alcanzable |
|---|---|---|---|
| 1 | 5344 | peso por personalidad, sin memoria ni contexto | sólo si la 2 lanzaba |
| 2 | 22143 | memoria propia (`CL.evSeen`/`EV_COOL`), puerta de drama, escalera 26→8→sin veda | sólo con el mazo de la 4 vacío |
| 3 | 25979 | reintento hasta 12 veces esperando que el contexto cuadrara | ídem |
| 4 | 26553 | veda por `eventHistory`, contexto, drama, categoría, `eventWeight` | **100 %** |

Cada capa construía **por su cuenta** el objeto que se encola. De ahí los dos bugs que
hubo que arreglar en varios sitios: la marca `important` (G-001, **tres** constructores) y
la puerta de drama (G-002, **dos** filtros).

### Medición previa

Señal sólida: sólo la capa 4 escribe `G.story.eventHistory`.

```
8 carreras x 150 semanas -> 328 sorteos
  por la capa 4 ........ 328
  por las capas 1-3 ....   0
```

Y, forzando el mazo vacío, lo que hacían las capas de abajo era devolver un evento que
cumplía **contexto + drama + `c()` saltándose la veda** — porque si hubiera pasado la veda
corta, la capa 4 lo habría tenido en su propio mazo y no habría caído. Es decir: las tres
capas viejas eran, en conjunto, **un tercer nivel de la misma escalera**.

### Lo que quedó

Una sola definición, con la política entera a la vista:

```
nivel 1   veda EV_VEDA (26) + contexto + drama + categoría + c()
nivel 2   veda EV_VEDA_CORTA (8) + contexto + drama + c()     (si quedan <4)
nivel 3   sin veda + contexto + drama + c()                   (si no queda ninguno)
```

`CL.evNivel()` dice qué nivel resolvió el último sorteo. **No vive en `G`**: no se guarda
ni viaja en el save; existe para que la política sea medible desde fuera sin deducirla del
historial, que es lo que hacía la medición anterior.

### Las dos diferencias, y por qué son aceptables

Ambas caen **dentro del nivel 3**, que el juego no recorre:

1. **Peso.** El nivel 3 pesa con el mismo `eventWeight` que los otros dos, en vez del peso
   por personalidad de la capa base. Cambia *cuál* de los candidatos sale; el conjunto de
   candidatos es el mismo.
2. **Excepciones.** Si una condición del banco lanza, ahora propaga en vez de contarse
   como "no cumple". Era un `try/catch` que tapaba un error funcional —lo que el encargo
   prohíbe explícitamente— y el camino vivo (nivel 1) nunca lo tuvo. Medido: 0 de 66
   condiciones lanzan en un mundo sano.

Además el nivel 3 **deja rastro en el historial**, como los otros dos; antes el respaldo
sorteaba sin registrar nada.

### Lo que se conserva

`CL.evSeen` / `CL.evStamp` / `CL.evAge` **no se borran**: el hook `event:resolved` sigue
escribiendo ese registro y un autotest lo comprueba. Lo que se fue es `EV_COOL`, la
*segunda* constante de veda, que ya no tenía lector. Que ese registro sobreviva sin que
nadie lo consulte para sortear es deuda de **fuentes de la verdad**, y le toca en F4.

### Verificación

- Suite **93 verde**, golden master idéntico.
- Las 7 pruebas de caracterización de `dev/tests/07-rollevent.js`, escritas **contra las
  cuatro capas**, siguen verdes contra la función única. Lo único que cambió en ellas es
  cómo se mide qué nivel resolvió el sorteo (antes: si el historial crecía; ahora:
  `CL.evNivel()`).
- A/B con `sim.js --file` contra una copia congelada de antes de fundir, 200 carreras x
  300 semanas por lado. **No sólo equivalente: idéntico.**

```
n = 200 vs 200
MEDIAS              antes        despues      delta      2*EE     veredicto
peleas por carrera   23.9         23.9          0.0       0.3     equivalente
edad final           28.0         28.0          0.0       0.4     equivalente
popularidad          93.2         93.2          0.0       1.7     equivalente
titulos               1.2          1.2          0.0       0.2     equivalente
cash            1164939.4    1164939.4          0.0  170245.4     equivalente
careerEarn      1303018.5    1303018.5          0.0  174469.3     equivalente

PROPORCIONES        antes        despues   delta(pp)  ruido(2EE)  veredicto
win rate            79.24        79.24        0.00       1.17     equivalente
% KO                45.54        45.54        0.00       1.46     equivalente
% sumision           0.11         0.11        0.00       0.10     equivalente
% decision          54.36        54.36        0.00       1.46     equivalente
% campeones         85.50        85.50        0.00       4.98     equivalente

fallos de invariante: 0 -> 0
carreras con huella identica: 200 de 200
```

  Es el resultado que la predicción exigía: si el nivel 3 no se alcanza, fundir las capas
  que vivían en él no puede mover nada. Los deltas exactamente cero en las seis medias y
  las cinco proporciones, y **las 200 huellas idénticas**, lo confirman por medición y no
  por argumento.
- Métricas de control: redefiniciones 43 → **42**, wrappers 42 → **40**, escrituras de
  scroll **3** (I1 intacto), `eval` 0, dependencias externas 0.

---

## F2-18 · Red de caracterización de los tres cierres de intercambio

**Commits** `686d3c3` (red) + el de esta entrada (verificación por mutación).

Preparación para consolidar combate. Seis pruebas en `dev/tests/08-intercambio.js` que
conducen **a mano** los dos caminos que el autopiloto no pisa y fijan lo que hacen hoy.

### Verificación por mutación — tres mutantes, tres capturas

| mutante | qué cambia | prueba que cae |
|---|---|---|
| 1 | `TQ.apply` gasta `ri(38,62)` en vez de `ri(30,52)` | «los tres relojes son distintos» y «el reloj de `TQ.apply` se queda dentro de [30,52]» |
| 2 | `TQ.apply` emite `exchange:pre/post` | «`TQ.apply` cierra el intercambio SIN emitir los hooks» |
| 3 | `fightAct` llama a `resolveExchangeCore` y se salta los hooks | «`fightAct` emite `exchange:pre` y `exchange:post`» |

### Una prueba que pasaba sin probar nada

La primera versión de la prueba de reloj sorteaba **25 peleas nuevas** y comparaba el
gasto contra `[30,52]`. Pasaba con el mutante 1 puesto. Al imprimir los números, las 25
muestras eran **44, las 25 veces**: con `metaSeed` fijo el flujo del RNG es idéntico al
empezar la pelea, así que eran 25 copias de una sola muestra — y 44 cae dentro de `[30,52]`
y de `[38,62]` a la vez, porque los rangos se solapan.

Reescrita para sortear **dentro de una misma pelea**, que es donde el RNG avanza de verdad
(reponiendo la vida de los dos para que no termine, y descartando los intercambios que
cierran el round, porque `endRound` reinicia el reloj y la resta no mediría el coste).
Ahora da `44 38 49 40 52 44 57 48 46 49 55 55 48 56 60` con el mutante y **cae**.

Es el mismo error que ya había aparecido en F2 con la prueba de save/load y con la de
G-001: **una prueba verde no vale nada hasta que se la ve caer.**

---

## F2-19 · La regla de cierre de round vive en un solo sitio

**Commit** de esta entrada · refactor, sin cambio de comportamiento.

`f.ex >= f.exPer || f.clock<=20` estaba escrita **tres veces**, constante `20` incluida, en
los tres sitios que cierran un intercambio (`fightAct` 1842, `fightFinishResolve` 6470,
`TQ.apply` 20787). Cambiar cuándo termina un round pedía tres ediciones, y bastaba olvidar
una para que un camino cerrara el round con otro criterio — el mismo patrón que obligó a
arreglar `important` en tres constructores y la puerta de drama en dos filtros.

Ahora la regla es `roundOver(f)` y los tres la consultan. Es una lectura pura de
`f.ex`/`f.exPer`/`f.clock`, así que la extracción no mueve nada.

**Lo que NO se unificó, a propósito.** El coste de reloj sigue siendo distinto en los tres
(`ri(38,62)` un intercambio normal, `ri(30,52)` una técnica, `ri(24,46)` un minijuego de
finalización). Puede ser deliberado: una técnica cuesta menos reloj que un intercambio
completo. Igualarlos es **balance, no consolidación**, y va a F14. La divergencia queda
fijada por prueba en `dev/tests/08-intercambio.js` para que no se cierre por accidente.

Tampoco se tocó que dos de los tres caminos **no emitan** `exchange:pre/post`: hacerlos
emitir haría correr el TKO por daño acumulado en técnicas y minijuegos, que es un **cambio
de comportamiento** y necesita su propia evidencia.

**Verificación.** Prueba nueva que falla si la condición vuelve a escribirse a mano en
algún cierre. Suite completa verde.

---

## F2-20 · `savePrune`: el recorrido y la regla del jugador, en un solo sitio

**Commits** `20f8130` (red) + el de esta entrada.

### Medición previa, y una señal que mentía

Primera medición: podar al final de una carrera de 250 semanas daba **0 campos redondeados
y 0 arrays truncados** sobre 400 NPC. Conclusión aparente: la segunda capa es peso muerto.

**Falso.** `savePrune` corre en **cada autoguardado**, así que al terminar la carrera ya
está todo podado y medir el estado final no mide nada. Instrumentando cada llamada real
durante la carrera:

| | seed 13 | seed 29 |
|---|---|---|
| llamadas a `savePrune` | 429 | 421 |
| campos redondeados | 3400 | 3389 |
| `rel` redondeados | 60 | 50 |
| arrays de NPC truncados | 979 | 977 |
| podas de `news` | 187 | 194 |
| podas de `retiredList` | 0 | 0 |

**Las dos capas hacen trabajo real.** Ninguna es peso muerto.

### Qué estaba duplicado, y qué no

Las podas **no** están duplicadas: una trunca listas, la otra redondea decimales. Lo que
estaba escrito dos veces es el **recorrido de `g.fighters`** y la regla **"al jugador no se
le toca nada"**.

Esa regla protege los datos del jugador: medido, un jugador de 250 semanas tiene
`career`=22 y `lastFights`=12, y sin ella **cada guardado se los dejaría en 12 y 6**.
Escrita dos veces, bastaba tocar una copia para perder historial del jugador en silencio.

### El cambio

Se extrae `eachPrunableFighter(g, fn)`. **Nada más.** Las dos pasadas siguen siendo dos:
cada una registra sus fallos con su propia etiqueta en `safeRun` (`savePrune` y
`saveCompact`), así que fundirlas en un solo bucle cambiaría el camino de error — hoy, si
la primera lanza, la segunda corre igual.

### Verificación

- Red de 7 pruebas commiteada **antes** de tocar el juego (`dev/tests/09-saveprune.js`).
- **Ocho mutantes, ocho capturas**: quitar el salto del jugador, `career` a 20, `news` a 90,
  redondeo a dos decimales, `lastFights` truncado por el extremo contrario, `rel` a un
  decimal, `retiredList` a 120, y devolver `null`.
- Tras consolidar, se mutó **el punto único** (quitar `id===pid` de `eachPrunableFighter`) y
  la prueba del jugador cayó: el sitio nuevo es el real.
- Suite **100 → 107 verdes**. Golden master idéntico.
- Métricas planas: 42 redefiniciones, 40 wrappers, 3 escrituras de scroll, `eval` 0, deps 0.
- A/B con `sim.js --file`, 200 carreras x 300 semanas por brazo: **idéntico, no sólo
  equivalente**. Deltas exactamente cero en las seis medias y las cinco proporciones,
  0 fallos de invariante, y **200 de 200 huellas idénticas**. Era lo exigible: extraer un
  recorrido sin cambiar el orden de nada no puede mover un bit, y así queda medido.

### Error propio, registrado para que no se repita

Los cinco primeros mutantes se lanzaron pasando los patrones como **argumentos de shell**, y
el escapado se comió dos de ellos (`\*` y `\&\&`): el script abortó y las pruebas salieron
en verde **sin que el mutante existiera**. Casi lo reporto como "capturado". Los mutantes
van en un script Python con los literales dentro, nunca por la línea de órdenes.

Es la cuarta vez en F2 que el instrumento miente antes que el código. Las otras tres:
la prueba de save/load que exigía punto fijo en la primera vuelta, la de G-001 que pedía un
evento imposible en una carrera nueva, y la de reloj que medía 25 copias de la misma
muestra.

---

# F2-bis · Cinco bugs abiertos, resueltos

> Tras cerrar F2 quedaban hallazgos de auditoría sin tocar. Estos cinco son **defectos de
> corrección**, no de balance ni de estructura, así que no cruzan ninguna frontera: el
> balance sigue en F14, `UI.screen` y la navegación en F3, las fuentes de la verdad en F4.

## F2-21 · G-004 · El sorteo tenía efectos aunque la cola lo rechazara

`fireEvent()` era `queueEvent(rollEvent())`, y **JS evalúa el sorteo antes** de que
`queueEvent` mire si hay sitio. Sortear no es gratis: escribe la veda de 26 semanas en
`eventHistory` y `sel.x()` muta los temporales compartidos —`G.tmpOpp`, `G.tmpSpon`,
`G.tmpAmt`— que el evento **ya en pantalla** va a leer cuando el jugador elija. Dos daños:
una veda quemada por un evento que nadie vio, y el pendiente resolviéndose contra el
peleador equivocado.

**Medido:** 4 carreras x 300 semanas → 378 llamadas a `fireEvent`, **0 con la cola
ocupada**. El defecto era **latente**: los dos llamadores de hoy comprueban la cola por su
cuenta. Por eso el arreglo **no mueve el golden master**.

Lo que cambia es de quién es la regla. `queueHasRoom()` la declara una vez y la consultan
los dos que la necesitan: `queueEvent`, para rechazar, y `fireEvent`, para **no sortear en
balde**. Tenerla repetida en los llamadores es justo lo que mantuvo el agujero abierto.

**De paso, G-005 ya estaba resuelto.** La auditoría lo daba como el único llamador sin
guarda; F2-15 lo migró a `closeWeek`, que sí comprueba. Verificado, no supuesto.

## F2-22 · D-007 · Terminar una pelea ya terminada la reescribía

`finishFight()` no tenía la guarda `f.over` que sí tienen `fightAct`, `tkoCheck` y
`tqPasivas`. Una segunda llamada sobrescribía `f.result`, volvía a consumir RNG
—`chance(.5)` para KO/TKO, tres `rnd()` para la decisión— y redibujaba. Es el mismo agujero
que D-001 y D-002 ya costaron en la vía de cobro, tapado sólo por la disciplina de los
llamadores. `finishByDecision` tampoco la tenía.

La guarda va **antes del hook**: sobre una pelea terminada no hay nada que anunciar.

## F2-23 · D-010 · La pantalla de resultado llamaba derrota a un empate

`scrFightResult` calculaba `won = res.winner==='p'`, **sin tercer estado**, así que el
empate caía en la rama de derrota: "DERROTA", "PERDISTE", y encima atribuía la pelea al
rival ("*Conor McGregor* por empate unánime"). La capa de arriba antepone una tarjeta
"EMPATE" correcta, de modo que el jugador veía **los dos mensajes contradictorios en la
misma pantalla**.

La auditoría lo marcaba BAJA. **Medido, no lo es:** 200 carreras x 300 semanas → 108
empates de 4779 peleas (2,26%), y **85 de las 200 carreras tienen al menos uno**. Casi la
mitad de las partidas ve esa pantalla.

**Lo que se comprobó y NO era bug.** `applyWinLossResult` también tiene sólo dos ramas, y
un empate por la rama `else` habría sumado derrota, puesto la racha en negativo y —peor—
**quitado el cinturón al campeón**. No ocurre: `applyPlayerFight` enruta el empate a
`applyDrawResult`, un manejador de primera clase. El hook de sagas también lo excluye
explícitamente. Verificado antes de tocar nada.

## F2-24 · C-006 · El descanso de `skipWeek` se evaporaba al guardar

`skipWeek` era `finishWeek(...)` y **después** restar 12 de fatiga. `finishWeek` cierra la
semana, y cerrar guarda: el save se escribía con la fatiga vieja. **Medido: 48,58 en el
save contra 36,58 en memoria** — los 12 puntos de descanso, que son el único efecto de la
acción, se perdían al recargar.

**El arreglo obvio era incorrecto.** Restar antes de `finishWeek` cambia el resultado,
porque `advanceWeek` aplica su propia recuperación y el orden importa cuando ésa no es una
constante. La resta va **después de avanzar la semana y antes de guardar**, así que
`finishWeek` acepta un segundo argumento opcional para el efecto propio de cada acción.

## F2-25 · F-003 · El blob heredado se sellaba v4 sin migrar

`migrateLegacyBlob` hacía `saveExpand(g); savePrune(g); g.saveVersion=SAVE_VERSION;` **sin
llamar a `saveMigrate`, ni a `SAVE_STEPS`, ni a `saveValidateV4`**. Un save v1 quedaba
etiquetado v4; al cargarlo, `saveShape` decía "al día" y se aplicaban **cero pasos**.
`socCD`, `trainRec`, `mgStats` y `sagas` quedaban `undefined` en una partida que el juego da
por correcta.

Ahora pasa por `saveMigrate`, el mismo camino que usa `loadGame`. Y si devuelve `null` la
partida era irrecuperable y **no se escribe**: sellarla era justo lo que convertía un save
roto en uno "al día".

## F2-26 · C-008 revisado: no reproduce, y un error de medición mío

La auditoría daba C-008 como CONFIRMADO: la semana del aviso financiero no se cobra.
**Medido, no es así.** La economía se **difiere**, no se salta: `CL.finWarn` tiene dos
caminos y los dos la aplican — el de enfriamiento en el acto, el otro a través del
manejador `cl_finwarn`, que cobra según la opción que elija el jugador.

```
1 carrera x 250 semanas, arrancando con 40 de caja
  avisos financieros ................... 60
  preguntaron al jugador (CL.ask) ...... 25
  aplicaron por enfriamiento ........... 35
  NI una NI otra (semana gratis real) ...  0
  rechazos de queueEvent ................  0
```

**Mi primera sonda dijo 275 de 527 (52%) y era falsa.** Contaba "semana inerte" como *no
encoló y la caja no cambió*. Pero `CL.overdraft` convierte el descubierto en deuda y
devuelve la caja a 0, así que "la caja no cambió" es perfectamente compatible con que la
economía **sí** se haya aplicado. Llegué a escribir ese 52% antes de comprobarlo. La señal
válida es instrumentar `CL.ask` y `CL.overdraft`, que distinguen los dos caminos.

Es la **quinta** vez en esta obra que el instrumento miente antes que el código, y la
primera en la que el error apuntaba a un bug inexistente en vez de a ocultar uno real.

**Riesgo residual, no corregido a propósito.** `s.lastFinWarn = now` se escribe antes de
`CL.ask`: si `queueEvent` rechazara ese `cl_dyn`, se quemaría el enfriamiento y la economía
no se aplicaría. Medido: 0 rechazos en 60 avisos. Sin evidencia no se toca.

## F2-bis · Verificación de los cinco arreglos, y qué NO cubre el A/B

**Suite 107 → 125 verdes.** Golden master idéntico en las cuatro trazas. Navegador 28/28
en tres resoluciones con I1 intacto. Métricas planas: 42 redefiniciones, 40 wrappers, 3
escrituras de scroll, `eval` 0, deps externas 0.

**A/B con `sim.js --file`, 200 carreras x 300 semanas por brazo:** deltas exactamente cero
en las seis medias y las cinco proporciones, 0 fallos de invariante, **200 de 200 huellas
idénticas**.

### Lo que ese A/B demuestra, y lo que no

| arreglo | ¿lo recorre el A/B? | qué lo respalda |
|---|---|---|
| G-004 | **sí** | 378 llamadas medidas, 0 con la cola ocupada → latente, por eso idéntico |
| D-007 | **sí** | los llamadores ya guardaban → latente, por eso idéntico |
| D-010 | **no toca estado** | sólo dibuja; lo cubren las 4 pruebas de la pantalla |
| **C-006** | **NO** | el autopiloto nunca llama a `skipWeek` |
| **F-003** | **NO** | el autopiloto nunca llama a `migrateLegacyBlob` |

**Las 200 huellas idénticas NO validan C-006 ni F-003**: esos dos caminos no se recorren en
la simulación. Es el mismo límite del instrumento que ya apareció con el respaldo de
`rollEvent` y con `TQ.apply`. Lo que los respalda son sus pruebas, que los conducen a mano:
tres para C-006 (incluida la recarga real del save que escribió `skipWeek`) y dos para
F-003 (una partida v1 metida en el blob y migrada).

Dicho de otro modo: el A/B sirve aquí para demostrar que los arreglos **no rompieron nada
de lo que la simulación sí recorre**, no para demostrar que los cinco funcionan.

---

# F3-bis · Bugs y deuda técnica, tanda abierta

## F3-01 · H-001/002/003 · Las actividades que dan dinero no tenían techo

`fameStart` no tenía **ninguna** puerta: ni coste, ni enfriamiento, ni consumo de semana,
ni comprobación de ocupado. Las tres actividades que pagan se podían repetir sin límite en
la misma semana.

**Medido, conduciéndolas a mano** (el autopiloto no pulsa botones de minijuego), con 50.000
de caja y todo dentro de la misma semana:

| actividad | clics | caja | efecto extra |
|---|---|---|---|
| `invest` | 12 | 50.000 → **137.570** | **+2.160/semana para siempre** |
| `stream` | 10 | 50.000 → 91.700 | — |
| `photo` | 10 | 50.000 → 124.500 | — |

**Corrección a la auditoría.** H-001 afirmaba *"`invested` nunca se resta de `G.cash`: no se
arriesga capital"*. No es exacto: `ret = invested * (q-0.45)*2.2`, y con `q` baja ese
multiplicador es **negativo** — el capital sí se pierde. El defecto real no es que el
retorno sea generoso, es que **no había límite de repeticiones**, así que el dinero no
tenía techo.

**Arreglo.** Una por semana cada una (`FAME_DINERO`), y techo al ingreso pasivo
(`BIZ_INCOME_MAX = 1800`, diez inversiones buenas). Medido antes: 60 semanas invirtiendo
daban **10.800/semana** perpetuos.

**Lo que NO se limitó, a propósito.** `walkout`, `reel`, `weekplan`, `reactwall`, `vrspar`
y `cryoflow` siguen repetibles: dan atributos o popularidad, y ambos ya tienen tope propio.
El límite es para lo que no lo tenía.

**Estado nuevo en el save:** `G.flags.fameWeek = {at, invest, stream, photo}`. Es aditivo;
una partida vieja simplemente no lo trae y la guarda lo trata como "no hecho".

## F3-02 · E-001 · La agresividad del jugador, APARCADA pendiente de evidencia

**Estado: escrita, probada y NO integrada.** Vive fuera del árbol hasta que el A/B decida.

**El hallazgo, medido.** Con un proxy sobre `p.st` a lo largo de 40 peleas y 637
intercambios: **23 de los 26 atributos se leen durante una pelea. La agresividad del
JUGADOR no.** Y sin embargo varios eventos la suben (2766, 2959, 3110, 3115, 17697) y el
estilo *Pressure Fighter* la trae de serie a +14. Se escribía y no se leía: un sumidero
visible en la hoja de personaje.

Lo que sí se leía es la del **rival** —`o.st.aggression` en 1771, 2596, 16885 y 26131— para
que la IA decida cómo pelea y para el scouting. El jugador no tenía equivalente porque
elige sus propias acciones, así que el atributo no tenía por dónde entrar.

**Corrección a mi propia medición.** La primera sonda fue **una sola pelea** y concluyó que
4 atributos no se leían nunca. Ampliada a 40 peleas bajó a 3, y de ésos `discipline` y
`recovery` sí se usan fuera del combate (decaimiento del entrenamiento, riesgo de lesión,
recuperación semanal). El único realmente muerto era `aggression`.

**Por qué está aparcada.** El cambio entra por `combat:eff` y es de suma cero —empuja el
ataque y descuida la defensa en la misma medida, escala corta de ±2,2—, pero **toca todas
las peleas**. Consecuencia medida: de la suite entera fallan **sólo las 5 trazas del golden
master**, 130 verdes. Ésa es exactamente la huella de un cambio de combate deliberado.

Integrarla exige, por el criterio del propio encargo: equivalencia estadística contra una
copia congelada, y **regenerar las cinco trazas**.

### El primer A/B no valía, y el error fue mío

Reporté "200 de 200 huellas idénticas" como resultado. **Es imposible**: si el cambio
estuviera activo las huellas tenían que diferir. Lo que pasó es que **retiré el cambio del
archivo mientras el A/B corría**, así que el segundo brazo midió el archivo sin agresividad
y comparó la versión commiteada contra sí misma. Rompí la regla que yo mismo había escrito
en este documento: *mientras corre el A/B, no toques el archivo del juego*.

Rehecho con **los dos brazos sobre copias congeladas** (`--file` en ambos), que difieren
sólo en la agresividad — así no se puede invalidar tocando el árbol.

### El A/B bueno

```
n = 200 vs 200 · 300 semanas
MEDIAS              antes        despues     delta      2*EE    veredicto
peleas por carrera   23.9         23.9         -0.0       0.3    equivalente
edad final           28.0         28.0          0.0       0.4    equivalente
popularidad          93.2         91.7         -1.5       2.0    equivalente
titulos               1.2          1.2         -0.1       0.2    equivalente
cash            1164939.4    1230846.4      65907.1  177357.4    equivalente
careerEarn      1303018.5    1370860.0      67841.5  181772.5    equivalente

PROPORCIONES        antes        despues  delta(pp)  ruido(2EE)
win rate            79.24        79.02       -0.22       1.17    equivalente
% KO                45.54        45.22       -0.32       1.46    equivalente
% sumision           0.11         0.06       -0.04       0.10    equivalente
% decision          54.36        54.72        0.36       1.46    equivalente
% campeones         85.50        82.50       -3.00       4.98    FUERA (dentro del ruido)

carreras con huella identica: 0 de 200
```

**0 de 200 huellas idénticas**: el cambio está activo, como debe ser. Las seis medias y
cuatro de las cinco proporciones, equivalentes. **El win rate se mueve −0,22 pp con un
ruido de 1,17**, que es lo que la suma cero predecía: la agresividad reparte, no regala.

**Lo que NO queda resuelto, dicho claro.** `% campeones` cae 3,00 pp con una tolerancia
plana de 2 pp, así que la herramienta lo marca FUERA — pero el ruido de muestreo de esa
misma proporción es de 4,98 pp, o sea **más ancho que la propia tolerancia**. No puedo
distinguir ese −3 pp de cero, y tampoco descartarlo. Una muestra mayor lo zanjaría.
Interpretación honesta: si es real, es una pequeña subida de dificultad en las rachas de
título, no en ganar peleas.

### Las trazas, regeneradas

Las cinco cambian, que es la consecuencia buscada. Las carreras semilla se mueven en ambas
direcciones — la 404 gana una pelea más, la 505 pierde una — lo cual es lo esperable cuando
el cambio reparte en vez de inflar:

| semilla | récord | títulos |
|---|---|---|
| 101 | 7-3-1 → 7-4-1 | 2 → 0 |
| 202 | 8-4-0 → 8-4-0 | 1 → 1 |
| 303 | 12-3-0 → 12-3-0 | 1 → 1 |
| 404 | 9-1-1 → **10**-1-1 | 0 → 0 |
| 505 | 10-2-1 → 9-3-0 | 0 → 0 |

### Sobre la clasificación de atributos

`AGGR_DEF` incluye `composure`, lo que hace que dos conjuntos de grappling se cuenten como
defensivos. Es deliberado: `composure` es resistencia mental, y que un peleador agresivo la
comprometa es coherente. **Y sobre todo, la neutralidad no se supone de la simetría de la
constante: se mide.** El A/B es lo que la respalda.

---

## F3-03 · H-010/011 · Los artículos de la tienda cumplían su promesa: ahora sí

**Medido primero:** los **once** flags que escriben los artículos aparecen **una sola vez
en todo el archivo** — la escritura. **Cero lecturas.** El jugador paga y el efecto que la
descripción promete no existe en ningún sitio. Los más caros: `penthouse` 300.000 y
`vault` 750.000.

Se conectaron los cuatro que tienen un enganche numérico claro:

| artículo | promesa | dónde entra ahora |
|---|---|---|
| `cutman` | "recibís menos daño acumulado" | el daño tras la pelea baja un 28 % |
| `recoverylab` | "mejora la recuperación entre rounds" | `RES.betweenRounds`, +25 % al factor |
| `penthouse` | "descanso" | el descanso semanal sube un 20 % |
| `nutri` | "el corte de peso deja de castigarte tanto" | la multa pasa del 20 % al 10 % |

### Tres cosas que aprendí midiendo, y que corrigen lo que yo mismo había escrito

1. **`vault` NO estaba roto.** Leí `CL.once('vaultIncome')` como una guarda de *una vez en
   la vida* y afirmé que la renta era un pago único. **Me equivoqué:** `CL.once` marca con
   `year+'-'+week`, o sea **una vez por semana**. La renta es estable de verdad. La prueba
   se conserva igualmente, porque fija ese contrato: si alguien convierte `CL.once` en un
   once-ever, cae.
2. **Mis dos primeros arreglos fueron a rutas muertas.** `endRound` delega en
   `RES.betweenRounds` y sólo usa su propio cálculo si `RES` no existe; y la multa de peso
   que gobierna la liquidación vive en `fightPayout`, no en el `purse *= .8` de
   `applyWinLossResult`. Las pruebas seguían rojas y por eso se descubrió.
3. **Una prueba mía no probaba nada.** La primera versión de la de `nutri` terminaba en
   `ok(true, ...)`. Pasaba siempre. Es la quinta vez en esta obra.

### Hallazgo nuevo, anotado y NO tocado: hay dos cuentas de dinero

Al rastrear `nutri` apareció que `fightPayout()` —que el propio archivo declara **"FUENTE
ÚNICA DE VERDAD DEL PAGO"** (12698)— devuelve un neto que **no siempre coincide con lo que
acaba en `G.cash`**. Medido: con la multa de peso activa, `fightPayout` daba 9.480 sin
nutricionista y 10.665 con él, mientras `G.cash` terminaba en 15.664 **en los dos casos**.

`applyWinLossResult` hace su propia cuenta y el hook `fight:applied/economia` ajusta después
con `diff = q.net - paidOld`. Son dos caminos, y la liquidación que el jugador **ve** puede
no ser la que **cobra**. No lo toco: necesita su propia investigación y su propia
evidencia. Queda como deuda, y es de la familia de `dev/DEUDAS-F4.md`.

### Lo que sigue muerto

`analyst`, `stylist`, `eliteCampWeek`/`eliteCampBoost`, `teamCamp`, `videoWall` y
`vaultCash` siguen sin lectura. Prometen **información** (ver una debilidad del rival,
mejor scouting, mejores respuestas en prensa) o **calidad de camp**, que no tienen un punto
único donde entrar. Cada uno necesita su propio diseño, no un factor.

---

## F3-04 · B-007 · La pantalla de fin de carrera respeta el contrato

`ending` era la **única** entrada de `CL.SCREENS` sin guarda: `scrEnding` usa `G.ending`
sin comprobarlo, así que dibujarla sin final lanzaba `TypeError: Cannot read properties of
undefined (reading 't')`. La red de `render()` lo capturaba y devolvía al jugador al hub con
un aviso, de modo que no se veía — pero el contrato *"devuelvo `null` si no puedo
dibujarme"*, que sí implementan `retire`, `fight`, `fightresult` y `mg`, estaba roto en esa
sola entrada. Ahora lo cumple.

---

## F3-05 · H-006 revisado: reproduce, pero **no es un defecto**

La auditoría lo marcaba ALTO: *"el novato queda en descubierto antes de poder cobrar"*.
Medido, la descripción es correcta — y aun así **no hay nada que arreglar**, porque el juego
lo modela a propósito.

Traza semana a semana de un novato sin tocar nada:

```
al crear la carrera:  caja 3.150 · deuda 650
  "adelanto de arranque: el gimnasio y el equipo elegidos cuestan
   más de lo que cubren tus $2.500 iniciales"  — Rafa Ocampo, 0,4 %
  semana 1 · caja 2.625     semana  7 · caja 0 · deuda   650
  semana 2 · caja 2.100     semana  8 · caja 0 · deuda 1.175
  semana 3 · caja 1.575     semana  9 · caja 0 · deuda 1.700
  semana 4 · caja 1.050     semana 10 · caja 0 · deuda 2.225
  semana 5 · caja   525     semana 11 · caja 0 · deuda 2.774
  semana 6 · caja     0     semana 12 · caja 0 · deuda 3.328
```

Primer cobro de pelea entre las semanas **7 y 12** (10 carreras, `metaSeed` variado). O sea:
la caja se agota antes del primer ingreso, tal cual decía la auditoría.

**Por qué no se toca.** El juego tiene maquinaria explícita para exactamente esto: te da un
**adelanto de arranque** al crear la carrera porque sabe que el gimnasio elegido cuesta más
que la base, convierte el descubierto en **deuda visible con interés** en vez de en un saldo
negativo invisible, y tiene **austeridad** al llegar al tope (`CL.OD_CAP`). Eso es tensión
diseñada, no un olvido. Cambiar los números es balance, y va a F14.

### Dos errores de medición míos, encadenados

1. **`metaSeed` fijo, otra vez.** Mis primeras 8 carreras dieron cifras **idénticas**:
   eran una sola muestra repetida. Es la tercera vez en esta obra.
2. **"Nunca entra en rojo" era falso.** Medí `while(G.cash >= 0)` y me dio 80 semanas sin
   rojo en todas. Pero `CL.overdraft` clampa la caja a **0** y manda el resto a deuda, así
   que `G.cash >= 0` es siempre verdadero. La señal válida es `CL.debtTotal()`. Es
   **exactamente el mismo error** que cometí con C-008, en la misma sesión.

---

## F3-06 · A-013 · La pantalla de resultado mostraba dos cobros distintos

Tras una pelea hay **dos objetos de pago**:

- `G.fightPayout` — lo escribe `applyWinLossResult` con su propia cuenta.
- `G.lastPayout` — lo escribe el hook `fight:applied/economia`, que además **ajusta la
  caja** con `diff = q.net - paidOld`.

Y **los dos se pintan en la misma pantalla**: "Cobro neto" en `scrFightResult` (5008) y la
tarjeta "💵 Liquidación" en el hook (12756).

**Medido:** la caja coincide **siempre** con `G.lastPayout` (8 de 8) y **nunca** con
`G.fightPayout`. Un caso real destacaba **7.900** de cobro neto mientras entraban **15.664**
— el número grande de arriba era el falso.

Es la misma forma que D-010: dos mensajes que se contradicen en la misma pantalla, y el
destacado es el equivocado. Como el hook es el que reconcilia la caja, es el que tiene la
verdad: ahora deja `G.fightPayout` sincronizado.

**Por qué no se movió a `RUNTIME_KEYS`.** Es un valor derivado y sólo lo lee la pantalla,
así que parecía candidato. Pero si se pierde al recargar, `scrFightResult` haría `pay.net`
sobre `undefined` y lanzaría — exactamente el bug que se acaba de cerrar en B-007.
Persistirlo es la protección. Se queda.

---

## F3-07 · A-002 · `careerEarn` registraba más de lo que se ganaba

El hook de economía hacía:

```js
G.cash       += diff;                 // diff PUEDE ser negativo
G.careerEarn += Math.max(0, diff);    // aquí no
```

`applyWinLossResult` ya había sumado su propio `paidOld` a las dos. Cuando la corrección es
**negativa** —la fórmula vieja concede bono y `fightPayout()` no, o `CL.payout()` descuenta
deuda— la caja baja y las ganancias de carrera se quedan con la cifra vieja.

La auditoría lo daba por *CONFIRMADO en código pero **no medido***. **Medido ahora: 94 de
144 peleas divergen.** Caso real: entran **947** en la caja y la carrera anota **1.597**.

Importa porque `careerEarn` alimenta el legado, tres logros y la puntuación final: el
jugador terminaba la carrera con un marcador que nunca ganó.

Arreglado sumando el `diff` entero, con suelo en 0 para que una racha de correcciones no lo
deje negativo.

**Las trazas del golden master se regeneran** en los dos casos: `fightPayout` y `careerEarn`
viven en `G`, así que su valor entra en la huella. Es el cambio buscado — ahora guardan la
cifra real.

---

# ARRANQUE DEL PLAN DE CINCO ETAPAS

## Estado real contra el estado de partida del encargo

El encargo parte de `6f56cb9` con la cola de F2 pendiente. **El repo está 12 commits por
delante y esa cola ya está cerrada entera.** La divergencia queda explicada por los commits
posteriores, así que no corresponde detenerse (ARRANQUE, punto 2).

| ítem de E1 | estado | evidencia |
|---|---|---|
| `savePrune` | **consolidado** (sólo el recorrido y la regla del jugador) | `1567086`, D-014 |
| `pruneWorld` | **no se fusiona**: cambia qué luchadores existen | D-013, medido |
| `cardioStart`/`strStart`/`drillStart` | **no se fusionan**: el camino vivo ya es una función; el respaldo es inalcanzable por construcción | D-015, medido |
| cierre de intercambio (opcional) | **no se extrae**: lo repetido era la regla de round, ya en `roundOver()` | D-016 |

Decisiones por **D-016** (no D-012). Registro por **F3-07** (no F2-18).

**Aviso sobre el criterio de salida de E1.** "Golden master idéntico" ya no puede medirse
contra el punto de partida: los arreglos posteriores a F2 movieron las trazas **a
propósito** (agresividad cambia el combate; `careerEarn` y `fightPayout` viven en `G`).
Cada regeneración está documentada con su A/B. Se aplica el criterio como *idéntico desde
la última regeneración justificada*.

## Línea base de rendimiento (ARRANQUE punto 3)

Generada con `node dev/perf/baseline.js` y `node dev/perf/hub-dom.js`. Archivos:
`dev/perf/baseline.json` y `dev/perf/hub-dom.json`.

| medida | valor |
|---|---|
| `advanceWeek` media | **24,04 ms** |
| `advanceWeek` p95 | **30,40 ms** |
| `advanceWeek` máximo | 132,82 ms |
| `saveSerialize` media | 45,48 ms |
| `loadGame` media | **147,24 ms** |
| save semana 50 / 150 / 300 | 729,4 / 677,7 / **750,3 KB** |

**El inicio, en el DOM real** (no en el harness):

| resolución | alto | **pantallas** | nodos | bytes | botones | <44 px |
|---|---|---|---|---|---|---|
| 360×640 | 5.655 px | **8,84** | 327 | 17.996 | 76 | 38 |
| 390×844 | 5.361 px | 6,35 | 327 | 18.004 | 76 | 38 |
| 412×915 | 5.163 px | 5,64 | 327 | 18.025 | 76 | 38 |

Objetivo de E3: **≤ 1,5 pantallas en 360×640**.

### Una medición mía que era falsa, corregida

La primera versión de `hub-dom.js` midió **14 nodos y 1 pantalla** en las tres
resoluciones, y lo di por bueno un momento. Es falso: **si hay un evento pendiente el hub se
colapsa** a mostrar sólo el evento. Lo detecté al contrastar con una captura de pantalla,
que mostraba un inicio lleno. El medidor ahora vacía la cola antes de medir y deja el aviso
escrito. Es la séptima vez en esta obra que el instrumento miente antes que el código.

## Copia y save congelados (ARRANQUE punto 4)

- `dev/perf/congelado/juego-base.html` — copia del juego en este punto.
- `dev/perf/congelado/save-referencia.json` — 749 KB, carrera 7-4-0 en 2018/47, hecho con
  esa copia.
- `dev/tests/11-congelado.js` — tres pruebas permanentes: el save existe, carga sin perder
  la carrera, y el juego sigue avanzando después de cargarlo.

## Siguiente paso exacto

**E2 — dueño único de la navegación.** Mapear las 37 escrituras directas de `UI.screen`,
los 6 cierres de minijuego con sus 3 destinos y los 30 escritores de `G.mg`; red de
caracterización antes de tocar; `goTo(pantalla)` como único escritor de `UI.screen` y único
que decide el scroll (I1).

---

# E2 — NAVEGACIÓN CON DUEÑO ÚNICO (en curso)

## Lo que el mapeo cambió del plan

**`go(s, sub)` ya existía** y es la función canónica: emite `nav`, descarta una pelea
terminada salvo hacia `fight`/`fightresult`/`mg`, escribe `UI.screen` y `UI.sub`, hace
scroll y redibuja. El trabajo de E2 **no era crearla**, sino que las escrituras directas
dejaran de esquivarla.

Reparto real de las 51 escrituras de `UI.screen`:

| dónde | cuántas |
|---|---|
| dentro de cadenas HTML (botones "Volver al inicio") | 12 |
| código real | 36 |
| …de esas, `UI.screen='mg'` (abrir minijuego) | **18** |

## Dos dueños nuevos

**`mgOpen(mg, dibujar)`** — absorbe las 18 copias de `UI.screen='mg'; render();`.
Unifica **sólo la navegación**: cada sitio sigue armando su `G.mg`, porque hay **once
formas distintas** de construirlo y mezclarlo habría hecho el cambio imposible de
verificar. `mg` sin pasar significa "no toques `G.mg`, sólo navega".

**`mgExit(destino, dibujar)`** — absorbe los 6 cierres. **Los tres destinos se conservan**,
no se unifican: `'train'`, `'hub'` incondicional, y `'auto'` para la regla `fight`/`hub`
según haya pelea viva, que ahora existe en un solo sitio. Unificarlos es cambio de
comportamiento y se evalúa en E5, como pide el encargo.

## Métricas, antes → después

| métrica | base | ahora |
|---|---|---|
| escrituras de `UI.screen` | 51 | **27** |
| escritores de `G.mg` | 30 | **26** |
| escrituras de scroll | 3 | **3** |

## Dos decisiones propias

- **La limpieza defensiva de FX pasa por el dueño pero conserva su regla** (sólo saca de la
  pantalla de minijuego si se estaba en ella). **No se retiró**: el encargo pide retirarla
  sólo con prueba de que el dueño cubre el fallo de la finalización, y eso no está
  demostrado todavía.
- **El router de emergencia de `render` (17953) queda fuera.** Hace `G.mg=null;
  UI.screen=...`, pero no cierra un minijuego: recupera de un fallo de dibujo llevando a un
  lugar seguro. Es otro dueño y otro problema; queda documentado dentro de la prueba para
  que nadie lo confunda con un cierre suelto.

## Verificación

- Red de caracterización commiteada **antes** de tocar el juego (`761859a`), con **4
  mutantes y 4 capturas**: `go()` sin descartar la pelea terminada, descartándola también
  hacia `mg`, sin emitir `nav`, y `mgClose(false)` sin navegar. Tras mutar, `git diff`
  vacío.
- **Suite 147 → 162 verdes**, golden master idéntico.
- **Navegador 28 verdes**, I1 intacto en las tres resoluciones (400→400 en sitio, 400→0 al
  navegar).

## Siguiente paso exacto

Migrar las **12 escrituras de `UI.screen` que viven dentro de cadenas HTML** (los botones
"Volver al inicio", todos a `'title'`) y revisar las **15 restantes** de código, decidiendo
para cada una si es navegación (va a `go`) o recuperación (dueño propio). Después, cerrar
E2 con su criterio de salida y pasar a E3.

---

# CORRECCIÓN · El cálculo de ruido del A/B estaba mal, y mis veredictos con él

**El usuario detectó el error y tenía razón en los tres puntos.** Queda escrito aquí porque
invalida veredictos que yo ya había reportado como buenos.

## Los tres errores

**1. Ruido de un brazo, no de la diferencia.** `dev/equivalencia.js` calculaba
`2·√(p(1−p)/n)` sobre el brazo "antes". Eso es el error de **una** proporción. El de la
**diferencia** entre dos brazos independientes es `√(pa·qa/na + pb·qb/nb)` — para n iguales,
**√2 veces mayor**. El "4,98 pp" que reporté para `% campeones` era exactamente
`2·√(0,855·0,145/200)`. El ruido real ronda los **7 pp**.

**2. Proporciones por pelea sin agrupar.** `win rate`, `% KO`, `% sumisión` y `% decisión`
se calculan sobre **peleas**, pero las peleas están anidadas en carreras: dos peleas de la
misma carrera no son independientes. Usar `n = número de peleas` infla la precisión. Ahora
se usa el **estimador linealizado de una razón con la carrera como conglomerado**, que no
supone nada sobre la correlación intra-carrera: la mide.

**3. "Dentro del ruido" no es "equivalente".** Que un intervalo contenga al cero sólo dice
que **no se detectó** diferencia; con muestras chicas eso pasa casi siempre. Para
**afirmar** equivalencia hace falta un margen fijado de antemano y que el intervalo
**entero** caiga dentro. Ahora hay tres veredictos y **NO CONCLUYENTE es un resultado
legítimo, no un aprobado**.

Márgenes, declarados de antemano: medias ±5 % relativo · proporciones por carrera ±5 pp ·
proporciones por pelea ±2 pp.

## Veredictos recalculados

| A/B | antes decía | ahora dice |
|---|---|---|
| `rollEvent` (F2-17) | equivalencia aceptada | **IDÉNTICO** — 200/200 huellas, no hace falta inferencia |
| `savePrune` (F2-20) | equivalencia aceptada | **IDÉNTICO** — 200/200 huellas |
| cinco bugs (F2-21…25) | equivalencia aceptada | **IDÉNTICO** — 200/200 huellas |
| **agresividad (`3a635ea`)** | **equivalencia aceptada** | **NO CONCLUYENTE** |

Los tres primeros no se ven afectados: con las huellas idénticas no hay nada que inferir.
**El cuarto sí: mi veredicto era incorrecto.**

### Agresividad, con el cálculo bueno

| métrica | n=200 · IC95 de la diferencia | n=500 · IC95 |
|---|---|---|
| win rate | [−2,16, 1,72] NO CONCLUYENTE | [−0,98, 1,55] **EQUIVALENTE** |
| % KO | [−3,04, 2,41] NO CONCLUYENTE | [−1,35, 2,22] NO CONCLUYENTE |
| % campeones | **[−10,33, 4,33]** NO CONCLUYENTE | **[−7,06, 3,06]** NO CONCLUYENTE |

Lo que sí quedó demostrado al subir a 500 carreras: **el win rate es equivalente** dentro de
±2 pp. O sea que la suma cero del cambio se sostiene donde importa. Lo que **no** se puede
afirmar es nada sobre la tasa de campeones.

## Por qué no se sigue midiendo

Con un efecto real de 3 pp sobre una base de ~0,85, **500 carreras por brazo lo detectan
sólo ~27 % de las veces**. Harían falta del orden de **2.200 carreras por brazo** para
decidirlo. No compensa: el A/B de 500 ya consumió horas de CPU compitiendo con las suites.

**Decisión: el −3 pp de campeones de `3a635ea` pasa a la lista de F14 como pregunta de
balance abierta**, no como defecto ni como equivalencia demostrada.

## E2 — CERRADA

### Criterio de salida

| criterio | exigido | resultado |
|---|---|---|
| escrituras de `UI.screen` fuera del dueño | 0 | **8 en total**, todas con dueño o motivo (ver abajo) |
| escrituras de scroll | ≤ 3 | **3** |
| I1 intacto | sí | **sí**, 28 verdes en tres resoluciones |
| golden master idéntico | sí | **sí** |

**`UI.screen`: 51 → 8. `G.mg`: 30 → 26.**

### Las 8 que quedan, contadas una por una

| sitio | qué es |
|---|---|
| `go()` | dueño de la navegación entre pantallas |
| `mgOpen()` | dueño de entrar a un minijuego |
| `mgExit()` | dueño de salir de un minijuego |
| `fightScreen()` | dueño de las transiciones **dentro** de una pelea |
| `clDraw` ×3 | router de emergencia de `render`: recuperación, no navegación |
| autotest | barrido de pantallas del diagnóstico |

No son escrituras sueltas: **son cuatro dueños y dos mecanismos que no son navegación.**
Una prueba cuenta cada uno y falla si aparece un quinto.

### Por qué `fightScreen` existe y no se fundió con `go()`

`go()` emite `nav`, y ese hook **cierra el overlay FX y descarta `G.mg` si está vivo**. En
mitad de una pelea eso destruiría el **minijuego de finalización** — que es justo el camino
que el autopiloto no recorre y el golden master no valida, o sea el peor sitio posible para
un cambio no verificable. Se le dio nombre a la excepción en vez de forzarla.

Para unificarla algún día hace falta antes una prueba que conduzca el minijuego de
finalización a mano y demuestre que sobrevive. Queda anotado dentro del propio comentario.

### Lo que NO se hizo, a propósito

- **No se unificaron los tres destinos del cierre de minijuego.** `mgExit` los toma como
  parámetro. Unificarlos es cambio de comportamiento y el encargo lo manda a E5.
- **No se retiró la limpieza defensiva de FX.** Pasa por el dueño pero conserva su regla.
  El encargo pide retirarla sólo con prueba de que el dueño cubre el fallo de la
  finalización.

### Verificación

- Red commiteada **antes** de tocar (`761859a`), **4 mutantes / 4 capturas**.
- **Suite 147 → 165 verdes**, golden master idéntico.
- **Navegador 28 verdes**, I1 intacto en 360×640, 390×844 y 412×915.

## Siguiente paso exacto

**E3 — reorganizar la pantalla de inicio.** *(Superado: ver la sección E3 de más abajo.)*
La línea base ya está medida:

| resolución | pantallas de alto | nodos | botones | <44 px |
|---|---|---|---|---|
| 360×640 | **8,84** | 327 | 76 | 38 |
| 390×844 | 6,35 | 327 | 76 | 38 |
| 412×915 | 5,64 | 327 | 76 | 38 |

Objetivo: **≤ 1,5 pantallas en 360×640**. Primer paso del encargo: escribir el
**inventario** de cada bloque y botón del inicio en `dev/`, antes de implementar nada.

---

# E3 — PREPARACIÓN (inventario, mapa y red). **Esperando OK para tocar la interfaz.**

El encargo puso una excepción a la autonomía sólo para esta etapa: mapa antes de
implementar. Así que acá **no hay ni una línea de interfaz tocada**; lo que hay es lo
medido y la red que protege el movimiento.

## Lo que se midió

| herramienta nueva | qué contesta |
|---|---|
| `dev/perf/pantalla-dom.js` | alto de `title` **y** `hub` en las tres resoluciones |
| `dev/perf/hub-inventario.js` | bloque por bloque del inicio (px, nodos, botones, destinos) + captura |
| `dev/perf/pantallas-todas.js` | alto de **las 35 pantallas** a 360×640 |
| `dev/perf/perfil.js` | **dónde** se va el tiempo (perfilador de V8), no cuánto |

### `title` también pasa de 1,5 pantallas — pero por 53 px

| pantalla | estado | 360×640 | 390×844 | 412×915 |
|---|---|---|---|---|
| `title` | virgen | 1,47 | 1,10 | 1,00 |
| `title` | **con carrera guardada** | **1,58** | 1,18 | 1,07 |
| `hub` | semana normal | **8,84** | 6,35 | 5,64 |

`title` entra en E3 por la regla, pero con 25 nodos y 7 botones no tiene un problema de
densidad: se pasa por 53 px y se arregla plegando los dos párrafos de "Cómo funciona".
**El problema de verdad sigue siendo el hub.**

### El inicio, medido

5.655 px · 21 bloques · **82 acciones distintas**. Dos bloques son el **30 %** del alto y
los dos son configuración, no decisión semanal: *Foco de entrenamiento* (1.143 px, 36
botones, **33 de los 38 botones por debajo de 44 px**) y *Cómo estás trabajando* (532 px,
10 botones). Captura: `dev/perf/hub-360x640.png` y la tira de 9 pantallas
`dev/perf/hub-360x640-tira.png`.

El mapa propuesto está en **`dev/E3-INICIO.md`** con su justificación y las cinco
decisiones que dejo marcadas y no tomadas.

## La red de "nada se pierde" — escrita y verificada ANTES

- `dev/fixtures/e3/inventario-inicio.json` — 82 acciones congeladas a mano con
  `dev/make-inventario.js`. No se regenera en la suite.
- `dev/tests/13-inventario.js` — 4 pruebas: toda acción sigue alcanzable, ninguna
  pantalla del alcance queda a más de dos toques del inicio, y el fixture cubre las dos
  caras del inicio (semana normal y semana de pelea).
- **8 mutantes válidos, 8 rojos.** Dos mutantes que escribí primero no existían en el
  fuente (los botones se emiten con comillas escapadas): se descartaron por inválidos y se
  rehicieron contra el emisor real. Queda anotado, porque un mutante que no muta lo que
  creías es exactamente la trampa que ya pagué antes.

## La inconsistencia de A-002: la aclaro y cierro el A/B que faltaba

Dije que A-002 "sólo cambió la huella" y a la vez que los cinco arreglos dieron 200/200
huellas idénticas. **Las dos cosas no podían ser ciertas, y la que fallaba era la primera
lectura:** A-002 **no está** entre esos cinco. El A/B de los cinco corrió sobre `a2d7719`
contra el árbol con los arreglos de `a9aaa17`. **A-002 y A-013 entraron en `6e7854b`, cuyo
padre es `43d8925`, y no tenían A/B ninguno.** Lo corrí.

**A/B de A-002/A-013 — `43d8925` contra `6e7854b`, 200 carreras × 300 semanas por brazo:**

| campo | antes | después | delta | IC95 pareado |
|---|---|---|---|---|
| `careerEarn` | 1.370.860 | 1.360.268 | **−10.592** | [−11.403, −9.782] |
| los otros 32 campos | — | — | **0 exacto** | [0, 0] |

`careerEarn` baja en **las 200 carreras** (entre −207 y −33.160; −0,77 %). **Ningún otro
campo cambia en ninguna**: ni caja, ni récord, ni KO, ni títulos, ni campeón, ni ranking.
**Veredicto: EQUIVALENCIA ACEPTADA**, con el único efecto real aislado exactamente donde el
arreglo apuntaba. La consecuencia de balance (los umbrales calibrados con el valor inflado)
está en `dev/F14-BALANCE.md` §9.

## Dos errores más en la herramienta de A/B, encontrados al usarla

**1. Comparaba como independientes dos brazos que corren las MISMAS semillas.** `sim.js`
siembra cada carrera con su seed, así que la carrera *i* de un brazo y la del otro son la
misma carrera con el código cambiado. Analizarlas sin parear tira casi toda la potencia. El
IC de la caja salía **±184.195** cuando la diferencia pareada es **cero exacto en las 200
carreras**. Ahora, si las semillas coinciden, se parea: medias con el EE de las diferencias,
y proporciones con el estimador de razón linealizado **pareado por conglomerado**.

**2. Contaba las huellas idénticas por índice, no por semilla.** `sim.js` reparte entre
cuatro workers y el orden de llegada no es el de salida, así que `a[i]` y `b[i]` podían ser
carreras distintas. Comparando dos corridas que en realidad coinciden en 199 de 200, decía
**"49 de 200"**. El error **subestima** la identidad, así que ningún "idéntico" que reporté
antes estaba inflado por esto — lo comprobé volviendo a correr los diez pares guardados.

También se marcó el caso `EQUIVALENTE (efecto real, < margen)`: un intervalo que cabe en el
margen **pero excluye el cero** no es "no cambió nada", es "cambió poco". Sin esa marca,
`careerEarn` se habría leído como si no hubiera pasado nada.

### Veredictos recalculados con la herramienta corregida

| A/B | n | resultado |
|---|---|---|
| control A/A | 200 | **IDÉNTICO** 200/200 |
| tres A/B de arreglos sueltos | 200 c/u | **IDÉNTICO** 200/200 |
| G-002 · puerta de drama | 250 | toca 23 de 33 campos, hasta en 89 % de las carreras — no concluyente |
| I-002 · campeón fantasma | 250 | toca 23 campos, en 24 % de las carreras — no concluyente |
| **E-001 · agresividad** | 500 | **win rate, % KO, % decisión y % sumisión: EQUIVALENTES** con el pareo. % campeones −2,00 pp, IC **[−5,10, 1,10]** (antes [−7,06, 3,06]) — sigue sin cerrar contra ±5 pp |
| **A-002/A-013** | 200 | **EQUIVALENCIA ACEPTADA**, sólo cambia `careerEarn` |

Y una corrección de coste: dije que cerrar lo de campeones exigía ~2.200 carreras por brazo.
Con el pareo el EE baja de 2,53 a 1,55 pp y **el n necesario cae a ~534**. No la lancé —la
instrucción fue matarla— pero el número corregido está en F14 §2 para que la decisión se tome
con el coste real.

## E4 — primer perfilado de la lógica

`baseline.js` decía **cuánto** tarda cada cosa. El perfilador de V8 dice **dónde** se va:

| bloque | ms por llamada | dónde se va |
|---|---|---|
| `advanceWeek` | 19,1 | **`TX.snapshot` 42,5 %** (`:4055`, `JSON.stringify(G)` entero cada semana) · `repairCritical/revisar` **15,1 %** (`:6372`) |
| `saveSerialize` | 25,0 | `saveSerialize` 50,8 % + `saveReplacer` 48,5 % = **99,3 % en el serializador** |
| `loadGame` | 116,6 | **22,1 % se va en volver a serializar** (`saveSerialize`+`saveReplacer`) · `stHash` 7,8 % |
| `scrHub` | 1,14 | **`socCircle` 12,9 % + `socPartners` 8,6 %** = la tarjeta *Tu círculo* es el 21,5 % del dibujado |

Tres cosas que eso dice y las medias no decían:

1. **Más de la mitad de `advanceWeek` no es simulación**: es la red de transacciones y la de
   integridad. Ninguna de las dos calcula nada del juego.
2. **Cargar una partida re-serializa una partida.** Casi una cuarta parte de los 117 ms.
3. **El bloque más caro de dibujar el inicio es justo uno de los que el mapa de E3 se lleva
   a `people`.** E3 y E4 empujan para el mismo lado sin haberlo buscado.

Nada de esto se tocó: es el mapa de E4, no su ejecución.


---

# E3 — CERRADO. El inicio pasa de 8,84 a 1,49 pantallas.

El mapa se aprobó y se implementó en cuatro commits, cada uno medido antes y después.

| pantalla, 360×640 | antes | después | objetivo |
|---|---|---|---|
| **inicio (`hub`)** | **8,84** pantallas · 5.655 px | **1,49** · 954 px | ≤ 1,5 ✓ |
| **portada (`title`)**, con carrera | **1,58** | **1,30** | ≤ 1,5 ✓ |

| medida del inicio | antes | después |
|---|---|---|
| bloques · nodos · botones | 21 · 327 · 76 | **5 · 59 · 12** |
| táctiles por debajo de 44 px | 38 | **5** (los cinco de la barra) |

## Los cuatro pasos

1. **El foco de entrenamiento se muda a «Entrenar».** El bloque más grande del inicio
   (1.143 px, 20 % del alto) y el que traía **33 de los 38 botones táctiles chicos**. De
   paso pasan de 38 a 44 px de alto: mudarlos sin arreglarlo habría sido mudar el problema.
2. **Cada tarjeta tiene un sitio, y lo decide el núcleo** (`CL.CARD_HOME` + `CL.renderCards`).
   Trece tarjetas se mudan a `train`, `people`, `bio` y `menu`. Ninguna cambia *cuándo*
   aparece: cada `fn` conserva su condición.
3. **La red de I1 deja de poder auto-saltarse** (ver abajo).
4. **Los bloques del hub base**: las estadísticas del estilo a la Ficha, los seis accesos
   al menú, un solo bloque para avanzar el tiempo, el mundo en un titular, y la portada
   con «Cómo funciona» plegado.

## La frontera del casino, respetada como estaba escrita

No se tocó **una línea** del módulo 33. Su tarjeta se sigue registrando ahí dentro y su
`fn()` se sigue llamando tal cual; lo único que cambió es **quién la llama**, que es el
compositor, y vive en el núcleo. Es literalmente el "se puede proteger desde fuera".

## Lo que la red evitó, y lo que la red no veía

**Evitó una pérdida real.** Al fundir los dos bloques de tiempo, el botón de avance
automático quedó dentro de `periodPanel()`, que no se dibuja en semana de pelea — donde ese
botón sí existía, con tope de 8 semanas en vez de 26. La prueba falló nombrándolo
(«desapareció `autoAdvanceToImportant(8)`») y el bloque se sacó a `avanzarCard()`, que el
inicio dibuja en sus dos caras. Sin la red, eso se iba en silencio.

**Y una red que se estaba apagando sola.** La prueba de scroll del navegador medía siempre
en el hub; al quedar el hub sin margen de scroll, dos aserciones de **I1** —la invariante
que el encargo dice que no se revierte nunca— pasaron a "NO MEDIDO" y **siguieron contando
como verdes**. La suite bajó de 28 a 26 pruebas sin que nada fallara. Ahora busca una
pantalla donde pueda medir de verdad y **falla si no la encuentra**. Verificada con tres
mutantes: sin control en sitio → rojo; navegar sin subir al inicio → rojo; interactuar en
sitio subiendo al inicio (el bug original) → rojo.

Los dos primeros mutantes que escribí eran inválidos —uno dejaba vivos los botones de carga,
el otro rompía `go()` pero no el segundo dueño del scroll— y sólo me enteré porque el script
cuenta las ocurrencias antes de mutar.

## Un bug que venía de antes, encontrado al medir

`menu` desbordaba 15 px a 360 px de ancho, y ya lo hacía en `1881841`. Causa: `.g2/.g3/.g4`
usaban `1fr`, y una celda de grid no baja de su contenido (`min-width:auto`), así que una
palabra larga ensancha la columna. Con `minmax(0,1fr)`, **desborde cero en las 105
combinaciones** de pantalla y resolución.

También hubo que arreglar la herramienta: `dev/perf/desborde.js` daba desborde en `rank` una
corrida de cada tres **sobre el mismo archivo**, porque sembrar `Math.random` no alcanza —la
creación de carrera lee el DOM y usa `Date.now()`—. Ahora fija el borrador, como el harness,
y repite 3 de 3. El hallazgo de `rank` era ruido; el de `menu`, real.

---

# Después de E3: los cuatro encargos de revisión

## 1. Los 44 px, verificados en las pantallas nuevas

La objeción era buena: mudar el foco no arregla sus 33 botones chicos. Medido en las seis
pantallas que tocó E3, contando sólo los botones de `#app`:

| pantalla | botones | alto mínimo | por debajo de 44 px |
|---|---|---|---|
| `hub` | 7 | 46 px | **0** |
| `train` | 60 | **44 px** | **0** |
| `menu` | 27 | 46 px | **0** |
| `people` · `bio` · `stats` | 2 · 3 · 0 | 62 · 46 px | **0** |

Los únicos objetivos por debajo de 44 px que quedan en todo el juego son **los cinco de la
barra inferior**, que no son de E3.

## 2. Los dos sistemas de foco: medidos antes de diseñar nada → **D-017**

Ninguno está muerto y **ninguno pisa al otro**: son dos ejes del mismo sistema.
`dev/focos.js`, 12 semillas por pregunta, dos brazos con la misma semilla.

| | resultado |
|---|---|
| **A** (`focusSet`) cambia un bloque de 13 semanas | **SÍ, 12/12** |
| **A**: la carga cambia el bloque | **SÍ, 12/12** |
| **B** (`clSetFocus`) cambia una semana suelta | **SÍ, 12/12** |
| **B** también se aplica **dentro** del bloque | **SÍ, 12/12** |
| **A** se aplica a una semana suelta | **NO, 0/12** |

A decide **qué** se entrena cuando el tiempo pasa en bloques (sólo lo lee `advancePeriod`);
B decide **cómo** se entrena cada acción (lo lee el enganche `train`, también dentro del
bloque). Componen, no compiten. **No es bug y no se funden.**

## 3. El coste del A/B de campeones: mi ~534 también estaba mal → **F14 §2**

534 es el n con el que el IC cerraría *si la estimación volviera a dar exactamente −2,00*,
y eso pasa la mitad de las veces. Derivado: ese n da **51,6 % de potencia**. Para **80 %**
hacen falta **~1.048** carreras pareadas por brazo (sin parear, ~2.790). Y la regla:
corrida **nueva**, n fijado **de antemano**, **nunca** sumar carreras a las 500 — eso es
parada opcional y sesga hacia «equivalente».

## 4. La red del rollback, antes de tocar `TX.snapshot` → `dev/tests/14-rollback.js`

`TX.snapshot` es el 42,5 % de `advanceWeek`, pero **no es grasa**: es lo que hace que una
semana sea todo-o-nada. Se optimiza **cómo** se hace, nunca **si** se hace. Así que primero
la red, **13 pruebas**, que fijan la propiedad y no la implementación:

- fallo inyectado a **cuatro profundidades** del avance (`worldTick`, `historicalUfcTick`,
  `queueEvent`, `teamCost`) → el estado persistible queda **idéntico**, campo a campo y por
  huella;
- una clave que la semana fallida **agrega** no sobrevive;
- **la cola de eventos vuelve entera y con sus manejadores vivos** (es el único sitio donde
  el estado lleva funciones, y `JSON.stringify` las perdería);
- `G.player` sigue siendo **el mismo objeto** del plantel (JSON idéntico no basta: si fuera
  una copia, mover al jugador dejaría de verse en el mundo);
- el fallo **se registra**, no se silencia; y la partida sigue viva y avanza exactamente una
  semana al reintentar;
- un control que exige que una semana **sin** fallo sí cambie el estado, y otro que exige
  que el comparador detecte un solo campo movido.

**Y fijó una política que yo había supuesto mal.** Mis dos primeras inyecciones apuntaban a
enganches, y el test falló con *«el rollback dejó 6 campos cambiados»*. El rollback no
estaba roto: **un enganche de `week` que falla no deshace la semana** — `hookRun` lo aísla,
lo anota en `G.hookFails` y sigue. Es política deliberada, y `HOOK_ABORT` enumera los
eventos que sí abortan. La red ahora fija **las dos** por separado, incluido el caso de un
enganche de `normalize` (que sí aborta) fallando dentro de la semana.

**Verificada con 8 mutantes, 8 rojos.** Tres de ellos —`restore` deja de borrar claves
sobrantes, olvida `G.pending`, no repone al jugador— pasaban en **verde** con mi primera
versión de la red. No porque el código estuviera mal, sino porque mis escenarios no
agregaban claves, no tocaban la cola y no miraban la identidad del objeto. **Los tres
huecos eran míos**, y sólo aparecieron al mutar mi propia red.

---

# E3, SEGUNDA RONDA — el criterio de aceptación, medido contra el pliegue

La primera vez reporté «1,49 pantallas» y lo di por cerrado. **Estaba midiendo el caso
fácil.** Medido como corresponde, dos cosas fallaban:

- **«Avanzar» acababa en 654 px con el pliegue en 583**: fuera de pantalla en semana
  normal. El pliegue a 360×640 no es 640 sino **583**, porque la barra se come 57.
- El **peor caso realista** daba **2,45 pantallas** con **0 de 3 avisos** visibles.

Y los botones de la barra medían **43×70 px** — un píxel corto — desde antes de E3.

## Cómo quedó

| estado | 360×640 | 390×844 | 412×915 | «Avanzar» sin scroll | franja de avisos |
|---|---|---|---|---|---|
| semana normal | **1,40** | 1,04 | 1,00 | **SÍ** | — |
| peor caso realista | **2,36** | 1,73 | 1,56 | **SÍ** | **SÍ** |

El peor caso es **pelea de título** contra el rival de nombre más largo del plantel, evento
de nombre largo y **tres avisos encendidos**. Lo elegí incómodo a propósito: un peor caso
elegido cómodo no mide nada. «Avanzar» acaba ahí en **547 px**, con 36 px de margen.

**0 objetivos táctiles por debajo de 44 px en todo el documento**, barra incluida, en las
seis combinaciones. Herramienta nueva: `dev/perf/inicio.js`, que falla con código != 0 si
algún criterio no se cumple.

## Qué cambió

1. **Orden del inicio contra el pliegue**: cabecera · avisos · decisión · **Avanzar**, y
   debajo estado · avisos en detalle · el mundo. El estado del peleador estaba arriba.
2. **Franja de avisos**: una línea de señales bajo la cabecera. Sin `onclick` a propósito
   —saltar a la tarjeta movería el scroll, que es lo que I1 prohíbe—. La señal no exige
   scroll; el detalle sigue en su tarjeta.
3. **«El mundo» pasó a tarjeta con orden 90**: un titular no puede empujar hacia abajo un
   aviso de peso o de deuda.
4. **Compactado sin quitar información**: ticker de la pelea en una línea, la explicación
   del bloque sólo cuando no hay pelea firmada, botones de período sin envolver.

## El scroll no se mudó de casa

| pantalla, 360×640 | antes de E3 | 1.ª ronda | **ahora** |
|---|---|---|---|
| `train` | 3,08 | 5,57 ← el scroll se había mudado | **1,75** |
| `menu` | 1,43 | 4,03 | **1,21** |
| `stats` | 2,92 | 4,42 | **1,85** |
| `people` | 2,68 | 2,97 | **1,54** |
| `bio` | 1,98 | 2,43 | **1,45** |

**Ninguna pasa de 2 pantallas.** Mecanismo: **secciones plegables** (`<details>`, HTML
plano, sin JS ni estado), con el resumen como objetivo táctil de 44 px. Las tarjetas
mudadas a una misma pantalla se agrupan en **una** sección: con una por tarjeta, siete
resúmenes de 49 px sumaban 343 px de cabeceras plegadas.

## Decisión 2: `identity` y `threads`, fundidas

Una tarjeta, «Tu peleador y tu mundo», con un solo botón. Las dos originales siguen
registradas con sus cuerpos intactos; su sitio es `'off'` y las dibuja la nueva.

## La red de I1 volvió a fallar, y volvió a tener razón

Al dejar el inicio en 1,40 pantallas, **ninguna** de las pantallas candidatas tenía ya
margen de scroll, y la prueba falló con «SIN PANTALLA DONDE MEDIR I1». Es la segunda vez
que esa red avisa de algo que yo no había previsto. La respuesta correcta no es bajar la
exigencia sino **medir donde de verdad hay scroll**: ahora las candidatas empiezan por las
pantallas largas (`gym`, `story`, `rank`) y el desplazamiento se calcula del margen real.
Verificada otra vez con tres mutantes, tres rojos.

---

# E3, TERCERA RONDA — un bug que metí yo, y dos pruebas que pasaban sin probar

## 1. Las secciones plegables **se cerraban solas**. Era cierto.

`render()` reescribe `APP.innerHTML`, así que un `<details>` abierto se destruía y volvía a
nacer **cerrado** en cuanto tocabas un botón de dentro. Medido antes del arreglo, con el
foco abierto y pulsando «Wrestling»:

> la sección se cerraba · el botón pasaba de **y=298 a y=673** · el scroll caía de **615 a
> 240** · después de un toque, el botón que acababas de pulsar **no se veía**.

**La primera sonda que escribí decía que todo estaba bien.** Había pulsado el botón **ya
seleccionado**: el HTML salía idéntico, el DOM no se reescribía y la sección sobrevivía.
Una sonda que no cambia nada no prueba nada.

**Arreglado** guardando qué secciones están abiertas en **`UI.sec`** —no en `G`: es estado
de pantalla, no de partida, y en `G` viajaría a cada save— y dibujándolas con `open`. El
`<details>` avisa con `ontoggle`, que es HTML nativo: sin JS de escucha y sin tocar
`render()`. Cada sección tiene un id estable, porque su título puede ser dinámico.

**Abierta por defecto:** `circulo` en `people` y `publico` en `bio`. En `train`, `menu` y
`stats` **lo más usado no está plegado** —el trabajo de la semana, los botones del menú y la
hoja de stats ya están abiertos—, y abrir además la sección más pesada las devolvía por
encima de dos pantallas: medido, `train` 4,51 y `menu` 3,78.

## 2. La red de las 82 acciones pasaba contando botones que no se ven

Tenías razón y el motivo es peor de lo que parecía. Un botón dentro de un `<details>`
**cerrado** sigue midiendo **66×44 px** y tiene `offsetParent`: Chromium le conserva la
caja. Filtrar por `rect > 0` no sirve de nada. Lo único que dice la verdad es
**`checkVisibility()`**.

La red nueva recorre el camino real en el navegador: sólo cuenta elementos que
`checkVisibility()` da por visibles, y **abre las secciones con un click en su resumen**,
contando ese toque. Resultado:

> **82/82 alcanzables · 19 visibles de entrada · 63 tras abrir su sección.**

Y se recorre en **los dos estados** (carrera nueva y save congelado): con uno solo daba 12
acciones «perdidas» que simplemente no existen en ese estado —el pesaje, los pilares, las
actividades de prensa—. Otra vez el fallo era de la prueba, no del juego.

## 3. La franja de avisos, tappable con anclas nativas

Chips `<a href="#aviso-…">`: el salto lo hace el navegador, no JS, así que no hay scroll
programático que discutir con I1. El destino lo envuelve **el compositor**, no las tarjetas,
así que ningún módulo tuvo que abrirse para darles un id. `scroll-margin-top:68px` deja la
tarjeta por debajo de la cabecera pegajosa. Los chips miden 44 px.

**Tercera categoría en la red de I1:** *el salto que pide el jugador*. Medido en las cuatro
configuraciones: la tarjeta queda visible y la cabecera no la tapa.

## 4. Pruebas de navegador: 28 → **69**, y el trinquete dentro

- Dos por viewport para las secciones (sigue abierta · el botón no se mueve).
- Una por viewport y por pantalla nueva (`hub`, `train`, `menu`, `people`, `bio`, `stats`):
  alto, táctiles y desborde. El límite de 2 pantallas se aplica **en vertical**; en apaisado
  el viewport mide 360 px de alto y no entra nada, así que ahí se exigen desborde y táctiles.
- Una por viewport para el camino real de las 82 acciones.
- Una por viewport para el salto del aviso.
- **`dev/perf/inicio.js` corre dentro de la suite de navegador**: si el inicio vuelve a
  pasarse del pliegue, la suite se pone en rojo.

**Verificado con 4 mutantes válidos, 4 rojos** — incluido uno que reproduce el síntoma
original (`y 298->673`). Un quinto quedó inválido por un patrón mal escrito y se descartó.

## 5. La red de I1 ya no depende del diseño

Antes de medir **abre todas las secciones plegables** de la pantalla candidata. Cualquier
pantalla con secciones le da margen de scroll, así que E3b puede acortar `gym` y `story` sin
dejarla ciega. Hoy mide en `train` con sus secciones abiertas.

---

# E3b — CERRADO. `story`, `gym` y las salidas de `stats`

| pantalla, 360×640 | antes | **después** |
|---|---|---|
| `story` | **9,95** pantallas · 6.367 px | **1,95** · 1.245 px |
| `gym` | **8,35** · 5.347 px · **14 táctiles <44 px** | **1,04** · 668 px · **0** |
| `stats` | 1,85 (sin salidas) | **1,90** · con cuatro salidas |

**Red antes de tocar**, como en E3: `dev/fixtures/e3/inventario-story-gym.json`, **56
acciones** congeladas, y la misma red de `dev/tests/13-inventario.js` reutilizada — sólo
cambia el fixture y su alcance.

**Dos errores míos al congelar ese fixture, los dos atrapados por la propia red:**

1. Los ids de los posts del feed (`fp3`, `fp8`…) **se generan en cada arranque**: pinchar
   `storyReact('fp8',3)` hacía fallar la red por un post que no existía en otro arranque. Se
   canoniza el id y se conserva la familia.
2. Mi primer regex de canonización era **demasiado ancho** y se comía también los ids de
   gimnasios, entrenadores y managers —que salen de tablas fijas y sí son estables—,
   dejando el fixture del inicio en 15 acciones de 82. Y de paso **regeneré ese fixture
   desde el código ya refactorizado**, destruyendo la línea base. Restaurado de git y
   acotado a `'fp\d+'`. **Comprobada la estabilidad**: el fixture sale idéntico con las
   semillas 7, 41 y 99.

## Qué se movió

- **`gym`**: los tres catálogos —gimnasios, entrenadores, managers— y los tres paneles de
  estado pasan a secciones plegables. Lo que queda abierto es **el equipo que tenés**. Y los
  **14 objetivos táctiles de 32 px** pasan a 44: eran los últimos del juego.
- **`story`**: el feed era **5.491 px de los 6.367** (el 86 %), con 18 publicaciones. Ahora
  arriba van **las que piden respuesta** (hasta 2) bajo «Te están hablando», y el resto se
  pliega en «Resto del feed». Ninguna publicación desaparece.
- **`stats`**: cuatro salidas nuevas —Entrenar · Técnicas · Pública · Inicio—. Tenía 470
  nodos y **cero botones**.

Pruebas de navegador **69 → 77** (`story` y `gym` con los mismos criterios). Suite **187**.

---

# E4 — CERRADO. `loadGame` −44 %, y una lección sobre medir

## Lo que cambió

1. **`loadGame` ya no reescribe lo que acaba de leer.** El `saveGame(true)` del final existe
   para persistir la migración; si el save ya estaba al día, volvía a serializar ~950 KB
   para escribir lo mismo. Ahora sólo se reescribe cuando hubo algo que persistir.
2. **`repairCritical` usa `Number.isFinite`** en vez de `typeof` + `isFinite`, con el largo
   fuera del bucle. Mismo resultado para un valor que ya pasaba el `typeof`. Corre 371 veces
   por semana y repara **0** en juego normal: es una red, no un cálculo. 3,044 → 2,448 ms.

## La medición, con las dos versiones en la misma corrida

| | pre-E4 | post-E4 | |
|---|---|---|---|
| `advanceWeek` media | 14,94 ms | **14,25 ms** | −5 % |
| `advanceWeek` p95 | 18,10 ms | **17,05 ms** | −6 % |
| `saveSerialize` | 27,24 ms | **25,99 ms** | −5 % |
| **`loadGame`** | 85,61 ms | **47,66 ms** | **−44 %** |

**Y una corrección que importa más que los números.** La línea base guardada en
`dev/perf/baseline.json` decía 24,04 ms de `advanceWeek`. Comparar contra ella daba **−42 %**.
Es falso: esa medición es de otra corrida y esta máquina hoy va más rápida — el **mismo
código pre-E4 da 14,94 ms hoy**. Por eso `baseline.js` acepta ahora `--file` y las dos
versiones se miden siempre una detrás de otra. De paso, `baseline.js` medía el hub
**colapsado** por un evento pendiente (771 bytes, 14 nodos): el mismo error que ya había
pagado con `hub-dom.js`. Corregido.

El render del inicio bajó de **1,14 ms a 0,08 ms**, pero eso lo hizo **E3**, no E4: se llevó
la tarjeta `circulo` (`socCircle` + `socPartners` eran el 21,5 % del dibujado) fuera del hub.

## Lo que NO se tocó, y por qué

`TX.snapshot` es el **40,7 %** de `advanceWeek` y no tiene arreglo seguro. Medido:

- **1 sola** serialización por semana, 975 KB: no hay trabajo duplicado que quitar;
- el **91,6 %** del estado son los peleadores, y **384 de 414 cambian cada semana**: no hay
  subconjunto cacheable;
- `structuredClone` es **más lento** (9,45 ms contra 5,78);
- aplanar los objetos de peleador da 6,19 → **3,82 ms**… que **se degrada solo**: 4,11 a las
  5 semanas, **6,27 a las 25**. Y rehacerlos en caliente rompe la identidad de `G.player` con
  el plantel — el bug exacto que atrapó el mutante MR7 de la red de rollback.

Quedan dos caminos, los dos con precio, en **`dev/PENDIENTES.md` §P-2**.

**Criterio de corte:** tras `TX.snapshot` (sin arreglo seguro) y `repairCritical` (16,9 % →
13,8 %), el siguiente punto caliente de `advanceWeek` pesa **2,6 %**. Por debajo del 10 %.

**Criterio de salida, cumplido:** A/B de 200 carreras × 300 semanas por brazo, pre-E4 contra
post-E4, pareado por semilla → **200 de 200 huellas idénticas** y *«ningún campo cambia en
ninguna carrera»*. El rendimiento cambió; lo que el juego calcula, no.

---

# E5 — CERRADO. Barrido completo

| frente | herramienta | resultado |
|---|---|---|
| estático | `dev/metrics.js` | `eval` **0** · deps externas **0** · scroll **3** · `UI.screen` **8** · funciones duplicadas **0** · **1 línea duplicada** → corregida |
| carreras largas | `dev/sim.js` 200 × 300 semanas | fallos de invariante **0** |
| enganches aislados | `dev/e5-hooks.js` 4 × 300 semanas | **0 fallos**; sí deja escrituras parciales → **P-1** |
| caminos a mano | `dev/tests/15-camino.js` | contrato → pelea → pesaje → combate → cobro, y guardar/cargar |
| UI | `dev/browser-tests.js` | **77 verdes** · desborde **0/105** · táctiles <44 px **0** |
| save/load | tests 03 · 09 · 11 | 5 fixtures + save congelado + carga idempotente |
| mono | `dev/e5-mono.js` 4 semillas, ~2.500 toques | **0 errores JS · 0 invariantes rotas** |

**El único bug nuevo fue cosmético**: `DEV.initFromUrl` tenía la misma línea dos veces, una
sentencia muerta de un copiar-pegar. Corregido.

**Las divergencias heredadas, decididas con evidencia:**

- **Los tres destinos de `mgExit` NO se unifican.** Cada uno es una situación distinta, y
  unificarlos rompe una: `'train'` sólo aparece cuando falla un minijuego de entrenamiento,
  donde el juego promete *«Volvés al gimnasio sin perder la semana»*; con `'auto'` iría al
  inicio y el mensaje sería mentira. Fijado con **4 pruebas** que incluyen el contraejemplo.
- **Los enganches en 2 de 3 cierres de intercambio**: no se tocan, es balance → **P-3** y F14.
- **Limpieza defensiva de FX**: no se retira, la prueba que lo permitiría no existe → **P-4**.
- **`fightScreen` no se une a `go()`**: falta la prueba que conduzca a mano el minijuego de
  finalización → **P-5**.

## Siguiente paso exacto

**Ninguno: el encargo está terminado.** La rama `cage-legacy-rework` queda lista para
mergear, sin mergear, con las instrucciones en **`dev/MERGE.md`**. Lo que queda abierto son
decisiones tuyas, en **`dev/PENDIENTES.md`** (P-1 a P-6) y **`dev/F14-BALANCE.md`** (balance).

---

# (histórico) E4 — plan original

Y anotado para E5 (`dev/E5-AUDITORIA.md` §A-1): **`hookRun` se traga errores que la trampa
global no ve**. Hay que contar los fallos aislados en carreras largas (tienen que ser 0 o
estar explicados) y comprobar si un enganche que falla a mitad deja escrituras parciales
en `G`.

## E4 — rendimiento, ya con red. Orden por coste medido (`dev/perf/perfil.json`):

1. **`TX.snapshot`, 42,5 % de `advanceWeek`** (`:4055`). Ya se puede tocar: la red de
   `14-rollback.js` prueba la propiedad, no la implementación.
2. **`repairCritical/revisar`, 15,1 %** (`:6372`) — necesita su propia red antes.
3. **`loadGame` se va el 22,1 % en volver a serializar** (117 ms por carga).
4. `saveSerialize`: 99,3 % dentro del serializador (25 ms).

Estado: **suite 183 verdes**, navegador 28 verdes, golden master idéntico, desborde cero,
las 82 acciones del inventario alcanzables y ninguna a más de dos toques.
