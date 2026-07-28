# Imagen del frontend: se compila con Node y se sirve con nginx.
#
# La imagen final solo lleva los estáticos, sin Node ni node_modules.

FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# La URL de la API se resuelve al compilar, no en tiempo de ejecución: Vite
# sustituye `import.meta.env` por literales dentro del bundle. Por eso viaja
# como argumento de build y no como variable del contenedor.
ARG VITE_API_BASE_URL=http://localhost:3000/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Solo para el entorno local de demostración: incluye en el login los atajos
# con las credenciales de ejemplo. Vacío —el valor por defecto— los deja fuera
# del bundle, que es lo correcto en cualquier despliegue real.
ARG VITE_SHOW_DEMO_ACCOUNTS=
ENV VITE_SHOW_DEMO_ACCOUNTS=$VITE_SHOW_DEMO_ACCOUNTS

RUN npm run build

FROM nginx:1.27-alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
