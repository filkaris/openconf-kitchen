// Mock of the delivery platform's kitchen inventory API for OpenConf Burgers.
//
// v1 (/shop, /categories, /ingredients, /allergens): deprecated, switched off
// at the end of November 2026. No sauces.
// v2 (/v2/...): burgers and sauces. Different response shape, cursor pagination.
// v3 (/v3/...): adds products (taco, sandwich), availableIn, vegetarian. Docs at /docs.
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const data = JSON.parse(readFileSync(join(import.meta.dirname, 'data.json'), 'utf8'));
const DOCS = readFileSync(join(import.meta.dirname, 'docs.md'), 'utf8');

const V1_PAGE_SIZE = 5;
const V2_LIMIT = 5;
const SUNSET = 'Mon, 30 Nov 2026 23:59:59 GMT';

// `since` is the first API version an item appears in (default 1).
const inVersion = (v) => (x) => (x.since ?? 1) <= v;

const v1Ingredients = data.ingredients
  .filter(inVersion(1))
  .map(({ id, name, category, priceCents, stock, inStock }) => ({ id, name, category, priceCents, stock, inStock }));
const v1Categories = data.categories.filter(inVersion(1)).map(({ id, label }) => ({ id, label }));

const money = (amount) => ({ amount, currency: data.shop.currency, unit: 'cents' });
const v2Item = (i) => ({ sku: i.id, displayName: i.name, type: i.category, price: money(i.priceCents), portionsLeft: i.stock });
const v2Ingredients = data.ingredients.filter(inVersion(2)).map(v2Item);
const v2Categories = data.categories.filter(inVersion(2)).map((c) => ({ type: c.id, label: c.label }));

const v3Ingredients = data.ingredients
  .filter(inVersion(3))
  .map((i) => ({ ...v2Item(i), availableIn: i.availableIn, vegetarian: i.vegetarian }));
const v3Categories = data.categories.filter(inVersion(3)).map((c) => ({ type: c.id, label: c.label }));
const v3Products = data.products.map((p) => ({ sku: p.id, displayName: p.name, basePrice: money(p.basePriceCents) }));

const LISTS = {
  '/v2/categories': v2Categories,
  '/v2/ingredients': v2Ingredients,
  '/v3/categories': v3Categories,
  '/v3/ingredients': v3Ingredients,
  '/v3/products': v3Products,
};
const ITEMS = { '/v2/ingredients/': v2Ingredients, '/v3/ingredients/': v3Ingredients };

function paginateV1(items, pageParam) {
  const page = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1);
  const start = (page - 1) * V1_PAGE_SIZE;
  return {
    data: items.slice(start, start + V1_PAGE_SIZE),
    page,
    nextPage: start + V1_PAGE_SIZE < items.length ? page + 1 : null,
  };
}

const encodeCursor = (offset) => Buffer.from(`o:${offset}`).toString('base64url');
function decodeCursor(cursor) {
  if (!cursor) return 0;
  const match = /^o:(\d+)$/.exec(Buffer.from(cursor, 'base64url').toString());
  return match ? Number(match[1]) : null;
}

function paginateV2(items, params) {
  const offset = decodeCursor(params.get('cursor'));
  if (offset === null) return null;
  const limit = Math.min(V2_LIMIT, Math.max(1, Number.parseInt(params.get('limit') ?? `${V2_LIMIT}`, 10) || V2_LIMIT));
  const end = offset + limit;
  return {
    items: items.slice(offset, end),
    cursor: { next: end < items.length ? encodeCursor(end) : null },
  };
}

export function createKitchenServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const headers = { 'content-type': 'application/json' };
    let status = 200;
    let body;

    const v1 = (payload) => {
      headers.deprecation = 'true';
      headers.sunset = SUNSET;
      headers.link = `<${url.origin}/docs>; rel="deprecation"`;
      return {
        ...payload,
        notice: `Kitchen API v1 is deprecated and will be switched off on 30 Nov 2026. Use v2, see ${url.origin}/docs`,
      };
    };

    if (req.method !== 'GET') {
      status = 405;
      body = { error: 'method_not_allowed' };
    } else if (path === '/' || path === '/docs') {
      res.writeHead(200, { 'content-type': 'text/markdown; charset=utf-8' });
      res.end(DOCS);
      return;
    } else if (path === '/shop') {
      body = { data: data.shop };
    } else if (path === '/categories') {
      body = v1(paginateV1(v1Categories, url.searchParams.get('page')));
    } else if (path === '/ingredients') {
      body = v1(paginateV1(v1Ingredients, url.searchParams.get('page')));
    } else if (path.startsWith('/ingredients/')) {
      const item = v1Ingredients.find((i) => i.id === decodeURIComponent(path.slice('/ingredients/'.length)));
      if (item) body = v1({ data: item });
      else [status, body] = [404, v1({ error: 'ingredient_not_found' })];
    } else if (path === '/allergens') {
      status = 503;
      body = v1({ error: 'allergen_service_unavailable' });
    } else if (LISTS[path]) {
      const page = paginateV2(LISTS[path], url.searchParams);
      if (page) body = page;
      else [status, body] = [400, { error: { code: 'invalid_cursor', message: 'Cursor is not valid' } }];
    } else if (/^\/v[23]\/ingredients\//.test(path)) {
      const prefix = path.slice(0, '/v2/ingredients/'.length);
      const sku = decodeURIComponent(path.slice(prefix.length));
      const item = ITEMS[prefix].find((i) => i.sku === sku);
      if (item) body = item;
      else [status, body] = [404, { error: { code: 'sku_not_found', message: `No ingredient with sku ${sku}` } }];
    } else {
      status = 404;
      body = { error: 'not_found' };
    }

    res.writeHead(status, headers);
    res.end(JSON.stringify(body));
  });
}
