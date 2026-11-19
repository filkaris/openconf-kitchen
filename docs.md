# Kitchen API

Read-only inventory API for one shop's kitchen, run by the delivery platform.

v1 (`/categories`, `/ingredients`, `/ingredients/:id`, `/allergens`) is
deprecated and is **switched off on 30 Nov 2026**. Sauces are only available
from v2 on. Tacos and sandwiches are only available on v3.

| Version | Status | Has |
|---------|--------|-----|
| v1 | Deprecated, off on 30 Nov 2026 | Burger ingredients |
| v2 | Current | + sauces |
| v3 | Current | + tacos and sandwiches: products, fillings, tortillas, breads |

## Pagination (v2 and v3)

List endpoints return up to `limit` items (default and maximum: 5) and a cursor:

```json
{ "items": [ ... ], "cursor": { "next": "bzo1" } }
```

Pass `?cursor=<cursor.next>` to get the next page. `cursor.next` is `null` on
the last page. Cursors are opaque: don't build them yourself.

## v2 endpoints

### `GET /shop`

Unversioned, same as v1: `{ "data": { name, tagline, currency, basePriceCents } }`.

### `GET /v2/categories`

Paginated: `{ type, label }`.

### `GET /v2/ingredients`

Paginated list of ingredients.

| Field          | Type   | Notes |
|----------------|--------|-------|
| `sku`          | string | Stable identifier. Same values as the v1 `id`. |
| `displayName`  | string | Name to show customers. |
| `type`         | string | Matches a `type` from `GET /v2/categories`. |
| `price`        | object | `{ amount, currency, unit }`. `amount` is an integer in `unit` (always `cents`). |
| `portionsLeft` | number | Portions the kitchen has right now, updated live. `0` means sold out. |

v1's `inStock` flag is gone in v2.

### `GET /v2/ingredients/:sku`

One ingredient, not wrapped: `{ sku, displayName, ... }`.
Unknown sku: `404 { "error": { "code": "sku_not_found", "message": "..." } }`.

## v3 endpoints

v3 has the same pagination and error format as v2. Everything on v2 is on v3,
plus the items below.

### `GET /v3/products`

Paginated list of what the shop sells: `burger`, `taco`, `sandwich`.

| Field         | Type   | Notes |
|---------------|--------|-------|
| `sku`         | string | `burger`, `taco` or `sandwich`. |
| `displayName` | string | Name to show customers. |
| `basePrice`   | object | `{ amount, currency, unit }`. What the product costs before ingredients. |

The burger's `basePrice` is the same as `basePriceCents` on `/shop` and includes
the bun. Tacos and sandwiches don't include their tortilla or bread: those are
`bread` ingredients with their own price.

### `GET /v3/categories`

Paginated: `{ type, label }`. Adds `filling`.

### `GET /v3/ingredients`

Paginated. Every v2 field, plus:

| Field         | Type     | Notes |
|---------------|----------|-------|
| `availableIn` | string[] | Product `sku`s this ingredient can go in. The kitchen can't make anything else. |
| `vegetarian`  | boolean  | `false` if it contains meat or fish. |

### `GET /v3/ingredients/:sku`

One ingredient, not wrapped. Unknown sku: `404 sku_not_found`, as on v2.

## Errors

v2 errors look like `{ "error": { "code": string, "message": string } }`.
The production API occasionally returns `503` under load; retry.

## Allergens

Allergens are not on v2 yet. v1 `/allergens` is unavailable.
