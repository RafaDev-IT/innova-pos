const { ValidationError, UniqueConstraintError, ForeignKeyConstraintError, DatabaseError } = require('sequelize');
const ApiError = require('../utils/ApiError');

/**
 * Traduce los errores propios de Sequelize a `ApiError`, para que el cliente
 * reciba mensajes útiles en lugar de filtrarse detalles del motor de base de datos.
 */
function normalizeError(err) {
  if (err instanceof ApiError) return err;

  if (err instanceof UniqueConstraintError) {
    const details = err.errors.map((e) => ({ field: e.path, message: `El valor "${e.value}" ya está registrado` }));
    return ApiError.conflict('Ya existe un registro con esos datos', details);
  }

  if (err instanceof ForeignKeyConstraintError) {
    return ApiError.badRequest('La referencia indicada no existe');
  }

  if (err instanceof ValidationError) {
    const details = err.errors.map((e) => ({ field: e.path, message: e.message }));
    return ApiError.unprocessable('Los datos enviados no son válidos', details);
  }

  if (err instanceof DatabaseError) {
    return ApiError.internal('Error al consultar la base de datos');
  }

  if (err.type === 'entity.parse.failed') {
    return ApiError.badRequest('El cuerpo de la petición no es un JSON válido');
  }

  return null;
}

// Express identifica el middleware de errores por su aridad de 4 argumentos:
// `next` es obligatorio aunque no se use.
// eslint-disable-next-line no-unused-vars
module.exports = (err, req, res, next) => {
  const normalized = normalizeError(err) || ApiError.internal();

  // Los errores inesperados (500 no operacionales) sí se registran completos:
  // son bugs, no flujos de negocio esperados.
  if (normalized.statusCode >= 500) {
    // eslint-disable-next-line no-console
    console.error('[error]', err);
  }

  res.status(normalized.statusCode).json({
    success: false,
    error: {
      message: normalized.message,
      ...(normalized.details ? { details: normalized.details } : {}),
    },
  });
};
