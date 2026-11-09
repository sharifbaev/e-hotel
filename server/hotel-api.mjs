/**
 * Локальный API HotelOS для разработки: комментарии гостей и QR-коды номеров.
 * Без зависимостей — только Node.js. Данные хранятся в server/data/db.json.
 *
 * Запуск: npm run api   (порт 3000, можно поменять: PORT=3100 npm run api)
 * Angular dev-server проксирует /api → http://localhost:3000 (proxy.conf.json),
 * поэтому телефон в той же Wi-Fi сети ходит на тот же адрес, что и сайт.
 *
 * Эндпоинты:
 *   GET    /api/lan                    — IP-адреса ноутбука в локальной сети (для QR-кода)
 *   GET    /api/qr                     — номера, для которых включён QR-код
 *   GET    /api/qr/:room               — { room, enabled }
 *   PUT    /api/qr/:room               — { enabled: boolean }
 *   GET    /api/comments               — все комментарии, новые сверху
 *   POST   /api/comments               — { room, rating, text, guest? } (публичный, со страницы гостя)
 *   PATCH  /api/comments/:id           — { status: 'new' | 'read' }
 *   POST   /api/comments/read-all      — отметить все прочитанными
 *   DELETE /api/comments/:id
 */
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), 'data');
const DB_FILE = join(DATA_DIR, 'db.json');

/** Номера из моков, у которых QR включён «из коробки» (кроме 104, 304, 402 — как в дизайне). */
const SEED_QR_ROOMS = [
  '101',
  '102',
  '103',
  '105',
  '106',
  '201',
  '202',
  '203',
  '204',
  '205',
  '206',
  '301',
  '302',
  '401',
];

const MAX_TEXT = 500;
const MAX_NAME = 60;

// ---------- Хранилище ----------

function loadDb() {
  if (!existsSync(DB_FILE)) {
    return { nextId: 1, qrRooms: [...SEED_QR_ROOMS], comments: [] };
  }
  try {
    const db = JSON.parse(readFileSync(DB_FILE, 'utf8'));
    return {
      nextId: Number(db.nextId) || 1,
      qrRooms: Array.isArray(db.qrRooms) ? db.qrRooms.map(String) : [...SEED_QR_ROOMS],
      comments: Array.isArray(db.comments) ? db.comments : [],
    };
  } catch (e) {
    console.error('Не удалось прочитать', DB_FILE, '— начинаю с пустой базы.', e.message);
    return { nextId: 1, qrRooms: [...SEED_QR_ROOMS], comments: [] };
  }
}

let db = loadDb();

function saveDb() {
  mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DB_FILE + '.tmp';
  writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
  renameSync(tmp, DB_FILE);
}

// ---------- Утилиты ----------

/** Локальное время ноутбука в формате YYYY-MM-DDTHH:mm:ss (как IsoDateTime в моделях фронта). */
function nowLocal() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

const VIRTUAL_IF =
  /vethernet|virtualbox|vmware|docker|wsl|hyper-v|loopback|tailscale|zerotier|vbox|utun|bridge/i;

/** IPv4-адреса в локальной сети; домашние/офисные Wi-Fi адреса — первыми. */
function lanAddresses() {
  const list = [];
  for (const [name, addrs] of Object.entries(networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === 'IPv4' && !a.internal && !VIRTUAL_IF.test(name)) {
        list.push({ name, address: a.address });
      }
    }
  }
  const rank = (ip) =>
    ip.startsWith('192.168.')
      ? 0
      : ip.startsWith('10.')
        ? 1
        : /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
          ? 2
          : 3;
  return list.sort((x, y) => rank(x.address) - rank(y.address));
}

function send(res, status, body) {
  const payload = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(payload);
}

function error(res, status, code) {
  send(res, status, { error: code });
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 32 * 1024) {
        reject(new Error('too_large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('bad_json'));
      }
    });
    req.on('error', reject);
  });
}

const ROOM_RE = /^[0-9A-Za-zА-Яа-я]{1,6}$/;

// ---------- Маршруты ----------

async function handle(req, res) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const parts = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean); // ['api', ...]
  const method = req.method ?? 'GET';

  if (method === 'OPTIONS') {
    send(res, 204);
    return;
  }
  if (parts[0] !== 'api') {
    error(res, 404, 'not_found');
    return;
  }

  const [, resource, id, action] = parts;

  // ----- LAN -----
  if (resource === 'lan' && method === 'GET') {
    send(res, 200, { addresses: lanAddresses() });
    return;
  }

  // ----- QR-коды номеров -----
  if (resource === 'qr') {
    if (!id && method === 'GET') {
      send(res, 200, db.qrRooms);
      return;
    }
    if (id && !ROOM_RE.test(id)) {
      error(res, 400, 'bad_room');
      return;
    }
    if (id && method === 'GET') {
      send(res, 200, { room: id, enabled: db.qrRooms.includes(id) });
      return;
    }
    if (id && method === 'PUT') {
      const body = await readJson(req);
      const enabled = body.enabled === true;
      const set = new Set(db.qrRooms);
      if (enabled) {
        set.add(id);
      } else {
        set.delete(id);
      }
      // Переименование номера: перенести QR со старого номера на новый.
      if (typeof body.from === 'string' && body.from !== id) {
        set.delete(body.from);
      }
      db.qrRooms = [...set].sort();
      saveDb();
      send(res, 200, { room: id, enabled });
      return;
    }
  }

  // ----- Комментарии -----
  if (resource === 'comments') {
    if (!id && method === 'GET') {
      send(
        res,
        200,
        [...db.comments].sort((a, b) => b.at.localeCompare(a.at) || b.id - a.id),
      );
      return;
    }

    if (!id && method === 'POST') {
      const body = await readJson(req);
      const room = String(body.room ?? '').trim();
      const text = String(body.text ?? '')
        .trim()
        .slice(0, MAX_TEXT);
      const guest = String(body.guest ?? '')
        .trim()
        .slice(0, MAX_NAME);
      const rating = Number(body.rating);
      if (!ROOM_RE.test(room)) {
        error(res, 400, 'bad_room');
        return;
      }
      if (!db.qrRooms.includes(room)) {
        error(res, 403, 'qr_disabled');
        return;
      }
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        error(res, 400, 'bad_rating');
        return;
      }
      if (!text) {
        error(res, 400, 'empty_text');
        return;
      }
      const comment = { id: db.nextId++, at: nowLocal(), room, guest, rating, text, status: 'new' };
      db.comments.push(comment);
      saveDb();
      console.log(
        `[${comment.at}] Новый комментарий: № ${room}, ${rating}★ — ${text.slice(0, 60)}`,
      );
      send(res, 201, comment);
      return;
    }

    if (id === 'read-all' && method === 'POST') {
      db.comments = db.comments.map((c) => ({ ...c, status: 'read' }));
      saveDb();
      send(res, 200, { ok: true });
      return;
    }

    const num = Number(id);
    const idx = db.comments.findIndex((c) => c.id === num);
    if (id && !action && idx === -1) {
      error(res, 404, 'not_found');
      return;
    }
    if (id && method === 'PATCH') {
      const body = await readJson(req);
      if (body.status !== 'new' && body.status !== 'read') {
        error(res, 400, 'bad_status');
        return;
      }
      db.comments[idx] = { ...db.comments[idx], status: body.status };
      saveDb();
      send(res, 200, db.comments[idx]);
      return;
    }
    if (id && method === 'DELETE') {
      db.comments.splice(idx, 1);
      saveDb();
      send(res, 204);
      return;
    }
  }

  error(res, 404, 'not_found');
}

createServer((req, res) => {
  handle(req, res).catch((e) => {
    const code =
      e?.message === 'bad_json' || e?.message === 'too_large' ? e.message : 'server_error';
    if (code === 'server_error') {
      console.error(e);
    }
    if (!res.headersSent) {
      error(res, code === 'server_error' ? 500 : 400, code);
    }
  });
}).listen(PORT, () => {
  console.log(`HotelOS API: http://localhost:${PORT}/api  (данные: ${DB_FILE})`);
  const lan = lanAddresses();
  if (lan.length) {
    console.log('Адрес для телефона (Angular на порту 4200):');
    for (const a of lan) {
      console.log(`  http://${a.address}:4200   (${a.name})`);
    }
  } else {
    console.log('Ноутбук не подключён к локальной сети — QR-код с телефона не откроется.');
  }
});
