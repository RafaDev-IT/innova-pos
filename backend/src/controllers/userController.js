const userService = require('../services/userService');
const audit = require('../services/auditService');
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

  await audit.record(req, {
    action: audit.ACTIONS.USER_CREATE,
    entityType: 'user',
    entityId: user.id,
    summary: `Creó al usuario "${user.username}" con rol ${user.role}`,
    metadata: { username: user.username, role: user.role },
  });

  res.status(201).json({ success: true, data: user });
});

const update = asyncHandler(async (req, res) => {
  // Se pasa el usuario en sesión para que el servicio pueda impedir que alguien
  // se quite a sí mismo el rol o se desactive.
  const antes = await userService.findById(req.params.id);
  const rolPrevio = antes.role;
  const activoPrevio = antes.isActive;

  const user = await userService.update(req.params.id, req.body, req.user);

  const notas = [];
  if (rolPrevio !== user.role) notas.push(`rol ${rolPrevio} → ${user.role}`);
  if (activoPrevio !== user.isActive) notas.push(user.isActive ? 'reactivado' : 'desactivado');
  if (req.body.password) notas.push('contraseña restablecida');

  await audit.record(req, {
    action: audit.ACTIONS.USER_UPDATE,
    entityType: 'user',
    entityId: user.id,
    summary: notas.length
      ? `Editó a "${user.username}": ${notas.join(', ')}`
      : `Editó los datos de "${user.username}"`,
    metadata: { before: { role: rolPrevio, isActive: activoPrevio }, after: { role: user.role, isActive: user.isActive } },
  });

  res.json({ success: true, data: user });
});

const remove = asyncHandler(async (req, res) => {
  const user = await userService.remove(req.params.id, req.user);

  await audit.record(req, {
    action: audit.ACTIONS.USER_DELETE,
    entityType: 'user',
    entityId: user.id,
    summary: `Dio de baja al usuario "${user.username}"`,
    metadata: { username: user.username, role: user.role },
  });

  res.status(204).send();
});

module.exports = { list, getById, create, update, remove };
