'use strict';

/**
 * Bitácora de auditoría.
 *
 * Registra quién hizo qué y cuándo. Es lo que da sustancia real al módulo de
 * roles: sin ella, "permisos" queda en una etiqueta decorativa porque nadie
 * puede comprobar después quién cambió un precio o canceló una venta.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('audit_log', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        // Dar de baja a un usuario no puede borrar su rastro: ese es justamente
        // el registro que se querrá consultar después.
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      user_name: {
        // Copia del nombre al momento del hecho, por el mismo motivo que en el
        // detalle de venta: la bitácora debe seguir siendo legible.
        type: Sequelize.STRING(120),
        allowNull: true,
      },
      action: {
        // Formato "entidad.verbo": product.create, sale.cancel, user.update…
        type: Sequelize.STRING(60),
        allowNull: false,
      },
      entity_type: {
        type: Sequelize.STRING(40),
        allowNull: true,
      },
      entity_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      summary: {
        // Frase lista para mostrar. Se guarda redactada y no se compone al
        // leer, porque depende de valores que pueden haber cambiado después.
        type: Sequelize.STRING(300),
        allowNull: false,
      },
      metadata: {
        // Detalle estructurado del cambio (valores antes y después). JSONB
        // permite consultarlo sin migrar el esquema cada vez que se registra
        // un dato nuevo.
        type: Sequelize.JSONB,
        allowNull: true,
      },
      ip_address: {
        type: Sequelize.STRING(45), // Cabe una IPv6 completa.
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    // La consulta natural es "lo último que pasó", así que el índice va sobre
    // la fecha descendente.
    await queryInterface.addIndex('audit_log', ['created_at'], { name: 'audit_log_created_at_idx' });
    await queryInterface.addIndex('audit_log', ['user_id'], { name: 'audit_log_user_id_idx' });
    await queryInterface.addIndex('audit_log', ['action'], { name: 'audit_log_action_idx' });
    await queryInterface.addIndex('audit_log', ['entity_type', 'entity_id'], {
      name: 'audit_log_entity_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('audit_log');
  },
};
