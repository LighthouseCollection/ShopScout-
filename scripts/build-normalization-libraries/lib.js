/* =============================================================
   Shared helpers for the normalization-library generators.

   Deterministic JSON output: keys are emitted in insertion order,
   so callers must build objects/arrays with the required sort
   already applied. This module also computes sha256 fingerprints
   and refuses to overwrite when a row count drops sharply.
   ============================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const GENERATED_DIR = path.join(
  REPO_ROOT,
  'normalization',
  'libraries',
  'generated'
);
const DATA_SOURCES_ROOT = path.join(REPO_ROOT, 'data-sources', 'icecat');

function sourcePath(relPath) {
  return path.join(DATA_SOURCES_ROOT, relPath);
}

function outputPath(fileName) {
  return path.join(GENERATED_DIR, fileName);
}

function fileBytes(absPath) {
  const st = fs.statSync(absPath);
  return st.size;
}

function sha256OfFileSync(absPath) {
  const hash = crypto.createHash('sha256');
  const buf = fs.readFileSync(absPath);
  hash.update(buf);
  return hash.digest('hex');
}

function sha256OfString(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

/* Emit JSON with a stable formatting so byte output is reproducible.
   - UTF-8 (implicit in Node fs write)
   - LF line endings
   - 2-space indent
   - Trailing newline
*/
function serializeJson(value) {
  return JSON.stringify(value, null, 2).replace(/\r\n/g, '\n') + '\n';
}

/* Sort helpers used by every generator to enforce SCHEMA invariants. */
function sortedByCanonical(arr) {
  return [...arr].sort((a, b) => a.canonical.localeCompare(b.canonical));
}

function sortedObjectKeysNumeric(obj) {
  const out = {};
  const keys = Object.keys(obj).sort((a, b) => Number(a) - Number(b));
  for (const key of keys) out[key] = obj[key];
  return out;
}

function sortedArrayUniqueAscii(values) {
  return [...new Set(values)].sort();
}

/* Refuse to overwrite when the new output looks dramatically smaller
   than the current output on disk. Prevents a corrupt source from
   silently gutting the shipped generated file. Threshold defaults
   to 25% — anything below that fraction of the prior size is
   treated as a regression. */
function guardAgainstRegression(fileName, newContent, options) {
  const opts = options || {};
  const threshold = typeof opts.threshold === 'number' ? opts.threshold : 0.25;
  const abs = outputPath(fileName);
  if (!fs.existsSync(abs)) return;
  const priorBytes = fs.statSync(abs).size;
  if (priorBytes === 0) return;
  const newBytes = Buffer.byteLength(newContent, 'utf8');
  if (newBytes < priorBytes * threshold) {
    throw new Error(
      `${fileName}: new build is only ${newBytes} bytes vs prior ${priorBytes} bytes ` +
      `(< ${Math.round(threshold * 100)}% of prior). Refusing to overwrite. ` +
      `If this is intentional, delete ${abs} manually before rebuilding.`
    );
  }
}

function writeGeneratedFile(fileName, content) {
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
  const abs = outputPath(fileName);
  const tmp = abs + '.tmp';
  fs.writeFileSync(tmp, content, { encoding: 'utf8' });
  fs.renameSync(tmp, abs);
}

/* Streaming reader for `.xml.gz` files. Returns an async iterator that
   yields raw text chunks (utf8). Callers do their own SAX-style parsing
   on top. Never loads the fully decompressed file into memory. */
function streamGzipXml(absPath) {
  const readable = fs.createReadStream(absPath).pipe(zlib.createGunzip());
  readable.setEncoding('utf8');
  return readable;
}

/* Minimal streaming XML element parser. Accepts a readable stream of
   XML text chunks and calls callbacks for open tag, close tag, and
   attribute value. Only handles the subset Icecat's export uses:
   well-formed elements with quoted attributes, no CDATA sections
   (Icecat descriptions are HTML-encoded text, not CDATA), no
   processing instructions in mid-stream, no comments outside the
   header. Ignores text content between tags because none of the
   Icecat metadata we consume is stored in text nodes (attributes
   only). This keeps the parser small and fast. */
function parseXmlStream(stream, handlers) {
  const onOpen = handlers.onOpen || (() => {});
  const onClose = handlers.onClose || (() => {});
  let buffer = '';

  function decodeXmlAttr(value) {
    return value
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
      .replace(/&amp;/g, '&');
  }

  function parseAttrs(attrString) {
    const attrs = {};
    const re = /([\w:-]+)\s*=\s*"([^"]*)"/g;
    let m;
    while ((m = re.exec(attrString)) !== null) {
      attrs[m[1]] = decodeXmlAttr(m[2]);
    }
    return attrs;
  }

  function processBuffer() {
    let idx;
    while ((idx = buffer.indexOf('<')) !== -1) {
      // Strip text before the tag; we don't care about text nodes.
      buffer = buffer.slice(idx);
      const end = buffer.indexOf('>');
      if (end === -1) return; // wait for more data
      const raw = buffer.slice(0, end + 1);
      buffer = buffer.slice(end + 1);

      // Skip comments, doctypes, CDATA, processing instructions.
      if (raw.startsWith('<!--') || raw.startsWith('<!DOCTYPE') || raw.startsWith('<![CDATA[') || raw.startsWith('<?')) {
        continue;
      }

      // Close tag: </name>
      if (raw.startsWith('</')) {
        const name = raw.slice(2, raw.length - 1).trim();
        onClose(name);
        continue;
      }

      // Self-closing: <name attrs />
      const isSelfClose = raw.endsWith('/>');
      const inner = raw.slice(1, isSelfClose ? raw.length - 2 : raw.length - 1).trim();
      const spaceAt = inner.search(/\s/);
      const name = spaceAt === -1 ? inner : inner.slice(0, spaceAt);
      const attrString = spaceAt === -1 ? '' : inner.slice(spaceAt + 1);
      const attrs = parseAttrs(attrString);
      onOpen(name, attrs, isSelfClose);
      if (isSelfClose) {
        onClose(name);
      }
    }
  }

  return new Promise((resolve, reject) => {
    stream.on('data', chunk => {
      buffer += chunk;
      try { processBuffer(); } catch (err) { reject(err); }
    });
    stream.on('end', () => { resolve(); });
    stream.on('error', reject);
  });
}

/* Quote-aware CSV row parser for Schema.org's export. Fields may
   contain commas, escaped quotes, and multi-line values. Node has no
   built-in CSV so we implement RFC 4180 minimally. */
function parseCsvLine(line, carry) {
  const source = carry != null ? carry + '\n' + line : line;
  const fields = [];
  let cur = '';
  let inQuotes = false;
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (inQuotes) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          cur += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cur += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      fields.push(cur);
      cur = '';
      i += 1;
      continue;
    }
    cur += ch;
    i += 1;
  }
  if (inQuotes) {
    // Row spans multiple physical lines.
    return { fields: null, carry: source };
  }
  fields.push(cur);
  return { fields, carry: null };
}

async function readCsv(absPath, onRow) {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: fs.createReadStream(absPath, { encoding: 'utf8' }),
    crlfDelay: Infinity
  });
  let header = null;
  let carry = null;
  let rowIndex = 0;
  for await (const line of rl) {
    const parsed = parseCsvLine(line, carry);
    if (parsed.fields === null) {
      carry = parsed.carry;
      continue;
    }
    carry = null;
    if (header === null) {
      header = parsed.fields.map(f => f.trim());
      continue;
    }
    const row = {};
    for (let i = 0; i < header.length; i += 1) {
      row[header[i]] = parsed.fields[i] != null ? parsed.fields[i] : '';
    }
    onRow(row, rowIndex);
    rowIndex += 1;
  }
}

function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

module.exports = {
  REPO_ROOT,
  GENERATED_DIR,
  DATA_SOURCES_ROOT,
  sourcePath,
  outputPath,
  fileBytes,
  sha256OfFileSync,
  sha256OfString,
  serializeJson,
  sortedByCanonical,
  sortedObjectKeysNumeric,
  sortedArrayUniqueAscii,
  guardAgainstRegression,
  writeGeneratedFile,
  streamGzipXml,
  parseXmlStream,
  readCsv,
  nowIso
};
