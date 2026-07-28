/**
 * Envuelve un controlador async para que cualquier promesa rechazada llegue al
 * middleware de errores. Sin esto, Express 4 deja los `throw` dentro de async
 * como unhandled rejections y la petición queda colgada.
 */
module.exports = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
