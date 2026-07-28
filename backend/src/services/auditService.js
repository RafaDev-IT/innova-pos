const { Op } = require('sequelize');
const { AuditEntry } = require('../models');

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 200;

/**
 * Catálogo de acciones registrables.
 *
 * Se declaran como constantes en lugar de escribir la cadena en cada llamada:
 * una errata en "prodcut.create" pasaría desapercibida y rompería los filtros
 * de la bitácora sin que nadie lo note.
 */
const ACTIONS = {
  LOGIN: 'auth.login',

  PRODUCT_CREATE: 'product.create',
  PRODUCT_UPDATE: 'product.update',
  PRODUCT_DELETE: 'product.delete',

  SALE_CREATE: 'sale.create',
  SALE_CANCEL: 'sale.cancel',

  USER_CREATE: 'user.create',
  USER_UPDATE: 'user.update',
  USER_DELETE: 'user.delete',
};

/** Etiquetas legibles para la interfaz, agrupadas por entidad. */
const ACTION_LABELS = {
  [ACTIONS.LOGIN]: 'Inicio de sesión',
  [ACTIONS.PRODUCT_CREATE]: 'Alta de producto',
  [ACTIONS.PRODUCT_UPDATE]: 'Edición de producto',
  [ACTIONS.PRODUCT_DELETE]: 'Baja de producto',
  [ACTIONS.SALE_CREATE]: 'Venta registrada',
  [ACTIONS.SALE_CANCEL]: 'Venta cancelada',
  [ACTIONS.USER_CREATE]: 'Alta de usuario',
  [ACTIONS.USER_UPDATE]: 'Edición de usuario',
  [ACTIONS.USER_DELETE]: 'Baja de usuario',
};

/**
 * Registra un hecho en la bitácora.
 *
 * Nunca propaga su error: si el registro falla no debe tumbar la operación que
 * lo originó. Una venta cobrada que no se pudo auditar sigue siendo preferible
 * a una venta perdida por un fallo al escribir la bitácora. El fallo sí se
 * reporta por consola para que no pase inadvertido.
 *
 * @param {object} req Petición Express, de donde se toman usuario e IP.
 * @param {object} entry { action, entityType, entityId, summary, metadata }
 */
async function record(req, { action, entityType = null, entityId = null, summary, metadata = null, user = null }) {
  try {
    // En el inicio de sesión todavía no existe req.user, así que el usuario
    // puede venir explícito.
    const actor = user || (req && req.user);

    await AuditEntry.create({
      userId: actor ? actor.id : null,
      userName: actor ? actor.name : null,
      action,
      entityType,
      entityId,
      summary,
      metadata,
      ipAddress: req ? extractIp(req) : null,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[audit] no se pudo registrar la acción', action, error.message);
  }
}

/** IP del cliente, respetando el proxy inverso si lo hay. */
function extractIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim().slice(0, 45);
  return (req.ip || '').slice(0, 45) || null;
}

async function search({ limit = DEFAULT_LIMIT, offset = 0, userId = null, action = null, entityType = null } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  const where = {};
  if (userId) where.userId = Number(userId);
  if (action) where.action = action;
  if (entityType) where.entityType = entityType;

  const { rows, count } = await AuditEntry.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    limit: safeLimit,
    offset: safeOffset,
  });

  return {
    items: rows,
    pagination: { total: count, limit: safeLimit, offset: safeOffset, hasMore: safeOffset + rows.length < count },
  };
}

/** Últimos movimientos, para el bloque de actividad reciente del tablero. */
async function recent(limit = 12) {
  return AuditEntry.findAll({
    order: [['created_at', 'DESC']],
    limit: Math.min(Math.max(Number(limit) || 12, 1), 50),
  });
}

/** Actividad del período, para contar movimientos por usuario en reportes. */
async function countByUser({ from, to }) {
  return AuditEntry.findAll({
    attributes: [
      'userId',
      'userName',
      [AuditEntry.sequelize.fn('COUNT', AuditEntry.sequelize.col('id')), 'total'],
    ],
    where: { createdAt: { [Op.between]: [from, to] } },
    group: ['user_id', 'user_name'],
    order: [[AuditEntry.sequelize.literal('total'), 'DESC']],
    raw: true,
  });
}

module.exports = { ACTIONS, ACTION_LABELS, record, search, recent, countByUser };
