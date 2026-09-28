# Auditoría de pagos fuera de la tienda — fase 12

Todo lo que mueve plata sin pasar por la tienda. Archivo de partida: `081560a` (sha256
`a854eeb1…cf00`). Cada fila que dice «verificado» tiene su medición en
`dev/tests/24-fase12-economia.js`, y su uso real en `dev/recorridos-economia.js` (una carrera
determinista que paga cada servicio por el camino del jugador).

Cómo se buscó: todas las líneas que restan de `G.cash` (25 lugares, más 21 escrituras que no
restan), todos los precios que se muestran en pantalla y un barrido automático de toda marca
`G.flags.X` que se escribe y nadie lee.

Estados: CONSUMIDOR VERIFICADO · EFECTO INMEDIATO · MARCA CONTABLE · PROMESA ROTA · CONTENIDO MUERTO ·
DUPLICADO · COBRO SIN EFECTO · EFECTO SIN COBRO · AMBIGUO. Si una fila cambió en esta fase, se
indica el estado de antes → el de ahora.

## 1. Gastos de cada semana

| gasto | precio | dónde se cobra | qué lee / qué produce | se ve | estado |
|---|---|---|---|---|---|
| Vida | $120/sem | `advanceWeekCore` | costo de vivir; no promete nada | desglose semanal | MARCA CONTABLE |
| Cuota del gimnasio | costo/4 por semana | `advanceWeekCore` | el gimnasio que pagás es el que entrena (`trainQuality`, especialidad) | «$X/mes» en Equipo y Gimnasios; desglose | CONSUMIDOR VERIFICADO |
| Ajuste por reputación en el gimnasio | −30 %, −15 %, 0 o +20 % de la cuota | hook `economia` | `CL.gymFeeMod`, la misma regla para cobrar y para decirlo | lista del gimnasio; desglose | AMBIGUO → VERIFICADO. Antes la lista mostraba 15 % y 30 % a la vez, y el recargo del 20 % no figuraba en ningún lado |
| Equipo técnico | $220 + 6×calidad por ayudante | `advanceWeekCore` (`teamCost`) | cada ayudante entrena su especialidad (`trainQuality` toma al mejor) y opina en el plan (`coachRecs`) | «Los ayudantes cobran aparte: $X/semana»; desglose | CONSUMIDOR VERIFICADO |
| Plan de gasto | $0 / 180 / 620 / 1.500 | `advanceWeekCore` | `rec` (recuperación semanal, hook `economia`) y `train` (filtro `train:mod`) | el botón de cada plan dice su efecto real (`CL.spendFx`) | ver §2 |
| Chef de campamento | $650/sem | hook `luxury` | fase 11 | desglose (antes no aparecía) | VERIFICADO |
| Deuda: interés | 0,4 %–3,5 % semanal con más de 10 semanas sin pelear | hook `deuda` | la deuda crece; techo de $90.000 → cobranzas | Contratos | VERIFICADO |
| Deuda: descuento de la bolsa | hasta el 55 % de cada bolsa | `CL.payout` | salda la deuda | línea «Descuento de deuda» | VERIFICADO (con un solo pago, ver §5) |
| Comisión del mánager | % de la bolsa | `fightPayout` | el servicio del mánager (negociación, ofertas, director) | línea de la liquidación; catálogo | VERIFICADO |
| **Lo que se ve** | — | — | — | Finanzas decía «gastos semanales» con sólo vida + cuota; el hub, «gimnasio + equipo» sin el chef, el ajuste ni los ingresos | PRECIO VISUAL DISTINTO → **un solo desglose** (`CL.weeklyLines`) con las mismas fuentes que cobran; una semana real mueve exactamente lo que dice |

## 2. Los dos campos del plan de gasto

| campo | dónde se escribía | quién lo leía | qué prometía el texto | qué era | decisión |
|---|---|---|---|---|---|
| `rep` (−0,02 / 0 / +0,04 / +0,08) | constante de `CL.SPEND` | nadie, ni en el archivo original subido | nada: ningún texto de los planes habla de reputación | configuración sin lector | CONTENIDO MUERTO → **eliminado** |
| `inj` (−0,35, sólo «todo adentro») | constante de `CL.SPEND` | nadie, ni en el original | nada: «Equipo completo alrededor tuyo. Rinde como nada y te funde la caja» no habla de lesiones | configuración sin lector | CONTENIDO MUERTO → **eliminado** |

No se conectaron a nada: conectarlos habría sido inventar un efecto (reputación semanal, menos
lesiones) que ningún texto promete, y mover el balance. Lo que el plan sí hace (recuperación y
entrenamiento) ahora se ve en cada botón con sus números: «recuperás 3 de fatiga y 1,5 de daño
más por semana · entrenamiento +7 %».

## 3. Servicios que el jugador elige

| servicio | precio | dónde | cobro | estado que deja | quién lo lee | efecto | se ve | persiste | estado |
|---|---|---|---|---|---|---|---|---|---|
| Visitar un gimnasio | cuota×1,8+600 | Gimnasios | `gymVisit` | `gymSeen`, `soc.intel`, `coachSeen` (a veces) | pantalla de Gimnasios («visitado ×n»), ficha social, catálogo | una semana de entrenamiento en su especialidad, gente nueva, +10 de fatiga (5 con jet) | el botón dice precio y fatiga; el resultado lo cuenta | sí | VERIFICADO |
| Mudarse de gimnasio | 2 cuotas | Gimnasios **y** Equipo | `gymJoin` | `p.gym`, techos, relaciones | todo el entrenamiento, reputación por gimnasio, perfil «errante» | casa nueva; +1 de techo en lo que la casa hace muy bien; compañeros y entrenador lo toman como corresponde | el precio en los dos catálogos; el resultado dice los techos | sí | DUPLICADO → **una sola mudanza** (ver §5) |
| Ir a ver una pelea | $400 | ficha social | `watchFight` | `soc.intel[id]` | ficha social («🔍 Le detectaste…») | una semana; +Fight IQ, +respeto, relaciones | el botón ahora dice precio y semana (antes sólo si no alcanzaba) | sí | VERIFICADO |
| Viajar con un compañero | $1.800 | ficha social | `travelWith` | vínculo | relaciones, alianzas | una semana; +8 de fatiga (4 con jet); amistad y confianza | ídem | sí | VERIFICADO |
| Producción de contenido | $2.000 | tarjeta de contenido | `contentBoost` | `content.hype` | producción semanal (con más de 65 rinde más popularidad; con más de 80, campañas pagas) | +9 de hype | el botón dice «+9 de hype» | sí | VERIFICADO (antes decía «acelera oportunidades» sin decir cómo) |
| Experiencia de carrera | $3.500 … $55.000 | Contratos | `requestGameplayUpgrade` | `G.gameplayLevel` | etiqueta y próximo precio | +1 adaptabilidad y +1 Fight IQ por nivel (el +1,2 lo redondea `cap`) | el botón y la noticia ahora dicen qué se compra | sí | PROMESA AMBIGUA → VERIFICADO |
| Fisio en la semana de recuperación | $1.200 ($600 con laboratorio) | tablero de recuperación | `recPick` | — | — | −30 daño, −22 fatiga; pasa la semana | el precio en el botón (fase 11) | — | EFECTO INMEDIATO |
| Pagar la deuda | lo que tengas, hasta el total | Contratos | `CL.debtPayNow` | deuda | ver §1 | baja la deuda; levanta cobranzas si se salda | el botón dice cuánto | sí | VERIFICADO |
| Contratar / despedir ayudante | sueldo semanal | Equipo | — | `G.team` | ver §1 | ver §1 | sí | sí | VERIFICADO |
| Invitar a entrenar, pedir consejo | presupuesto social (no plata) | ficha social | — | vínculo | — | — | — | — | fuera de alcance (no se paga) |
| Casino | — | — | — | — | — | — | — | — | intocable |

## 4. Eventos que cobran

| evento / opción | precio | antes | ahora |
|---|---|---|---|
| Susto de lesión: parar y hacer estudios | $600 | el precio no se veía | se ve en el texto del evento; EFECTO INMEDIATO |
| Campamento abierto en otro gimnasio: ir | media cuota | no se veía; se cobraban centavos (cuota/2 sin redondear) | se ve; se cobra redondeado. «Dos semanas» se condensan en una sesión: AMBIGUO (diseño de tiempo condensado, igual que la invitación a camp) |
| Fanáticos en tu puerta: mudarte de urgencia | $8.000 | prometía «dos semanas de concentración» y hacía −2 de temple permanente | el texto dice lo que hace (−2 de temple); el precio se ve |
| Peso a 24 horas: pelear en peso pactado | 25 % de la bolsa | **DOBLE COBRO**: se cobraba el 25 % en el momento y otro 20 % (10 % con nutricionista) en la liquidación | se paga una vez (`missFinePaid`); el hecho de no dar el peso queda registrado; el precio se ve |
| Emboscada en la conferencia: devolvérsela | $15.000 | prometía «la más vendida del año» | «el video da la vuelta al mundo» (+9 de popularidad, lo que pasa); la multa se ve |
| Emboscada: usarla para vender la pelea | — | prometía «la bolsa por PPV se dispara» | la previa queda caliente: al terminar la pelea, más popularidad (lo que hace `pressHeat`) |
| Conferencia caliente | — | prometía «la bolsa por PPV sube» | ídem. No existe ningún ingreso por PPV en el juego: no se inventó uno |
| Veterano: invertir en el gimnasio | $25.000 | con menos plata, cobraba lo que hubiera y daba el efecto entero (EFECTO SIN COBRO parcial) | cobra entero, como todos los eventos (el rojo va al descubierto) |
| Arreglo: devolverle la plata con intereses | 130 % | el monto no se veía | se ve en el texto |
| Sin plata: pedir un adelanto a la organización | — | **EFECTO SIN COBRO**: sumaba la plata y la anotaba en `G.flags.clAdvance`, que no leía nadie: gratis | es un adelanto como los otros dos del juego (`CL.debtAdd`): entra a la deuda y sale de la próxima bolsa; si las reglas de adelantos lo niegan, no hay plata ni costo |
| Deuda pesada: pedir más tiempo | — | cobranzas («ya no se negocia») renegociaba igual | cobranzas no negocia |

## 5. Arreglos de fondo

- **Una sola mudanza.** `changeGym` (Equipo) y `gymJoin` (Gimnasios) hacían el mismo acto con dos
  precios (1 o 2 cuotas) y efectos distintos (una subía techos y dejaba mudarse en campamento;
  la otra cuidaba compañeros y entrenador). Ahora las dos puertas son `gymJoin`, con la unión de
  los efectos, un solo precio que se ve en los dos catálogos, y la regla escrita «no te aceptan
  si querés mudarte acá» (reputación < 18) aplicada, sin cobrar.
- **Un solo pago de deuda** (`CL.debtApply`): la bolsa, el evento y el botón tenían tres copias
  del mismo recorrido y sólo una levantaba la marca de cobranzas al saldar.
- **Un solo desglose semanal** (`CL.weeklyLines`) para Finanzas, el hub y los días de aire.
- **Un solo registro de «te conoce»** (`coachSeen`): `p.coaches` era un registro paralelo sin
  lector. Los textos «te dejó su número» y «quedó disponible para tu esquina» prometían un acceso
  que ya tiene todo el mundo (cualquier entrenador se contrata); ahora dicen «te conoce», y el
  catálogo de entrenadores lo muestra.
- **Contenido**: `budget` (sumaba lo invertido y lo cobrado por campañas en un número que nadie
  leía) y `last` (nunca escrito) se dejaron de llevar.

## 6. Marcas que siguen escritas sin lector (ninguna es de un pago)

`brawler`, `late` (tipo de carrera al empezar), `lockDiv`, `lockGym` (los modificadores se leen
por `META.hasMod`), `needCheapGym` (reemplazada por `CL.cheapGym`), `eliteCampWeek` (reemplazada
por `eliteCampAt`), `scouted` (evento de visorias: «si seguís ganando, van a volver»),
`turnedDown`, `viral`, `mgrIgnored` (medios y mánager). Las cuatro últimas prometen o sugieren
algo y quedan para la fase de medios: no son dinero. También de medios, fuera de esta fase: el
«hype» de la conferencia (`p.hype`), el de preparar la entrada (`G.flags.hype`) y el de la próxima
pelea (`G.nextFight.hype`) se escriben y no los lee nadie.

## 7. Ambigüedades que se dejan como están

- **La válvula de «sin plata para las cuotas»** (`advanceWeekCore` y el aviso financiero): con la
  caja por debajo de −2.500 te manda al gimnasio gratuito y suma $1.500. Convive con la
  austeridad del banco (que hace lo mismo al llegar al techo del descubierto); el comentario de la
  austeridad dice que la válvula «dejó de dispararse» y no es del todo cierto. Medido: en las 5
  carreras del golden no se dispara nunca. No se tocó.
- **Tiempo condensado**: la invitación a campamento («tres semanas») y el campamento abierto
  («dos semanas») no hacen pasar semanas.
- **«Acceso a cualquier coach de la casa»** (reputación ≥ 80): cualquier entrenador ya se puede
  contratar; el beneficio no agrega nada. No es un pago.
