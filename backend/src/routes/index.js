const { Router } = require('express');

const router = Router();

/**
 * Sonda de salud. Sirve para el healthcheck de despliegue y para que el
 * frontend confirme que la API está arriba antes de mostrar errores de red.
 */
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      service: 'innova-pos-api',
      timestamp: new Date().toISOString(),
    },
  });
});

module.exports = router;
