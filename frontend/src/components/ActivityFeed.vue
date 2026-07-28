<template>
  <div>
    <div v-if="!entries.length" class="empty">
      <div class="empty__icon">
        <v-icon size="26" color="primary">mdi-history</v-icon>
      </div>
      <div class="empty__title">Sin movimientos</div>
      <div class="empty__hint">Aquí aparecerá lo último que haga cada usuario en el sistema.</div>
    </div>

    <div v-for="entry in entries" v-else :key="entry.id" class="activity">
      <div class="activity__icon" :style="{ background: aspecto(entry.action).fondo }">
        <v-icon size="16" :color="aspecto(entry.action).color">{{ aspecto(entry.action).icono }}</v-icon>
      </div>
      <div class="activity__text">
        <div class="activity__summary">{{ entry.summary }}</div>
        <div class="activity__meta">
          {{ entry.userName }} · {{ formatRelative(entry.createdAt) }}
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { formatRelative } from '@/utils/format';

/**
 * Aspecto por tipo de acción.
 *
 * Cada entrada lleva icono además de color: el color solo distingue para quien
 * lo percibe, y aquí el tipo de movimiento es información, no decoración.
 */
const ASPECTO = {
  'sale.create': { icono: 'mdi-cart-check', color: 'primary', fondo: 'var(--pos-primary-soft)' },
  'sale.cancel': { icono: 'mdi-cart-remove', color: 'error', fondo: 'var(--pos-danger-soft)' },
  'product.create': { icono: 'mdi-package-variant-plus', color: 'primary', fondo: 'var(--pos-primary-soft)' },
  'product.update': { icono: 'mdi-pencil-outline', color: 'warning', fondo: 'var(--pos-accent-soft)' },
  'product.delete': { icono: 'mdi-package-variant-remove', color: 'error', fondo: 'var(--pos-danger-soft)' },
  'user.create': { icono: 'mdi-account-plus-outline', color: 'primary', fondo: 'var(--pos-primary-soft)' },
  'user.update': { icono: 'mdi-account-edit-outline', color: 'warning', fondo: 'var(--pos-accent-soft)' },
  'user.delete': { icono: 'mdi-account-off-outline', color: 'error', fondo: 'var(--pos-danger-soft)' },
  'auth.login': { icono: 'mdi-login', color: 'grey', fondo: 'var(--pos-surface-2)' },
};

const POR_DEFECTO = { icono: 'mdi-circle-small', color: 'grey', fondo: 'var(--pos-surface-2)' };

export default {
  name: 'ActivityFeed',

  props: {
    entries: { type: Array, default: () => [] },
  },

  methods: {
    formatRelative,

    aspecto(action) {
      return ASPECTO[action] || POR_DEFECTO;
    },
  },
};
</script>
