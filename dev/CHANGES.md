# CHANGES — cambios intencionales de comportamiento

Sólo entran aquí los cambios que el jugador puede observar. Cada uno con su
evidencia (sim antes/después o test que lo reproduce).

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
