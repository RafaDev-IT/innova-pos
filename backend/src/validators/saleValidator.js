const { body, param, query } = require('express-validator');
const { isValidAmount, MAX_AMOUNT } = require('../utils/money');

const createSale = [
  body('items')
    .isArray({ min: 1 })
    .withMessage('La venta debe incluir al menos un producto')
    .bail()
    .isArray({ max: 200 })
    .withMessage('Una venta admite como máximo 200 renglones'),

  body('items.*.productId')
    .exists({ values: 'null' })
    .withMessage('Cada renglón debe indicar el producto')
    .bail()
    .isInt({ min: 1 })
    .withMessage('El id del producto debe ser un entero positivo')
    .toInt(),

  body('items.*.quantity')
    .optional()
    .isInt({ min: 1, max: 9999 })
    .withMessage('La cantidad debe ser un entero entre 1 y 9999')
    .toInt(),

  // El precio es opcional: si no viene se usa el del catálogo. Cuando viene es
  // porque el cajero lo editó dentro de la venta, que el requisito permite.
  body('items.*.unitPrice')
    .optional({ nullable: true })
    .customSanitizer((value) => (typeof value === 'string' ? value.trim().replace(',', '.') : value))
    .custom((value) => {
      if (!isValidAmount(value)) {
        throw new Error(`El precio debe ser un número entre 0 y ${MAX_AMOUNT}`);
      }
      return true;
    }),
];

const saleId = [param('id').isInt({ min: 1 }).withMessage('El id debe ser un entero positivo').toInt()];

const listSales = [
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('offset').optional().isInt({ min: 0 }).toInt(),
];

module.exports = { createSale, saleId, listSales };
