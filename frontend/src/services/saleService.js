import http from './http';

export default {
  /**
   * Registra la venta. Solo se envía lo que el servidor no puede deducir:
   * qué producto, a qué precio se cobró y cuántas unidades. El total lo
   * calcula el backend, nunca se manda desde aquí.
   *
   * @param {Array<{productId: number, unitPrice: string, quantity: number}>} items
   */
  async create(items) {
    const response = await http.post('/sales', {
      items: items.map((item) => ({
        productId: item.productId,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
      })),
    });
    return response.data;
  },

  async findById(id) {
    const response = await http.get(`/sales/${id}`);
    return response.data;
  },

  async list({ limit = 20, offset = 0, folio = null, from = null, to = null, userId = null, status = null } = {}) {
    const params = { limit, offset };
    // Solo se envían los filtros con valor: un parámetro vacío haría que el
    // validador del servidor lo rechace por formato.
    if (folio) params.folio = folio;
    if (from) params.from = from;
    if (to) params.to = to;
    if (userId) params.userId = userId;
    if (status) params.status = status;

    const response = await http.get('/sales', { params });
    return { items: response.data, pagination: response.meta };
  },

  async cancel(id, reason) {
    const response = await http.post(`/sales/${id}/cancel`, { reason });
    return response.data;
  },
};
