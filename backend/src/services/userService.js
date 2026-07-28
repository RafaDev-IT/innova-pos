const { Op } = require('sequelize');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const { ROLES } = require('../config/roles');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function escapeLike(term) {
  return term.replace(/[\\%_]/g, (match) => `\\${match}`);
}

async function search({ query = '', role = null, limit = DEFAULT_LIMIT, offset = 0 } = {}) {
  const term = String(query || '').trim();
  const safeLimit = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  const where = {};
  if (role) where.role = role;
  if (term) {
    const pattern = `%${escapeLike(term)}%`;
    where[Op.or] = [{ name: { [Op.iLike]: pattern } }, { username: { [Op.iLike]: pattern } }];
  }

  const { rows, count } = await User.findAndCountAll({
    where,
    order: [
      ['isActive', 'DESC'],
      ['name', 'ASC'],
    ],
    limit: safeLimit,
    offset: safeOffset,
  });

  return {
    items: rows,
    pagination: { total: count, limit: safeLimit, offset: safeOffset, hasMore: safeOffset + rows.length < count },
  };
}

async function findById(id) {
  const user = await User.findByPk(id);
  if (!user) throw ApiError.notFound(`No existe un usuario con id ${id}`);
  return user;
}

async function assertUsernameAvailable(username, excludeId = null) {
  const where = { username: String(username).trim().toLowerCase() };
  if (excludeId) where.id = { [Op.ne]: excludeId };

  if (await User.findOne({ where })) {
    throw ApiError.conflict('El nombre de usuario ya está en uso', [
      { field: 'username', message: 'Elige otro nombre de usuario' },
    ]);
  }
}

async function create({ name, username, email = null, password, role = ROLES.CASHIER, isActive = true }) {
  await assertUsernameAvailable(username);

  return User.create({
    name,
    username,
    email,
    role,
    isActive,
    passwordHash: await User.hashPassword(password),
  });
}

/**
 * Actualiza un usuario.
 *
 * @param {number} id
 * @param {object} payload
 * @param {object} actor Usuario que ejecuta el cambio, para las salvaguardas.
 */
async function update(id, payload, actor) {
  const user = await findById(id);

  if (payload.username !== undefined && payload.username !== user.username) {
    await assertUsernameAvailable(payload.username, user.id);
  }

  // Salvaguardas contra el error de dejarse fuera del sistema: nadie puede
  // quitarse a sí mismo el rol de administrador ni desactivarse su propia
  // cuenta. Sin esto, un descuido deja el sistema sin quien lo administre.
  if (actor && actor.id === user.id) {
    if (payload.role !== undefined && payload.role !== user.role) {
      throw ApiError.badRequest('No puedes cambiar tu propio rol');
    }
    if (payload.isActive === false) {
      throw ApiError.badRequest('No puedes desactivar tu propia cuenta');
    }
  }

  // Y en cualquier caso debe quedar al menos un administrador activo.
  const dejaDeSerAdmin =
    user.role === ROLES.ADMIN && ((payload.role && payload.role !== ROLES.ADMIN) || payload.isActive === false);

  if (dejaDeSerAdmin) await assertOtroAdminActivo(user.id);

  const changes = {};
  if (payload.name !== undefined) changes.name = payload.name;
  if (payload.username !== undefined) changes.username = payload.username;
  if (payload.email !== undefined) changes.email = payload.email;
  if (payload.role !== undefined) changes.role = payload.role;
  if (payload.isActive !== undefined) changes.isActive = payload.isActive;
  if (payload.password) changes.passwordHash = await User.hashPassword(payload.password);

  await user.update(changes);
  return user;
}

/** Verifica que exista otro administrador activo además del indicado. */
async function assertOtroAdminActivo(excludeId) {
  const otros = await User.count({
    where: { role: ROLES.ADMIN, isActive: true, id: { [Op.ne]: excludeId } },
  });

  if (otros === 0) {
    throw ApiError.badRequest(
      'Debe quedar al menos un administrador activo. Asigna el rol a otro usuario antes de continuar.',
    );
  }
}

/**
 * Baja lógica. El usuario permanece porque sus ventas y sus entradas de
 * bitácora lo referencian.
 */
async function remove(id, actor) {
  const user = await findById(id);

  if (actor && actor.id === user.id) {
    throw ApiError.badRequest('No puedes eliminar tu propia cuenta');
  }

  if (user.role === ROLES.ADMIN) await assertOtroAdminActivo(user.id);

  await user.destroy();
  return user;
}

module.exports = { DEFAULT_LIMIT, MAX_LIMIT, search, findById, create, update, remove };
