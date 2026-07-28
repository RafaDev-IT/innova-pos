'use strict';

/**
 * Freno para las semillas de demostración.
 *
 * Los seeders `demo-*` existen para poder evaluar el sistema: catálogo de
 * ejemplo, tres usuarios con contraseñas conocidas y treinta días de ventas
 * inventadas. Nada de eso debe existir en una instalación real —el historial
 * falso contamina los reportes y las contraseñas están publicadas en el
 * repositorio—, así que se niegan a ejecutarse cuando NODE_ENV es production.
 *
 * Si alguna vez hiciera falta poblar un entorno productivo con datos de prueba
 * (una capacitación, por ejemplo), la salida explica cómo forzarlo de manera
 * consciente. Ese es el punto: que sea una decisión y no un descuido.
 */
function assertNotProduction(nombre) {
  const entorno = process.env.NODE_ENV;

  if (entorno !== 'production' || process.env.ALLOW_DEMO_SEED === 'yes-i-know') {
    return false;
  }

  throw new Error(
    [
      '',
      `  ✖ "${nombre}" es una semilla de DEMOSTRACIÓN y NODE_ENV=production.`,
      '',
      '    Contiene datos ficticios (catálogo, usuarios con contraseñas',
      '    públicas e historial de ventas inventado) que falsearían los',
      '    reportes de un negocio real.',
      '',
      '    Para una instalación productiva:  npm run db:seed:prod',
      '    Para forzar esto de todas formas:  ALLOW_DEMO_SEED=yes-i-know',
      '',
    ].join('\n'),
  );
}

module.exports = { assertNotProduction };
