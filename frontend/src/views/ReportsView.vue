<template>
  <v-container fluid class="pa-4 page">
    <!-- Los filtros van en una sola fila sobre las gráficas, no repartidos. -->
    <div class="card pa-3 mb-4 filters">
      <div class="filters__presets">
        <button
          v-for="preset in presets"
          :key="preset.days"
          type="button"
          class="preset"
          :class="{ 'preset--active': presetActivo === preset.days }"
          @click="aplicarPreset(preset)"
        >
          <v-icon v-if="presetActivo === preset.days" size="15" color="primary">mdi-check</v-icon>
          {{ preset.label }}
        </button>
      </div>

      <v-spacer />

      <div class="filters__range">
        <v-text-field v-model="from" type="date" label="Desde" outlined dense hide-details style="max-width: 168px" @change="presetActivo = null; cargar()" />
        <span class="mx-2 text--secondary">→</span>
        <v-text-field v-model="to" type="date" label="Hasta" outlined dense hide-details style="max-width: 168px" @change="presetActivo = null; cargar()" />
      </div>

      <v-menu offset-y left>
        <template #activator="{ on, attrs }">
          <v-btn depressed class="btn-soft ml-3" v-bind="attrs" :loading="descargando" v-on="on">
            <v-icon left size="18">mdi-download-outline</v-icon>
            Exportar
          </v-btn>
        </template>
        <v-list dense>
          <v-list-item @click="exportar('sales')">
            <v-list-item-icon class="mr-3"><v-icon size="18">mdi-calendar-range</v-icon></v-list-item-icon>
            <v-list-item-title>Ventas por día (CSV)</v-list-item-title>
          </v-list-item>
          <v-list-item @click="exportar('products')">
            <v-list-item-icon class="mr-3"><v-icon size="18">mdi-package-variant</v-icon></v-list-item-icon>
            <v-list-item-title>Detalle por producto (CSV)</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
    </div>

    <v-alert v-if="errorMessage" type="error" dense text class="mb-4">{{ errorMessage }}</v-alert>

    <div v-if="loading && !data" class="grid-kpi mb-4">
      <v-skeleton-loader v-for="n in 4" :key="n" type="card" class="card" />
    </div>

    <template v-if="data">
      <div class="grid-kpi mb-4">
        <StatTile label="Facturado" :value="formatCurrency(data.summary.total)" :caption="`${data.days} días`" />
        <StatTile label="Tickets" :value="formatNumber(data.summary.ticketCount)" caption="ventas registradas" />
        <StatTile label="Ticket promedio" :value="formatCurrency(data.summary.averageTicket)" caption="por venta" />
        <StatTile label="Artículos" :value="formatNumber(data.summary.itemCount)" caption="unidades vendidas" />
      </div>

      <div class="grid-two">
        <div>
          <div class="panel mb-4">
            <header class="panel__head">
              <div>
                <div class="panel__title">Facturación diaria</div>
                <div class="panel__sub">{{ formatDate(data.from) }} — {{ formatDate(data.to) }}</div>
              </div>
            </header>
            <div class="px-4 pb-3">
              <ColumnChart
                :points="puntosDiarios"
                :format="formatCurrencyCompact"
                aria-label="Facturación por día del período"
                :height="240"
              />
            </div>
          </div>

          <div class="panel">
            <header class="panel__head">
              <div class="panel__title">Productos más vendidos</div>
              <v-spacer />
              <span class="chip-soft">{{ data.byProduct.length }}</span>
            </header>
            <div class="px-4 pb-3 tabla-scroll scroll">
              <table class="data-table">
                <thead>
                  <tr><th>Producto</th><th class="num">Unidades</th><th class="num">Total</th></tr>
                </thead>
                <tbody>
                  <tr v-for="p in data.byProduct" :key="p.productId || p.name">
                    <td>
                      {{ p.name }}
                      <div class="code">{{ p.barcode }}</div>
                    </td>
                    <td class="num">{{ p.quantity }}</td>
                    <td class="num">{{ formatCurrency(p.total) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div>
          <div class="panel mb-4">
            <header class="panel__head">
              <div class="panel__title">Desempeño por cajero</div>
            </header>
            <div class="px-4 pb-3">
              <table class="data-table">
                <thead>
                  <tr><th>Cajero</th><th class="num">Tickets</th><th class="num">Promedio</th><th class="num">Total</th></tr>
                </thead>
                <tbody>
                  <tr v-for="u in data.byUser" :key="u.userId || u.name">
                    <td>{{ u.name }}</td>
                    <td class="num">{{ u.ticketCount }}</td>
                    <td class="num">{{ formatCurrency(u.averageTicket) }}</td>
                    <td class="num">{{ formatCurrency(u.total) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Precios ajustados: es el dato que un dueño quiere revisar, porque
               cada renglón aquí es dinero cobrado por debajo del catálogo. -->
          <div class="panel">
            <header class="panel__head">
              <div>
                <div class="panel__title">Precios ajustados en venta</div>
                <div class="panel__sub">Cobrados distinto al catálogo</div>
              </div>
              <v-spacer />
              <span class="chip-soft" :class="data.adjustedPrices.length ? 'chip-amber' : ''">
                {{ data.adjustedPrices.length }}
              </span>
            </header>
            <div class="px-4 pb-3 tabla-scroll scroll">
              <table v-if="data.adjustedPrices.length" class="data-table">
                <thead>
                  <tr><th>Folio</th><th>Producto</th><th class="num">Cobrado</th><th class="num">Catálogo</th></tr>
                </thead>
                <tbody>
                  <tr v-for="(a, i) in data.adjustedPrices" :key="`${a.folio}-${i}`">
                    <td>
                      <span class="code">{{ a.folio }}</span>
                      <div class="text--secondary" style="font-size: 0.6875rem">{{ a.userName }}</div>
                    </td>
                    <td>{{ a.productName }}</td>
                    <td class="num">{{ formatCurrency(a.unitPrice) }}</td>
                    <td class="num text--secondary">{{ formatCurrency(a.catalogPrice) }}</td>
                  </tr>
                </tbody>
              </table>
              <div v-else class="empty py-6">
                <div class="empty__hint">Ningún precio se ajustó en el período.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </v-container>
</template>

<script>
import analyticsService from '@/services/analyticsService';
import StatTile from '@/components/StatTile.vue';
import ColumnChart from '@/components/charts/ColumnChart.vue';
import { formatCurrency, formatCurrencyCompact, formatNumber, formatDate } from '@/utils/format';

/** Días atrás desde hoy, en formato AAAA-MM-DD. */
function diasAtras(dias) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/El_Salvador' }).format(d);
}

export default {
  name: 'ReportsView',

  components: { StatTile, ColumnChart },

  data: () => ({
    data: null,
    loading: false,
    descargando: false,
    errorMessage: '',
    from: diasAtras(29),
    to: diasAtras(0),
    presetActivo: 30,
    presets: [
      { days: 7, label: 'Últimos 7 días' },
      { days: 30, label: 'Últimos 30 días' },
      { days: 90, label: 'Últimos 90 días' },
    ],
  }),

  computed: {
    puntosDiarios() {
      if (!this.data) return [];
      return this.data.byDay.map((d) => ({
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
    formatDate,

    aplicarPreset(preset) {
      this.presetActivo = preset.days;
      this.from = diasAtras(preset.days - 1);
      this.to = diasAtras(0);
      this.cargar();
    },

    async cargar() {
      if (this.from > this.to) {
        this.errorMessage = 'La fecha inicial no puede ser posterior a la final.';
        return;
      }

      this.loading = true;
      this.errorMessage = '';
      try {
        this.data = await analyticsService.salesReport({ from: this.from, to: this.to });
      } catch (error) {
        this.errorMessage = error.message;
        this.$emit('error', error);
      } finally {
        this.loading = false;
      }
    },

    async exportar(recurso) {
      this.descargando = true;
      try {
        await analyticsService.downloadCsv(recurso, { from: this.from, to: this.to });
        this.$emit('notify', 'Archivo descargado');
      } catch (error) {
        this.$emit('error', error);
      } finally {
        this.descargando = false;
      }
    },
  },
};
</script>

<style scoped>
.page {
  max-width: 1500px;
}

.filters {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}
.filters__presets {
  display: flex;
  gap: 6px;
}
.filters__range {
  display: flex;
  align-items: center;
}

.preset {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 8px 14px;
  border: 0;
  border-radius: var(--r-pill);
  background: var(--pos-surface-2);
  color: var(--pos-text-muted);
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.14s ease, color 0.14s ease;
}
.preset:hover {
  background: var(--pos-border);
  color: var(--pos-text);
}
.preset--active {
  background: var(--pos-primary-soft);
  color: var(--pos-primary);
}

.grid-kpi {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 16px;
}

.grid-two {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

@media (max-width: 1279px) {
  .grid-two {
    grid-template-columns: 1fr;
  }
}

.tabla-scroll {
  max-height: 400px;
  overflow-y: auto;
}
</style>
