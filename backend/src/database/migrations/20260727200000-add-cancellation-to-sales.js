'use strict';

/**
 * Datos de cancelación de una venta.
 *
 * Una venta cancelada no se borra: se marca. Borrarla dejaría un hueco en la
 * numeración de folios y haría imposible explicar después por qué falta el
 * V-000512, que es justo la pregunta que surge en una auditoría.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('sales', 'cancelled_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('sales', 'cancelled_by_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });

    // Copia del nombre, igual que en el resto del histórico: quien autorizó una
    // cancelación debe seguir siendo legible aunque se dé de baja después.
    await queryInterface.addColumn('sales', 'cancelled_by_name', {
      type: Sequelize.STRING(120),
      allowNull: true,
    });

    await queryInterface.addColumn('sales', 'cancel_reason', {
      // El motivo es obligatorio al cancelar. Una cancelación sin explicación
      // es indistinguible de un error o de un fraude.
      type: Sequelize.STRING(300),
      allowNull: true,
    });

    // El histórico se consulta filtrando por estado y ordenando por fecha.
    await queryInterface.addIndex('sales', ['status', 'sold_at'], {
      name: 'sales_status_sold_at_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('sales', 'sales_status_sold_at_idx');
    await queryInterface.removeColumn('sales', 'cancel_reason');
    await queryInterface.removeColumn('sales', 'cancelled_by_name');
    await queryInterface.removeColumn('sales', 'cancelled_by_id');
    await queryInterface.removeColumn('sales', 'cancelled_at');
  },
};
