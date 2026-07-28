module.exports = (sequelize, DataTypes) => {
  const AuditEntry = sequelize.define(
    'AuditEntry',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      userId: { type: DataTypes.INTEGER, allowNull: true },
      userName: { type: DataTypes.STRING(120), allowNull: true },
      action: { type: DataTypes.STRING(60), allowNull: false },
      entityType: { type: DataTypes.STRING(40), allowNull: true },
      entityId: { type: DataTypes.INTEGER, allowNull: true },
      summary: { type: DataTypes.STRING(300), allowNull: false },
      metadata: { type: DataTypes.JSONB, allowNull: true },
      ipAddress: { type: DataTypes.STRING(45), allowNull: true },
    },
    {
      tableName: 'audit_log',
      // La bitácora no se modifica nunca: una entrada corregible no sirve como
      // evidencia. Por eso no lleva updatedAt.
      updatedAt: false,
    },
  );

  AuditEntry.associate = (models) => {
    AuditEntry.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  };

  AuditEntry.prototype.toJSON = function toJSON() {
    const values = { ...this.get() };
    return {
      id: values.id,
      userId: values.userId ?? null,
      userName: values.userName ?? 'Sistema',
      action: values.action,
      entityType: values.entityType ?? null,
      entityId: values.entityId ?? null,
      summary: values.summary,
      metadata: values.metadata ?? null,
      createdAt: values.createdAt,
    };
  };

  return AuditEntry;
};
