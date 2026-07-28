const { Router } = require('express');

const controller = require('../controllers/userController');
const validate = require('../middlewares/validate');
const rules = require('../validators/userValidator');
const { authenticate, authorize } = require('../middlewares/authenticate');
const { PERMISSIONS } = require('../config/roles');

const router = Router();

// La gestión de usuarios es exclusiva del administrador. El permiso se exige en
// cada ruta y no una sola vez en el router, para que quede explícito al leerlo.
router.use(authenticate);

router.get('/', authorize(PERMISSIONS.USERS_MANAGE), rules.listUsers, validate, controller.list);
router.get('/:id', authorize(PERMISSIONS.USERS_MANAGE), rules.userId, validate, controller.getById);
router.post('/', authorize(PERMISSIONS.USERS_MANAGE), rules.createUser, validate, controller.create);
router.put('/:id', authorize(PERMISSIONS.USERS_MANAGE), rules.updateUser, validate, controller.update);
router.delete('/:id', authorize(PERMISSIONS.USERS_MANAGE), rules.userId, validate, controller.remove);

module.exports = router;
