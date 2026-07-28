const { Op, QueryTypes } = require('sequelize');
const { sequelize, Sale, SaleItem, Product } = require('../models');
const ApiError = require('../utils/ApiError');
const { toCents, fromCents, MAX_AMOUNT, CENTS_PER_UNIT } = require('../utils/money');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_ITEMS_PER_SALE = 200;

/**
 * Reserva el siguiente folio. Se usa una secuencia de PostgreSQL en lugar de
 * contar las ventas existentes: nextval es atómico, de modo que dos cajas
 * vendiendo simultáneamente nunca reciben el mismo número.
 */
async function nextFolio(transaction) {
  const [row] = await sequelize.query("SELECT nextval('sales_folio_seq') AS value", {
    type: QueryTypes.SELECT,
    transaction,
  });
  return `V-${String(row.value).padStart(6, '0')}`;
}

/**
 * Construye los renglones de la venta a partir de lo enviado por el cliente.
 *
 * El precio y los totales se resuelven aquí, en el servidor: del cliente solo
 * se acepta el precio unitario (que el requisito permite editar dentro de la
 * venta) y la cantidad. Nunca se confía en un total calculado en el navegador.
 */
function buildLines(items, productsById) {
  let subtotalCents = 0;
  let unitCount = 0;

  const lines = items.map((item, index) => {
    const product = productsById.get(Number(item.productId));

    if (!product) {
      throw ApiError.badRequest(`El producto con id ${item.productId} no existe o está dado de baja`, [
        { field: `items[${index}].productId`, message: 'Producto no disponible' },
      ]);
    }

    const quantity = item.quantity === undefined ? 1 : Number(item.quantity);

    // Si no se envía precio, se toma el vigente del catálogo. Si se envía, es
    // porque el cajero lo ajustó en la venta y ese es el que se cobra.
    const rawPrice = item.unitPrice === undefined || item.unitPrice === null ? product.price : item.unitPrice;
    const unitPriceCents = toCents(rawPrice);

    if (unitPriceCents === null || unitPriceCents < 0) {
      throw ApiError.unprocessable('El precio de un producto de la venta no es válido', [
        { field: `items[${index}].unitPrice`, message: 'El precio debe ser un número no negativo' },
      ]);
    }

    const lineTotalCents = unitPriceCents * quantity;
    subtotalCents += lineTotalCents;
    unitCount += quantity;

    return {
      productId: product.id,
      // Copia del producto al momento de la venta: preserva el histórico.
      productName: product.name,
      productBarcode: product.barcode,
      unitPrice: fromCents(unitPriceCents),
      quantity,
      lineTotal: fromCents(lineTotalCents),
    };
  });

  if (subtotalCents > Math.round(MAX_AMOUNT * CENTS_PER_UNIT)) {
    throw ApiError.unprocessable(`El total de la venta excede el máximo permitido (${MAX_AMOUNT})`);
  }

  return { lines, subtotalCents, unitCount };
}

/**
 * Registra una venta con su detalle.
 *
 * Todo ocurre dentro de una única transacción: si falla la inserción de
 * cualquier renglón, la cabecera tampoco queda guardada. Una venta a medias
 * es peor que ninguna venta.
 */
async function create({ items, user = null }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw ApiError.badRequest('La venta debe incluir al menos un producto');
  }

  if (items.length > MAX_ITEMS_PER_SALE) {
    throw ApiError.badRequest(`Una venta admite como máximo ${MAX_ITEMS_PER_SALE} renglones`);
  }

  const productIds = [...new Set(items.map((item) => Number(item.productId)))];
  const products = await Product.findAll({ where: { id: { [Op.in]: productIds }, isActive: true } });
  const productsById = new Map(products.map((product) => [product.id, product]));

  const { lines, subtotalCents, unitCount } = buildLines(items, productsById);

  return sequelize.transaction(async (transaction) => {
    const folio = await nextFolio(transaction);

    const sale = await Sale.create(
      {
        folio,
        subtotal: fromCents(subtotalCents),
        total: fromCents(subtotalCents),
        itemCount: unitCount,
        status: 'completed',
        soldAt: new Date(),
        userId: user ? user.id : null,
        userName: user ? user.name : null,
      },
      { transaction },
    );

    await SaleItem.bulkCreate(
      lines.map((line) => ({ ...line, saleId: sale.id })),
      { transaction, validate: true },
    );

    // Se relee dentro de la misma transacción para devolver la venta ya
    // completa, con los renglones tal como quedaron persistidos.
    return Sale.findByPk(sale.id, {
      include: [{ model: SaleItem, as: 'items' }],
      order: [[{ model: SaleItem, as: 'items' }, 'id', 'ASC']],
      transaction,
    });
  });
}

async function findById(id) {
  const sale = await Sale.findByPk(id, {
    include: [{ model: SaleItem, as: 'items' }],
    order: [[{ model: SaleItem, as: 'items' }, 'id', 'ASC']],
  });

  if (!sale) throw ApiError.notFound(`No existe una venta con id ${id}`);
  return sale;
}

async function list({ limit = DEFAULT_LIMIT, offset = 0 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  const { rows, count } = await Sale.findAndCountAll({
    order: [['sold_at', 'DESC']],
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

module.exports = {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  MAX_ITEMS_PER_SALE,
  create,
  findById,
  list,
};
