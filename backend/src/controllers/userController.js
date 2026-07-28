const userService = require('../services/userService');
const asyncHandler = require('../utils/asyncHandler');

const list = asyncHandler(async (req, res) => {
  const { items, pagination } = await userService.search({
    query: req.query.q,
    role: req.query.role,
    limit: req.query.limit,
    offset: req.query.offset,
  });
  res.json({ success: true, data: items, meta: pagination });
});

const getById = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await userService.findById(req.params.id) });
});

const create = asyncHandler(async (req, res) => {
  const user = await userService.create(req.body);
  res.status(201).json({ success: true, data: user });
});

const update = asyncHandler(async (req, res) => {
  // Se pasa el usuario en sesión para que el servicio pueda impedir que alguien
  // se quite a sí mismo el rol o se desactive.
  const user = await userService.update(req.params.id, req.body, req.user);
  res.json({ success: true, data: user });
});

const remove = asyncHandler(async (req, res) => {
  await userService.remove(req.params.id, req.user);
  res.status(204).send();
});

module.exports = { list, getById, create, update, remove };
