'use strict';

const bcrypt = require('bcryptjs');
const { ROLES } = require('../../config/roles');

/**
 * Usuarios de ejemplo, uno por rol, para poder probar el sistema y comprobar
 * que los permisos se aplican de verdad.
 *
 * Las contraseñas son deliberadamente evidentes porque este seeder es para
 * desarrollo y evaluación. En una instalación real se crea el administrador
 * inicial con una contraseña generada y se obliga a cambiarla.
 */
const USERS = [
  ['Administrador del sistema', 'admin', 'admin@innovapos.local', 'Admin.Innova2026', ROLES.ADMIN],
  ['Laura Méndez', 'supervisor', 'supervisor@innovapos.local', 'Super.Innova2026', ROLES.SUPERVISOR],
  ['Carlos Ramírez', 'cajero', 'cajero@innovapos.local', 'Cajero.Innova2026', ROLES.CASHIER],
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();

    const rows = await Promise.all(
      USERS.map(async ([name, username, email, password, role]) => ({
        name,
        username,
        email,
        // Se hashea aquí y no se guarda jamás la contraseña en claro, ni
        // siquiera en un seeder de desarrollo.
        password_hash: await bcrypt.hash(password, 10),
        role,
        is_active: true,
        created_at: now,
        updated_at: now,
      })),
    );

    await queryInterface.bulkInsert('users', rows, { ignoreDuplicates: true });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('users', {
      username: { [Sequelize.Op.in]: USERS.map(([, username]) => username) },
    });
  },
};
