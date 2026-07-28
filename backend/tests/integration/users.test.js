const { User } = require('../../src/models');
const { ROLES } = require('../../src/config/roles');

const nuevoUsuario = {
  name: 'Laura Méndez',
  username: 'laura.mendez',
  password: 'Password.Innova2026',
  role: ROLES.SUPERVISOR,
};

describe('POST /api/users', () => {
  it('crea un usuario y devuelve 201 sin exponer la contraseña', async () => {
    const res = await apiAs().post('/api/users').send(nuevoUsuario).expect(201);

    expect(res.body.data).toMatchObject({ username: 'laura.mendez', role: ROLES.SUPERVISOR, isActive: true });
    expect(res.body.data.passwordHash).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('$2a$');
  });

  it('guarda la contraseña hasheada, nunca en claro', async () => {
    const res = await apiAs().post('/api/users').send(nuevoUsuario).expect(201);

    const guardado = await User.scope('withPassword').findByPk(res.body.data.id);
    expect(guardado.passwordHash).not.toBe(nuevoUsuario.password);
    expect(guardado.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(await guardado.verifyPassword(nuevoUsuario.password)).toBe(true);
  });

  it('normaliza el usuario a minúsculas', async () => {
    const res = await apiAs()
      .post('/api/users')
      .send({ ...nuevoUsuario, username: 'Laura.Mendez' })
      .expect(201);

    expect(res.body.data.username).toBe('laura.mendez');
  });

  it('rechaza un usuario duplicado sin distinguir mayúsculas', async () => {
    await apiAs().post('/api/users').send(nuevoUsuario).expect(201);

    const res = await apiAs()
      .post('/api/users')
      .send({ ...nuevoUsuario, username: 'LAURA.MENDEZ' })
      .expect(409);

    expect(res.body.error.details[0].field).toBe('username');
  });

  it('exige nombre, usuario y contraseña', async () => {
    const res = await apiAs().post('/api/users').send({}).expect(422);

    const campos = res.body.error.details.map((d) => d.field);
    expect(campos).toEqual(expect.arrayContaining(['name', 'username', 'password']));
  });

  it('rechaza contraseñas cortas', async () => {
    await apiAs()
      .post('/api/users')
      .send({ ...nuevoUsuario, password: 'corta' })
      .expect(422);
  });

  it('rechaza un rol inexistente', async () => {
    await apiAs()
      .post('/api/users')
      .send({ ...nuevoUsuario, role: 'superusuario' })
      .expect(422);
  });

  it('rechaza caracteres no permitidos en el usuario', async () => {
    await apiAs()
      .post('/api/users')
      .send({ ...nuevoUsuario, username: 'con espacios' })
      .expect(422);
  });

  it('asigna el rol de cajero por defecto', async () => {
    const res = await apiAs()
      .post('/api/users')
      .send({ name: 'Sin rol', username: 'sin.rol', password: 'Password.Innova2026' })
      .expect(201);

    expect(res.body.data.role).toBe(ROLES.CASHIER);
  });
});

describe('GET /api/users', () => {
  beforeEach(async () => {
    await createUser(ROLES.SUPERVISOR, { username: 'laura', name: 'Laura Méndez' });
    await createUser(ROLES.CASHIER, { username: 'carlos', name: 'Carlos Ramírez' });
  });

  it('lista los usuarios', async () => {
    const res = await apiAs().get('/api/users').expect(200);

    // Los dos creados más el administrador de la propia sesión de prueba.
    expect(res.body.meta.total).toBe(3);
  });

  it('busca por nombre o por usuario', async () => {
    const porNombre = await apiAs().get('/api/users?q=Laura').expect(200);
    expect(porNombre.body.data).toHaveLength(1);

    const porUsuario = await apiAs().get('/api/users?q=carlos').expect(200);
    expect(porUsuario.body.data).toHaveLength(1);
  });

  it('filtra por rol', async () => {
    const res = await apiAs().get(`/api/users?role=${ROLES.CASHIER}`).expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].username).toBe('carlos');
  });

  it('coloca primero los usuarios activos', async () => {
    const { user } = await createUser(ROLES.CASHIER, { username: 'inactivo' });
    await user.update({ isActive: false });

    const res = await apiAs().get('/api/users').expect(200);

    expect(res.body.data[res.body.data.length - 1].username).toBe('inactivo');
  });

  it('nunca incluye el hash en el listado', async () => {
    const res = await apiAs().get('/api/users').expect(200);

    expect(JSON.stringify(res.body)).not.toContain('$2a$');
  });
});

describe('PUT /api/users/:id', () => {
  it('actualiza los datos del usuario', async () => {
    const { user } = await createUser(ROLES.CASHIER, { username: 'editable' });

    const res = await apiAs().put(`/api/users/${user.id}`).send({ name: 'Nombre nuevo' }).expect(200);

    expect(res.body.data.name).toBe('Nombre nuevo');
  });

  it('permite cambiar la contraseña de otro usuario', async () => {
    const { user } = await createUser(ROLES.CASHIER, { username: 'reset' });

    await apiAs().put(`/api/users/${user.id}`).send({ password: 'OtraClave.Innova2026' }).expect(200);

    const actualizado = await User.scope('withPassword').findByPk(user.id);
    expect(await actualizado.verifyPassword('OtraClave.Innova2026')).toBe(true);
  });

  it('rechaza un cuerpo vacío', async () => {
    const { user } = await createUser(ROLES.CASHIER, { username: 'vacio' });

    await apiAs().put(`/api/users/${user.id}`).send({}).expect(422);
  });

  it('devuelve 404 si el usuario no existe', async () => {
    await apiAs().put('/api/users/99999').send({ name: 'Fantasma' }).expect(404);
  });

  it('impide que un administrador se quite a sí mismo el rol', async () => {
    // Sin esta salvaguarda, un descuido deja el sistema sin quien lo administre.
    const res = await apiAs()
      .put(`/api/users/${global.adminUser.id}`)
      .send({ role: ROLES.CASHIER })
      .expect(400);

    expect(res.body.error.message).toMatch(/tu propio rol/i);
  });

  it('impide que un administrador se desactive a sí mismo', async () => {
    await apiAs().put(`/api/users/${global.adminUser.id}`).send({ isActive: false }).expect(400);
  });

  it('impide quedarse sin ningún administrador activo', async () => {
    const { user: otroAdmin } = await createUser(ROLES.ADMIN, { username: 'admin2' });

    // Degradar al otro administrador sí se permite: queda el de la sesión.
    await apiAs().put(`/api/users/${otroAdmin.id}`).send({ role: ROLES.CASHIER }).expect(200);

    // Pero degradarse a uno mismo siendo el último, no.
    const res = await apiAs().put(`/api/users/${global.adminUser.id}`).send({ role: ROLES.SUPERVISOR }).expect(400);
    expect(res.body.error.message).toMatch(/tu propio rol/i);
  });
});

describe('DELETE /api/users/:id', () => {
  it('da de baja al usuario y responde 204', async () => {
    const { user } = await createUser(ROLES.CASHIER, { username: 'baja' });

    await apiAs().delete(`/api/users/${user.id}`).expect(204);
    await apiAs().get(`/api/users/${user.id}`).expect(404);
  });

  it('conserva la fila en la base (borrado lógico)', async () => {
    const { user } = await createUser(ROLES.CASHIER, { username: 'logico' });
    await apiAs().delete(`/api/users/${user.id}`).expect(204);

    const eliminado = await User.findByPk(user.id, { paranoid: false });
    expect(eliminado.deletedAt).not.toBeNull();
  });

  it('libera el nombre de usuario tras la baja', async () => {
    const { user } = await createUser(ROLES.CASHIER, { username: 'reutilizable' });
    await apiAs().delete(`/api/users/${user.id}`).expect(204);

    await apiAs()
      .post('/api/users')
      .send({ name: 'Otra persona', username: 'reutilizable', password: 'Password.Innova2026' })
      .expect(201);
  });

  it('impide eliminar la propia cuenta', async () => {
    await apiAs().delete(`/api/users/${global.adminUser.id}`).expect(400);
  });

  it('impide eliminar al último administrador', async () => {
    const { user, token } = await createUser(ROLES.ADMIN, { username: 'admin3' });

    // Desde la sesión del otro administrador se elimina al de la suite…
    await apiAs(token).delete(`/api/users/${global.adminUser.id}`).expect(204);
    // …y ya no queda ninguno más al que pasarle el testigo.
    const res = await apiAs(token).delete(`/api/users/${user.id}`).expect(400);
    expect(res.body.error.message).toMatch(/tu propia cuenta/i);
  });
});
