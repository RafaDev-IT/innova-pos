const saleService = require('../services/saleService');
const audit = require('../services/auditService');
const asyncHandler = require('../utils/asyncHandler');

const create = asyncHandler(async (req, res) => {
  // El cajero se toma de la sesión, nunca del cuerpo de la petición: si
  // viniera del cliente, cualquiera podría registrar ventas a nombre de otro.
  const sale = await saleService.create({ items: req.body.items, user: req.user });

  await audit.record(req, {
    action: audit.ACTIONS.SALE_CREATE,
    entityType: 'sale',
    entityId: sale.id,
    summary: `Registró la venta ${sale.folio} por ${sale.total} (${sale.itemCount} artículos)`,
    metadata: { folio: sale.folio, total: sale.total, itemCount: sale.itemCount },
  });

  res.status(201).json({ success: true, data: sale });
});

const getById = asyncHandler(async (req, res) => {
  const sale = await saleService.findById(req.params.id);
  res.json({ success: true, data: sale });
});

const list = asyncHandler(async (req, res) => {
  const { items, pagination } = await saleService.list({
    limit: req.query.limit,
    offset: req.query.offset,
    folio: req.query.folio,
    from: req.query.from,
    to: req.query.to,
    userId: req.query.userId,
    status: req.query.status,
  });
  res.json({ success: true, data: items, meta: pagination });
});

const cancel = asyncHandler(async (req, res) => {
  const sale = await saleService.cancel(req.params.id, {
    reason: req.body.reason,
    user: req.user,
  });

  await audit.record(req, {
    action: audit.ACTIONS.SALE_CANCEL,
    entityType: 'sale',
    entityId: sale.id,
    summary: `Canceló la venta ${sale.folio} por ${sale.total}: ${sale.cancelReason}`,
    metadata: { folio: sale.folio, total: sale.total, reason: sale.cancelReason },
  });

  res.json({ success: true, data: sale });
});

module.exports = { create, getById, list, cancel };
