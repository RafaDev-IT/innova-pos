'use strict';

/**
 * Catálogo de ejemplo para poder probar la búsqueda y el flujo de venta sin
 * capturar productos a mano.
 *
 * Marcas y precios corresponden a una tienda de barrio de El Salvador, que usa
 * el dólar estadounidense. Los precios siguen la escala real del país: una
 * gaseosa de 600 ml ronda los $0.75, no los $18 de un catálogo mexicano. Un
 * precio fuera de escala se nota de inmediato y resta credibilidad a cualquier
 * demostración.
 *
 * Los códigos de barras son EAN-13 ficticios con prefijo 741, el que GS1 asigna
 * a El Salvador.
 *
 * Las imágenes son de Unsplash, de uso libre, y se verificaron una a una
 * mirándolas: comprobar solo el código de respuesta confirma que la URL existe,
 * no que la fotografía sea la correcta. Cuando falta, la interfaz genera una
 * portada a partir del nombre.
 */
const PRODUCTS = [
  // [nombre, código de barras, precio, descripción, imagen]
  ['Coca-Cola 600 ml', '7410010000015', '0.75', 'Gaseosa de cola, botella de 600 ml', 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=500&q=80'],
  ['Agua Cristal 1 L', '7410010000022', '0.60', 'Agua purificada, botella de 1 litro', 'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=500&q=80'],
  ['Boquitas Diana 45 g', '7410010000039', '0.85', 'Papas fritas saladas', 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=500&q=80'],
  ['Galletas Diana chocolate', '7410010000046', '1.10', 'Paquete de 90 g', 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=500&q=80'],
  ['Café Listo 50 g', '7410010000053', '2.85', 'Café soluble salvadoreño', 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=500&q=80'],
  ['Leche Salud entera 1 L', '7410010000060', '1.25', 'Leche entera pasteurizada', 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500&q=80'],
  ['Pan Bimbo blanco grande', '7410010000077', '2.10', 'Pan de caja blanco, 680 g', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&q=80'],
  ['Huevos de gallina 12 unidades', '7410010000084', '2.40', 'Cartón de 12 huevos', 'https://images.unsplash.com/photo-1518569656558-1f25e69d93d7?w=500&q=80'],
  ['Atún Calvo en agua 140 g', '7410010000091', '1.15', 'Lata de atún aleta amarilla', 'https://images.unsplash.com/photo-1611171711912-e3f6b536f532?w=500&q=80'],
  ['Arroz Sabemás 1 kg', '7410010000107', '1.35', 'Arroz precocido de primera', 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500&q=80'],
  ['Frijol rojo de seda 1 lb', '7410010000114', '1.20', 'Frijol rojo seleccionado', null],
  ['Aceite Capullo 850 ml', '7410010000121', '2.95', 'Aceite vegetal', 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=500&q=80'],
  ['Azúcar blanca 1 kg', '7410010000138', '1.05', 'Azúcar refinada', 'https://images.unsplash.com/photo-1610725664285-7c57e6eeac3f?w=500&q=80'],
  ['Papel higiénico Nevax 4 rollos', '7410010000145', '1.95', 'Papel higiénico doble hoja', 'https://images.unsplash.com/photo-1584556812952-905ffd0c611a?w=500&q=80'],
  ['Jabón de lavar en barra 400 g', '7410010000152', '1.05', 'Jabón de lavandería', 'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=500&q=80'],
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
