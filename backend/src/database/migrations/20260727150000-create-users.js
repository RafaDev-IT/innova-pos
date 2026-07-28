'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      username: {
        // Se inicia sesión con usuario y no con correo: en un punto de venta el
        // cajero teclea esto decenas de veces al día frente a un cliente.
        type: Sequelize.STRING(40),
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING(160),
        allowNull: true,
      },
      password_hash: {
        // Solo el hash bcrypt. La contraseña en claro no existe en ningún punto
        // del sistema más allá del cuerpo de la petición de alta.
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      role: {
        type: Sequelize.ENUM('admin', 'supervisor', 'cashier'),
        allowNull: false,
        defaultValue: 'cashier',
      },
      is_active: {
        // Desactivar en lugar de borrar: un usuario que ya vendió queda
        // referenciado por sus ventas y por la bitácora.
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      last_login_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    // Unicidad case-insensitive sobre los registros vivos: "Cajero1" y "cajero1"
    // deben ser el mismo usuario, y el nombre queda libre si se da de baja.
    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX users_username_unique ON users (lower(username)) WHERE deleted_at IS NULL;',
    );

    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX users_email_unique ON users (lower(email)) WHERE deleted_at IS NULL AND email IS NOT NULL;',
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('users');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_users_role";');
  },
};
