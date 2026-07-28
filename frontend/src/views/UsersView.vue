<template>
  <v-container fluid class="pa-4 pos-page">
    <div class="pos-panel">
      <header class="pos-panel__head">
        <v-icon size="18" color="primary">mdi-account-group-outline</v-icon>
        <span class="pos-panel__title">Usuarios</span>
        <span v-if="pagination.total" class="pos-count">{{ pagination.total }}</span>
        <v-spacer />
        <v-btn depressed class="pos-btn-primary" @click="openCreate">
          <v-icon left size="18">mdi-account-plus-outline</v-icon>
          Nuevo usuario
        </v-btn>
      </header>

      <div class="pos-filters">
        <v-text-field
          v-model="query"
          class="pos-search"
          placeholder="Buscar por nombre o usuario…"
          solo
          flat
          dense
          clearable
          hide-details
          prepend-inner-icon="mdi-magnify"
          :loading="loading"
        />
        <v-select
          v-model="roleFilter"
          :items="roleOptions"
          class="pos-role-filter"
          placeholder="Todos los roles"
          solo
          flat
          dense
          clearable
          hide-details
        />
      </div>

      <div class="pos-panel__body pos-scroll">
        <v-alert v-if="errorMessage" type="error" dense text class="ma-4">{{ errorMessage }}</v-alert>

        <v-skeleton-loader v-else-if="loading && !users.length" type="list-item-two-line@4" class="pa-2" />

        <template v-else-if="users.length">
          <div v-for="item in users" :key="item.id" class="pos-row pos-row--static">
            <v-avatar size="36" :color="item.isActive ? 'primary' : 'grey'" class="flex-shrink-0">
              <span class="white--text font-weight-bold text-caption">{{ initials(item.name) }}</span>
            </v-avatar>

            <div class="pos-row__main">
              <div class="pos-row__name">
                {{ item.name }}
                <span v-if="item.id === currentUserId" class="pos-tag-self">tú</span>
              </div>
              <div class="pos-row__meta">
                <span class="pos-barcode">{{ item.username }}</span>
                <span v-if="item.email">· {{ item.email }}</span>
              </div>
            </div>

            <span class="pos-role-chip" :class="`pos-role-chip--${item.role}`">{{ roleLabel(item.role) }}</span>

            <span v-if="!item.isActive" class="pos-inactive-chip">
              <v-icon size="12">mdi-pause-circle-outline</v-icon>
              Inactivo
            </span>

            <div class="pos-row__actions">
              <v-btn icon small title="Editar usuario" @click="openEdit(item)">
                <v-icon size="17">mdi-pencil-outline</v-icon>
              </v-btn>
              <v-btn
                icon
                small
                title="Dar de baja"
                :disabled="item.id === currentUserId"
                @click="confirmDelete(item)"
              >
                <v-icon size="17">mdi-account-off-outline</v-icon>
              </v-btn>
            </div>
          </div>
        </template>

        <div v-else class="pos-empty">
          <div class="pos-empty__icon">
            <v-icon size="26" color="grey">mdi-account-search-outline</v-icon>
          </div>
          <div class="pos-empty__title">
            {{ query || roleFilter ? 'Sin coincidencias' : 'Aún no hay usuarios' }}
          </div>
          <div class="pos-empty__hint">
            {{
              query || roleFilter
                ? 'Prueba con otro texto o quita el filtro de rol.'
                : 'Crea el primer usuario para que pueda iniciar sesión.'
            }}
          </div>
        </div>
      </div>

      <footer v-if="pagination.hasMore" class="pos-panel__foot">
        <v-btn text small color="primary" :loading="loadingMore" @click="loadMore">
          Cargar más · {{ users.length }} de {{ pagination.total }}
        </v-btn>
      </footer>
    </div>

    <UserFormDialog v-model="dialogOpen" :user="editingUser" @saved="onSaved" />

    <v-dialog v-model="deleteDialog.open" max-width="430">
      <div class="v-card pos-dialog">
        <div class="pos-dialog__head">
          <div class="pos-dialog__icon pos-dialog__icon--danger">
            <v-icon size="19" color="error">mdi-account-off-outline</v-icon>
          </div>
          <span class="pos-dialog__title">Dar de baja usuario</span>
        </div>
        <div class="pos-dialog__body">
          <p class="pos-dialog__text mb-2">
            <strong>{{ deleteDialog.user && deleteDialog.user.name }}</strong> ya no podrá iniciar sesión.
          </p>
          <p class="pos-dialog__note mb-0">
            Sus ventas y su rastro en la bitácora se conservan: la baja es lógica, no un borrado.
          </p>
        </div>
        <div class="pos-dialog__foot">
          <v-spacer />
          <v-btn text @click="deleteDialog.open = false">Cancelar</v-btn>
          <v-btn color="error" depressed :loading="deleteDialog.saving" @click="performDelete">
            Dar de baja
          </v-btn>
        </div>
      </div>
    </v-dialog>
  </v-container>
</template>

<script>
import userService from '@/services/userService';
import session from '@/store/session';
import UserFormDialog from '@/components/UserFormDialog.vue';

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 300;

const ROLE_LABELS = {
  admin: 'Administrador',
  supervisor: 'Supervisor',
  cashier: 'Cajero',
};

export default {
  name: 'UsersView',

  components: { UserFormDialog },

  data: () => ({
    query: '',
    roleFilter: null,
    users: [],
    pagination: { total: 0, limit: PAGE_SIZE, offset: 0, hasMore: false },
    loading: false,
    loadingMore: false,
    errorMessage: '',
    dialogOpen: false,
    editingUser: null,
    deleteDialog: { open: false, user: null, saving: false },
    debounceTimer: null,
    requestId: 0,
  }),

  computed: {
    currentUserId() {
      return session.state.user ? session.state.user.id : null;
    },

    roleOptions() {
      return Object.entries(ROLE_LABELS).map(([value, text]) => ({ value, text }));
    },
  },

  watch: {
    query() {
      this.debouncedFetch();
    },
    roleFilter() {
      this.fetchUsers();
    },
  },

  created() {
    this.fetchUsers();
  },

  beforeDestroy() {
    clearTimeout(this.debounceTimer);
  },

  methods: {
    roleLabel(role) {
      return ROLE_LABELS[role] || role;
    },

    initials(name) {
      return (name || '?')
        .split(' ')
        .slice(0, 2)
        .map((palabra) => palabra.charAt(0).toUpperCase())
        .join('');
    },

    debouncedFetch() {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => this.fetchUsers(), DEBOUNCE_MS);
    },

    async fetchUsers({ append = false } = {}) {
      const currentRequest = ++this.requestId;
      if (append) this.loadingMore = true;
      else this.loading = true;
      this.errorMessage = '';

      try {
        const { items, pagination } = await userService.search({
          query: (this.query || '').trim(),
          role: this.roleFilter,
          limit: PAGE_SIZE,
          offset: append ? this.users.length : 0,
        });

        // Descarta respuestas de búsquedas que ya quedaron obsoletas.
        if (currentRequest !== this.requestId) return;

        this.users = append ? [...this.users, ...items] : items;
        this.pagination = pagination;
      } catch (error) {
        if (currentRequest !== this.requestId) return;
        this.errorMessage = error.message;
        this.$emit('error', error);
      } finally {
        if (currentRequest === this.requestId) {
          this.loading = false;
          this.loadingMore = false;
        }
      }
    },

    loadMore() {
      this.fetchUsers({ append: true });
    },

    openCreate() {
      this.editingUser = null;
      this.dialogOpen = true;
    },

    openEdit(user) {
      this.editingUser = user;
      this.dialogOpen = true;
    },

    onSaved(user, wasEditing) {
      this.$emit('notify', wasEditing ? 'Usuario actualizado' : `Usuario "${user.username}" creado`);
      this.fetchUsers();
    },

    confirmDelete(user) {
      this.deleteDialog = { open: true, user, saving: false };
    },

    async performDelete() {
      this.deleteDialog.saving = true;
      try {
        await userService.remove(this.deleteDialog.user.id);
        this.$emit('notify', 'Usuario dado de baja');
        this.deleteDialog.open = false;
        this.fetchUsers();
      } catch (error) {
        this.$emit('error', error);
      } finally {
        this.deleteDialog.saving = false;
      }
    },
  },
};
</script>

<style scoped>
.pos-page {
  max-width: 1100px;
}

.pos-panel {
  height: calc(100vh - 88px);
  min-height: 480px;
}

.pos-filters {
  display: flex;
  gap: 10px;
  padding: 12px 16px;
}
.pos-role-filter {
  max-width: 190px;
}
.pos-role-filter >>> .v-input__slot {
  border-radius: var(--pos-r-md) !important;
  min-height: 46px !important;
  background: var(--pos-surface-sunken) !important;
}

.pos-row--static {
  cursor: default;
}
.pos-row--static:hover {
  background: transparent;
}

.pos-count {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--pos-text-faint);
  background: var(--pos-surface-sunken);
  border: 1px solid var(--pos-border);
  border-radius: 999px;
  padding: 1px 8px;
}

/* El rol se distingue por color y por texto: nunca solo por color. */
.pos-role-chip {
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  padding: 3px 9px;
  border-radius: 999px;
  white-space: nowrap;
}
.pos-role-chip--admin {
  background: var(--pos-accent-soft);
  color: var(--pos-accent);
}
.pos-role-chip--supervisor {
  background: var(--pos-primary-soft);
  color: var(--pos-primary);
}
.pos-role-chip--cashier {
  background: var(--pos-surface-sunken);
  color: var(--pos-text-muted);
}

.pos-inactive-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--pos-text-faint);
  white-space: nowrap;
}

.pos-tag-self {
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--pos-primary);
  background: var(--pos-primary-soft);
  border-radius: 4px;
  padding: 1px 5px;
  margin-left: 6px;
  vertical-align: 1px;
}

.pos-panel__foot {
  border-top: 1px solid var(--pos-border);
  text-align: center;
  padding: 6px;
}

.pos-dialog__text {
  font-size: 0.9375rem;
  line-height: 1.55;
  color: var(--pos-text);
}
.pos-dialog__note {
  font-size: 0.8125rem;
  color: var(--pos-text-faint);
  line-height: 1.5;
}
</style>
