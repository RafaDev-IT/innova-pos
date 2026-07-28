const authService = require('../services/authService');
const audit = require('../services/auditService');
const asyncHandler = require('../utils/asyncHandler');
const { ROLE_LABELS } = require('../config/roles');

const login = asyncHandler(async (req, res) => {
  const session = await authService.login(req.body);

  // Solo se registran los accesos correctos. Anotar los intentos fallidos
  // guardaría contraseñas tecleadas por error en el campo de usuario.
  await audit.record(req, {
    action: audit.ACTIONS.LOGIN,
    entityType: 'user',
    entityId: session.user.id,
    summary: `${session.user.name} inició sesión`,
    user: session.user,
  });

  res.json({ success: true, data: session });
});

/** Sesión en curso. El cliente la consulta al arrancar para restaurar estado. */
const me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: authService.describeSession(req.user) });
});

const changePassword = asyncHandler(async (req, res) => {
  await authService.changeOwnPassword(req.user, req.body);
  res.json({ success: true, data: { message: 'Contraseña actualizada' } });
});

/**
 * Cierre de sesión.
 *
 * Con tokens sin estado el cierre real ocurre en el cliente al descartar el
 * token; el endpoint existe para que el cliente tenga un punto único al que
 * llamar y para poder registrarlo en la bitácora.
 */
const logout = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: { message: 'Sesión cerrada' } });
});

/** Catálogo de roles, para poblar los selectores del cliente. */
const roles = asyncHandler(async (_req, res) => {
  res.json({
    success: true,
    data: Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label })),
  });
});

module.exports = { login, me, changePassword, logout, roles };
