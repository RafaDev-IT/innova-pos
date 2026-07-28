const { body, param, query } = require('express-validator');
const { isValidAmount, MAX_AMOUNT } = require('../utils/money');

const priceRule = (field) =>
  field
    .customSanitizer((value) => (typeof value === 'string' ? value.trim().replace(',', '.') : value))
    .custom((value) => {
      if (!isValidAmount(value)) {
        throw new Error(`El precio debe ser un número entre 0 y ${MAX_AMOUNT}`);
      }
      return true;
    });

const createProduct = [
  body('name')
    .exists({ values: 'falsy' })
    .withMessage('El nombre es obligatorio')
    .bail()
    .isString()
    .trim()
    .isLength({ min: 2, max: 150 })
    .withMessage('El nombre debe tener entre 2 y 150 caracteres'),

  body('barcode')
    .exists({ values: 'falsy' })
    .withMessage('El código de barras es obligatorio')
    .bail()
    .isString()
    .trim()
    .isLength({ min: 1, max: 64 })
    .withMessage('El código de barras admite hasta 64 caracteres')
    .matches(/^[\w.-]+$/)
    .withMessage('El código de barras solo admite letras, números, guiones y puntos'),

  priceRule(body('price').exists({ values: 'null' }).withMessage('El precio es obligatorio').bail()),

  body('description').optional({ nullable: true }).isString().trim().isLength({ max: 1000 }),
  body('imageUrl')
    .optional({ nullable: true, checkFalsy: true })
    .isURL({ require_protocol: true })
    .withMessage('La imagen debe ser una URL completa (https://…)')
    .isLength({ max: 500 }),
  body('isActive').optional().isBoolean().toBoolean(),
];

const updateProduct = [
  param('id').isInt({ min: 1 }).withMessage('El id debe ser un entero positivo').toInt(),

  body('name').optional().isString().trim().isLength({ min: 2, max: 150 }),
  body('barcode')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 64 })
    .matches(/^[\w.-]+$/)
    .withMessage('El código de barras solo admite letras, números, guiones y puntos'),
  priceRule(body('price').optional()),
  body('description').optional({ nullable: true }).isString().trim().isLength({ max: 1000 }),
  body('imageUrl')
    .optional({ nullable: true, checkFalsy: true })
    .isURL({ require_protocol: true })
    .withMessage('La imagen debe ser una URL completa (https://…)')
    .isLength({ max: 500 }),
  body('isActive').optional().isBoolean().toBoolean(),

  // Evita respuestas 200 engañosas ante un PUT/PATCH sin ningún campo.
  body().custom((value) => {
    const allowed = ['name', 'barcode', 'price', 'description', 'imageUrl', 'isActive'];
    if (!allowed.some((field) => value[field] !== undefined)) {
      throw new Error('Debes enviar al menos un campo para actualizar');
    }
    return true;
  }),
];

const productId = [param('id').isInt({ min: 1 }).withMessage('El id debe ser un entero positivo').toInt()];

const listProducts = [
  query('q').optional().isString().trim().isLength({ max: 150 }),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('offset').optional().isInt({ min: 0 }).toInt(),
  query('includeInactive').optional().isBoolean().toBoolean(),
];

const barcodeParam = [
  param('barcode').isString().trim().isLength({ min: 1, max: 64 }).withMessage('Código de barras inválido'),
];

module.exports = {
  createProduct,
  updateProduct,
  productId,
  listProducts,
  barcodeParam,
};
