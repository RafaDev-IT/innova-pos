const saleService = require('../services/saleService');
const asyncHandler = require('../utils/asyncHandler');

const create = asyncHandler(async (req, res) => {
  const sale = await saleService.create({ items: req.body.items });
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
  });
  res.json({ success: true, data: items, meta: pagination });
});

module.exports = { create, getById, list };
