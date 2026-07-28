const { Router } = require('express');

const controller = require('../controllers/saleController');
const validate = require('../middlewares/validate');
const rules = require('../validators/saleValidator');
const { authenticate, authorize } = require('../middlewares/authenticate');
const { PERMISSIONS } = require('../config/roles');

const router = Router();

router.use(authenticate);

router.get('/', authorize(PERMISSIONS.SALES_VIEW), rules.listSales, validate, controller.list);
router.get('/:id', authorize(PERMISSIONS.SALES_VIEW), rules.saleId, validate, controller.getById);
router.post('/', authorize(PERMISSIONS.SALES_CREATE), rules.createSale, validate, controller.create);

// Cancelar exige permiso propio: un cajero registra ventas pero no las anula.
router.post('/:id/cancel', authorize(PERMISSIONS.SALES_CANCEL), rules.cancelSale, validate, controller.cancel);

module.exports = router;
