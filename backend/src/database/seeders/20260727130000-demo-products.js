'use strict';

/**
 * Catálogo de ejemplo para poder probar la búsqueda y el flujo de venta sin
 * capturar productos a mano. Los códigos de barras son EAN-13 ficticios.
 */
const PRODUCTS = [
  ['Coca-Cola 600 ml', '7501055300013', '18.50', 'Refresco de cola, botella de 600 ml'],
  ['Agua natural Bonafont 1 L', '7501030000015', '14.00', 'Agua purificada, botella de 1 litro'],
  ['Sabritas original 45 g', '7501011130014', '19.50', 'Papas fritas saladas'],
  ['Galletas Emperador chocolate', '7501000670017', '22.00', 'Paquete de 91 g'],
  ['Café soluble Nescafé 50 g', '7501059280014', '68.90', 'Café soluble clásico'],
  ['Leche entera Lala 1 L', '7501020510017', '27.50', 'Leche entera pasteurizada'],
  ['Pan blanco Bimbo grande', '7501000110018', '45.00', 'Pan de caja blanco, 680 g'],
  ['Huevo blanco 12 piezas', '7501234500019', '52.00', 'Cartón de 12 huevos'],
  ['Atún en agua Dolores 140 g', '7501011100017', '21.50', 'Lata de atún aleta amarilla'],
  ['Arroz Verde Valle 1 kg', '7501008000012', '33.00', 'Arroz súper extra'],
  ['Frijol negro La Costeña 560 g', '7501039100016', '24.90', 'Frijoles negros refritos'],
  ['Aceite Capullo 850 ml', '7501026000011', '58.00', 'Aceite de canola'],
  ['Azúcar estándar 1 kg', '7501055310012', '31.50', 'Azúcar refinada'],
  ['Papel higiénico Regio 4 rollos', '7501019400013', '42.00', 'Papel higiénico doble hoja'],
  ['Jabón Zote rosa 400 g', '7501035900014', '19.00', 'Jabón de lavandería en barra'],
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();

    await queryInterface.bulkInsert(
      'products',
      PRODUCTS.map(([name, barcode, price, description]) => ({
        name,
        barcode,
        price,
        description,
        is_active: true,
        created_at: now,
        updated_at: now,
      })),
      // Si el seeder ya se corrió, no duplicar el catálogo.
      { ignoreDuplicates: true },
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('products', {
      barcode: { [Sequelize.Op.in]: PRODUCTS.map(([, barcode]) => barcode) },
    });
  },
};
