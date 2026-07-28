const { Product, Sale, SaleItem, sequelize } = require('../../src/models');

const createProduct = (overrides = {}) =>
  Product.create({
    name: 'Coca-Cola 600 ml',
    barcode: '7501055300013',
    price: '18.50',
    ...overrides,
  });

/** La secuencia del folio es global a la base y no la reinicia el TRUNCATE. */
const resetFolioSequence = () => sequelize.query('ALTER SEQUENCE sales_folio_seq RESTART WITH 1;');

describe('POST /api/sales', () => {
  it('registra la venta calculando el total en el servidor', async () => {
    const coca = await createProduct();
    const agua = await createProduct({ name: 'Agua 1 L', barcode: '7501030000015', price: '14.00' });

    const res = await apiAs()
      .post('/api/sales')
      .send({ items: [{ productId: coca.id, quantity: 2 }, { productId: agua.id }] })
      .expect(201);

    // 18.50 * 2 + 14.00 = 51.00
    expect(res.body.data.total).toBe('51.00');
    expect(res.body.data.subtotal).toBe('51.00');
    expect(res.body.data.itemCount).toBe(3);
    expect(res.body.data.items).toHaveLength(2);
  });

  it('usa el precio de catálogo cuando el renglón no trae precio', async () => {
    const product = await createProduct();

    const res = await apiAs()
      .post('/api/sales')
      .send({ items: [{ productId: product.id }] })
      .expect(201);

    expect(res.body.data.items[0].unitPrice).toBe('18.50');
  });

  it('respeta el precio editado dentro de la venta', async () => {
    const product = await createProduct();

    const res = await apiAs()
      .post('/api/sales')
      .send({ items: [{ productId: product.id, unitPrice: '12.00', quantity: 3 }] })
      .expect(201);

    expect(res.body.data.items[0].unitPrice).toBe('12.00');
    expect(res.body.data.items[0].lineTotal).toBe('36.00');
    expect(res.body.data.total).toBe('36.00');
  });

  it('acepta precio cero en la venta (artículo de cortesía)', async () => {
    const product = await createProduct();

    const res = await apiAs()
      .post('/api/sales')
      .send({ items: [{ productId: product.id, unitPrice: '0' }] })
      .expect(201);

    expect(res.body.data.total).toBe('0.00');
  });

  it('guarda una copia del nombre y del código de barras del producto', async () => {
    const product = await createProduct();

    const res = await apiAs()
      .post('/api/sales')
      .send({ items: [{ productId: product.id }] })
      .expect(201);

    expect(res.body.data.items[0]).toMatchObject({
      productId: product.id,
      productName: 'Coca-Cola 600 ml',
      productBarcode: '7501055300013',
    });
  });

  it('no arrastra error de punto flotante al sumar muchos renglones', async () => {
    const product = await createProduct({ price: '0.07' });
    const items = Array.from({ length: 100 }, () => ({ productId: product.id }));

    const res = await apiAs().post('/api/sales').send({ items }).expect(201);

    expect(res.body.data.total).toBe('7.00');
  });

  it('asigna folios correlativos', async () => {
    await resetFolioSequence();
    const product = await createProduct();

    const first = await apiAs()
      .post('/api/sales')
      .send({ items: [{ productId: product.id }] })
      .expect(201);
    const second = await apiAs()
      .post('/api/sales')
      .send({ items: [{ productId: product.id }] })
      .expect(201);

    expect(first.body.data.folio).toBe('V-000001');
    expect(second.body.data.folio).toBe('V-000002');
  });

  it('rechaza una venta sin renglones', async () => {
    const res = await apiAs().post('/api/sales').send({ items: [] }).expect(422);

    expect(res.body.error.details[0].field).toBe('items');
  });

  it('rechaza una venta sin el campo items', async () => {
    await apiAs().post('/api/sales').send({}).expect(422);
  });

  it('rechaza un producto inexistente indicando el renglón', async () => {
    const res = await apiAs()
      .post('/api/sales')
      .send({ items: [{ productId: 99999 }] })
      .expect(400);

    expect(res.body.error.details[0].field).toBe('items[0].productId');
  });

  it('rechaza un producto dado de baja', async () => {
    const product = await createProduct();
    await product.destroy();

    await apiAs()
      .post('/api/sales')
      .send({ items: [{ productId: product.id }] })
      .expect(400);
  });

  it('rechaza precios negativos y cantidades no positivas', async () => {
    const product = await createProduct();

    await apiAs()
      .post('/api/sales')
      .send({ items: [{ productId: product.id, unitPrice: '-1' }] })
      .expect(422);

    await apiAs()
      .post('/api/sales')
      .send({ items: [{ productId: product.id, quantity: 0 }] })
      .expect(422);
  });

  it('no deja rastro de la venta si falla al guardar el detalle', async () => {
    const product = await createProduct();
    const spy = jest
      .spyOn(SaleItem, 'bulkCreate')
      .mockRejectedValueOnce(new Error('fallo simulado al insertar el detalle'));

    await apiAs()
      .post('/api/sales')
      .send({ items: [{ productId: product.id }] })
      .expect(500);

    // La transacción debe revertir también la cabecera.
    expect(await Sale.count()).toBe(0);
    expect(await SaleItem.count()).toBe(0);

    spy.mockRestore();
  });
});

describe('integridad histórica de la venta', () => {
  it('no se altera cuando el producto cambia de precio y de nombre después', async () => {
    const product = await createProduct();
    const sale = await apiAs()
      .post('/api/sales')
      .send({ items: [{ productId: product.id, quantity: 2 }] })
      .expect(201);

    await apiAs()
      .put(`/api/products/${product.id}`)
      .send({ price: '99.00', name: 'Nombre cambiado' })
      .expect(200);

    const res = await apiAs().get(`/api/sales/${sale.body.data.id}`).expect(200);

    expect(res.body.data.total).toBe('37.00');
    expect(res.body.data.items[0].unitPrice).toBe('18.50');
    expect(res.body.data.items[0].productName).toBe('Coca-Cola 600 ml');
  });

  it('sigue siendo legible tras dar de baja el producto', async () => {
    const product = await createProduct();
    const sale = await apiAs()
      .post('/api/sales')
      .send({ items: [{ productId: product.id }] })
      .expect(201);

    await apiAs().delete(`/api/products/${product.id}`).expect(204);

    const res = await apiAs().get(`/api/sales/${sale.body.data.id}`).expect(200);

    expect(res.body.data.items[0].productName).toBe('Coca-Cola 600 ml');
    expect(res.body.data.items[0].unitPrice).toBe('18.50');
  });

  it('elimina los renglones en cascada al borrar la venta', async () => {
    const product = await createProduct();
    const created = await apiAs()
      .post('/api/sales')
      .send({ items: [{ productId: product.id }] })
      .expect(201);

    await Sale.destroy({ where: { id: created.body.data.id } });

    expect(await SaleItem.count()).toBe(0);
  });
});

describe('GET /api/sales', () => {
  it('lista el histórico con la venta más reciente primero', async () => {
    const product = await createProduct();

    const first = await apiAs()
      .post('/api/sales')
      .send({ items: [{ productId: product.id }] })
      .expect(201);
    const second = await apiAs()
      .post('/api/sales')
      .send({ items: [{ productId: product.id, quantity: 2 }] })
      .expect(201);

    const res = await apiAs().get('/api/sales').expect(200);

    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.map((s) => s.id)).toEqual([second.body.data.id, first.body.data.id]);
    expect(res.body.meta.total).toBe(2);
  });

  it('no incluye el detalle en el listado', async () => {
    const product = await createProduct();
    await apiAs()
      .post('/api/sales')
      .send({ items: [{ productId: product.id }] })
      .expect(201);

    const res = await apiAs().get('/api/sales').expect(200);

    expect(res.body.data[0].items).toBeUndefined();
  });

  it('respeta la paginación', async () => {
    const product = await createProduct();
    for (let i = 0; i < 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await apiAs()
        .post('/api/sales')
        .send({ items: [{ productId: product.id }] })
        .expect(201);
    }

    const res = await apiAs().get('/api/sales?limit=2').expect(200);

    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toMatchObject({ total: 3, hasMore: true });
  });
});

describe('GET /api/sales/:id', () => {
  it('devuelve la venta con todos sus renglones ordenados', async () => {
    const coca = await createProduct();
    const agua = await createProduct({ name: 'Agua', barcode: '7501030000015', price: '14.00' });

    const created = await apiAs()
      .post('/api/sales')
      .send({ items: [{ productId: coca.id }, { productId: agua.id }] })
      .expect(201);

    const res = await apiAs().get(`/api/sales/${created.body.data.id}`).expect(200);

    expect(res.body.data.items.map((i) => i.productName)).toEqual(['Coca-Cola 600 ml', 'Agua']);
  });

  it('devuelve 404 si la venta no existe', async () => {
    await apiAs().get('/api/sales/99999').expect(404);
  });

  it('devuelve 422 si el id no es un entero', async () => {
    await apiAs().get('/api/sales/abc').expect(422);
  });
});
