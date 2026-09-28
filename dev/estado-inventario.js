'use strict';
/* dev/estado-inventario.js — POR QUÉ EXISTE CADA ESTADO (fase 13)
   ---------------------------------------------------------------------------
   «No es necesario que todas las variables tengan un efecto jugable. Sí es
   necesario saber POR QUÉ existe cada una.»
   ESTADO declara cada clave de primer nivel de G con su clase de persistencia:
     persistente — la carrera: tiene que sobrevivir a guardar y cargar.
     derivable   — se guarda, pero se puede reconstruir de otra (caché, índice).
     temporal    — una interacción en curso (evento en pantalla, pelea, cobro):
                   se guarda A PROPÓSITO para que recargar la retome.
     serializacion — describe el archivo, no la partida.
     sesion      — no va al disco (STATE.RUNTIME_KEYS); tienen que coincidir.
     muerta      — nadie la escribe después de crearla y nadie la lee.
   HUERFANAS declara cada hoja guardada que nadie lee (ni el juego ni la
   interfaz) con su clase de la fase 13 y la decisión. La prueba 25 exige que
   esta lista y dev/estado-mapa.js coincidan en las dos direcciones: una
   huérfana nueva rompe la prueba, y una huérfana que alguien conecta también
   (hay que sacarla de acá).
   Clases: D escrita sin lector · E leída sin escritor · H muerta (ni una ni
   otra) · O observabilidad (sólo registro/depuración) · S serialización.     */

const ESTADO = {
  /* --- mundo y tiempo --- */
  rs:        { clase: 'persistente', sistema: 'azar',      por: 'semilla del RNG de la partida (rnd); sin ella cargar no reproduce la carrera' },
  nid:       { clase: 'persistente', sistema: 'mundo',     por: 'contador de ids (uid): dos peleadores no pueden compartir id después de cargar' },
  year:      { clase: 'persistente', sistema: 'tiempo',    por: 'calendario' },
  week:      { clase: 'persistente', sistema: 'tiempo',    por: 'calendario' },
  startYear: { clase: 'persistente', sistema: 'carrera',   por: 'año de inicio: legado, carrera de meta, historia UFC anterior' },
  seed0:     { clase: 'persistente', sistema: 'meta',      por: 'semilla con la que nació el mundo: código de carrera y carreras de meta' },
  fighters:  { clase: 'persistente', sistema: 'mundo',     por: 'todos los peleadores, el jugador incluido' },
  orgs:      { clase: 'persistente', sistema: 'mundo',     por: 'organizaciones, rosters y bolsas' },
  gyms:      { clase: 'persistente', sistema: 'gimnasios', por: 'gimnasios, atributos e identidad' },
  coaches:   { clase: 'persistente', sistema: 'equipo',    por: 'entrenadores y sus relaciones' },
  mgrs:      { clase: 'persistente', sistema: 'mánager',   por: 'mánagers y sus relaciones' },
  rank:      { clase: 'derivable',   sistema: 'divisiones',por: 'ranking por organización y división; recalcRank lo rehace desde los peleadores' },
  champs:    { clase: 'persistente', sistema: 'títulos',   por: 'campeón por organización y división' },
  championSeasonStats: { clase: 'persistente', sistema: 'títulos', por: 'oportunidades de título por temporada (tope y sin duplicados)' },
  retiredList: { clase: 'persistente', sistema: 'mundo',   por: 'retirados podados del mundo que la historia todavía nombra' },
  replacementHistory: { clase: 'persistente', sistema: 'matchmaking', por: 'reemplazos de rival (no repetir, registro de la pelea)' },
  news:      { clase: 'persistente', sistema: 'medios',    por: 'noticias del mundo (pantalla Mundo, historial); se podan' },
  weekLog:   { clase: 'derivable',   sistema: 'tiempo',    por: 'lo que pasó en la última semana: lo leen el cierre de semana y el aviso de finanzas; se reescribe cada semana' },
  engineLog: { clase: 'persistente', sistema: 'observabilidad', por: 'bitácora del motor (MATCHMAKING/SCHEDULE); la lee el hook de pelea programada para el origen' },
  settings:  { clase: 'persistente', sistema: 'preferencias', por: 'rendimiento y modo desarrollador' },
  /* --- el jugador y su carrera --- */
  player:    { clase: 'persistente', sistema: 'jugador',   por: 'el peleador del jugador (el mismo objeto que G.fighters[id])' },
  cash:      { clase: 'persistente', sistema: 'economía',  por: 'caja' },
  careerEarn:{ clase: 'persistente', sistema: 'economía',  por: 'ganancias de carrera (legado, final)' },
  spons:     { clase: 'persistente', sistema: 'economía',  por: 'patrocinios activos' },
  contract:  { clase: 'persistente', sistema: 'contratos', por: 'contrato vigente con la organización' },
  mgId:      { clase: 'persistente', sistema: 'mánager',   por: 'mánager actual' },
  team:      { clase: 'persistente', sistema: 'equipo',    por: 'equipo técnico contratado' },
  offers:    { clase: 'persistente', sistema: 'matchmaking', por: 'ofertas vigentes (de pelea y de contrato)' },
  nextFight: { clase: 'persistente', sistema: 'matchmaking', por: 'pelea firmada (con su guarda de validación)' },
  camp:      { clase: 'persistente', sistema: 'campamento',por: 'campamento en curso' },
  flags:     { clase: 'persistente', sistema: 'carrera',   por: 'marcas de carrera; las que no tienen lector están en HUERFANAS' },
  focus:     { clase: 'persistente', sistema: 'entrenamiento', por: 'foco de entrenamiento elegido' },
  trainRec:  { clase: 'persistente', sistema: 'entrenamiento', por: 'registro de entrenamientos (la semana los lee)' },
  mgStats:   { clase: 'persistente', sistema: 'minijuegos', por: 'promedio de ejecución (perfil de carrera, legado)' },
  gameplayLevel: { clase: 'persistente', sistema: 'economía', por: 'nivel de experiencia de juego comprado' },
  story:     { clase: 'persistente', sistema: 'narrativa', por: 'historia: memoria de eventos, feed, cadenas, semillas de rivales' },
  sagas:     { clase: 'persistente', sistema: 'narrativa', por: 'sagas (callout, invitación a campamento)' },
  cl:        { clase: 'persistente', sistema: 'capa CL',   por: 'coaches, deuda, eventos vistos, invitaciones, apodos, observado' },
  tq:        { clase: 'persistente', sistema: 'técnicas',  por: 'árbol de técnicas: puntos, desbloqueadas, maestría' },
  rpg:       { clase: 'persistente', sistema: 'RPG',       por: 'personalidad, filosofías, memoria de rivales, eras, Ultimates, lecciones' },
  meta:      { clase: 'persistente', sistema: 'meta',      por: 'modo, modificadores, desafíos y marcas de ESTA carrera' },
  endgame:   { clase: 'persistente', sistema: 'patrimonio',por: 'propiedades, proyectos e inversiones' },
  soc:       { clase: 'persistente', sistema: 'relaciones',por: 'vida social: intel de rivales, invitaciones, alianzas' },
  socCD:     { clase: 'persistente', sistema: 'relaciones',por: 'enfriamientos de acciones sociales por persona y categoría' },
  socWeek:   { clase: 'derivable',   sistema: 'relaciones',por: 'presupuesto social de la semana; se rehace al cambiar de semana' },
  cas:       { clase: 'persistente', sistema: 'casino',    por: 'casino (intocable): público, visitas, mes' },
  legacyApplied: { clase: 'persistente', sistema: 'legado', por: 'recompensas de legado ya aplicadas a esta carrera (no dos veces)' },
  legacy:    { clase: 'persistente', sistema: 'legado',    por: 'foto de la carrera al retiro' },
  legacyRegistered: { clase: 'persistente', sistema: 'legado', por: 'la carrera ya entró al salón de la fama' },
  legacyResult: { clase: 'persistente', sistema: 'legado', por: 'resultado del registro de legado (pantalla de legado)' },
  legacyStamp: { clase: 'persistente', sistema: 'legado',  por: 'semana en que se tomó la foto de legado' },
  ending:    { clase: 'persistente', sistema: 'legado',    por: 'final de carrera (careerEnding)' },
  __nickIds: { clase: 'derivable',   sistema: 'apodos',    por: 'caché de apodos del mundo; se rehace' },
  __nickAt:  { clase: 'derivable',   sistema: 'apodos',    por: 'semana de la caché de apodos' },
  /* --- interacciones en curso: se guardan para que recargar las retome --- */
  pending:   { clase: 'temporal', sistema: 'eventos', por: 'evento en pantalla (y su texto): sobrevive a recargar' },
  tmpOpp:    { clase: 'temporal', sistema: 'eventos', por: 'rival que nombra el evento en pantalla (fase 13: antes no se guardaba y 12 opciones cambiaban al recargar)' },
  tmpAmt:    { clase: 'temporal', sistema: 'eventos', por: 'monto que ofrece el evento en pantalla' },
  tmpSpon:   { clase: 'temporal', sistema: 'eventos', por: 'patrocinador que ofrece el evento en pantalla' },
  tmpGym:    { clase: 'temporal', sistema: 'eventos', por: 'gimnasio que nombra el evento en pantalla' },
  tmpCoach:  { clase: 'temporal', sistema: 'eventos', por: 'entrenador que nombra el evento en pantalla' },
  tmpCamp:   { clase: 'temporal', sistema: 'eventos', por: 'quién invita al campamento (saga invcamp)' },
  tmpCampElite: { clase: 'temporal', sistema: 'eventos', por: 'si la invitación a campamento es de élite' },
  tmpDivUp:  { clase: 'temporal', sistema: 'eventos', por: 'división a la que propone subir el evento' },
  tmpShort:  { clase: 'temporal', sistema: 'eventos', por: 'rival de la pelea con aviso corto en pantalla' },
  tmpShortW: { clase: 'temporal', sistema: 'eventos', por: 'semanas de aviso de esa pelea' },
  tmpBig:    { clase: 'temporal', sistema: 'eventos', por: 'rival de la pelea grande en pantalla' },
  tmpVet:    { clase: 'temporal', sistema: 'eventos', por: 'veterano que nombra el evento en pantalla' },
  fight:     { clase: 'temporal', sistema: 'combate', por: 'pelea en curso o decidida sin cobrar (fase 13: al cargar se retoma su pantalla)' },
  paid:      { clase: 'temporal', sistema: 'combate', por: 'cerrojo de cobro de la pelea en curso (confirmFight una sola vez)' },
  fightPayout: { clase: 'temporal', sistema: 'combate', por: 'liquidación de la última pelea (pantalla de resultado)' },
  lastPayout:  { clase: 'temporal', sistema: 'economía', por: 'desglose de la última liquidación (tarjeta del resultado; fee lo lee el hook de pelea)' },
  mg:        { clase: 'temporal', sistema: 'minijuegos', por: 'minijuego abierto; se guarda pero al cargar no se retoma (se descarta sin efecto: medido en los 7 del campamento)' },
  lastTrainGame: { clase: 'temporal', sistema: 'minijuegos', por: 'último arcade de entrenamiento, para no repetirlo seguido' },
  /* --- el archivo --- */
  saveVersion: { clase: 'serializacion', sistema: 'guardado', por: 'versión del formato (SAVE_VERSION)' },
  saveId:    { clase: 'serializacion', sistema: 'guardado', por: 'ranura del guardado; fuera de la huella (UNHASHED_KEYS)' },
  stKeys:    { clase: 'serializacion', sistema: 'guardado', por: 'orden de claves con el que se compactaron st/pot/lr (saveExpand lo lee)' },
  _autoTag:  { clase: 'serializacion', sistema: 'guardado', por: 'motivo del último autoguardado: depuración, nadie lo lee (O)' },
  /* --- vestigios: creados vacíos, nadie los escribe ni los lee --- */
  events:       { clase: 'muerta', sistema: 'mundo', por: 'newWorld la crea vacía; nada la escribe ni la lee (ya señalada en A-005)' },
  hist:         { clase: 'muerta', sistema: 'mundo', por: 'ídem' },
  seasonEvents: { clase: 'muerta', sistema: 'mundo', por: 'ídem' },
  mgState:      { clase: 'muerta', sistema: 'minijuegos', por: 'ídem (null)' },
  feed:         { clase: 'muerta', sistema: 'narrativa', por: 'el feed vive en G.story.feed; ésta queda vacía y socCD la recorre por compatibilidad' },
  rosterVersion:{ clase: 'muerta', sistema: 'mundo', por: 'versión del plantel real que se escribe al crear el mundo y nadie consulta' },
};

/* las de sesión son EXACTAMENTE STATE.RUNTIME_KEYS: la prueba lo exige */
const SESION = ['socOut','lastEventOut','simRunning','period','_weekBusy','_autoBusy','_autoStamp','_autoFp','_txDepth',
  '_lastAuto','savedAt','_migratedFrom','_migrationSteps','_saveState','_saveDamage','casG','hookFails','_saveBlocked'];
SESION.forEach(k => { ESTADO[k] = { clase: 'sesion', sistema: 'sesión', por: 'no describe la partida (ver comentario en STATE.RUNTIME_KEYS)' }; });

/* Hojas guardadas que nadie lee. ruta con '*' en lugar de ids. */
const HUERFANAS = [
  { ruta: 'G.fighters.*.rel.interest', clase: 'D', decision: 'eliminar', por: 'defRel lo inicializa en 40 y nada lo lee ni lo mueve; «interés» no tiene semántica en el juego. No se convierte en barra.' },
  { ruta: 'G.player.rel.interest',     clase: 'D', decision: 'eliminar', por: 'ídem (el jugador comparte defRel)' },
  { ruta: 'G.fighters.*.realPeak',     clase: 'D', decision: 'documentar', por: 'dato histórico del plantel real (año de pico); se conserva como dato de origen' },
  { ruta: 'G.gyms[].members',          clase: 'H', decision: 'eliminar', por: 'se crea vacío; la pertenencia vive en f.gym y gymMembers() la calcula' },
  { ruta: 'G.camp.sparDone',           clase: 'H', decision: 'eliminar', por: 'startCamp lo pone en 0; el sparring cuenta sesiones en otro lado' },
  { ruta: 'G.seasonEvents',            clase: 'H', decision: 'eliminar', por: 'ver ESTADO' },
  { ruta: 'G.mgState',                 clase: 'H', decision: 'eliminar', por: 'ver ESTADO' },
  { ruta: 'G.rosterVersion',           clase: 'D', decision: 'eliminar', por: 'ver ESTADO' },
  { ruta: 'G.nextFight.signedAt',      clase: 'D', decision: 'documentar', por: 'fecha de firma; registro de la pelea programada (las semanas de campamento se miden con weeks/wksSigned)' },
  { ruta: 'G.engineLog[].msg',         clase: 'O', decision: 'documentar', por: 'bitácora del motor: se escribe para diagnóstico; la fila la lee el hook por su source' },
  { ruta: 'G.story.version',           clase: 'S', decision: 'documentar', por: 'versión del esquema de la historia; la usa normalizeStory' },
  { ruta: 'G.story.matchupHistory',    clase: 'H', decision: 'eliminar', por: 'normalizeStory la crea y la recorta; nadie la escribe ni la lee' },
  { ruta: 'G.story.trainingHistory',   clase: 'H', decision: 'eliminar', por: 'ídem' },
  { ruta: 'G.story.mediaHistory',      clase: 'H', decision: 'eliminar', por: 'ídem' },
  { ruta: 'G.story.lastEventAt',       clase: 'H', decision: 'eliminar', por: 'ídem' },
  { ruta: 'G.story.*.*.roundBias',     clase: 'D', decision: 'investigar', por: 'aiProfile lo sortea para cada rival y el combate no lo consulta: o se conecta al ritmo por asalto de la IA o se elimina (fase de combate)' },
  { ruta: 'G.cl.coach.*.fav',          clase: 'H', decision: 'eliminar', por: 'CL.coachState lo crea en 0 y nada lo mueve' },
  { ruta: 'G.cl.coach.*.beef',         clase: 'D', decision: 'eliminar', por: 'CL.coachBeef lo escribe, pero el manejador usa el id que viaja en el pendiente' },
  { ruta: 'G.endgame.eventsSeen',      clase: 'H', decision: 'eliminar', por: 'se crea vacío; los eventos del patrimonio usan la veda común' },
  { ruta: 'G.stKeys',                  clase: 'S', decision: 'documentar', por: 'ver ESTADO' },
  { ruta: 'G._autoTag',                clase: 'O', decision: 'documentar', por: 'ver ESTADO' },
  { ruta: 'G.lastPayout.debtPaid',     clase: 'D', decision: 'documentar', por: 'resumen del descuento de deuda; la línea que se muestra ya está en lastPayout.lines' },
  /* fase 14: el mundo nuevo cambió la carrera de muestra y por primera vez salió
     «story_rival_escalation» con rival en G.tmpOpp. La escritura existía antes. */
  { ruta: 'G.nextFight.replacementReason', clase: 'D', decision: 'documentar', por: 'fase 14 (la carrera de muestra tuvo su primer reemplazo): copia del motivo; el que se lee está en replacementHistory[].reason y en la noticia' },
  { ruta: 'G.story.memories[].person', clase: 'D', decision: 'investigar (fase 15)', por: 'rollEvent guarda a quién apuntó la escalada de rivalidad (memoria event_target) y nada la lee: o la consecuencia del evento la usa o se deja de escribir' },
];
/* Fuera del recorrido del mapa (no aparecen en una carrera corta o son marcas
   de G.flags, que es un registro dinámico): verificadas a mano en la fase 13. */
const HUERFANAS_FUERA_DEL_MAPA = [
  { ruta: 'G.flags.lockDiv / lockGym', clase: 'D', decision: 'documentar', por: 'META.applyStartMods las escribe; los consumidores (metaLock) leen el modificador, no la marca' },
  { ruta: 'G.flags.brawler / late',    clase: 'D', decision: 'documentar', por: 'marcas del tipo de peleador elegido al crear; el tipo ya actuó sobre potencial y sesgo' },
  { ruta: 'G.flags.mgrIgnored',        clase: 'D', decision: 'documentar', por: 'fase 12: semana en que se ignoró al mánager; registro' },
  { ruta: 'G.flags.twoDiv',            clase: 'D', decision: 'eliminada', por: 'fase 13: su único lector (el final) lee ahora p.beltDivs; ya no se escribe' },
  { ruta: 'G.meta.ach → legado.runs[].ach', clase: 'D', decision: 'documentar', por: 'logros de ESTA carrera: omite los que ya estaban desbloqueados en otra (checkAch los salta) y runs[].ach no lo lee nadie' },
  { ruta: 'G.legacy.streakBest',       clase: 'E', decision: 'documentar', por: 'lee p.bestStreak, que nadie escribe (siempre 0); y streakBest no lo lee nadie' },
  { ruta: 'G.nextFightPaid',           clase: 'E', decision: 'documentar', por: 'el hook de economía lo prefiere a f.meta, pero nadie lo escribe: alternativa muerta' },
  { ruta: 'G.fight._clLastPlayerAction', clase: 'E', decision: 'documentar', por: 'oppRuleSit lo prefiere a _lastPlayerAction, pero nadie lo escribe: alternativa muerta' },
  { ruta: 'G.retiredList',            clase: 'C', decision: 'documentar', por: 'fase 14: se escribe al retirarse y sólo lo leen la poda, el recorte a 60 y la normalización; ninguna pantalla ni regla lo consulta (el retiro vive en f.retired)' },
  { ruta: 'G.fighters.*.rel.fear',     clase: 'C', decision: 'documentar', por: 'se escribe al ganar; sólo lo leen relSummary/relTags (interfaz): lectura sin consecuencia jugable' },
  /* combate (G.fight: temporal; la carrera de muestra termina sin pelea abierta). Medido en una
     pelea real: 107 claves, 8 sin lector de juego. No se tocan en esta fase (combate). */
  { ruta: 'G.fight.p/o.initialStam',  clase: 'D', decision: 'documentar', por: 'se anota al empezar; nada lo compara después' },
  { ruta: 'G.fight.oppSubLock / momentum', clase: 'H', decision: 'eliminar (fase de combate)', por: 'fightStart los crea en 0 y nada los mueve ni los lee (el «momentum» de los textos es la compostura)' },
  { ruta: 'G.fight.identity.patterns / styleKey / scoreline', clase: 'D', decision: 'investigar (fase de combate)', por: 'el perfil del rival los guarda y la IA usa playerPatterns, adaptation y archetype, no éstos' },
  { ruta: 'G.fight.A (CL.matchup)',    clase: 'D', decision: 'documentar', por: 'copia del análisis del cruce; los consumidores recalculan CL.matchup' },
  { ruta: 'G.fight._clLastOpp',        clase: 'D', decision: 'documentar', por: 'última acción del rival para el efecto visual; nadie la lee después' },
  { ruta: 'G.flags.storyRivalReplyOpp (enganche «memoria»)', clase: 'F', decision: 'documentar', por: 'el enganche event:resolved «memoria» (orden 30) la escribe desde G.tmpOpp, pero «bitácora» (orden 20) ya lo limpió: escritor que llega tarde. El camino vivo es la cadena rival_reply (fase 13)' },
];

const pat = (r) => new RegExp('^' + r.replace(/[.[\]]/g, m => '\\' + m).replace(/\\\*/g, '[^.]+').replace(/\*/g, '[^.]+') + '$');
function huerfana(ruta){
  const r = ruta.replace(/\.(co|f|gym|c|m)\d+(?=\.|$)/g, '.*');
  return HUERFANAS.find(h => pat(h.ruta).test(r) || h.ruta === r) || null;
}
const sesion = () => SESION.slice();

module.exports = { ESTADO, SESION, HUERFANAS, HUERFANAS_FUERA_DEL_MAPA, huerfana, sesion };
