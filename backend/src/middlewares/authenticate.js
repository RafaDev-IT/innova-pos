const authService = require('../services/authService');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { hasPermission } = require('../config/roles');

/**
 * Exige una sesión válida y deja el usuario en `req.user`.
 *
 * El usuario se relee de la base en cada petición en lugar de confiar en el
 * contenido del token: así desactivar una cuenta o cambiarle el rol surte
 * efecto de inmediato, sin esperar a que caduque el token ya emitido.
 */
const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw ApiError.unauthorized('Necesitas iniciar sesión para realizar esta acción');
  }

  req.user = await authService.resolveSession(token);
  next();
});

/**
 * Exige un permiso concreto. Se comprueba siempre en el servidor: lo que el
 * frontend hace con los permisos es ocultar botones, no proteger datos.
 *
 * @param {string} permission Constante de config/roles.
 */
function authorize(permission) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());

    if (!hasPermission(req.user.role, permission)) {
      return next(
        ApiError.forbidden('Tu rol no tiene permiso para realizar esta acción', [
          { field: 'permission', message: `Se requiere el permiso "${permission}"` },
        ]),
      );
    }

    return next();
  };
}

module.exports = { authenticate, authorize };
