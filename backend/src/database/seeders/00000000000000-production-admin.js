'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { ROLES } = require('../../config/roles');

/**
 * Administrador inicial de una instalación real.
 *
 * Es el único seeder pensado para producción: crea la cuenta mínima con la que
 * entrar por primera vez y desde la cual dar de alta al resto del personal.
 *
 * La contraseña NO se escribe en el repositorio. Se toma de INITIAL_ADMIN_PASSWORD
 * o, si no está definida, se genera al azar y se imprime una sola vez en la
 * consola. Un repositorio público con la contraseña del administrador dentro
 * equivale a no tener autenticación.
 *
 * Se ejecuta con:  npm run db:seed:prod
 */

const USERNAME = process.env.INITIAL_ADMIN_USERNAME || 'admin';
const NAME = process.env.INITIAL_ADMIN_NAME || 'Administrador';
const EMAIL = process.env.INITIAL_ADMIN_EMAIL || null;

/**
 * Contraseña legible pero fuerte: cuatro bloques de cinco caracteres. Un
 * volcado hexadecimal de treinta y dos caracteres se copia mal al teclado y
 * termina anotado en un papel.
 */
function generarContrasena() {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bloques = [];
  for (let b = 0; b < 4; b += 1) {
    let bloque = '';
    for (let i = 0; i < 5; i += 1) {
      bloque += alfabeto[crypto.randomInt(alfabeto.length)];
    }
    bloques.push(bloque);
  }
  return bloques.join('-');
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const [existentes] = await queryInterface.sequelize.query(
      "SELECT count(*)::int AS total FROM users WHERE role = 'admin' AND deleted_at IS NULL",
    );

    if (existentes[0].total > 0) {
      // Reejecutar el seeder no debe crear un segundo administrador ni, mucho
      // menos, restablecer la contraseña del que ya está en uso.
      // eslint-disable-next-line no-console
      console.log('  · Ya existe un administrador activo; no se crea otro.');
      return;
    }

    const generada = !process.env.INITIAL_ADMIN_PASSWORD;
    const password = process.env.INITIAL_ADMIN_PASSWORD || generarContrasena();

    if (password.length < 12) {
      throw new Error('INITIAL_ADMIN_PASSWORD debe tener al menos 12 caracteres.');
    }

    const now = new Date();
    await queryInterface.bulkInsert('users', [
      {
        name: NAME,
        username: USERNAME.toLowerCase(),
        email: EMAIL,
        password_hash: await bcrypt.hash(password, 10),
        role: ROLES.ADMIN,
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    ]);

    /* eslint-disable no-console */
    console.log('');
    console.log('  ┌───────────────────────────────────────────────────────────┐');
    console.log('  │  ADMINISTRADOR INICIAL CREADO                             │');
    console.log('  ├───────────────────────────────────────────────────────────┤');
    console.log(`  │  Usuario:     ${USERNAME.toLowerCase().padEnd(44)}│`);
    if (generada) {
      console.log(`  │  Contraseña:  ${password.padEnd(44)}│`);
      console.log('  │                                                           │');
      console.log('  │  Anótala ahora: no se vuelve a mostrar y no queda         │');
      console.log('  │  guardada en ningún archivo. Cámbiala al entrar.          │');
    } else {
      console.log('  │  Contraseña:  la definida en INITIAL_ADMIN_PASSWORD       │');
    }
    console.log('  └───────────────────────────────────────────────────────────┘');
    console.log('');
    /* eslint-enable no-console */
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('users', { username: { [Sequelize.Op.eq]: USERNAME.toLowerCase() } });
  },
};
