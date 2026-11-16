// A tiny in-memory stand-in for the Supabase client, for tests. Tables are arrays in `db`; every call is recorded in `log`.
export const db = {};
export const log = [];
export const rpcHandlers = {};
export const failures = {}; // e.g. failures['project_suppliers.insert'] = 'boom'

export const reset = (tables = {}) => {
  Object.keys(db).forEach((k) => delete db[k]);
  Object.assign(db, tables);
  log.length = 0;
  Object.keys(rpcHandlers).forEach((k) => delete rpcHandlers[k]);
  Object.keys(failures).forEach((k) => delete failures[k]);
};

let counter = 0;
const newId = () => `id-${++counter}`;

const withJoins = (table, row) => {
  if (table === 'project_suppliers') {
    const s = (db.suppliers || []).find((x) => x.id === row.supplier_id);
    return { ...row, suppliers: s ? { name: s.name } : null };
  }
  return row;
};

const builder = (table) => {
  const q = { op: 'select', filters: [], payload: null, wantSingle: false, wantRows: false };
  const chain = () => q;
  q.select = () => { if (q.op !== 'select') q.wantRows = true; return q; };
  q.eq = (col, val) => { q.filters.push((r) => r[col] === val); return q; };
  q.in = (col, vals) => { q.filters.push((r) => vals.includes(r[col])); return q; };
  q.is = (col, val) => { q.filters.push((r) => (r[col] ?? null) === val); return q; };
  q.order = chain;
  q.insert = (rows) => { q.op = 'insert'; q.payload = rows; return q; };
  q.update = (obj) => { q.op = 'update'; q.payload = obj; return q; };
  q.delete = () => { q.op = 'delete'; return q; };
  q.single = () => { q.wantSingle = true; return q; };
  q.run = () => {
    log.push({ table, op: q.op, payload: q.payload });
    const failKey = `${table}.${q.op}`;
    if (failures[failKey]) return { data: null, error: { message: failures[failKey] } };
    db[table] = db[table] || [];
    const match = (r) => q.filters.every((f) => f(r));
    if (q.op === 'insert') {
      const rows = q.payload.map((r) => ({ id: newId(), ...r }));
      // unique (project_id, supplier_id) like the real table
      if (table === 'project_suppliers') {
        for (const r of rows) {
          if (db[table].some((x) => x.project_id === r.project_id && x.supplier_id === r.supplier_id)) {
            return { data: null, error: { message: 'duplicate key value violates unique constraint' } };
          }
        }
      }
      if (table === 'suppliers') {
        for (const r of rows) {
          if (db[table].some((x) => x.name.toLowerCase() === r.name.toLowerCase())) {
            return { data: null, error: { message: 'duplicate key value violates unique constraint' } };
          }
        }
      }
      db[table].push(...rows);
      return { data: q.wantSingle ? rows[0] : rows, error: null };
    }
    if (q.op === 'update') {
      db[table].filter(match).forEach((r) => Object.assign(r, q.payload));
      return { data: null, error: null };
    }
    if (q.op === 'delete') {
      db[table] = db[table].filter((r) => !match(r));
      return { data: null, error: null };
    }
    const rows = db[table].filter(match).map((r) => withJoins(table, r));
    return { data: q.wantSingle ? rows[0] ?? null : rows, error: null };
  };
  q.then = (resolve, reject) => Promise.resolve(q.run()).then(resolve, reject);
  return q;
};

export const supabase = {
  from: builder,
  rpc: (name, args) => {
    log.push({ rpc: name, args });
    const h = rpcHandlers[name];
    return Promise.resolve(h ? h(args) : { data: null, error: null });
  },
  auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
  storage: {
    from: () => ({
      upload: async (path) => { log.push({ upload: path }); return failures.upload ? { error: { message: failures.upload } } : { data: { path }, error: null }; },
      remove: async (paths) => { log.push({ remove: paths }); return { error: null }; },
      createSignedUrl: async () => ({ data: { signedUrl: 'https://signed.example/x.pdf' }, error: null }),
    }),
  },
};
