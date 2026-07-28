const { Router } = require('express');
const { query } = require('express-validator');

const auditService = require('../services/auditService');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate');
const { authenticate, authorize } = require('../middlewares/authenticate');
const { PERMISSIONS } = require('../config/roles');

const router = Router();

router.use(authenticate);

const reglas = [
  query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
  query('offset').optional().isInt({ min: 0 }).toInt(),
  query('userId').optional().isInt({ min: 1 }).toInt(),
  query('action').optional().isString().trim().isLength({ max: 60 }),
  query('entityType').optional().isString().trim().isLength({ max: 40 }),
];

router.get(
  '/',
  authorize(PERMISSIONS.AUDIT_VIEW),
  reglas,
  validate,
  asyncHandler(async (req, res) => {
    const { items, pagination } = await auditService.search(req.query);
    res.json({ success: true, data: items, meta: pagination });
  }),
);

/** Catálogo de acciones, para poblar el filtro de la interfaz. */
router.get(
  '/actions',
  authorize(PERMISSIONS.AUDIT_VIEW),
  asyncHandler(async (_req, res) => {
    res.json({
      success: true,
      data: Object.entries(auditService.ACTION_LABELS).map(([value, label]) => ({ value, label })),
    });
  }),
);

module.exports = router;
