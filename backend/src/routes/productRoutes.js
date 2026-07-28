const { Router } = require('express');

const controller = require('../controllers/productController');
const validate = require('../middlewares/validate');
const rules = require('../validators/productValidator');

const router = Router();

router.get('/', rules.listProducts, validate, controller.list);
router.get('/barcode/:barcode', rules.barcodeParam, validate, controller.getByBarcode);
router.get('/:id', rules.productId, validate, controller.getById);
router.post('/', rules.createProduct, validate, controller.create);
router.put('/:id', rules.updateProduct, validate, controller.update);
router.delete('/:id', rules.productId, validate, controller.remove);

module.exports = router;
