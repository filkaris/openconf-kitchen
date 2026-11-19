# Kitchen API v2

Read-only inventory API for one shop's kitchen, run by the delivery platform.

v1 (`/categories`, `/ingredients`, `/ingredients/:id`, `/allergens`) is
deprecated and is **switched off on 30 Nov 2026**. New products, starting with
sauces, are only available on v2.

## Pagination

List endpoints return up to `limit` items (default and maximum: 5) and a cursor:

```json
{ "items": [ ... ], "cursor": { "next": "bzo1" } }
```

Pass `?cursor=<cursor.next>` to get the next page. `cursor.next` is `null` on
the last page. Cursors are opaque: don't build them yourself.

## Endpoints

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

## Errors

v2 errors look like `{ "error": { "code": string, "message": string } }`.
The production API occasionally returns `503` under load; retry.

## Allergens

Allergens are not on v2 yet. v1 `/allergens` is unavailable.
