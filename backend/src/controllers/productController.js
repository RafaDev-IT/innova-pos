const productService = require('../services/productService');
const audit = require('../services/auditService');
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

  await audit.record(req, {
    action: audit.ACTIONS.PRODUCT_CREATE,
    entityType: 'product',
    entityId: product.id,
    summary: `Registró el producto "${product.name}" a ${product.price}`,
    metadata: { barcode: product.barcode, price: product.price },
  });

  res.status(201).json({ success: true, data: product });
});

const update = asyncHandler(async (req, res) => {
  // Se toma una foto del estado previo para poder registrar qué cambió: sin el
  // valor anterior, "editó el precio" no dice nada útil al revisar la bitácora.
  const antes = await productService.findById(req.params.id);
  const previo = { name: antes.name, price: antes.price, barcode: antes.barcode };

  const product = await productService.update(req.params.id, req.body);

  const cambios = describirCambios(previo, product);
  await audit.record(req, {
    action: audit.ACTIONS.PRODUCT_UPDATE,
    entityType: 'product',
    entityId: product.id,
    summary: cambios
      ? `Editó "${product.name}": ${cambios}`
      : `Editó el producto "${product.name}"`,
    metadata: { before: previo, after: { name: product.name, price: product.price, barcode: product.barcode } },
  });

  res.json({ success: true, data: product });
});

/** Describe en una frase qué campos relevantes cambiaron. */
function describirCambios(antes, despues) {
  const partes = [];
  if (antes.price !== despues.price) partes.push(`precio ${antes.price} → ${despues.price}`);
  if (antes.name !== despues.name) partes.push(`nombre "${antes.name}" → "${despues.name}"`);
  if (antes.barcode !== despues.barcode) partes.push(`código ${antes.barcode} → ${despues.barcode}`);
  return partes.join(', ');
}

const remove = asyncHandler(async (req, res) => {
  const product = await productService.remove(req.params.id);

  await audit.record(req, {
    action: audit.ACTIONS.PRODUCT_DELETE,
    entityType: 'product',
    entityId: product.id,
    summary: `Dio de baja el producto "${product.name}"`,
    metadata: { barcode: product.barcode, price: product.price },
  });

  res.status(204).send();
});

module.exports = { list, getById, getByBarcode, create, update, remove };
