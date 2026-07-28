const { AuditEntry, Product } = require('../../src/models');
const { ROLES } = require('../../src/config/roles');
const { ACTIONS } = require('../../src/services/auditService');

const producto = {
  name: 'Coca-Cola 600 ml',
  barcode: '7501055300013',
  price: '18.50',
};

const ultimaEntrada = () => AuditEntry.findOne({ order: [['id', 'DESC']] });

describe('registro automático en la bitácora', () => {
  it('anota el alta de un producto con quién lo hizo', async () => {
    await apiAs().post('/api/products').send(producto).expect(201);

    const entrada = await ultimaEntrada();
    expect(entrada.action).toBe(ACTIONS.PRODUCT_CREATE);
    expect(entrada.userId).toBe(global.adminUser.id);
    expect(entrada.userName).toBe(global.adminUser.name);
    expect(entrada.summary).toContain('Coca-Cola 600 ml');
  });

  it('anota el cambio de precio incluyendo el valor anterior', async () => {
    const creado = await apiAs().post('/api/products').send(producto).expect(201);

    await apiAs().put(`/api/products/${creado.body.data.id}`).send({ price: '25.00' }).expect(200);

    const entrada = await ultimaEntrada();
    expect(entrada.action).toBe(ACTIONS.PRODUCT_UPDATE);
    // Sin el valor previo, "editó el precio" no dice nada al revisar después.
    expect(entrada.summary).toContain('18.50');
    expect(entrada.summary).toContain('25.00');
    expect(entrada.metadata.before.price).toBe('18.50');
    expect(entrada.metadata.after.price).toBe('25.00');
  });

  it('anota la baja de un producto', async () => {
    const creado = await apiAs().post('/api/products').send(producto).expect(201);

    await apiAs().delete(`/api/products/${creado.body.data.id}`).expect(204);

    const entrada = await ultimaEntrada();
    expect(entrada.action).toBe(ACTIONS.PRODUCT_DELETE);
    expect(entrada.summary).toMatch(/baja/i);
  });

  it('anota la venta con su folio y su total', async () => {
    const p = await Product.create(producto);

    const venta = await apiAs()
      .post('/api/sales')
      .send({ items: [{ productId: p.id, quantity: 2 }] })
      .expect(201);

    const entrada = await ultimaEntrada();
    expect(entrada.action).toBe(ACTIONS.SALE_CREATE);
    expect(entrada.entityId).toBe(venta.body.data.id);
    expect(entrada.summary).toContain(venta.body.data.folio);
    expect(entrada.metadata.total).toBe('37.00');
  });

  it('anota el inicio de sesión', async () => {
    const { user } = await createUser(ROLES.CASHIER, { username: 'entrante' });

    await apiAs(null)
      .post('/api/auth/login')
      .send({ username: 'entrante', password: 'Password.Innova2026' })
      .expect(200);

    const entrada = await ultimaEntrada();
    expect(entrada.action).toBe(ACTIONS.LOGIN);
    expect(entrada.userId).toBe(user.id);
  });

  it('no anota los intentos de acceso fallidos', async () => {
    await createUser(ROLES.CASHIER, { username: 'fallido' });
    const antes = await AuditEntry.count();

    await apiAs(null).post('/api/auth/login').send({ username: 'fallido', password: 'mala' }).expect(401);

    // Registrarlos guardaría contraseñas tecleadas por error en el campo usuario.
    expect(await AuditEntry.count()).toBe(antes);
  });

  it('anota el cambio de rol de un usuario', async () => {
    const { user } = await createUser(ROLES.CASHIER, { username: 'ascender' });

    await apiAs().put(`/api/users/${user.id}`).send({ role: ROLES.SUPERVISOR }).expect(200);

    const entrada = await ultimaEntrada();
    expect(entrada.action).toBe(ACTIONS.USER_UPDATE);
    expect(entrada.summary).toContain('cashier');
    expect(entrada.summary).toContain('supervisor');
  });

  it('registra la dirección IP de origen', async () => {
    await apiAs().post('/api/products').send(producto).expect(201);

    const entrada = await ultimaEntrada();
    expect(entrada.ipAddress).toEqual(expect.any(String));
  });

  it('un fallo al auditar no tumba la operación que lo originó', async () => {
    const spy = jest.spyOn(AuditEntry, 'create').mockRejectedValueOnce(new Error('bitácora caída'));
    // eslint-disable-next-line no-console
    const consola = jest.spyOn(console, 'error').mockImplementation(() => {});

    // La venta debe cobrarse igual: perderla por un fallo de bitácora sería peor.
    await apiAs().post('/api/products').send(producto).expect(201);

    expect(consola).toHaveBeenCalled();
    spy.mockRestore();
    consola.mockRestore();
  });
});

describe('GET /api/audit', () => {
  beforeEach(async () => {
    await apiAs().post('/api/products').send(producto).expect(201);
    await apiAs()
      .post('/api/products')
      .send({ ...producto, name: 'Agua 1 L', barcode: '7501030000015' })
      .expect(201);
  });

  it('devuelve la bitácora con lo más reciente primero', async () => {
    const res = await apiAs().get('/api/audit').expect(200);

    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    expect(res.body.data[0].summary).toContain('Agua 1 L');
  });

  it('filtra por acción', async () => {
    const res = await apiAs().get(`/api/audit?action=${ACTIONS.PRODUCT_CREATE}`).expect(200);

    expect(res.body.data.every((e) => e.action === ACTIONS.PRODUCT_CREATE)).toBe(true);
  });

  it('filtra por usuario', async () => {
    const res = await apiAs().get(`/api/audit?userId=${global.adminUser.id}`).expect(200);

    expect(res.body.data.every((e) => e.userId === global.adminUser.id)).toBe(true);
  });

  it('pagina los resultados', async () => {
    const res = await apiAs().get('/api/audit?limit=1').expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.hasMore).toBe(true);
  });

  it('expone el catálogo de acciones para el filtro', async () => {
    const res = await apiAs().get('/api/audit/actions').expect(200);

    expect(res.body.data.find((a) => a.value === ACTIONS.SALE_CREATE).label).toBe('Venta registrada');
  });

  it('solo el administrador puede consultarla', async () => {
    const cajero = await createUser(ROLES.CASHIER, { username: 'curioso' });
    const supervisor = await createUser(ROLES.SUPERVISOR, { username: 'supervisa' });

    await apiAs(cajero.token).get('/api/audit').expect(403);
    await apiAs(supervisor.token).get('/api/audit').expect(403);
  });

  it('exige sesión', async () => {
    await apiAs(null).get('/api/audit').expect(401);
  });
});

describe('inmutabilidad de la bitácora', () => {
  it('las entradas no llevan marca de actualización', async () => {
    await apiAs().post('/api/products').send(producto).expect(201);

    const entrada = await ultimaEntrada();
    // Una entrada corregible no sirve como evidencia.
    expect(entrada.get('updatedAt')).toBeUndefined();
  });

  it('conserva el nombre del autor aunque el usuario se dé de baja', async () => {
    const { user, token } = await createUser(ROLES.SUPERVISOR, { username: 'efimero', name: 'Ana Efímera' });

    await apiAs(token)
      .post('/api/products')
      .send({ ...producto, barcode: '9990001112223' })
      .expect(201);

    await apiAs().delete(`/api/users/${user.id}`).expect(204);

    const entradas = await AuditEntry.findAll({ where: { userName: 'Ana Efímera' } });
    expect(entradas.length).toBeGreaterThan(0);
  });
});
