/**
 * Error de dominio con código HTTP asociado. Permite que los servicios lancen
 * errores semánticos y que un único middleware los traduzca a respuestas HTTP,
 * en lugar de repartir `res.status(...)` por toda la capa de negocio.
 */
class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, details) {
    return new ApiError(400, message, details);
  }

  /** 401: no hay sesión, o la que hay no es válida. */
  static unauthorized(message = 'Necesitas iniciar sesión', details) {
    return new ApiError(401, message, details);
  }

  /** 403: hay sesión, pero no alcanza para esta acción. */
  static forbidden(message = 'No tienes permiso para realizar esta acción', details) {
    return new ApiError(403, message, details);
  }

  static notFound(message = 'Recurso no encontrado', details) {
    return new ApiError(404, message, details);
  }

  static conflict(message, details) {
    return new ApiError(409, message, details);
  }

  static unprocessable(message, details) {
    return new ApiError(422, message, details);
  }

  static internal(message = 'Error interno del servidor', details) {
    return new ApiError(500, message, details);
  }
}

module.exports = ApiError;
