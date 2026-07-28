const { body, param, query } = require('express-validator');
const { ROLES } = require('../config/roles');
const { MIN_PASSWORD } = require('./authValidator');

const rolesValidos = Object.values(ROLES);

const nameRule = (field) =>
  field.isString().trim().isLength({ min: 3, max: 120 }).withMessage('El nombre debe tener entre 3 y 120 caracteres');

const usernameRule = (field) =>
  field
    .isString()
    .trim()
    .isLength({ min: 3, max: 40 })
    .withMessage('El usuario debe tener entre 3 y 40 caracteres')
    .matches(/^[a-zA-Z0-9._-]+$/)
    .withMessage('El usuario solo admite letras, números, punto, guion y guion bajo');

const passwordRule = (field) =>
  field
    .isString()
    .isLength({ min: MIN_PASSWORD, max: 72 })
    .withMessage(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres`);

const createUser = [
  nameRule(body('name').exists({ values: 'falsy' }).withMessage('El nombre es obligatorio').bail()),
  usernameRule(body('username').exists({ values: 'falsy' }).withMessage('El usuario es obligatorio').bail()),
  passwordRule(body('password').exists({ values: 'falsy' }).withMessage('La contraseña es obligatoria').bail()),
  body('email').optional({ nullable: true, checkFalsy: true }).isEmail().withMessage('Correo inválido').normalizeEmail(),
  body('role').optional().isIn(rolesValidos).withMessage(`El rol debe ser uno de: ${rolesValidos.join(', ')}`),
  body('isActive').optional().isBoolean().toBoolean(),
];

const updateUser = [
  param('id').isInt({ min: 1 }).toInt(),
  nameRule(body('name').optional()),
  usernameRule(body('username').optional()),
  passwordRule(body('password').optional({ checkFalsy: true })),
  body('email').optional({ nullable: true, checkFalsy: true }).isEmail().withMessage('Correo inválido').normalizeEmail(),
  body('role').optional().isIn(rolesValidos).withMessage(`El rol debe ser uno de: ${rolesValidos.join(', ')}`),
  body('isActive').optional().isBoolean().toBoolean(),

  body().custom((value) => {
    const permitidos = ['name', 'username', 'password', 'email', 'role', 'isActive'];
    if (!permitidos.some((campo) => value[campo] !== undefined)) {
      throw new Error('Debes enviar al menos un campo para actualizar');
    }
    return true;
  }),
];

const userId = [param('id').isInt({ min: 1 }).withMessage('El id debe ser un entero positivo').toInt()];

const listUsers = [
  query('q').optional().isString().trim().isLength({ max: 120 }),
  query('role').optional().isIn(rolesValidos),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('offset').optional().isInt({ min: 0 }).toInt(),
];

module.exports = { createUser, updateUser, userId, listUsers };
