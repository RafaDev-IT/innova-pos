'use strict';

/**
 * Imagen del producto.
 *
 * Opcional a propósito: un comercio pequeño carga su catálogo antes de tener
 * fotos, y obligar a subir una frenaría el alta. Cuando falta, la interfaz
 * genera una tarjeta de respaldo a partir del nombre.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('products', 'image_url', {
      type: Sequelize.STRING(500),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('products', 'image_url');
  },
};
