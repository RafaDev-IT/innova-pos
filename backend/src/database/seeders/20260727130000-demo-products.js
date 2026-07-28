'use strict';

/**
 * Catálogo de ejemplo para poder probar la búsqueda y el flujo de venta sin
 * capturar productos a mano. Los códigos de barras son EAN-13 ficticios.
 *
 * Las imágenes apuntan a Unsplash, de uso libre. Si no hay conexión, la interfaz
 * cae en la portada generada a partir del nombre, así que el catálogo se ve
 * correcto igualmente.
 */
const PRODUCTS = [
  // [nombre, código de barras, precio, descripción, imagen]
  ['Coca-Cola 600 ml', '7501055300013', '18.50', 'Refresco de cola, botella de 600 ml', 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=500&q=80'],
  ['Agua natural Bonafont 1 L', '7501030000015', '14.00', 'Agua purificada, botella de 1 litro', 'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=500&q=80'],
  ['Sabritas original 45 g', '7501011130014', '19.50', 'Papas fritas saladas', 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=500&q=80'],
  ['Galletas Emperador chocolate', '7501000670017', '22.00', 'Paquete de 91 g', 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=500&q=80'],
  ['Café soluble Nescafé 50 g', '7501059280014', '68.90', 'Café soluble clásico', 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=500&q=80'],
  ['Leche entera Lala 1 L', '7501020510017', '27.50', 'Leche entera pasteurizada', 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500&q=80'],
  ['Pan blanco Bimbo grande', '7501000110018', '45.00', 'Pan de caja blanco, 680 g', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&q=80'],
  ['Huevo blanco 12 piezas', '7501234500019', '52.00', 'Cartón de 12 huevos', 'https://images.unsplash.com/photo-1518569656558-1f25e69d93d7?w=500&q=80'],
  ['Atún en agua Dolores 140 g', '7501011100017', '21.50', 'Lata de atún aleta amarilla', 'https://images.unsplash.com/photo-1611171711912-e3f6b536f532?w=500&q=80'],
  ['Arroz Verde Valle 1 kg', '7501008000012', '33.00', 'Arroz súper extra', 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500&q=80'],
  ['Frijol negro La Costeña 560 g', '7501039100016', '24.90', 'Frijoles negros refritos', null],
  ['Aceite Capullo 850 ml', '7501026000011', '58.00', 'Aceite de canola', 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=500&q=80'],
  ['Azúcar estándar 1 kg', '7501055310012', '31.50', 'Azúcar refinada', 'https://images.unsplash.com/photo-1610725664285-7c57e6eeac3f?w=500&q=80'],
  ['Papel higiénico Regio 4 rollos', '7501019400013', '42.00', 'Papel higiénico doble hoja', 'https://images.unsplash.com/photo-1584556812952-905ffd0c611a?w=500&q=80'],
  ['Jabón Zote rosa 400 g', '7501035900014', '19.00', 'Jabón de lavandería en barra', 'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=500&q=80'],
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();

    await queryInterface.bulkInsert(
      'products',
      PRODUCTS.map(([name, barcode, price, description, imageUrl]) => ({
        name,
        barcode,
        price,
        description,
        image_url: imageUrl,
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
