# Inventario del árbol de técnicas (TQ)

> Generado por `node dev/tq-inventario.js` a partir de `TQ.T` del juego cargado. No editar a mano:
> la prueba `dev/tests/21-fightiq-capa.js` exige que coincida con el juego.

## Resumen verificado

- Técnicas: **36** (28 activas, 8 pasivas). Por nivel: 1: 12 · 2: 12 · 3: 8 · 4: 4.
- Ramas: str = STRIKING (9) · wrs = WRESTLING (9) · grp = GRAPPLING (9) · iq = FIGHT IQ (9).
- Nivel 4 (legendarias): `s_perf`, `w_sup`, `g_def`, `i_last`.
- Ultimates (`CMB.ULT`): `s_perf` → TALÓN DEL VERDUGO, `w_sup` → SUPLEX DE LA TIERRA, `g_def` → LA ÚLTIMA PUERTA, `i_last` → ÚLTIMO ALIENTO.
- Resolución de una activa: `TQ.state` (condiciones) → `TQ.use` (gasta el uso, abre el minijuego del motor FX, filtro `tq:node`) → `TQ.resolve` (nota por `TQ.grade`: PERFECTA ≥ 0,86, BUENA ≥ 0,50, FALLA; `TQ.chance` con `TQ.resist` puede bajarla un escalón; evento `tq:resolved`) → `TQ.apply` (efecto). Funciones presentes: state ✓, use ✓, resolve ✓, chance ✓, resist ✓, apply ✓, hit ✓, divF ✓, markDodge ✓.
- Pasivas: `TQ.passives()` (caché `TQ.PAS`) ✓, consumidas por `gp:mod/tecnicas` ✓ (ataque), `combat:eff/TQ` ✓ (defensa, anti-derribo, suelo), la envoltura de `drain` ✓ (aire), `exchange:post/tqPasivas` ✓ (guardia, lectura, reja, esquiva, sangrado).
- ¿La IA del rival usa técnicas del árbol? **No.** `TQ.use` sólo se llama desde: botón del panel de técnicas (jugador); CMB.ultUse (botón de Ultimate del jugador).
- Puntos: `TQ.award` (+3 KO/sumisión, +2 unánime, +1 dividida/mayoritaria, +1 título, +1 si hubo una PERFECTA; techo 5 por pelea).

## Hallazgos del inventario

- `fx.flag:'back'` (toma de espalda) escribe `st.back=1` y **ninguna función lo lee** (0 lecturas): la «espalda tomada» de `g_back` y `g_rev` no tiene efecto propio más allá de su control y desgaste.
- `st.bleed` (cortes) tiene 8 lecturas: se consume en `exchange:post/tqPasivas` y se muestra en el panel. Correcto.
- `TQ.fightPanel` está definido 2 veces; la definición que rige es la última (paginada). Es una redefinición previa a esta etapa.

## Técnica por técnica

### STRIKING

#### `s_low` — LOW KICK QUIRÚRGICA

- Nivel 1 (ESPECIAL) · activa · costo 1 🔷 · requisitos: ninguno.
- Uso: desde stand · condiciones: te tiene que quedar aire · 2 uso(s) por pelea · aire 7.
- Ejecución: minijuego `zone`, dificultad 1; éxito según kicks, accuracy, timing, la nota, el aire y la resistencia del rival.
- Efecto (BUENA ×0,78 / PERFECTA ×1,22): daño 5–8, control +2, golpes significativos +1, le saca aire 9.
- Si FALLA: sólo pierde el intercambio y el aire (60 %).
- Distancia: no condiciona · Aire: exige aire · Daño: no condiciona.
- Estado que modifica: f.o.hp, f.p.sig, f.p.rd, f.p.ctrl, f.o.stam.
- Funciones: `TQ.state` → `TQ.use` → `TQ.resolve` → `TQ.apply` → `TQ.hit`. En combate: panel de técnicas, si está desbloqueada y la posición coincide.
- Ultimate: no · IA del rival: no · Efectos secundarios: ninguno.

#### `s_jab` — JAB FANTASMA

- Nivel 1 (ESPECIAL) · pasiva · costo 1 🔷 · requisitos: ninguno.
- Efecto permanente: +2.2 a strike (`gp:mod/tecnicas`); +1.4 a counter (`gp:mod/tecnicas`); lectura +3.5 (`exchange:post/tqPasivas`). Sin uso, sin minijuego, sin fallo.
- Ultimate: no · IA del rival: no · Efectos secundarios: ninguno.

#### `s_teep` — TEEP DE FRENO

- Nivel 1 (ESPECIAL) · activa · costo 2 🔷 · requisitos: ninguno.
- Uso: desde stand, clinch · sin condiciones · 2 uso(s) por pelea · aire 6.
- Ejecución: minijuego `zone`, dificultad 1; éxito según kicks, timing, footwork, la nota, el aire y la resistencia del rival.
- Efecto (BUENA ×0,78 / PERFECTA ×1,22): daño 3–5, posición → stand, control +2, le saca aire 8, distancia +0.55.
- Si FALLA: sólo pierde el intercambio y el aire (60 %).
- Distancia: no condiciona; la cambia · Aire: no condiciona · Daño: no condiciona.
- Estado que modifica: f.o.hp, f.p.sig, f.p.rd, f.pos, f.p.ctrl, f.o.stam, f.cl (distancia/lectura).
- Funciones: `TQ.state` → `TQ.use` → `TQ.resolve` → `TQ.apply` → `TQ.hit`. En combate: panel de técnicas, si está desbloqueada y la posición coincide.
- Ultimate: no · IA del rival: no · Efectos secundarios: cambia la posición.

#### `s_cklow` — COUNTER DE LOW KICK

- Nivel 2 (AVANZADA) · activa · costo 3 🔷 · requisitos: antes `s_low`.
- Uso: desde stand · condiciones: el rival tiene que estar cerca · 2 uso(s) por pelea · aire 10.
- Ejecución: minijuego `ring`, dificultad 2; éxito según kicks, timing, fightiq, la nota, el aire y la resistencia del rival.
- Efecto (BUENA ×0,78 / PERFECTA ×1,22): daño 9–14, knockdown 0.1, control +1, golpes significativos +1, le saca aire 6.
- Si FALLA: daño 3–6 — «Llegás tarde al cruce y te comés su patada entera.».
- Distancia: exige rival cerca · Aire: no condiciona · Daño: no condiciona.
- Estado que modifica: f.o.hp, f.p.sig, f.p.rd, f.p.kd, f.p.ctrl, f.o.stam, f.o.hp (al fallar), f.p.sig (al fallar), f.p.rd (al fallar).
- Funciones: `TQ.state` → `TQ.use` → `TQ.resolve` → `TQ.apply` → `TQ.hit`. En combate: panel de técnicas, si está desbloqueada y la posición coincide.
- Ultimate: no · IA del rival: no · Efectos secundarios: ninguno.

#### `s_flying` — RODILLA VOLADORA SITUACIONAL

- Nivel 2 (AVANZADA) · activa · costo 4 🔷 · requisitos: antes `s_jab`.
- Uso: desde stand · condiciones: el rival tiene que estar cerca; te tiene que quedar aire · 1 uso(s) por pelea · aire 17 (ajustado por división: speed, `TQ.divF`).
- Ejecución: minijuego `ring`, dificultad 2; éxito según muay, timing, power, la nota, el aire y la resistencia del rival.
- Efecto (BUENA ×0,78 / PERFECTA ×1,22): daño 13–20, knockdown 0.26, control +2, golpes significativos +2.
- Si FALLA: daño 4–7, posición → clinch, control del rival +3 — «Saltás, no llega, y aterrizás directo en su clinch.».
- Distancia: exige rival cerca · Aire: exige aire · Daño: no condiciona.
- Estado que modifica: f.o.hp, f.p.sig, f.p.rd, f.p.kd, f.p.ctrl, f.o.hp (al fallar), f.p.sig (al fallar), f.p.rd (al fallar), f.pos (al fallar), f.o.ctrl (al fallar).
- Funciones: `TQ.state` → `TQ.use` → `TQ.resolve` → `TQ.apply` → `TQ.hit`. En combate: panel de técnicas, si está desbloqueada y la posición coincide.
- Ultimate: no · IA del rival: no · Efectos secundarios: al fallar cambia la posición.

#### `s_elbow` — CODO CORTADOR

- Nivel 2 (AVANZADA) · activa · costo 3 🔷 · requisitos: antes `s_teep`.
- Uso: desde clinch, gtop · sin condiciones · 2 uso(s) por pelea · aire 9.
- Ejecución: minijuego `zone`, dificultad 2; éxito según muay, clinch, accuracy, la nota, el aire y la resistencia del rival.
- Efecto (BUENA ×0,78 / PERFECTA ×1,22): daño 7–11, control +2, golpes significativos +1, corte (sangrado 2.2).
- Si FALLA: sólo pierde el intercambio y el aire (60 %).
- Distancia: no condiciona · Aire: no condiciona · Daño: no condiciona.
- Estado que modifica: f.o.hp, f.p.sig, f.p.rd, f.p.ctrl, f.tq.bleed.
- Funciones: `TQ.state` → `TQ.use` → `TQ.resolve` → `TQ.apply` → `TQ.hit`. En combate: panel de técnicas, si está desbloqueada y la posición coincide.
- Ultimate: no · IA del rival: no · Efectos secundarios: deja un corte.

#### `s_spin` — SPINNING HOOK KICK

- Nivel 3 (ÉLITE) · activa · costo 5 🔷 · requisitos: antes `s_cklow`.
- Uso: desde stand · condiciones: necesitás espacio: distancia media o larga; te tiene que quedar aire · 1 uso(s) por pelea · aire 18 (ajustado por división: speed, `TQ.divF`).
- Ejecución: minijuego `ring`, dificultad 3; éxito según kicks, timing, power, speed, la nota, el aire y la resistencia del rival.
- Efecto (BUENA ×0,78 / PERFECTA ×1,22): daño 16–24, knockdown 0.34, golpes significativos +2.
- Si FALLA: daño 5–9, te cuesta aire 8 — «Girás, no llega, y quedás de espaldas medio segundo de más.».
- Distancia: exige distancia media/larga · Aire: exige aire · Daño: no condiciona.
- Estado que modifica: f.o.hp, f.p.sig, f.p.rd, f.p.kd, f.o.hp (al fallar), f.p.sig (al fallar), f.p.rd (al fallar), f.p.stam (al fallar).
- Funciones: `TQ.state` → `TQ.use` → `TQ.resolve` → `TQ.apply` → `TQ.hit`. En combate: panel de técnicas, si está desbloqueada y la posición coincide.
- Ultimate: no · IA del rival: no · Efectos secundarios: ninguno.

#### `s_head` — HEAD KICK DE CASTIGO

- Nivel 3 (ÉLITE) · activa · costo 4 🔷 · requisitos: antes `s_flying`.
- Uso: desde stand · condiciones: primero tenés que esquivar o contragolpear limpio · 1 uso(s) por pelea · aire 14 (ajustado por división: speed, `TQ.divF`).
- Ejecución: minijuego `ring`, dificultad 3; éxito según kicks, timing, accuracy, la nota, el aire y la resistencia del rival.
- Efecto (BUENA ×0,78 / PERFECTA ×1,22): daño 15–22, knockdown 0.3, golpes significativos +2.
- Si FALLA: daño 3–6 — «La patada llega tarde y le pega en el hombro.».
- Distancia: no condiciona · Aire: no condiciona · Daño: no condiciona.
- Estado que modifica: f.o.hp, f.p.sig, f.p.rd, f.p.kd, f.o.hp (al fallar), f.p.sig (al fallar), f.p.rd (al fallar).
- Funciones: `TQ.state` → `TQ.use` → `TQ.resolve` → `TQ.apply` → `TQ.hit`. En combate: panel de técnicas, si está desbloqueada y la posición coincide.
- Ultimate: no · IA del rival: no · Efectos secundarios: ninguno.

#### `s_perf` — SPINNING HOOK PERFECTA

- Nivel 4 (LEGENDARIA) · activa · costo 7 🔷 · requisitos: antes `s_spin` y 5 técnicas de la rama.
- Uso: desde stand · condiciones: necesitás espacio: distancia media o larga; hace falta mucho aire · 1 uso(s) por pelea · aire 24 (ajustado por división: speed, `TQ.divF`).
- Ejecución: minijuego `clutch`, dificultad 4; éxito según kicks, timing, power, accuracy, la nota, el aire y la resistencia del rival.
- Efecto (BUENA ×0,78 / PERFECTA ×1,22): daño 22–30, knockdown 0.52, finaliza (sólo PERFECTA) 0.5 ko, golpes significativos +3.
- Si FALLA: daño 6–10, te cuesta aire 12 — «La giraste sin la distancia justa: pasás de largo y quedás expuesto.».
- Distancia: exige distancia media/larga · Aire: exige mucho aire · Daño: no condiciona.
- Estado que modifica: f.o.hp, f.p.sig, f.p.rd, f.p.kd, fin de la pelea (finishFight), f.o.hp (al fallar), f.p.sig (al fallar), f.p.rd (al fallar), f.p.stam (al fallar).
- Funciones: `TQ.state` → `TQ.use` → `TQ.resolve` → `TQ.apply` → `TQ.hit` → `finishFight`. En combate: panel de técnicas, si está desbloqueada y la posición coincide.
- Ultimate: **sí** → TALÓN DEL VERDUGO (ver `dev/ULTIMATES-AUDITORIA.md`) · IA del rival: no · Efectos secundarios: ninguno.

### WRESTLING

#### `w_sprawl` — SPRAWL RÁPIDO

- Nivel 1 (ESPECIAL) · pasiva · costo 1 🔷 · requisitos: ninguno.
- Efecto permanente: +1 a counter (`gp:mod/tecnicas`); +5.5 anti-derribo (`combat:eff/TQ`). Sin uso, sin minijuego, sin fallo.
- Ultimate: no · IA del rival: no · Efectos secundarios: ninguno.

#### `w_lvl` — CAMBIO DE NIVEL LIMPIO

- Nivel 1 (ESPECIAL) · activa · costo 2 🔷 · requisitos: ninguno.
- Uso: desde stand · sin condiciones · 2 uso(s) por pelea · aire 11.
- Ejecución: minijuego `zone`, dificultad 1; éxito según takedowns, wrestling, speed, la nota, el aire y la resistencia del rival.
- Efecto (BUENA ×0,78 / PERFECTA ×1,22): derribo, posición → gtop, control +4, distancia -0.6.
- Si FALLA: te cuesta aire 6, control del rival +2 — «Entrás mal y él te recibe con el sprawl.».
- Distancia: no condiciona; la cambia · Aire: no condiciona · Daño: no condiciona.
- Estado que modifica: f.p.td, f.p.ctrl, f.pos, f.cl (distancia/lectura), f.p.stam (al fallar), f.o.ctrl (al fallar).
- Funciones: `TQ.state` → `TQ.use` → `TQ.resolve` → `TQ.apply`. En combate: panel de técnicas, si está desbloqueada y la posición coincide.
- Ultimate: no · IA del rival: no · Efectos secundarios: cambia la posición.

#### `w_cage` — TRABAJO DE REJA

- Nivel 1 (ESPECIAL) · pasiva · costo 1 🔷 · requisitos: ninguno.
- Efecto permanente: +2.4 a clinch (`gp:mod/tecnicas`); +1.2 a td (`gp:mod/tecnicas`); reja: le saca 2.2 de aire en el clinch (`exchange:post/tqPasivas`). Sin uso, sin minijuego, sin fallo.
- Ultimate: no · IA del rival: no · Efectos secundarios: ninguno.

#### `w_body` — REAR BODY LOCK EXPLOSIVO

- Nivel 2 (AVANZADA) · activa · costo 3 🔷 · requisitos: antes `w_lvl`.
- Uso: desde clinch · condiciones: te tiene que quedar aire · 2 uso(s) por pelea · aire 13.
- Ejecución: minijuego `seq`, dificultad 2; éxito según wrestling, clinch, power, la nota, el aire y la resistencia del rival.
- Efecto (BUENA ×0,78 / PERFECTA ×1,22): derribo, posición → gtop, control +5, le saca aire 7.
- Si FALLA: te cuesta aire 7 — «Cierra las manos sobre las tuyas y rompe el agarre.».
- Distancia: no condiciona · Aire: exige aire · Daño: no condiciona.
- Estado que modifica: f.p.td, f.p.ctrl, f.pos, f.o.stam, f.p.stam (al fallar).
- Funciones: `TQ.state` → `TQ.use` → `TQ.resolve` → `TQ.apply`. En combate: panel de técnicas, si está desbloqueada y la posición coincide.
- Ultimate: no · IA del rival: no · Efectos secundarios: cambia la posición.

#### `w_ctr` — COUNTER AL DERRIBO

- Nivel 2 (AVANZADA) · activa · costo 3 🔷 · requisitos: antes `w_sprawl`.
- Uso: desde stand · condiciones: el rival tiene que estar cerca · 2 uso(s) por pelea · aire 10.
- Ejecución: minijuego `ring`, dificultad 2; éxito según tdd, wrestling, timing, la nota, el aire y la resistencia del rival.
- Efecto (BUENA ×0,78 / PERFECTA ×1,22): daño 8–12, control +3, golpes significativos +1, le saca aire 10.
- Si FALLA: posición → gbot, control del rival +3 — «Te confiás en el sprawl y termina arriba tuyo.».
- Distancia: exige rival cerca · Aire: no condiciona · Daño: no condiciona.
- Estado que modifica: f.o.hp, f.p.sig, f.p.rd, f.p.ctrl, f.o.stam, f.pos (al fallar), f.o.ctrl (al fallar).
- Funciones: `TQ.state` → `TQ.use` → `TQ.resolve` → `TQ.apply` → `TQ.hit`. En combate: panel de técnicas, si está desbloqueada y la posición coincide.
- Ultimate: no · IA del rival: no · Efectos secundarios: al fallar cambia la posición.

#### `w_chain` — CADENA DE DERRIBOS

- Nivel 2 (AVANZADA) · activa · costo 4 🔷 · requisitos: antes `w_cage`.
- Uso: desde stand, clinch · condiciones: hace falta mucho aire · 1 uso(s) por pelea · aire 16.
- Ejecución: minijuego `seq`, dificultad 2; éxito según takedowns, wrestling, cardio, la nota, el aire y la resistencia del rival.
- Efecto (BUENA ×0,78 / PERFECTA ×1,22): derribo, posición → gtop, control +6, le saca aire 12.
- Si FALLA: te cuesta aire 11 — «Tres intentos, tres defensas. El que se quedó sin aire fuiste vos.».
- Distancia: no condiciona · Aire: exige mucho aire · Daño: no condiciona.
- Estado que modifica: f.p.td, f.p.ctrl, f.pos, f.o.stam, f.p.stam (al fallar).
- Funciones: `TQ.state` → `TQ.use` → `TQ.resolve` → `TQ.apply`. En combate: panel de técnicas, si está desbloqueada y la posición coincide.
- Ultimate: no · IA del rival: no · Efectos secundarios: cambia la posición.

#### `w_dbl` — DOBLE PIERNA EXPLOSIVA

- Nivel 3 (ÉLITE) · activa · costo 5 🔷 · requisitos: antes `w_body`.
- Uso: desde stand · condiciones: el rival tiene que estar cerca; te tiene que quedar aire · 1 uso(s) por pelea · aire 19 (ajustado por división: power, `TQ.divF`).
- Ejecución: minijuego `seq`, dificultad 3; éxito según takedowns, wrestling, power, speed, la nota, el aire y la resistencia del rival.
- Efecto (BUENA ×0,78 / PERFECTA ×1,22): daño 4–7, derribo, posición → gtop, control +7, le saca aire 10.
- Si FALLA: te cuesta aire 12, control del rival +3 — «Se defiende con el guillotine y te obliga a soltar.».
- Distancia: exige rival cerca · Aire: exige aire · Daño: no condiciona.
- Estado que modifica: f.o.hp, f.p.sig, f.p.rd, f.p.td, f.p.ctrl, f.pos, f.o.stam, f.p.stam (al fallar), f.o.ctrl (al fallar).
- Funciones: `TQ.state` → `TQ.use` → `TQ.resolve` → `TQ.apply` → `TQ.hit`. En combate: panel de técnicas, si está desbloqueada y la posición coincide.
- Ultimate: no · IA del rival: no · Efectos secundarios: cambia la posición.

#### `w_gnp` — GROUND AND POUND QUIRÚRGICO

- Nivel 3 (ÉLITE) · activa · costo 4 🔷 · requisitos: antes `w_ctr`.
- Uso: desde gtop · condiciones: tenés que venir controlando el round · 1 uso(s) por pelea · aire 13.
- Ejecución: minijuego `zone`, dificultad 3; éxito según ground, accuracy, power, la nota, el aire y la resistencia del rival.
- Efecto (BUENA ×0,78 / PERFECTA ×1,22): daño 14–20, knockdown 0.16, control +4, golpes significativos +2, corte (sangrado 1.6).
- Si FALLA: posición → gbot — «Te levantás demasiado para pegar y te barre.».
- Distancia: no condiciona · Aire: no condiciona · Daño: no condiciona.
- Estado que modifica: f.o.hp, f.p.sig, f.p.rd, f.p.kd, f.p.ctrl, f.tq.bleed, f.pos (al fallar).
- Funciones: `TQ.state` → `TQ.use` → `TQ.resolve` → `TQ.apply` → `TQ.hit`. En combate: panel de técnicas, si está desbloqueada y la posición coincide.
- Ultimate: no · IA del rival: no · Efectos secundarios: deja un corte, al fallar cambia la posición.

#### `w_sup` — SUPLEX EXPLOSIVO

- Nivel 4 (LEGENDARIA) · activa · costo 6 🔷 · requisitos: antes `w_dbl` y 5 técnicas de la rama.
- Uso: desde clinch · condiciones: hace falta mucho aire · 1 uso(s) por pelea · aire 26 (ajustado por división: power, `TQ.divF`).
- Ejecución: minijuego `clutch`, dificultad 4; éxito según wrestling, power, clinch, toughness, la nota, el aire y la resistencia del rival.
- Efecto (BUENA ×0,78 / PERFECTA ×1,22): daño 16–24, knockdown 0.42, finaliza (sólo PERFECTA) 0.22 ko, derribo, posición → gtop, control +8.
- Si FALLA: daño 5–9, posición → stand, te cuesta aire 16 — «No lo llegás a despegar del suelo y perdés todo el aire en el intento.».
- Distancia: no condiciona · Aire: exige mucho aire · Daño: no condiciona.
- Estado que modifica: f.o.hp, f.p.sig, f.p.rd, f.p.kd, fin de la pelea (finishFight), f.p.td, f.p.ctrl, f.pos, f.o.hp (al fallar), f.p.sig (al fallar), f.p.rd (al fallar), f.pos (al fallar), f.p.stam (al fallar).
- Funciones: `TQ.state` → `TQ.use` → `TQ.resolve` → `TQ.apply` → `TQ.hit` → `finishFight`. En combate: panel de técnicas, si está desbloqueada y la posición coincide.
- Ultimate: **sí** → SUPLEX DE LA TIERRA (ver `dev/ULTIMATES-AUDITORIA.md`) · IA del rival: no · Efectos secundarios: cambia la posición, al fallar cambia la posición.

### GRAPPLING

#### `g_guard` — CAMBIO DE GUARDIA

- Nivel 1 (ESPECIAL) · activa · costo 1 🔷 · requisitos: ninguno.
- Uso: desde gbot · sin condiciones · 2 uso(s) por pelea · aire 7.
- Ejecución: minijuego `zone`, dificultad 1; éxito según grappling, ground, fightiq, la nota, el aire y la resistencia del rival.
- Efecto (BUENA ×0,78 / PERFECTA ×1,22): control +2, le saca aire 8, recuperás aire 6.
- Si FALLA: sólo pierde el intercambio y el aire (60 %).
- Distancia: no condiciona · Aire: no condiciona · Daño: no condiciona.
- Estado que modifica: f.p.ctrl, f.o.stam, f.p.stam.
- Funciones: `TQ.state` → `TQ.use` → `TQ.resolve` → `TQ.apply`. En combate: panel de técnicas, si está desbloqueada y la posición coincide.
- Ultimate: no · IA del rival: no · Efectos secundarios: ninguno.

#### `g_esc` — ESCAPE TÉCNICO

- Nivel 1 (ESPECIAL) · activa · costo 2 🔷 · requisitos: ninguno.
- Uso: desde gbot · sin condiciones · 2 uso(s) por pelea · aire 9.
- Ejecución: minijuego `seq`, dificultad 1; éxito según grappling, ground, footwork, la nota, el aire y la resistencia del rival.
- Efecto (BUENA ×0,78 / PERFECTA ×1,22): posición → stand, control +2, recuperás aire 4.
- Si FALLA: te cuesta aire 6 — «La cadera no entra y quedás debajo del mismo peso.».
- Distancia: no condiciona · Aire: no condiciona · Daño: no condiciona.
- Estado que modifica: f.pos, f.p.ctrl, f.p.stam, f.p.stam (al fallar).
- Funciones: `TQ.state` → `TQ.use` → `TQ.resolve` → `TQ.apply`. En combate: panel de técnicas, si está desbloqueada y la posición coincide.
- Ultimate: no · IA del rival: no · Efectos secundarios: cambia la posición.

#### `g_grip` — AGARRE DE HIERRO

- Nivel 1 (ESPECIAL) · pasiva · costo 1 🔷 · requisitos: ninguno.
- Efecto permanente: +1.8 a ground (`gp:mod/tecnicas`); +4.5 suelo (`combat:eff/TQ`). Sin uso, sin minijuego, sin fallo.
- Ultimate: no · IA del rival: no · Efectos secundarios: ninguno.

#### `g_sweep` — BARRIDA ENCADENADA

- Nivel 2 (AVANZADA) · activa · costo 3 🔷 · requisitos: antes `g_guard`.
- Uso: desde gbot · sin condiciones · 2 uso(s) por pelea · aire 11.
- Ejecución: minijuego `seq`, dificultad 2; éxito según grappling, ground, timing, la nota, el aire y la resistencia del rival.
- Efecto (BUENA ×0,78 / PERFECTA ×1,22): posición → gtop, control +5, golpes significativos +1.
- Si FALLA: te cuesta aire 7, control del rival +2 — «Corrige a tiempo y aprieta todavía más el control.».
- Distancia: no condiciona · Aire: no condiciona · Daño: no condiciona.
- Estado que modifica: f.pos, f.p.ctrl, f.p.sig, f.p.stam (al fallar), f.o.ctrl (al fallar).
- Funciones: `TQ.state` → `TQ.use` → `TQ.resolve` → `TQ.apply`. En combate: panel de técnicas, si está desbloqueada y la posición coincide.
- Ultimate: no · IA del rival: no · Efectos secundarios: cambia la posición.

#### `g_back` — TOMA DE ESPALDA

- Nivel 2 (AVANZADA) · activa · costo 4 🔷 · requisitos: antes `g_esc`.
- Uso: desde gtop · sin condiciones · 1 uso(s) por pelea · aire 12.
- Ejecución: minijuego `seq`, dificultad 2; éxito según grappling, ground, wrestling, la nota, el aire y la resistencia del rival.
- Efecto (BUENA ×0,78 / PERFECTA ×1,22): control +7, golpes significativos +1, le saca aire 9, marca «back».
- Si FALLA: posición → gbot — «Al girar le regalás la cadera y termina arriba.».
- Distancia: no condiciona · Aire: no condiciona · Daño: no condiciona.
- Estado que modifica: f.p.ctrl, f.p.sig, f.o.stam, f.tq.back (sin lector), f.pos (al fallar).
- Funciones: `TQ.state` → `TQ.use` → `TQ.resolve` → `TQ.apply`. En combate: panel de técnicas, si está desbloqueada y la posición coincide.
- Ultimate: no · IA del rival: no · Efectos secundarios: marca «back», al fallar cambia la posición · **código muerto**: la marca «back» no se lee.

#### `g_adv` — ESCAPE DE SUMISIÓN AVANZADO

- Nivel 2 (AVANZADA) · pasiva · costo 3 🔷 · requisitos: antes `g_grip`.
- Efecto permanente: +2 defensa (`combat:eff/TQ`); +5 suelo (`combat:eff/TQ`). Sin uso, sin minijuego, sin fallo.
- Ultimate: no · IA del rival: no · Efectos secundarios: ninguno.

#### `g_rev` — REVERSAL IMPOSIBLE

- Nivel 3 (ÉLITE) · activa · costo 5 🔷 · requisitos: antes `g_sweep`.
- Uso: desde gbot · condiciones: te tiene que quedar aire · 1 uso(s) por pelea · aire 16.
- Ejecución: minijuego `seq`, dificultad 3; éxito según grappling, ground, speed, la nota, el aire y la resistencia del rival.
- Efecto (BUENA ×0,78 / PERFECTA ×1,22): posición → gtop, control +8, golpes significativos +2, marca «back».
- Si FALLA: te cuesta aire 12, control del rival +4 — «El giro no sale y ahora estás debajo del peso completo.».
- Distancia: no condiciona · Aire: exige aire · Daño: no condiciona.
- Estado que modifica: f.pos, f.p.ctrl, f.p.sig, f.tq.back (sin lector), f.p.stam (al fallar), f.o.ctrl (al fallar).
- Funciones: `TQ.state` → `TQ.use` → `TQ.resolve` → `TQ.apply`. En combate: panel de técnicas, si está desbloqueada y la posición coincide.
- Ultimate: no · IA del rival: no · Efectos secundarios: cambia la posición, marca «back» · **código muerto**: la marca «back» no se lee.

#### `g_chain` — SUBMISSION CHAIN

- Nivel 3 (ÉLITE) · activa · costo 5 🔷 · requisitos: antes `g_back`.
- Uso: desde gtop, gbot · condiciones: tenés que venir controlando el round · 1 uso(s) por pelea · aire 15.
- Ejecución: minijuego `seq`, dificultad 3; éxito según submission, grappling, ground, la nota, el aire y la resistencia del rival.
- Efecto (BUENA ×0,78 / PERFECTA ×1,22): sumisión 0.3, control +5, golpes significativos +1, le saca aire 16.
- Si FALLA: posición → stand — «Se zafa de la última y la pelea vuelve de pie.».
- Distancia: no condiciona · Aire: no condiciona · Daño: no condiciona.
- Estado que modifica: fin de la pelea (finishFight), f.p.ctrl, f.p.sig, f.o.stam, f.pos (al fallar).
- Funciones: `TQ.state` → `TQ.use` → `TQ.resolve` → `TQ.apply` → `finishFight`. En combate: panel de técnicas, si está desbloqueada y la posición coincide.
- Ultimate: no · IA del rival: no · Efectos secundarios: al fallar cambia la posición.

#### `g_def` — SUBMISSION CHAIN DEFINITIVA

- Nivel 4 (LEGENDARIA) · activa · costo 7 🔷 · requisitos: antes `g_chain` y 5 técnicas de la rama.
- Uso: desde gtop, gbot · condiciones: a partir del segundo round; te tiene que quedar aire · 1 uso(s) por pelea · aire 20.
- Ejecución: minijuego `clutch`, dificultad 4; éxito según submission, grappling, ground, composure, la nota, el aire y la resistencia del rival.
- Efecto (BUENA ×0,78 / PERFECTA ×1,22): sumisión 0.62, control +7, golpes significativos +2, le saca aire 22.
- Si FALLA: posición → gbot, te cuesta aire 12 — «Se sale de la última transición y te deja debajo.».
- Distancia: no condiciona · Aire: exige aire · Daño: no condiciona.
- Estado que modifica: fin de la pelea (finishFight), f.p.ctrl, f.p.sig, f.o.stam, f.pos (al fallar), f.p.stam (al fallar).
- Funciones: `TQ.state` → `TQ.use` → `TQ.resolve` → `TQ.apply` → `finishFight`. En combate: panel de técnicas, si está desbloqueada y la posición coincide.
- Ultimate: **sí** → LA ÚLTIMA PUERTA (ver `dev/ULTIMATES-AUDITORIA.md`) · IA del rival: no · Efectos secundarios: al fallar cambia la posición.

### FIGHT IQ

#### `i_read` — LECTURA RÁPIDA

- Nivel 1 (ESPECIAL) · pasiva · costo 1 🔷 · requisitos: ninguno.
- Efecto permanente: +2 a counter (`gp:mod/tecnicas`); lectura +5 (`exchange:post/tqPasivas`). Sin uso, sin minijuego, sin fallo.
- Ultimate: no · IA del rival: no · Efectos secundarios: ninguno.

#### `i_ctr` — COUNTER BÁSICO

- Nivel 1 (ESPECIAL) · activa · costo 2 🔷 · requisitos: ninguno.
- Uso: desde stand · condiciones: necesitás espacio: distancia media o larga · 2 uso(s) por pelea · aire 8.
- Ejecución: minijuego `zone`, dificultad 1; éxito según timing, accuracy, fightiq, la nota, el aire y la resistencia del rival.
- Efecto (BUENA ×0,78 / PERFECTA ×1,22): daño 7–11, control +2, golpes significativos +1, lectura +8.
- Si FALLA: sólo pierde el intercambio y el aire (60 %).
- Distancia: exige distancia media/larga · Aire: no condiciona · Daño: no condiciona.
- Estado que modifica: f.o.hp, f.p.sig, f.p.rd, f.p.ctrl, f.cl (distancia/lectura).
- Funciones: `TQ.state` → `TQ.use` → `TQ.resolve` → `TQ.apply` → `TQ.hit`. En combate: panel de técnicas, si está desbloqueada y la posición coincide.
- Ultimate: no · IA del rival: no · Efectos secundarios: ninguno.

#### `i_breath` — ADMINISTRAR EL AIRE

- Nivel 1 (ESPECIAL) · pasiva · costo 1 🔷 · requisitos: ninguno.
- Efecto permanente: +1 defensa (`combat:eff/TQ`); aire: gasta 0.16 menos (envoltura de `drain`). Sin uso, sin minijuego, sin fallo.
- Ultimate: no · IA del rival: no · Efectos secundarios: ninguno.

#### `i_perf` — COUNTER PERFECTO

- Nivel 2 (AVANZADA) · activa · costo 4 🔷 · requisitos: antes `i_ctr`.
- Uso: desde stand, clinch · condiciones: primero tenés que esquivar o contragolpear limpio · 1 uso(s) por pelea · aire 11.
- Ejecución: minijuego `ring`, dificultad 2; éxito según timing, accuracy, fightiq, power, la nota, el aire y la resistencia del rival.
- Efecto (BUENA ×0,78 / PERFECTA ×1,22): daño 13–19, knockdown 0.24, control +2, golpes significativos +2.
- Si FALLA: daño 3–6 — «Leíste bien pero saliste tarde.».
- Distancia: no condiciona · Aire: no condiciona · Daño: no condiciona.
- Estado que modifica: f.o.hp, f.p.sig, f.p.rd, f.p.kd, f.p.ctrl, f.o.hp (al fallar), f.p.sig (al fallar), f.p.rd (al fallar).
- Funciones: `TQ.state` → `TQ.use` → `TQ.resolve` → `TQ.apply` → `TQ.hit`. En combate: panel de técnicas, si está desbloqueada y la posición coincide.
- Ultimate: no · IA del rival: no · Efectos secundarios: ninguno.

#### `i_wall` — MURO DEFENSIVO

- Nivel 2 (AVANZADA) · pasiva · costo 3 🔷 · requisitos: antes `i_read`.
- Efecto permanente: +2.5 defensa (`combat:eff/TQ`); guardia: devuelve 0.13 del daño (`exchange:post/tqPasivas`). Sin uso, sin minijuego, sin fallo.
- Ultimate: no · IA del rival: no · Efectos secundarios: ninguno.

#### `i_clock` — ROBAR EL ROUND

- Nivel 2 (AVANZADA) · activa · costo 3 🔷 · requisitos: antes `i_breath`.
- Uso: desde stand, clinch, gtop, gbot · condiciones: último round o últimos segundos · 1 uso(s) por pelea · aire 10.
- Ejecución: minijuego `zone`, dificultad 2; éxito según fightiq, cardio, footwork, la nota, el aire y la resistencia del rival.
- Efecto (BUENA ×0,78 / PERFECTA ×1,22): daño 2–4, control +6, golpes significativos +3.
- Si FALLA: sólo pierde el intercambio y el aire (60 %).
- Distancia: no condiciona · Aire: no condiciona · Daño: no condiciona.
- Estado que modifica: f.o.hp, f.p.sig, f.p.rd, f.p.ctrl.
- Funciones: `TQ.state` → `TQ.use` → `TQ.resolve` → `TQ.apply` → `TQ.hit`. En combate: panel de técnicas, si está desbloqueada y la posición coincide.
- Ultimate: no · IA del rival: no · Efectos secundarios: ninguno.

#### `i_bait` — TRAMPA CALCULADA

- Nivel 3 (ÉLITE) · activa · costo 4 🔷 · requisitos: antes `i_perf`.
- Uso: desde stand · condiciones: a partir del segundo round · 1 uso(s) por pelea · aire 12.
- Ejecución: minijuego `ring`, dificultad 3; éxito según fightiq, patience, timing, la nota, el aire y la resistencia del rival.
- Efecto (BUENA ×0,78 / PERFECTA ×1,22): daño 9–14, control +2, golpes significativos +1, lectura +22, marca «dodge».
- Si FALLA: daño 4–8 — «El cebo era muy evidente y te lo hizo pagar.».
- Distancia: no condiciona · Aire: no condiciona · Daño: no condiciona.
- Estado que modifica: f.o.hp, f.p.sig, f.p.rd, f.p.ctrl, f.cl (distancia/lectura), f.tq.dodgeAt, f.o.hp (al fallar), f.p.sig (al fallar), f.p.rd (al fallar).
- Funciones: `TQ.state` → `TQ.use` → `TQ.resolve` → `TQ.apply` → `TQ.hit` → `TQ.markDodge`. En combate: panel de técnicas, si está desbloqueada y la posición coincide.
- Ultimate: no · IA del rival: no · Efectos secundarios: marca «dodge».

#### `i_rally` — SEGUNDO AIRE

- Nivel 3 (ÉLITE) · activa · costo 5 🔷 · requisitos: antes `i_wall`.
- Uso: desde stand, clinch, gtop, gbot · condiciones: tenés que ir perdiendo en las tarjetas · 1 uso(s) por pelea · aire 0.
- Ejecución: minijuego `zone`, dificultad 3; éxito según cardio, recovery, toughness, confidence, la nota, el aire y la resistencia del rival.
- Efecto (BUENA ×0,78 / PERFECTA ×1,22): control +2, recuperás aire 34, recuperás 7 de vida, lectura +14.
- Si FALLA: te cuesta aire 8 — «Buscás el envión y lo único que encontrás es más cansancio.».
- Distancia: no condiciona · Aire: no condiciona · Daño: no condiciona.
- Estado que modifica: f.p.ctrl, f.p.stam, f.p.hp, f.cl (distancia/lectura), f.p.stam (al fallar).
- Funciones: `TQ.state` → `TQ.use` → `TQ.resolve` → `TQ.apply`. En combate: panel de técnicas, si está desbloqueada y la posición coincide.
- Ultimate: no · IA del rival: no · Efectos secundarios: ninguno.

#### `i_last` — LAST CHANCE

- Nivel 4 (LEGENDARIA) · activa · costo 6 🔷 · requisitos: antes `i_rally` y 5 técnicas de la rama.
- Uso: desde stand, clinch, gtop · condiciones: situación crítica: poca vida o final ajustado en contra · 1 uso(s) por pelea · aire 22.
- Ejecución: minijuego `clutch`, dificultad 4; éxito según power, toughness, confidence, timing, la nota, el aire y la resistencia del rival.
- Efecto (BUENA ×0,78 / PERFECTA ×1,22): daño 20–28, knockdown 0.46, finaliza (sólo PERFECTA) 0.42 ko, golpes significativos +3, recuperás aire 10.
- Si FALLA: daño 7–12, te cuesta aire 18 — «Tirás todo lo que te queda y no llega nada. Ahora sí estás vacío.».
- Distancia: no condiciona · Aire: no condiciona · Daño: sólo en situación crítica.
- Estado que modifica: f.o.hp, f.p.sig, f.p.rd, f.p.kd, fin de la pelea (finishFight), f.p.stam, f.o.hp (al fallar), f.p.sig (al fallar), f.p.rd (al fallar), f.p.stam (al fallar).
- Funciones: `TQ.state` → `TQ.use` → `TQ.resolve` → `TQ.apply` → `TQ.hit` → `finishFight`. En combate: panel de técnicas, si está desbloqueada y la posición coincide.
- Ultimate: **sí** → ÚLTIMO ALIENTO (ver `dev/ULTIMATES-AUDITORIA.md`) · IA del rival: no · Efectos secundarios: ninguno.
