# Imagen de la API para el entorno local con Docker.
#
# Se instalan también las dependencias de desarrollo porque `sequelize-cli`
# —necesario para migrar y sembrar al arrancar— vive ahí. En un despliegue real
# las migraciones corren en el paso de build del proveedor, no en la imagen.
FROM node:20-alpine

WORKDIR /app

# El manifiesto se copia primero para que la capa de dependencias se reutilice
# mientras no cambie: editar código no vuelve a descargar node_modules.
COPY package*.json ./
RUN npm install

COPY . .

# `docker-entrypoint.sh` espera a la base, migra, siembra y arranca.
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
