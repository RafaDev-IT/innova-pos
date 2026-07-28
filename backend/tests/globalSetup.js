const { execSync } = require('child_process');
const path = require('path');

/**
 * Prepara la base de datos de tests una sola vez por ejecución de Jest:
 * la crea si no existe y aplica todas las migraciones. Correr las migraciones
 * reales (en vez de `sequelize.sync()`) hace que la suite también valide que
 * las migraciones sean aplicables desde cero.
 */
module.exports = async () => {
  const cwd = path.resolve(__dirname, '..');
  const env = { ...process.env, NODE_ENV: 'test' };
  const run = (cmd, { allowFailure = false } = {}) => {
    try {
      execSync(cmd, { cwd, env, stdio: 'pipe' });
    } catch (error) {
      if (!allowFailure) {
        const output = [error.stdout, error.stderr].filter(Boolean).join('\n');
        throw new Error(`Falló "${cmd}":\n${output}`);
      }
    }
  };

  // `db:create` falla si la base ya existe: es un caso esperado, no un error.
  run('npx sequelize-cli db:create', { allowFailure: true });
  run('npx sequelize-cli db:migrate');
};
