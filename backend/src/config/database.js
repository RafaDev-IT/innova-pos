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
  // Registra en la tabla `SequelizeData` qué semillas ya se ejecutaron. Por
  // defecto sequelize-cli no lleva ese control y vuelve a insertarlo todo en
  // cada ejecución: el contenedor de la API siembra al arrancar, y sin este
  // registro cada reinicio duplicaría el catálogo entero.
  seederStorage: 'sequelize',
  dialectOptions: {
    // Los DECIMAL de Postgres llegan como string para no perder precisión;
    // el parseo a número se hace explícitamente en la capa de serialización.
    decimalNumbers: false,
  },
};

/**
 * En producción la base es un servicio gestionado (Supabase) al que se llega
 * por una única cadena de conexión, no por seis variables sueltas. Cuando
 * DATABASE_URL está presente manda ella, y se exige TLS: la conexión entre el
 * proceso y la base cruza Internet, y sin cifrar viajarían en claro tanto la
 * contraseña como las ventas.
 *
 * `rejectUnauthorized: false` acepta la cadena de certificados del proveedor
 * sin tener que empaquetar su CA raíz en la imagen. El tráfico sigue cifrado;
 * lo que no se verifica es la identidad del servidor, aceptable porque el
 * destino es un host fijo del propio proveedor.
 */
const conexionRemota = process.env.DATABASE_URL
  ? {
      use_env_variable: 'DATABASE_URL',
      dialectOptions: {
        ...base.dialectOptions,
        ssl: { require: true, rejectUnauthorized: false },
      },
    }
  : {};

module.exports = {
  development: {
    ...base,
    database: process.env.DB_NAME || 'innova_pos',
    // Activable con DB_LOGGING=true para inspeccionar el SQL generado.
    // eslint-disable-next-line no-console
    logging: process.env.DB_LOGGING === 'true' ? console.log : false,
    ...conexionRemota,
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
    ...conexionRemota,
  },
};
