const app = require('./app');
const config = require('./config');
const { sequelize } = require('./models');

/**
 * `app.js` solo construye la aplicación Express; el arranque vive aquí. Esa
 * separación permite que Supertest importe la app sin abrir un puerto real.
 */
async function start() {
  try {
    await sequelize.authenticate();
    // eslint-disable-next-line no-console
    console.log('✔ Conexión a PostgreSQL establecida');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('✖ No se pudo conectar a PostgreSQL:', error.message);
    console.error('  Verifica que la base esté levantada (docker compose up -d) y que backend/.env sea correcto.');
    process.exit(1);
  }

  const server = app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`✔ API escuchando en http://localhost:${config.port}/api (entorno: ${config.env})`);
  });

  // Sin este manejador, un puerto ocupado termina como 'error' event no capturado
  // y el operador solo ve un stack trace de node:net.
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`✖ El puerto ${config.port} ya está en uso.`);
      console.error('  Detén el proceso que lo ocupa o define otro puerto en backend/.env (PORT=3001).');
      process.exit(1);
    }
    throw error;
  });

  // Cierre ordenado: dejamos de aceptar conexiones nuevas y liberamos el pool
  // antes de salir, para no dejar conexiones colgadas en Postgres.
  const shutdown = (signal) => async () => {
    // eslint-disable-next-line no-console
    console.log(`\n${signal} recibido, cerrando servidor…`);
    server.close(async () => {
      await sequelize.close();
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown('SIGINT'));
  process.on('SIGTERM', shutdown('SIGTERM'));
}

start();
