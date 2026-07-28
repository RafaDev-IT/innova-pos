'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('products', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },
      barcode: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      price: {
        // DECIMAL y no FLOAT: el punto flotante binario no representa
        // exactamente valores como 19.99 y acumula error en los totales.
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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
        // Borrado lógico: un producto puede estar referenciado por ventas
        // históricas, así que nunca se elimina físicamente.
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    // El código de barras identifica al producto de forma única. La unicidad se
    // aplica solo sobre los registros vivos, para poder reutilizar el código de
    // un producto dado de baja.
    await queryInterface.addIndex('products', ['barcode'], {
      name: 'products_barcode_unique',
      unique: true,
      where: { deleted_at: null },
    });

    // La búsqueda por nombre es case-insensitive (ILIKE); el índice funcional
    // sobre lower(name) permite que Postgres lo aproveche en búsquedas por prefijo.
    await queryInterface.sequelize.query(
      'CREATE INDEX products_name_lower_idx ON products (lower(name) varchar_pattern_ops);',
    );

    await queryInterface.addConstraint('products', {
      fields: ['price'],
      type: 'check',
      name: 'products_price_non_negative',
      where: { price: { [Sequelize.Op.gte]: 0 } },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('products');
  },
};
