const jwt = require('jsonwebtoken');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const config = require('../config');
const { permissionsFor, ROLE_LABELS } = require('../config/roles');

/**
 * Emite el token de sesión.
 *
 * El token lleva id, usuario y rol. Los permisos NO viajan dentro: se derivan
 * del rol en cada petición, de modo que un cambio en la matriz de permisos
 * surta efecto de inmediato sin esperar a que caduquen los tokens emitidos.
 */
function issueToken(user) {
  return jwt.sign({ sub: user.id, username: user.username, role: user.role }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
    issuer: 'innova-pos',
  });
}

/**
 * Verifica credenciales y devuelve la sesión.
 *
 * Ante usuario inexistente, contraseña incorrecta o cuenta desactivada se
 * responde siempre lo mismo: revelar cuál de los tres falló permitiría
 * enumerar usuarios válidos.
 */
async function login({ username, password }) {
  const credencialesInvalidas = () => ApiError.unauthorized('Usuario o contraseña incorrectos');

  const user = await User.scope('withPassword').findOne({
    where: { username: String(username || '').trim().toLowerCase() },
  });

  if (!user) {
    // Se compara igualmente contra un hash ficticio para que la respuesta tarde
    // lo mismo exista o no el usuario, y no se pueda deducir por temporización.
    await User.hashPassword(String(password || ''));
    throw credencialesInvalidas();
  }

  const passwordOk = await user.verifyPassword(String(password || ''));
  if (!passwordOk) throw credencialesInvalidas();

  if (!user.isActive) {
    throw ApiError.forbidden('Tu cuenta está desactivada. Contacta al administrador.');
  }

  await user.update({ lastLoginAt: new Date() });

  return {
    token: issueToken(user),
    user: user.toJSON(),
    permissions: permissionsFor(user.role),
    roleLabel: ROLE_LABELS[user.role],
  };
}

/**
 * Resuelve el usuario a partir del token. Se relee de la base en cada petición
 * en lugar de confiar en el contenido del token: así una cuenta desactivada o
 * con el rol cambiado deja de tener efecto sin esperar a que el token caduque.
 */
async function resolveSession(token) {
  let payload;
  try {
    payload = jwt.verify(token, config.jwt.secret, { issuer: 'innova-pos' });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Tu sesión expiró. Vuelve a iniciar sesión.');
    }
    throw ApiError.unauthorized('Sesión inválida');
  }

  const user = await User.findByPk(payload.sub);
  if (!user) throw ApiError.unauthorized('Sesión inválida');
  if (!user.isActive) throw ApiError.forbidden('Tu cuenta está desactivada');

  return user;
}

/** Datos de la sesión en curso, para refrescar el estado del cliente. */
function describeSession(user) {
  return {
    user: user.toJSON(),
    permissions: permissionsFor(user.role),
    roleLabel: ROLE_LABELS[user.role],
  };
}

async function changeOwnPassword(user, { currentPassword, newPassword }) {
  const conHash = await User.scope('withPassword').findByPk(user.id);

  const actualOk = await conHash.verifyPassword(String(currentPassword || ''));
  if (!actualOk) {
    throw ApiError.unprocessable('La contraseña actual no es correcta', [
      { field: 'currentPassword', message: 'Contraseña incorrecta' },
    ]);
  }

  await conHash.update({ passwordHash: await User.hashPassword(newPassword) });
  return true;
}

module.exports = { login, resolveSession, describeSession, changeOwnPassword, issueToken };
