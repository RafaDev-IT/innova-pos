const { toAmountString } = require('../utils/money');

module.exports = (sequelize, DataTypes) => {
  const SaleItem = sequelize.define(
    'SaleItem',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      saleId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      productId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },

      // Copia del producto al momento de la venta: preserva el histórico aunque
      // el producto se edite o se dé de baja después.
      productName: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },
      productBarcode: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      unitPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
          min: { args: [0], msg: 'El precio unitario no puede ser negativo' },
        },
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        validate: {
          min: { args: [1], msg: 'La cantidad debe ser al menos 1' },
        },
      },
      lineTotal: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
    },
    {
      tableName: 'sale_items',
    },
  );

  SaleItem.associate = (models) => {
    SaleItem.belongsTo(models.Sale, { foreignKey: 'saleId', as: 'sale' });
    SaleItem.belongsTo(models.Product, { foreignKey: 'productId', as: 'product' });
  };

  SaleItem.prototype.toJSON = function toJSON() {
    const values = { ...this.get() };
    return {
      id: values.id,
      saleId: values.saleId,
      productId: values.productId,
      productName: values.productName,
      productBarcode: values.productBarcode,
      unitPrice: toAmountString(values.unitPrice),
      quantity: values.quantity,
      lineTotal: toAmountString(values.lineTotal),
    };
  };

  return SaleItem;
};
