const request = require('supertest');
const db = require('../src/models');
const app = require('../src/app');
const { issueToken } = require('../src/services/authService');
const { ROLES } = require('../src/config/roles');

/**
 * Deja la base en un estado limpio antes de cada test. `TRUNCATE ... CASCADE`
 * con reinicio de secuencias garantiza que los IDs sean predecibles y que un
 * test no herede filas de otro.
 */
global.resetDatabase = async () => {
  const tables = Object.values(db.sequelize.models)
    .map((model) => `"${model.getTableName()}"`)
    .join(', ');

  if (!tables) return;

  await db.sequelize.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE;`);
};

/**
 * Crea un usuario del rol indicado y devuelve su token.
 *
 * Todas las rutas de negocio exigen sesión, así que las pruebas necesitan una.
 * Crear el usuario de verdad —en lugar de firmar un token a mano— hace que la
 * suite también valide que el middleware relea al usuario desde la base.
 */
global.createUser = async (role = ROLES.ADMIN, overrides = {}) => {
  const user = await db.User.create({
    name: overrides.name || `Usuario ${role}`,
    username: overrides.username || `${role}.${Date.now().toString(36)}`,
    passwordHash: await db.User.hashPassword('Password.Innova2026'),
    role,
    isActive: overrides.isActive !== undefined ? overrides.isActive : true,
  });

  return { user, token: issueToken(user) };
};

/**
 * Cliente HTTP autenticado. Sustituye a `request(app)` en las pruebas y adjunta
 * la cabecera Authorization en cada petición.
 *
 * Sin argumento usa la sesión de administrador creada antes de cada test. Se le
 * puede pasar el token de otro rol para comprobar la autorización, o `null`
 * para probar el acceso sin sesión.
 */
global.apiAs = (token = global.adminToken) => {
  const build = (method) => (url) => {
    const test = request(app)[method](url);
    return token ? test.set('Authorization', `Bearer ${token}`) : test;
  };

  return {
    get: build('get'),
    post: build('post'),
    put: build('put'),
    patch: build('patch'),
    delete: build('delete'),
  };
};

beforeEach(async () => {
  await global.resetDatabase();

  // Sesión de administrador por defecto para las pruebas que verifican el
  // comportamiento del recurso y no la matriz de permisos.
  const { user, token } = await global.createUser(ROLES.ADMIN, { username: 'admin.tests' });
  global.adminUser = user;
  global.adminToken = token;
});

afterAll(async () => {
  await db.sequelize.close();
});
