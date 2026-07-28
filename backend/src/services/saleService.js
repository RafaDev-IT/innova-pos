const { Op, QueryTypes, literal } = require('sequelize');
const { sequelize, Sale, SaleItem, Product } = require('../models');
const ApiError = require('../utils/ApiError');
const { toCents, fromCents, MAX_AMOUNT, CENTS_PER_UNIT } = require('../utils/money');
const config = require('../config');

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

/**
 * Histórico de ventas con filtros.
 *
 * El folio se busca por coincidencia parcial porque el operador suele recordar
 * los últimos dígitos del ticket que tiene en la mano, no el folio completo.
 */
async function list({ limit = DEFAULT_LIMIT, offset = 0, folio = null, from = null, to = null, userId = null, status = null } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  const where = {};
  if (status) where.status = status;
  if (userId) where.userId = Number(userId);

  if (folio) {
    const termino = String(folio).trim().replace(/[\\%_]/g, (m) => `\\${m}`);
    where.folio = { [Op.iLike]: `%${termino}%` };
  }

  // Las fechas llegan como día local del negocio; se convierten al instante UTC
  // que les corresponde para no arrastrar el desfase de zona horaria.
  if (from || to) {
    const TZ = config.businessTimezone;
    where.soldAt = {};
    if (from) {
      where.soldAt[Op.gte] = literal(`TIMESTAMP '${from} 00:00:00' AT TIME ZONE '${TZ}'`);
    }
    if (to) {
      where.soldAt[Op.lt] = literal(`TIMESTAMP '${to} 00:00:00' AT TIME ZONE '${TZ}' + INTERVAL '1 day'`);
    }
  }

  const { rows, count } = await Sale.findAndCountAll({
    where,
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

/**
 * Cancela una venta.
 *
 * No se borra: se marca. Borrarla dejaría un hueco en la numeración de folios y
 * haría imposible explicar después por qué falta el V-000512, que es justo lo
 * que se pregunta en una auditoría.
 *
 * Las ventas canceladas quedan fuera de los totales porque todas las consultas
 * de análisis filtran por estado completado.
 */
async function cancel(id, { reason, user }) {
  const sale = await findById(id);

  if (sale.status === 'cancelled') {
    throw ApiError.conflict('Esta venta ya estaba cancelada', [
      { field: 'status', message: `Cancelada el ${sale.cancelledAt.toISOString().slice(0, 10)}` },
    ]);
  }

  const motivo = String(reason || '').trim();
  if (!motivo) {
    throw ApiError.unprocessable('Indica el motivo de la cancelación', [
      { field: 'reason', message: 'El motivo es obligatorio' },
    ]);
  }

  await sale.update({
    status: 'cancelled',
    cancelledAt: new Date(),
    cancelledById: user ? user.id : null,
    cancelledByName: user ? user.name : null,
    cancelReason: motivo,
  });

  return sale.reload({
    include: [{ model: SaleItem, as: 'items' }],
    order: [[{ model: SaleItem, as: 'items' }, 'id', 'ASC']],
  });
}

module.exports = {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  MAX_ITEMS_PER_SALE,
  create,
  findById,
  list,
  cancel,
};
