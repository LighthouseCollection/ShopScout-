/* Unit test for SS.canonicalizeProductUrl (defined in utils.js).
   utils.js is a browser bundle (IIFE attaching to window.SS), so we
   shim window/document and require it indirectly via vm. Keeps the
   test hermetic. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'utils.js'), 'utf8');
const m = src.match(/function canonicalizeProductUrl\([\s\S]*?\n  \}/);
assert.ok(m, 'canonicalizeProductUrl function block found in utils.js');

/* eslint-disable no-new-func */
const canonicalizeProductUrl = new Function('URL',
  'return (' + m[0].replace(/^function\s+/, 'function ') + ')')(URL);

/* ---- Amazon: strip slug + /ref + every query param ---- */
assert.strictEqual(
  canonicalizeProductUrl(
    'https://www.amazon.com/Dremel-Cordless-Rotary-Variable-Comfort/dp/B09SKFVSMZ/ref=sr_1_1?crid=ZVLQ&dib=eyJ&keywords=8240-5&qid=178&th=1'),
  'https://www.amazon.com/dp/B09SKFVSMZ',
  'Amazon /dp slug stripped'
);
assert.strictEqual(
  canonicalizeProductUrl('https://www.amazon.com/dp/B01M1SJNVU?th=1'),
  'https://www.amazon.com/dp/B01M1SJNVU',
  'Amazon /dp bare + query'
);
assert.strictEqual(
  canonicalizeProductUrl('https://www.amazon.co.uk/gp/product/B07K5L1KK6/ref=ox_sc_act_title_1?th=1'),
  'https://www.amazon.co.uk/dp/B07K5L1KK6',
  'Amazon UK /gp/product canonicalized'
);

/* ---- eBay: keep /itm/ID ---- */
assert.strictEqual(
  canonicalizeProductUrl('https://www.ebay.com/itm/Some-Listing-Title/123456789012?hash=item1&var=0'),
  'https://www.ebay.com/itm/123456789012',
  'eBay /itm slug stripped'
);
assert.strictEqual(
  canonicalizeProductUrl('https://www.ebay.com/itm/123456789012'),
  'https://www.ebay.com/itm/123456789012',
  'eBay bare /itm'
);

/* ---- Walmart: keep /ip/ID ---- */
assert.strictEqual(
  canonicalizeProductUrl('https://www.walmart.com/ip/Some-Slug-Name/123456789?athcpid=foo&irsourceid=bar'),
  'https://www.walmart.com/ip/123456789',
  'Walmart /ip slug stripped'
);

/* ---- Generic: strip hash + every query ---- */
assert.strictEqual(
  canonicalizeProductUrl('https://example.com/products/widget?utm_source=foo&utm_medium=bar#reviews'),
  'https://example.com/products/widget',
  'Generic site — strip all query + hash'
);
assert.strictEqual(
  canonicalizeProductUrl('https://example.com/p/abc'),
  'https://example.com/p/abc',
  'Generic clean URL passes through'
);

/* ---- Falsy and malformed input ---- */
assert.strictEqual(canonicalizeProductUrl(''), '', 'empty input');
assert.strictEqual(canonicalizeProductUrl(null), '', 'null input');
assert.strictEqual(canonicalizeProductUrl('not a url'), 'not a url', 'malformed input passes through');

console.log('canonicalize-url.test.js — all assertions passed');
