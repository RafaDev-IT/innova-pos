const fs = require('fs');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');

const config = require('../config/database')[process.env.NODE_ENV || 'development'];

/**
 * `sequelize-cli` entiende `use_env_variable` de forma nativa, pero la
 * aplicación no: sin esta rama, las migraciones apuntarían a la base gestionada
 * y la API seguiría hablando con localhost. Es un desajuste que no se nota en
 * desarrollo y aparece como "tabla inexistente" ya en producción.
 */
const sequelize = config.use_env_variable
  ? new Sequelize(process.env[config.use_env_variable], config)
  : new Sequelize(config.database, config.username, config.password, config);

const db = {};
const basename = path.basename(__filename);

// Carga automática de cada modelo del directorio. Añadir un modelo nuevo no
// requiere tocar este archivo.
fs.readdirSync(__dirname)
  .filter((file) => file !== basename && file.endsWith('.js') && !file.endsWith('.test.js'))
  .forEach((file) => {
    const model = require(path.join(__dirname, file))(sequelize, DataTypes);
    db[model.name] = model;
  });

// Las asociaciones se resuelven en una segunda pasada, cuando ya están todos
// los modelos registrados.
Object.values(db).forEach((model) => {
  if (typeof model.associate === 'function') model.associate(db);
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
