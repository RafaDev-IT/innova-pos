'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('sale_items', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      sale_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'sales', key: 'id' },
        // El detalle no tiene sentido sin su venta: si la venta se elimina,
        // sus renglones se van con ella.
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      product_id: {
        type: Sequelize.INTEGER,
        // Nullable a propósito: la venta debe seguir siendo legible aunque el
        // producto desaparezca del catálogo. Los datos del artículo viven
        // copiados en este mismo renglón.
        allowNull: true,
        references: { model: 'products', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },

      // --- Copia del producto al momento de la venta ---
      // Sin esta copia, editar el precio de un producto reescribiría el
      // histórico de todas las ventas anteriores. Además, el precio puede
      // modificarse dentro de la venta, por lo que unit_price debe ser un dato
      // propio del renglón y no una lectura de la tabla de productos.
      product_name: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },
      product_barcode: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      unit_price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      quantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      line_total: {
        // Redundante respecto a unit_price * quantity, pero se persiste para
        // que el importe cobrado quede registrado y no dependa de recalcularlo.
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
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
    });

    await queryInterface.addIndex('sale_items', ['sale_id'], { name: 'sale_items_sale_id_idx' });
    await queryInterface.addIndex('sale_items', ['product_id'], { name: 'sale_items_product_id_idx' });

    await queryInterface.addConstraint('sale_items', {
      fields: ['quantity'],
      type: 'check',
      name: 'sale_items_quantity_positive',
      where: { quantity: { [Sequelize.Op.gt]: 0 } },
    });

    await queryInterface.addConstraint('sale_items', {
      fields: ['unit_price'],
      type: 'check',
      name: 'sale_items_unit_price_non_negative',
      where: { unit_price: { [Sequelize.Op.gte]: 0 } },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('sale_items');
  },
};
