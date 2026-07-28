const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

/**
 * Corta la petición si las reglas de `express-validator` declaradas en la ruta
 * fallaron, devolviendo todos los errores juntos (no solo el primero) para que
 * el formulario del frontend pueda marcarlos de una sola vez.
 */
module.exports = (req, _res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const details = result.array().map((e) => ({
    field: e.path,
    message: e.msg,
  }));

  return next(ApiError.unprocessable('Los datos enviados no son válidos', details));
};
