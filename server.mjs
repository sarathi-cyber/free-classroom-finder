import http from 'node:http';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluate, istNow, parseSearch } from './dist/engine.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, 'dist');
const DATA_FILE = path.join(DIST_DIR, 'data.json');
const METADATA_FILE = path.join(__dirname, 'server-data', 'room-details.json');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const MAX_BODY = 64 * 1024;

const timetable = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
const roomIds = new Set(timetable.rooms.map((room) => room.id));

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
    'Cache-Control': 'no-store'
  });
  res.end(data);
}

function safeMetadataValue(value = {}) {
  return {
    floor: [0, 1, 2].includes(value.floor) ? value.floor : null,
    ac: typeof value.ac === 'boolean' ? value.ac : null,
    capacity: Number.isInteger(value.capacity) && value.capacity > 0 && value.capacity <= 1000
      ? value.capacity
      : null
  };
}

async function readMetadata() {
  try {
    const parsed = JSON.parse(await fs.readFile(METADATA_FILE, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const clean = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (roomIds.has(id)) clean[id] = safeMetadataValue(value);
    }
    return clean;
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

async function writeMetadata(metadata) {
  await fs.mkdir(path.dirname(METADATA_FILE), { recursive: true });
  const temp = `${METADATA_FILE}.tmp`;
  await fs.writeFile(temp, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
  await fs.rename(temp, METADATA_FILE);
}

function mergedRooms(metadata) {
  return timetable.rooms.map((room) => ({ ...room, ...safeMetadataValue(metadata[room.id]) }));
}

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw Object.assign(new Error('Request body is too large.'), { status: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('Request body must be valid JSON.'), { status: 400 });
  }
}

function normalizeFilters(value = {}) {
  const now = istNow();
  const q = {
    date: typeof value.date === 'string' ? value.date : now.date,
    time: typeof value.time === 'string' ? value.time : now.time,
    duration: Number(value.duration ?? 60),
    floor: ['all', 'unknown', '0', '1', '2'].includes(String(value.floor)) ? String(value.floor) : 'all',
    ac: ['any', 'yes', 'no'].includes(value.ac) ? value.ac : 'any',
    people: value.people === '' || value.people == null ? '' : Number(value.people)
  };
  if (!Number.isInteger(q.duration) || q.duration < 1 || q.duration > 470) {
    throw Object.assign(new Error('Duration must be between 1 and 470 whole minutes.'), { status: 400 });
  }
  if (q.people !== '' && (!Number.isInteger(q.people) || q.people < 1 || q.people > 1000)) {
    throw Object.assign(new Error('People must be between 1 and 1000.'), { status: 400 });
  }
  return q;
}

async function apiHandler(req, res, pathname) {
  if (req.method === 'GET' && pathname === '/api/health') {
    return sendJson(res, 200, { ok: true, app: 'Roomwise', mode: 'dynamic', time: new Date().toISOString() });
  }

  if (req.method === 'GET' && pathname === '/api/data') {
    const metadata = await readMetadata();
    return sendJson(res, 200, {
      ...timetable,
      rooms: mergedRooms(metadata),
      runtime: { mode: 'server', metadataStorage: 'server-data/room-details.json' }
    });
  }

  if (req.method === 'GET' && pathname === '/api/metadata') {
    return sendJson(res, 200, { rooms: await readMetadata() });
  }

  if (req.method === 'PUT' && pathname === '/api/metadata') {
    const body = await readBody(req);
    if (!body.rooms || typeof body.rooms !== 'object' || Array.isArray(body.rooms)) {
      return sendJson(res, 400, { error: 'Expected a rooms object.' });
    }
    const clean = {};
    for (const [id, value] of Object.entries(body.rooms)) {
      if (roomIds.has(id)) clean[id] = safeMetadataValue(value);
    }
    await writeMetadata(clean);
    return sendJson(res, 200, { ok: true, rooms: clean, data: { ...timetable, rooms: mergedRooms(clean) } });
  }

  if (req.method === 'POST' && pathname === '/api/search') {
    const body = await readBody(req);
    const metadata = await readMetadata();
    const rooms = mergedRooms(metadata);
    let filters;
    let notes = [];
    if (typeof body.text === 'string') {
      const parsed = parseSearch(body.text, normalizeFilters(body.base || {}));
      filters = parsed.query;
      notes = parsed.notes;
    } else {
      filters = normalizeFilters(body.filters || body);
    }
    const results = rooms.map((room) => evaluate(room, timetable.events, filters));
    return sendJson(res, 200, {
      filters,
      notes,
      summary: {
        matches: results.filter((r) => r.match).length,
        occupiedAtStart: results.filter((r) => r.current.length).length,
        trackedVenues: results.length
      },
      results
    });
  }

  return false;
}

const mime = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.pdf', 'application/pdf'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp']
]);

async function serveStatic(req, res, pathname) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  let decoded;
  try {
    decoded = decodeURIComponent(requested);
  } catch {
    res.writeHead(400);
    return res.end('Bad request');
  }
  const relative = decoded.replace(/^\/+/, '');
  const filePath = path.resolve(DIST_DIR, relative);
  if (filePath !== DIST_DIR && !filePath.startsWith(`${DIST_DIR}${path.sep}`)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) throw Object.assign(new Error(), { code: 'ENOENT' });
    res.writeHead(200, {
      'Content-Type': mime.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=300'
    });
    fsSync.createReadStream(filePath).pipe(res);
  } catch (error) {
    if (error.code !== 'ENOENT') console.error(error);
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) {
      const handled = await apiHandler(req, res, url.pathname);
      if (handled === false) sendJson(res, 404, { error: 'API endpoint not found.' });
      return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      return res.end('Method not allowed');
    }
    await serveStatic(req, res, url.pathname);
  } catch (error) {
    console.error(error);
    sendJson(res, error.status || 500, { error: error.status ? error.message : 'Internal server error.' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Roomwise dynamic server running at http://${HOST}:${PORT}`);
});
