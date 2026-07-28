const { toAmountString } = require('../utils/money');

module.exports = (sequelize, DataTypes) => {
  const Sale = sequelize.define(
    'Sale',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      folio: {
        type: DataTypes.STRING(20),
        allowNull: false,
        unique: true,
      },
      subtotal: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      total: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      status: {
        type: DataTypes.ENUM('completed', 'cancelled'),
        allowNull: false,
        defaultValue: 'completed',
      },
      itemCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      soldAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      // Copia del nombre del cajero al momento de la venta, por el mismo motivo
      // que en sale_items: el histórico debe seguir siendo legible aunque el
      // usuario cambie de nombre o se dé de baja.
      userName: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      cancelledAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      cancelledById: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      cancelledByName: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      cancelReason: {
        type: DataTypes.STRING(300),
        allowNull: true,
      },
    },
    {
      tableName: 'sales',
    },
  );

  Sale.associate = (models) => {
    Sale.hasMany(models.SaleItem, {
      foreignKey: 'saleId',
      as: 'items',
      onDelete: 'CASCADE',
    });
    Sale.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    Sale.belongsTo(models.User, { foreignKey: 'cancelledById', as: 'cancelledBy' });
  };

  Sale.prototype.toJSON = function toJSON() {
    const values = { ...this.get() };
    return {
      id: values.id,
      folio: values.folio,
      subtotal: toAmountString(values.subtotal),
      total: toAmountString(values.total),
      status: values.status,
      itemCount: values.itemCount,
      soldAt: values.soldAt,
      userId: values.userId ?? null,
      userName: values.userName ?? null,
      // Los datos de cancelación solo viajan cuando la venta está cancelada:
      // cuatro campos nulos en cada venta del histórico son ruido.
      ...(values.status === 'cancelled'
        ? {
            cancelledAt: values.cancelledAt,
            cancelledById: values.cancelledById ?? null,
            cancelledByName: values.cancelledByName ?? null,
            cancelReason: values.cancelReason ?? null,
          }
        : {}),
      createdAt: values.createdAt,
      // `items` solo viaja cuando la consulta lo incluye explícitamente.
      ...(values.items ? { items: values.items } : {}),
    };
  };

  return Sale;
};
