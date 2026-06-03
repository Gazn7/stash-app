const { Pool } = require('pg');

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.STORAGE_URL;
const pool = connectionString ? new Pool({
  connectionString,
  ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false }
}) : null;

const TABLES = {
  users: {
    columns: ['uid', 'name', 'username', 'password', 'balance', 'escrow', 'last_seen'],
    upsert: ['uid']
  },
  challenges: {
    columns: ['id', 'title', 'amount', 'challenger_uid', 'challenger_name', 'challenged_uid', 'challenged_name', 'status', 'timer_start', 'timeout', 'created_at', 'winner_uid', 'type'],
    upsert: ['id']
  },
  challenge_votes: {
    columns: ['challenge_id', 'voter_uid', 'winner_uid'],
    upsert: ['challenge_id', 'voter_uid']
  },
  groups: {
    columns: ['id', 'name', 'icon', 'creator_uid', 'created_at'],
    upsert: ['id']
  },
  group_members: {
    columns: ['group_id', 'uid', 'name'],
    upsert: ['group_id', 'uid']
  },
  history: {
    columns: ['id', 'title', 'amount', 'challenger_uid', 'challenger_name', 'challenged_uid', 'challenged_name', 'winner_uid', 'status', 'created_at', 'type'],
    upsert: ['id']
  }
};

function send(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function cleanSelect(table, value) {
  if (!value) return '*';
  const allowed = TABLES[table].columns;
  const cols = String(value).split(',').map((c) => c.trim()).filter((c) => allowed.includes(c));
  return cols.length ? cols.map((c) => `"${c}"`).join(', ') : '*';
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); }
      catch (err) { reject(err); }
    });
    req.on('error', reject);
  });
}

function addFilters(table, query, values, clauses) {
  const allowed = TABLES[table].columns;
  Object.keys(query).forEach((key) => {
    if (!allowed.includes(key)) return;
    const raw = Array.isArray(query[key]) ? query[key][0] : query[key];
    const match = String(raw || '').match(/^eq\.(.*)$/);
    if (!match) return;
    values.push(decodeURIComponent(match[1]));
    clauses.push(`"${key}" = $${values.length}`);
  });
}

async function handleGet(req, res, table) {
  const query = req.query || {};
  const values = [];
  const clauses = [];
  addFilters(table, query, values, clauses);

  let sql = `select ${cleanSelect(table, query.select)} from "${table}"`;
  if (clauses.length) sql += ` where ${clauses.join(' and ')}`;

  if (query.order === 'created_at.desc' && TABLES[table].columns.includes('created_at')) {
    sql += ' order by "created_at" desc';
  }

  const limit = parseInt(Array.isArray(query.limit) ? query.limit[0] : query.limit || '', 10);
  if (Number.isFinite(limit) && limit > 0 && limit < 5000) {
    values.push(limit);
    sql += ` limit $${values.length}`;
  }

  const result = await pool.query(sql, values);
  send(res, 200, result.rows);
}

async function handlePost(req, res, table) {
  const body = await readBody(req);
  const meta = TABLES[table];
  const cols = meta.columns.filter((col) => Object.prototype.hasOwnProperty.call(body, col));
  if (!cols.length) return send(res, 400, { error: 'No valid columns' });

  const values = cols.map((col) => body[col]);
  const placeholders = cols.map((_, i) => `$${i + 1}`);
  const updates = cols
    .filter((col) => !meta.upsert.includes(col))
    .map((col) => `"${col}" = excluded."${col}"`);

  let sql = `insert into "${table}" (${cols.map((c) => `"${c}"`).join(', ')}) values (${placeholders.join(', ')})`;
  sql += ` on conflict (${meta.upsert.map((c) => `"${c}"`).join(', ')}) `;
  sql += updates.length ? `do update set ${updates.join(', ')}` : 'do nothing';
  sql += ' returning *';

  const result = await pool.query(sql, values);
  send(res, 200, result.rows);
}

async function handlePatch(req, res, table) {
  const body = await readBody(req);
  const meta = TABLES[table];
  const values = [];
  const sets = [];
  meta.columns.forEach((col) => {
    if (!Object.prototype.hasOwnProperty.call(body, col)) return;
    values.push(body[col]);
    sets.push(`"${col}" = $${values.length}`);
  });
  if (!sets.length) return send(res, 400, { error: 'No valid columns' });

  const clauses = [];
  addFilters(table, req.query || {}, values, clauses);
  if (!clauses.length) return send(res, 400, { error: 'PATCH requires eq filters' });

  const sql = `update "${table}" set ${sets.join(', ')} where ${clauses.join(' and ')} returning *`;
  const result = await pool.query(sql, values);
  send(res, 200, result.rows);
}

async function handleDelete(req, res, table) {
  const values = [];
  const clauses = [];
  addFilters(table, req.query || {}, values, clauses);
  if (!clauses.length) return send(res, 400, { error: 'DELETE requires eq filters' });
  const result = await pool.query(`delete from "${table}" where ${clauses.join(' and ')} returning *`, values);
  send(res, 200, result.rows);
}

module.exports = async function handler(req, res) {
  if (!pool) return send(res, 500, { error: 'Missing POSTGRES_URL, DATABASE_URL, or STORAGE_URL' });

  const table = req.query.table;
  if (!TABLES[table]) return send(res, 404, { error: 'Unknown table' });

  try {
    if (req.method === 'GET') return await handleGet(req, res, table);
    if (req.method === 'POST') return await handlePost(req, res, table);
    if (req.method === 'PATCH') return await handlePatch(req, res, table);
    if (req.method === 'DELETE') return await handleDelete(req, res, table);
    return send(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return send(res, 500, { error: err.message });
  }
};
