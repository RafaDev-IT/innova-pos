const { Router } = require('express');

const controller = require('../controllers/authController');
const validate = require('../middlewares/validate');
const rules = require('../validators/authValidator');
const { authenticate } = require('../middlewares/authenticate');

const router = Router();

// Públicas: son la puerta de entrada al sistema.
router.post('/login', rules.login, validate, controller.login);

// El resto exige sesión.
router.get('/me', authenticate, controller.me);
router.get('/roles', authenticate, controller.roles);
router.post('/logout', authenticate, controller.logout);
router.post('/change-password', authenticate, rules.changePassword, validate, controller.changePassword);

module.exports = router;
