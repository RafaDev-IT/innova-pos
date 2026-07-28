#!/bin/sh
# Arranque de la API dentro de Docker.
#
# Deja la base lista antes de servir la primera petición: migra el esquema y,
# si se pide, siembra los datos de demostración. Así quien clone el repositorio
# obtiene un sistema con productos, usuarios e historial ejecutando un único
# comando, sin pasos manuales ni conexión a ninguna base remota.
set -e

echo "→ Aplicando migraciones…"
npm run --silent db:migrate

# Sembrar una semilla ya aplicada devuelve "Migration is not pending" con código
# de error. En un arranque manual eso es un aviso útil, pero aquí el contenedor
# se reinicia en cada `docker compose up` y ese error abortaría el arranque:
# el sistema funcionaría la primera vez y entraría en bucle de reinicio a la
# segunda. Se distingue "ya estaba sembrada" —que es el caso normal— de un
# fallo de verdad, que sí debe detener el arranque.
sembrar() {
  if salida=$(npm run --silent "$1" 2>&1); then
    echo "$salida" | grep -E "^==|✔" || true
    return 0
  fi

  if echo "$salida" | grep -q "not pending"; then
    echo "   · $1: ya estaba aplicada"
    return 0
  fi

  echo "$salida" >&2
  return 1
}

if [ "${SEED_DEMO_DATA:-true}" = "true" ]; then
  echo "→ Sembrando datos de demostración…"
  # El orden importa: el historial referencia productos y usuarios.
  sembrar db:seed:products
  sembrar db:seed:users
  sembrar db:seed:history
else
  echo "→ Creando únicamente el administrador inicial…"
  sembrar db:seed:prod
fi

echo "→ Arrancando la API…"
exec npm start
