const { toAmountString } = require('../utils/money');

module.exports = (sequelize, DataTypes) => {
  const Product = sequelize.define(
    'Product',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING(150),
        allowNull: false,
        validate: {
          notEmpty: { msg: 'El nombre es obligatorio' },
          len: { args: [2, 150], msg: 'El nombre debe tener entre 2 y 150 caracteres' },
        },
      },
      barcode: {
        type: DataTypes.STRING(64),
        allowNull: false,
        validate: {
          notEmpty: { msg: 'El código de barras es obligatorio' },
          len: { args: [1, 64], msg: 'El código de barras admite hasta 64 caracteres' },
        },
      },
      price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
          isDecimal: { msg: 'El precio debe ser un número' },
          min: { args: [0], msg: 'El precio no puede ser negativo' },
        },
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      imageUrl: {
        type: DataTypes.STRING(500),
        allowNull: true,
        validate: {
          isUrl: { msg: 'La imagen debe ser una URL válida' },
        },
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: 'products',
      // `paranoid` activa el borrado lógico usando deleted_at.
      paranoid: true,
      // Deliberadamente sin `order` en defaultScope: Sequelize lo antepone al
      // orden que pasa la consulta, lo que anularía el ranking por relevancia
      // de la búsqueda. Cada consulta declara su propio orden.
      hooks: {
        // Normalizar antes de persistir evita duplicados por espacios sobrantes
        // y hace que la unicidad del código de barras sea real.
        beforeValidate(product) {
          if (typeof product.name === 'string') product.name = product.name.trim();
          if (typeof product.barcode === 'string') product.barcode = product.barcode.trim();
          if (typeof product.imageUrl === 'string') {
            const trimmed = product.imageUrl.trim();
            product.imageUrl = trimmed === '' ? null : trimmed;
          }
          if (typeof product.description === 'string') {
            const trimmed = product.description.trim();
            product.description = trimmed === '' ? null : trimmed;
          }
        },
      },
    },
  );

  Product.associate = (models) => {
    Product.hasMany(models.SaleItem, {
      foreignKey: 'productId',
      as: 'saleItems',
    });
  };

  /**
   * Representación pública. El precio sale siempre como string con dos
   * decimales: el driver de Postgres entrega DECIMAL como string para no perder
   * precisión y esa garantía se mantiene hasta el cliente.
   */
  Product.prototype.toJSON = function toJSON() {
    const values = { ...this.get() };
    return {
      id: values.id,
      name: values.name,
      barcode: values.barcode,
      price: toAmountString(values.price),
      description: values.description ?? null,
      imageUrl: values.imageUrl ?? null,
      isActive: values.isActive,
      createdAt: values.createdAt,
      updatedAt: values.updatedAt,
    };
  };

  return Product;
};
