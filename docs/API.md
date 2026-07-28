# API REST — Innova POS

Base: `http://localhost:3000/api`

## Convenciones

Toda respuesta correcta tiene la forma:

```json
{ "success": true, "data": ... , "meta": { ... } }
```

`meta` solo aparece en los listados paginados. Los errores devuelven:

```json
{
  "success": false,
  "error": {
    "message": "Los datos enviados no son válidos",
    "details": [{ "field": "price", "message": "El precio no puede ser negativo" }]
  }
}
```

`details` es opcional y aparece cuando el error se puede atribuir a campos concretos.

### Importes

Todos los importes viajan **como string con dos decimales** (`"18.50"`), nunca como número.
El tipo `DECIMAL` de PostgreSQL se entrega como string precisamente para no perder
precisión al convertirlo a punto flotante, y esa garantía se mantiene hasta el cliente.

Al enviar importes se acepta tanto `"18.50"` como `"18,50"`.

### Códigos de estado

| Código | Cuándo |
|--------|--------|
| 200 | Consulta o actualización correcta |
| 201 | Recurso creado |
| 204 | Baja aplicada, sin cuerpo |
| 400 | Petición mal formada o referencia inexistente |
| 404 | El recurso no existe |
| 409 | Conflicto de unicidad (código de barras repetido) |
| 422 | Falló la validación de los datos enviados |
| 500 | Error no controlado |

---

## Salud

### `GET /health`

```json
{ "success": true, "data": { "status": "ok", "service": "innova-pos-api", "timestamp": "..." } }
```

---

## Productos

### `GET /products`

Lista y busca productos activos.

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `q` | string | Busca en **nombre y código de barras** a la vez, sin distinguir mayúsculas |
| `limit` | entero 1–100 | Resultados por página (20 por defecto) |
| `offset` | entero ≥ 0 | Desplazamiento |
| `includeInactive` | booleano | Incluir productos dados de baja |

La coincidencia exacta de código de barras se devuelve siempre en primer lugar; el
resto se ordena alfabéticamente.

```bash
curl "http://localhost:3000/api/products?q=coca"
```

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Coca-Cola 600 ml",
      "barcode": "7501055300013",
      "price": "18.50",
      "description": "Refresco de cola, botella de 600 ml",
      "isActive": true,
      "createdAt": "2026-07-28T00:27:12.174Z",
      "updatedAt": "2026-07-28T00:27:12.174Z"
    }
  ],
  "meta": { "total": 1, "limit": 20, "offset": 0, "hasMore": false }
}
```

### `GET /products/:id`

Detalle. `404` si no existe o fue dado de baja.

### `GET /products/barcode/:barcode`

Consulta directa por código de barras exacto, pensada para lector de códigos.

### `POST /products`

| Campo | Obligatorio | Reglas |
|-------|-------------|--------|
| `name` | sí | 2–150 caracteres |
| `barcode` | sí | 1–64 caracteres, letras, números, guiones y puntos; único |
| `price` | sí | Entre 0 y 99999999.99 |
| `description` | no | Hasta 1000 caracteres |
| `isActive` | no | `true` por defecto |

```bash
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Agua 1 L","barcode":"7501030000015","price":"14.00"}'
```

Devuelve `201`. `409` si el código de barras ya está registrado, `422` si falla la validación.

### `PUT /products/:id`

Acepta cualquier subconjunto de los campos anteriores. Un cuerpo vacío devuelve `422`
en lugar de responder `200` sin haber cambiado nada.

### `DELETE /products/:id`

Baja **lógica**: la fila permanece en la tabla con `deleted_at` marcado, porque puede
estar referenciada por ventas históricas. Devuelve `204`.

---

## Ventas

### `POST /sales`

Registra una venta con su detalle, en una única transacción.

```json
{
  "items": [
    { "productId": 1, "quantity": 2 },
    { "productId": 3, "unitPrice": "15.00", "quantity": 1 }
  ]
}
```

| Campo | Obligatorio | Comportamiento |
|-------|-------------|----------------|
| `items` | sí | Entre 1 y 200 renglones |
| `items[].productId` | sí | Debe existir y estar activo |
| `items[].unitPrice` | no | **Si se omite se cobra el precio de catálogo.** Si se envía, es el precio ajustado dentro de la venta |
| `items[].quantity` | no | Entero 1–9999; 1 por defecto |

El total **no se acepta del cliente**: se calcula en el servidor sumando en centavos
enteros.

```json
{
  "success": true,
  "data": {
    "id": 1,
    "folio": "V-000001",
    "subtotal": "52.00",
    "total": "52.00",
    "status": "completed",
    "itemCount": 3,
    "soldAt": "2026-07-28T00:55:34.442Z",
    "items": [
      {
        "id": 1,
        "saleId": 1,
        "productId": 1,
        "productName": "Coca-Cola 600 ml",
        "productBarcode": "7501055300013",
        "unitPrice": "18.50",
        "quantity": 2,
        "lineTotal": "37.00"
      }
    ]
  }
}
```

Errores: `400` si un producto no existe o está dado de baja (el `field` indica el índice
del renglón, p. ej. `items[0].productId`); `422` si falla la validación.

### `GET /sales`

Histórico paginado, más reciente primero. No incluye el detalle.

### `GET /sales/:id`

Venta completa con todos sus renglones ordenados.

---

## Nota sobre el histórico

Cada renglón de venta guarda una **copia** del nombre, el código de barras y el precio
del producto al momento de venderse. Editar o dar de baja un producto después no altera
ninguna venta ya registrada:

```bash
# Se vende a 18.50
curl -X POST .../api/sales -d '{"items":[{"productId":1,"quantity":2}]}'

# Se cambia el catálogo
curl -X PUT .../api/products/1 -d '{"price":"99.00","name":"Otro nombre"}'

# La venta sigue diciendo "Coca-Cola 600 ml" a "18.50", total "37.00"
curl .../api/sales/1
```
