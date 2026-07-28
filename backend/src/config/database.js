require('dotenv').config();

/**
 * Configuración consumida tanto por `sequelize-cli` (migraciones y seeders)
 * como por la instancia de Sequelize de la aplicación. Mantener una sola
 * fuente de verdad evita que las migraciones apunten a una base distinta
 * de la que usa la API.
 */
const base = {
  dialect: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  username: process.env.DB_USER || 'pos_user',
  password: process.env.DB_PASSWORD || 'pos_password',
  define: {
    // snake_case en la base de datos, camelCase en el código JS.
    underscored: true,
    freezeTableName: true,
  },
  dialectOptions: {
    // Los DECIMAL de Postgres llegan como string para no perder precisión;
    // el parseo a número se hace explícitamente en la capa de serialización.
    decimalNumbers: false,
  },
};

module.exports = {
  development: {
    ...base,
    database: process.env.DB_NAME || 'innova_pos',
    // Activable con DB_LOGGING=true para inspeccionar el SQL generado.
    // eslint-disable-next-line no-console
    logging: process.env.DB_LOGGING === 'true' ? console.log : false,
  },
  test: {
    ...base,
    database: process.env.DB_NAME_TEST || 'innova_pos_test',
    logging: false,
  },
  production: {
    ...base,
    database: process.env.DB_NAME || 'innova_pos',
    logging: false,
  },
};
