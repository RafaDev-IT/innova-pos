<template>
  <v-dialog :value="value" max-width="400" scrollable @input="$emit('input', $event)">
    <div v-if="sale" class="dialog ticket">
      <!-- Cabecera del comprobante. El estado se anuncia arriba: si la venta
           está anulada, hay que saberlo antes de leer los importes. -->
      <div class="ticket__head" :class="{ 'ticket__head--cancelled': anulada }">
        <div class="ticket__store">Innova POS</div>
        <div class="ticket__folio">{{ sale.folio }}</div>
        <div v-if="anulada" class="ticket__stamp">
          <v-icon size="15" color="white">mdi-close-circle</v-icon>
          Venta anulada
        </div>
      </div>

      <div class="ticket__body">
        <div class="ticket__meta">
          <div><span>Fecha</span><strong>{{ formatDateTime(sale.soldAt) }}</strong></div>
          <div><span>Atendió</span><strong>{{ sale.userName || 'Sin asignar' }}</strong></div>
        </div>

        <div class="ticket__sep" />

        <div v-for="item in sale.items" :key="item.id" class="ticket__line">
          <div class="ticket__line-name">{{ item.productName }}</div>
          <div class="ticket__line-detail">
            <span class="code">{{ item.productBarcode }}</span>
            <span class="ticket__line-calc">
              {{ item.quantity }} × {{ formatCurrency(item.unitPrice) }}
            </span>
            <strong class="ticket__line-total">{{ formatCurrency(item.lineTotal) }}</strong>
          </div>
        </div>

        <div class="ticket__sep" />

        <div class="ticket__totals">
          <div class="ticket__row">
            <span>Artículos</span>
            <strong>{{ sale.itemCount }}</strong>
          </div>
          <div class="ticket__row ticket__row--grand">
            <span>Total</span>
            <strong>{{ formatCurrency(sale.total) }}</strong>
          </div>
        </div>

        <!-- Los datos de la anulación van al pie, después de los importes:
             primero se ve qué se cobró y luego que se deshizo. -->
        <div v-if="anulada" class="ticket__cancel">
          <div class="ticket__cancel-title">
            <v-icon size="14" color="error">mdi-information-outline</v-icon>
            Anulada el {{ formatDateTime(sale.cancelledAt) }}
          </div>
          <div class="ticket__cancel-by">Autorizó: {{ sale.cancelledByName || 'Sin registrar' }}</div>
          <div class="ticket__cancel-reason">“{{ sale.cancelReason }}”</div>
        </div>
      </div>

      <div class="dialog__foot">
        <v-btn
          v-if="!anulada && puedeCancelar"
          text
          color="error"
          :disabled="cancelando"
          @click="$emit('cancel', sale)"
        >
          <v-icon left size="17">mdi-cancel</v-icon>
          Anular
        </v-btn>
        <v-spacer />
        <v-btn depressed class="btn-soft" @click="$emit('input', false)">Cerrar</v-btn>
      </div>
    </div>
  </v-dialog>
</template>

<script>
import session from '@/store/session';
import { PERMISSIONS } from '@/config/permissions';
import { formatCurrency, formatDateTime } from '@/utils/format';

export default {
  name: 'SaleTicket',

  props: {
    value: { type: Boolean, default: false },
    sale: { type: Object, default: null },
    cancelando: { type: Boolean, default: false },
  },

  computed: {
    anulada() {
      return Boolean(this.sale && this.sale.status === 'cancelled');
    },

    puedeCancelar() {
      return session.can(PERMISSIONS.SALES_CANCEL);
    },
  },

  methods: {
    formatCurrency,
    formatDateTime,
  },
};
</script>

<style scoped>
.ticket__head {
  background: var(--pos-primary);
  padding: 20px 22px 18px;
  text-align: center;
}
.ticket__head--cancelled {
  background: var(--pos-danger);
}
.ticket__store {
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.78);
}
.ticket__folio {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 1.375rem;
  font-weight: 700;
  color: #fff;
  margin-top: 3px;
}
.ticket__stamp {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 8px;
  padding: 3px 11px;
  border-radius: var(--r-pill);
  background: rgba(255, 255, 255, 0.2);
  font-size: 0.75rem;
  font-weight: 650;
  color: #fff;
}

.ticket__body {
  padding: 18px 22px 8px;
}

.ticket__meta > div {
  display: flex;
  justify-content: space-between;
  font-size: 0.8125rem;
  color: var(--pos-text-muted);
  padding: 3px 0;
}
.ticket__meta strong {
  color: var(--pos-text);
  font-weight: 600;
}

/* Línea discontinua, como el corte de un ticket impreso. */
.ticket__sep {
  border-top: 1.5px dashed var(--pos-border-strong);
  margin: 14px 0;
}

.ticket__line + .ticket__line {
  margin-top: 11px;
}
.ticket__line-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--pos-text);
  line-height: 1.35;
}
.ticket__line-detail {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-top: 2px;
  font-size: 0.75rem;
  color: var(--pos-text-faint);
}
.ticket__line-calc {
  margin-left: auto;
  white-space: nowrap;
}
.ticket__line-total {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--pos-text);
  min-width: 62px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.ticket__row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 0.875rem;
  color: var(--pos-text-muted);
  padding: 3px 0;
}
.ticket__row--grand {
  margin-top: 6px;
}
.ticket__row--grand span {
  font-size: 1rem;
  font-weight: 650;
  color: var(--pos-text);
}
.ticket__row--grand strong {
  font-size: 1.375rem;
  font-weight: 750;
  letter-spacing: -0.03em;
  color: var(--pos-text);
}

.ticket__cancel {
  margin-top: 14px;
  padding: 12px 14px;
  border-radius: var(--r-md);
  background: var(--pos-danger-soft);
}
.ticket__cancel-title {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.75rem;
  font-weight: 650;
  color: var(--pos-danger);
}
.ticket__cancel-by {
  font-size: 0.75rem;
  color: var(--pos-text-muted);
  margin-top: 3px;
}
.ticket__cancel-reason {
  font-size: 0.8125rem;
  color: var(--pos-text);
  margin-top: 5px;
  font-style: italic;
  line-height: 1.45;
}
</style>
