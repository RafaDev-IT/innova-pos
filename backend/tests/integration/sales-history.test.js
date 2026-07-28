const { Product, Sale, AuditEntry } = require('../../src/models');
const { ROLES } = require('../../src/config/roles');
const { ACTIONS } = require('../../src/services/auditService');

const crearProducto = () =>
  Product.create({ name: 'Coca-Cola 600 ml', barcode: '7410010000014', price: '0.75' });

/** Registra una venta y devuelve su cuerpo de respuesta. */
async function vender(token, productId, cantidad = 1) {
  const res = await apiAs(token)
    .post('/api/sales')
    .send({ items: [{ productId, quantity: cantidad }] })
    .expect(201);
  return res.body.data;
}

describe('GET /api/sales — filtros del histórico', () => {
  let producto;

  beforeEach(async () => {
    producto = await crearProducto();
  });

  it('busca por folio parcial', async () => {
    // El operador recuerda los últimos dígitos del ticket que tiene en la mano.
    const venta = await vender(global.adminToken, producto.id);
    const ultimos = venta.folio.slice(-3);

    const res = await apiAs().get(`/api/sales?folio=${ultimos}`).expect(200);

    expect(res.body.data.some((v) => v.folio === venta.folio)).toBe(true);
  });

  it('la búsqueda por folio no distingue mayúsculas', async () => {
    await vender(global.adminToken, producto.id);

    const res = await apiAs().get('/api/sales?folio=v-').expect(200);

    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('filtra por cajero', async () => {
    const cajero = await createUser(ROLES.CASHIER, { username: 'filtrable' });
    await vender(global.adminToken, producto.id);
    await vender(cajero.token, producto.id);

    const res = await apiAs().get(`/api/sales?userId=${cajero.user.id}`).expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].userId).toBe(cajero.user.id);
  });

  it('filtra por estado', async () => {
    const a = await vender(global.adminToken, producto.id);
    await vender(global.adminToken, producto.id);
    await apiAs().post(`/api/sales/${a.id}/cancel`).send({ reason: 'Cliente se arrepintió' }).expect(200);

    const canceladas = await apiAs().get('/api/sales?status=cancelled').expect(200);
    const completadas = await apiAs().get('/api/sales?status=completed').expect(200);

    expect(canceladas.body.data).toHaveLength(1);
    expect(completadas.body.data).toHaveLength(1);
  });

  it('filtra por rango de fechas usando el día local del negocio', async () => {
    const venta = await vender(global.adminToken, producto.id);
    const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/El_Salvador' }).format(new Date());

    const dentro = await apiAs().get(`/api/sales?from=${hoy}&to=${hoy}`).expect(200);
    expect(dentro.body.data.some((v) => v.id === venta.id)).toBe(true);

    // Un rango que termina ayer no puede incluir una venta de hoy.
    const ayer = new Date(`${hoy}T12:00:00Z`);
    ayer.setUTCDate(ayer.getUTCDate() - 1);
    const clave = ayer.toISOString().slice(0, 10);

    const fuera = await apiAs().get(`/api/sales?from=${clave}&to=${clave}`).expect(200);
    expect(fuera.body.data.some((v) => v.id === venta.id)).toBe(false);
  });

  it('rechaza una fecha con formato inválido', async () => {
    await apiAs().get('/api/sales?from=27-07-2026').expect(422);
  });

  it('rechaza un estado desconocido', async () => {
    await apiAs().get('/api/sales?status=pendiente').expect(422);
  });

  it('escapa los comodines de LIKE en el folio', async () => {
    await vender(global.adminToken, producto.id);

    const res = await apiAs().get('/api/sales?folio=%25').expect(200);

    expect(res.body.data).toEqual([]);
  });
});

describe('POST /api/sales/:id/cancel', () => {
  let producto;

  beforeEach(async () => {
    producto = await crearProducto();
  });

  it('cancela la venta registrando motivo, momento y responsable', async () => {
    const venta = await vender(global.adminToken, producto.id, 2);

    const res = await apiAs()
      .post(`/api/sales/${venta.id}/cancel`)
      .send({ reason: 'Producto devuelto por el cliente' })
      .expect(200);

    expect(res.body.data.status).toBe('cancelled');
    expect(res.body.data.cancelReason).toBe('Producto devuelto por el cliente');
    expect(res.body.data.cancelledByName).toBe(global.adminUser.name);
    expect(res.body.data.cancelledAt).toBeTruthy();
  });

  it('conserva la venta y su detalle: marca, no borra', async () => {
    const venta = await vender(global.adminToken, producto.id, 3);

    await apiAs().post(`/api/sales/${venta.id}/cancel`).send({ reason: 'Error de captura' }).expect(200);

    // Borrarla dejaría un hueco en la numeración imposible de explicar después.
    const persistida = await Sale.findByPk(venta.id);
    expect(persistida).not.toBeNull();
    expect(persistida.total).toBe(venta.total);

    const detalle = await apiAs().get(`/api/sales/${venta.id}`).expect(200);
    expect(detalle.body.data.items).toHaveLength(1);
  });

  it('exige un motivo', async () => {
    const venta = await vender(global.adminToken, producto.id);

    const res = await apiAs().post(`/api/sales/${venta.id}/cancel`).send({}).expect(422);

    expect(res.body.error.details[0].field).toBe('reason');
  });

  it('rechaza un motivo demasiado corto', async () => {
    const venta = await vender(global.adminToken, producto.id);

    // "ok" no explica nada; una cancelación sin explicación es indistinguible
    // de un error o de un fraude.
    await apiAs().post(`/api/sales/${venta.id}/cancel`).send({ reason: 'ok' }).expect(422);
  });

  it('no permite cancelar dos veces', async () => {
    const venta = await vender(global.adminToken, producto.id);
    await apiAs().post(`/api/sales/${venta.id}/cancel`).send({ reason: 'Primera anulación' }).expect(200);

    await apiAs().post(`/api/sales/${venta.id}/cancel`).send({ reason: 'Segunda anulación' }).expect(409);
  });

  it('devuelve 404 si la venta no existe', async () => {
    await apiAs().post('/api/sales/99999/cancel').send({ reason: 'Venta inexistente' }).expect(404);
  });

  it('el cajero no puede cancelar', async () => {
    const cajero = await createUser(ROLES.CASHIER, { username: 'nopuede' });
    const venta = await vender(cajero.token, producto.id);

    // Un cajero registra ventas pero no las anula: es la separación que evita
    // que quien cobra pueda deshacer su propio cobro sin supervisión.
    await apiAs(cajero.token)
      .post(`/api/sales/${venta.id}/cancel`)
      .send({ reason: 'Quiero anular mi venta' })
      .expect(403);
  });

  it('el supervisor sí puede cancelar', async () => {
    const supervisor = await createUser(ROLES.SUPERVISOR, { username: 'sipuede' });
    const venta = await vender(global.adminToken, producto.id);

    await apiAs(supervisor.token)
      .post(`/api/sales/${venta.id}/cancel`)
      .send({ reason: 'Autorizado por supervisión' })
      .expect(200);
  });

  it('deja constancia en la bitácora con el motivo', async () => {
    const venta = await vender(global.adminToken, producto.id);

    await apiAs()
      .post(`/api/sales/${venta.id}/cancel`)
      .send({ reason: 'Cobro duplicado' })
      .expect(200);

    const entrada = await AuditEntry.findOne({ order: [['id', 'DESC']] });
    expect(entrada.action).toBe(ACTIONS.SALE_CANCEL);
    expect(entrada.summary).toContain('Cobro duplicado');
    expect(entrada.summary).toContain(venta.folio);
  });
});

describe('efecto de la cancelación en los totales', () => {
  it('una venta cancelada deja de contar en el tablero', async () => {
    const producto = await crearProducto();
    await vender(global.adminToken, producto.id, 4);
    const anulada = await vender(global.adminToken, producto.id, 4);

    const antes = await apiAs().get('/api/dashboard').expect(200);
    const totalAntes = Number(antes.body.data.summary.total);

    await apiAs().post(`/api/sales/${anulada.id}/cancel`).send({ reason: 'Anulada para la prueba' }).expect(200);

    const despues = await apiAs().get('/api/dashboard').expect(200);
    const totalDespues = Number(despues.body.data.summary.total);

    expect(totalDespues).toBeCloseTo(totalAntes - Number(anulada.total), 2);
    expect(despues.body.data.summary.ticketCount).toBe(antes.body.data.summary.ticketCount - 1);
  });

  it('tampoco aparece en el reporte del período', async () => {
    const producto = await crearProducto();
    const anulada = await vender(global.adminToken, producto.id, 2);
    await apiAs().post(`/api/sales/${anulada.id}/cancel`).send({ reason: 'Fuera del reporte' }).expect(200);

    const res = await apiAs().get('/api/reports/sales').expect(200);

    expect(Number(res.body.data.summary.total)).toBe(0);
  });
});
