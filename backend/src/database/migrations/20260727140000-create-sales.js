'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('sales', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      folio: {
        // Identificador legible para el operador ("V-000001"). Se mantiene
        // separado del id porque el id es un detalle de implementación.
        type: Sequelize.STRING(20),
        allowNull: false,
        unique: true,
      },
      subtotal: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      total: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      status: {
        type: Sequelize.ENUM('completed', 'cancelled'),
        allowNull: false,
        defaultValue: 'completed',
      },
      item_count: {
        // Número de unidades vendidas. Se desnormaliza para poder listar
        // ventas sin agregar sobre sale_items en cada consulta.
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      sold_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
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

    // El folio se toma de una secuencia de PostgreSQL y no de un COUNT(*):
    // dos cajas vendiendo a la vez obtendrían el mismo número con un conteo,
    // mientras que nextval es atómico incluso dentro de transacciones.
    await queryInterface.sequelize.query('CREATE SEQUENCE IF NOT EXISTS sales_folio_seq START 1;');

    await queryInterface.addIndex('sales', ['sold_at'], { name: 'sales_sold_at_idx' });

    await queryInterface.addConstraint('sales', {
      fields: ['total'],
      type: 'check',
      name: 'sales_total_non_negative',
      where: { total: { [Sequelize.Op.gte]: 0 } },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('sales');
    await queryInterface.sequelize.query('DROP SEQUENCE IF EXISTS sales_folio_seq;');
    // Los tipos ENUM de PostgreSQL sobreviven al DROP TABLE y bloquearían una
    // reejecución de la migración.
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_sales_status";');
  },
};
