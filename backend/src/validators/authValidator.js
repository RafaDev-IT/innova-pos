const { body } = require('express-validator');

// Doce caracteres es hoy el mínimo razonable para una contraseña de trabajo.
// No se exigen símbolos ni mayúsculas: las reglas de composición empujan a la
// gente hacia contraseñas predecibles del tipo "Password1!", mientras que la
// longitud es lo que realmente encarece un ataque por fuerza bruta.
const MIN_PASSWORD = 12;

const login = [
  body('username')
    .exists({ values: 'falsy' })
    .withMessage('El usuario es obligatorio')
    .bail()
    .isString()
    .trim()
    .isLength({ max: 40 }),

  body('password').exists({ values: 'falsy' }).withMessage('La contraseña es obligatoria').bail().isString(),
];

const changePassword = [
  body('currentPassword').exists({ values: 'falsy' }).withMessage('Indica tu contraseña actual').bail().isString(),

  body('newPassword')
    .exists({ values: 'falsy' })
    .withMessage('La nueva contraseña es obligatoria')
    .bail()
    .isString()
    .isLength({ min: MIN_PASSWORD, max: 72 })
    .withMessage(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres`)
    // bcrypt trunca en 72 bytes; permitir más daría una falsa sensación de
    // seguridad porque los caracteres extra se ignorarían en silencio.
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error('La nueva contraseña debe ser distinta de la actual');
      }
      return true;
    }),
];

module.exports = { login, changePassword, MIN_PASSWORD };
