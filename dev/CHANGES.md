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
