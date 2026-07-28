require('dotenv').config();

const env = process.env.NODE_ENV || 'development';

/**
 * Secreto de firma de los tokens.
 *
 * En producción es obligatorio definirlo: arrancar con un valor por defecto
 * conocido equivaldría a no tener autenticación, porque cualquiera podría
 * fabricar tokens válidos. En desarrollo y pruebas se permite un valor fijo
 * para no complicar la puesta en marcha.
 */
function resolveJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (secret && secret.length >= 32) return secret;

  if (env === 'production') {
    throw new Error(
      'JWT_SECRET es obligatorio en producción y debe tener al menos 32 caracteres. ' +
        'Genera uno con: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"',
    );
  }

  if (secret) {
    // eslint-disable-next-line no-console
    console.warn('⚠ JWT_SECRET es demasiado corto (mínimo 32 caracteres); se usa el valor de desarrollo.');
  }

  return 'clave-de-desarrollo-no-usar-en-produccion-innova-pos';
}

module.exports = {
  env,
  port: Number(process.env.PORT || 3000),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  /**
   * Zona horaria del negocio.
   *
   * Las marcas de tiempo se guardan en UTC, pero un reporte por hora tiene que
   * responder "¿a qué hora vendió la tienda?", no "¿a qué hora fue en UTC?".
   * Agregar sin convertir desplaza toda la curva —seis horas en El Salvador— y
   * hace que el pico de la tarde aparezca de madrugada.
   *
   * El Salvador es UTC-6 todo el año, sin horario de verano, así que la
   * conversión es constante.
   */
  businessTimezone: process.env.BUSINESS_TIMEZONE || 'America/El_Salvador',
  jwt: {
    secret: resolveJwtSecret(),
    // Ocho horas: la duración de un turno de caja. Al terminar la jornada la
    // sesión caduca sola.
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },
};
