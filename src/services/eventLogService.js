const EventLog = require('../models/EventLog');

/**
 * Registra una entrada en el historial/auditoría del evento.
 * La ejecución es asíncrona y atrapa errores para nunca interrumpir el flujo principal.
 */
async function logEventActivity({
  eventId,
  actor,
  actorType = 'user',
  category,
  action,
  description,
  metadata
}) {
  if (!eventId || !category || !action || !description) {
    return;
  }

  try {
    let actorData = undefined;
    if (actor) {
      actorData = {
        id: actor._id || actor.id || undefined,
        name: actor.name || undefined,
        email: actor.email || undefined,
        role: actor.role || undefined
      };
    }

    await EventLog.create({
      event: eventId,
      actorType,
      actor: actorData,
      category,
      action,
      description,
      metadata: metadata || undefined
    });
  } catch (err) {
    console.error('[EventLogService] Error al guardar log de actividad:', err.message);
  }
}

module.exports = {
  logEventActivity
};
