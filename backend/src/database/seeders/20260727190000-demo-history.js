'use strict';

const { assertNotProduction } = require('../seedGuard');

/**
 * Historial simulado: 30 días de ventas con su bitácora.
 *
 * Sin datos, el tablero y los reportes se ven vacíos y no se puede juzgar si
 * funcionan. Esta simulación busca parecerse a un abarrote real, no repartir
 * números al azar:
 *
 * - Curva por hora con dos picos, mañana y tarde, y valle a media tarde.
 * - Fines de semana con más ventas que días laborables.
 * - Distribución de productos sesgada: unos pocos concentran la mayoría de las
 *   ventas, como ocurre en cualquier tienda.
 * - Reparto entre los tres usuarios, con el cajero llevando la mayor parte.
 * - Algún precio ajustado a la baja, para que el indicador correspondiente
 *   tenga casos que mostrar.
 *
 * El generador es determinista: la misma semilla produce siempre el mismo
 * historial, de modo que dos personas que ejecuten el seeder vean lo mismo y
 * cualquier captura de pantalla siga siendo válida.
 */

const DIAS = 30;
const SEMILLA = 20260727;

/** Generador congruencial lineal. Determinista y suficiente para datos de muestra. */
function crearAzar(semilla) {
  let estado = semilla;
  return () => {
    estado = (estado * 1103515245 + 12345) % 2147483648;
    return estado / 2147483648;
  };
}

/**
 * Peso relativo de cada hora de operación (8:00 a 21:00).
 * Dos picos: entrada al trabajo y salida por la tarde.
 */
const PESO_HORA = {
  8: 4, 9: 7, 10: 8, 11: 7, 12: 9, 13: 11, 14: 12,
  15: 8, 16: 6, 17: 7, 18: 10, 19: 12, 20: 9, 21: 5,
};

/** Peso por día de la semana. 0 = domingo. El fin de semana vende más. */
const PESO_DIA = { 0: 1.35, 1: 0.8, 2: 0.85, 3: 0.9, 4: 0.95, 5: 1.25, 6: 1.5 };

/** Elige un elemento según pesos. */
function elegirPesado(entradas, azar) {
  const total = entradas.reduce((suma, [, peso]) => suma + peso, 0);
  let punto = azar() * total;
  for (const [valor, peso] of entradas) {
    punto -= peso;
    if (punto <= 0) return valor;
  }
  return entradas[entradas.length - 1][0];
}

const centavos = (importe) => Math.round(Number(importe) * 100);
const aImporte = (cents) => (cents / 100).toFixed(2);

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    assertNotProduction('20260727190000-demo-history.js');

    const azar = crearAzar(SEMILLA);

    const [productos] = await queryInterface.sequelize.query(
      'SELECT id, name, barcode, price FROM products WHERE deleted_at IS NULL ORDER BY id',
    );
    const [usuarios] = await queryInterface.sequelize.query(
      "SELECT id, name, role FROM users WHERE deleted_at IS NULL AND role IN ('cashier','supervisor','admin') ORDER BY id",
    );

    if (!productos.length || !usuarios.length) {
      // eslint-disable-next-line no-console
      console.warn('  ⚠ Se requieren productos y usuarios antes de generar el historial. Omitido.');
      return;
    }

    // Sesgo de popularidad: los primeros productos del catálogo se venden más.
    const pesoProducto = productos.map((p, i) => [p, Math.max(1, 20 - i * 1.2)]);

    // El cajero atiende la mayor parte del mostrador.
    const pesoUsuario = usuarios.map((u) => [u, u.role === 'cashier' ? 6 : u.role === 'supervisor' ? 3 : 1]);

    const ventas = [];
    const renglones = [];
    const bitacora = [];

    // El folio continúa desde donde esté la secuencia para no chocar con ventas
    // registradas a mano antes de sembrar.
    const [[{ last_value: ultimoFolio }]] = await queryInterface.sequelize.query(
      'SELECT last_value FROM sales_folio_seq',
    );
    let folio = Number(ultimoFolio);

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    for (let diasAtras = DIAS - 1; diasAtras >= 0; diasAtras -= 1) {
      const dia = new Date(hoy);
      dia.setDate(dia.getDate() - diasAtras);

      const factorDia = PESO_DIA[dia.getDay()];
      // Entre 8 y 26 tickets diarios, modulado por el día de la semana.
      const tickets = Math.round((8 + azar() * 18) * factorDia);

      for (let t = 0; t < tickets; t += 1) {
        const hora = Number(elegirPesado(Object.entries(PESO_HORA).map(([h, p]) => [h, p]), azar));
        const momento = new Date(dia);
        momento.setHours(hora, Math.floor(azar() * 60), Math.floor(azar() * 60), 0);

        const usuario = elegirPesado(pesoUsuario, azar);
        const cuantos = 1 + Math.floor(azar() * 4); // De 1 a 4 productos por ticket.

        const elegidos = [];
        for (let i = 0; i < cuantos; i += 1) {
          const producto = elegirPesado(pesoProducto, azar);
          if (!elegidos.some((e) => e.id === producto.id)) elegidos.push(producto);
        }

        folio += 1;
        const idVenta = ventas.length + 1;
        let subtotalCents = 0;
        let unidades = 0;

        for (const producto of elegidos) {
          const cantidad = 1 + Math.floor(azar() * 3);
          let precioCents = centavos(producto.price);

          // Uno de cada doce renglones lleva precio ajustado a la baja, para que
          // el indicador de precio modificado tenga casos reales que mostrar.
          if (azar() < 0.08) {
            precioCents = Math.max(100, Math.round(precioCents * (0.8 + azar() * 0.15)));
          }

          const importe = precioCents * cantidad;
          subtotalCents += importe;
          unidades += cantidad;

          renglones.push({
            sale_id: idVenta,
            product_id: producto.id,
            product_name: producto.name,
            product_barcode: producto.barcode,
            unit_price: aImporte(precioCents),
            quantity: cantidad,
            line_total: aImporte(importe),
            created_at: momento,
            updated_at: momento,
          });
        }

        ventas.push({
          folio: `V-${String(folio).padStart(6, '0')}`,
          subtotal: aImporte(subtotalCents),
          total: aImporte(subtotalCents),
          status: 'completed',
          item_count: unidades,
          sold_at: momento,
          user_id: usuario.id,
          user_name: usuario.name,
          created_at: momento,
          updated_at: momento,
        });

        bitacora.push({
          user_id: usuario.id,
          user_name: usuario.name,
          action: 'sale.create',
          entity_type: 'sale',
          entity_id: idVenta,
          summary: `Registró la venta V-${String(folio).padStart(6, '0')} por ${aImporte(subtotalCents)} (${unidades} artículos)`,
          metadata: JSON.stringify({
            folio: `V-${String(folio).padStart(6, '0')}`,
            total: aImporte(subtotalCents),
            itemCount: unidades,
          }),
          ip_address: '127.0.0.1',
          created_at: momento,
        });
      }

      // Un inicio de sesión por usuario al abrir la tienda.
      for (const usuario of usuarios) {
        const entrada = new Date(dia);
        entrada.setHours(7, 40 + Math.floor(azar() * 20), 0, 0);
        bitacora.push({
          user_id: usuario.id,
          user_name: usuario.name,
          action: 'auth.login',
          entity_type: 'user',
          entity_id: usuario.id,
          summary: `${usuario.name} inició sesión`,
          metadata: null,
          ip_address: '127.0.0.1',
          created_at: entrada,
        });
      }
    }

    // Algunos movimientos de catálogo repartidos, para que la bitácora no sea
    // solo ventas e inicios de sesión.
    const admin = usuarios.find((u) => u.role === 'admin') || usuarios[0];
    const supervisor = usuarios.find((u) => u.role === 'supervisor') || usuarios[0];

    for (let i = 0; i < 8; i += 1) {
      const producto = productos[Math.floor(azar() * productos.length)];
      const cuando = new Date(hoy);
      cuando.setDate(cuando.getDate() - Math.floor(azar() * DIAS));
      cuando.setHours(9 + Math.floor(azar() * 9), Math.floor(azar() * 60), 0, 0);

      const anterior = aImporte(Math.round(centavos(producto.price) * (0.85 + azar() * 0.1)));
      bitacora.push({
        user_id: supervisor.id,
        user_name: supervisor.name,
        action: 'product.update',
        entity_type: 'product',
        entity_id: producto.id,
        summary: `Editó "${producto.name}": precio ${anterior} → ${producto.price}`,
        metadata: JSON.stringify({
          before: { name: producto.name, price: anterior },
          after: { name: producto.name, price: producto.price },
        }),
        ip_address: '127.0.0.1',
        created_at: cuando,
      });
    }

    const altaUsuario = new Date(hoy);
    altaUsuario.setDate(altaUsuario.getDate() - DIAS + 1);
    altaUsuario.setHours(8, 15, 0, 0);
    bitacora.push({
      user_id: admin.id,
      user_name: admin.name,
      action: 'user.create',
      entity_type: 'user',
      entity_id: supervisor.id,
      summary: `Creó al usuario "${supervisor.name}" con rol supervisor`,
      metadata: JSON.stringify({ role: 'supervisor' }),
      ip_address: '127.0.0.1',
      created_at: altaUsuario,
    });

    await queryInterface.bulkInsert('sales', ventas);
    await queryInterface.bulkInsert('sale_items', renglones);
    await queryInterface.bulkInsert('audit_log', bitacora);

    // La secuencia debe quedar por delante del último folio generado, o la
    // próxima venta real chocaría con la restricción de unicidad.
    await queryInterface.sequelize.query(`SELECT setval('sales_folio_seq', ${folio}, true)`);
    await queryInterface.sequelize.query(
      `SELECT setval('sales_id_seq', ${ventas.length}, true)`,
    );
    await queryInterface.sequelize.query(
      `SELECT setval('sale_items_id_seq', ${renglones.length}, true)`,
    );

    // eslint-disable-next-line no-console
    console.log(
      `  ✔ Historial simulado: ${ventas.length} ventas, ${renglones.length} renglones y ${bitacora.length} entradas de bitácora en ${DIAS} días`,
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('audit_log', null, {});
    await queryInterface.bulkDelete('sale_items', null, {});
    await queryInterface.bulkDelete('sales', null, {});
    await queryInterface.sequelize.query("SELECT setval('sales_folio_seq', 1, false)");
  },
};
