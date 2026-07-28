<template>
  <v-container fluid class="pa-4 page">
    <v-alert v-if="errorMessage" type="error" dense text class="mb-4">{{ errorMessage }}</v-alert>

    <div v-if="loading && !data" class="dash__grid-kpi mb-4">
      <v-skeleton-loader v-for="n in 4" :key="n" type="card" class="card" />
    </div>

    <template v-if="data">
      <!-- Fila de indicadores. Cifras sueltas, no una gráfica de una sola barra. -->
      <div class="dash__grid-kpi mb-4">
        <StatTile
          label="Facturado hoy"
          :value="formatCurrency(data.summary.total)"
          :delta="data.summary.change.total"
          caption="vs ayer"
        />
        <StatTile
          label="Tickets"
          :value="formatNumber(data.summary.ticketCount)"
          :delta="data.summary.change.ticketCount"
          caption="vs ayer"
        />
        <StatTile
          label="Ticket promedio"
          :value="formatCurrency(data.summary.averageTicket)"
          :delta="data.summary.change.averageTicket"
          caption="vs ayer"
        />
        <StatTile
          label="Artículos vendidos"
          :value="formatNumber(data.summary.itemCount)"
          caption="unidades en el día"
        />
      </div>

      <div class="dash__grid-main">
        <div>
          <!-- Ventas por hora -->
          <div class="panel mb-4">
            <header class="panel__head">
              <div>
                <div class="panel__title">Ventas por hora</div>
                <div class="panel__sub">{{ fechaLarga }} · hora de El Salvador</div>
              </div>
              <v-spacer />
              <v-btn-toggle v-model="modoHoras" dense mandatory class="toggle-soft">
                <v-btn small value="total">Importe</v-btn>
                <v-btn small value="tickets">Tickets</v-btn>
              </v-btn-toggle>
            </header>
            <div class="px-4 pb-3">
              <ColumnChart
                :points="puntosHora"
                :format="formatoHoras"
                :aria-label="`Ventas por hora del ${data.date}`"
                :height="230"
              />
              <!-- Alternativa en tabla: el canal accesible cuando la forma o el
                   color no llegan. -->
              <details class="dash__table">
                <summary>Ver los datos en tabla</summary>
                <table class="data-table mt-2">
                  <thead>
                    <tr><th>Hora</th><th class="num">Tickets</th><th class="num">Importe</th></tr>
                  </thead>
                  <tbody>
                    <tr v-for="h in horasConVenta" :key="h.hour">
                      <td>{{ h.label }}</td>
                      <td class="num">{{ h.tickets }}</td>
                      <td class="num">{{ formatCurrency(h.total) }}</td>
                    </tr>
                  </tbody>
                </table>
              </details>
            </div>
          </div>

          <!-- Tendencia de los últimos días -->
          <div class="panel">
            <header class="panel__head">
              <div>
                <div class="panel__title">Tendencia</div>
                <div class="panel__sub">Facturación de los últimos 14 días</div>
              </div>
            </header>
            <div class="px-4 pb-3">
              <ColumnChart
                v-if="trend"
                :points="puntosTendencia"
                :format="formatCurrencyCompact"
                aria-label="Facturación de los últimos 14 días"
                :height="190"
              />
              <v-skeleton-loader v-else type="image" />
            </div>
          </div>
        </div>

        <div>
          <!-- Productos más vendidos -->
          <div class="panel mb-4">
            <header class="panel__head">
              <div class="panel__title">Más vendidos hoy</div>
            </header>
            <div class="px-4 pb-4">
              <div v-if="!data.topProducts.length" class="empty py-6">
                <div class="empty__hint">Sin ventas todavía hoy.</div>
              </div>
              <div v-for="(p, i) in data.topProducts" v-else :key="p.productId || p.name" class="rank">
                <span class="rank__pos">{{ i + 1 }}</span>
                <div class="rank__body">
                  <div class="rank__name" :title="p.name">{{ p.name }}</div>
                  <div class="rank__track">
                    <div class="rank__fill" :style="{ width: `${anchoBarra(p)}%` }" />
                  </div>
                </div>
                <span class="rank__value">{{ p.quantity }} u</span>
              </div>
            </div>
          </div>

          <!-- Ventas por cajero -->
          <div class="panel mb-4">
            <header class="panel__head">
              <div class="panel__title">Por cajero</div>
            </header>
            <div class="px-4 pb-3">
              <table v-if="data.salesByUser.length" class="data-table">
                <thead>
                  <tr><th>Cajero</th><th class="num">Tickets</th><th class="num">Total</th></tr>
                </thead>
                <tbody>
                  <tr v-for="u in data.salesByUser" :key="u.userId || u.name">
                    <td>{{ u.name }}</td>
                    <td class="num">{{ u.ticketCount }}</td>
                    <td class="num">{{ formatCurrency(u.total) }}</td>
                  </tr>
                </tbody>
              </table>
              <div v-else class="empty py-6">
                <div class="empty__hint">Sin ventas registradas hoy.</div>
              </div>
            </div>
          </div>

          <!-- Actividad reciente -->
          <div class="panel">
            <header class="panel__head">
              <div>
                <div class="panel__title">Actividad reciente</div>
                <div class="panel__sub">Quién hizo qué en el sistema</div>
              </div>
              <v-spacer />
              <v-btn v-if="puedeVerBitacora" icon small title="Actualizar" @click="cargar">
                <v-icon size="18">mdi-refresh</v-icon>
              </v-btn>
            </header>
            <div class="px-4 pb-3 dash__activity scroll">
              <ActivityFeed :entries="data.recentActivity" />
            </div>
          </div>
        </div>
      </div>
    </template>
  </v-container>
</template>

<script>
import analyticsService from '@/services/analyticsService';
import session from '@/store/session';
import { PERMISSIONS } from '@/config/permissions';
import StatTile from '@/components/StatTile.vue';
import ActivityFeed from '@/components/ActivityFeed.vue';
import ColumnChart from '@/components/charts/ColumnChart.vue';
import { formatCurrency, formatCurrencyCompact, formatNumber, formatDate } from '@/utils/format';

export default {
  name: 'DashboardView',

  components: { StatTile, ActivityFeed, ColumnChart },

  data: () => ({
    data: null,
    trend: null,
    loading: false,
    errorMessage: '',
    modoHoras: 'total',
  }),

  computed: {
    puedeVerBitacora() {
      return session.can(PERMISSIONS.AUDIT_VIEW);
    },

    fechaLarga() {
      if (!this.data) return '';
      return formatDate(this.data.date);
    },

    /** Solo el tramo con actividad, para no dibujar doce columnas en cero. */
    horasConVenta() {
      if (!this.data) return [];
      const conVenta = this.data.salesByHour.filter((h) => h.tickets > 0);
      if (!conVenta.length) return this.data.salesByHour.slice(7, 22);

      const primera = this.data.salesByHour.findIndex((h) => h.tickets > 0);
      const ultima = this.data.salesByHour.length - 1 - [...this.data.salesByHour].reverse().findIndex((h) => h.tickets > 0);
      return this.data.salesByHour.slice(Math.max(0, primera - 1), Math.min(24, ultima + 2));
    },

    puntosHora() {
      return this.horasConVenta.map((h) => ({
        label: h.label,
        value: this.modoHoras === 'total' ? Number(h.total) : h.tickets,
        caption: this.modoHoras === 'total' ? `${h.tickets} tickets` : formatCurrency(h.total),
      }));
    },

    puntosTendencia() {
      if (!this.trend) return [];
      return this.trend.series.map((d) => ({
        label: formatDate(d.date),
        value: Number(d.total),
        caption: `${d.tickets} tickets`,
      }));
    },
  },

  created() {
    this.cargar();
  },

  methods: {
    formatCurrency,
    formatCurrencyCompact,
    formatNumber,

    formatoHoras(valor) {
      return this.modoHoras === 'total' ? formatCurrencyCompact(valor) : formatNumber(Math.round(valor));
    },

    /** Proporción respecto al más vendido, para la barra del ranking. */
    anchoBarra(producto) {
      const mayor = Math.max(...this.data.topProducts.map((p) => p.quantity), 1);
      return Math.max(4, (producto.quantity / mayor) * 100);
    },

    async cargar() {
      this.loading = true;
      this.errorMessage = '';
      try {
        // Las dos peticiones son independientes: se lanzan a la vez.
        const [tablero, tendencia] = await Promise.all([
          analyticsService.dashboard(),
          analyticsService.trend(14),
        ]);
        this.data = tablero;
        this.trend = tendencia;
      } catch (error) {
        this.errorMessage = error.message;
        this.$emit('error', error);
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<style scoped>
.page {
  max-width: 1500px;
}

.dash__grid-kpi {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 16px;
}

.dash__grid-main {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

@media (max-width: 1279px) {
  .dash__grid-main {
    grid-template-columns: 1fr;
  }
}

.dash__activity {
  max-height: 340px;
  overflow-y: auto;
}

.dash__table > summary {
  font-size: 0.75rem;
  color: var(--pos-text-faint);
  cursor: pointer;
  padding: 6px 0 0;
  user-select: none;
}
.dash__table > summary:hover {
  color: var(--pos-primary);
}

.toggle-soft {
  border-radius: var(--r-md) !important;
  overflow: hidden;
}
.toggle-soft .v-btn {
  text-transform: none !important;
  font-size: 0.75rem !important;
  height: 30px !important;
}
</style>
