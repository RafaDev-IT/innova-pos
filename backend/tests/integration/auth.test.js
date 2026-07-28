const { User } = require('../../src/models');
const { ROLES, PERMISSIONS, permissionsFor } = require('../../src/config/roles');

const PASSWORD = 'Password.Innova2026';

const crearUsuario = async (overrides = {}) =>
  User.create({
    name: 'Carlos Ramírez',
    username: 'cajero',
    passwordHash: await User.hashPassword(PASSWORD),
    role: ROLES.CASHIER,
    ...overrides,
  });

describe('POST /api/auth/login', () => {
  it('devuelve token, usuario y permisos con credenciales correctas', async () => {
    await crearUsuario();

    const res = await apiAs(null).post('/api/auth/login').send({ username: 'cajero', password: PASSWORD }).expect(200);

    expect(res.body.data.token).toEqual(expect.any(String));
    expect(res.body.data.user).toMatchObject({ username: 'cajero', role: ROLES.CASHIER });
    expect(res.body.data.permissions).toEqual(permissionsFor(ROLES.CASHIER));
    expect(res.body.data.roleLabel).toBe('Cajero');
  });

  it('nunca devuelve el hash de la contraseña', async () => {
    await crearUsuario();

    const res = await apiAs(null).post('/api/auth/login').send({ username: 'cajero', password: PASSWORD }).expect(200);

    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    expect(JSON.stringify(res.body)).not.toContain('$2a$');
  });

  it('acepta el usuario sin distinguir mayúsculas', async () => {
    await crearUsuario();

    await apiAs(null).post('/api/auth/login').send({ username: 'CAJERO', password: PASSWORD }).expect(200);
  });

  it('rechaza una contraseña incorrecta', async () => {
    await crearUsuario();

    await apiAs(null).post('/api/auth/login').send({ username: 'cajero', password: 'incorrecta' }).expect(401);
  });

  it('da el mismo mensaje ante usuario inexistente y contraseña incorrecta', async () => {
    await crearUsuario();

    const inexistente = await apiAs(null)
      .post('/api/auth/login')
      .send({ username: 'noexiste', password: PASSWORD })
      .expect(401);
    const incorrecta = await apiAs(null)
      .post('/api/auth/login')
      .send({ username: 'cajero', password: 'mala' })
      .expect(401);

    // Distinguirlos permitiría enumerar qué usuarios existen.
    expect(inexistente.body.error.message).toBe(incorrecta.body.error.message);
  });

  it('impide iniciar sesión a una cuenta desactivada', async () => {
    await crearUsuario({ isActive: false });

    const res = await apiAs(null).post('/api/auth/login').send({ username: 'cajero', password: PASSWORD }).expect(403);

    expect(res.body.error.message).toMatch(/desactivada/i);
  });

  it('registra la fecha del último acceso', async () => {
    const user = await crearUsuario();
    expect(user.lastLoginAt).toBeNull();

    await apiAs(null).post('/api/auth/login').send({ username: 'cajero', password: PASSWORD }).expect(200);

    await user.reload();
    expect(user.lastLoginAt).not.toBeNull();
  });

  it('exige usuario y contraseña', async () => {
    const res = await apiAs(null).post('/api/auth/login').send({}).expect(422);

    const campos = res.body.error.details.map((d) => d.field);
    expect(campos).toEqual(expect.arrayContaining(['username', 'password']));
  });
});

describe('sesión', () => {
  it('GET /api/auth/me devuelve la sesión en curso', async () => {
    const { token } = await createUser(ROLES.SUPERVISOR, { username: 'laura' });

    const res = await apiAs(token).get('/api/auth/me').expect(200);

    expect(res.body.data.user.username).toBe('laura');
    expect(res.body.data.permissions).toContain(PERMISSIONS.SALES_CANCEL);
  });

  it('rechaza una petición sin cabecera de autorización', async () => {
    await apiAs(null).get('/api/auth/me').expect(401);
  });

  it('rechaza un token con formato inválido', async () => {
    await apiAs('esto-no-es-un-token').get('/api/auth/me').expect(401);
  });

  it('rechaza un esquema distinto de Bearer', async () => {
    await apiAs(null).get('/api/auth/me').set('Authorization', 'Basic dXNlcjpwYXNz').expect(401);
  });

  it('invalida la sesión si la cuenta se desactiva después de emitir el token', async () => {
    const { user, token } = await createUser(ROLES.CASHIER, { username: 'temporal' });
    await apiAs(token).get('/api/auth/me').expect(200);

    await user.update({ isActive: false });

    // El usuario se relee en cada petición, así que el token deja de servir sin
    // esperar a que caduque.
    await apiAs(token).get('/api/auth/me').expect(403);
  });

  it('refleja de inmediato un cambio de rol', async () => {
    const { user, token } = await createUser(ROLES.CASHIER, { username: 'ascendido' });

    await apiAs(token).get('/api/users').expect(403);

    await user.update({ role: ROLES.ADMIN });

    await apiAs(token).get('/api/users').expect(200);
  });
});

describe('POST /api/auth/change-password', () => {
  it('permite cambiar la contraseña propia', async () => {
    const user = await crearUsuario();
    const login = await apiAs(null).post('/api/auth/login').send({ username: 'cajero', password: PASSWORD });
    const token = login.body.data.token;

    await apiAs(token)
      .post('/api/auth/change-password')
      .send({ currentPassword: PASSWORD, newPassword: 'NuevaClave.Innova2026' })
      .expect(200);

    await apiAs(null)
      .post('/api/auth/login')
      .send({ username: 'cajero', password: 'NuevaClave.Innova2026' })
      .expect(200);
    await apiAs(null).post('/api/auth/login').send({ username: 'cajero', password: PASSWORD }).expect(401);

    expect(user).toBeDefined();
  });

  it('rechaza el cambio si la contraseña actual es incorrecta', async () => {
    const { token } = await createUser(ROLES.CASHIER, { username: 'otro' });

    await apiAs(token)
      .post('/api/auth/change-password')
      .send({ currentPassword: 'equivocada', newPassword: 'NuevaClave.Innova2026' })
      .expect(422);
  });

  it('exige una contraseña nueva suficientemente larga', async () => {
    const { token } = await createUser(ROLES.CASHIER, { username: 'corta' });

    await apiAs(token)
      .post('/api/auth/change-password')
      .send({ currentPassword: 'Password.Innova2026', newPassword: 'corta' })
      .expect(422);
  });

  it('rechaza reutilizar la contraseña actual', async () => {
    const { token } = await createUser(ROLES.CASHIER, { username: 'repetida' });

    await apiAs(token)
      .post('/api/auth/change-password')
      .send({ currentPassword: 'Password.Innova2026', newPassword: 'Password.Innova2026' })
      .expect(422);
  });
});

describe('matriz de permisos', () => {
  it('el cajero puede consultar el catálogo pero no administrarlo', async () => {
    const { token } = await createUser(ROLES.CASHIER, { username: 'cajero1' });

    await apiAs(token).get('/api/products').expect(200);
    await apiAs(token)
      .post('/api/products')
      .send({ name: 'Producto', barcode: '111', price: '10' })
      .expect(403);
  });

  it('el cajero puede registrar ventas', async () => {
    const { token } = await createUser(ROLES.CASHIER, { username: 'cajero2' });

    // Sin renglones válidos falla por validación (422), no por permisos (403).
    await apiAs(token).post('/api/sales').send({ items: [] }).expect(422);
  });

  it('el supervisor sí puede administrar el catálogo', async () => {
    const { token } = await createUser(ROLES.SUPERVISOR, { username: 'super1' });

    await apiAs(token)
      .post('/api/products')
      .send({ name: 'Producto supervisor', barcode: '9990001', price: '10' })
      .expect(201);
  });

  it('ni cajero ni supervisor pueden gestionar usuarios', async () => {
    const cajero = await createUser(ROLES.CASHIER, { username: 'cajero3' });
    const supervisor = await createUser(ROLES.SUPERVISOR, { username: 'super2' });

    await apiAs(cajero.token).get('/api/users').expect(403);
    await apiAs(supervisor.token).get('/api/users').expect(403);
  });

  it('el error de permisos indica cuál falta', async () => {
    const { token } = await createUser(ROLES.CASHIER, { username: 'cajero4' });

    const res = await apiAs(token).get('/api/users').expect(403);

    expect(res.body.error.details[0].message).toContain(PERMISSIONS.USERS_MANAGE);
  });
});

describe('rutas protegidas sin sesión', () => {
  it.each([
    ['GET', '/api/products'],
    ['POST', '/api/products'],
    ['GET', '/api/sales'],
    ['POST', '/api/sales'],
    ['GET', '/api/users'],
  ])('%s %s responde 401', async (metodo, ruta) => {
    await apiAs(null)[metodo.toLowerCase()](ruta).expect(401);
  });

  it('la sonda de salud sigue siendo pública', async () => {
    await apiAs(null).get('/api/health').expect(200);
  });
});

describe('trazabilidad de la venta', () => {
  it('registra qué cajero hizo la venta', async () => {
    const { token, user } = await createUser(ROLES.CASHIER, { username: 'vendedor', name: 'Ana Torres' });
    const producto = await require('../../src/models').Product.create({
      name: 'Coca-Cola 600 ml',
      barcode: '7501055300013',
      price: '18.50',
    });

    const res = await apiAs(token)
      .post('/api/sales')
      .send({ items: [{ productId: producto.id }] })
      .expect(201);

    expect(res.body.data.userId).toBe(user.id);
    // El nombre se copia al momento de la venta, igual que el del producto.
    expect(res.body.data.userName).toBe('Ana Torres');
  });

  it('ignora un userId enviado por el cliente y usa el de la sesión', async () => {
    const { token, user } = await createUser(ROLES.CASHIER, { username: 'honesto' });
    const producto = await require('../../src/models').Product.create({
      name: 'Agua 1 L',
      barcode: '7501030000015',
      price: '14.00',
    });

    const res = await apiAs(token)
      .post('/api/sales')
      .send({ items: [{ productId: producto.id }], userId: 99999 })
      .expect(201);

    expect(res.body.data.userId).toBe(user.id);
  });
});
