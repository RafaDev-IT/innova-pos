const request = require('supertest');
const app = require('../../src/app');
const { Product } = require('../../src/models');

const validProduct = {
  name: 'Coca-Cola 600 ml',
  barcode: '7501055300013',
  price: '18.50',
  description: 'Refresco de cola',
};

const createProduct = (overrides = {}) => Product.create({ ...validProduct, ...overrides });

describe('POST /api/products', () => {
  it('crea un producto y devuelve 201 con el precio normalizado a dos decimales', async () => {
    const res = await request(app)
      .post('/api/products')
      .send({ ...validProduct, price: '18.5' })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      name: 'Coca-Cola 600 ml',
      barcode: '7501055300013',
      price: '18.50',
      isActive: true,
    });
    expect(res.body.data.id).toEqual(expect.any(Number));
  });

  it('acepta precios escritos con coma decimal', async () => {
    const res = await request(app)
      .post('/api/products')
      .send({ ...validProduct, price: '18,50' })
      .expect(201);

    expect(res.body.data.price).toBe('18.50');
  });

  it('recorta espacios sobrantes en nombre y código de barras', async () => {
    const res = await request(app)
      .post('/api/products')
      .send({ ...validProduct, name: '  Agua 1 L  ', barcode: '  7501030000015  ' })
      .expect(201);

    expect(res.body.data.name).toBe('Agua 1 L');
    expect(res.body.data.barcode).toBe('7501030000015');
  });

  it('rechaza con 422 cuando faltan los campos obligatorios', async () => {
    const res = await request(app).post('/api/products').send({}).expect(422);

    const fields = res.body.error.details.map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['name', 'barcode', 'price']));
  });

  it('rechaza con 422 un precio negativo', async () => {
    const res = await request(app)
      .post('/api/products')
      .send({ ...validProduct, price: '-1' })
      .expect(422);

    expect(res.body.error.details.some((d) => d.field === 'price')).toBe(true);
  });

  it('devuelve todos los errores de validación juntos, no solo el primero', async () => {
    const res = await request(app).post('/api/products').send({ name: 'X', price: 'abc' }).expect(422);

    expect(res.body.error.details.length).toBeGreaterThanOrEqual(3);
  });

  it('devuelve 409 si el código de barras ya está registrado', async () => {
    await createProduct();

    const res = await request(app)
      .post('/api/products')
      .send({ ...validProduct, name: 'Otro producto' })
      .expect(409);

    expect(res.body.error.details[0].field).toBe('barcode');
  });
});

describe('GET /api/products', () => {
  beforeEach(async () => {
    await createProduct({ name: 'Coca-Cola 600 ml', barcode: '7501055300013', price: '18.50' });
    await createProduct({ name: 'Agua natural 1 L', barcode: '7501030000015', price: '14.00' });
    await createProduct({ name: 'Galletas de chocolate', barcode: '7501000670017', price: '22.00' });
  });

  it('lista todos los productos activos ordenados por nombre', async () => {
    const res = await request(app).get('/api/products').expect(200);

    expect(res.body.data).toHaveLength(3);
    expect(res.body.data.map((p) => p.name)).toEqual([
      'Agua natural 1 L',
      'Coca-Cola 600 ml',
      'Galletas de chocolate',
    ]);
    expect(res.body.meta.total).toBe(3);
  });

  it('busca por nombre parcial sin distinguir mayúsculas', async () => {
    const res = await request(app).get('/api/products?q=COCA').expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Coca-Cola 600 ml');
  });

  it('busca por código de barras', async () => {
    const res = await request(app).get('/api/products?q=7501030000015').expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Agua natural 1 L');
  });

  it('busca por fragmento del código de barras', async () => {
    const res = await request(app).get('/api/products?q=750103').expect(200);

    expect(res.body.data).toHaveLength(1);
  });

  it('coloca primero la coincidencia exacta de código de barras', async () => {
    // "7501000670017" coincide exacto con las galletas; el término también
    // aparece como fragmento en otros registros según el patrón de búsqueda.
    await createProduct({ name: 'AAA Primero alfabéticamente', barcode: 'X7501000670017Y', price: '5.00' });

    const res = await request(app).get('/api/products?q=7501000670017').expect(200);

    expect(res.body.data[0].name).toBe('Galletas de chocolate');
  });

  it('devuelve una lista vacía cuando no hay coincidencias', async () => {
    const res = await request(app).get('/api/products?q=noexisteesteproducto').expect(200);

    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });

  it('trata los comodines de LIKE como texto literal', async () => {
    const res = await request(app).get('/api/products?q=%25').expect(200);

    expect(res.body.data).toEqual([]);
  });

  it('respeta limit y offset e informa si quedan más resultados', async () => {
    const res = await request(app).get('/api/products?limit=2&offset=0').expect(200);

    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toMatchObject({ total: 3, limit: 2, offset: 0, hasMore: true });
  });

  it('rechaza con 422 un limit fuera de rango', async () => {
    await request(app).get('/api/products?limit=9999').expect(422);
  });

  it('excluye del listado los productos dados de baja', async () => {
    const product = await Product.findOne({ where: { barcode: '7501030000015' } });
    await product.destroy();

    const res = await request(app).get('/api/products').expect(200);

    expect(res.body.data).toHaveLength(2);
  });
});

describe('GET /api/products/:id', () => {
  it('devuelve el producto solicitado', async () => {
    const product = await createProduct();

    const res = await request(app).get(`/api/products/${product.id}`).expect(200);

    expect(res.body.data.id).toBe(product.id);
  });

  it('devuelve 404 si el producto no existe', async () => {
    await request(app).get('/api/products/99999').expect(404);
  });

  it('devuelve 422 si el id no es un entero', async () => {
    await request(app).get('/api/products/abc').expect(422);
  });
});

describe('GET /api/products/barcode/:barcode', () => {
  it('localiza el producto por su código de barras exacto', async () => {
    await createProduct();

    const res = await request(app).get('/api/products/barcode/7501055300013').expect(200);

    expect(res.body.data.name).toBe('Coca-Cola 600 ml');
  });

  it('devuelve 404 si ningún producto tiene ese código', async () => {
    await request(app).get('/api/products/barcode/0000000000000').expect(404);
  });
});

describe('PUT /api/products/:id', () => {
  it('actualiza el precio del producto', async () => {
    const product = await createProduct();

    const res = await request(app).put(`/api/products/${product.id}`).send({ price: '21.00' }).expect(200);

    expect(res.body.data.price).toBe('21.00');
  });

  it('permite cambiar el código de barras si está libre', async () => {
    const product = await createProduct();

    const res = await request(app)
      .put(`/api/products/${product.id}`)
      .send({ barcode: '1112223334445' })
      .expect(200);

    expect(res.body.data.barcode).toBe('1112223334445');
  });

  it('devuelve 409 si el nuevo código de barras pertenece a otro producto', async () => {
    const first = await createProduct();
    await createProduct({ barcode: '7501030000015', name: 'Agua' });

    await request(app).put(`/api/products/${first.id}`).send({ barcode: '7501030000015' }).expect(409);
  });

  it('acepta reenviar su propio código de barras sin marcar conflicto', async () => {
    const product = await createProduct();

    await request(app)
      .put(`/api/products/${product.id}`)
      .send({ barcode: product.barcode, name: 'Nombre nuevo' })
      .expect(200);
  });

  it('devuelve 422 si el cuerpo no trae ningún campo', async () => {
    const product = await createProduct();

    await request(app).put(`/api/products/${product.id}`).send({}).expect(422);
  });

  it('devuelve 404 al actualizar un producto inexistente', async () => {
    await request(app).put('/api/products/99999').send({ price: '10.00' }).expect(404);
  });
});

describe('DELETE /api/products/:id', () => {
  it('da de baja el producto y responde 204', async () => {
    const product = await createProduct();

    await request(app).delete(`/api/products/${product.id}`).expect(204);
    await request(app).get(`/api/products/${product.id}`).expect(404);
  });

  it('conserva la fila en la base (borrado lógico, no físico)', async () => {
    const product = await createProduct();
    await request(app).delete(`/api/products/${product.id}`).expect(204);

    const deleted = await Product.findByPk(product.id, { paranoid: false });
    expect(deleted).not.toBeNull();
    expect(deleted.deletedAt).not.toBeNull();
  });

  it('devuelve 404 al dar de baja un producto inexistente', async () => {
    await request(app).delete('/api/products/99999').expect(404);
  });
});
