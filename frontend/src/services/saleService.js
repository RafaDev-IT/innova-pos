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

  async list({ limit = 20, offset = 0 } = {}) {
    const response = await http.get('/sales', { params: { limit, offset } });
    return { items: response.data, pagination: response.meta };
  },
};
