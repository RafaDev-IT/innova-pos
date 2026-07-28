# Innova POS — Punto de venta básico

Aplicación web de una sola pantalla para administrar productos y registrar ventas.
Incluye frontend, backend y persistencia en base de datos relacional.

> **Estado del scaffold.** Esta rama (`main`) contiene únicamente la base del proyecto:
> configuración, infraestructura y utilidades compartidas. Las funcionalidades se
> desarrollan en ramas por entregable y se integran en `ProductionEnv`.

## Stack

| Capa | Tecnología |
|------|-----------|
| Backend | Node.js 18+ · Express 4 · Sequelize 6 |
| Frontend | Vue.js 2.7 · Vuetify 2.7 · Axios · Vite |
| Base de datos | PostgreSQL 16 |
| Calidad | Jest + Supertest · Vitest · ESLint + Prettier · GitHub Actions |

### Por qué Vite y no Vue CLI

Vue CLI depende de webpack 4, que falla con Node ≥ 17 por el cambio de proveedor
criptográfico de OpenSSL y obliga a arrancar con `--openssl-legacy-provider`.
`@vitejs/plugin-vue2` compila exactamente el mismo Vue 2 sin ese problema.

## Requisitos

- Node.js 18 o superior
- Docker y Docker Compose (para la base de datos)
- npm 9 o superior

## Puesta en marcha

```bash
# 1. Base de datos
docker compose up -d

# 2. Backend
cd backend
cp .env.example .env
npm install
npm run db:setup     # crea la base, aplica migraciones y carga datos de ejemplo
npm run dev          # http://localhost:3000/api

# 3. Frontend (en otra terminal)
cd frontend
npm install
npm run dev          # http://localhost:5173
```

Verificación rápida de que la API responde:

```bash
curl http://localhost:3000/api/health
```

### Sin Docker

Si ya tienes PostgreSQL instalado, crea la base y ajusta `backend/.env` con tus
credenciales. También puedes aplicar el esquema directamente:

```bash
psql -U tu_usuario -d innova_pos -f database/schema.sql
```

## Estructura del repositorio

```
innova-pos/
├── backend/                 API REST
│   ├── src/
│   │   ├── config/          configuración de entorno y de Sequelize
│   │   ├── models/          modelos y asociaciones
│   │   ├── services/        lógica de negocio y transacciones
│   │   ├── controllers/     adaptadores HTTP
│   │   ├── routes/          definición de endpoints
│   │   ├── validators/      reglas de express-validator
│   │   ├── middlewares/     manejo de errores y validación
│   │   ├── database/        migraciones y seeders
│   │   └── utils/           utilidades compartidas (montos, errores)
│   └── tests/               integración (Supertest) y unitarios
├── frontend/                SPA Vue 2 + Vuetify
│   └── src/
│       ├── components/      componentes de la pantalla
│       ├── services/        cliente Axios y servicios de API
│       ├── plugins/         inicialización de Vuetify
│       └── utils/           formato de moneda y fechas
├── database/                script SQL de creación del esquema
├── docs/                    documentación de API y decisiones de diseño
└── docker-compose.yml       PostgreSQL para desarrollo
```

## Comandos disponibles

**Backend** (`cd backend`)

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor con recarga automática |
| `npm start` | Servidor en modo producción |
| `npm run db:setup` | Crear base + migrar + sembrar datos |
| `npm run db:migrate` | Aplicar migraciones pendientes |
| `npm run db:reset` | Revertir todo, migrar y sembrar de nuevo |
| `npm test` | Suite de integración contra PostgreSQL |
| `npm run lint` | ESLint |

**Frontend** (`cd frontend`)

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo (Vite) |
| `npm run build` | Build de producción en `dist/` |
| `npm test` | Tests de componentes (Vitest) |
| `npm run lint` | ESLint |

## Estrategia de ramas

| Rama | Contenido |
|------|-----------|
| `main` | Scaffold, infraestructura y utilidades compartidas |
| `feature/products` | **Entregable 1** — administración y búsqueda de productos |
| `feature/sales` | **Entregable 2** — registro y persistencia de ventas |
| `ProductionEnv` | Versión final con ambos entregables integrados |

Los entregables se integran en `ProductionEnv` con merges `--no-ff`, de modo que
la separación entre ellos queda visible en el historial:

```bash
git log --graph --oneline --all
```

## Licencia

Proyecto desarrollado como prueba técnica.
