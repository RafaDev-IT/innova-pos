<template>
  <v-container fluid class="pa-4">
    <div class="pos-panel">
      <div class="pos-empty">
        <div class="pos-empty__icon">
          <v-icon size="26" color="grey">mdi-lock-outline</v-icon>
        </div>
        <div class="pos-empty__title">No tienes acceso a esta sección</div>
        <div class="pos-empty__hint">
          Tu rol actual es <strong>{{ roleLabel }}</strong
          >. Si necesitas entrar aquí, pide a un administrador que revise tus permisos.
        </div>
        <v-btn depressed small class="pos-btn-primary mt-4" :to="{ name: 'pos' }">
          <v-icon left size="16">mdi-point-of-sale</v-icon>
          Ir al punto de venta
        </v-btn>
      </div>
    </div>
  </v-container>
</template>

<script>
import session from '@/store/session';

export default {
  name: 'ForbiddenView',

  computed: {
    roleLabel() {
      return session.state.roleLabel || 'sin rol asignado';
    },
  },
};
</script>
