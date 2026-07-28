import http from './http';

export default {
  async dashboard(date = null) {
    const response = await http.get('/dashboard', { params: date ? { date } : {} });
    return response.data;
  },

  async trend(days = 14) {
    const response = await http.get('/dashboard/trend', { params: { days } });
    return response.data;
  },

  async salesReport({ from = null, to = null } = {}) {
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;

    const response = await http.get('/reports/sales', { params });
    return response.data;
  },

  /**
   * Descarga un CSV.
   *
   * Se pide como blob y se dispara con un enlace temporal en lugar de navegar
   * a la URL: la petición debe llevar la cabecera de autorización, y una
   * navegación directa no la incluye.
   */
  async downloadCsv(recurso, { from = null, to = null } = {}) {
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;

    const blob = await http.get(`/reports/${recurso}.csv`, { params, responseType: 'blob' });

    const url = window.URL.createObjectURL(new Blob([blob], { type: 'text/csv;charset=utf-8' }));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `${recurso}_${from || 'inicio'}_${to || 'hoy'}.csv`;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    window.URL.revokeObjectURL(url);
  },
};
