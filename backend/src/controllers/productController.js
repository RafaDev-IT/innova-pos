const productService = require('../services/productService');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Capa fina: traduce HTTP a llamadas de servicio y de vuelta. Toda la lógica de
 * negocio vive en `productService`, de modo que sea reutilizable y testeable
 * sin levantar Express.
 */

const list = asyncHandler(async (req, res) => {
  const { items, pagination } = await productService.search({
    query: req.query.q,
    limit: req.query.limit,
    offset: req.query.offset,
    includeInactive: req.query.includeInactive,
  });

  res.json({ success: true, data: items, meta: pagination });
});

const getById = asyncHandler(async (req, res) => {
  const product = await productService.findById(req.params.id);
  res.json({ success: true, data: product });
});

const getByBarcode = asyncHandler(async (req, res) => {
  const product = await productService.findByBarcode(req.params.barcode);
  res.json({ success: true, data: product });
});

const create = asyncHandler(async (req, res) => {
  const product = await productService.create(req.body);
  res.status(201).json({ success: true, data: product });
});

const update = asyncHandler(async (req, res) => {
  const product = await productService.update(req.params.id, req.body);
  res.json({ success: true, data: product });
});

const remove = asyncHandler(async (req, res) => {
  await productService.remove(req.params.id);
  res.status(204).send();
});

module.exports = { list, getById, getByBarcode, create, update, remove };
