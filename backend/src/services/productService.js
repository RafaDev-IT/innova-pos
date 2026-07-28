const { Op, literal } = require('sequelize');
const { Product } = require('../models');
const ApiError = require('../utils/ApiError');
const { toAmountString } = require('../utils/money');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Escapa los comodines de LIKE para que un usuario que teclee "50%" busque ese
 * texto literal y no todo lo que empiece con "50".
 */
function escapeLike(term) {
  return term.replace(/[\\%_]/g, (match) => `\\${match}`);
}

/**
 * Busca productos por nombre o código de barras.
 *
 * El orden prioriza la coincidencia exacta de código de barras: en un POS lo
 * habitual es escanear, y el producto escaneado debe quedar siempre primero.
 */
async function search({ query = '', limit = DEFAULT_LIMIT, offset = 0, includeInactive = false } = {}) {
  const term = String(query || '').trim();
  const safeLimit = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  const where = {};
  if (!includeInactive) where.isActive = true;

  if (term) {
    const pattern = `%${escapeLike(term)}%`;
    where[Op.or] = [{ name: { [Op.iLike]: pattern } }, { barcode: { [Op.iLike]: pattern } }];
  }

  const order = term
    ? [
        // `replacements` no está disponible en literal dentro de order, así que
        // el término se pasa por bind del propio WHERE; aquí solo se compara
        // contra la columna con el patrón ya escapado por Sequelize.
        [literal(`CASE WHEN "Product"."barcode" = ${Product.sequelize.escape(term)} THEN 0 ELSE 1 END`), 'ASC'],
        ['name', 'ASC'],
      ]
    : [['name', 'ASC']];

  const { rows, count } = await Product.findAndCountAll({
    where,
    order,
    limit: safeLimit,
    offset: safeOffset,
  });

  return {
    items: rows,
    pagination: {
      total: count,
      limit: safeLimit,
      offset: safeOffset,
      hasMore: safeOffset + rows.length < count,
    },
  };
}

async function findById(id) {
  const product = await Product.findByPk(id);
  if (!product) throw ApiError.notFound(`No existe un producto con id ${id}`);
  return product;
}

async function findByBarcode(barcode) {
  const product = await Product.findOne({ where: { barcode: String(barcode).trim() } });
  if (!product) throw ApiError.notFound(`No existe un producto con código de barras ${barcode}`);
  return product;
}

/**
 * Verifica que el código de barras esté libre. Se comprueba antes de escribir
 * para devolver un mensaje claro; la restricción única de la base sigue siendo
 * la garantía real ante escrituras concurrentes (la captura el errorHandler).
 */
async function assertBarcodeAvailable(barcode, excludeId = null) {
  const where = { barcode: String(barcode).trim() };
  if (excludeId) where.id = { [Op.ne]: excludeId };

  const existing = await Product.findOne({ where });
  if (existing) {
    throw ApiError.conflict('El código de barras ya está registrado en otro producto', [
      { field: 'barcode', message: `Ya lo usa el producto "${existing.name}"` },
    ]);
  }
}

async function create({ name, barcode, price, description = null, isActive = true }) {
  await assertBarcodeAvailable(barcode);

  return Product.create({
    name,
    barcode,
    price: toAmountString(price),
    description,
    isActive,
  });
}

async function update(id, payload) {
  const product = await findById(id);

  if (payload.barcode !== undefined && payload.barcode !== product.barcode) {
    await assertBarcodeAvailable(payload.barcode, product.id);
  }

  const changes = {};
  if (payload.name !== undefined) changes.name = payload.name;
  if (payload.barcode !== undefined) changes.barcode = payload.barcode;
  if (payload.price !== undefined) changes.price = toAmountString(payload.price);
  if (payload.description !== undefined) changes.description = payload.description;
  if (payload.isActive !== undefined) changes.isActive = payload.isActive;

  await product.update(changes);
  return product;
}

/**
 * Baja lógica. El registro permanece en la tabla porque puede estar
 * referenciado por ventas ya emitidas, que no deben perder su detalle.
 */
async function remove(id) {
  const product = await findById(id);
  await product.destroy();
  return product;
}

module.exports = {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  search,
  findById,
  findByBarcode,
  create,
  update,
  remove,
};
