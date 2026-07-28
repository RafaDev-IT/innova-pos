'use strict';

/**
 * Liga cada venta con el cajero que la registró.
 *
 * Es lo que permite después el corte de caja por turno, los reportes por
 * cajero y la trazabilidad de una cancelación.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('sales', 'user_id', {
      type: Sequelize.INTEGER,
      // Nullable por dos razones: las ventas registradas antes de existir el
      // módulo de usuarios no tienen dueño, y dar de baja a un usuario no debe
      // borrar su histórico de ventas.
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });

    // Copia del nombre al momento de la venta, igual que en sale_items: el
    // reporte histórico debe seguir siendo legible aunque el usuario cambie de
    // nombre o se dé de baja.
    await queryInterface.addColumn('sales', 'user_name', {
      type: Sequelize.STRING(120),
      allowNull: true,
    });

    await queryInterface.addIndex('sales', ['user_id'], { name: 'sales_user_id_idx' });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('sales', 'sales_user_id_idx');
    await queryInterface.removeColumn('sales', 'user_name');
    await queryInterface.removeColumn('sales', 'user_id');
  },
};
