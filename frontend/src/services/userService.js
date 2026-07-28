import http from './http';

export default {
  async search({ query = '', role = null, limit = 20, offset = 0 } = {}) {
    const params = { limit, offset };
    if (query) params.q = query;
    if (role) params.role = role;

    const response = await http.get('/users', { params });
    return { items: response.data, pagination: response.meta };
  },

  async create(payload) {
    const response = await http.post('/users', payload);
    return response.data;
  },

  async update(id, payload) {
    const response = await http.put(`/users/${id}`, payload);
    return response.data;
  },

  async remove(id) {
    await http.delete(`/users/${id}`);
  },
};
