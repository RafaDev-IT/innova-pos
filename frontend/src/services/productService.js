import http from './http';

/**
 * Acceso a los endpoints de productos. Los componentes nunca llaman a Axios
 * directamente: si cambia la forma de la API, solo se toca este archivo.
 */
export default {
  /**
   * @param {{ query?: string, limit?: number, offset?: number }} options
   * @returns {Promise<{ items: Array, pagination: object }>}
   */
  async search({ query = '', limit = 20, offset = 0 } = {}) {
    const params = { limit, offset };
    if (query) params.q = query;

    const response = await http.get('/products', { params });
    return { items: response.data, pagination: response.meta };
  },

  async findByBarcode(barcode) {
    const response = await http.get(`/products/barcode/${encodeURIComponent(barcode)}`);
    return response.data;
  },

  async create(payload) {
    const response = await http.post('/products', payload);
    return response.data;
  },

  async update(id, payload) {
    const response = await http.put(`/products/${id}`, payload);
    return response.data;
  },

  async remove(id) {
    await http.delete(`/products/${id}`);
  },
};
