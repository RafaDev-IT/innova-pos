const bcrypt = require('bcryptjs');
const { ROLES, permissionsFor } = require('../config/roles');

// Coste de bcrypt. 10 rondas es el equilibrio habitual entre resistencia a
// fuerza bruta y latencia aceptable en el inicio de sesión.
const SALT_ROUNDS = 10;

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    'User',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING(120),
        allowNull: false,
        validate: {
          notEmpty: { msg: 'El nombre es obligatorio' },
          len: { args: [3, 120], msg: 'El nombre debe tener entre 3 y 120 caracteres' },
        },
      },
      username: {
        type: DataTypes.STRING(40),
        allowNull: false,
        validate: {
          notEmpty: { msg: 'El usuario es obligatorio' },
          len: { args: [3, 40], msg: 'El usuario debe tener entre 3 y 40 caracteres' },
          is: { args: /^[a-zA-Z0-9._-]+$/, msg: 'El usuario solo admite letras, números, punto, guion y guion bajo' },
        },
      },
      email: {
        type: DataTypes.STRING(160),
        allowNull: true,
        validate: {
          isEmail: { msg: 'El correo no tiene un formato válido' },
        },
      },
      passwordHash: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      role: {
        type: DataTypes.ENUM(...Object.values(ROLES)),
        allowNull: false,
        defaultValue: ROLES.CASHIER,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      lastLoginAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'users',
      paranoid: true,
      defaultScope: {
        // El hash nunca sale de la base salvo que se pida explícitamente con
        // el scope `withPassword`, usado solo al verificar credenciales.
        attributes: { exclude: ['passwordHash'] },
      },
      scopes: {
        withPassword: { attributes: { include: ['passwordHash'] } },
      },
      hooks: {
        beforeValidate(user) {
          if (typeof user.name === 'string') user.name = user.name.trim();
          if (typeof user.username === 'string') user.username = user.username.trim().toLowerCase();
          if (typeof user.email === 'string') {
            const trimmed = user.email.trim().toLowerCase();
            user.email = trimmed === '' ? null : trimmed;
          }
        },
      },
    },
  );

  /** Genera el hash de una contraseña en claro. */
  User.hashPassword = (plain) => bcrypt.hash(plain, SALT_ROUNDS);

  /**
   * Compara una contraseña en claro contra el hash almacenado. bcrypt.compare
   * es de tiempo constante, así que no filtra información por temporización.
   */
  User.prototype.verifyPassword = function verifyPassword(plain) {
    if (!this.passwordHash) return Promise.resolve(false);
    return bcrypt.compare(plain, this.passwordHash);
  };

  User.prototype.permissions = function permissions() {
    return permissionsFor(this.role);
  };

  User.associate = (models) => {
    User.hasMany(models.Sale, { foreignKey: 'userId', as: 'sales' });
  };

  /**
   * Representación pública. El hash de la contraseña queda excluido de forma
   * explícita además del defaultScope, para que ninguna consulta que lo incluya
   * por error termine enviándolo al cliente.
   */
  User.prototype.toJSON = function toJSON() {
    const values = { ...this.get() };
    delete values.passwordHash;
    return {
      id: values.id,
      name: values.name,
      username: values.username,
      email: values.email ?? null,
      role: values.role,
      isActive: values.isActive,
      lastLoginAt: values.lastLoginAt ?? null,
      createdAt: values.createdAt,
    };
  };

  return User;
};
