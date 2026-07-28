<template>
  <v-container fluid class="pa-4 page">
    <div class="card pa-3 mb-4 filters">
      <v-text-field
        v-model="filtros.folio"
        class="field-pill filters__search"
        placeholder="Buscar por folio…"
        solo
        flat
        dense
        clearable
        hide-details
        prepend-inner-icon="mdi-magnify"
        :loading="loading"
      />

      <v-text-field v-model="filtros.from" type="date" label="Desde" outlined dense hide-details class="filters__date" @change="recargar" />
      <span class="mx-1 text--secondary">→</span>
      <v-text-field v-model="filtros.to" type="date" label="Hasta" outlined dense hide-details class="filters__date" @change="recargar" />

      <v-select
        v-model="filtros.status"
        :items="estados"
        label="Estado"
        outlined
        dense
        clearable
        hide-details
        class="filters__select"
        @change="recargar"
      />

      <v-btn v-if="hayFiltros" text small class="ml-1" @click="limpiar">Limpiar</v-btn>
    </div>

    <v-alert v-if="errorMessage" type="error" dense text class="mb-4">{{ errorMessage }}</v-alert>

    <div class="grid-kpi mb-4">
      <StatTile label="Ventas encontradas" :value="formatNumber(pagination.total)" :caption="descripcionRango" />
      <StatTile label="Importe del listado" :value="formatCurrency(totalListado)" caption="suma de lo mostrado" />
      <StatTile label="Anuladas" :value="formatNumber(anuladas)" caption="en lo mostrado" />
    </div>

    <div class="panel">
      <header class="panel__head">
        <div class="panel__title">Historial de ventas</div>
        <v-spacer />
        <span class="chip-soft">{{ ventas.length }} de {{ pagination.total }}</span>
      </header>

      <div class="panel__body scroll">
        <v-skeleton-loader v-if="loading && !ventas.length" type="table-row@6" class="pa-3" />

        <table v-else-if="ventas.length" class="data-table">
          <thead>
            <tr>
              <th>Folio</th>
              <th>Fecha</th>
              <th>Cajero</th>
              <th class="num">Artículos</th>
              <th class="num">Total</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="venta in ventas"
              :key="venta.id"
              class="fila"
              :class="{ 'fila--anulada': venta.status === 'cancelled' }"
              @click="abrirTicket(venta)"
            >
              <td>
                <span class="code">{{ venta.folio }}</span>
                <span v-if="venta.status === 'cancelled'" class="chip-soft chip-red ml-2">Anulada</span>
              </td>
              <td>{{ formatDateTime(venta.soldAt) }}</td>
              <td>{{ venta.userName || '—' }}</td>
              <td class="num">{{ venta.itemCount }}</td>
              <td class="num importe">{{ formatCurrency(venta.total) }}</td>
              <td class="num">
                <v-btn icon x-small title="Ver ticket" @click.stop="abrirTicket(venta)">
                  <v-icon size="17">mdi-receipt-text-outline</v-icon>
                </v-btn>
              </td>
            </tr>
          </tbody>
        </table>

        <div v-else class="empty">
          <div class="empty__icon">
            <v-icon size="28" color="primary">mdi-receipt-text-outline</v-icon>
          </div>
          <div class="empty__title">{{ hayFiltros ? 'Sin coincidencias' : 'Aún no hay ventas' }}</div>
          <div class="empty__hint">
            {{ hayFiltros ? 'Prueba con otro folio o amplía el rango de fechas.' : 'Las ventas que registres aparecerán aquí.' }}
          </div>
          <v-btn v-if="hayFiltros" text small color="primary" class="mt-3" @click="limpiar">Limpiar filtros</v-btn>
        </div>
      </div>

      <footer v-if="pagination.hasMore" class="panel__foot">
        <v-btn text small color="primary" :loading="loadingMore" @click="cargarMas">
          Cargar más · {{ ventas.length }} de {{ pagination.total }}
        </v-btn>
      </footer>
    </div>

    <SaleTicket v-model="ticketAbierto" :sale="ventaActiva" :cancelando="cancelDialog.saving" @cancel="pedirCancelacion" />

    <v-dialog v-model="cancelDialog.open" max-width="460" persistent>
      <div class="dialog">
        <div class="dialog__head">
          <div class="dialog__icon dialog__icon--danger">
            <v-icon size="20" color="error">mdi-cancel</v-icon>
          </div>
          <div>
            <div class="dialog__title">Anular venta</div>
            <div class="dialog__sub">{{ cancelDialog.sale && cancelDialog.sale.folio }}</div>
          </div>
        </div>

        <div class="dialog__body">
          <p class="dialog__text mb-3">
            La venta deja de contar en el tablero y en los reportes, pero se conserva en el historial
            marcada como anulada. No se puede deshacer.
          </p>

          <v-textarea
            v-model="cancelDialog.reason"
            label="Motivo de la anulación"
            placeholder="Ej. Producto devuelto por el cliente"
            outlined
            dense
            rows="2"
            counter="300"
            :rules="reglasMotivo"
            :error-messages="cancelDialog.error"
            @input="cancelDialog.error = ''"
          />
        </div>

        <div class="dialog__foot">
          <v-spacer />
          <v-btn text :disabled="cancelDialog.saving" @click="cancelDialog.open = false">Cancelar</v-btn>
          <v-btn
            color="error"
            depressed
            :loading="cancelDialog.saving"
            :disabled="!motivoValido"
            @click="confirmarCancelacion"
          >
            Anular venta
          </v-btn>
        </div>
      </div>
    </v-dialog>
  </v-container>
</template>

<script>
import saleService from '@/services/saleService';
import StatTile from '@/components/StatTile.vue';
import SaleTicket from '@/components/SaleTicket.vue';
import { formatCurrency, formatNumber, formatDateTime, formatDate } from '@/utils/format';
import { toCents, fromCents } from '@/utils/money';

const PAGE_SIZE = 25;
const DEBOUNCE_MS = 320;
const MOTIVO_MINIMO = 5;

/** Fecha de hace N días en la zona del negocio, en formato AAAA-MM-DD. */
function diasAtras(dias) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/El_Salvador' }).format(d);
}

export default {
  name: 'SalesHistoryView',

  components: { StatTile, SaleTicket },

  data: () => ({
    ventas: [],
    pagination: { total: 0, limit: PAGE_SIZE, offset: 0, hasMore: false },
    loading: false,
    loadingMore: false,
    errorMessage: '',
    filtros: { folio: '', from: diasAtras(29), to: diasAtras(0), status: null },
    estados: [
      { value: 'completed', text: 'Completadas' },
      { value: 'cancelled', text: 'Anuladas' },
    ],
    ticketAbierto: false,
    ventaActiva: null,
    cancelDialog: { open: false, sale: null, reason: '', saving: false, error: '' },
    debounceTimer: null,
    requestId: 0,
  }),

  computed: {
    hayFiltros() {
      return Boolean(this.filtros.folio || this.filtros.status);
    },

    descripcionRango() {
      return `${formatDate(this.filtros.from)} — ${formatDate(this.filtros.to)}`;
    },

    /** Suma de lo cargado, en centavos, para no arrastrar error de coma flotante. */
    totalListado() {
      const cents = this.ventas
        .filter((v) => v.status !== 'cancelled')
        .reduce((suma, v) => suma + (toCents(v.total) || 0), 0);
      return fromCents(cents);
    },

    anuladas() {
      return this.ventas.filter((v) => v.status === 'cancelled').length;
    },

    motivoValido() {
      return this.cancelDialog.reason.trim().length >= MOTIVO_MINIMO;
    },

    reglasMotivo() {
      return [
        (v) => !!(v || '').trim() || 'El motivo es obligatorio',
        (v) => (v || '').trim().length >= MOTIVO_MINIMO || `Explica el motivo con al menos ${MOTIVO_MINIMO} caracteres`,
      ];
    },
  },

  watch: {
    'filtros.folio': function onFolio() {
      // Se espera a que deje de teclear: buscar por cada tecla dispara una
      // consulta al servidor por carácter.
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => this.cargar(), DEBOUNCE_MS);
    },
  },

  created() {
    this.cargar();
  },

  beforeDestroy() {
    clearTimeout(this.debounceTimer);
  },

  methods: {
    formatCurrency,
    formatNumber,
    formatDateTime,

    recargar() {
      this.cargar();
    },

    limpiar() {
      this.filtros = { folio: '', from: diasAtras(29), to: diasAtras(0), status: null };
      this.cargar();
    },

    async cargar({ append = false } = {}) {
      if (this.filtros.from && this.filtros.to && this.filtros.from > this.filtros.to) {
        this.errorMessage = 'La fecha inicial no puede ser posterior a la final.';
        return;
      }

      const peticion = ++this.requestId;
      if (append) this.loadingMore = true;
      else this.loading = true;
      this.errorMessage = '';

      try {
        const { items, pagination } = await saleService.list({
          ...this.filtros,
          folio: (this.filtros.folio || '').trim(),
          limit: PAGE_SIZE,
          offset: append ? this.ventas.length : 0,
        });

        // Descarta respuestas de búsquedas ya obsoletas.
        if (peticion !== this.requestId) return;

        this.ventas = append ? [...this.ventas, ...items] : items;
        this.pagination = pagination;
      } catch (error) {
        if (peticion !== this.requestId) return;
        this.errorMessage = error.message;
        this.$emit('error', error);
      } finally {
        if (peticion === this.requestId) {
          this.loading = false;
          this.loadingMore = false;
        }
      }
    },

    cargarMas() {
      this.cargar({ append: true });
    },

    /**
     * El listado no trae el detalle, así que se pide la venta completa al
     * abrir el ticket. Traerlo en el listado multiplicaría por diez el tamaño
     * de una respuesta que casi nunca se necesita entera.
     */
    async abrirTicket(venta) {
      this.ventaActiva = venta;
      this.ticketAbierto = true;

      try {
        this.ventaActiva = await saleService.findById(venta.id);
      } catch (error) {
        this.$emit('error', error);
        this.ticketAbierto = false;
      }
    },

    pedirCancelacion(venta) {
      this.cancelDialog = { open: true, sale: venta, reason: '', saving: false, error: '' };
    },

    async confirmarCancelacion() {
      if (!this.motivoValido) return;

      this.cancelDialog.saving = true;
      this.cancelDialog.error = '';

      try {
        const actualizada = await saleService.cancel(this.cancelDialog.sale.id, this.cancelDialog.reason.trim());

        // Se refleja en el listado sin recargarlo entero.
        const i = this.ventas.findIndex((v) => v.id === actualizada.id);
        if (i !== -1) this.$set(this.ventas, i, { ...this.ventas[i], ...actualizada });
        this.ventaActiva = actualizada;

        this.cancelDialog.open = false;
        this.$emit('notify', `Venta ${actualizada.folio} anulada`);
      } catch (error) {
        const porCampo = error.fieldErrors || {};
        this.cancelDialog.error = porCampo.reason || error.message;
      } finally {
        this.cancelDialog.saving = false;
      }
    },
  },
};
</script>

<style scoped>
.page {
  max-width: 1400px;
}

.filters {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}
.filters__search {
  flex: 1 1 240px;
  min-width: 200px;
}
.filters__date {
  max-width: 158px;
}
.filters__select {
  max-width: 168px;
}

.grid-kpi {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 16px;
}

.panel {
  height: calc(100vh - 330px);
  min-height: 340px;
}

.fila {
  cursor: pointer;
  transition: background 0.12s ease;
}
.fila:hover {
  background: var(--pos-surface-2);
}
/* Una venta anulada se atenúa y su importe se tacha: sigue en el historial
   pero no debe leerse como dinero cobrado. */
.fila--anulada td {
  color: var(--pos-text-faint);
}
.fila--anulada .importe {
  text-decoration: line-through;
}

.importe {
  font-weight: 650;
}

.panel__foot {
  border-top: 1px solid var(--pos-border);
  text-align: center;
  padding: 6px;
}

.dialog__text {
  font-size: 0.9375rem;
  line-height: 1.55;
  color: var(--pos-text);
}
</style>
