const db = require('../src/models');

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

beforeEach(async () => {
  await global.resetDatabase();
});

afterAll(async () => {
  await db.sequelize.close();
});
