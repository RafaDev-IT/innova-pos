const { Router } = require('express');

const controller = require('../controllers/productController');
const validate = require('../middlewares/validate');
const rules = require('../validators/productValidator');
const { authenticate, authorize } = require('../middlewares/authenticate');
const { PERMISSIONS } = require('../config/roles');

const router = Router();

// Todo el catálogo exige sesión: un cajero consulta, un supervisor administra.
router.use(authenticate);

const puedeVer = authorize(PERMISSIONS.PRODUCTS_VIEW);
const puedeAdministrar = authorize(PERMISSIONS.PRODUCTS_MANAGE);

router.get('/', puedeVer, rules.listProducts, validate, controller.list);
router.get('/barcode/:barcode', puedeVer, rules.barcodeParam, validate, controller.getByBarcode);
router.get('/:id', puedeVer, rules.productId, validate, controller.getById);

router.post('/', puedeAdministrar, rules.createProduct, validate, controller.create);
router.put('/:id', puedeAdministrar, rules.updateProduct, validate, controller.update);
router.delete('/:id', puedeAdministrar, rules.productId, validate, controller.remove);

module.exports = router;
