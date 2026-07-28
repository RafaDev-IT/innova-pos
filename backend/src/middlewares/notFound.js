const ApiError = require('../utils/ApiError');

module.exports = (req, _res, next) => {
  next(ApiError.notFound(`Ruta no encontrada: ${req.method} ${req.originalUrl}`));
};
