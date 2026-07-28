const { Router } = require('express');

const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const productRoutes = require('./productRoutes');
const saleRoutes = require('./saleRoutes');

const router = Router();

/**
 * Sonda de salud. Deliberadamente pública y sin datos sensibles: el frontend la
 * consulta antes de iniciar sesión para saber si la API responde.
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

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/products', productRoutes);
router.use('/sales', saleRoutes);

module.exports = router;
