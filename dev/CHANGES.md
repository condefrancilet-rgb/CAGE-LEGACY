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

## Siguiente paso exacto

**E3b — `story` (9,95 pantallas) y `gym` (8,35)**, con los mismos criterios que el inicio y
**antes de E4**. Plan y medidas en **`dev/E3b-STORY-GYM.md`**. `gym` tiene además los **14
objetivos táctiles por debajo de 44 px** que quedan en el juego.

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
