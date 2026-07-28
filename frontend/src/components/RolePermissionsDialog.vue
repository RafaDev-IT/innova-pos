<template>
  <v-dialog :value="value" max-width="470" scrollable @input="$emit('input', $event)">
    <div v-if="rol" class="dialog">
      <div class="dialog__head">
        <div class="dialog__icon" :class="`dialog__icon--${claseRol}`">
          <v-icon size="20" :color="colorRol">{{ iconoRol }}</v-icon>
        </div>
        <div class="flex-grow-1">
          <div class="dialog__title">{{ rol.label }}</div>
          <div class="dialog__sub">{{ rol.permissions.length }} funciones habilitadas</div>
        </div>
        <v-btn icon small @click="$emit('input', false)"><v-icon size="20">mdi-close</v-icon></v-btn>
      </div>

      <div class="dialog__body">
        <p class="roles__summary">{{ rol.summary }}</p>

        <div v-for="grupo in grupos" :key="grupo.nombre" class="roles__group">
          <div class="roles__group-title">{{ grupo.nombre }}</div>
          <div v-for="permiso in grupo.permisos" :key="permiso.key" class="roles__item">
            <v-icon size="16" color="primary" class="mt-1">mdi-check-circle</v-icon>
            <div>
              <div class="roles__item-label">{{ permiso.label }}</div>
              <div v-if="permiso.detail" class="roles__item-detail">{{ permiso.detail }}</div>
            </div>
          </div>
        </div>

        <!-- Lo que el rol NO puede hacer es tan informativo como lo que sí:
             evita descubrirlo con un mensaje de acceso denegado más tarde. -->
        <div v-if="ausentes.length" class="roles__group roles__group--off">
          <div class="roles__group-title">No incluye</div>
          <div v-for="permiso in ausentes" :key="permiso.key" class="roles__item roles__item--off">
            <v-icon size="16" color="grey" class="mt-1">mdi-minus-circle-outline</v-icon>
            <div class="roles__item-label">{{ permiso.label }}</div>
          </div>
        </div>
      </div>

      <div class="dialog__foot">
        <v-spacer />
        <v-btn depressed class="btn-soft" @click="$emit('input', false)">Entendido</v-btn>
      </div>
    </div>
  </v-dialog>
</template>

<script>
export default {
  name: 'RolePermissionsDialog',

  props: {
    value: { type: Boolean, default: false },
    /** Ficha del rol tal como la entrega la API. */
    rol: { type: Object, default: null },
    /** Fichas de todos los roles, para deducir qué le falta a este. */
    todos: { type: Array, default: () => [] },
  },

  computed: {
    claseRol() {
      return { admin: 'accent', supervisor: 'primary', cashier: 'muted' }[this.rol.value] || 'primary';
    },

    colorRol() {
      return { admin: 'warning', supervisor: 'primary', cashier: 'grey darken-1' }[this.rol.value] || 'primary';
    },

    iconoRol() {
      return {
        admin: 'mdi-shield-crown-outline',
        supervisor: 'mdi-shield-account-outline',
        cashier: 'mdi-account-outline',
      }[this.rol.value] || 'mdi-account-outline';
    },

    /** Permisos agrupados por área, respetando el orden en que llegan. */
    grupos() {
      const orden = [];
      const porNombre = new Map();

      for (const permiso of this.rol.permissions) {
        if (!porNombre.has(permiso.group)) {
          porNombre.set(permiso.group, []);
          orden.push(permiso.group);
        }
        porNombre.get(permiso.group).push(permiso);
      }

      return orden.map((nombre) => ({ nombre, permisos: porNombre.get(nombre) }));
    },

    /** Permisos que existen en el sistema pero este rol no tiene. */
    ausentes() {
      const propios = new Set(this.rol.permissions.map((p) => p.key));
      const vistos = new Set();

      return this.todos
        .flatMap((r) => r.permissions)
        .filter((p) => {
          if (propios.has(p.key) || vistos.has(p.key)) return false;
          vistos.add(p.key);
          return true;
        });
    },
  },
};
</script>

<style scoped>
.roles__summary {
  font-size: 0.875rem;
  line-height: 1.55;
  color: var(--pos-text-muted);
  margin: 0 0 18px;
}

.roles__group + .roles__group {
  margin-top: 16px;
}

.roles__group-title {
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--pos-text-faint);
  margin-bottom: 7px;
}

.roles__item {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 5px 0;
}

.roles__item-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--pos-text);
  line-height: 1.35;
}

.roles__item-detail {
  font-size: 0.78125rem;
  color: var(--pos-text-faint);
  line-height: 1.45;
  margin-top: 1px;
}

.roles__group--off {
  margin-top: 20px;
  padding-top: 14px;
  border-top: 1px dashed var(--pos-border-strong);
}

.roles__item--off .roles__item-label {
  font-weight: 500;
  color: var(--pos-text-faint);
}

.dialog__icon--accent {
  background: var(--pos-accent-soft);
}
.dialog__icon--muted {
  background: var(--pos-surface-2);
}
</style>
