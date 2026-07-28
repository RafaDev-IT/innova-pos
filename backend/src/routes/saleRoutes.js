const { Router } = require('express');

const controller = require('../controllers/saleController');
const validate = require('../middlewares/validate');
const rules = require('../validators/saleValidator');

const router = Router();

router.get('/', rules.listSales, validate, controller.list);
router.get('/:id', rules.saleId, validate, controller.getById);
router.post('/', rules.createSale, validate, controller.create);

module.exports = router;
